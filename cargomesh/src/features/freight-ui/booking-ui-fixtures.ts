import { getDispatchFixture } from "./ui-fixtures";

const BOOKING_UI_SCENARIOS = [
  "booking-pending",
  "pending-provider-confirmation",
  "confirmed",
  "rejected",
  "expired",
  "cancelled",
  "no-response",
  "recovery",
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

export function resolveExplicitBookingUiScenario(value: string | string[] | undefined): BookingUiScenario | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return BOOKING_UI_SCENARIOS.includes(candidate as BookingUiScenario)
    ? candidate as BookingUiScenario
    : null;
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
  const selectedOffer = input.offerId
    ? (offers.find((offer) =>
        offer.offerId === input.offerId ||
        offer.carrierCode === input.offerId ||
        offer.carrierCode?.toLowerCase().includes(input.offerId?.toLowerCase() ?? "")
      ) ?? null)
    : null;
  const selectedAttempt = selectedOffer
    ? dispatch.attempts.find((attempt) => attempt.carrierId === selectedOffer.carrierId) ?? null
    : null;
  const status = bookingStatusCopy(input.scenario);
  const showRecovery = ["rejected", "expired", "no-response", "recovery", "error"].includes(input.scenario);
  return {
    requestCode: input.requestCode,
    fixtureLabel: "Simulador visual B-03 · sin ejecución ni persistencia real",
    isFixture: true,
    scenario: input.scenario,
    status,
    selectedOffer,
    availableOfferCount: offers.length,
    returnHref: `/dispatch/${encodeURIComponent(input.requestCode)}?scenario=${input.offerSet === "zero" ? "no-match" : input.offerSet}`,
    timeline: bookingTimeline(input.scenario, Boolean(selectedOffer)),
    evidence: buildEvidence(input.scenario, input.requestCode, selectedOffer, selectedAttempt?.providerUrl ?? null),
    showRecovery,
    recoveryOptions: showRecovery ? offers.map((offer) => ({
      offerId: offer.offerId,
      displayName: offer.displayName,
      totalPrice: offer.totalPrice,
      currency: offer.currency,
      transitHours: offer.transitHours,
      score: offer.score,
    })) : [],
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
      eyebrow: "Vista de solicitud enviada",
      title: "Estado visual: esperando confirmación",
      message: "Este simulador representa cómo se vería una solicitud pendiente; no contactó al provider.",
      nextAction: "Elige ACCEPT o REJECT para revisar el siguiente estado visual.",
    };
  }
  if (scenario === "confirmed") {
    return {
      code: "CONFIRMED",
      tone: "success" as const,
      eyebrow: "Vista de reserva confirmada",
      title: "Estado visual: CONFIRMED",
      message: "La pantalla ilustra el resultado esperado; no creó una reserva ni recibió una respuesta del provider.",
      nextAction: "Usa el flujo persistido para validar booking y tracking reales.",
    };
  }
  if (scenario === "rejected") {
    return {
      code: "REJECTED",
      tone: "danger" as const,
      eyebrow: "Vista de rechazo",
      title: "Estado visual: REJECTED",
      message: "La pantalla ilustra un rechazo comercial; el provider no fue consultado desde este simulador.",
      nextAction: "Revisa visualmente las alternativas; el flujo real usa recoveryOfferIds del servidor.",
    };
  }
  if (scenario === "expired") {
    return {
      code: "EXPIRED",
      tone: "danger" as const,
      eyebrow: "Plazo vencido",
      title: "La solicitud de reserva expiró",
      message: "Esta vista ilustra un plazo vencido; no existe un deadline persistido por este simulador.",
      nextAction: "El flujo real obtiene el plazo y las alternativas desde BookingViewModel v1.",
    };
  }
  if (scenario === "cancelled") {
    return {
      code: "CANCELLED",
      tone: "warning" as const,
      eyebrow: "Reserva cancelada",
      title: "La reserva fue cancelada",
      message: "La operación quedó cerrada sin convertir la cancelación en confirmación.",
      nextAction: "Recovery solo puede usar las ofertas indicadas por el ViewModel.",
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
  if (scenario === "recovery") {
    return {
      code: "RECOVERY",
      tone: "progress" as const,
      eyebrow: "Continuidad operativa",
      title: "Preparando una oferta de recuperación",
      message: "Esta vista permite revisar cómo se presentaría una selección asistida alternativa.",
      nextAction: "No se crea ni reemplaza ninguna reserva desde el simulador.",
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
  const pendingConfirmation = ["pending-provider-confirmation", "confirmed", "rejected", "expired", "cancelled", "no-response"].includes(scenario);
  const resolved = ["confirmed", "rejected", "expired", "cancelled", "no-response"].includes(scenario);
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
  const isRecoveredInca = selectedOffer?.carrierCode === "INCA_DEMO" || selectedOffer?.offerId === "offer-demo-2";
  const illustratedProviderUrl = providerUrl ?? (isRecoveredInca ? "/providers/inca" : "/providers/andes");
  const visualState = bookingStatusCopy(scenario).code;
  const intendedToolName = scenario === "booking-pending" || scenario === "pending-provider-confirmation"
    ? "book_freight"
    : "get_provider_booking_status";
  const illustrativeEvents = scenario === "booking-pending"
    ? ["OFFER_SELECTED"]
    : scenario === "pending-provider-confirmation"
      ? ["OFFER_SELECTED", "BOOKING_REQUESTED"]
      : scenario === "confirmed"
        ? ["OFFER_SELECTED", "BOOKING_REQUESTED", "BOOKING_CONFIRMED"]
        : ["OFFER_SELECTED", "BOOKING_REQUESTED", "BOOKING_REJECTED"];

  return [
    {
      key: "navigation",
      label: "Navegación",
      summary: selectedOffer ? `Ruta ilustrativa del provider: ${illustratedProviderUrl}` : "Sin ruta ilustrativa: falta selección humana",
      payload: {
        requestCode,
        illustratedProviderUrl,
        matchingServiceId: selectedOffer?.matchingServiceId ?? null,
        navigationPerformed: false,
      },
    },
    {
      key: "tool",
      label: "Tool",
      summary: `Paso visual asociado a ${intendedToolName}; la tool no fue ejecutada`,
      payload: {
        intendedToolName,
        visualState,
        executed: false,
        executionSurface: "B03_VISUAL_FIXTURE",
      },
    },
    {
      key: "persistence",
      label: "Persistencia",
      summary: "Desactivada: el simulador no crea ni actualiza bookings",
      payload: {
        persisted: false,
        bookingId: null,
        providerReference: null,
        visualState,
      },
    },
    {
      key: "decision",
      label: "Decisión",
      summary: selectedOffer ? (isRecoveredInca ? "Selección humana de recuperación (Inca 84 pts)" : "Selección humana registrada (Andes 89 pts)") : "La recomendación no seleccionó una oferta",
      payload: {
        recommendedOfferId: selectedOffer?.recommended ? selectedOffer.offerId : null,
        selectedOfferId: selectedOffer?.offerId ?? null,
        selectionMode: "ASSISTED",
        automaticSelection: false,
        fixtureOnly: true,
        persisted: false,
      },
    },
    {
      key: "events",
      label: "Eventos",
      summary: `Secuencia visual: ${scenario.toUpperCase().replaceAll("-", "_")}`,
      payload: {
        illustrativeEvents,
        source: "B03_VISUAL_FIXTURE",
        persisted: false,
      },
    },
  ] as const;
}
