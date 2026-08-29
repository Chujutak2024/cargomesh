"use client";

import { useEffect, useState } from "react";

import type { ProviderPageConfig } from "@/features/providers/contracts";
import {
  createQuoteFreightTool,
  QUOTE_FREIGHT_TOOL_NAME,
} from "@/features/providers/quote-freight-tool";

import styles from "./provider.module.css";

type ProviderWebMcpHostProps = {
  provider: ProviderPageConfig;
};

export function ProviderWebMcpHost({ provider }: ProviderWebMcpHostProps) {
  const [browserStatus, setBrowserStatus] = useState<
    "checking" | "registering" | "registered" | "unavailable" | "error"
  >("checking");

  useEffect(() => {
    const modelContext = document.modelContext;

    if (!modelContext) {
      setBrowserStatus("unavailable");
      return;
    }

    const registrationController = new AbortController();
    let mounted = true;

    setBrowserStatus("registering");

    void modelContext
      .registerTool(createQuoteFreightTool(provider), {
        signal: registrationController.signal,
      })
      .then(async () => {
        const tools = await modelContext.getTools();

        if (mounted) {
          setBrowserStatus(
            tools.some((tool) => tool.name === QUOTE_FREIGHT_TOOL_NAME)
              ? "registered"
              : "error",
          );
        }
      })
      .catch((error: unknown) => {
        if (mounted && !registrationController.signal.aborted) {
          console.error("CargoMesh could not register quote_freight", error);
          setBrowserStatus("error");
        }
      });

    return () => {
      mounted = false;
      registrationController.abort();
    };
  }, [provider]);

  return (
    <section className={styles.webmcp} data-carrier-id={provider.carrierId}>
      <div>
        <p className={styles.eyebrow}>WebMCP host</p>
        <h2>Tool disponible: <code>{QUOTE_FREIGHT_TOOL_NAME}</code></h2>
      </div>
      <p className={styles.status} data-status={browserStatus}>
        {browserStatus === "checking" && "Comprobando compatibilidad del navegador…"}
        {browserStatus === "registering" && "WebMCP disponible. Registrando la tool…"}
        {browserStatus === "registered" &&
          "quote_freight está registrada y visible para el agente del navegador."}
        {browserStatus === "unavailable" &&
          "Este navegador no expone document.modelContext. Usa un entorno WebMCP compatible."}
        {browserStatus === "error" &&
          "WebMCP está disponible, pero quote_freight no pudo registrarse."}
      </p>
    </section>
  );
}
