"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDemoMode } from "@/features/demo/demo-context";
import {
  Compass,
  ArrowLeft,
  CheckCircle2,
  Clock,
  MapPin,
  Truck,
  ShieldCheck,
  FileText,
  Sparkles,
  AlertCircle,
  Play,
  RotateCcw,
  Check,
} from "lucide-react";
import { executeGetBookingStatus } from "@/webmcp/provider-tools";
import { dataStore } from "@/features/freight/store";
import { BookingEvent } from "@/features/freight/types";

function TrackingContent({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { isDemoMode } = useDemoMode();

  const [booking, setBooking] = useState<any>(null);
  const [events, setEvents] = useState<BookingEvent[]>([]);
  const [trackingPayload, setTrackingPayload] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadTrackingData = async () => {
    // Look up booking by ID or request ID
    const foundBooking =
      dataStore.getBookingById(params.id) ||
      dataStore.getBookingByRequestId(params.id) ||
      dataStore.getBookings()[0];

    if (foundBooking) {
      setBooking(foundBooking);
      const res = await executeGetBookingStatus(foundBooking.id);
      setTrackingPayload(res);
      setEvents(dataStore.getBookingEvents(foundBooking.id));
    }
    setLoading(false);
  };

  useEffect(() => {
    loadTrackingData();
  }, [params.id]);

  const handleAdvanceEvent = () => {
    if (!booking) return;

    const currentEvents = dataStore.getBookingEvents(booking.id);
    const hasCustomsCleared = currentEvents.some((e) => e.event_type === "CUSTOMS_CLEARED");
    const hasDelivered = currentEvents.some((e) => e.event_type === "DELIVERED");

    if (!hasCustomsCleared) {
      const newEvent: BookingEvent = {
        id: `ev-${Date.now()}`,
        booking_id: booking.id,
        event_type: "CUSTOMS_CLEARED",
        occurred_at: new Date().toISOString(),
        country_code: "CL",
        city: "Arica",
        description: "Manifiesto internacional MIC/DTA validado en Aduana de Arica. Ingreso a territorio chileno autorizado.",
        source: "CARRIER_WEBMCP",
        metadata: { mic_dta_status: "CLEARED", seal_verified: true },
      };
      dataStore.addBookingEvent(booking.id, newEvent);
      dataStore.updateBooking(booking.id, {
        status: "CUSTOMS_CLEARED",
        current_location: "Ruta 5 Norte (Arica -> Santiago, CL)",
      });
    } else if (!hasDelivered) {
      const newEvent: BookingEvent = {
        id: `ev-${Date.now()}`,
        booking_id: booking.id,
        event_type: "DELIVERED",
        occurred_at: new Date().toISOString(),
        country_code: "CL",
        city: "Santiago",
        description: "Mercancía entregada conforme en Centro de Distribución Santiago. Guía de recepción firmada.",
        source: "CARRIER_WEBMCP",
        metadata: { receiver: "ACME Minería Chile SpA", status: "DELIVERED" },
      };
      dataStore.addBookingEvent(booking.id, newEvent);
      dataStore.updateBooking(booking.id, {
        status: "DELIVERED",
        current_location: "Centro de Distribución Santiago, CL",
      });
    }

    loadTrackingData();
  };

  const handleResetTimeline = () => {
    dataStore.reset();
    loadTrackingData();
  };

  if (loading || !booking) {
    return (
      <div className="max-w-[1180px] mx-auto p-12 text-center text-text-muted font-mono text-sm">
        Cargando estado de tracking...
      </div>
    );
  }

  const MILESTONES = [
    { key: "CONFIRMED", label: "Reserva Confirmada", location: "Lima, PE" },
    { key: "PICKUP_SCHEDULED", label: "Recojo Programado", location: "Callao, PE" },
    { key: "PICKED_UP", label: "Carga Estibada", location: "Callao, PE" },
    { key: "IN_TRANSIT", label: "En Tránsito Carretera", location: "Panamericana Sur" },
    { key: "BORDER_PROCESSING", label: "Trámite Frontera MIC/DTA", location: "Tacna / Arica" },
    { key: "CUSTOMS_CLEARED", label: "Aduana Aprobada", location: "Arica, CL" },
    { key: "DELIVERED", label: "Entregado en Destino", location: "Santiago, CL" },
  ];

  return (
    <div className="max-w-[1180px] mx-auto p-4 md:p-6 lg:p-7">
      {/* Breadcrumb Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-line">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="w-9 h-9 rounded-pill border border-line bg-card flex items-center justify-center text-text-secondary hover:text-ink hover:border-brass transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-brass uppercase tracking-wider">
                Booking Tracking
              </span>
              <span className="text-line">•</span>
              <span className="font-mono text-xs text-text-secondary">
                {booking.provider_reference || "AND-BOOK-8821"}
              </span>
            </div>
            <h1 className="font-serif text-2xl font-bold text-ink tracking-tight">
              Seguimiento de Despacho Internacional FTL
            </h1>
          </div>
        </div>

        {/* Demo Mode Controls */}
        {isDemoMode && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleAdvanceEvent}
              className="bg-brass-light border border-brass-mid text-[#211500] hover:bg-brass-mid text-xs font-bold px-3 py-1.5 rounded-pill flex items-center gap-1.5 transition shadow-sm"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Simular Avance de Evento</span>
            </button>
            <button
              onClick={handleResetTimeline}
              className="bg-card border border-line text-text-secondary hover:text-ink text-xs font-semibold px-2.5 py-1.5 rounded-pill flex items-center gap-1 transition"
              title="Restablecer eventos de prueba"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Main Tracking & Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Shipment Card Status */}
          <div className="bg-card border border-line rounded-lg p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-line">
              <div>
                <div className="text-xs text-text-muted font-medium mb-0.5">Transportista Asignado</div>
                <div className="font-bold text-lg text-ink flex items-center gap-2">
                  <span>{booking.carrier_name || "Andes Freight S.A."}</span>
                  <span className="bg-emerald-50 text-emerald-700 text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                    SLA 96%
                  </span>
                </div>
              </div>

              <div className="sm:text-right">
                <div className="text-xs text-text-muted font-medium mb-0.5">Estado Operativo</div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-brass-light border border-brass-mid text-ink font-mono text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-brass-bright animate-pulse" />
                  <span>{booking.status}</span>
                </div>
              </div>
            </div>

            {/* Key Trip Parameters */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-canvas border border-line rounded p-2.5">
                <div className="text-text-muted mb-1">Ruta Corredor</div>
                <div className="font-bold text-ink">Lima (PE) → Santiago (CL)</div>
                <div className="text-[10px] text-text-secondary mt-0.5">3,300 km · Road FTL</div>
              </div>

              <div className="bg-canvas border border-line rounded p-2.5">
                <div className="text-text-muted mb-1">Unidad Scania</div>
                <div className="font-bold text-ink">{booking.vehicle_brand || "Scania"} R450</div>
                <div className="text-[10px] text-text-secondary mt-0.5">Semi-Trailer 18t (8,000 kg)</div>
              </div>

              <div className="bg-canvas border border-line rounded p-2.5">
                <div className="text-text-muted mb-1">Frecuencia / ETA</div>
                <div className="font-bold text-ink">48 horas</div>
                <div className="text-[10px] text-text-secondary mt-0.5">Entrega estimada nominal</div>
              </div>

              <div className="bg-canvas border border-line rounded p-2.5">
                <div className="text-text-muted mb-1">Tarifa FTL Cerrada</div>
                <div className="font-bold text-ink text-sm text-brass font-mono">
                  ${booking.price || booking.confirmed_price || 1760} USD
                </div>
                <div className="text-[10px] text-text-secondary mt-0.5">Aduana MIC/DTA Incluida</div>
              </div>
            </div>
          </div>

          {/* Milestone Stepper Visual */}
          <div className="bg-card border border-line rounded-lg p-5 shadow-sm">
            <h2 className="font-serif text-lg font-bold text-ink mb-4 flex items-center justify-between">
              <span>Hitos del Corredor Internacional</span>
              <span className="text-xs font-mono font-normal text-text-muted">
                Paso Fronterizo Santa Rosa / Chacalluta
              </span>
            </h2>

            {/* Milestone List */}
            <div className="relative pl-6 border-l-2 border-line space-y-6">
              {MILESTONES.map((m, idx) => {
                const eventFound = events.find((e) => e.event_type === m.key);
                const isPassed = !!eventFound;
                const isCurrent =
                  booking.status === m.key ||
                  (booking.status === "BORDER_PROCESSING" && m.key === "BORDER_PROCESSING");

                return (
                  <div key={m.key} className="relative group">
                    {/* Circle Node */}
                    <div
                      className={`absolute -left-[31px] top-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        isPassed
                          ? "bg-brass text-[#211500] border-brass"
                          : isCurrent
                          ? "bg-brass-bright border-brass animate-ping"
                          : "bg-canvas border-line text-text-muted"
                      }`}
                    >
                      {isPassed ? (
                        <Check className="w-3 h-3 stroke-[3]" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-text-muted" />
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                      <div className="font-bold text-sm text-ink flex items-center gap-2">
                        <span>{m.label}</span>
                        <span className="text-[11px] font-mono text-text-muted font-normal">
                          ({m.location})
                        </span>
                      </div>
                      {eventFound && (
                        <span className="text-[11px] font-mono text-text-secondary">
                          {new Date(eventFound.occurred_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>

                    {eventFound ? (
                      <p className="text-xs text-text-secondary mt-1 leading-relaxed bg-canvas p-2.5 rounded border border-line/60">
                        {eventFound.description}
                      </p>
                    ) : (
                      <p className="text-xs text-text-muted mt-0.5 italic">
                        Pendiente de validación por carrier en ruta.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Col: Live WebMCP Inspector & Operations */}
        <div className="space-y-6">
          {/* WebMCP Live Inspector */}
          <div className="bg-[#11100C] border border-[#2B261D] rounded-lg p-4 text-[#F3F1E9] shadow-xl">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#2B261D]">
              <div className="font-mono text-xs font-bold text-brass-mid flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Tool: get_booking_status</span>
              </div>
              <span className="text-[10px] text-[#928D79] font-mono">
                Real WebMCP Response
              </span>
            </div>
            <pre className="bg-[#090805] border border-[#242017] rounded p-2.5 font-mono text-[11px] leading-relaxed text-[#E6D0A6] overflow-x-auto max-h-[280px]">
              {JSON.stringify(trackingPayload || {}, null, 2)}
            </pre>
          </div>

          {/* Cross-border Customs Context Box */}
          <div className="bg-card border border-line rounded-lg p-4 text-xs space-y-3">
            <div className="font-bold text-ink flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-brass" />
              <span>Coordinación Aduanera y Documental</span>
            </div>
            <p className="text-text-secondary leading-relaxed">
              Andes Freight reporta vía WebMCP la gestión integral del manifiesto internacional <strong>MIC/DTA</strong> para el cruce Santa Rosa / Chacalluta.
            </p>
            <div className="bg-canvas p-2.5 rounded border border-line space-y-1.5 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-text-muted">Factura Comercial:</span>
                <span className="text-emerald-700 font-bold">Verificada</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Packing List:</span>
                <span className="text-emerald-700 font-bold">Adjunto (12 bultos)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Régimen Arancelario:</span>
                <span className="text-ink">Tránsito FTL Carretero</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <Link
              href={`/result/${booking.freight_request_id || "fr-1042"}`}
              className="w-full bg-card hover:bg-canvas border border-line text-ink text-xs font-semibold py-2.5 rounded-pill flex items-center justify-center gap-2 transition"
            >
              <FileText className="w-3.5 h-3.5 text-text-muted" />
              <span>Ver Decisión y Explicabilidad</span>
            </Link>

            <Link
              href="/"
              className="w-full bg-canvas hover:border-brass-mid text-text-secondary hover:text-ink text-xs font-semibold py-2 rounded-pill border border-line flex items-center justify-center transition"
            >
              Volver al Panel Principal
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TrackingPage({ params }: { params: { id: string } }) {
  return (
    <React.Suspense
      fallback={
        <div className="p-12 text-center text-xs text-text-muted font-mono">
          Cargando tracking del envío internacional...
        </div>
      }
    >
      <TrackingContent params={params} />
    </React.Suspense>
  );
}
