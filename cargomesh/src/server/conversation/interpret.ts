import "server-only";

import { BedrockRuntimeClient, ConverseCommand, type ConverseCommandOutput } from "@aws-sdk/client-bedrock-runtime";
import { ConversationFieldNameSchema, InterpretationSchema, interpretDeterministically, type InterpretationRequest } from "@/features/v2-conversation-prep/interpretation";

type Config = { enabled: boolean; region: string; modelId: string; maxTokens: number; timeoutMs: number; inputUsdPerMillion: number | null; outputUsdPerMillion: number | null };
type Invoke = (config: Config, input: InterpretationRequest) => Promise<ConverseCommandOutput>;

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
    region: env.CARGOMESH_BEDROCK_REGION ?? "",
    modelId: env.CARGOMESH_BEDROCK_MODEL_ID ?? "",
    maxTokens: boundedNumber(env.CARGOMESH_BEDROCK_CONVERSATION_MAX_TOKENS, 300, 64, 500),
    timeoutMs: boundedNumber(env.CARGOMESH_BEDROCK_CONVERSATION_TIMEOUT_MS, 6000, 1000, 10000),
    inputUsdPerMillion: price(env.CARGOMESH_BEDROCK_INPUT_USD_PER_MILLION_TOKENS),
    outputUsdPerMillion: price(env.CARGOMESH_BEDROCK_OUTPUT_USD_PER_MILLION_TOKENS),
  };
}

async function invoke(config: Config, input: InterpretationRequest): Promise<ConverseCommandOutput> {
  // The AWS SDK resolves an IAM role or temporary credentials from its standard chain.
  // No static key is accepted from the browser or stored in this module.
  const client = new BedrockRuntimeClient({ region: config.region, maxAttempts: 1 });
  try {
    const credentials = await client.config.credentials();
    if (!credentials.sessionToken) throw new Error("Temporary IAM credentials required.");
    return await client.send(new ConverseCommand({
      modelId: config.modelId,
      system: [{ text: "You interpret one CargoMesh freight chat turn. Output only a JSON object without Markdown, with intent, fields, and optional acknowledgment. fields MUST be an array of objects shaped {field:string,value:string}; use [] when empty. Allowed intents: PROVIDE, CORRECT, CREATE, READ, EVALUATE, PRICE, BOOKING, HELP, START_OVER. Allowed fields are exactly those provided in the currentField and fieldNames input. Extract only values explicitly supplied by the user; never invent a location, date, cargo value or confirmation. Do not decide eligibility, capacity, price, booking, tenant or identity. For a brief natural reply, acknowledgment may be exactly 'Got it.', 'Thanks, I have that.', or 'Understood.'. No SQL, tool invocation or explanation." }],
      messages: [{ role: "user", content: [{ text: JSON.stringify({ text: input.text, currentField: input.currentField, fieldNames: ConversationFieldNameSchema.options }) }] }],
      toolConfig: {
        tools: [{ toolSpec: {
          name: "propose_conversation_turn",
          description: "Return a structured proposal for this chat turn only. This tool does not perform a business action.",
          inputSchema: { json: {
            type: "object",
            properties: {
              intent: { type: "string", enum: ["PROVIDE", "CORRECT", "CREATE", "READ", "EVALUATE", "PRICE", "BOOKING", "HELP", "START_OVER"] },
              fields: { type: "array", items: { type: "object", properties: { field: { type: "string", enum: ConversationFieldNameSchema.options }, value: { type: "string" } }, required: ["field", "value"] } },
              acknowledgment: { type: "string", enum: ["Got it.", "Thanks, I have that.", "Understood."] },
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
