"use client";

import { useEffect, useState } from "react";

import { useLocale } from "@/features/i18n/locale-provider";
import type { ProviderPageConfig } from "@/features/providers/contracts";
import {
  CARGOMESH_TOOL_CALLER_ORIGINS,
  registerProviderTools,
  REQUIRED_PROVIDER_TOOL_NAMES,
} from "@/features/providers/provider-tool-registration";

import styles from "./provider.module.css";

type ProviderWebMcpHostProps = {
  provider: ProviderPageConfig;
};

export function ProviderWebMcpHost({ provider }: ProviderWebMcpHostProps) {
  const { t } = useLocale();
  const [browserStatus, setBrowserStatus] = useState<
    "checking" | "registering" | "registered" | "unavailable" | "error"
  >("checking");
  const [registeredToolCount, setRegisteredToolCount] = useState(0);

  useEffect(() => {
    const modelContext = document.modelContext;

    if (!modelContext) {
      setBrowserStatus("unavailable");
      return;
    }

    const registrationController = new AbortController();
    let mounted = true;

    setBrowserStatus("registering");
    setRegisteredToolCount(0);

    void registerProviderTools(
      modelContext,
      provider,
      registrationController.signal,
      { exposedTo: CARGOMESH_TOOL_CALLER_ORIGINS },
    )
      .then(async (allToolsRegistered) => {
        const registeredTools = await modelContext.getTools();
        const registeredNames = new Set(registeredTools.map((tool) => tool.name));
        const providerToolCount = REQUIRED_PROVIDER_TOOL_NAMES.filter((toolName) =>
          registeredNames.has(toolName),
        ).length;
        if (mounted) {
          setRegisteredToolCount(providerToolCount);
          setBrowserStatus(
            allToolsRegistered && providerToolCount === REQUIRED_PROVIDER_TOOL_NAMES.length
              ? "registered"
              : "error",
          );
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
    <>
      <section className={styles.webmcp} data-carrier-id={provider.carrierId}>
        <div>
          <p className={styles.eyebrow}>WebMCP host</p>
          <h2>
            {t("Tools disponibles", "Available tools")}: <code>{REQUIRED_PROVIDER_TOOL_NAMES.join(", ")}</code>
          </h2>
        </div>
        <p
          className={styles.status}
          data-status={browserStatus}
          data-tool-count={registeredToolCount}
        >
          {browserStatus === "checking" && t("Comprobando compatibilidad del navegador…", "Checking browser compatibility…")}
          {browserStatus === "registering" && t("WebMCP disponible. Registrando las tools…", "WebMCP available. Registering tools…")}
          {browserStatus === "registered" &&
            `document.modelContext.getTools() → ${registeredToolCount}/${REQUIRED_PROVIDER_TOOL_NAMES.length} tools registered`}
          {browserStatus === "unavailable" &&
            t("Navegador no compatible: document.modelContext no está disponible.", "Unsupported browser: document.modelContext is unavailable.")}
          {browserStatus === "error" &&
            t(
              `WebMCP disponible, pero getTools() reportó ${registeredToolCount}/${REQUIRED_PROVIDER_TOOL_NAMES.length} tools provider.`,
              `WebMCP is available, but getTools() reported ${registeredToolCount}/${REQUIRED_PROVIDER_TOOL_NAMES.length} provider tools.`,
            )}
        </p>
      </section>

      <ProviderFixtureControlPanel provider={provider} />
    </>
  );
}

function ProviderFixtureControlPanel({ provider }: { provider: ProviderPageConfig }) {
  const { t } = useLocale();
  const serviceCode = provider.service.providerServiceCode;
  const [bookings, setBookings] = useState<Record<string, any>>({});
  const [nextControls, setNextControls] = useState<Record<string, string>>({});
  const [defaultMode, setDefaultModeState] = useState<string>("PENDING");
  const [manualRef, setManualRef] = useState<string>("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadState = () => {
    if (typeof window === "undefined" || !window.sessionStorage) return;
    try {
      const raw = window.sessionStorage.getItem(`cargomesh:provider-booking:v1:${encodeURIComponent(serviceCode)}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        setBookings(parsed.bookingsByReference ?? {});
        setNextControls(parsed.nextControlByReference ?? {});
      } else {
        setBookings({});
        setNextControls({});
      }

      const defaultSaved = window.sessionStorage.getItem(`cargomesh:provider-fixture:default-response:${serviceCode}`);
      if (defaultSaved) {
        setDefaultModeState(defaultSaved);
      }
    } catch {
      // ignore parsing errors
    }
  };

  useEffect(() => {
    loadState();

    // Expose programmatic hook on window for automated tests and Chrome DevTools
    if (typeof window !== "undefined") {
      (window as any).__cargomeshFixtureController = {
        setNextResponse: (providerReference: string, control: "ACCEPT" | "REJECT" | "NO_RESPONSE") => {
          try {
            const raw = window.sessionStorage.getItem(`cargomesh:provider-booking:v1:${encodeURIComponent(serviceCode)}`);
            const state = raw ? JSON.parse(raw) : { bookingsByReference: {}, nextControlByReference: {} };
            if (!state.nextControlByReference) state.nextControlByReference = {};
            state.nextControlByReference[providerReference] = control;
            window.sessionStorage.setItem(`cargomesh:provider-booking:v1:${encodeURIComponent(serviceCode)}`, JSON.stringify(state));
            loadState();
            console.log(`[CargoMesh Fixture]: Configured ${control} for ${providerReference}`);
            return { ok: true, providerReference, control };
          } catch (err: any) {
            console.error("[CargoMesh Fixture Error]:", err);
            return { ok: false, error: err?.message };
          }
        },
        setDefaultMode: (control: "ACCEPT" | "REJECT" | "NO_RESPONSE") => {
          window.sessionStorage.setItem(`cargomesh:provider-fixture:default-response:${serviceCode}`, control);
          setDefaultModeState(control);
          console.log(`[CargoMesh Fixture]: Set default booking response to ${control}`);
        },
        getState: () => {
          const raw = window.sessionStorage.getItem(`cargomesh:provider-booking:v1:${encodeURIComponent(serviceCode)}`);
          return raw ? JSON.parse(raw) : null;
        },
        reload: loadState,
      };
    }

    const interval = setInterval(loadState, 2000);
    return () => clearInterval(interval);
  }, [serviceCode]);

  const handleSetControl = (ref: string, control: "ACCEPT" | "REJECT" | "NO_RESPONSE") => {
    if (typeof window === "undefined" || !window.sessionStorage) return;
    try {
      const raw = window.sessionStorage.getItem(`cargomesh:provider-booking:v1:${encodeURIComponent(serviceCode)}`);
      const state = raw ? JSON.parse(raw) : { bookingsByReference: {}, nextControlByReference: {} };
      if (!state.nextControlByReference) state.nextControlByReference = {};
      state.nextControlByReference[ref] = control;
      window.sessionStorage.setItem(`cargomesh:provider-booking:v1:${encodeURIComponent(serviceCode)}`, JSON.stringify(state));
      loadState();
      setFeedback(t(`✅ Próxima respuesta para "${ref}" configurada como "${control}".`, `✅ Next response for "${ref}" set to "${control}".`));
    } catch (err: any) {
      setFeedback(t(`❌ Error al configurar control: ${err?.message}`, `❌ Could not configure control: ${err?.message}`));
    }
  };

  const handleSetDefaultMode = (mode: string) => {
    if (typeof window === "undefined" || !window.sessionStorage) return;
    window.sessionStorage.setItem(`cargomesh:provider-fixture:default-response:${serviceCode}`, mode);
    setDefaultModeState(mode);
    setFeedback(t(`⚙️ Modo por defecto para nuevas reservas: "${mode}".`, `⚙️ Default mode for new bookings: "${mode}".`));
  };

  const bookingList = Object.values(bookings);

  return (
    <section className={styles.fixtureSection} aria-label={t("Control de fixture y simulación de respuestas", "Fixture controls and response simulation")}>
      <div className={styles.fixtureHeader}>
        <div>
          <h3 className={styles.fixtureTitle}>{t("Control de Pruebas UAT (Fixture Provider)", "UAT Test Controls (Provider Fixture)")}</h3>
          <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "var(--muted)" }}>
            {t("Configura de forma autorizada la respuesta provider-side para", "Configure the authorized provider-side response for")} <code>get_provider_booking_status</code>.
          </p>
        </div>
        <button className={styles.btnNeutral} onClick={loadState} type="button">
          🔄 {t("Refrescar sesión", "Refresh session")}
        </button>
      </div>

      {feedback && <div className={styles.fixtureNotice}>{feedback}</div>}

      <div style={{ marginBottom: "18px", fontSize: "0.85rem" }}>
        <strong style={{ display: "block", marginBottom: "6px" }}>{t("Comportamiento automático para próximas reservas:", "Automatic behavior for upcoming bookings:")}</strong>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            className={defaultMode === "ACCEPT" ? styles.btnAccept : styles.btnNeutral}
            onClick={() => handleSetDefaultMode("ACCEPT")}
          >
            Auto-ACCEPT (CONFIRMED)
          </button>
          <button
            type="button"
            className={defaultMode === "REJECT" ? styles.btnReject : styles.btnNeutral}
            onClick={() => handleSetDefaultMode("REJECT")}
          >
            Auto-REJECT (REJECTED)
          </button>
          <button
            type="button"
            className={defaultMode === "PENDING" ? styles.btnAccept : styles.btnNeutral}
            style={defaultMode === "PENDING" ? { background: "rgba(196, 144, 31, 0.2)", borderColor: "var(--brass-bright)", color: "var(--brass-bright)" } : {}}
            onClick={() => handleSetDefaultMode("PENDING")}
          >
            {t("Por defecto (Mantener PENDING)", "Default (Keep PENDING)")}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: "16px" }}>
        <strong style={{ display: "block", fontSize: "0.85rem", marginBottom: "8px" }}>
          {t("Reservas en sesión actual", "Bookings in this session")} ({bookingList.length}):
        </strong>
        {bookingList.length === 0 ? (
          <p style={{ margin: "6px 0", fontSize: "0.82rem", color: "var(--muted)" }}>
            {t("Todavía no hay reservas registradas en esta sesión. Al ejecutar", "No bookings are registered in this session yet. After running")} <code>book_freight</code>, {t("aparecerán aquí automáticamente.", "they will appear here automatically.")}
          </p>
        ) : (
          bookingList.map((b: any) => {
            const queued = nextControls[b.providerReference];
            return (
              <div key={b.providerReference} className={styles.fixtureCard}>
                <div>
                  <strong style={{ fontFamily: "monospace", fontSize: "0.95rem" }}>{b.providerReference}</strong>
                  <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "2px" }}>
                    {t("Estado actual", "Current status")}: <code>{b.providerBookingStatus}</code>
                    {queued && (
                      <span style={{ marginLeft: "8px", color: queued === "ACCEPT" ? "var(--success)" : "#ef4444", fontWeight: 700 }}>
                        ({t("Próxima respuesta en cola", "Next queued response")}: {queued})
                      </span>
                    )}
                  </div>
                </div>
                <div className={styles.fixtureButtonGroup}>
                  <button
                    type="button"
                    className={styles.btnAccept}
                    onClick={() => handleSetControl(b.providerReference, "ACCEPT")}
                  >
                    {t("Simular ACCEPT", "Simulate ACCEPT")}
                  </button>
                  <button
                    type="button"
                    className={styles.btnReject}
                    onClick={() => handleSetControl(b.providerReference, "REJECT")}
                  >
                    {t("Simular REJECT", "Simulate REJECT")}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "12px" }}>
        <input
          type="text"
          placeholder={t("O ingresa provider_reference manual...", "Or enter provider_reference manually...")}
          value={manualRef}
          onChange={(e) => setManualRef(e.target.value)}
          style={{
            flex: 1,
            padding: "8px 12px",
            borderRadius: "8px",
            border: "1px solid var(--border)",
            background: "var(--surface-raised)",
            color: "var(--foreground)",
            fontSize: "0.85rem",
            fontFamily: "monospace",
          }}
        />
        <button
          type="button"
          className={styles.btnAccept}
          onClick={() => {
            if (manualRef.trim()) handleSetControl(manualRef.trim(), "ACCEPT");
          }}
        >
          {t("Forzar ACCEPT", "Force ACCEPT")}
        </button>
        <button
          type="button"
          className={styles.btnReject}
          onClick={() => {
            if (manualRef.trim()) handleSetControl(manualRef.trim(), "REJECT");
          }}
        >
          {t("Forzar REJECT", "Force REJECT")}
        </button>
      </div>

      <p style={{ margin: "12px 0 0", fontSize: "0.72rem", color: "var(--muted)" }}>
        {t("Acceso desde la consola de DevTools", "DevTools console access")}: <code>window.__cargomeshFixtureController.setNextResponse(&apos;REF&apos;, &apos;ACCEPT&apos; | &apos;REJECT&apos;)</code>
      </p>
    </section>
  );
}
