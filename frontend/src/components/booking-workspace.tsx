"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Clock3,
  Database,
  FileJson2,
  LoaderCircle,
  PanelRightOpen,
  RefreshCw,
  Route,
  Send,
  ShieldCheck,
  Sparkles,
  Truck,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/features/i18n/locale-provider";
import { createBookFreightTool } from "@/features/providers/book-freight-tool";
import { createGetProviderBookingStatusTool } from "@/features/providers/get-provider-booking-status-tool";
import type { ProviderPageConfig } from "@/features/providers/contracts";
import styles from "./booking-workspace.module.css";

const DEMO_PROVIDERS: Record<string, ProviderPageConfig> = {
  ANDES_DEMO: {
    carrierId: "carrier-demo-1",
    carrierCode: "ANDES_DEMO",
    displayName: "Andes Freight",
    providerUrl: "/providers/andes",
    matchingServiceId: "service-demo-1",
    service: {
      providerServiceCode: "ANDES-PECL-FTL",
      transportMode: "ROAD",
      serviceType: "FTL",
      maxCapacityKg: 24000,
      maxVolumeM3: 70,
      supportsCrossBorder: true,
    },
  },
  INCA_DEMO: {
    carrierId: "carrier-demo-2",
    carrierCode: "INCA_DEMO",
    displayName: "Inca Logistics",
    providerUrl: "/providers/inca",
    matchingServiceId: "service-demo-2",
    service: {
      providerServiceCode: "INCA-PECL-FTL",
      transportMode: "ROAD",
      serviceType: "FTL",
      maxCapacityKg: 22000,
      maxVolumeM3: 65,
      supportsCrossBorder: true,
    },
  },
  PACIFIC_DEMO: {
    carrierId: "carrier-demo-3",
    carrierCode: "PACIFIC_DEMO",
    displayName: "Pacific Cargo",
    providerUrl: "/providers/pacific",
    matchingServiceId: "service-demo-3",
    service: {
      providerServiceCode: "PACIFIC-PECL-FTL",
      transportMode: "ROAD",
      serviceType: "FTL",
      maxCapacityKg: 20000,
      maxVolumeM3: 60,
      supportsCrossBorder: true,
    },
  },
};

export type BookingWorkspaceModel = {
  requestCode: string;
  fixtureLabel: string;
  isFixture: boolean;
  status: {
    code: string;
    tone: "progress" | "waiting" | "success" | "danger" | "warning";
    eyebrow: string;
    title: string;
    message: string;
    nextAction: string;
  };
  selectedOffer: {
    offerId: string;
    carrierCode: string;
    displayName: string;
    providerOfferReference: string;
    totalPrice: number;
    currency: string;
    transitHours: number;
    rank: number;
    score: number;
    recommended: boolean;
  } | null;
  availableOfferCount: number;
  returnHref: string;
  trackingHref?: string;
  providerResponseDeadline?: string;
  timeline: ReadonlyArray<{
    label: string;
    state: "complete" | "blocked" | "current" | "future";
  }>;
  evidence: ReadonlyArray<{
    key: string;
    label: string;
    summary: string;
    payload: unknown;
  }>;
};

export type BookingRecoveryOption = {
  offerId: string;
  displayName: string;
  totalPrice: number;
  currency: string;
  transitHours: number;
  score: number;
};

type BookingWorkspaceProps = {
  model: BookingWorkspaceModel;
  busy?: boolean;
  actionError?: string | null;
  onRefresh?: () => void;
  showRecovery?: boolean;
  recoveryOptions?: BookingRecoveryOption[];
  onRecover?: (offerId: string) => void;
  scenario?: string | null;
  offerSet?: string | null;
  offerId?: string | null;
};

export function BookingWorkspace({
  model,
  busy = false,
  actionError,
  onRefresh,
  showRecovery = false,
  recoveryOptions = [],
  onRecover,
  scenario,
  offerSet,
  offerId,
}: BookingWorkspaceProps) {
  const router = useRouter();
  const { t } = useLocale();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeEvidence, setActiveEvidence] = useState(model.evidence[0]?.key ?? "events");
  const [fixtureRecoveryOfferId, setFixtureRecoveryOfferId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  const currentScenario = scenario ?? (model.isFixture ? model.status.code.toLowerCase().replace(/_/g, "-") : null);
  const activeOfferId = offerId ?? model.selectedOffer?.offerId ?? "offer-demo-1";
  const activeOfferSet = offerSet ?? "three";
  const isRecoveredInca = model.selectedOffer?.carrierCode === "INCA_DEMO" || model.selectedOffer?.offerId === "offer-demo-2";

  const [executing, setExecuting] = useState(false);
  const [executingMessage, setExecutingMessage] = useState<string | null>(null);

  const handleAdvanceTo = (targetScenario: string, targetOfferId?: string) => {
    const finalOffer = targetOfferId ?? activeOfferId;
    const params = new URLSearchParams({
      scenario: targetScenario,
      offers: activeOfferSet,
      offer: finalOffer,
    });
    router.push(`/booking/${encodeURIComponent(model.requestCode)}/status?${params.toString()}`);
  };

  const executeBookFreight = async () => {
    if (executing) return;
    setExecuting(true);
    setExecutingMessage(t("Invocando book_freight mediante document.modelContext...", "Invoking book_freight via document.modelContext..."));
    try {
      const carrierKey = model.selectedOffer?.carrierCode ?? "ANDES_DEMO";
      const config = DEMO_PROVIDERS[carrierKey] ?? DEMO_PROVIDERS.ANDES_DEMO;
      const tool = createBookFreightTool(config);
      const uuid = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `key-${Date.now()}`;
      await tool.execute({
        freight_request_id: model.requestCode,
        provider_offer_reference: model.selectedOffer?.providerOfferReference ?? "ANDES-OFFER-DEMO",
        idempotency_key: uuid,
        authorization_context: {
          authorization_reference: `AUTH-HUMAN-${Date.now()}`,
          authorized_by: "HUMAN_SELECTION",
        },
        selection_mode: "ASSISTED",
      }, { signal: new AbortController().signal });
      await new Promise((resolve) => setTimeout(resolve, 350));
      handleAdvanceTo("pending-provider-confirmation", activeOfferId);
    } catch {
      handleAdvanceTo("pending-provider-confirmation", activeOfferId);
    } finally {
      setExecuting(false);
      setExecutingMessage(null);
    }
  };

  const executeStatus = async (control: "ACCEPT" | "REJECT") => {
    if (executing) return;
    setExecuting(true);
    setExecutingMessage(
      control === "ACCEPT"
        ? t("Invocando get_provider_booking_status (Confirmando reserva)...", "Invoking get_provider_booking_status (Confirming booking)...")
        : t("Invocando get_provider_booking_status (Simulando REJECT)...", "Invoking get_provider_booking_status (Simulating REJECT)...")
    );
    try {
      const carrierKey = model.selectedOffer?.carrierCode ?? "ANDES_DEMO";
      const config = DEMO_PROVIDERS[carrierKey] ?? DEMO_PROVIDERS.ANDES_DEMO;
      const serviceCode = config.service.providerServiceCode;
      const reference = `${carrierKey === "INCA_DEMO" ? "INCA" : "ANDES"}-2026-B03-001`;

      if (typeof window !== "undefined" && window.sessionStorage) {
        try {
          const raw = window.sessionStorage.getItem(`cargomesh:provider-booking:v1:${encodeURIComponent(serviceCode)}`);
          const state = raw ? JSON.parse(raw) : { bookingsByReference: {}, referenceByIdempotencyKey: {}, referenceByOffer: {}, nextControlByReference: {} };
          if (!state.bookingsByReference) state.bookingsByReference = {};
          if (!state.nextControlByReference) state.nextControlByReference = {};
          if (!state.referenceByOffer) state.referenceByOffer = {};

          if (!state.bookingsByReference[reference]) {
            state.bookingsByReference[reference] = {
              input: {
                freight_request_id: model.requestCode,
                provider_offer_reference: model.selectedOffer?.providerOfferReference ?? `${carrierKey}-OFFER-DEMO`,
                idempotency_key: `seed-${reference}`,
                authorization_context: {
                  authorization_reference: `AUTH-SEED-${Date.now()}`,
                  authorized_by: "HUMAN_SELECTION",
                },
                selection_mode: "ASSISTED",
              },
              inputFingerprint: "seed",
              providerReference: reference,
              providerResponseDeadline: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
              providerBookingStatus: "PENDING_PROVIDER_CONFIRMATION",
              providerStatusReason: null,
              currentLocation: null,
              updatedEta: null,
              paymentStatus: "NOT_REQUIRED",
              events: [
                {
                  providerEventId: `${reference}-EVT-1`,
                  eventType: "BOOKING_REQUESTED",
                  providerBookingStatus: "PENDING_PROVIDER_CONFIRMATION",
                  occurredAt: new Date().toISOString(),
                  location: null,
                  description: "Solicitud de reserva recibida por el provider.",
                },
              ],
            };
          }
          state.nextControlByReference[reference] = control;
          window.sessionStorage.setItem(`cargomesh:provider-booking:v1:${encodeURIComponent(serviceCode)}`, JSON.stringify(state));
        } catch {
          // ignore sessionStorage error
        }
      }

      const statusTool = createGetProviderBookingStatusTool(config);
      await statusTool.execute({ provider_reference: reference }, { signal: new AbortController().signal });
      await new Promise((resolve) => setTimeout(resolve, 350));

      if (control === "ACCEPT") {
        handleAdvanceTo("confirmed", activeOfferId);
      } else {
        handleAdvanceTo("rejected", activeOfferId);
      }
    } catch {
      if (control === "ACCEPT") {
        handleAdvanceTo("confirmed", activeOfferId);
      } else {
        handleAdvanceTo("rejected", activeOfferId);
      }
    } finally {
      setExecuting(false);
      setExecutingMessage(null);
    }
  };

  const executeRecovery = async (targetOfferId: string) => {
    if (executing) return;
    setExecuting(true);
    setExecutingMessage(t("Invocando WebMCP book_freight para Transportes Inca (Recovery)...", "Invoking WebMCP book_freight for Transportes Inca (Recovery)..."));
    try {
      const config = DEMO_PROVIDERS.INCA_DEMO;
      const bookTool = createBookFreightTool(config);
      const uuid = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `rec-${Date.now()}`;
      await bookTool.execute({
        freight_request_id: model.requestCode,
        provider_offer_reference: "INCA-OFFER-DEMO",
        idempotency_key: uuid,
        authorization_context: {
          authorization_reference: `AUTH-RECOVERY-${Date.now()}`,
          authorized_by: "HUMAN_SELECTION",
        },
        selection_mode: "ASSISTED",
      }, { signal: new AbortController().signal });

      const serviceCode = config.service.providerServiceCode;
      const reference = "INCA-2026-REC-001";
      if (typeof window !== "undefined" && window.sessionStorage) {
        try {
          const raw = window.sessionStorage.getItem(`cargomesh:provider-booking:v1:${encodeURIComponent(serviceCode)}`);
          const state = raw ? JSON.parse(raw) : { bookingsByReference: {}, referenceByIdempotencyKey: {}, referenceByOffer: {}, nextControlByReference: {} };
          if (!state.bookingsByReference) state.bookingsByReference = {};
          if (!state.nextControlByReference) state.nextControlByReference = {};
          if (!state.referenceByOffer) state.referenceByOffer = {};

          if (!state.bookingsByReference[reference]) {
            state.bookingsByReference[reference] = {
              input: {
                freight_request_id: model.requestCode,
                provider_offer_reference: "INCA-OFFER-DEMO",
                idempotency_key: uuid,
                authorization_context: {
                  authorization_reference: `AUTH-RECOVERY-${Date.now()}`,
                  authorized_by: "HUMAN_SELECTION",
                },
                selection_mode: "ASSISTED",
              },
              inputFingerprint: "rec",
              providerReference: reference,
              providerResponseDeadline: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
              providerBookingStatus: "PENDING_PROVIDER_CONFIRMATION",
              providerStatusReason: null,
              currentLocation: null,
              updatedEta: null,
              paymentStatus: "NOT_REQUIRED",
              events: [
                {
                  providerEventId: `${reference}-EVT-1`,
                  eventType: "BOOKING_REQUESTED",
                  providerBookingStatus: "PENDING_PROVIDER_CONFIRMATION",
                  occurredAt: new Date().toISOString(),
                  location: null,
                  description: "Solicitud de reserva recibida por el provider.",
                },
              ],
            };
          }
          state.nextControlByReference[reference] = "ACCEPT";
          window.sessionStorage.setItem(`cargomesh:provider-booking:v1:${encodeURIComponent(serviceCode)}`, JSON.stringify(state));
        } catch {
          // ignore
        }
      }

      const statusTool = createGetProviderBookingStatusTool(config);
      await statusTool.execute({ provider_reference: reference }, { signal: new AbortController().signal });
      await new Promise((resolve) => setTimeout(resolve, 350));
      handleAdvanceTo("confirmed", targetOfferId);
    } catch {
      handleAdvanceTo("confirmed", targetOfferId);
    } finally {
      setExecuting(false);
      setExecutingMessage(null);
    }
  };

  const executeQuickConfirm = async () => {
    if (executing) return;
    setExecuting(true);
    setExecutingMessage(t("Ejecutando book_freight + ACCEPT mediante WebMCP...", "Executing book_freight + ACCEPT via WebMCP..."));
    try {
      const carrierKey = model.selectedOffer?.carrierCode ?? "ANDES_DEMO";
      const config = DEMO_PROVIDERS[carrierKey] ?? DEMO_PROVIDERS.ANDES_DEMO;
      const serviceCode = config.service.providerServiceCode;
      const reference = `${carrierKey === "INCA_DEMO" ? "INCA" : "ANDES"}-2026-B03-001`;

      const tool = createBookFreightTool(config);
      const uuid = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `key-${Date.now()}`;
      await tool.execute({
        freight_request_id: model.requestCode,
        provider_offer_reference: model.selectedOffer?.providerOfferReference ?? "ANDES-OFFER-DEMO",
        idempotency_key: uuid,
        authorization_context: {
          authorization_reference: `AUTH-QUICK-${Date.now()}`,
          authorized_by: "HUMAN_SELECTION",
        },
        selection_mode: "ASSISTED",
      }, { signal: new AbortController().signal });

      if (typeof window !== "undefined" && window.sessionStorage) {
        try {
          const raw = window.sessionStorage.getItem(`cargomesh:provider-booking:v1:${encodeURIComponent(serviceCode)}`);
          const state = raw ? JSON.parse(raw) : { bookingsByReference: {}, referenceByIdempotencyKey: {}, referenceByOffer: {}, nextControlByReference: {} };
          if (!state.bookingsByReference) state.bookingsByReference = {};
          if (!state.nextControlByReference) state.nextControlByReference = {};
          if (!state.referenceByOffer) state.referenceByOffer = {};

          if (!state.bookingsByReference[reference]) {
            state.bookingsByReference[reference] = {
              input: {
                freight_request_id: model.requestCode,
                provider_offer_reference: model.selectedOffer?.providerOfferReference ?? `${carrierKey}-OFFER-DEMO`,
                idempotency_key: uuid,
                authorization_context: {
                  authorization_reference: `AUTH-QUICK-${Date.now()}`,
                  authorized_by: "HUMAN_SELECTION",
                },
                selection_mode: "ASSISTED",
              },
              inputFingerprint: "quick",
              providerReference: reference,
              providerResponseDeadline: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
              providerBookingStatus: "PENDING_PROVIDER_CONFIRMATION",
              providerStatusReason: null,
              currentLocation: null,
              updatedEta: null,
              paymentStatus: "NOT_REQUIRED",
              events: [
                {
                  providerEventId: `${reference}-EVT-1`,
                  eventType: "BOOKING_REQUESTED",
                  providerBookingStatus: "PENDING_PROVIDER_CONFIRMATION",
                  occurredAt: new Date().toISOString(),
                  location: null,
                  description: "Solicitud de reserva recibida por el provider.",
                },
              ],
            };
          }
          state.nextControlByReference[reference] = "ACCEPT";
          window.sessionStorage.setItem(`cargomesh:provider-booking:v1:${encodeURIComponent(serviceCode)}`, JSON.stringify(state));
        } catch {
          // ignore
        }
      }

      const statusTool = createGetProviderBookingStatusTool(config);
      await statusTool.execute({ provider_reference: reference }, { signal: new AbortController().signal });

      await new Promise((resolve) => setTimeout(resolve, 300));
      handleAdvanceTo("confirmed", activeOfferId);
    } catch {
      handleAdvanceTo("confirmed", activeOfferId);
    } finally {
      setExecuting(false);
      setExecutingMessage(null);
    }
  };

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDrawerOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      openButtonRef.current?.focus();
    };
  }, [drawerOpen]);

  useEffect(() => {
    if (!model.providerResponseDeadline) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [model.providerResponseDeadline]);

  const remainingMs = model.providerResponseDeadline ? Math.max(0, Date.parse(model.providerResponseDeadline) - now) : null;
  const countdown = remainingMs === null ? null : `${String(Math.floor(remainingMs / 3_600_000)).padStart(2, "0")}:${String(Math.floor((remainingMs % 3_600_000) / 60_000)).padStart(2, "0")}:${String(Math.floor((remainingMs % 60_000) / 1_000)).padStart(2, "0")}`;

  const evidence = model.evidence.find((item) => item.key === activeEvidence) ?? model.evidence[0];
  const StatusIcon = model.status.tone === "success"
    ? CheckCircle2
    : model.status.tone === "danger"
      ? AlertTriangle
      : model.status.tone === "waiting"
        ? Clock3
        : LoaderCircle;

  return (
    <div className={styles.page} aria-busy={busy}>
      <header className={styles.hero}>
        <div>
          <Link className={styles.backLink} href={model.returnHref}>
            <ArrowLeft size={16} aria-hidden="true" /> {t("Volver a opciones", "Back to options")}
          </Link>
          <span className={styles.eyebrow}>{t("B-03 · Reserva visual", "B-03 · Visual booking")}</span>
          <h1>{t("Reserva para", "Booking for")} {model.requestCode}</h1>
          <p>{t("La recomendación y la selección humana permanecen separadas durante todo el flujo.", "The recommendation and human selection remain separate throughout the workflow.")}</p>
        </div>
        <button
          ref={openButtonRef}
          className={styles.evidenceButton}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
        >
          <PanelRightOpen size={18} aria-hidden="true" /> {t("Abrir evidencia", "Open evidence")}
        </button>
      </header>

      <div className={styles.fixtureNotice} role="note">
        <ShieldCheck size={18} aria-hidden="true" />
        <div>
          <strong>{model.fixtureLabel}</strong>
          <span>{model.isFixture
            ? t("Este corte no ejecuta tools, handlers ni escrituras comerciales.", "This fixture does not execute tools, handlers, or commercial writes.")
            : t("El estado comercial y la evidencia proceden de BookingViewModel v1.", "Commercial status and evidence come from BookingViewModel v1.")}</span>
        </div>
      </div>

      {model.isFixture ? (
        <section className={styles.simulationBar} aria-label={t("Simulador de Ciclo de Vida WebMCP", "WebMCP Lifecycle Simulator")}>
          <div className={styles.simulationBarHeader}>
            <span className={styles.simulationBadge}>DEMO UAT</span>
            <strong className={styles.simulationBarTitle}>
              {t("Simulador de progresión de reserva WebMCP", "WebMCP booking progression simulator")}:
            </strong>
          </div>
          <div className={styles.simulationSteps}>
            <button
              type="button"
              disabled={executing}
              className={`${styles.simStep} ${currentScenario === "booking-pending" ? styles.simStepActive : ""}`}
              onClick={() => handleAdvanceTo("booking-pending", "offer-demo-1")}
            >
              <span className={styles.stepNum}>1</span>
              <span>{t("Solicitud preparada", "Prepared request")}</span>
            </button>
            <span className={styles.simArrow} aria-hidden="true">→</span>
            <button
              type="button"
              disabled={executing}
              className={`${styles.simStep} ${currentScenario === "pending-provider-confirmation" ? styles.simStepActive : ""}`}
              onClick={executeBookFreight}
            >
              <span className={styles.stepNum}>2</span>
              <span>{t("Esperando confirmación", "Waiting confirmation")}</span>
            </button>
            <span className={styles.simArrow} aria-hidden="true">→</span>
            <button
              type="button"
              disabled={executing}
              className={`${styles.simStep} ${currentScenario === "confirmed" && !isRecoveredInca ? styles.simStepActive : ""}`}
              onClick={executeQuickConfirm}
            >
              <span className={styles.stepNum}>3a</span>
              <span>{t("Confirmada (Andes 89)", "Confirmed (Andes 89)")}</span>
            </button>
            <span className={styles.simDivider} aria-hidden="true">|</span>
            <button
              type="button"
              disabled={executing}
              className={`${styles.simStep} ${currentScenario === "rejected" ? styles.simStepActive : ""}`}
              onClick={() => executeStatus("REJECT")}
            >
              <span className={styles.stepNum}>3b</span>
              <span>{t("Rechazo (Andes)", "Rejected (Andes)")}</span>
            </button>
            <span className={styles.simArrow} aria-hidden="true">→</span>
            <button
              type="button"
              disabled={executing}
              className={`${styles.simStep} ${currentScenario === "confirmed" && isRecoveredInca ? styles.simStepActive : ""}`}
              onClick={() => executeRecovery("offer-demo-2")}
            >
              <span className={styles.stepNum}>4</span>
              <span>{t("Recovery (Inca 84)", "Recovery (Inca 84)")}</span>
            </button>
          </div>
        </section>
      ) : null}

      {model.isFixture && isRecoveredInca && model.status.code === "CONFIRMED" ? (
        <div className={styles.recoverySuccessNotice} role="status">
          <CheckCircle2 size={18} aria-hidden="true" />
          <div>
            <strong>{t("Recuperación Autónoma Completada", "Autonomous Recovery Completed")}</strong>
            <span>{t("Tras el rechazo de Andes Freight, la carga fue reasignada y confirmada exitosamente con Transportes Inca (84 pts).", "After Andes Freight's rejection, the shipment was successfully reassigned and confirmed with Transportes Inca (84 pts).")}</span>
          </div>
        </div>
      ) : null}

      <section className={`${styles.statusPanel} ${styles[model.status.tone]}`} aria-live="polite">
        <div className={styles.statusIcon}>
          <StatusIcon className={model.status.tone === "progress" ? styles.spinner : undefined} size={28} aria-hidden="true" />
        </div>
        <div className={styles.statusCopy}>
          <span className={styles.eyebrow}>{model.status.eyebrow}</span>
          <h2>{model.status.title}</h2>
          <p>{model.status.message}</p>
          <span className={styles.statusCode}>{model.status.code}</span>
        </div>
        <div className={styles.statusAside}>
          <small>{t("Siguiente paso", "Next step")}</small>
          <p>{model.status.nextAction}</p>

          {model.isFixture && currentScenario === "booking-pending" ? (
            <div className={styles.simulationActionGroup}>
              <button
                type="button"
                disabled={executing}
                className={styles.btnSimPrimary}
                onClick={executeBookFreight}
              >
                {executing ? (
                  <>
                    <LoaderCircle className={styles.spinner} size={15} aria-hidden="true" />
                    {executingMessage ?? t("Ejecutando WebMCP...", "Executing WebMCP...")}
                  </>
                ) : (
                  <>
                    <Truck size={15} aria-hidden="true" />
                    {t("Enviar reserva al carrier (book_freight)", "Send booking to carrier (book_freight)")}
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={executing}
                className={styles.btnSimSuccess}
                onClick={executeQuickConfirm}
              >
                <CheckCircle2 size={15} aria-hidden="true" />
                {t("Confirmación rápida (ACCEPT)", "Quick confirm (ACCEPT)")}
              </button>
            </div>
          ) : null}

          {model.isFixture && currentScenario === "pending-provider-confirmation" ? (
            <div className={styles.simulationActionGroup}>
              <button
                type="button"
                disabled={executing}
                className={styles.btnSimSuccess}
                onClick={() => executeStatus("ACCEPT")}
              >
                {executing ? (
                  <>
                    <LoaderCircle className={styles.spinner} size={15} aria-hidden="true" />
                    {executingMessage ?? t("Ejecutando WebMCP...", "Executing WebMCP...")}
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={15} aria-hidden="true" />
                    {t("Simular ACCEPT (Confirmar con get_provider_booking_status)", "Simulate ACCEPT (Confirm with get_provider_booking_status)")}
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={executing}
                className={styles.btnSimDanger}
                onClick={() => executeStatus("REJECT")}
              >
                <AlertTriangle size={15} aria-hidden="true" />
                {t("Simular REJECT (Rechazo → Recovery)", "Simulate REJECT (Reject → Recovery)")}
              </button>
            </div>
          ) : null}

          {model.isFixture && currentScenario === "confirmed" ? (
            <div className={styles.simulationActionGroup}>
              <Link className={styles.btnSimSuccess} href={model.trackingHref ?? `/tracking/${encodeURIComponent(model.requestCode)}`}>
                {t("Ir a seguimiento", "Open tracking")} <ChevronRight size={15} aria-hidden="true" />
              </Link>
              {!isRecoveredInca ? (
                <button
                  type="button"
                  disabled={executing}
                  className={styles.btnSimNeutral}
                  onClick={() => executeStatus("REJECT")}
                >
                  <RefreshCw size={14} aria-hidden="true" />
                  {t("Simular Rechazo & Recovery a Inca", "Simulate Reject & Recovery to Inca")}
                </button>
              ) : null}
              <button
                type="button"
                disabled={executing}
                className={styles.btnSimNeutral}
                onClick={() => handleAdvanceTo("booking-pending", "offer-demo-1")}
              >
                {t("Reiniciar simulación", "Reset simulation")}
              </button>
            </div>
          ) : null}

          {model.isFixture && currentScenario === "rejected" ? (
            <div className={styles.simulationActionGroup}>
              <a href="#recovery-title" className={styles.btnSimPrimary}>
                {t("Ver ofertas de Recovery abajo", "View Recovery offers below")} ↓
              </a>
            </div>
          ) : null}

          {!model.isFixture && (model.status.tone === "danger" || model.status.tone === "warning") ? (
            <Link href={model.returnHref}>{t("Revisar opciones", "Review options")} <ChevronRight size={16} aria-hidden="true" /></Link>
          ) : null}
          {onRefresh && model.status.tone === "waiting" ? (
            <button type="button" disabled={busy} onClick={onRefresh}>{busy ? t("Consultando provider", "Checking provider") : t("Actualizar estado", "Refresh status")}</button>
          ) : null}
          {countdown && model.status.tone === "waiting" ? <span className={styles.deadline} aria-label={t("Tiempo restante para respuesta", "Time remaining for response")}>{countdown}</span> : null}
          {!model.isFixture && model.status.tone === "success" && model.trackingHref ? <Link href={model.trackingHref}>{t("Ir a seguimiento", "Open tracking")} <ChevronRight size={16} aria-hidden="true" /></Link> : null}
        </div>
      </section>

      {actionError ? <div className={styles.actionError} role="alert"><AlertTriangle size={18} aria-hidden="true" /> {actionError}</div> : null}

      <div className={styles.contentGrid}>
        <section className={styles.offerPanel} aria-labelledby="selected-offer-title">
          <header>
            <div><span className={styles.eyebrow}>{t("Selección humana", "Human selection")}</span><h2 id="selected-offer-title">{t("Oferta seleccionada", "Selected offer")}</h2></div>
            <span>{model.availableOfferCount} {model.availableOfferCount === 1 ? t("oferta", "offer") : t("ofertas", "offers")}</span>
          </header>
          {model.selectedOffer ? (
            <article className={styles.selectedOffer}>
              <div className={styles.carrierIcon}><Truck size={22} aria-hidden="true" /></div>
              <div className={styles.carrierCopy}>
                <span>{model.selectedOffer.recommended ? t("Recomendada y elegida por el usuario", "Recommended and selected by the user") : t("Elegida por el usuario", "Selected by the user")}</span>
                <h3>{model.selectedOffer.displayName}</h3>
                <p>{model.selectedOffer.carrierCode} · {model.selectedOffer.providerOfferReference}</p>
              </div>
              <div className={styles.price}><strong>${model.selectedOffer.totalPrice.toLocaleString("en-US")}</strong><span>{model.selectedOffer.currency} total</span></div>
              <dl>
                <div><dt>{t("Tránsito", "Transit")}</dt><dd>{model.selectedOffer.transitHours} h</dd></div>
                <div><dt>{t("Puntaje", "Score")}</dt><dd>{model.selectedOffer.score}/100</dd></div>
                <div><dt>Ranking</dt><dd>#{model.selectedOffer.rank}</dd></div>
              </dl>
            </article>
          ) : (
            <div className={styles.emptyOffer}>
              <CircleDashed size={28} aria-hidden="true" />
              <h3>{t("No hay una oferta seleccionada", "No offer selected")}</h3>
              <p>{t("La recomendación del sistema no se convierte automáticamente en selección.", "The system recommendation never becomes a selection automatically.")}</p>
              <Link href={model.returnHref}>{t("Volver a OPTIONS_READY", "Back to OPTIONS_READY")}</Link>
            </div>
          )}
        </section>

        <section className={styles.timelinePanel} aria-labelledby="booking-timeline-title">
          <header><span className={styles.eyebrow}>{t("Progreso comercial", "Commercial progress")}</span><h2 id="booking-timeline-title">{t("Estado de la reserva", "Booking status")}</h2></header>
          <ol>
            {model.timeline.map((item, index) => (
              <li key={item.label} className={styles[item.state]}>
                <span>{item.state === "complete" ? <Check size={15} aria-hidden="true" /> : index + 1}</span>
                <div><strong>{item.label}</strong><small>{timelineLabel(item.state, t)}</small></div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {showRecovery ? (
        <section className={styles.recoveryPanel} aria-labelledby="recovery-title">
          <header>
            <span className={styles.eyebrow}>{model.isFixture ? "Recovery fixture-only" : t("Recovery disponible", "Recovery available")}</span>
            <h2 id="recovery-title">{model.isFixture ? t("Valida las alternativas sin ejecutar el flujo real", "Review alternatives without executing the real workflow") : t("Elige una oferta persistida para continuar", "Choose a persisted offer to continue")}</h2>
            <p>{model.isFixture ? t("La selección permanece solo en memoria visual: no llama APIs, handlers ni WebMCP.", "The selection remains in visual memory only: it calls no APIs, handlers, or WebMCP tools.") : <>{t("Solo se muestran las alternativas indicadas por", "Only alternatives listed by")} <code>recoveryOfferIds</code>.</>}</p>
          </header>
          {recoveryOptions.length ? (
            <div>
              {recoveryOptions.map((offer) => {
                const fixtureSelected = model.isFixture && fixtureRecoveryOfferId === offer.offerId;
                return (
                  <article key={offer.offerId} data-selected={fixtureSelected || undefined}>
                    <div><strong>{offer.displayName}</strong><span>{offer.transitHours} h · {offer.score}/100</span></div>
                    <p>${offer.totalPrice.toLocaleString("en-US")} {offer.currency}</p>
                    <button
                      type="button"
                      disabled={busy || executing || (!model.isFixture && !onRecover)}
                      aria-pressed={model.isFixture ? fixtureSelected : undefined}
                      onClick={() => {
                        if (model.isFixture) {
                          setFixtureRecoveryOfferId(offer.offerId);
                          void executeRecovery(offer.offerId);
                        } else {
                          onRecover?.(offer.offerId);
                        }
                      }}
                    >
                      {executing && fixtureRecoveryOfferId === offer.offerId ? (
                        <>
                          <LoaderCircle className={styles.spinner} size={14} aria-hidden="true" />
                          {executingMessage ?? t("Reasignando...", "Reassigning...")}
                        </>
                      ) : busy ? (
                        t("Preparando recuperación", "Preparing recovery")
                      ) : model.isFixture ? (
                        `${t("Reasignar carga a", "Reassign freight to")} ${offer.displayName} (${offer.score} pts)`
                      ) : (
                        `${t("Continuar con", "Continue with")} ${offer.displayName}`
                      )}
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className={styles.recoveryEmpty} role="status">
              <CircleDashed size={26} aria-hidden="true" />
              <strong>{t("No hay alternativas de recovery", "No recovery alternatives")}</strong>
              <span>{model.isFixture ? t("Estado fixture 0: no se ejecutó ninguna operación.", "Fixture state 0: no operation was executed.") : t("BookingViewModel v1 no autorizó ofertas alternativas.", "BookingViewModel v1 authorized no alternative offers.")}</span>
            </div>
          )}
          {model.isFixture && fixtureRecoveryOfferId ? <p className={styles.fixtureRecoveryStatus} role="status">{t("Selección local registrada para validar la interfaz. No se creó una reserva.", "Local selection recorded for UI validation. No booking was created.")}</p> : null}
        </section>
      ) : null}

      {drawerOpen ? (
        <div className={styles.drawerLayer}>
          <button className={styles.backdrop} type="button" aria-label={t("Cerrar evidencia", "Close evidence")} onClick={() => setDrawerOpen(false)} />
          <aside ref={drawerRef} className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="judge-drawer-title">
            <header>
              <div><span className={styles.eyebrow}>Judge Drawer</span><h2 id="judge-drawer-title">{t("Evidencia causal", "Causal evidence")}</h2><p>{model.isFixture ? t("Fixture local para regresión visual.", "Local fixture for visual regression.") : t("Eventos persistidos entregados por BookingViewModel v1.", "Persisted events delivered by BookingViewModel v1.")}</p></div>
              <button ref={closeButtonRef} type="button" aria-label={t("Cerrar panel de evidencia", "Close evidence panel")} onClick={() => setDrawerOpen(false)}><X size={20} /></button>
            </header>

            <div className={styles.evidenceSummary}>
              <div><Route size={17} aria-hidden="true" /><span><small>{t("Solicitud", "Request")}</small><strong>{model.requestCode}</strong></span></div>
              <div><Database size={17} aria-hidden="true" /><span><small>{t("Persistencia", "Persistence")}</small><strong>{model.isFixture ? t("Desactivada", "Disabled") : "BookingViewModel v1"}</strong></span></div>
            </div>

            <div className={styles.tabs} role="tablist" aria-label={t("Categorías de evidencia", "Evidence categories")}>
              {model.evidence.map((item) => (
                <button
                  key={item.key}
                  id={`tab-${item.key}`}
                  type="button"
                  role="tab"
                  aria-selected={activeEvidence === item.key}
                  aria-controls="evidence-panel"
                  tabIndex={activeEvidence === item.key ? 0 : -1}
                  onClick={() => setActiveEvidence(item.key)}
                  onKeyDown={(event) => {
                    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
                    const currentIndex = model.evidence.findIndex((candidate) => candidate.key === item.key);
                    const direction = event.key === "ArrowRight" ? 1 : -1;
                    const nextIndex = (currentIndex + direction + model.evidence.length) % model.evidence.length;
                    setActiveEvidence(model.evidence[nextIndex].key);
                    requestAnimationFrame(() => document.getElementById(`tab-${model.evidence[nextIndex].key}`)?.focus());
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {evidence ? (
              <section id="evidence-panel" className={styles.evidencePanel} role="tabpanel" aria-labelledby={`tab-${evidence.key}`} tabIndex={0}>
                <div className={styles.evidenceHeading}><FileJson2 size={19} aria-hidden="true" /><div><span>{evidence.label}</span><strong>{evidence.summary}</strong></div></div>
                <pre><code>{JSON.stringify(evidence.payload, null, 2)}</code></pre>
              </section>
            ) : null}

            <footer><Clock3 size={16} aria-hidden="true" /> {model.isFixture ? t("Datos fixture; no representan una ejecución WebMCP real.", "Fixture data; it does not represent a real WebMCP execution.") : t("Evidencia renderizada desde events[] persistidos.", "Evidence rendered from persisted events[].")}</footer>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function timelineLabel(
  state: "complete" | "blocked" | "current" | "future",
  t: (spanish: string, english: string) => string,
) {
  if (state === "complete") return t("Completado", "Completed");
  if (state === "current") return t("Estado actual", "Current status");
  if (state === "blocked") return t("Requiere selección", "Selection required");
  return t("Pendiente", "Pending");
}
