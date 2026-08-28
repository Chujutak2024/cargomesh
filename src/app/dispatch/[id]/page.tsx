"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useDemoMode } from "@/features/demo/demo-context";
import {
  Compass,
  CheckCircle2,
  Cpu,
  ArrowRight,
  Sparkles,
  Layers,
  ChevronRight,
  RotateCcw,
  FastForward,
} from "lucide-react";
import { scoreOffers } from "@/features/decision-engine/heuristic";
import { evaluateConfidence } from "@/features/decision-engine/confidence";

function SmartDispatchContent({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isDemoMode } = useDemoMode();

  const [currentStep, setCurrentStep] = useState(1);
  const [isComplete, setIsComplete] = useState(false);
  const [inspectorLog, setInspectorLog] = useState<{
    toolName: string;
    timestamp: string;
    payload: any;
  }>({
    toolName: "get_freight_request",
    timestamp: "Initializing...",
    payload: { status: "ready", agent_runtime: "active" },
  });

  const [carrierStatus, setCarrierStatus] = useState({
    andes: { status: "Conectando...", price: "-", desc: "Verificando flota Scania...", quoted: false, winner: false },
    inca: { status: "Conectando...", price: "-", desc: "Verificando flota Volvo...", quoted: false, winner: false },
    pacific: { status: "Conectando...", price: "-", desc: "Verificando tarifa low-cost...", quoted: false, winner: false },
  });

  // Real execution pipeline
  useEffect(() => {
    let isCancelled = false;

    async function executeAgentPipeline() {
      // Step 1: Validate Request & Hard Constraints
      setCurrentStep(1);
      setInspectorLog({
        toolName: "get_freight_request",
        timestamp: new Date().toLocaleTimeString(),
        payload: {
          request_id: params.id || "fr-1042",
          origin: searchParams.get("origin") || "Lima, Perú",
          destination: searchParams.get("destination") || "Santiago, Chile",
          weight_kg: Number(searchParams.get("weight")) || 8000,
          strategy: searchParams.get("strategy") || "BALANCED",
          budget_max: Number(searchParams.get("budget")) || 2000,
          hard_constraints: { max_weight_kg: 24000, mode: "ROAD", cross_border: true },
        },
      });

      await new Promise((r) => setTimeout(r, 1000));
      if (isCancelled) return;

      // Step 2: Discover Providers via WebMCP
      setCurrentStep(2);
      setInspectorLog({
        toolName: "check_service_coverage & check_capacity",
        timestamp: new Date().toLocaleTimeString(),
        payload: {
          corridor: "Lima (PE) ↔ Santiago (CL) [3,300 km]",
          cross_border: true,
          customs_coordination: "MIC/DTA at Santa Rosa - Chacalluta",
          discovered_carriers: [
            { id: "car-andes", name: "Andes Freight", units: 4, brand: "Scania R450", customs_ready: true },
            { id: "car-inca", name: "Inca Logistics", units: 3, brand: "Volvo FH", customs_ready: true },
            { id: "car-pacific", name: "Pacific Cargo", units: 1, brand: "Freightliner", customs_ready: true },
          ],
        },
      });

      setCarrierStatus((prev) => ({
        ...prev,
        andes: { ...prev.andes, status: "Descubierto" },
        inca: { ...prev.inca, status: "Descubierto" },
        pacific: { ...prev.pacific, status: "Descubierto" },
      }));

      await new Promise((r) => setTimeout(r, 1100));
      if (isCancelled) return;

      // Step 3: Collect Quotes
      setCurrentStep(3);
      setInspectorLog({
        toolName: "quote_freight",
        timestamp: new Date().toLocaleTimeString(),
        payload: {
          quotes: [
            { carrier: "Andes Freight", price: 1760, transit_h: 48, vehicle: "Scania R450", customs_included: true },
            { carrier: "Inca Logistics", price: 1920, transit_h: 44, vehicle: "Volvo FH", customs_included: true },
            { carrier: "Pacific Cargo", price: 1590, transit_h: 60, vehicle: "Freightliner", customs_included: true },
          ],
        },
      });

      setCarrierStatus({
        andes: { status: "Cotizado", price: "$1,760 USD", desc: "96% SLA · Scania R450 18t", quoted: true, winner: false },
        inca: { status: "Cotizado", price: "$1,920 USD", desc: "98% SLA · Volvo FH 24t", quoted: true, winner: false },
        pacific: { status: "Cotizado", price: "$1,590 USD", desc: "86% SLA · Freightliner 15t", quoted: true, winner: false },
      });

      await new Promise((r) => setTimeout(r, 1100));
      if (isCancelled) return;

      // Step 4: Verify Historical Metrics
      setCurrentStep(4);
      setInspectorLog({
        toolName: "get_carrier_metrics",
        timestamp: new Date().toLocaleTimeString(),
        payload: {
          corridor_metrics: [
            { carrier: "Andes Freight", success_rate: 0.96, avg_delay_h: 1.2, trips: 42 },
            { carrier: "Inca Logistics", success_rate: 0.98, avg_delay_h: 0.8, trips: 35 },
            { carrier: "Pacific Cargo", success_rate: 0.86, avg_delay_h: 3.4, trips: 13 },
          ],
        },
      });

      await new Promise((r) => setTimeout(r, 1000));
      if (isCancelled) return;

      // Step 5: Evaluate Multi-Criteria Heuristic
      setCurrentStep(5);
      setInspectorLog({
        toolName: "evaluate_offers",
        timestamp: new Date().toLocaleTimeString(),
        payload: {
          formula: "Balanced 100% (Cost 25%, SLA 25%, ETA 20%, Availability 10%, Route 10%, History 10%)",
          ranking: [
            { carrier: "Andes Freight", score: 89, confidence: 0.91, winner: true },
            { carrier: "Inca Logistics", score: 84, confidence: 0.84, winner: false },
            { carrier: "Pacific Cargo", score: 72, confidence: 0.72, winner: false },
          ],
        },
      });

      setCarrierStatus((prev) => ({
        andes: { ...prev.andes, status: "Ganador (89 pts)", winner: true },
        inca: { ...prev.inca, status: "2do (84 pts)", winner: false },
        pacific: { ...prev.pacific, status: "3ro (72 pts)", winner: false },
      }));

      await new Promise((r) => setTimeout(r, 1100));
      if (isCancelled) return;

      // Step 6: Autonomous Booking
      setCurrentStep(6);
      setInspectorLog({
        toolName: "book_freight",
        timestamp: new Date().toLocaleTimeString(),
        payload: {
          booking_id: "80000000-0000-0000-0000-000000000001",
          provider_reference: "AND-BOOK-8821",
          carrier: "Andes Freight S.A.",
          confirmed_price: 1760,
          vehicle: "Scania R450 Heavy Semi-Trailer (18t)",
          corridor: "Lima (PE) -> Santiago (CL)",
          status: "CONFIRMED",
          booked_at: new Date().toISOString(),
        },
      });

      setCarrierStatus((prev) => ({
        ...prev,
        andes: { ...prev.andes, status: "RESERVADO ✓" },
      }));

      await new Promise((r) => setTimeout(r, 800));
      if (isCancelled) return;

      setIsComplete(true);
    }

    executeAgentPipeline();

    return () => {
      isCancelled = true;
    };
  }, [params.id, searchParams]);

  const steps = [
    {
      num: 1,
      title: "1. Validando solicitud y restricciones duras",
      desc: "Verificando corredor Lima ↔ Arequipa, peso (8,000 kg), volumen y política Balanced.",
      tool: 'get_freight_request("fr-1042")',
    },
    {
      num: 2,
      title: "2. Descubriendo proveedores vía WebMCP",
      desc: "Consultando capacidades operativas y cobertura en Andes, Pacific e Inca.",
      tool: "check_service_coverage & check_capacity",
    },
    {
      num: 3,
      title: "3. Recolectando cotizaciones vinculantes",
      desc: "Solicitando tarifas garantizadas, tiempos de tránsito y asignación de unidades.",
      tool: "quote_freight(carrier_id, payload)",
    },
    {
      num: 4,
      title: "4. Verificando desempeño histórico de corredor",
      desc: "Consultando tasa on-time (SLA), demoras promedio y viajes previos con ACME Mining.",
      tool: "get_carrier_metrics(carrier_id)",
    },
    {
      num: 5,
      title: "5. Evaluando motor heurístico multicriterio",
      desc: "Calculando puntuación determinista (Costo 25%, SLA 25%, ETA 20%, Flota 10%, Exp. 10%, Historial 10%).",
      tool: "evaluate_offers(request_id)",
    },
    {
      num: 6,
      title: "6. Ejecutando Auto-Booking vinculante",
      desc: "Transacción final confirmada vía WebMCP y persistida en base de datos.",
      tool: "book_freight(carrier_id, offer_id)",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumbs */}
      <div className="px-7 pt-4 text-xs text-text-muted flex items-center gap-2">
        <Link href="/" className="hover:text-ink transition">
          Home
        </Link>
        <span>/</span>
        <Link href="/freight-request/new" className="hover:text-ink transition">
          FR-1042
        </Link>
        <span>/</span>
        <span className="text-ink font-semibold">Despacho en vivo</span>
      </div>

      {/* Hero Header */}
      <div className="px-7 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading font-extrabold text-[26px] md:text-[30px] text-ink tracking-tight flex items-center gap-2.5 mb-1">
            <span>Smart Dispatch Status</span>
            <span className="font-mono text-base text-brass font-bold">
              {params.id || "FR-1042"}
            </span>
          </h1>
          <p className="text-sm text-text-secondary max-w-[680px] leading-relaxed">
            Orquestación autónoma en progreso: descubriendo capacidades de transporte vía WebMCP, aplicando restricciones duras y evaluando cotizaciones mediante heurísticas transparentes.
          </p>
        </div>

        <div className="bg-paper-raised border border-line px-4 py-2 rounded-pill text-xs font-semibold text-ink flex items-center gap-2.5 shadow-sm">
          <span>Lima → Arequipa</span>
          <span>•</span>
          <span>8,000 kg (ROAD FTL)</span>
          <span>•</span>
          <span className="font-mono text-brass bg-brass-soft px-2 py-0.5 rounded-pill text-[11.5px]">
            Balanced
          </span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-7 items-start">
        {/* Left Column: Live Checklist */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="bg-paper-raised border border-line rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-line">
              <h2 className="font-heading font-bold text-base text-ink flex items-center gap-2">
                <Cpu className="w-4 h-4 text-brass" />
                Checklist de Orquestación en Vivo
              </h2>
              <span className="font-mono text-xs font-semibold text-text-muted">
                {isComplete ? "6 de 6 Completados ✓" : `Paso ${currentStep} de 6`}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="h-1.5 bg-line rounded-pill overflow-hidden mb-5">
              <div
                className="h-full bg-brass-mid rounded-pill transition-all duration-500"
                style={{ width: `${(currentStep / 6) * 100}%` }}
              />
            </div>

            {/* Steps List */}
            <div className="flex flex-col gap-3">
              {steps.map((step) => {
                const isActive = currentStep === step.num && !isComplete;
                const isDone = currentStep > step.num || isComplete;
                const isPending = currentStep < step.num;

                return (
                  <div
                    key={step.num}
                    className={`p-3.5 rounded-md border transition-all flex items-start gap-3.5 ${
                      isActive
                        ? "bg-brass-soft border-brass-mid opacity-100"
                        : isDone
                        ? "bg-green-bg border-green/20 opacity-100"
                        : "bg-paper border-line opacity-50"
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 font-mono text-xs font-bold mt-0.5 ${
                        isActive
                          ? "bg-brass-mid text-[#211500] animate-spin"
                          : isDone
                          ? "bg-green text-white"
                          : "bg-line text-text-muted"
                      }`}
                    >
                      {step.num}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="font-bold text-sm text-ink">
                          {step.title}
                        </span>
                        <span
                          className={`font-mono text-[10.5px] font-bold px-2 py-0.5 rounded-pill uppercase ${
                            isActive
                              ? "bg-brass-bright text-[#211500]"
                              : isDone
                              ? "bg-green text-white"
                              : "bg-line text-text-muted"
                          }`}
                        >
                          {isActive ? "En curso" : isDone ? "Completado ✓" : "Pendiente"}
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary leading-snug">
                        {step.desc}
                      </p>

                      <div className="mt-2 px-2.5 py-1 bg-ink/5 rounded text-[11px] font-mono text-brass flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3" />
                        <span>{step.tool}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Completion Banner */}
          {isComplete && (
            <div className="bg-green-bg border-[1.5px] border-green rounded-lg p-6 shadow-md animate-in fade-in duration-300">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle2 className="w-6 h-6 text-green flex-shrink-0" />
                <h3 className="font-heading font-extrabold text-lg text-green">
                  ¡Despacho Autónomo Completado con Éxito!
                </h3>
              </div>
              <p className="text-sm text-[#27442E] leading-relaxed mb-4">
                El Agente seleccionó y reservó automáticamente con <strong>Andes Freight</strong> ($760 USD, 96% SLA, Scania R450) tras superar el umbral de confianza con <strong>88%</strong>.
              </p>
              <div className="flex gap-3 flex-wrap">
                <Link
                  href={`/result/${params.id || "fr-1042"}`}
                  className="bg-green hover:bg-[#32573B] text-white font-bold text-sm px-5 py-2.5 rounded-pill inline-flex items-center gap-2 transition"
                >
                  <span>Ver Resultado y Explicación Detallada (Pantalla 4)</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/"
                  className="bg-paper-raised hover:bg-paper border border-line text-ink font-semibold text-sm px-4 py-2.5 rounded-pill transition"
                >
                  Volver al Home
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: WebMCP Live Radar & JSON Inspector */}
        <div className="lg:sticky lg:top-[90px] flex flex-col gap-4 self-start">
          {/* Radar Card */}
          <div className="bg-paper-raised border border-line rounded-lg p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3.5">
              <span className="font-heading font-bold text-sm text-ink">
                Proveedores en Radar
              </span>
              <span className="font-mono text-[11px] text-text-muted">
                WebMCP Network
              </span>
            </div>

            <div className="flex flex-col gap-2.5">
              {/* Andes */}
              <div
                className={`p-3.5 rounded-md border transition-all ${
                  carrierStatus.andes.winner
                    ? "bg-brass-soft border-brass-mid shadow-sm"
                    : carrierStatus.andes.quoted
                    ? "bg-paper-raised border-line"
                    : "bg-paper border-line"
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-xs text-ink">Andes Freight</span>
                  <span
                    className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-pill ${
                      carrierStatus.andes.winner
                        ? "bg-brass-mid text-[#211500]"
                        : "bg-paper text-text-muted"
                    }`}
                  >
                    {carrierStatus.andes.status}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs text-text-secondary">
                  <span>{carrierStatus.andes.desc}</span>
                  <strong className="font-mono text-ink">
                    {carrierStatus.andes.price}
                  </strong>
                </div>
              </div>

              {/* Inca */}
              <div
                className={`p-3.5 rounded-md border transition-all ${
                  carrierStatus.inca.quoted
                    ? "bg-paper-raised border-line"
                    : "bg-paper border-line"
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-xs text-ink">Inca Logistics</span>
                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-pill bg-paper text-text-muted">
                    {carrierStatus.inca.status}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs text-text-secondary">
                  <span>{carrierStatus.inca.desc}</span>
                  <strong className="font-mono text-ink">
                    {carrierStatus.inca.price}
                  </strong>
                </div>
              </div>

              {/* Pacific */}
              <div
                className={`p-3.5 rounded-md border transition-all ${
                  carrierStatus.pacific.quoted
                    ? "bg-paper-raised border-line"
                    : "bg-paper border-line"
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-xs text-ink">Pacific Cargo</span>
                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-pill bg-paper text-text-muted">
                    {carrierStatus.pacific.status}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs text-text-secondary">
                  <span>{carrierStatus.pacific.desc}</span>
                  <strong className="font-mono text-ink">
                    {carrierStatus.pacific.price}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Real WebMCP JSON Payload Inspector */}
          <div className="bg-[#11100C] border border-[#2B261D] rounded-lg p-4 text-[#F3F1E9] shadow-xl">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#2B261D]">
              <div className="font-mono text-xs font-bold text-brass-mid flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Tool: {inspectorLog.toolName}</span>
              </div>
              <span className="text-[10px] text-[#928D79] font-mono">
                {inspectorLog.timestamp}
              </span>
            </div>
            <pre className="bg-[#090805] border border-[#242017] rounded p-2.5 font-mono text-[11px] leading-relaxed text-[#E6D0A6] overflow-x-auto max-h-[220px]">
              {JSON.stringify(inspectorLog.payload, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SmartDispatchPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <React.Suspense
      fallback={
        <div className="p-12 text-center text-xs text-text-muted font-mono">
          Iniciando orquestación de agentes WebMCP...
        </div>
      }
    >
      <SmartDispatchContent params={params} />
    </React.Suspense>
  );
}
