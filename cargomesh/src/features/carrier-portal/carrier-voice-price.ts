/** A spoken amount is an operator proposal, never a CargoMesh price recommendation. */
export function carrierVoicePrice(text: string): number | null {
  if (text.length > 4096) return null;
  const explicit = /(?:\$|USD\s*|(?:price|quote|offer|charge|total|precio|oferta|cotiza(?:r|ción)?|cámbialo|cambialo)\s+(?:(?:at|of|to|is|a|de|en)\s+)?\$?\s*)(\d[\d,]*(?:\.\d{1,2})?)(?![\d.,])|(\d[\d,]*(?:\.\d{1,2})?)(?![\d.,])\s*(?:USD|dollars?|dólares?)/gi;
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

export function carrierSpokenOfferSeed(amount: number, basis?: {distanceKm:number;equipmentType:string;usdPerKm:number;observedAt:string}) {
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e10 || Math.abs(Math.round(amount * 100) - amount * 100) > 0.00001) {
    throw new Error("INVALID_SPOKEN_PRICE");
  }
  const evidence=basis?{reference:`Carrier-entered rate ${basis.usdPerKm} USD/km; ${basis.distanceKm} estimated km; ${basis.equipmentType}`,
    provider:'Carrier operator',observedAt:basis.observedAt,validUntil:null,provenanceStatus:'ESTIMATED' as const}:null;
  return {
    price: { amount, currency: "USD" as const },
    breakdown: [{ kind: "TRANSPORT" as const, amount: { amount, currency: "USD" as const },
      treatment: "QUOTED" as const,
      source: evidence??{ reference: "", provider: "", observedAt: "", validUntil: null, provenanceStatus: "UNKNOWN" as const },
      observedAt: basis?.observedAt??"", details: basis?`Carrier estimate: ${basis.distanceKm} km × ${basis.usdPerKm} USD/km (${basis.equipmentType}). Review exclusions and extras.`:null }],
    ...(evidence?{source:{channel:'MANUAL' as const,evidence},evidence:[evidence]}:{}),
  };
}
