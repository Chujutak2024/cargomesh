"use client";

import { AlertTriangle, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BookingViewModel } from "@/features/booking/contracts";
import {
  fetchBookingViewModel,
  readBookingRuntimeContext,
  recoveryOffersFor,
  refreshProviderBookingStatus,
  shouldPollProviderBooking,
  startAssistedRecovery,
  type BookingRuntimeContext,
} from "@/features/freight-ui/booking-client";
import {
  BookingWorkspace,
  type BookingWorkspaceModel,
} from "./booking-workspace";
import styles from "./booking-status-client.module.css";

export function BookingStatusClient({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const checkingRef = useRef(false);
  const [viewModel, setViewModel] = useState<BookingViewModel | null>(null);
  const [context, setContext] = useState<BookingRuntimeContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const next = await fetchBookingViewModel(bookingId);
      setViewModel(next);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "No fue posible consultar la reserva.");
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  const checkProvider = useCallback(async () => {
    const frame = frameRef.current;
    if (!frame || !context || checkingRef.current) return;
    checkingRef.current = true;
    setBusy(true);
    setActionError(null);
    try {
      await refreshProviderBookingStatus(context, frame, window.location.origin);
      await load();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "No fue posible actualizar el estado del provider.");
    } finally {
      checkingRef.current = false;
      setBusy(false);
    }
  }, [context, load]);

  useEffect(() => {
    setContext(readBookingRuntimeContext(bookingId));
    void load();
  }, [bookingId, load]);

  useEffect(() => {
    if (!viewModel || !context || !shouldPollProviderBooking(viewModel)) return;
    const timer = window.setTimeout(() => { void checkProvider(); }, 4_000);
    return () => window.clearTimeout(timer);
  }, [checkProvider, context, viewModel]);

  async function recover(offerId: string) {
    const frame = frameRef.current;
    if (!frame || !context || !viewModel) {
      setActionError("La metadata de navegación no está disponible para iniciar recovery.");
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const next = await startAssistedRecovery({
        context,
        offerId,
        allowedOfferIds: viewModel.recoveryOfferIds,
        replacesBookingId: viewModel.bookingId,
        frame,
        baseUrl: window.location.origin,
      });
      router.push(`/booking/${encodeURIComponent(next.bookingId)}/status`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "No fue posible iniciar recovery.");
      setBusy(false);
    }
  }

  if (loading && !viewModel) {
    return <BookingTransportState title="Cargando reserva" message="Consultando BookingViewModel v1." busy />;
  }
  if (loadError && !viewModel) {
    return <BookingTransportState title="No pudimos abrir la reserva" message={loadError} onRetry={() => { setLoading(true); void load(); }} />;
  }
  if (!viewModel) {
    return <BookingTransportState title="Reserva no disponible" message="La respuesta no contiene un BookingViewModel válido." />;
  }

  const presentation = toBookingWorkspaceModel(viewModel, context);
  const recoveryOptions = recoveryOffersFor(viewModel, context).map((offer) => ({
    offerId: offer.offerId,
    displayName: offer.displayName,
    totalPrice: offer.totalPrice,
    currency: offer.currency,
    transitHours: offer.transitHours,
    score: offer.score,
  }));

  return (
    <>
      <BookingWorkspace
        model={presentation}
        busy={busy}
        actionError={actionError ?? loadError}
        onRefresh={shouldPollProviderBooking(viewModel) && context ? () => { void checkProvider(); } : undefined}
        recoveryOptions={recoveryOptions}
        onRecover={(offerId) => { void recover(offerId); }}
      />
      <iframe ref={frameRef} className={styles.runnerFrame} src="/" title="Ejecución WebMCP de estado de booking" aria-hidden="true" tabIndex={-1} />
    </>
  );
}

function toBookingWorkspaceModel(
  model: BookingViewModel,
  context: BookingRuntimeContext | null,
): BookingWorkspaceModel {
  const status = bookingStatus(model);
  const events = model.events.map((event) => ({
    providerEventId: event.providerEventId,
    eventType: event.eventType,
    providerBookingStatus: event.providerBookingStatus,
    occurredAt: event.occurredAt,
    location: event.location,
    description: event.description,
  }));
  const navigationEvents = events.filter((event) => /NAVIGAT/i.test(event.eventType));
  const toolEvents = events.filter((event) => /BOOKING_REQUESTED|STATUS|CONFIRMED|REJECTED|EXPIRED|CANCELLED/i.test(event.eventType));

  return {
    requestCode: context?.requestCode ?? "reserva activa",
    fixtureLabel: "BookingViewModel v1 · estado y eventos persistidos",
    isFixture: false,
    status,
    selectedOffer: context?.selectedOffer ?? null,
    availableOfferCount: context?.offers.length ?? model.recoveryOfferIds.length + 1,
    returnHref: context?.dispatchHref ?? "/dashboard",
    timeline: bookingTimeline(model),
    evidence: [
      {
        key: "navigation",
        label: "Navegación",
        summary: navigationEvents.length ? `${navigationEvents.length} eventos persistidos` : "Sin evento de navegación en BookingViewModel v1",
        payload: navigationEvents,
      },
      {
        key: "tool",
        label: "Tool",
        summary: toolEvents.length ? `${toolEvents.length} transiciones provider persistidas` : "Sin transición provider persistida",
        payload: toolEvents,
      },
      {
        key: "persistence",
        label: "Persistencia",
        summary: `${events.length} eventos asociados a la reserva`,
        payload: events.map((event) => ({ providerEventId: event.providerEventId, eventType: event.eventType, occurredAt: event.occurredAt })),
      },
      {
        key: "decision",
        label: "Decisión",
        summary: model.selectionMode === "ASSISTED" ? "Selección humana persistida" : "Selección por política autorizada",
        payload: { selectionMode: model.selectionMode, offerId: model.offerId, carrierId: model.carrierId, automaticSelection: model.selectionMode !== "ASSISTED" },
      },
      {
        key: "events",
        label: "Eventos",
        summary: "Cronología entregada por BookingViewModel v1",
        payload: events,
      },
    ],
  };
}

function bookingStatus(model: BookingViewModel): BookingWorkspaceModel["status"] {
  if (model.status === "PENDING_PROVIDER_CONFIRMATION") {
    return {
      code: model.status,
      tone: "waiting",
      eyebrow: "Solicitud enviada",
      title: "Esperando confirmación del transportista",
      message: `El provider puede responder hasta ${formatDateTime(model.providerResponseDeadline)}.`,
      nextAction: "CargoMesh consulta get_provider_booking_status y persiste cada respuesta.",
    };
  }
  if (model.status === "CONFIRMED" || model.status === "IN_TRANSIT" || model.status === "COMPLETED") {
    return {
      code: model.status,
      tone: "success",
      eyebrow: "Reserva confirmada",
      title: model.status === "CONFIRMED" ? "El transportista confirmó la operación" : "La operación continúa en curso",
      message: `Referencia del provider: ${model.providerReference}.`,
      nextAction: "La evidencia permanece disponible en el Judge Drawer.",
    };
  }
  if (model.status === "REJECTED") {
    return {
      code: model.status,
      tone: "danger",
      eyebrow: "Respuesta del transportista",
      title: "La solicitud no fue aceptada",
      message: "La reserva fue rechazada y no se convirtió en confirmación.",
      nextAction: model.canRecover ? "Selecciona una oferta autorizada para recovery." : "No hay ofertas de recovery disponibles.",
    };
  }
  if (model.status === "EXPIRED") {
    return {
      code: model.status,
      tone: "danger",
      eyebrow: "Plazo vencido",
      title: "La solicitud de reserva expiró",
      message: "El provider no confirmó dentro del deadline persistido.",
      nextAction: model.canRecover ? "Selecciona una oferta autorizada para recovery." : "No hay ofertas de recovery disponibles.",
    };
  }
  return {
    code: "CANCELLED",
    tone: "warning",
    eyebrow: "Reserva cancelada",
    title: "La reserva fue cancelada",
    message: "La cancelación permanece separada de una confirmación comercial.",
    nextAction: model.canRecover ? "Selecciona una oferta autorizada para recovery." : "No hay ofertas de recovery disponibles.",
  };
}

function bookingTimeline(model: BookingViewModel): BookingWorkspaceModel["timeline"] {
  const pending = model.status === "PENDING_PROVIDER_CONFIRMATION";
  return [
    { label: "Oferta seleccionada", state: "complete" },
    { label: "Solicitud enviada", state: "complete" },
    { label: "Esperando respuesta", state: pending ? "current" : "complete" },
    { label: "Resultado del provider", state: pending ? "future" : "current" },
  ];
}

function BookingTransportState({
  title,
  message,
  busy = false,
  onRetry,
}: {
  title: string;
  message: string;
  busy?: boolean;
  onRetry?: () => void;
}) {
  return (
    <div className={styles.transportState} aria-busy={busy} role={!busy ? "alert" : "status"}>
      {busy ? <LoaderCircle className={styles.spinner} size={28} aria-hidden="true" /> : <AlertTriangle size={28} aria-hidden="true" />}
      <h1>{title}</h1>
      <p>{message}</p>
      {onRetry ? <button type="button" onClick={onRetry}>Volver a consultar</button> : null}
    </div>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
