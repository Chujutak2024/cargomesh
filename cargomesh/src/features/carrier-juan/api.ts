import { z } from "zod";

export class PortalApiError extends Error {
  constructor(public readonly status: number, public readonly code: string) { super(code); }
}
type Fetcher = typeof fetch;
const Envelope = z.object({ schemaVersion: z.literal("2.0"), data: z.unknown(),
  meta: z.object({ nextOffset: z.number().int().nonnegative().nullable().optional() }).passthrough().optional() }).passthrough();
export async function portalRequest(path: string, options: RequestInit = {}, fetcher: Fetcher = fetch) {
  if (!path.startsWith("/api/v2/") || path.includes("..") || path.includes("://")) {
    throw new PortalApiError(400, "INVALID_API_PATH");
  }
  let response: Response;
  try { response = await fetcher(path, { ...options, credentials: "same-origin", cache: "no-store" }); }
  catch (error) { if (error instanceof Error && error.name === "AbortError") throw error;
    throw new PortalApiError(0, "NETWORK_ERROR"); }
  let body: unknown;
  try { body = await response.json(); } catch { throw new PortalApiError(response.status, "INVALID_RESPONSE"); }
  if (!response.ok) {
    const error = z.object({ error: z.object({ code: z.string() }) }).safeParse(body);
    throw new PortalApiError(response.status, error.success ? error.data.error.code : "API_ERROR");
  }
  const checked = Envelope.safeParse(body);
  if (!checked.success || body === null || typeof body !== "object" || !("data" in body)) throw new PortalApiError(502, "INVALID_RESPONSE");
  return checked.data;
}
/** Failed retries retain the UUID only when path AND payload remain identical. */
export function mutationReceipt(previous: { fingerprint: string; key: string } | null,
  path: string, value: unknown, createKey: () => string) {
  const fingerprint = path + "\n" + JSON.stringify(value);
  return previous?.fingerprint === fingerprint ? previous : { fingerprint, key: createKey() };
}
export function portalErrorCopy(error: unknown, es: boolean) {
  const status = error && typeof error === "object" && "status" in error && typeof error.status === "number" ? error.status : 500;
  const code = error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "";
  if (status === 401) return es ? "Inicia sesión para consultar tus datos." : "Sign in to access your data.";
  if (status === 403) return es ? "Tu cuenta no tiene acceso a este transportista." : "Your account cannot access this carrier.";
  if (status === 404) return es ? "El registro no está disponible para tu cuenta." : "This record is unavailable to your account.";
  if (status === 409) return code === "IDEMPOTENCY_CONFLICT"
    ? es ? "El reintento no coincide con la acción anterior. Revisa los datos." : "This retry differs from the previous action. Review the data."
    : es ? "Los datos cambiaron o falta evidencia. Actualiza antes de continuar." : "Data changed or evidence is missing. Refresh before continuing.";
  if (status === 400) return es ? "Revisa los campos y sus referencias antes de guardar." : "Check the fields and references before saving.";
  return es ? "No pudimos consultar el servicio. Puedes volver a intentarlo." : "The service could not be reached. You can retry.";
}
