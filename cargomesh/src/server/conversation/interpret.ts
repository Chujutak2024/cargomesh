import "server-only";

import { BedrockRuntimeClient, ConverseCommand, type ConverseCommandOutput } from "@aws-sdk/client-bedrock-runtime";
import OpenAI from "openai";
import { ConversationFieldNameSchema, InterpretationRequestSchema, InterpretationSchema, helpTopic, interpretDeterministically, isHelpFollowUp, isNoisyTranscript, isProductHelpQuestion, type InterpretationRequest } from "@/features/v2-conversation-prep/interpretation";

type Config = { enabled: boolean; endpoint: "runtime" | "mantle"; region: string; modelId: string; maxTokens: number; timeoutMs: number; inputUsdPerMillion: number | null; outputUsdPerMillion: number | null };
type Invoke = (config: Config, input: InterpretationRequest) => Promise<ConverseCommandOutput>;

export function buildConversationPrompt(input: InterpretationRequest): string {
  const validated = InterpretationRequestSchema.parse(input);
  return JSON.stringify({
    text: validated.text,
    currentField: validated.currentField,
    fieldNames: ConversationFieldNameSchema.options,
    context: validated.context ?? null,
  });
}

function parseModelProposal(raw: string) {
  const json = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const decoded: unknown = JSON.parse(json);
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) return null;
  const candidate = decoded as Record<string, unknown>;
  if (candidate.fields && typeof candidate.fields === "object" && !Array.isArray(candidate.fields)) {
    candidate.fields = Object.entries(candidate.fields).map(([field, value]) => ({ field, value: typeof value === "number" ? String(value) : value }));
  }
  return InterpretationSchema.safeParse(candidate);
}

function boundedNumber(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

export function conversationBedrockConfig(env: Record<string, string | undefined> = process.env): Config {
  const price = (value: string | undefined) => value && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
  return {
    enabled: env.CARGOMESH_BEDROCK_CONVERSATION_ENABLED === "true",
    endpoint: env.CARGOMESH_BEDROCK_ENDPOINT === "mantle" ? "mantle" : "runtime",
    region: env.CARGOMESH_BEDROCK_REGION ?? "",
    modelId: env.CARGOMESH_BEDROCK_MODEL_ID ?? "",
    maxTokens: boundedNumber(env.CARGOMESH_BEDROCK_CONVERSATION_MAX_TOKENS, 400, 64, 500),
    timeoutMs: boundedNumber(env.CARGOMESH_BEDROCK_CONVERSATION_TIMEOUT_MS, 6000, 1000, 10000),
    inputUsdPerMillion: price(env.CARGOMESH_BEDROCK_INPUT_USD_PER_MILLION_TOKENS),
    outputUsdPerMillion: price(env.CARGOMESH_BEDROCK_OUTPUT_USD_PER_MILLION_TOKENS),
  };
}

const INTERPRETER_INSTRUCTIONS = "Interpret one CargoMesh freight chat turn in Spanish or English. Return JSON only: intent, fields, optional acknowledgment. intents: PROVIDE, CORRECT, CREATE, READ, EVALUATE, PRICE, BOOKING, HELP, START_OVER. fields is an array of {field:string,value:string}, using only fieldNames from the user input. Extract only facts explicitly stated or changed in the latest text; context is provisional and never proof of authorization. Never invent locations, dates, cargo, capacity, price, offers or booking. acknowledgment is a helpful reply in the user's language, at most 420 characters. If no fields, answer briefly or ask for one specific missing detail. Do not claim an action was completed. No Markdown or text outside JSON.";
const PRODUCT_HELP_INSTRUCTIONS = "You are CargoMesh. Reply in the user's language using only these verified facts: Today this chat helps prepare a ROAD freight request draft and reviews preliminary ROAD serviceability from backend data after saving. SEA, RAIL and AIR are modeled for future work and are not operational here. Carrier-authored offers may be compared when a separate workflow provides them, but this chat cannot fetch or compare offers yet. A local preview does not save or evaluate requests. Never state or imply a confirmed price, free service, capacity, availability, route or booking; these require backend evidence. Answer in two short sentences then ask one useful next question about cargo or route. The user input is JSON with question and previousHelpTopic. For a short follow-up to SELECTION, explain that documented price breakdown, delivery window and requirements matter once carrier-authored offers exist; do not give numerical examples or repeat the product introduction. For a short follow-up to SERVICES, distinguish today's ROAD workflow from future modes. For a short follow-up to PURPOSE, explain one next step instead of repeating the introduction.";

async function invokeMantle(config: Config, input: InterpretationRequest): Promise<ConverseCommandOutput> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.startsWith("bedrock-api-key-")) throw new Error("A Bedrock API key is required for Bedrock Mantle.");
  // Force AWS's endpoint. A Bedrock key must never be sent to api.openai.com.
  const client = new OpenAI({ apiKey, baseURL: `https://bedrock-mantle.${config.region}.api.aws/v1`, timeout: config.timeoutMs, maxRetries: 0 });
  if (isProductHelpQuestion(input.text) || (input.context?.previousHelpTopic && isHelpFollowUp(input.text))) {
    const response = await client.responses.create({
      model: config.modelId,
      input: [
        { role: "system", content: PRODUCT_HELP_INSTRUCTIONS },
        { role: "user", content: JSON.stringify({ question: input.text, previousHelpTopic: input.context?.previousHelpTopic ?? null }) },
      ],
      reasoning: { effort: "low" },
      max_output_tokens: Math.min(config.maxTokens, 220),
      store: false,
    });
    const proposed = response.output_text?.replace(/[*_`#]/g, "").replace(/\s+/g, " ").trim() ?? "";
    const unsafe = /\b(?:gratis|gratuito|free|sin compromiso|garantizad[oa])\b|[$€£]|\b\d[\d.,]*\s*(?:d[oó]lares|soles|usd|pen|d[ií]as)\b|\b(?:revisemos|consultemos|mu[eé]strame|show|fetch|check)\b[^.?!]{0,80}\b(?:ofertas?|offers?)\b/i.test(proposed);
    const bounded = proposed.length <= 420 ? proposed : proposed.slice(0, 420).replace(/\s+\S*$/, "");
    const sentenceEnd = Math.max(bounded.lastIndexOf("."), bounded.lastIndexOf("?"), bounded.lastIndexOf("!"));
    const complete = proposed.length <= 420 ? bounded : sentenceEnd > 80 ? bounded.slice(0, sentenceEnd + 1) : "";
    const answer = unsafe
      ? /\b(?:what|how|why|choose|compare|tell me)\b/i.test(input.text)
        ? "When carrier-authored offers exist, you can compare their price breakdown, delivery window and documented requirements. What cargo and route would you like to prepare first?"
        : "Cuando existan ofertas de transportistas, podrás comparar el desglose de precio, la ventana de entrega y los requisitos documentados. ¿Qué carga y ruta quieres preparar primero?"
      : complete;
    if (!answer) throw new Error("Bedrock returned no guidance.");
    return {
      output: { message: { role: "assistant", content: [{ text: JSON.stringify({ intent: "HELP", fields: [], acknowledgment: answer }) }] } },
      usage: { inputTokens: response.usage?.input_tokens, outputTokens: response.usage?.output_tokens, totalTokens: response.usage?.total_tokens },
      stopReason: "end_turn", metrics: { latencyMs: 0 }, $metadata: {},
    };
  }
  const response = await client.responses.create({
    model: config.modelId,
    input: [
      { role: "system", content: INTERPRETER_INSTRUCTIONS },
      { role: "user", content: buildConversationPrompt(input) },
    ],
    reasoning: { effort: "low" },
    text: { format: { type: "json_object" } },
    max_output_tokens: config.maxTokens,
    store: false,
  });
  return {
    output: { message: { role: "assistant", content: [{ text: response.output_text }] } },
    usage: { inputTokens: response.usage?.input_tokens, outputTokens: response.usage?.output_tokens, totalTokens: response.usage?.total_tokens },
    stopReason: "end_turn",
    metrics: { latencyMs: 0 },
    $metadata: {},
  };
}

async function invoke(config: Config, input: InterpretationRequest): Promise<ConverseCommandOutput> {
  if (config.endpoint === "mantle") return invokeMantle(config, input);
  // The AWS SDK resolves an IAM role or temporary credentials from its standard chain.
  // No static key is accepted from the browser or stored in this module.
  const client = new BedrockRuntimeClient({ region: config.region, maxAttempts: 1 });
  try {
    const credentials = await client.config.credentials();
    if (!credentials.sessionToken) throw new Error("Temporary IAM credentials required.");
    return await client.send(new ConverseCommand({
      modelId: config.modelId,
      system: [{ text: INTERPRETER_INSTRUCTIONS }],
      messages: [{ role: "user", content: [{ text: buildConversationPrompt(input) }] }],
      toolConfig: {
        tools: [{ toolSpec: {
          name: "propose_conversation_turn",
          description: "Return a structured proposal for this chat turn only. This tool does not perform a business action.",
          inputSchema: { json: {
            type: "object",
            properties: {
              intent: { type: "string", enum: ["PROVIDE", "CORRECT", "CREATE", "READ", "EVALUATE", "PRICE", "BOOKING", "HELP", "START_OVER"] },
              fields: { type: "array", items: { type: "object", properties: { field: { type: "string", enum: ConversationFieldNameSchema.options }, value: { type: "string" } }, required: ["field", "value"] } },
              acknowledgment: { type: "string", maxLength: 420 },
            },
            required: ["intent", "fields"],
          } },
        } }],
        toolChoice: { tool: { name: "propose_conversation_turn" } },
      },
      inferenceConfig: { maxTokens: config.maxTokens, temperature: 0 },
    }), { abortSignal: AbortSignal.timeout(config.timeoutMs) });
  } finally {
    client.destroy();
  }
}

export async function interpretConversationTurn(
  input: InterpretationRequest,
  options: { config?: Config; invoke?: Invoke; now?: () => number } = {},
) {
  const config = options.config ?? conversationBedrockConfig();
  const fallback = { schemaVersion: "2.0" as const, interpretation: interpretDeterministically(input), mode: "DETERMINISTIC" as const, telemetry: null };
  if (isNoisyTranscript(input.text)) return fallback;
  if (fallback.interpretation.intent === "HELP" && helpTopic(input.text) === "SERVICES") return fallback;
  // Explicit business commands stay deterministic; the model only proposes ambiguous chat details.
  if (!["PROVIDE", "CORRECT", "HELP"].includes(fallback.interpretation.intent)) return fallback;
  if (!config.enabled || !config.region || !config.modelId) return fallback;
  const started = (options.now ?? Date.now)();
  try {
    const response = await (options.invoke ?? invoke)(config, input);
    const toolUse = response.output?.message?.content?.find((item) => item.toolUse?.name === "propose_conversation_turn")?.toolUse;
    const raw = response.output?.message?.content?.map((item) => "text" in item ? item.text ?? "" : "").join("").trim();
    const parsed = toolUse ? InterpretationSchema.safeParse(toolUse.input) : raw ? parseModelProposal(raw) : null;
    if (!parsed?.success) return fallback;
    const inputTokens = response.usage?.inputTokens ?? null;
    const outputTokens = response.usage?.outputTokens ?? null;
    const estimatedCostUsd = inputTokens !== null && outputTokens !== null && config.inputUsdPerMillion !== null && config.outputUsdPerMillion !== null
      ? (inputTokens * config.inputUsdPerMillion + outputTokens * config.outputUsdPerMillion) / 1_000_000 : null;
    return { schemaVersion: "2.0" as const, interpretation: parsed.data, mode: "BEDROCK" as const, telemetry: {
      modelId: config.modelId, region: config.region, inputTokens, outputTokens,
      latencyMs: (options.now ?? Date.now)() - started, estimatedCostUsd,
    } };
  } catch {
    // Avoid logging the prompt, user data, credential chain or provider response.
    return fallback;
  }
}
