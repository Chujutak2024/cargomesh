import type { CandidateProvider } from "@/features/providers/contracts";
import { isNavigableProviderUrl } from "./candidate-matcher";

/**
 * Preserves discovery's selected service while navigating to a provider page.
 * `baseUrl` is explicit so CargoMesh-hosted provider paths remain portable
 * between local, preview and production environments.
 */
export function buildProviderNavigationUrl(
  candidate: CandidateProvider,
  baseUrl: string,
): string {
  return buildRegisteredProviderNavigationUrl(
    candidate.providerUrl,
    candidate.matchingServiceId,
    baseUrl,
  );
}

/**
 * Resolves the only URL that may represent a discovered provider service.
 * It intentionally preserves the registered path and base query parameters,
 * while replacing any stale serviceId with the discovered matching service.
 */
export function buildRegisteredProviderNavigationUrl(
  providerUrl: string,
  matchingServiceId: string,
  baseUrl: string,
): string {
  if (!isNavigableProviderUrl(providerUrl)) {
    throw new Error("INVALID_PROVIDER_URL: candidate providerUrl is not navigable.");
  }

  const base = new URL(baseUrl);
  if (base.protocol !== "http:" && base.protocol !== "https:") {
    throw new Error("INVALID_BASE_URL: baseUrl must use HTTP(S).");
  }

  const resolvedProviderUrl = new URL(providerUrl, base);
  resolvedProviderUrl.searchParams.set("serviceId", matchingServiceId);
  return resolvedProviderUrl.toString();
}
