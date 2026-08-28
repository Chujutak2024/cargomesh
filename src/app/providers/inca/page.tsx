"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Truck, Sparkles, ArrowRight } from "lucide-react";
import { initWebMCPPolyfill } from "@/webmcp/polyfill";

export default function IncaProviderPage() {
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const modelContext = initWebMCPPolyfill();

      modelContext.registerTool({
        name: "inca_check_service_coverage",
        description: "Verifica cobertura nacional para Inca Logistics",
        inputSchema: { type: "object", properties: { origin: { type: "string" }, destination: { type: "string" } } },
        execute: async () => ({
          carrier: "Inca Logistics Corp",
          corridors: ["Nacional Perú FTL"],
          mode: "ROAD",
        }),
      });

      modelContext.registerTool({
        name: "inca_check_capacity",
        description: "Verifica flota Volvo FH 24t de Inca Logistics",
        inputSchema: { type: "object", properties: { weight_kg: { type: "number" } } },
        execute: async () => ({
          carrier: "Inca Logistics Corp",
          units_available: 3,
          vehicle_model: "Volvo FH Globetrotter (24t)",
        }),
      });

      modelContext.registerTool({
        name: "inca_quote_freight",
        description: "Cotización premium de Inca Logistics ($820 USD)",
        inputSchema: { type: "object", properties: { request_id: { type: "string" } } },
        execute: async () => ({
          carrier: "Inca Logistics Corp",
          rate_usd: 820,
          transit_hours: 14,
          sla_on_time: 0.98,
        }),
      });

      setRegistered(true);
    }
  }, []);

  return (
    <div className="flex flex-col gap-6 px-7 pt-6">
      <div className="text-xs text-text-muted flex items-center gap-2">
        <Link href="/" className="hover:text-ink transition">
          Home
        </Link>
        <span>/</span>
        <span className="text-ink font-semibold">Inca Logistics WebMCP</span>
      </div>

      <div className="bg-paper-raised border border-line rounded-lg p-6 shadow-md">
        <div className="flex items-center justify-between gap-4 flex-wrap pb-4 mb-4 border-b border-line">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-md bg-ink text-paper flex items-center justify-center">
              <Truck className="w-6 h-6 text-brass-bright" />
            </div>
            <div>
              <h1 className="font-heading font-extrabold text-2xl text-ink">
                Inca Logistics Corp
              </h1>
              <p className="text-xs text-text-secondary">
                Operador Enterprise Corporativo · Flota Pesada Volvo FH
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green animate-pulse" />
            <span className="font-mono text-xs font-bold text-green">
              {registered ? "WebMCP Tools Activas (4)" : "Registrando..."}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-paper rounded-md border border-line mb-6 text-xs">
          <div>
            <span className="text-text-muted block uppercase text-[10.5px] font-bold">
              Tarifa Corredor
            </span>
            <strong className="font-mono text-base text-ink">$820 USD</strong>
          </div>
          <div>
            <span className="text-text-muted block uppercase text-[10.5px] font-bold">
              Confiabilidad Histórica (SLA)
            </span>
            <strong className="font-mono text-base text-green">98% On-Time</strong>
          </div>
          <div>
            <span className="text-text-muted block uppercase text-[10.5px] font-bold">
              Flota Activa
            </span>
            <strong className="font-mono text-base text-ink">3 Unidades Volvo FH</strong>
          </div>
          <div>
            <span className="text-text-muted block uppercase text-[10.5px] font-bold">
              Demora Promedio
            </span>
            <strong className="font-mono text-base text-ink">0.8 Horas</strong>
          </div>
        </div>

        <div className="flex justify-end">
          <Link
            href="/freight-request/new?preset=golden2"
            className="bg-brass-mid hover:bg-brass-bright text-[#211500] font-bold text-xs px-5 py-2.5 rounded-pill flex items-center gap-2 transition"
          >
            <span>Probar Solicitud con Preferencia Volvo (Golden Flow 2)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
