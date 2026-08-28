"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useDemoMode } from "@/features/demo/demo-context";
import {
  Compass,
  Package,
  Layers,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Check,
  Sliders,
  Calendar,
  AlertTriangle,
} from "lucide-react";

function NewFreightRequestForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isDemoMode } = useDemoMode();

  // Form State
  const [origin, setOrigin] = useState("Lima, Perú");
  const [destination, setDestination] = useState("Arequipa, Perú");
  const [transportMode, setTransportMode] = useState<"ROAD" | "AIR" | "SEA">("ROAD");
  const [category, setCategory] = useState("GENERAL");
  const [weightKg, setWeightKg] = useState(8000);
  const [volumeM3, setVolumeM3] = useState(18);
  const [packageCount, setPackageCount] = useState(12);

  // Requirements
  const [requiresRefrigeration, setRequiresRefrigeration] = useState(false);
  const [isFragile, setIsFragile] = useState(false);
  const [isHazardous, setIsHazardous] = useState(false);
  const [isOversized, setIsOversized] = useState(false);

  // Strategy & Budget
  const [strategy, setStrategy] = useState<"BALANCED" | "LOWEST_COST" | "MOST_RELIABLE" | "FASTEST">("BALANCED");
  const [budgetMax, setBudgetMax] = useState(850);
  const [maxPickupWaitHours, setMaxPickupWaitHours] = useState(2);

  // Preferences & Dates
  const [pickupDate, setPickupDate] = useState("2026-08-31T08:00");
  const [deadlineDate, setDeadlineDate] = useState("2026-09-02T18:00");
  const [preferredCarrier, setPreferredCarrier] = useState("none");
  const [preferredBrand, setPreferredBrand] = useState("");
  const [instructions, setInstructions] = useState(
    "Repuestos para perforadora minera en cajas de madera. Requiere montacargas estándar para estiba."
  );

  // Load URL params & Golden Flow Presets
  useEffect(() => {
    const originParam = searchParams.get("origin");
    const destParam = searchParams.get("destination");
    const weightParam = searchParams.get("weight");
    const catParam = searchParams.get("category");
    const presetParam = searchParams.get("preset");

    if (originParam) setOrigin(originParam);
    if (destParam) setDestination(destParam);
    if (weightParam) setWeightKg(Number(weightParam) || 8000);
    if (catParam) setCategory(catParam);

    if (presetParam === "golden1") {
      loadPreset("golden1");
    } else if (presetParam === "golden2") {
      loadPreset("golden2");
    }
  }, [searchParams]);

  const loadPreset = (preset: "golden1" | "golden2") => {
    if (preset === "golden1") {
      setOrigin("Lima, Perú");
      setDestination("Arequipa, Perú");
      setWeightKg(8000);
      setVolumeM3(18);
      setBudgetMax(850);
      setCategory("GENERAL");
      setStrategy("BALANCED");
      setPreferredBrand("");
      setInstructions(
        "Repuestos para perforadora minera en cajas de madera. Requiere montacargas estándar para estiba."
      );
    } else if (preset === "golden2") {
      setOrigin("Lima, Perú");
      setDestination("Arequipa, Perú");
      setWeightKg(8000);
      setVolumeM3(20);
      setBudgetMax(800);
      setCategory("MACHINERY");
      setStrategy("BALANCED");
      setPreferredBrand("Volvo");
      setInstructions(
        "Bomba hidráulica de alta precisión. Preferencia blanda por camión marca Volvo."
      );
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Navigate to live dispatch status
    router.push(`/dispatch/fr-1042?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&weight=${weightKg}&strategy=${strategy}&budget=${budgetMax}&brand=${encodeURIComponent(preferredBrand)}`);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header Breadcrumb */}
      <div className="px-7 pt-4 text-xs text-text-muted flex items-center gap-2">
        <Link href="/" className="hover:text-ink transition">
          Home
        </Link>
        <span>/</span>
        <span className="text-ink font-semibold">Nueva solicitud</span>
      </div>

      {/* Hero */}
      <div className="px-7">
        <h1 className="font-heading font-extrabold text-[26px] md:text-[30px] text-ink tracking-tight mb-1">
          Nueva solicitud de transporte
        </h1>
        <p className="text-sm text-text-secondary max-w-[700px] leading-relaxed">
          Expresa tu intención logística. El motor inteligente de CargoMesh descubre capacidades de transporte, valida restricciones duras y optimiza el flete según tus políticas empresariales.
        </p>
      </div>

      {/* Judge Mode Bar (Visible only when Demo Mode is ON) */}
      {isDemoMode && (
        <div className="mx-7 p-3.5 bg-brass-soft border border-brass-mid rounded-md flex items-center justify-between gap-4 flex-wrap animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-brass">
            <Sparkles className="w-4 h-4" />
            <span>Herramientas de Demostración (Judge Mode):</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => loadPreset("golden1")}
              className="bg-paper-raised hover:bg-brass-mid hover:text-[#211500] border border-brass text-ink text-xs font-semibold px-3 py-1.5 rounded-pill transition shadow-sm"
            >
              🌟 Precargar Golden Flow 1 (8t Lima→Arequipa)
            </button>
            <button
              type="button"
              onClick={() => loadPreset("golden2")}
              className="bg-paper-raised hover:bg-brass-mid hover:text-[#211500] border border-brass text-ink text-xs font-semibold px-3 py-1.5 rounded-pill transition shadow-sm"
            >
              ⚙️ Precargar Golden Flow 2 (Pref. Volvo)
            </button>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <form onSubmit={handleFormSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-7">
        {/* Left Column: 4 Steps */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          {/* Step 1: Corredor y Modo */}
          <div className="bg-paper-raised border border-line rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-line">
              <h2 className="font-heading font-bold text-base text-ink flex items-center gap-2">
                <Compass className="w-4 h-4 text-brass" />
                1. Corredor y Modo de Transporte
              </h2>
              <span className="font-mono text-[11px] bg-paper text-text-muted px-2.5 py-0.5 rounded-pill font-semibold">
                Paso 1 de 4
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-ink">Origen (Ciudad / Hub)</label>
                <input
                  type="text"
                  required
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  className="bg-paper border border-line rounded-sm px-3.5 py-2.5 text-sm font-semibold text-ink focus:bg-paper-raised focus:border-brass-mid outline-none transition"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-ink">Destino (Ciudad / Hub)</label>
                <input
                  type="text"
                  required
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="bg-paper border border-line rounded-sm px-3.5 py-2.5 text-sm font-semibold text-ink focus:bg-paper-raised focus:border-brass-mid outline-none transition"
                />
              </div>
            </div>

            <label className="text-xs font-bold text-ink block mb-2">Modo de transporte</label>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                className="flex-1 min-w-[130px] p-2.5 rounded-md border text-xs font-bold flex items-center justify-center gap-2 transition bg-brass-soft border-brass-mid text-brass"
              >
                <span>ROAD (Carretera FTL)</span>
              </button>
              <button
                type="button"
                disabled
                className="flex-1 min-w-[100px] p-2.5 rounded-md border border-line bg-paper text-xs font-semibold text-text-muted flex items-center justify-between gap-1 opacity-60 cursor-not-allowed"
              >
                <span>AIR</span>
                <span className="text-[9px] font-bold uppercase bg-line px-1.5 py-0.5 rounded">Futuro</span>
              </button>
              <button
                type="button"
                disabled
                className="flex-1 min-w-[100px] p-2.5 rounded-md border border-line bg-paper text-xs font-semibold text-text-muted flex items-center justify-between gap-1 opacity-60 cursor-not-allowed"
              >
                <span>SEA</span>
                <span className="text-[9px] font-bold uppercase bg-line px-1.5 py-0.5 rounded">Futuro</span>
              </button>
            </div>
          </div>

          {/* Step 2: Carga y Restricciones */}
          <div className="bg-paper-raised border border-line rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-line">
              <h2 className="font-heading font-bold text-base text-ink flex items-center gap-2">
                <Package className="w-4 h-4 text-brass" />
                2. Especificaciones de la Carga
              </h2>
              <span className="font-mono text-[11px] bg-paper text-text-muted px-2.5 py-0.5 rounded-pill font-semibold">
                Paso 2 de 4
              </span>
            </div>

            <label className="text-xs font-bold text-ink block mb-2">
              Categoría de carga (Catálogo controlado)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
              {[
                { id: "GENERAL", label: "General" },
                { id: "FOOD", label: "Alimentos" },
                { id: "MACHINERY", label: "Maquinaria" },
                { id: "CONSTRUCTION", label: "Construcción" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`p-3 rounded-md border text-center text-xs font-bold transition flex flex-col items-center gap-1.5 ${
                    category === cat.id
                      ? "bg-brass-soft border-brass-mid text-ink"
                      : "bg-paper border-line text-text-secondary hover:border-brass"
                  }`}
                >
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-ink">Peso total (kg)</label>
                <input
                  type="number"
                  required
                  value={weightKg}
                  onChange={(e) => setWeightKg(Number(e.target.value))}
                  className="bg-paper border border-line rounded-sm px-3.5 py-2 text-sm font-semibold text-ink focus:bg-paper-raised focus:border-brass-mid outline-none transition"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-ink">Volumen (m³)</label>
                <input
                  type="number"
                  value={volumeM3}
                  onChange={(e) => setVolumeM3(Number(e.target.value))}
                  className="bg-paper border border-line rounded-sm px-3.5 py-2 text-sm font-semibold text-ink focus:bg-paper-raised focus:border-brass-mid outline-none transition"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-ink">Bultos / Pallets</label>
                <input
                  type="number"
                  value={packageCount}
                  onChange={(e) => setPackageCount(Number(e.target.value))}
                  className="bg-paper border border-line rounded-sm px-3.5 py-2 text-sm font-semibold text-ink focus:bg-paper-raised focus:border-brass-mid outline-none transition"
                />
              </div>
            </div>

            <label className="text-xs font-bold text-ink block mb-2">
              Requisitos logísticos especiales (Hard constraints)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {[
                {
                  id: "refrig",
                  label: "Requiere refrigeración",
                  val: requiresRefrigeration,
                  set: setRequiresRefrigeration,
                },
                {
                  id: "fragile",
                  label: "Manejo de carga frágil",
                  val: isFragile,
                  set: setIsFragile,
                },
                {
                  id: "hazmat",
                  label: "Mercancía peligrosa (HAZMAT)",
                  val: isHazardous,
                  set: setIsHazardous,
                },
                {
                  id: "oversized",
                  label: "Carga sobredimensionada",
                  val: isOversized,
                  set: setIsOversized,
                },
              ].map((item) => (
                <label
                  key={item.id}
                  className={`p-3 rounded-md border text-xs font-semibold flex items-center justify-between cursor-pointer transition select-none ${
                    item.val
                      ? "bg-paper-raised border-brass-mid text-ink font-bold"
                      : "bg-paper border-line text-text-secondary"
                  }`}
                >
                  <span>{item.label}</span>
                  <input
                    type="checkbox"
                    checked={item.val}
                    onChange={(e) => item.set(e.target.checked)}
                    className="accent-brass-mid w-4 h-4 cursor-pointer"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Step 3: Política de Optimización (Exact Balanced 100%) */}
          <div className="bg-paper-raised border border-line rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-line">
              <h2 className="font-heading font-bold text-base text-ink flex items-center gap-2">
                <Sliders className="w-4 h-4 text-brass" />
                3. Política de Optimización y Presupuesto
              </h2>
              <span className="font-mono text-[11px] bg-paper text-text-muted px-2.5 py-0.5 rounded-pill font-semibold">
                Paso 3 de 4
              </span>
            </div>

            <label className="text-xs font-bold text-ink block mb-2">
              Estrategia heurística de decisión (Fórmula 100% ponderada)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {[
                {
                  id: "BALANCED",
                  title: "Balanced (Recomendada)",
                  badge: "Default",
                  desc: "25% Costo, 25% Confiabilidad SLA, 20% ETA, 10% Flota, 10% Experiencia, 10% Historial.",
                },
                {
                  id: "LOWEST_COST",
                  title: "Lowest Cost",
                  desc: "50% Peso en precio. Maximiza ahorro admitiendo variabilidad en tiempos.",
                },
                {
                  id: "MOST_RELIABLE",
                  title: "Most Reliable",
                  desc: "45% Confiabilidad histórica (>96% on-time). Prioriza carriers de primer nivel.",
                },
                {
                  id: "FASTEST",
                  title: "Fastest Delivery",
                  desc: "45% Tiempo de llegada (SLA). Minimiza horas de tránsito y espera.",
                },
              ].map((s) => (
                <div
                  key={s.id}
                  onClick={() => setStrategy(s.id as any)}
                  className={`p-3.5 rounded-md border-[1.5px] cursor-pointer transition flex flex-col gap-1 ${
                    strategy === s.id
                      ? "bg-brass-soft border-brass-mid"
                      : "bg-paper border-line hover:border-brass"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-ink">{s.title}</span>
                    {s.badge && (
                      <span className="text-[10px] font-mono font-bold bg-brass-bright text-[#211500] px-1.5 py-0.2 rounded-pill uppercase">
                        {s.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-text-secondary leading-snug">{s.desc}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-ink">Presupuesto máximo techo ($ USD)</label>
                <input
                  type="number"
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(Number(e.target.value))}
                  className="bg-paper border border-line rounded-sm px-3.5 py-2 text-sm font-semibold text-ink focus:bg-paper-raised focus:border-brass-mid outline-none transition"
                />
                <span className="text-[11px] text-text-muted">Rango usual ACME: $700 – $850 USD</span>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-ink">Tiempo máx. espera recojo</label>
                <select
                  value={maxPickupWaitHours}
                  onChange={(e) => setMaxPickupWaitHours(Number(e.target.value))}
                  className="bg-paper border border-line rounded-sm px-3.5 py-2 text-sm font-semibold text-ink focus:bg-paper-raised focus:border-brass-mid outline-none transition cursor-pointer"
                >
                  <option value={2}>Máximo 2 horas</option>
                  <option value={4}>Máximo 4 horas</option>
                  <option value={8}>Mismo día</option>
                </select>
              </div>
            </div>
          </div>

          {/* Step 4: Preferencias Opcionales */}
          <div className="bg-paper-raised border border-line rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-line">
              <h2 className="font-heading font-bold text-base text-ink flex items-center gap-2">
                <Calendar className="w-4 h-4 text-brass" />
                4. Programación y Preferencias Opcionales
              </h2>
              <span className="font-mono text-[11px] bg-paper text-text-muted px-2.5 py-0.5 rounded-pill font-semibold">
                Paso 4 de 4
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-ink">Fecha de recojo requerida</label>
                <input
                  type="datetime-local"
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  className="bg-paper border border-line rounded-sm px-3.5 py-2 text-xs font-semibold text-ink focus:bg-paper-raised focus:border-brass-mid outline-none transition"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-ink">Deadline de entrega límite</label>
                <input
                  type="datetime-local"
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                  className="bg-paper border border-line rounded-sm px-3.5 py-2 text-xs font-semibold text-ink focus:bg-paper-raised focus:border-brass-mid outline-none transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-ink">Preferencia de transportista</label>
                <select
                  value={preferredCarrier}
                  onChange={(e) => setPreferredCarrier(e.target.value)}
                  className="bg-paper border border-line rounded-sm px-3.5 py-2 text-xs font-semibold text-ink focus:bg-paper-raised focus:border-brass-mid outline-none transition cursor-pointer"
                >
                  <option value="none">Sin preferencia (Cualquiera calificado)</option>
                  <option value="car-andes">Andes Freight (96% SLA)</option>
                  <option value="car-inca">Inca Logistics (98% SLA)</option>
                  <option value="car-pacific">Pacific Cargo ($690 Low Cost)</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-ink flex justify-between">
                  <span>Preferencia de marca de camión</span>
                  <span className="text-[10px] text-text-muted">Soft preference</span>
                </label>
                <input
                  type="text"
                  value={preferredBrand}
                  onChange={(e) => setPreferredBrand(e.target.value)}
                  placeholder="Ej: Volvo, Scania (opcional)"
                  className="bg-paper border border-line rounded-sm px-3.5 py-2 text-xs font-semibold text-ink focus:bg-paper-raised focus:border-brass-mid outline-none transition"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-ink">Instrucciones operativas para el transportista</label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={2}
                className="bg-paper border border-line rounded-sm p-3 text-xs font-medium text-ink focus:bg-paper-raised focus:border-brass-mid outline-none transition resize-none"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Resumen Sticky & Acción de Despacho */}
        <div className="lg:sticky lg:top-[90px] flex flex-col gap-4 self-start">
          <div className="bg-paper-raised border-[1.5px] border-line rounded-lg p-6 shadow-md">
            <div className="flex justify-between items-center pb-3 mb-4 border-b border-line">
              <h3 className="font-heading font-bold text-base text-ink">Resumen de Intención</h3>
              <span className="font-mono text-xs font-bold text-brass">FR-1042</span>
            </div>

            <div className="flex flex-col gap-3 mb-5 pb-4 border-b border-line text-xs">
              <div className="flex justify-between">
                <span className="text-text-muted">Ruta</span>
                <strong className="text-ink">{origin} → {destination}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Carga / Modo</span>
                <strong className="text-ink">{weightKg.toLocaleString()} kg (FTL Road)</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Categoría</span>
                <strong className="text-ink">{category}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Estrategia</span>
                <strong className="font-mono text-brass">{strategy}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Techo Presupuesto</span>
                <strong className="font-mono text-brass">${budgetMax} USD</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Auto-Booking</span>
                <strong className="text-green font-bold">Habilitado (&ge;85% conf.)</strong>
              </div>
            </div>

            <div className="bg-paper border border-line rounded-md p-3 mb-5 text-xs text-text-secondary leading-relaxed flex gap-2.5">
              <Sparkles className="w-4 h-4 text-brass flex-shrink-0 mt-0.5" />
              <div>
                {isDemoMode ? (
                  <span>
                    <strong>Orquestación WebMCP:</strong> El agente consultará las herramientas expuestas por Andes, Pacific e Inca (<code className="text-brass">check_service_coverage</code>, <code className="text-brass">check_capacity</code>, <code className="text-brass">quote_freight</code>) en tiempo real.
                  </span>
                ) : (
                  <span>
                    <strong>Orquestación Autónoma:</strong> El agente evaluará la red de transportistas calificados y ejecutará la reserva si la confianza supera el 85%.
                  </span>
                )}
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-brass-mid hover:bg-brass-bright text-[#211500] font-extrabold text-[14.5px] py-3.5 rounded-pill flex items-center justify-center gap-2 transition transform active:scale-95 shadow-sm mb-2.5"
            >
              <span>Despachar con Agente</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>

            <button
              type="button"
              onClick={() => alert("Borrador guardado localmente en tu cuenta.")}
              className="w-full bg-transparent hover:border-brass-mid text-text-secondary hover:text-ink text-xs font-semibold py-2 rounded-pill border border-line transition"
            >
              Guardar borrador
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function NewFreightRequestPage() {
  return (
    <React.Suspense
      fallback={
        <div className="p-12 text-center text-xs text-text-muted font-mono">
          Cargando formulario de solicitud...
        </div>
      }
    >
      <NewFreightRequestForm />
    </React.Suspense>
  );
}
