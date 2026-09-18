"use client";

import { AlertTriangle, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BookingViewModel } from "@/features/booking/contracts";
import { localeTag } from "@/features/i18n/config";
import { useLocale } from "@/features/i18n/locale-provider";
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
  const { locale, t } = useLocale();
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
      setLoadError(error instanceof Error ? error.message : t("No fue posible consultar la reserva.", "The booking could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, [bookingId, t]);

  const checkProvider = useCallback(async () => {
    const frame = frameRef.current;
    if (!frame || !context || checkingRef.current) return;
    checkingRef.current = true;
    setBusy(true);
    setActionError(null);
    try {
      const result = await refreshProviderBookingStatus(context, frame, window.location.origin);
      setContext(result.context);
      await load();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t("No fue posible actualizar el estado del provider.", "The provider status could not be refreshed."));
    } finally {
      checkingRef.current = false;
      setBusy(false);
    }
  }, [context, load, t]);

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
      setActionError(t("La metadata de navegación no está disponible para iniciar recovery.", "Navigation metadata is unavailable for recovery."));
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
      setActionError(error instanceof Error ? error.message : t("No fue posible iniciar recovery.", "Recovery could not be started."));
      setBusy(false);
    }
  }

  if (loading && !viewModel) {
    return <BookingTransportState title={t("Cargando reserva", "Loading booking")} message={t("Consultando BookingViewModel v1.", "Loading BookingViewModel v1.")} busy />;
  }
  if (loadError && !viewModel) {
    return <BookingTransportState title={t("No pudimos abrir la reserva", "We could not open the booking")} message={loadError} onRetry={() => { setLoading(true); void load(); }} />;
  }
  if (!viewModel) {
    return <BookingTransportState title={t("Reserva no disponible", "Booking unavailable")} message={t("La respuesta no contiene un BookingViewModel válido.", "The response does not contain a valid BookingViewModel.")} />;
  }

  const presentation = toBookingWorkspaceModel(viewModel, context, locale, t);
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
        showRecovery={viewModel.canRecover}
        recoveryOptions={recoveryOptions}
        onRecover={(offerId) => { void recover(offerId); }}
      />
      <iframe ref={frameRef} className={styles.runnerFrame} src="/" title={t("Ejecución WebMCP de estado de booking", "WebMCP booking-status execution")} aria-hidden="true" tabIndex={-1} />
    </>
  );
}

function toBookingWorkspaceModel(
  model: BookingViewModel,
  context: BookingRuntimeContext | null,
  locale: "es" | "en",
  t: (spanish: string, english: string) => string,
): BookingWorkspaceModel {
  const status = bookingStatus(model, locale, t);
  const events = model.events.map((event) => ({
    providerEventId: event.providerEventId,
    eventType: event.eventType,
    providerBookingStatus: event.providerBookingStatus,
    occurredAt: event.occurredAt,
    location: event.location,
    description: event.description,
  }));
  const runtimeNavigation = context?.runtimeEvidence?.navigation ?? [];
  const runtimeTools = context?.runtimeEvidence?.tools ?? [];

  return {
    requestCode: context?.requestCode ?? t("reserva activa", "active booking"),
    fixtureLabel: t("BookingViewModel v1 · estado y eventos persistidos", "BookingViewModel v1 · persisted status and events"),
    isFixture: false,
    status,
    selectedOffer: context?.selectedOffer ?? null,
    availableOfferCount: context?.offers.length ?? model.recoveryOfferIds.length + 1,
    returnHref: context?.dispatchHref ?? "/dashboard",
    trackingHref: ["CONFIRMED", "IN_TRANSIT", "COMPLETED"].includes(model.status) ? `/tracking/${model.bookingId}` : undefined,
    providerResponseDeadline: model.status === "PENDING_PROVIDER_CONFIRMATION" ? model.providerResponseDeadline : undefined,
    timeline: bookingTimeline(model, t),
    evidence: [
      {
        key: "navigation",
        label: t("Navegación", "Navigation"),
        summary: runtimeNavigation.length ? `${runtimeNavigation.length} ${t("navegaciones WebMCP observadas", "observed WebMCP navigations")}` : t("Sin contexto local de navegación disponible", "No local navigation context available"),
        payload: runtimeNavigation,
      },
      {
        key: "tool",
        label: "Tool",
        summary: runtimeTools.length ? `${runtimeTools.length} ${t("ejecuciones mediante document.modelContext", "executions through document.modelContext")}` : t("Sin ejecución WebMCP observada en este navegador", "No WebMCP execution observed in this browser"),
        payload: runtimeTools,
      },
      {
        key: "persistence",
        label: t("Persistencia", "Persistence"),
        summary: `${events.length} ${t("eventos asociados a la reserva", "events associated with the booking")}`,
        payload: events.map((event) => ({ providerEventId: event.providerEventId, eventType: event.eventType, occurredAt: event.occurredAt })),
      },
      {
        key: "decision",
        label: t("Decisión", "Decision"),
        summary: model.selectionMode === "ASSISTED" ? t("Selección humana persistida", "Persisted human selection") : t("Selección por política autorizada", "Authorized policy selection"),
        payload: { selectionMode: model.selectionMode, offerId: model.offerId, carrierId: model.carrierId, automaticSelection: model.selectionMode !== "ASSISTED" },
      },
      {
        key: "events",
        label: t("Eventos", "Events"),
        summary: t("Cronología entregada por BookingViewModel v1", "Timeline delivered by BookingViewModel v1"),
        payload: events,
      },
    ],
  };
}

function bookingStatus(
  model: BookingViewModel,
  locale: "es" | "en",
  t: (spanish: string, english: string) => string,
): BookingWorkspaceModel["status"] {
  if (model.status === "PENDING_PROVIDER_CONFIRMATION") {
    return {
      code: model.status,
      tone: "waiting",
      eyebrow: t("Solicitud enviada", "Request sent"),
      title: t("Esperando confirmación del transportista", "Waiting for carrier confirmation"),
      message: `${t("El provider puede responder hasta", "The provider can respond until")} ${formatDateTime(model.providerResponseDeadline, locale)}.`,
      nextAction: t("CargoMesh consulta get_provider_booking_status y persiste cada respuesta.", "CargoMesh calls get_provider_booking_status and persists each response."),
    };
  }
  if (model.status === "CONFIRMED" || model.status === "IN_TRANSIT" || model.status === "COMPLETED") {
    return {
      code: model.status,
      tone: "success",
      eyebrow: t("Reserva confirmada", "Booking confirmed"),
      title: model.status === "CONFIRMED" ? t("El transportista confirmó la operación", "The carrier confirmed the operation") : t("La operación continúa en curso", "The operation is still in progress"),
      message: `${t("Referencia del provider", "Provider reference")}: ${model.providerReference}.`,
      nextAction: t("La evidencia permanece disponible en el Judge Drawer.", "Evidence remains available in the Judge Drawer."),
    };
  }
  if (model.status === "REJECTED") {
    return {
      code: model.status,
      tone: "danger",
      eyebrow: t("Respuesta del transportista", "Carrier response"),
      title: t("La solicitud no fue aceptada", "The request was not accepted"),
      message: t("La reserva fue rechazada y no se convirtió en confirmación.", "The booking was rejected and did not become a confirmation."),
      nextAction: model.canRecover ? t("Selecciona una oferta autorizada para recovery.", "Select an authorized offer for recovery.") : t("No hay ofertas de recovery disponibles.", "No recovery offers are available."),
    };
  }
  if (model.status === "EXPIRED") {
    return {
      code: model.status,
      tone: "danger",
      eyebrow: t("Plazo vencido", "Deadline expired"),
      title: t("La solicitud de reserva expiró", "The booking request expired"),
      message: t("El provider no confirmó dentro del deadline persistido.", "The provider did not confirm before the persisted deadline."),
      nextAction: model.canRecover ? t("Selecciona una oferta autorizada para recovery.", "Select an authorized offer for recovery.") : t("No hay ofertas de recovery disponibles.", "No recovery offers are available."),
    };
  }
  return {
    code: "CANCELLED",
    tone: "warning",
    eyebrow: t("Reserva cancelada", "Booking cancelled"),
    title: t("La reserva fue cancelada", "The booking was cancelled"),
    message: t("La cancelación permanece separada de una confirmación comercial.", "Cancellation remains separate from commercial confirmation."),
    nextAction: model.canRecover ? t("Selecciona una oferta autorizada para recovery.", "Select an authorized offer for recovery.") : t("No hay ofertas de recovery disponibles.", "No recovery offers are available."),
  };
}

function bookingTimeline(
  model: BookingViewModel,
  t: (spanish: string, english: string) => string,
): BookingWorkspaceModel["timeline"] {
  const pending = model.status === "PENDING_PROVIDER_CONFIRMATION";
  return [
    { label: t("Oferta seleccionada", "Offer selected"), state: "complete" },
    { label: t("Solicitud enviada", "Request sent"), state: "complete" },
    { label: t("Esperando respuesta", "Waiting for response"), state: pending ? "current" : "complete" },
    { label: t("Resultado del provider", "Provider result"), state: pending ? "future" : "current" },
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
  const { t } = useLocale();
  return (
    <div className={styles.transportState} aria-busy={busy} role={!busy ? "alert" : "status"}>
      {busy ? <LoaderCircle className={styles.spinner} size={28} aria-hidden="true" /> : <AlertTriangle size={28} aria-hidden="true" />}
      <h1>{title}</h1>
      <p>{message}</p>
      {onRetry ? <button type="button" onClick={onRetry}>{t("Volver a consultar", "Try again")}</button> : null}
    </div>
  );
}

function formatDateTime(value: string, locale: "es" | "en") {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat(localeTag(locale), { dateStyle: "medium", timeStyle: "short" }).format(date);
}
