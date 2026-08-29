const POSTGRES_UUID_PATTERN = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export type ProviderSearchParams = {
  serviceId?: string | string[];
};

export function isProviderServiceId(value: unknown): value is string {
  return typeof value === "string" && POSTGRES_UUID_PATTERN.test(value);
}

export function getProviderServiceId(searchParams: ProviderSearchParams): string | null {
  return isProviderServiceId(searchParams.serviceId) ? searchParams.serviceId : null;
}
