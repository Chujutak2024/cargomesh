"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { FreightIntakeForm } from "@/components/freight-intake-form";
import { useLocale } from "@/features/i18n/locale-provider";
import {
  loadPersistedFreightIntake,
} from "@/features/freight-requests/intake-ui-adapter";
import type { FreightIntakeModel } from "@/features/freight-ui/view-models";
import {
  createFreightIntakeFixture,
  createNewDraftIntakeModel,
} from "@/features/freight-ui/ui-fixtures";

import styles from "./freight-intake-loader.module.css";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; model: FreightIntakeModel }
  | { status: "error"; message: string };

function userFacingLoadError(error: unknown, t: (spanish: string, english: string) => string) {
  const message = error instanceof Error ? error.message : "";
  if (message.startsWith("UNAUTHENTICATED:")) {
    return t("Tu sesión no está disponible. Inicia sesión nuevamente y reintenta.", "Your session is unavailable. Sign in again and retry.");
  }
  if (message.startsWith("FORBIDDEN:")) {
    return t("Tu membresía activa no puede acceder a esta solicitud.", "Your active membership cannot access this request.");
  }
  if (message.startsWith("NOT_FOUND:")) {
    return t("No encontramos la solicitud en la organización activa.", "The request was not found in the active organization.");
  }
  return t("No fue posible cargar la solicitud persistida. Reintenta sin abandonar esta página.", "The persisted request could not be loaded. Retry without leaving this page.");
}

export function FreightIntakeLoader({
  requestCode,
  defaultCleanMode = false,
  visualScenario,
}: {
  requestCode: string | null;
  defaultCleanMode?: boolean;
  visualScenario: boolean;
}) {
  const { t } = useLocale();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<LoadState>(() => {
    if (visualScenario) {
      return { status: "ready", model: createFreightIntakeFixture() };
    }
    if (!requestCode) {
      return { status: "ready", model: createNewDraftIntakeModel() };
    }
    return { status: "loading" };
  });

  useEffect(() => {
    if (visualScenario) {
      setState({ status: "ready", model: createFreightIntakeFixture() });
      return;
    }

    if (!requestCode) {
      setState({ status: "ready", model: createNewDraftIntakeModel() });
      return;
    }

    let active = true;
    setState({ status: "loading" });
    void loadPersistedFreightIntake(requestCode)
      .then((model) => {
        if (active) setState({ status: "ready", model });
      })
      .catch((error: unknown) => {
        if (active) setState({ status: "error", message: userFacingLoadError(error, t) });
      });
    return () => {
      active = false;
    };
  }, [attempt, requestCode, visualScenario, t]);

  if (state.status === "loading") {
    return (
      <section className={styles.stateCard} aria-busy="true" aria-live="polite">
        <RefreshCw className={styles.spinner} size={22} aria-hidden="true" />
        <h1>{t("Cargando solicitud persistida", "Loading persisted request")}</h1>
        <p>{t("Validamos tu sesión, organización y el código", "We validate your session, organization, and request code")} {requestCode} {t("antes de habilitar el dispatch.", "before enabling dispatch.")}</p>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className={styles.stateCard} role="alert">
        <AlertTriangle size={24} aria-hidden="true" />
        <h1>{t("No pudimos preparar el intake", "We could not prepare the intake")}</h1>
        <p>{state.message}</p>
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>
          <RefreshCw size={16} aria-hidden="true" /> {t("Reintentar carga", "Retry loading")}
        </button>
      </section>
    );
  }

  return <FreightIntakeForm initialValue={state.model} defaultCleanMode={defaultCleanMode} />;
}
