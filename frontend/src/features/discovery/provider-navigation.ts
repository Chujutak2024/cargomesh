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
  if (!isNavigableProviderUrl(candidate.providerUrl)) {
    throw new Error("INVALID_PROVIDER_URL: candidate providerUrl is not navigable.");
  }

  const base = new URL(baseUrl);
  if (base.protocol !== "http:" && base.protocol !== "https:") {
    throw new Error("INVALID_BASE_URL: baseUrl must use HTTP(S).");
  }

  const providerUrl = new URL(candidate.providerUrl, base);
  providerUrl.searchParams.set("serviceId", candidate.matchingServiceId);
  return providerUrl.toString();
}
