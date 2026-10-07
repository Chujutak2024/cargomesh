import type { ConversationStateV2, ConversationTurnInputV2 } from "./contract";
import { ConversationStateV2Schema, ConversationTurnInputV2Schema } from "./contract";

const REQUIRED = ["origin", "destination", "cargoCategory", "cargoQuantity", "weightKg", "dimensionsCm", "pickupWindow"] as const;
type Slot = (typeof REQUIRED)[number];
const slotLabel: Record<"en" | "es", Record<Slot, string>> = {
  en: { origin: "pickup location", destination: "delivery location", cargoCategory: "cargo type",
    cargoQuantity: "number of units", weightKg: "cargo weight", dimensionsCm: "unit dimensions",
    pickupWindow: "pickup date and time window" },
  es: { origin: "origen", destination: "destino", cargoCategory: "tipo de carga",
    cargoQuantity: "cantidad de unidades", weightKg: "peso de la carga", dimensionsCm: "dimensiones por unidad",
    pickupWindow: "fecha y ventana de recojo" },
};

export type ConversationStep = {
  state: ConversationStateV2;
  reply: string;
  effect: "NONE" | "READ_DRAFT" | "EVALUATE_ROAD" | "CONFIRM_PLACE";
};

const copy = {
  es: {
    ask: (slot: Slot) => `Dato provisional guardado. Falta ${slotLabel.es[slot]}; puedes corregir cualquier dato antes de crear la solicitud.`,
    ready: "Datos básicos reunidos. Revisa también los contactos, volumen y ventana de entrega exigidos por el formulario V2 antes de crear el borrador.",
    unavailable: "Todavía no hay oferta V2 con precio confirmado ni servicio de reserva disponible.",
    help: "Indica origen, destino, carga, cantidad, peso, dimensiones y ventana de recojo. Los datos son provisionales hasta crear el borrador.",
    place: "Elige un lugar identificado con fuente y precisión; confirmar requiere un borrador y su versión vigente.",
    draft: "La creación requiere todos los campos del contrato V2. Comprueba los datos faltantes antes de continuar.",
    read: "Consultaré únicamente el borrador autorizado de tu organización.",
    road: "Consultaré la elegibilidad ROAD del borrador vigente; el mapa no prueba cobertura ni precio.",
  },
  en: {
    ask: (slot: Slot) => `Provisional detail saved. Please provide the ${slotLabel.en[slot]}; you can correct any detail before creating the request.`,
    ready: "Basic details collected. Review contacts, volume and delivery window required by the V2 form before creating a draft.",
    unavailable: "There is no attributable V2 offer with a confirmed price or available booking service yet.",
    help: "Provide origin, destination, cargo, quantity, weight, dimensions and pickup window. Details remain provisional until draft creation.",
    place: "Choose a place with source and precision; confirmation requires a draft and its current version.",
    draft: "Creation requires every field in the V2 contract. Check missing details first.",
    read: "I will read only the authorized draft for your organization.",
    road: "I will evaluate ROAD eligibility for the current draft; a map does not prove coverage or price.",
  },
};

/** Pure turn reducer. It never persists, authorizes or executes an effect. */
export function planConversationTurn(rawState: unknown, rawTurn: unknown): ConversationStep {
  const state = ConversationStateV2Schema.parse(rawState);
  const turn: ConversationTurnInputV2 = ConversationTurnInputV2Schema.parse(rawTurn);
  const language = copy[turn.locale];

  if (turn.intent === "ASK_PRICE" || turn.intent === "ASK_BOOKING") {
    return { state, reply: language.unavailable, effect: "NONE" };
  }
  if (turn.intent === "HELP") return { state, reply: language.help, effect: "NONE" };

  if (turn.intent === "PROVIDE_SLOT" || turn.intent === "CORRECT_SLOT") {
    const incoming = turn.slotValue!;
    const slots = state.slots.filter((item) => item.value.slot !== incoming.slot);
    slots.push({ value: incoming, status: "PROVISIONAL", source: turn.inputMode === "TEXT"
      ? "USER_TEXT" : "EDITED_VOICE_TRANSCRIPT" });
    const missing = REQUIRED.find((slot) => !slots.some((item) => item.value.slot === slot)) ?? null;
    const next: ConversationStateV2 = { ...state, slots, pendingSlot: missing,
      phase: missing ? "COLLECTING" : "READY_TO_CREATE",
      // A correction invalidates any previous evaluation; only the application service can recompute it.
      eligibility: null };
    return { state: next, reply: missing ? language.ask(missing) : language.ready, effect: "NONE" };
  }

  if (turn.intent === "SELECT_PLACE") {
    return { state: { ...state, phase: "PLACE_CHOICE" }, reply: language.place, effect: "NONE" };
  }
  if (turn.intent === "CONFIRM_PLACE") {
    if (turn.requestId !== state.requestId || turn.expectedDraftVersion !== state.draftVersion) {
      throw new Error("STALE_DRAFT");
    }
    return { state, reply: language.place, effect: "CONFIRM_PLACE" };
  }
  if (turn.intent === "CREATE_DRAFT") {
    // This preparatory contract does not contain the complete HAC-12 payload.
    // The future Web adapter must validate that payload before issuing a create effect.
    return { state, reply: language.draft, effect: "NONE" };
  }
  if (turn.intent === "READ_DRAFT") {
    if (turn.requestId !== state.requestId) throw new Error("REQUEST_MISMATCH");
    return { state, reply: language.read, effect: "READ_DRAFT" };
  }
  if (turn.intent === "EVALUATE_ROAD") {
    if (turn.requestId !== state.requestId) throw new Error("REQUEST_MISMATCH");
    return { state: { ...state, phase: "EVALUATING" }, reply: language.road, effect: "EVALUATE_ROAD" };
  }
  throw new Error("UNSUPPORTED_INTENT");
}
