const POSTGRES_UUID_PATTERN = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export type ProviderSearchParams = {
  serviceId?: string | string[];
};

// Stable demo navigation targets only. Discovery and provider resolution remain
// registry-driven and must never use this map as a carrier allowlist.
export const CANONICAL_DEMO_PROVIDER_SERVICE_IDS = {
  andes: "30000000-0000-0000-0000-000000000001",
  inca: "30000000-0000-0000-0000-000000000003",
  pacific: "30000000-0000-0000-0000-000000000002",
} as const;

export type CanonicalDemoProviderSlug = keyof typeof CANONICAL_DEMO_PROVIDER_SERVICE_IDS;

export function buildCanonicalDemoProviderHref(slug: CanonicalDemoProviderSlug): string {
  const serviceId = CANONICAL_DEMO_PROVIDER_SERVICE_IDS[slug];
  return `/providers/${slug}?serviceId=${encodeURIComponent(serviceId)}`;
}

export function isProviderServiceId(value: unknown): value is string {
  return typeof value === "string" && POSTGRES_UUID_PATTERN.test(value);
}

export function getProviderServiceId(searchParams: ProviderSearchParams): string | null {
  return isProviderServiceId(searchParams.serviceId) ? searchParams.serviceId : null;
}
