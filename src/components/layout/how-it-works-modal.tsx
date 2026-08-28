"use client";

import React from "react";
import { useDemoMode } from "@/features/demo/demo-context";
import { X, Sparkles, Cpu, Layers, CheckCircle2 } from "lucide-react";

export const HowItWorksModal = () => {
  const { isHowItWorksOpen, closeHowItWorks } = useDemoMode();

  if (!isHowItWorksOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-ink/65 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={closeHowItWorks}
    >
      <div
        className="bg-paper-raised border border-line rounded-lg max-w-[680px] w-full p-7 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={closeHowItWorks}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-paper border border-line flex items-center justify-center hover:bg-paper-raised transition text-text-secondary hover:text-ink"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-7 h-7 rounded-[8px] bg-brass-fill-soft text-brass flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <h2 className="font-heading font-extrabold text-xl text-ink">
            ¿Cómo funciona CargoMesh con WebMCP?
          </h2>
        </div>

        <p className="text-[13.5px] text-text-secondary mb-5 leading-relaxed">
          Una arquitectura orientada a agentes autónomos donde cada transportista expone sus capacidades y el motor heurístico toma decisiones matemáticas transparentes.
        </p>

        <div className="flex flex-col gap-3 mb-6">
          <div className="flex gap-3.5 p-3.5 bg-paper rounded-md border border-line text-[12.5px] leading-relaxed">
            <div className="font-mono font-bold bg-brass-mid text-[#211500] w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs">
              1
            </div>
            <div>
              <strong className="text-ink">Expresión de Necesidad Logística (No Búsqueda):</strong><br />
              El cliente define la carga, corredor, restricciones duras (refrigerado, peso) y su política empresarial (ej. <em>Balanced</em>).
            </div>
          </div>

          <div className="flex gap-3.5 p-3.5 bg-paper rounded-md border border-line text-[12.5px] leading-relaxed">
            <div className="font-mono font-bold bg-brass-mid text-[#211500] w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs">
              2
            </div>
            <div>
              <strong className="text-ink">Descubrimiento de Herramientas WebMCP:</strong><br />
              El Agente consulta dinámicamente los portales de <em>Andes</em>, <em>Pacific</em> e <em>Inca</em> ejecutando <code className="text-brass font-mono bg-paper-raised px-1 py-0.5 rounded border border-line">document.modelContext.registerTool()</code> (cobertura, capacidad y cotización).
            </div>
          </div>

          <div className="flex gap-3.5 p-3.5 bg-paper rounded-md border border-line text-[12.5px] leading-relaxed">
            <div className="font-mono font-bold bg-brass-mid text-[#211500] w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs">
              3
            </div>
            <div>
              <strong className="text-ink">Decisión Heurística + Auto-Booking:</strong><br />
              Se calcula una puntuación multicriterio determinista (Costo 25%, SLA 25%, ETA 20%, Flota 10%, Experiencia 10%, Historial 10%). Si la confianza supera el 85%, el agente reserva automáticamente y explica las razones.
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={closeHowItWorks}
            className="bg-ink hover:bg-[#322D22] text-paper font-bold text-sm px-5 py-2.5 rounded-pill transition"
          >
            Entendido, ver demo
          </button>
        </div>
      </div>
    </div>
  );
};
