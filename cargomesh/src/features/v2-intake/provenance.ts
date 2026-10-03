export function formatProvenanceTimestamp(value: string | null, locale?: string) {
  if (!value) return "UNKNOWN";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "UNKNOWN" : date.toLocaleString(locale);
}
