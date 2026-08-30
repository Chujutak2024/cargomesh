"use client";

import { useEffect, useState } from "react";

import type { ProviderPageConfig } from "@/features/providers/contracts";
import {
  registerProviderTools,
  REQUIRED_PROVIDER_TOOL_NAMES,
} from "@/features/providers/provider-tool-registration";

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

    void registerProviderTools(modelContext, provider, registrationController.signal)
      .then((allToolsRegistered) => {
        if (mounted) {
          setBrowserStatus(allToolsRegistered ? "registered" : "error");
        }
      })
      .catch((error: unknown) => {
        if (mounted && !registrationController.signal.aborted) {
          registrationController.abort();
          console.error("CargoMesh could not register its provider tools", error);
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
        <h2>
          Tools disponibles: <code>{REQUIRED_PROVIDER_TOOL_NAMES.join(", ")}</code>
        </h2>
      </div>
      <p className={styles.status} data-status={browserStatus}>
        {browserStatus === "checking" && "Comprobando compatibilidad del navegador…"}
        {browserStatus === "registering" && "WebMCP disponible. Registrando las tools…"}
        {browserStatus === "registered" &&
          "Las tres tools provider están registradas y visibles para el agente del navegador."}
        {browserStatus === "unavailable" &&
          "Este navegador no expone document.modelContext. Usa un entorno WebMCP compatible."}
        {browserStatus === "error" &&
          "WebMCP está disponible, pero las tools provider no pudieron registrarse."}
      </p>
    </section>
  );
}
