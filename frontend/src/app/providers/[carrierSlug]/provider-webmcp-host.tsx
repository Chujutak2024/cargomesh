"use client";

import { useEffect, useState } from "react";

import type { ProviderPageConfig } from "@/features/providers/contracts";

import styles from "./provider.module.css";

type ProviderWebMcpHostProps = {
  provider: ProviderPageConfig;
};

export function ProviderWebMcpHost({ provider }: ProviderWebMcpHostProps) {
  const [browserStatus, setBrowserStatus] = useState<"checking" | "available" | "unavailable">(
    "checking",
  );

  useEffect(() => {
    setBrowserStatus("modelContext" in document ? "available" : "unavailable");
  }, []);

  return (
    <section className={styles.webmcp} data-carrier-id={provider.carrierId}>
      <div>
        <p className={styles.eyebrow}>WebMCP host</p>
        <h2>Endpoint preparado para tools dinámicas</h2>
      </div>
      <p className={styles.status} data-status={browserStatus}>
        {browserStatus === "checking" && "Comprobando compatibilidad del navegador…"}
        {browserStatus === "available" && "WebMCP disponible. Registro de tools: siguiente tarea A-02."}
        {browserStatus === "unavailable" &&
          "Este navegador no expone document.modelContext. Usa un entorno compatible para A-02."}
      </p>
    </section>
  );
}
