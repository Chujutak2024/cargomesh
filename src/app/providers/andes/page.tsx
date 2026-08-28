"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Truck, Sparkles, ArrowRight } from "lucide-react";
import { initWebMCPPolyfill } from "@/webmcp/polyfill";

export default function AndesProviderPage() {
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const modelContext = initWebMCPPolyfill();

      // Register Andes tools with standard WebMCP schema
      modelContext.registerTool({
        name: "andes_check_service_coverage",
        description: "Verifica cobertura de flete terrestre para Andes Freight",
        inputSchema: {
          type: "object",
          properties: {
            origin: { type: "string" },
            destination: { type: "string" },
          },
        },
        execute: async () => ({
          carrier: "Andes Freight S.A.",
          corridors: ["Lima ↔ Arequipa", "Lima ↔ Cusco", "Lima ↔ Ica"],
          mode: "ROAD",
          status: "AVAILABLE",
        }),
      });

      modelContext.registerTool({
        name: "andes_check_capacity",
        description: "Verifica disponibilidad de flota activa de Andes Freight",
        inputSchema: {
          type: "object",
          properties: {
            weight_kg: { type: "number" },
          },
        },
        execute: async () => ({
          carrier: "Andes Freight S.A.",
          units_available: 4,
          vehicle_model: "Scania R450 Heavy Semi-Trailer (18t)",
          depot: "Terminal Lima Norte",
        }),
      });

      modelContext.registerTool({
        name: "andes_quote_freight",
        description: "Genera cotización vinculante para Andes Freight",
        inputSchema: {
          type: "object",
          properties: {
            request_id: { type: "string" },
          },
        },
        execute: async () => ({
          carrier: "Andes Freight S.A.",
          rate_usd: 760,
          transit_hours: 16,
          sla_on_time: 0.96,
          validity_minutes: 60,
        }),
      });

      modelContext.registerTool({
        name: "andes_book_freight",
        description: "Ejecuta reserva vinculante con Andes Freight",
        inputSchema: {
          type: "object",
          properties: {
            offer_id: { type: "string" },
          },
        },
        execute: async () => ({
          booking_id: "bk-andes-8821",
          carrier: "Andes Freight S.A.",
          status: "CONFIRMED",
          unit: "AND-TRK-101",
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
        <span className="text-ink font-semibold">Andes Freight WebMCP</span>
      </div>

      <div className="bg-paper-raised border-2 border-brass-mid rounded-lg p-6 shadow-md">
        <div className="flex items-center justify-between gap-4 flex-wrap pb-4 mb-4 border-b border-line">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-md bg-ink text-paper flex items-center justify-center">
              <Truck className="w-6 h-6 text-brass-bright" />
            </div>
            <div>
              <h1 className="font-heading font-extrabold text-2xl text-ink">
                Andes Freight S.A.
              </h1>
              <p className="text-xs text-text-secondary">
                Operador Regional Certificado · Especialista Corredor Sur
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
              Tarifa Corredor Lima-Arequipa
            </span>
            <strong className="font-mono text-base text-brass">$760 USD</strong>
          </div>
          <div>
            <span className="text-text-muted block uppercase text-[10.5px] font-bold">
              Confiabilidad Histórica (SLA)
            </span>
            <strong className="font-mono text-base text-green">96% On-Time</strong>
          </div>
          <div>
            <span className="text-text-muted block uppercase text-[10.5px] font-bold">
              Flota Activa
            </span>
            <strong className="font-mono text-base text-ink">4 Unidades Scania R450</strong>
          </div>
          <div>
            <span className="text-text-muted block uppercase text-[10.5px] font-bold">
              Operaciones Previas ACME
            </span>
            <strong className="font-mono text-base text-ink">9 Envíos (8 On-Time)</strong>
          </div>
        </div>

        <h3 className="font-heading font-bold text-sm text-ink mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-brass" />
          Herramientas WebMCP Expuestas al Agente
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          {[
            {
              name: "andes_check_service_coverage",
              desc: "Verifica compatibilidad de origen, destino y restricciones de ruta.",
            },
            {
              name: "andes_check_capacity",
              desc: "Inspecciona capacidad de carga (18t) y disponibilidad de unidades Scania.",
            },
            {
              name: "andes_quote_freight",
              desc: "Retorna cotización firme vinculante ($760 USD, 16h tránsito).",
            },
            {
              name: "andes_book_freight",
              desc: "Confirma reserva instantánea y genera referencia AND-BOOK-8821.",
            },
          ].map((t) => (
            <div
              key={t.name}
              className="p-3 bg-[#11100C] border border-[#2B261D] rounded-md text-[#F3F1E9] font-mono text-xs"
            >
              <div className="text-brass-mid font-bold mb-1">
                document.modelContext.registerTool(&quot;{t.name}&quot;)
              </div>
              <div className="text-[#928D79] text-[11px] font-sans">{t.desc}</div>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <Link
            href="/freight-request/new?preset=golden1"
            className="bg-brass-mid hover:bg-brass-bright text-[#211500] font-bold text-xs px-5 py-2.5 rounded-pill flex items-center gap-2 transition"
          >
            <span>Probar Solicitud con este Carrier (Golden Flow 1)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
