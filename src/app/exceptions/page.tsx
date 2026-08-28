"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useDemoMode } from "@/features/demo/demo-context";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  Info,
} from "lucide-react";

export default function SupervisorExceptionsPage() {
  const { isDemoMode, openHowItWorks } = useDemoMode();
  const [filter, setFilter] = useState<"all" | "anomaly" | "disruption" | "confidence">("all");
  const [resolvedCards, setResolvedCards] = useState<Record<string, string>>({});

  const resolveCard = (id: string, message: string) => {
    setResolvedCards((prev) => ({ ...prev, [id]: message }));
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <div className="px-7 pt-4 text-xs text-text-muted flex items-center gap-2">
        <Link href="/" className="hover:text-ink transition">
          Home
        </Link>
        <span>/</span>
        <span className="text-ink font-semibold">Bandeja de excepciones</span>
      </div>

      {/* Hero */}
      <div className="px-7 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading font-extrabold text-[26px] md:text-[30px] text-ink tracking-tight flex items-center gap-2 mb-1">
            <AlertTriangle className="w-6 h-6 text-brass" />
            <span>Bandeja de Excepciones Logísticas</span>
          </h1>
          <p className="text-sm text-text-secondary max-w-[700px] leading-relaxed">
            Supervisión Humana en el Bucle (<em>Human-in-the-Loop</em>). Las operaciones rutinarias se despachan de forma autónoma (&ge;85% de confianza); solo las decisiones ambiguas, de riesgo o anomalías de precio llegan a esta bandeja.
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-300 text-amber-900 px-3.5 py-1.5 rounded-pill text-xs font-bold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span>Supervisión Activa (P1)</span>
        </div>
      </div>

      {/* Philosophy & Benchmark Banner (Sección 4.5) */}
      <div className="mx-7 bg-paper-raised border border-line rounded-lg p-4 flex items-center justify-between gap-4 flex-wrap shadow-sm text-xs text-text-secondary">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green" />
          <span>
            Autonomía de despacho proyectada: <strong className="font-mono text-sm text-green">94%</strong>
          </span>
          <span className="text-[10px] text-text-muted bg-paper px-1.5 py-0.5 rounded border border-line">
            Benchmark
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-brass" />
          <span>
            Tiempo prom. resolución: <strong className="font-mono text-sm text-ink">3.8 min</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-600" />
          <span>
            Excepciones activas: <strong className="font-mono text-sm text-ink">{3 - Object.keys(resolvedCards).length} pendientes</strong>
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-7 flex gap-2 overflow-x-auto">
        {[
          { id: "all", label: "Todas las excepciones", count: 3 },
          { id: "anomaly", label: "Anomalías de Precio", count: 1 },
          { id: "disruption", label: "Averías en Ruta", count: 1 },
          { id: "confidence", label: "Baja Confianza / Empate", count: 1 },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id as any)}
            className={`px-4 py-2 rounded-pill text-xs font-semibold border flex items-center gap-2 transition whitespace-nowrap ${
              filter === tab.id
                ? "bg-ink border-ink text-paper"
                : "bg-paper-raised border-line text-text-secondary hover:border-brass"
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`font-mono text-[10.5px] px-1.5 py-0.2 rounded-pill ${
                filter === tab.id ? "bg-paper/20 text-white" : "bg-paper text-ink"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Exception Cards */}
      <div className="px-7 flex flex-col gap-4">
        {/* Card 1: Anomalía de Precio */}
        {(filter === "all" || filter === "anomaly") && (
          <div
            className={`bg-paper-raised border-[1.5px] rounded-lg p-6 shadow-sm transition-all ${
              resolvedCards["exc-1"]
                ? "opacity-60 border-line bg-paper/50"
                : "border-amber-400/80"
            }`}
          >
            {resolvedCards["exc-1"] ? (
              <div className="p-4 text-center text-green font-bold text-sm flex items-center justify-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                <span>✓ {resolvedCards["exc-1"]}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-start pb-3 mb-3 border-b border-line">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-sm text-ink">FR-1045</span>
                    <span className="font-mono text-[10.5px] font-bold px-2.5 py-0.5 rounded-pill bg-amber-100 text-amber-900 uppercase">
                      Alerta de Precio (+38%)
                    </span>
                  </div>
                  <span className="text-xs text-text-muted">Detectado hace 8 min</span>
                </div>

                <div className="font-heading font-bold text-base text-ink mb-1">
                  Lima, PE → Cusco, PE
                </div>
                <div className="text-xs text-text-secondary mb-3">
                  Cliente: <strong>ACME Mining</strong> · 12,000 kg (Maquinaria) · Política: Balanced
                </div>

                <div className="bg-paper border-l-4 border-amber-500 rounded-r p-3.5 text-xs text-ink mb-4 leading-relaxed">
                  <div className="font-bold mb-1">Motivo del Escalamiento: Desviación Atípica de Tarifa</div>
                  La mejor cotización válida recibida ($1,150 USD de Inca Logistics) supera en <strong>+38.2%</strong> el costo promedio histórico del corredor ($832 USD). La política empresarial prohíbe el auto-booking si la desviación es &gt;30%.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  <div className="p-3.5 bg-paper border border-brass-mid rounded-md flex flex-col gap-1 text-xs">
                    <div className="flex justify-between font-bold text-ink">
                      <span>Inca Logistics (Opción #1)</span>
                      <span className="font-mono">$1,150 USD</span>
                    </div>
                    <p className="text-text-secondary text-[11.5px]">
                      98% SLA · Flota Volvo FH 24t disponible de inmediato · Llega mañana 14:00
                    </p>
                  </div>

                  <div className="p-3.5 bg-paper border border-line rounded-md flex flex-col gap-1 text-xs">
                    <div className="flex justify-between font-bold text-ink">
                      <span>Pacific Cargo (Opción #2)</span>
                      <span className="font-mono">$920 USD</span>
                    </div>
                    <p className="text-text-secondary text-[11.5px]">
                      86% SLA · Requiere esperar 24h para disponibilidad de unidad adecuada.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-3 border-t border-line flex-wrap">
                  <div className="flex gap-2.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() =>
                        resolveCard(
                          "exc-1",
                          "Aprobado sobreprecio con Inca Logistics ($1,150 USD)"
                        )
                      }
                      className="bg-green hover:bg-[#32573B] text-white font-bold text-xs px-4 py-2 rounded-pill transition flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Autorizar Sobreprecio ($1,150)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        resolveCard(
                          "exc-1",
                          "Programado con Pacific Cargo con espera de 24h ($920 USD)"
                        )
                      }
                      className="bg-ink hover:bg-[#322D22] text-paper font-bold text-xs px-4 py-2 rounded-pill transition"
                    >
                      Esperar 24h por Pacific ($920)
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      resolveCard(
                        "exc-1",
                        "Solicitud cancelada para renegociación con proveedores."
                      )
                    }
                    className="bg-transparent hover:border-red-400 text-text-secondary hover:text-red-600 font-semibold text-xs px-3.5 py-1.5 rounded-pill border border-line transition"
                  >
                    Cancelar y Renegociar
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Card 2: Avería en Ruta / Disrupción */}
        {(filter === "all" || filter === "disruption") && (
          <div
            className={`bg-paper-raised border-[1.5px] rounded-lg p-6 shadow-sm transition-all ${
              resolvedCards["exc-2"]
                ? "opacity-60 border-line bg-paper/50"
                : "border-red-400/80"
            }`}
          >
            {resolvedCards["exc-2"] ? (
              <div className="p-4 text-center text-green font-bold text-sm flex items-center justify-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                <span>✓ {resolvedCards["exc-2"]}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-start pb-3 mb-3 border-b border-line">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-sm text-ink">
                      FR-1044 (AND-BOOK-8820)
                    </span>
                    <span className="font-mono text-[10.5px] font-bold px-2.5 py-0.5 rounded-pill bg-red-100 text-red-900 uppercase">
                      Avería en Tránsito
                    </span>
                  </div>
                  <span className="text-xs text-text-muted">Detectado hace 3 min</span>
                </div>

                <div className="font-heading font-bold text-base text-ink mb-1">
                  Lima, PE → Arequipa, PE
                </div>
                <div className="text-xs text-text-secondary mb-3">
                  Transportista original: <strong>Andes Freight ($760 USD)</strong> · Unidad: Scania AND-TRK-102
                </div>

                <div className="bg-paper border-l-4 border-red-500 rounded-r p-3.5 text-xs text-ink mb-4 leading-relaxed">
                  <div className="font-bold mb-1">Incidente de Telemetría: Falla Mecánica en el Kilómetro 142</div>
                  El vehículo original reportó parada total por avería de motor. El agente consultó reemplazos inmediatos vía WebMCP y encontró capacidad de rescate con Inca Logistics ($820 USD, delta +$60).
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  <div className="p-3.5 bg-paper border border-green rounded-md flex flex-col gap-1 text-xs">
                    <div className="flex justify-between font-bold text-ink">
                      <span>Inca Logistics (Reemplazo Inmediato)</span>
                      <span className="font-mono">$820 USD (+$60)</span>
                    </div>
                    <p className="text-text-secondary text-[11.5px]">
                      98% SLA · Camión de rescate a 20 km de distancia · Mantiene el deadline original.
                    </p>
                  </div>

                  <div className="p-3.5 bg-paper border border-line rounded-md flex flex-col gap-1 text-xs">
                    <div className="flex justify-between font-bold text-ink">
                      <span>Esperar grúa de Andes Freight</span>
                      <span className="font-mono">$760 USD ($0)</span>
                    </div>
                    <p className="text-text-secondary text-[11.5px]">
                      Demora estimada de 6 a 8 horas. Riesgo de incumplir el deadline de entrega.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-3 border-t border-line flex-wrap">
                  <button
                    type="button"
                    onClick={() =>
                      resolveCard(
                        "exc-2",
                        "Re-despacho de rescate confirmado con Inca Logistics."
                      )
                    }
                    className="bg-green hover:bg-[#32573B] text-white font-bold text-xs px-4 py-2 rounded-pill transition flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirmar Reasignación Inca (+$60)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      resolveCard(
                        "exc-2",
                        "Esperando auxilio mecánico y grúa de Andes Freight."
                      )
                    }
                    className="bg-transparent hover:border-red-400 text-text-secondary hover:text-red-600 font-semibold text-xs px-3.5 py-1.5 rounded-pill border border-line transition"
                  >
                    Mantener Andes Freight
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Card 3: Baja Confianza / Empate */}
        {(filter === "all" || filter === "confidence") && (
          <div
            className={`bg-paper-raised border-[1.5px] rounded-lg p-6 shadow-sm transition-all ${
              resolvedCards["exc-3"]
                ? "opacity-60 border-line bg-paper/50"
                : "border-line"
            }`}
          >
            {resolvedCards["exc-3"] ? (
              <div className="p-4 text-center text-green font-bold text-sm flex items-center justify-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                <span>✓ {resolvedCards["exc-3"]}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-start pb-3 mb-3 border-b border-line">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-sm text-ink">FR-1046</span>
                    <span className="font-mono text-[10.5px] font-bold px-2.5 py-0.5 rounded-pill bg-brass-soft text-brass uppercase">
                      Baja Confianza (76%)
                    </span>
                  </div>
                  <span className="text-xs text-text-muted">Detectado hace 14 min</span>
                </div>

                <div className="font-heading font-bold text-base text-ink mb-1">
                  Callao, PE → Arequipa, PE
                </div>
                <div className="text-xs text-text-secondary mb-3">
                  Cliente: <strong>ACME Mining</strong> · 8,000 kg (General) · Política: Balanced
                </div>

                <div className="bg-paper border-l-4 border-brass-mid rounded-r p-3.5 text-xs text-ink mb-4 leading-relaxed">
                  <div className="font-bold mb-1">Motivo: Empate Técnico entre los 2 Mejores Candidatos (Delta &lt; 2 pts)</div>
                  Andes Freight (Score: 81 pts) e Inca Logistics (Score: 80 pts) presentan puntuaciones prácticamente idénticas. La confianza calculada es 76% (inferior al umbral de 85% para auto-book). El agente solicita desempate al supervisor.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  <div className="p-3.5 bg-paper border border-brass-mid rounded-md flex flex-col gap-1 text-xs">
                    <div className="flex justify-between font-bold text-ink">
                      <span>Andes Freight (81 pts)</span>
                      <span className="font-mono">$780 USD</span>
                    </div>
                    <p className="text-text-secondary text-[11.5px]">
                      Tarifa más competitiva ($780 vs $820), 96% de confiabilidad histórica.
                    </p>
                  </div>

                  <div className="p-3.5 bg-paper border border-line rounded-md flex flex-col gap-1 text-xs">
                    <div className="flex justify-between font-bold text-ink">
                      <span>Inca Logistics (80 pts)</span>
                      <span className="font-mono">$820 USD</span>
                    </div>
                    <p className="text-text-secondary text-[11.5px]">
                      98% SLA · Flota Volvo preferida con mayor confiabilidad.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 pt-3 border-t border-line flex-wrap">
                  <button
                    type="button"
                    onClick={() =>
                      resolveCard(
                        "exc-3",
                        "Desempatado a favor de Andes Freight ($780 USD)"
                      )
                    }
                    className="bg-green hover:bg-[#32573B] text-white font-bold text-xs px-4 py-2 rounded-pill transition"
                  >
                    Elegir Andes Freight ($780)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      resolveCard(
                        "exc-3",
                        "Desempatado a favor de Inca Logistics ($820 USD)"
                      )
                    }
                    className="bg-ink hover:bg-[#322D22] text-paper font-bold text-xs px-4 py-2 rounded-pill transition"
                  >
                    Elegir Inca Logistics ($820)
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
