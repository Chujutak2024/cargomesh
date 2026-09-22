import { BedrockRuntimeClient, ConverseCommand, type ConverseCommandOutput } from "@aws-sdk/client-bedrock-runtime";
import { NarrationInputSchema, type NarrationInput, type NarrationResult } from "./contracts";
import { deterministicNarration } from "./deterministic";

type BedrockNarrationConfiguration = {
  enabled: boolean;
  modelId: string | undefined;
  region: string | undefined;
};

type Dependencies = {
  configuration: () => BedrockNarrationConfiguration;
  invoke: (region: string, modelId: string, input: NarrationInput) => Promise<ConverseCommandOutput>;
  now: () => number;
};

function readConfiguration(): BedrockNarrationConfiguration {
  return {
    enabled: process.env.CARGOMESH_BEDROCK_NARRATION_ENABLED === "true",
    modelId: process.env.CARGOMESH_BEDROCK_MODEL_ID,
    region: process.env.CARGOMESH_BEDROCK_REGION,
  };
}

async function invokeBedrock(region: string, modelId: string, input: NarrationInput) {
  const client = new BedrockRuntimeClient({ region });
  return client.send(new ConverseCommand({
    modelId,
    system: [{ text: "Narrate only the supplied CargoMesh facts. Do not calculate eligibility, ranking, price, carrier selection, or booking authorization. Preserve unknown and pending states." }],
    messages: [{ role: "user", content: [{ text: JSON.stringify(input) }] }],
    inferenceConfig: { maxTokens: 350, temperature: 0 },
  }));
}

const defaults: Dependencies = { configuration: readConfiguration, invoke: invokeBedrock, now: Date.now };

function outputText(response: ConverseCommandOutput): string | null {
  const value = response.output?.message?.content
    ?.map((content) => "text" in content ? content.text : "")
    .join(" ").trim();
  return value || null;
}

export async function narrateFreightResult(
  rawInput: NarrationInput,
  dependencies: Dependencies = defaults,
): Promise<NarrationResult> {
  const input = NarrationInputSchema.parse(rawInput);
  const fallback = deterministicNarration(input);
  const config = dependencies.configuration();
  if (!config.enabled) return fallback;
  if (!config.modelId || !config.region) {
    return { ...fallback, evidenceStatus: "BLOCKED", fallbackReason: "BEDROCK_CONFIGURATION_MISSING" };
  }
  const started = dependencies.now();
  try {
    const response = await dependencies.invoke(config.region, config.modelId, input);
    const text = outputText(response);
    if (!text) throw new Error("Bedrock returned no text.");
    return {
      text,
      ssml: `<speak>${text.replace(/[&<>"']/g, (character) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
      })[character]!)}</speak>`,
      provider: "BEDROCK",
      evidenceStatus: "LIVE",
      telemetry: {
        modelId: config.modelId,
        region: config.region,
        latencyMs: dependencies.now() - started,
        inputTokens: response.usage?.inputTokens ?? null,
        outputTokens: response.usage?.outputTokens ?? null,
        estimatedCostUsd: null,
        requestId: response.$metadata.requestId ?? null,
      },
    };
  } catch {
    return { ...fallback, evidenceStatus: "BLOCKED", fallbackReason: "BEDROCK_INVOCATION_FAILED" };
  }
}
