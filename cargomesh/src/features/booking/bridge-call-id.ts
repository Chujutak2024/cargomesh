import type { ProviderBookFreightResult } from "./contracts";

/**
 * A provider replay is a second observable bridge call. Its payload differs
 * from the initial call because idempotentReplay changes from false to true,
 * so it must not reuse the initial bridgeCallId.
 */
export function createBookFreightBridgeCallId(
  authorizationReference: string,
  result: Pick<ProviderBookFreightResult, "idempotentReplay">,
): string {
  const reference = authorizationReference.trim();

  if (!reference) {
    throw new Error("authorizationReference is required.");
  }

  const phase = result.idempotentReplay ? "provider-replay" : "initial";
  return `cm:booking:v1:${reference}:${phase}`;
}
