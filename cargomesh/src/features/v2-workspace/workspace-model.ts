import type { RoadCandidateMapViewProps } from "@/features/v2-road-map/road-map-contract";

export type WorkspaceView = "dashboard" | "request" | "shipments" | "tracking" | "desk" | "help";
export type RequestStep = "context" | "route" | "cargo" | "schedule" | "review";
export type WorkspaceRole = "client" | "coordinator";

export const requestSteps: RequestStep[] = ["context", "route", "cargo", "schedule", "review"];

export const facilities = [
  { id: "callao", label: "Callao · sede de escenario", city: "Callao", countryCode: "PE", lat: -12.0464, lng: -77.1181 },
  { id: "arequipa", label: "Arequipa · sede de escenario", city: "Arequipa", countryCode: "PE", lat: -16.409, lng: -71.5375 },
  { id: "piura", label: "Piura · sede de escenario", city: "Piura", countryCode: "PE", lat: -5.1945, lng: -80.6328 },
] as const;

export type WorkspaceDraft = {
  originId: string;
  destinationId: string;
  cargoDescription: string;
  quantity: number;
  unitWeightKg: number;
  pickupDate: string;
  deliveryDate: string;
  completedStep: number;
  savedForReview: boolean;
};

export const initialDraft: WorkspaceDraft = {
  originId: "callao",
  destinationId: "arequipa",
  cargoDescription: "Maquinaria industrial",
  quantity: 10,
  unitWeightKg: 800,
  pickupDate: "",
  deliveryDate: "",
  completedStep: 0,
  savedForReview: false,
};

export const draftStorageKey = "cargomesh-v2-react-workspace-draft";

export function applyDraftChange(current: WorkspaceDraft, change: Partial<WorkspaceDraft>): WorkspaceDraft {
  const invalidatedStep = "originId" in change || "destinationId" in change ? 0
    : "cargoDescription" in change || "quantity" in change || "unitWeightKg" in change ? 2
      : "pickupDate" in change || "deliveryDate" in change ? 3 : current.completedStep;
  return {
    ...current,
    ...change,
    completedStep: Math.min(current.completedStep, invalidatedStep),
    savedForReview: false,
  };
}

export function readDraft(value: string | null): WorkspaceDraft {
  if (!value) return initialDraft;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return initialDraft;
    const draft = parsed as Record<string, unknown>;
    const validFacility = (id: unknown) => typeof id === "string" && facilities.some((facility) => facility.id === id);
    const validNumber = (number: unknown) => typeof number === "number" && Number.isFinite(number) && number >= 0 && number <= 1_000_000;
    const validText = (text: unknown) => typeof text === "string" && text.length <= 120;
    const validDate = (text: unknown) => typeof text === "string" && (text === "" || /^\d{4}-\d{2}-\d{2}$/.test(text));
    const restored: WorkspaceDraft = {
      originId: validFacility(draft.originId) ? draft.originId as string : initialDraft.originId,
      destinationId: validFacility(draft.destinationId) ? draft.destinationId as string : initialDraft.destinationId,
      cargoDescription: validText(draft.cargoDescription) ? draft.cargoDescription as string : initialDraft.cargoDescription,
      quantity: validNumber(draft.quantity) ? draft.quantity as number : initialDraft.quantity,
      unitWeightKg: validNumber(draft.unitWeightKg) ? draft.unitWeightKg as number : initialDraft.unitWeightKg,
      pickupDate: validDate(draft.pickupDate) ? draft.pickupDate as string : "",
      deliveryDate: validDate(draft.deliveryDate) ? draft.deliveryDate as string : "",
      completedStep: Number.isInteger(draft.completedStep) && (draft.completedStep as number) >= 0 && (draft.completedStep as number) <= 5 ? draft.completedStep as number : 0,
      savedForReview: draft.savedForReview === true,
    };
    const firstInvalidStep = requestSteps.slice(0, 4).findIndex((step) => !validateStep(restored, step));
    const validProgress = firstInvalidStep === -1 ? 5 : firstInvalidStep;
    restored.completedStep = Math.min(restored.completedStep, validProgress);
    restored.savedForReview = restored.savedForReview && restored.completedStep === 5;
    return restored;
  } catch {
    return initialDraft;
  }
}

export function facilityFor(id: string) {
  return facilities.find((facility) => facility.id === id) ?? facilities[0];
}

export function facilityLabel(id: string, locale: "es" | "en") {
  const facility = facilityFor(id);
  return locale === "en" ? `${facility.city} · scenario location` : facility.label;
}

export function validateStep(draft: WorkspaceDraft, step: RequestStep): boolean {
  if (step === "context" || step === "route") {
    return draft.originId !== draft.destinationId;
  }
  if (step === "cargo") {
    return draft.cargoDescription.trim().length > 0 && Number.isInteger(draft.quantity)
      && draft.quantity > 0 && Number.isFinite(draft.unitWeightKg) && draft.unitWeightKg > 0;
  }
  if (step === "schedule") {
    const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date)
      && !Number.isNaN(Date.parse(`${date}T00:00:00Z`))
      && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
    return validDate(draft.pickupDate) && validDate(draft.deliveryDate)
      && draft.pickupDate <= draft.deliveryDate;
  }
  return requestSteps.slice(0, 4).every((item) => validateStep(draft, item));
}

export function mapPropsForDraft(
  draft: WorkspaceDraft,
  selectedCandidateId: string | null,
  onSelectCandidate: (candidateId: string) => void,
  locale: "es" | "en" = "es",
): RoadCandidateMapViewProps {
  const origin = facilityFor(draft.originId);
  const destination = facilityFor(draft.destinationId);
  const canonicalPair = origin.id === "callao" && destination.id === "arequipa";
  return {
    origin: { ...origin, facilityId: null, label: facilityLabel(origin.id, locale) },
    destination: { ...destination, facilityId: null, label: facilityLabel(destination.id, locale) },
    overallStatus: "unknown",
    candidates: canonicalPair ? [{
      candidateId: "road-scenario",
      status: "unknown",
      carrier: { id: "scenario-only", code: "SCENARIO", commercialName: locale === "en" ? "Map scenario · no carrier" : "Escenario cartográfico · sin transportista" },
      service: { id: "scenario-road", code: "ROAD-DEMO", mode: "ROAD" },
      carrierName: locale === "en" ? "Map scenario · no carrier" : "Escenario cartográfico · sin transportista",
      serviceCode: "ROAD-DEMO",
      routePreview: {
        corridorCode: "PE-PANAM-SUR-SCENARIO",
        distanceKm: null,
        estimatedTransitHours: null,
        geometrySource: "SCENARIO_SYNTHETIC_GEOMETRY",
        provenanceStatus: "SIMULATED",
        legs: [{
          sequence: 1,
          mode: "ROAD",
          originLabel: "Callao",
          destinationLabel: "Arequipa",
          waypoints: [
            { lat: origin.lat, lng: origin.lng },
            { lat: -14.0678, lng: -75.7286 },
            { lat: destination.lat, lng: destination.lng },
          ],
          conditions: [],
        }],
      },
    }] : [],
    selectedCandidateId: canonicalPair ? selectedCandidateId : null,
    onSelectCandidate,
  };
}
