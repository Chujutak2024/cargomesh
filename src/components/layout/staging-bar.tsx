"use client";

import React from "react";
import { useDemoMode } from "@/features/demo/demo-context";
import Link from "next/link";

export const StagingBar = () => {
  const { isDemoMode, toggleDemoMode, openHowItWorks } = useDemoMode();

  return (
    <div className="bg-[#11100C] text-[#C5BFB0] text-[11.5px] px-7 py-1.5 flex items-center justify-between gap-3 border-b border-[#28241C] font-mono">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-brass-mid animate-pulse" />
        <strong className="text-paper">WebMCP Challenge Staging</strong>
        <span>•</span>
        <span>Deterministic Multi-Criteria Engine</span>
        <span>•</span>
        <span>Org: <strong className="text-paper">ACME Mining</strong></span>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={openHowItWorks}
          className="text-brass-mid hover:text-brass-bright font-semibold underline decoration-dotted transition"
        >
          ¿Cómo funciona? (How it works)
        </button>

        <span>•</span>

        <button
          onClick={toggleDemoMode}
          className={`px-2.5 py-0.5 rounded-pill text-[11px] font-bold border transition flex items-center gap-1.5 ${
            isDemoMode
              ? "bg-brass-mid text-[#211500] border-brass-bright shadow-sm"
              : "bg-[#242017] text-[#F1E1BB] border-[#423B2C] hover:bg-[#383124]"
          }`}
        >
          <span>🧪 Modo Demo:</span>
          <span>{isDemoMode ? "ON" : "OFF"}</span>
        </button>
      </div>
    </div>
  );
};
