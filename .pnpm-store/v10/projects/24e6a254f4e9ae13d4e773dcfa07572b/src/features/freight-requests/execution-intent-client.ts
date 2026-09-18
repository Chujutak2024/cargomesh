import {
  parseFreightRequestExecutionIntent,
  type FreightRequestExecutionIntent,
} from "./execution-intent-contracts";

type ExecutionIntentApiEnvelope = {
  ok?: unknown;
  data?: unknown;
  error?: { code?: unknown; message?: unknown };
};

export async function fetchFreightRequestExecutionIntent(
  freightRequestId: string,
  fetcher: typeof fetch = fetch,
): Promise<FreightRequestExecutionIntent> {
  const response = await fetcher(
    `/api/freight-requests/${encodeURIComponent(freightRequestId)}/execution-intent`,
    {
      method: "GET",
      cache: "no-store",
      headers: { accept: "application/json" },
    },
  );
  const envelope = (await response.json()) as ExecutionIntentApiEnvelope;

  if (!response.ok || envelope.ok !== true) {
    const code =
      typeof envelope.error?.code === "string"
        ? envelope.error.code
        : "FREIGHT_REQUEST_INTENT_UNAVAILABLE";
    const message =
      typeof envelope.error?.message === "string"
        ? envelope.error.message
        : "Unable to load the FreightRequest execution intent.";
    throw new Error(`${code}: ${message}`);
  }

  return parseFreightRequestExecutionIntent(envelope.data);
}
