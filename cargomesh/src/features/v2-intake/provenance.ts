export function formatProvenanceTimestamp(value: string | null, locale?: string) {
  if (!value) return "UNKNOWN";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "UNKNOWN" : date.toLocaleString(locale);
}

export function isProvenanceExpiredAtEvaluation(validUntil: string | null, evaluatedAt: string): boolean {
  if (!validUntil) return false;
  const expiry = Date.parse(validUntil);
  const evaluation = Date.parse(evaluatedAt);
  return Number.isFinite(expiry) && Number.isFinite(evaluation) && expiry < evaluation;
}
