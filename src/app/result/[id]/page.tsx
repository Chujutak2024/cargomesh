"use client";

import React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Truck,
  Sparkles,
  ArrowRight,
  Printer,
  Info,
  Layers,
  ChevronRight,
} from "lucide-react";

export default function ResultExplainabilityPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <div className="px-7 pt-4 text-xs text-text-muted flex items-center gap-2">
        <Link href="/" className="hover:text-ink transition">
          Home
        </Link>
        <span>/</span>
        <Link href="/freight-request/new" className="hover:text-ink transition">
          {params.id || "FR-1042"}
        </Link>
        <span>/</span>
        <span className="text-ink font-semibold">Asignación confirmada</span>
      </div>

      {/* Hero */}
      <div className="px-7 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="font-heading font-extrabold text-[26px] md:text-[30px] text-ink tracking-tight">
              Transporte asignado con éxito
            </h1>
            <span className="font-mono text-base text-brass font-bold">
              {params.id || "FR-1042"}
            </span>
          </div>
          <p className="text-sm text-text-secondary max-w-[650px] leading-relaxed">
            El agente autónomo descubrió capacidades, aplicó la política <strong>Balanced</strong> y ejecutó la reserva vinculante con el transportista óptimo.
          </p>
        </div>

        <div className="bg-paper-raised border border-line px-4 py-2 rounded-pill text-xs font-semibold text-ink flex items-center gap-2.5 shadow-sm">
          <span>Lima (PE) → Santiago (CL)</span>
          <span>•</span>
          <span>8,000 kg (ROAD FTL Internacional)</span>
          <span>•</span>
          <span className="font-mono text-brass bg-brass-soft px-2 py-0.5 rounded-pill text-[11.5px]">
            Balanced
          </span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-7 items-start">
        {/* Left Column: Winner Card & Explainability */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          {/* Winner Card */}
          <div className="bg-paper-raised border-2 border-brass-mid rounded-lg p-6 shadow-md relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-brass-mid text-[#211500] font-mono font-bold text-[11px] px-4 py-1.5 rounded-bl-md uppercase tracking-wider">
              ★ Ganador Heurístico (Score: 89 / Confianza: 91%)
            </div>

            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-md bg-ink text-paper flex items-center justify-center flex-shrink-0">
                <Truck className="w-7 h-7 text-brass-bright" />
              </div>
              <div>
                <h2 className="font-heading font-extrabold text-xl text-ink">
                  Andes Freight S.A.
                </h2>
                <p className="text-xs text-text-secondary">
                  Operador internacional certificado · Especialista en corredor Lima–Santiago con gestión MIC/DTA
                </p>
              </div>
            </div>

            {/* 4 Key Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-paper rounded-md border border-line mb-5">
              <div className="flex flex-col">
                <span className="text-[10.5px] font-bold text-text-muted uppercase">
                  Tarifa Cerrada
                </span>
                <span className="font-mono text-base font-bold text-brass">
                  $1,760 USD
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10.5px] font-bold text-text-muted uppercase">
                  Cumplimiento SLA
                </span>
                <span className="font-mono text-base font-bold text-green">
                  96% On-Time
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10.5px] font-bold text-text-muted uppercase">
                  Tiempo Tránsito
                </span>
                <span className="font-mono text-base font-bold text-ink">
                  48 horas
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10.5px] font-bold text-text-muted uppercase">
                  Paso Fronterizo
                </span>
                <span className="font-mono text-base font-bold text-ink">
                  Santa Rosa / Chacalluta
                </span>
              </div>
            </div>

            {/* Booking Details Row (No driver name) */}
            <div className="flex items-center justify-between pt-4 border-t border-line text-xs text-text-secondary flex-wrap gap-2">
              <div>
                <span>Unidad reportada por carrier: </span>
                <strong className="text-ink">Scania R450 Heavy Semi-Trailer (18t)</strong>
              </div>
              <div>
                <span>Referencia de reserva: </span>
                <span className="font-mono font-bold bg-paper border border-line px-2 py-0.5 rounded-pill text-ink">
                  AND-BOOK-8821
                </span>
              </div>
            </div>
          </div>

          {/* Explainability Panel */}
          <div className="bg-paper-raised border border-line rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-line">
              <h3 className="font-heading font-bold text-base text-ink flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brass" />
                ¿Por qué seleccionamos a Andes Freight? (Explicabilidad Heurística)
              </h3>
              <span className="font-mono text-xs font-bold text-green">
                96% Fiabilidad Histórica
              </span>
            </div>

            <div className="flex flex-col gap-3 mb-5">
              {[
                {
                  bold: "96% de entregas exitosas a tiempo",
                  text: "en el corredor internacional Lima ↔ Santiago sobre 42 tránsitos completados, con demora promedio mínima de 1.2 horas.",
                },
                {
                  bold: "Coordinación aduanera MIC/DTA incluida:",
                  text: "Andes Freight gestiona la transmisión del manifiesto internacional y acompañamiento documental en frontera Santa Rosa / Chacalluta.",
                },
                {
                  bold: "Dentro de tu presupuesto corporativo:",
                  text: "La cotización de $1,760 USD está por debajo del presupuesto máximo de $2,000 USD fijado por ACME Mining.",
                },
                {
                  bold: "Disponibilidad y flota lista:",
                  text: "Unidad Scania R450 disponible de inmediato en terminal Callao para recojo dentro de la ventana requerida.",
                },
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs text-ink leading-relaxed">
                  <div className="w-5 h-5 rounded-full bg-green-bg text-green font-bold flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px]">
                    ✓
                  </div>
                  <div>
                    <strong>{item.bold}</strong> {item.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Counterfactual Explanation Box */}
            <div className="bg-paper border-l-4 border-brass-mid rounded-r-md p-4 text-xs text-text-secondary leading-relaxed">
              <div className="font-bold text-ink mb-1 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-brass" />
                Análisis Contrafactual de la Decisión
              </div>
              Si hubieras seleccionado la política <em>"Lowest Cost"</em>, Pacific Cargo habría ganado por $1,590 USD, pero con un historial de demora en frontera 2.2 horas superior (86% SLA). Bajo tu política <em>Balanced</em>, Andes Freight ofrece la mejor relación costo-confiabilidad.
            </div>
          </div>

          {/* Candidate Comparison Matrix */}
          <div className="bg-paper-raised border border-line rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-line">
              <h3 className="font-heading font-bold text-base text-ink flex items-center gap-2">
                <Layers className="w-4 h-4 text-brass" />
                Matriz de Candidatos Evaluados (WebMCP)
              </h3>
              <span className="font-mono text-xs text-text-muted">
                3 Proveedores Descubiertos
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Winner: Andes */}
              <div className="border-[1.5px] border-brass-mid bg-brass-soft rounded-md p-4 flex flex-col gap-2.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-xs text-ink">Andes Freight</span>
                  <span className="font-mono text-[10.5px] font-bold bg-brass-mid text-[#211500] px-2 py-0.5 rounded-pill">
                    #1 Ganador
                  </span>
                </div>
                <div className="font-mono font-extrabold text-lg text-ink">89 pts</div>
                <div className="flex flex-col gap-1 text-[11px] text-text-secondary">
                  <div className="flex justify-between">
                    <span>Cotización:</span>
                    <strong className="text-ink">$1,760 USD</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Confiabilidad:</span>
                    <strong className="text-green">96% SLA</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Demora prom:</span>
                    <strong className="text-ink">1.2 horas</strong>
                  </div>
                </div>
                <div className="text-[10.5px] text-text-secondary pt-2 border-t border-line leading-tight">
                  Balance óptimo de flete internacional, SLA y gestión MIC/DTA.
                </div>
              </div>

              {/* Rank 2: Inca */}
              <div className="border border-line bg-paper rounded-md p-4 flex flex-col gap-2.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-xs text-ink">Inca Logistics</span>
                  <span className="font-mono text-[10.5px] font-bold bg-line text-text-secondary px-2 py-0.5 rounded-pill">
                    #2 Candidato
                  </span>
                </div>
                <div className="font-mono font-extrabold text-lg text-ink">84 pts</div>
                <div className="flex flex-col gap-1 text-[11px] text-text-secondary">
                  <div className="flex justify-between">
                    <span>Cotización:</span>
                    <strong className="text-ink">$1,920 USD</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Confiabilidad:</span>
                    <strong className="text-green">98% SLA</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Demora prom:</span>
                    <strong className="text-ink">0.8 horas</strong>
                  </div>
                </div>
                <div className="text-[10.5px] text-text-secondary pt-2 border-t border-line leading-tight">
                  Tarifa premium ($1,920) sin valor diferencial para carga general.
                </div>
              </div>

              {/* Rank 3: Pacific */}
              <div className="border border-line bg-paper rounded-md p-4 flex flex-col gap-2.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-xs text-ink">Pacific Cargo</span>
                  <span className="font-mono text-[10.5px] font-bold bg-line text-text-secondary px-2 py-0.5 rounded-pill">
                    #3 Candidato
                  </span>
                </div>
                <div className="font-mono font-extrabold text-lg text-ink">72 pts</div>
                <div className="flex flex-col gap-1 text-[11px] text-text-secondary">
                  <div className="flex justify-between">
                    <span>Cotización:</span>
                    <strong className="text-ink">$1,590 USD</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Confiabilidad:</span>
                    <strong className="text-brass">86% SLA</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Demora prom:</span>
                    <strong className="text-ink">3.4 horas</strong>
                  </div>
                </div>
                <div className="text-[10.5px] text-text-secondary pt-2 border-t border-line leading-tight">
                  Precio más bajo pero penalizado por mayor demora en frontera.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Actions & Booking Details */}
        <div className="lg:sticky lg:top-[90px] flex flex-col gap-4 self-start">
          <div className="bg-paper-raised border-[1.5px] border-line rounded-lg p-6 shadow-md">
            <h3 className="font-heading font-bold text-base text-ink mb-4">
              Próximos Pasos
            </h3>

            <Link
              href={`/tracking/${params.id || "80000000-0000-0000-0000-000000000001"}`}
              className="w-full bg-brass-mid hover:bg-brass-bright text-[#211500] font-extrabold text-sm py-3.5 rounded-pill flex items-center justify-center gap-2 transition transform active:scale-95 shadow-sm mb-2.5 text-center"
            >
              <span>Ver Tracking del Envío</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/"
              className="w-full bg-transparent hover:border-brass-mid text-text-secondary hover:text-ink text-xs font-semibold py-2.5 rounded-pill border border-line transition mb-2 flex items-center justify-center text-center"
            >
              Volver al Home (Ver en curso)
            </Link>

            <button
              type="button"
              onClick={() => window.print()}
              className="w-full bg-transparent hover:border-brass-mid text-text-secondary hover:text-ink text-xs font-semibold py-2.5 rounded-pill border border-line transition flex items-center justify-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir confirmación de reserva</span>
            </button>

            <div className="mt-4 p-3.5 bg-paper border border-line rounded-md text-xs">
              <div className="flex justify-between items-center font-bold text-ink mb-2">
                <span>Estado de Reserva</span>
                <span className="font-mono text-green text-[11px]">CONFIRMED</span>
              </div>
              <div className="flex flex-col gap-1 text-[11px] text-text-secondary">
                <div>
                  Carrier: <strong className="text-ink">Andes Freight S.A.</strong>
                </div>
                <div>
                  Booking Ref: <strong className="text-ink">AND-BOOK-8821</strong>
                </div>
                <div>
                  Corredor: <strong className="text-ink">Lima (PE) → Santiago (CL)</strong>
                </div>
                <div>
                  Unidad: <strong className="text-ink">Scania R450 Heavy (18t)</strong>
                </div>
                <div>
                  Recojo: <strong className="text-ink">Mañana, 08:00 – 10:00 AM</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
