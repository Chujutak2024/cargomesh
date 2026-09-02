"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { FreightIntakeForm } from "@/components/freight-intake-form";
import {
  loadPersistedFreightIntake,
} from "@/features/freight-requests/intake-ui-adapter";
import type { FreightIntakeModel } from "@/features/freight-ui/view-models";
import { createFreightIntakeFixture } from "@/features/freight-ui/ui-fixtures";

import styles from "./freight-intake-loader.module.css";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; model: FreightIntakeModel }
  | { status: "error"; message: string };

function userFacingLoadError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.startsWith("UNAUTHENTICATED:")) {
    return "Tu sesión no está disponible. Inicia sesión nuevamente y reintenta.";
  }
  if (message.startsWith("FORBIDDEN:")) {
    return "Tu membresía activa no puede acceder a esta solicitud.";
  }
  if (message.startsWith("NOT_FOUND:")) {
    return "No encontramos la solicitud en la organización activa.";
  }
  return "No fue posible cargar la solicitud persistida. Reintenta sin abandonar esta página.";
}

export function FreightIntakeLoader({
  requestCode,
  visualScenario,
}: {
  requestCode: string;
  visualScenario: boolean;
}) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<LoadState>(() =>
    visualScenario
      ? { status: "ready", model: createFreightIntakeFixture() }
      : { status: "loading" },
  );

  useEffect(() => {
    if (visualScenario) {
      setState({ status: "ready", model: createFreightIntakeFixture() });
      return;
    }

    let active = true;
    setState({ status: "loading" });
    void loadPersistedFreightIntake(requestCode)
      .then((model) => {
        if (active) setState({ status: "ready", model });
      })
      .catch((error: unknown) => {
        if (active) setState({ status: "error", message: userFacingLoadError(error) });
      });
    return () => {
      active = false;
    };
  }, [attempt, requestCode, visualScenario]);

  if (state.status === "loading") {
    return (
      <section className={styles.stateCard} aria-busy="true" aria-live="polite">
        <RefreshCw className={styles.spinner} size={22} aria-hidden="true" />
        <h1>Cargando solicitud persistida</h1>
        <p>Validamos tu sesión, organización y el código {requestCode} antes de habilitar el dispatch.</p>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className={styles.stateCard} role="alert">
        <AlertTriangle size={24} aria-hidden="true" />
        <h1>No pudimos preparar el intake</h1>
        <p>{state.message}</p>
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>
          <RefreshCw size={16} aria-hidden="true" /> Reintentar carga
        </button>
      </section>
    );
  }

  return <FreightIntakeForm initialValue={state.model} />;
}
