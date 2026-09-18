import {
  parseFreightRequestIntakeViewModel,
  type FreightRequestIntakeViewModel,
} from "./intake-contracts";

type IntakeApiEnvelope = {
  ok?: unknown;
  data?: unknown;
  error?: { code?: unknown; message?: unknown };
};

export async function fetchFreightRequestIntake(
  requestCode: string,
  fetcher: typeof fetch = fetch,
): Promise<FreightRequestIntakeViewModel> {
  const response = await fetcher(
    `/api/freight-requests/intake/${encodeURIComponent(requestCode)}`,
    {
      method: "GET",
      cache: "no-store",
      headers: { accept: "application/json" },
    },
  );
  const envelope = (await response.json()) as IntakeApiEnvelope;

  if (!response.ok || envelope.ok !== true) {
    const code = typeof envelope.error?.code === "string"
      ? envelope.error.code
      : "FREIGHT_REQUEST_INTAKE_UNAVAILABLE";
    const message = typeof envelope.error?.message === "string"
      ? envelope.error.message
      : "Unable to load the FreightRequest intake.";
    throw new Error(`${code}: ${message}`);
  }

  const result = parseFreightRequestIntakeViewModel(envelope.data);
  if (result.requestCode !== requestCode.trim()) {
    throw new Error("INVALID_FREIGHT_REQUEST_INTAKE: Request code correlation failed.");
  }
  return result;
}
