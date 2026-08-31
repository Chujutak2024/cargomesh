import { getDispatchFixture } from "./ui-fixtures";

const BOOKING_UI_SCENARIOS = [
  "booking-pending",
  "pending-provider-confirmation",
  "confirmed",
  "rejected",
  "no-response",
  "error",
] as const;

const BOOKING_OFFER_SETS = ["zero", "one", "three", "four"] as const;

type BookingUiScenario = (typeof BOOKING_UI_SCENARIOS)[number];
type BookingOfferSet = (typeof BOOKING_OFFER_SETS)[number];

export function resolveBookingUiScenario(value: string | string[] | undefined): BookingUiScenario {
  const candidate = Array.isArray(value) ? value[0] : value;
  return BOOKING_UI_SCENARIOS.includes(candidate as BookingUiScenario)
    ? candidate as BookingUiScenario
    : "booking-pending";
}

export function resolveBookingOfferSet(value: string | string[] | undefined): BookingOfferSet {
  const candidate = Array.isArray(value) ? value[0] : value;
  return BOOKING_OFFER_SETS.includes(candidate as BookingOfferSet)
    ? candidate as BookingOfferSet
    : "three";
}

export function createBookingPreviewHref(
  requestCode: string,
  offerId: string,
  offerSet: Exclude<BookingOfferSet, "zero">,
) {
  const query = new URLSearchParams({
    scenario: "booking-pending",
    offers: offerSet,
    offer: offerId,
  });
  return `/booking/${encodeURIComponent(requestCode)}/status?${query.toString()}`;
}

export function getBookingUiFixture(input: {
  requestCode: string;
  scenario: BookingUiScenario;
  offerSet: BookingOfferSet;
  offerId?: string;
}) {
  const dispatchScenario = input.offerSet === "zero" ? "no-match" : input.offerSet;
  const dispatch = getDispatchFixture(dispatchScenario, input.requestCode);
  const offers = dispatch.offers;
  const selectedOffer = offers.find((offer) => offer.offerId === input.offerId) ?? null;
  const selectedAttempt = selectedOffer
    ? dispatch.attempts.find((attempt) => attempt.carrierId === selectedOffer.carrierId) ?? null
    : null;
  const status = bookingStatusCopy(input.scenario);

  return {
    requestCode: input.requestCode,
    fixtureLabel: "Vista local B-03 · sin persistencia real",
    scenario: input.scenario,
    status,
    selectedOffer,
    availableOfferCount: offers.length,
    returnHref: `/dispatch/${encodeURIComponent(input.requestCode)}?scenario=${input.offerSet === "zero" ? "no-match" : input.offerSet}`,
    timeline: bookingTimeline(input.scenario, Boolean(selectedOffer)),
    evidence: buildEvidence(input.scenario, input.requestCode, selectedOffer, selectedAttempt?.providerUrl ?? null),
  };
}

function bookingStatusCopy(scenario: BookingUiScenario) {
  if (scenario === "booking-pending") {
    return {
      code: "BOOKING_PENDING",
      tone: "progress" as const,
      eyebrow: "Solicitud preparada",
      title: "Preparando la solicitud de reserva",
      message: "La oferta fue seleccionada por una persona. La conexión real quedará a cargo de BookingViewModel v1.",
      nextAction: "La solicitud aún no fue enviada al provider.",
    };
  }
  if (scenario === "pending-provider-confirmation") {
    return {
      code: "PENDING_PROVIDER_CONFIRMATION",
      tone: "waiting" as const,
      eyebrow: "Solicitud enviada",
      title: "Esperando confirmación del transportista",
      message: "El provider está revisando disponibilidad y condiciones finales.",
      nextAction: "CargoMesh seguirá mostrando la evidencia sin cambiar el estado comercial desde la interfaz.",
    };
  }
  if (scenario === "confirmed") {
    return {
      code: "CONFIRMED",
      tone: "success" as const,
      eyebrow: "Reserva confirmada",
      title: "El transportista confirmó la operación",
      message: "La reserva está lista para continuar a seguimiento cuando ese módulo esté integrado.",
      nextAction: "Tracking permanece deshabilitado en este corte visual.",
    };
  }
  if (scenario === "rejected") {
    return {
      code: "REJECTED",
      tone: "danger" as const,
      eyebrow: "Respuesta del transportista",
      title: "La solicitud no fue aceptada",
      message: "La oferta seleccionada no pudo confirmarse. Puedes volver a las opciones disponibles.",
      nextAction: "La recuperación real será orquestada por los módulos de A y C.",
    };
  }
  if (scenario === "no-response") {
    return {
      code: "NO_RESPONSE",
      tone: "warning" as const,
      eyebrow: "Plazo de respuesta",
      title: "Aún no recibimos respuesta",
      message: "El provider no respondió dentro de la ventana esperada.",
      nextAction: "La interfaz no cambia el estado ni selecciona un reemplazo automáticamente.",
    };
  }
  return {
    code: "RECOVERABLE_ERROR",
    tone: "danger" as const,
    eyebrow: "Conexión interrumpida",
    title: "No pudimos actualizar la reserva",
    message: "La última consulta no terminó correctamente, pero la selección permanece disponible.",
    nextAction: "Vuelve a las opciones y reintenta cuando el flujo real esté conectado.",
  };
}

function bookingTimeline(scenario: BookingUiScenario, hasSelection: boolean) {
  const pendingConfirmation = ["pending-provider-confirmation", "confirmed", "rejected", "no-response"].includes(scenario);
  const resolved = ["confirmed", "rejected", "no-response"].includes(scenario);
  return [
    { label: "Oferta seleccionada", state: hasSelection ? "complete" : "blocked" },
    { label: "Solicitud preparada", state: hasSelection ? "complete" : "future" },
    { label: "Esperando respuesta", state: pendingConfirmation ? (resolved ? "complete" : "current") : "future" },
    { label: "Resultado del provider", state: resolved ? "current" : "future" },
  ] as const;
}

function buildEvidence(
  scenario: BookingUiScenario,
  requestCode: string,
  selectedOffer: ReturnType<typeof getDispatchFixture>["offers"][number] | null,
  providerUrl: string | null,
) {
  return [
    {
      key: "navigation",
      label: "Navegación",
      summary: selectedOffer ? "Destino provider preparado" : "Sin navegación: falta selección humana",
      payload: { requestCode, providerUrl, matchingServiceId: selectedOffer?.matchingServiceId ?? null },
    },
    {
      key: "tool",
      label: "Tool",
      summary: scenario === "booking-pending" ? "book_freight pendiente" : "Evidencia simulada para revisión visual",
      payload: { toolName: "book_freight", execution: "fixture-only", directHandlerCall: false },
    },
    {
      key: "persistence",
      label: "Persistencia",
      summary: "Sin escritura en B-03 visual",
      payload: { entityType: "BOOKING", persisted: false, bookingReference: null },
    },
    {
      key: "decision",
      label: "Decisión",
      summary: selectedOffer ? "Selección humana registrada solo en memoria visual" : "La recomendación no seleccionó una oferta",
      payload: {
        recommendedOfferId: selectedOffer?.recommended ? selectedOffer.offerId : null,
        selectedOfferId: selectedOffer?.offerId ?? null,
        automaticSelection: false,
      },
    },
    {
      key: "events",
      label: "Eventos",
      summary: "Secuencia preparada para BookingViewModel v1",
      payload: {
        events: ["OFFER_SELECTED", "BOOKING_REQUESTED", scenario.toUpperCase().replaceAll("-", "_")],
        source: "local-ui-fixture",
      },
    },
  ] as const;
}
