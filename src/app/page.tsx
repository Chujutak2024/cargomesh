"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDemoMode } from "@/features/demo/demo-context";
import {
  Plus,
  Play,
  CheckCircle2,
  AlertCircle,
  Truck,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const { isDemoMode } = useDemoMode();

  const [origin, setOrigin] = useState("Lima, Perú");
  const [destination, setDestination] = useState("Arequipa, Perú");
  const [weight, setWeight] = useState("8,000 kg");
  const [category, setCategory] = useState("GENERAL");
  const [requirements, setRequirements] = useState<string[]>([]);
  const [isSimulatingEmpty, setIsSimulatingEmpty] = useState(false);

  const toggleReq = (req: string) => {
    setRequirements((prev) =>
      prev.includes(req) ? prev.filter((r) => r !== req) : [...prev, req]
    );
  };

  const handleCreateRequest = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(
      `/freight-request/new?origin=${encodeURIComponent(
        origin
      )}&destination=${encodeURIComponent(
        destination
      )}&weight=${encodeURIComponent(weight)}&category=${category}`
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Golden Flows Bar (Visible only when Demo Mode is ON) */}
      {isDemoMode && (
        <div className="px-7 pt-4 flex items-center gap-2.5 overflow-x-auto animate-in fade-in duration-200">
          <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider whitespace-nowrap">
            Flujos de Demostración:
          </span>
          <Link
            href="/freight-request/new?preset=golden1"
            className="bg-paper-raised hover:bg-brass-soft border border-line hover:border-brass-mid text-ink hover:text-brass text-xs font-semibold px-3 py-1.5 rounded-pill flex items-center gap-1.5 whitespace-nowrap transition shadow-sm"
          >
            <span>🌟 Golden Flow 1: Auto-Booking (8t Lima→Arequipa)</span>
          </Link>
          <Link
            href="/freight-request/new?preset=golden2"
            className="bg-paper-raised hover:bg-brass-soft border border-line hover:border-brass-mid text-ink hover:text-brass text-xs font-semibold px-3 py-1.5 rounded-pill flex items-center gap-1.5 whitespace-nowrap transition shadow-sm"
          >
            <span>⚙️ Golden Flow 2: Preferencia de Marca (Volvo)</span>
          </Link>
          <Link
            href="/exceptions"
            className="bg-paper-raised hover:bg-red-50 border border-line hover:border-red-300 text-ink hover:text-red-700 text-xs font-semibold px-3 py-1.5 rounded-pill flex items-center gap-1.5 whitespace-nowrap transition shadow-sm"
          >
            <span>🚨 Golden Flow 3: Avería en Ruta (Supervisor)</span>
          </Link>
        </div>
      )}

      {/* Hero Section */}
      <section className="px-7 pt-6 pb-2">
        <h1 className="font-heading font-extrabold text-[28px] md:text-[32px] text-ink tracking-tight mb-1">
          Hola, ACME Mining
        </h1>
        <p className="text-[14.5px] text-text-secondary max-w-[700px] leading-relaxed mb-5">
          Expresa tu necesidad logística. El agente de CargoMesh descubre transportistas vía WebMCP, valida restricciones y resuelve el flete de forma autónoma y explicable.
        </p>

        {/* Intent Creation Card (Expresar Necesidad) */}
        <form
          onSubmit={handleCreateRequest}
          className="bg-paper-raised border-[1.5px] border-line rounded-lg p-5 shadow-sm"
        >
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5 items-end mb-4">
            <div className="flex flex-col gap-1 md:col-span-1">
              <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Origen
              </label>
              <input
                type="text"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                className="bg-paper border border-line rounded-sm px-3 py-2 text-sm font-semibold text-ink focus:bg-paper-raised focus:border-brass-mid outline-none transition"
              />
            </div>

            <div className="flex flex-col gap-1 md:col-span-1">
              <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Destino
              </label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="¿A dónde va tu carga?"
                className="bg-paper border border-line rounded-sm px-3 py-2 text-sm font-semibold text-ink focus:bg-paper-raised focus:border-brass-mid outline-none transition"
              />
            </div>

            <div className="flex flex-col gap-1 md:col-span-1">
              <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Peso Total
              </label>
              <input
                type="text"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="bg-paper border border-line rounded-sm px-3 py-2 text-sm font-semibold text-ink focus:bg-paper-raised focus:border-brass-mid outline-none transition"
              />
            </div>

            <div className="flex flex-col gap-1 md:col-span-1">
              <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Tipo de Carga
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="bg-paper border border-line rounded-sm px-3 py-2 text-sm font-semibold text-ink focus:bg-paper-raised focus:border-brass-mid outline-none transition cursor-pointer"
              >
                <option value="GENERAL">General (Pallets / Cajas)</option>
                <option value="FOOD">Alimentos / Perecibles</option>
                <option value="MACHINERY">Maquinaria / Minería</option>
                <option value="CONSTRUCTION">Construcción</option>
                <option value="CHEMICALS">Químicos / HAZMAT</option>
              </select>
            </div>

            <div className="md:col-span-1">
              <button
                type="submit"
                className="w-full bg-ink hover:bg-[#322D22] text-paper font-bold text-[14px] h-[40px] px-5 rounded-pill flex items-center justify-center gap-2 transition transform active:scale-95 shadow-sm"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Crear solicitud</span>
              </button>
            </div>
          </div>

          {/* Row 2: Requisitos Rápidos (Flags Booleanos de BD) */}
          <div className="flex items-center gap-3 pt-3.5 border-t border-line flex-wrap">
            <span className="text-[11.5px] font-bold text-text-secondary uppercase tracking-wider">
              Requisitos Rápidos:
            </span>
            <div className="flex gap-2 flex-wrap">
              {[
                { id: "refrig", label: "Refrigerado" },
                { id: "hazmat", label: "Peligroso (HAZMAT)" },
                { id: "oversized", label: "Sobredimensionado" },
                { id: "urgent", label: "Urgente (<24h)" },
              ].map((req) => {
                const active = requirements.includes(req.id);
                return (
                  <button
                    key={req.id}
                    type="button"
                    onClick={() => toggleReq(req.id)}
                    className={`px-3 py-1 rounded-pill text-xs font-semibold border transition ${
                      active
                        ? "bg-brass-soft border-brass-mid text-brass font-bold"
                        : "bg-paper border-line text-text-secondary hover:border-brass"
                    }`}
                  >
                    {active ? "✓ " : "+ "}
                    {req.label}
                  </button>
                );
              })}
            </div>
          </div>
        </form>
      </section>

      {/* Main Two Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-7">
        {/* Left Column: Corredores Frecuentes */}
        <div className="md:col-span-2 flex flex-col gap-3">
          <h2 className="font-heading font-bold text-[17px] text-ink">
            Tus corredores frecuentes
          </h2>
          <div className="flex flex-col gap-2.5">
            {[
              {
                route: "Lima → Arequipa",
                meta: "12 envíos completados · Andes Freight (96% SLA)",
                price: "$760 USD",
                params: "origin=Lima%2C%20Per%C3%BA&destination=Arequipa%2C%20Per%C3%BA&weight=8000",
              },
              {
                route: "Lima → Trujillo",
                meta: "5 envíos completados · Inca Logistics (98% SLA)",
                price: "$540 USD",
                params: "origin=Lima%2C%20Per%C3%BA&destination=Trujillo%2C%20Per%C3%BA&weight=5000",
              },
              {
                route: "Callao → Cusco",
                meta: "3 envíos completados · Pacific Cargo ($690 USD)",
                price: "$910 USD",
                params: "origin=Callao%2C%20Per%C3%BA&destination=Cusco%2C%20Per%C3%BA&weight=12000",
              },
            ].map((c, i) => (
              <div
                key={i}
                className="bg-paper-raised border border-line rounded-md p-4 flex items-center justify-between gap-4 shadow-sm"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-full bg-paper flex items-center justify-center text-brass flex-shrink-0">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-[14.5px] text-ink">
                      {c.route}
                    </div>
                    <div className="text-xs text-text-muted">{c.meta}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold text-text-secondary">
                    {c.price}
                  </span>
                  <Link
                    href={`/freight-request/new?${c.params}`}
                    className="border border-line hover:border-brass-mid text-ink hover:text-brass text-xs font-semibold px-3 py-1.5 rounded-pill transition"
                  >
                    Repetir solicitud
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Envíos en Curso */}
        <aside className="bg-paper-raised border border-line rounded-lg p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-line">
            <h2 className="font-heading font-bold text-[16px] text-ink">
              Envíos en curso
            </h2>
            <button
              type="button"
              onClick={() => setIsSimulatingEmpty(!isSimulatingEmpty)}
              className="text-[11px] font-mono text-text-muted hover:text-ink bg-paper border border-line rounded-pill px-2.5 py-0.5"
            >
              {isSimulatingEmpty ? "Ver activos" : "Simular vacío"}
            </button>
          </div>

          {!isSimulatingEmpty ? (
            <div className="flex flex-col gap-3">
              <div className="border border-line rounded-md p-3.5 bg-paper">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="font-mono text-xs font-bold text-brass">
                    FR-1042
                  </span>
                  <span className="font-mono text-[10.5px] font-bold px-2 py-0.5 rounded-pill bg-green-bg text-green">
                    EN RUTA
                  </span>
                </div>
                <div className="font-bold text-[13.5px] text-ink mb-0.5">
                  Lima → Arequipa
                </div>
                <div className="text-xs text-text-secondary mb-2.5">
                  Andes Freight · Scania R450 · ETA 18:00
                </div>
                <div className="h-1.5 bg-line rounded-pill overflow-hidden">
                  <div className="h-full bg-green rounded-pill w-[65%]" />
                </div>
              </div>

              <div className="border border-line rounded-md p-3.5 bg-paper">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="font-mono text-xs font-bold text-brass">
                    FR-1039
                  </span>
                  <span className="font-mono text-[10.5px] font-bold px-2 py-0.5 rounded-pill bg-green-bg text-green">
                    CONFIRMADO
                  </span>
                </div>
                <div className="font-bold text-[13.5px] text-ink mb-0.5">
                  Lima → Trujillo
                </div>
                <div className="text-xs text-text-secondary mb-2.5">
                  Inca Logistics · Recojo en 2 horas
                </div>
                <div className="h-1.5 bg-line rounded-pill overflow-hidden">
                  <div className="h-full bg-green rounded-pill w-[25%]" />
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="font-bold text-sm text-ink mb-1">
                No tienes envíos en camino
              </div>
              <p className="text-xs text-text-muted mb-4">
                Cuando reserves una carga, la verás aquí en tiempo real.
              </p>
              <Link
                href="/freight-request/new"
                className="bg-brass-mid hover:bg-brass-bright text-[#211500] font-bold text-xs px-4 py-2 rounded-pill inline-flex items-center gap-1.5 transition shadow-sm"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Crear primera carga</span>
              </Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
