"use client";

import {
  AlertTriangle,
  CheckCircle2,
  History,
  LoaderCircle,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { FreightIntakeModel } from "@/features/freight-ui/view-models";
import type {
  FreightRecommendationSuggestion,
  RecommendationJsonValue,
  RecommendationProposedFieldName,
  RecommendationProposedFields,
} from "./contracts";
import { executeFreightRecommendationToolViaWebMcp } from "./recommendation-webmcp-runtime";
import { RecommendationAcceptanceError } from "./recommendation-acceptance";
import {
  buildRecommendationDiff,
  classifyRecommendationResult,
  selectApplicableRecommendationFields,
} from "./recommendation-ui-policy";
import styles from "./freight-recommendation-panel.module.css";

type FreightRecommendationPanelProps = {
  form: FreightIntakeModel;
  draftVersion: number;
  webMcpReady: boolean;
  registrationError: string | null;
  onApply?: (fields: RecommendationProposedFields, signal: AbortSignal) => Promise<void>;
  onStaleDraft: (signal: AbortSignal) => Promise<void> | void;
};

const SOURCE_LABELS: Record<FreightRecommendationSuggestion["sourceType"], string> = {
  ORGANIZATION_HISTORY: "Historial de la organización",
  SYNTHETIC_RECOMMENDATION_HISTORY: "Historial sintético identificado",
  CARGO_PROFILE: "Perfil de carga",
};

export function FreightRecommendationPanel({
  form,
  draftVersion,
  webMcpReady,
  registrationError,
  onApply,
  onStaleDraft,
}: FreightRecommendationPanelProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [suggestions, setSuggestions] = useState<FreightRecommendationSuggestion[]>([]);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [selectedFields, setSelectedFields] = useState<Set<RecommendationProposedFieldName>>(new Set());
  const [empty, setEmpty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const requestController = useRef<AbortController | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const launchButtonRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLElement>(null);

  const suggestion = suggestions[activeSuggestion];
  const diff = useMemo(
    () => suggestion ? buildRecommendationDiff(form, suggestion.proposedFields) : [],
    [form, suggestion],
  );

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    const handleDialogKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeWithoutMutation();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...(modalRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [])];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleDialogKeys);
    return () => document.removeEventListener("keydown", handleDialogKeys);
  }, [open]);

  useEffect(() => () => requestController.current?.abort(), []);

  function closeWithoutMutation() {
    requestController.current?.abort();
    requestController.current = null;
    setOpen(false);
    setLoading(false);
    setApplying(false);
    setSelectedFields(new Set());
    queueMicrotask(() => launchButtonRef.current?.focus());
  }

  async function requestRecommendations() {
    if (!webMcpReady) return;
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    setOpen(true);
    setLoading(true);
    setEmpty(false);
    setError(null);
    setNotice(null);
    setSuggestions([]);
    setSelectedFields(new Set());

    try {
      const result = await executeFreightRecommendationToolViaWebMcp(
        document,
        { freightRequestId: form.freightRequestId, draftVersion },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      const state = classifyRecommendationResult(result);
      if (state === "stale") {
        setOpen(false);
        setSuggestions([]);
        setSelectedFields(new Set());
        setNotice("La sugerencia quedó obsoleta. Se está recargando el borrador vigente.");
        await onStaleDraft(controller.signal);
        return;
      }
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      if (state === "empty") {
        setEmpty(true);
        return;
      }
      setSuggestions(result.data.suggestions);
      setActiveSuggestion(0);
    } catch (caught) {
      if (controller.signal.aborted) return;
      setError(caught instanceof Error ? caught.message : "No fue posible consultar las sugerencias.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  function toggleField(field: RecommendationProposedFieldName) {
    setSelectedFields((current) => {
      const next = new Set(current);
      if (next.has(field)) {
        next.delete(field);
      } else {
        next.add(field);
        if (field === "cargo_entry_method" && suggestion?.proposedFields.cargo_entry_method === "TOTAL_WEIGHT") {
          next.delete("entry_quantity");
          next.delete("entry_unit_weight_kg");
          next.delete("units_per_entry");
        }
      }
      return next;
    });
  }

  function chooseSuggestion(index: number) {
    setActiveSuggestion(index);
    setSelectedFields(new Set());
  }

  async function applySelection() {
    if (!suggestion || !onApply) return;
    const fields = selectApplicableRecommendationFields(
      form,
      suggestion.proposedFields,
      selectedFields,
    );
    if (Object.keys(fields).length === 0) return;
    const controller = new AbortController();
    requestController.current = controller;
    setApplying(true);
    setError(null);
    try {
      await onApply(fields, controller.signal);
      setNotice("D1-01 guardó y confirmó únicamente los campos seleccionados.");
      setOpen(false);
      setSelectedFields(new Set());
    } catch (caught) {
      if (controller.signal.aborted) return;
      if (caught instanceof RecommendationAcceptanceError && caught.code === "STALE_DRAFT") {
        setOpen(false);
        setSuggestions([]);
        setSelectedFields(new Set());
        setNotice("El borrador cambió en el servidor. Se recargó la versión vigente; realiza una nueva consulta para continuar.");
        await onStaleDraft(controller.signal);
        return;
      }
      setError(caught instanceof Error ? caught.message : "D1-01 no confirmó los cambios.");
    } finally {
      if (!controller.signal.aborted) setApplying(false);
    }
  }

  const applicableSelectionCount = diff.filter(
    ({ field, selectable }) => selectable && selectedFields.has(field),
  ).length;

  return (
    <>
      <section className={styles.launcher} aria-labelledby="recommendation-title">
        <span className={styles.icon}><Sparkles size={19} aria-hidden="true" /></span>
        <div>
          <h2 id="recommendation-title">Sugerencias para este borrador</h2>
          <p>Consulta antecedentes mediante WebMCP y decide campo por campo qué incorporar.</p>
          {registrationError ? <p className={styles.errorText} role="alert">{registrationError}</p> : null}
          {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
        </div>
        <button
          ref={launchButtonRef}
          type="button"
          className={styles.launchButton}
          disabled={!webMcpReady || loading}
          onClick={() => void requestRecommendations()}
        >
          {loading ? <LoaderCircle className={styles.spinner} size={17} aria-hidden="true" /> : <History size={17} aria-hidden="true" />}
          {loading ? "Consultando…" : webMcpReady ? "Consultar sugerencias" : "WebMCP no disponible"}
        </button>
      </section>

      {open ? (
        <div className={styles.scrim} role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeWithoutMutation();
        }}>
          <section
            ref={modalRef}
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="suggestion-dialog-title"
            aria-describedby="suggestion-dialog-description"
          >
            <header className={styles.modalHeader}>
              <div>
                <span className={styles.eyebrow}>Revisión humana requerida</span>
                <h2 id="suggestion-dialog-title">Sugerencias para la solicitud</h2>
                <p id="suggestion-dialog-description">Nada cambia hasta que selecciones campos y confirmes.</p>
              </div>
              <button ref={closeButtonRef} type="button" className={styles.closeButton} onClick={closeWithoutMutation} aria-label="Cerrar sin aplicar cambios">
                <X size={20} aria-hidden="true" />
              </button>
            </header>

            <div className={styles.modalBody} aria-live="polite">
              {loading ? <LoadingState /> : null}
              {!loading && empty ? <EmptyState /> : null}
              {!loading && error ? <ErrorState message={error} /> : null}
              {!loading && suggestion ? (
                <>
                  {suggestions.length > 1 ? (
                    <div className={styles.suggestionTabs} role="tablist" aria-label="Sugerencias disponibles">
                      {suggestions.map((item, index) => (
                        <button
                          type="button"
                          role="tab"
                          aria-selected={index === activeSuggestion}
                          key={item.suggestionId}
                          onClick={() => chooseSuggestion(index)}
                        >Sugerencia {index + 1}</button>
                      ))}
                    </div>
                  ) : null}

                  <section className={styles.evidence} aria-label="Fuente y motivo de la sugerencia">
                    <div><small>Fuente</small><strong>{SOURCE_LABELS[suggestion.sourceType]}</strong></div>
                    <div><small>Motivo</small><strong>{suggestion.explanation}</strong></div>
                    <ul aria-label="Códigos de motivo">
                      {suggestion.reasonCodes.map((reason) => <li key={reason}>{reason}</li>)}
                    </ul>
                  </section>

                  <fieldset className={styles.diffList}>
                    <legend>Selecciona los campos que deseas aplicar</legend>
                    {diff.map((row) => (
                      <label key={row.field} className={!row.selectable ? styles.diffDisabled : undefined}>
                        <input
                          type="checkbox"
                          checked={selectedFields.has(row.field)}
                          disabled={!row.selectable}
                          onChange={() => toggleField(row.field)}
                        />
                        <span className={styles.diffContent}>
                          <span className={styles.diffTitle}>{row.label}<code>{row.field}</code></span>
                          <span className={styles.values}>
                            <span><small>Actual</small><strong>{formatValue(row.currentValue)}</strong></span>
                            <span aria-hidden="true">→</span>
                            <span><small>Sugerido</small><strong>{formatValue(row.proposedValue)}</strong></span>
                          </span>
                          {!row.selectable ? (
                            <small className={styles.unavailable}>
                              {row.unselectableReason || "Visible para comparación; este formulario todavía no expone ese campo."}
                            </small>
                          ) : null}
                        </span>
                      </label>
                    ))}
                  </fieldset>
                  {!onApply ? (
                    <p className={styles.integrationPending} role="status">
                      Aplicación pendiente: C debe publicar y conectar la escritura D1-01. La consulta no modifica el borrador.
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>

            <footer className={styles.modalFooter}>
              <button type="button" className={styles.cancelButton} onClick={closeWithoutMutation}>Cancelar</button>
              <button
                type="button"
                className={styles.applyButton}
                disabled={!onApply || !suggestion || applicableSelectionCount === 0 || loading || applying}
                onClick={() => void applySelection()}
              >
                {applying ? <LoaderCircle className={styles.spinner} size={17} aria-hidden="true" /> : <CheckCircle2 size={17} aria-hidden="true" />}
                {applying ? "Guardando con D1-01…" : onApply ? `Aplicar ${applicableSelectionCount ? `${applicableSelectionCount} campo${applicableSelectionCount === 1 ? "" : "s"}` : "selección"}` : "D1-01 pendiente"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}

function formatValue(value: RecommendationJsonValue | undefined) {
  if (value === undefined || value === null || value === "") return "No informado";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (Array.isArray(value)) return value.length ? value.map(String).join(", ") : "Ninguno";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function LoadingState() {
  return <div className={styles.state}><LoaderCircle className={styles.spinner} size={25} aria-hidden="true" /><strong>Consultando antecedentes</strong><p>La tool se está ejecutando mediante document.modelContext.</p></div>;
}

function EmptyState() {
  return <div className={styles.state}><History size={25} aria-hidden="true" /><strong>No hay sugerencias disponibles</strong><p>Puedes continuar y completar el borrador sin aplicar antecedentes.</p></div>;
}

function ErrorState({ message }: { message: string }) {
  return <div className={`${styles.state} ${styles.errorState}`} role="alert"><AlertTriangle size={25} aria-hidden="true" /><strong>No fue posible obtener sugerencias</strong><p>{message}</p></div>;
}
