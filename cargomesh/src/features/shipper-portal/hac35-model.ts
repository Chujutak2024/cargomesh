import type { FreightLocationV2, RoadServiceabilityEvaluationV2Data } from "@/features/v2-intake/contracts";

export type LocationEndpoint = "origin" | "destination";
export type LocationField = "label" | "city" | "countryCode";
export type LocationEdit = {
  label: string;
  city: string;
  countryCode: string;
  lat: string;
  lng: string;
};

export function endpointChanged(original: FreightLocationV2, edit: LocationEdit) {
  return edit.label.trim() !== original.label
    || edit.city.trim() !== original.city
    || edit.countryCode.trim().toUpperCase() !== original.countryCode
    || edit.lat.trim() !== (original.lat == null ? "" : String(original.lat))
    || edit.lng.trim() !== (original.lng == null ? "" : String(original.lng));
}

export function manualLocation(original: FreightLocationV2, edit: LocationEdit): FreightLocationV2 {
  const label = edit.label.trim();
  const city = edit.city.trim();
  const countryCode = edit.countryCode.trim().toUpperCase();
  if (!label || !city || !/^[A-Z]{2}$/.test(countryCode)) {
    throw new Error("Completa referencia, ciudad y país ISO de dos letras (ej.: PE).");
  }
  const a = edit.lat.trim(), b = edit.lng.trim();
  if (Boolean(a) !== Boolean(b)) throw new Error("Ingresa ambas coordenadas o deja ambas vacías.");
  const lat = a ? Number(a) : null;
  const lng = b ? Number(b) : null;
  if ((a && (!Number.isFinite(lat) || lat! < -90 || lat! > 90))
    || (b && (!Number.isFinite(lng) || lng! < -180 || lng! > 180))) {
    throw new Error("Latitud debe estar entre -90 y 90; longitud entre -180 y 180.");
  }
  return { ...original, facilityId: null, label, city, countryCode, lat, lng,
    // A reference typed by the shipper cannot inherit a canonical region from another facility.
    region: null };
}

export type CandidateChange = {
  candidateId: string;
  previous: string;
  current: string;
  currentReasons: string[];
};
export function compareEvaluations(
  previous: RoadServiceabilityEvaluationV2Data | null,
  current: RoadServiceabilityEvaluationV2Data,
): CandidateChange[] {
  if (!previous) return [];
  const old = new Map(previous.candidates.map(item => [item.candidateId, item]));
  const changes: CandidateChange[] = [];
  for (const candidate of current.candidates) {
    const before = old.get(candidate.candidateId);
    if (!before) changes.push({ candidateId: candidate.candidateId, previous: "NEW", current: candidate.status, currentReasons: candidate.reasons });
    else if (before.status !== candidate.status || JSON.stringify(before.reasons) !== JSON.stringify(candidate.reasons)) {
      changes.push({ candidateId: candidate.candidateId, previous: before.status, current: candidate.status, currentReasons: candidate.reasons });
    }
  }
  for (const before of previous.candidates) {
    if (!current.candidates.some(candidate => candidate.candidateId === before.candidateId)) {
      changes.push({ candidateId: before.candidateId, previous: before.status, current: "REMOVED", currentReasons: [] });
    }
  }
  return changes;
}
