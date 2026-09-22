import { NarrationInputSchema, type NarrationInput, type NarrationResult } from "./contracts";

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  })[character]!);
}

export function deterministicNarration(rawInput: NarrationInput): NarrationResult {
  const input = NarrationInputSchema.parse(rawInput);
  const spanish = input.locale === "es-PE";
  const parts = [input.result, input.explanation];
  parts.push(spanish
    ? `Estado de la fuente: ${input.source.status}. Referencia: ${input.source.reference}.`
    : `Source status: ${input.source.status}. Reference: ${input.source.reference}.`);
  if (input.constraints.length) parts.push(
    `${spanish ? "Restricciones" : "Constraints"}: ${input.constraints.join("; ")}.`,
  );
  if (input.pendingFields.length) parts.push(
    `${spanish ? "Pendiente por confirmar" : "Pending confirmation"}: ${input.pendingFields.join("; ")}.`,
  );
  const text = parts.join(" ");
  return {
    text,
    ssml: `<speak>${escapeXml(text)}</speak>`,
    provider: "DETERMINISTIC",
    evidenceStatus: "LOCAL",
    telemetry: {
      modelId: null, region: null, latencyMs: null, inputTokens: null,
      outputTokens: null, estimatedCostUsd: null, requestId: null,
    },
  };
}
