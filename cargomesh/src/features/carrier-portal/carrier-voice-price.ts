/** A spoken amount is an operator proposal, never a CargoMesh price recommendation. */
export function carrierVoicePrice(text: string): number | null {
  if (text.length > 4096) return null;
  const explicit = /(?:\$|USD\s*|(?:price|quote|offer|charge|total)\s+(?:(?:at|of|to|is)\s+)?\$?\s*)(\d[\d,]*(?:\.\d{1,2})?)(?![\d.,])|(\d[\d,]*(?:\.\d{1,2})?)(?![\d.,])\s*(?:USD|dollars?)/gi;
  const values = [...text.matchAll(explicit)].map(match => match[1] ?? match[2]);
  if (!values.length && /^\s*\$?\s*\d[\d,]*(?:\.\d{1,2})?\s*(?:USD|dollars?)?\s*$/i.test(text)) {
    values.push(text.replace(/[^\d,.]/g, ""));
  }
  if (values.length !== 1) return null;
  const raw = values[0];
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(raw)) return null;
  const amount = Number(raw.replaceAll(",", ""));
  return Number.isFinite(amount) && amount > 0 && amount <= 1e10 ? amount : null;
}

export function carrierSpokenOfferSeed(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e10 || Math.abs(Math.round(amount * 100) - amount * 100) > 0.00001) {
    throw new Error("INVALID_SPOKEN_PRICE");
  }
  return {
    price: { amount, currency: "USD" as const },
    breakdown: [{ kind: "TRANSPORT" as const, amount: { amount, currency: "USD" as const },
      treatment: "QUOTED" as const,
      source: { reference: "", provider: "", observedAt: "", validUntil: null, provenanceStatus: "UNKNOWN" as const },
      observedAt: "", details: null }],
  };
}
