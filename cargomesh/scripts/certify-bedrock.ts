import { conversationBedrockConfig, interpretConversationTurn } from "../src/server/conversation/interpret";

// Opt-in integration check: one bounded synthetic turn through the real adapter.
// No invoke override, provider payload, credential, contact or business mutation.
const config = conversationBedrockConfig();
const base = { atUTC: new Date().toISOString(), scope: "AWS_ADAPTER_ONLY", endpoint: config.endpoint,
  modelId: config.modelId, region: config.region, maxTokens: config.maxTokens, timeoutMs: config.timeoutMs };
function finish(status: "PASS" | "FAIL" | "BLOCKED", reason: string, telemetry: unknown = null) {
  console.log(JSON.stringify({ ...base, status, reason, telemetry }));
  process.exitCode = status === "PASS" ? 0 : status === "BLOCKED" ? 2 : 1;
}
async function main() {
if (!config.enabled || !config.modelId || !config.region) {
  finish("BLOCKED", "BEDROCK_CONFIGURATION_MISSING_OR_DISABLED");
} else if (!/^[a-z]{2}(?:-[a-z]+)+-\d+$/.test(config.region)) {
  finish("BLOCKED", "INVALID_AWS_REGION");
} else if (config.endpoint === "mantle" && !process.env.OPENAI_API_KEY?.startsWith("bedrock-api-key-")) {
  finish("BLOCKED", "BEDROCK_MANTLE_CREDENTIAL_MISSING");
} else {
  try {
    const response = await interpretConversationTurn({ schemaVersion: "2.0",
      text: "from Lima to Arequipa", currentField: "originFacilityId" });
    if (response.mode !== "BEDROCK" || !response.telemetry) {
      finish("FAIL", "NO_VALIDATED_BEDROCK_RESPONSE_FALLBACK_IS_NOT_CERTIFICATION");
    } else {
      const fields = new Map(response.interpretation.fields.map(item => [item.field, item.value.toLowerCase()]));
      const correct = response.interpretation.intent === "PROVIDE"
        && fields.get("originFacilityId") === "lima" && fields.get("destinationFacilityId") === "arequipa";
      const usage = response.telemetry.inputTokens !== null && response.telemetry.inputTokens > 0
        && response.telemetry.outputTokens !== null && response.telemetry.outputTokens > 0;
      finish(correct && usage ? "PASS" : "FAIL", correct && usage
        ? "LIVE_AWS_RESPONSE_VALIDATED_SYNTHETIC_ROUTE" : "RESPONSE_OR_USAGE_DID_NOT_MEET_PROBE", response.telemetry);
    }
  } catch {
    finish("FAIL", "INTEGRATION_CHECK_FAILED_NO_PROVIDER_DETAILS_LOGGED");
  }
}

}
void main();
