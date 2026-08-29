import type { CandidateProvider } from "@/features/providers/contracts";

/**
 * Preserves discovery's selected service while navigating to a provider page.
 * A consumes `serviceId` during INT-01 to load that exact active service.
 */
export function buildProviderNavigationUrl(candidate: CandidateProvider): string {
  const providerUrl = new URL(candidate.providerUrl);
  providerUrl.searchParams.set("serviceId", candidate.matchingServiceId);
  return providerUrl.toString();
}
