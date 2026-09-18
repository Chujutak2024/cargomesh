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
import { useLocale } from "@/features/i18n/locale-provider";
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

const SOURCE_LABELS: Record<FreightRecommendationSuggestion["sourceType"], readonly [string, string]> = {
  ORGANIZATION_HISTORY: ["Historial de la organización", "Organization history"],
  SYNTHETIC_RECOMMENDATION_HISTORY: ["Historial sintético identificado", "Identified synthetic history"],
  CARGO_PROFILE: ["Perfil de carga", "Cargo profile"],
};

const FIELD_LABELS_EN: Partial<Record<RecommendationProposedFieldName, string>> = {
  origin_country: "Origin country", origin_city: "Origin city", origin_address: "Origin address",
  pickup_contact_name: "Pickup contact", pickup_contact_phone: "Pickup phone",
  destination_country: "Destination country", destination_city: "Destination city", destination_address: "Destination address",
  receiver_name: "Delivery contact", receiver_company: "Receiving company", receiver_phone: "Delivery phone",
  cargo_category_id: "Cargo category", cargo_description: "Cargo description", cargo_entry_method: "Entry method",
  entry_quantity: "Entry quantity", entry_unit_weight_kg: "Unit weight (kg)", units_per_entry: "Units per entry",
  entry_length_cm: "Length per entry (cm)", entry_width_cm: "Width per entry (cm)", entry_height_cm: "Height per entry (cm)",
  package_count: "Package count", cargo_specifications: "Cargo specifications", requires_refrigeration: "Requires refrigeration",
  temperature_min_c: "Minimum temperature (°C)", temperature_max_c: "Maximum temperature (°C)",
  is_hazardous: "Hazardous cargo", is_fragile: "Fragile cargo", is_oversized: "Oversized cargo",
  is_high_value: "High-value cargo", is_stackable: "Stackable cargo", special_instructions: "Special instructions",
  pickup_mode: "Pickup mode", pickup_window_start: "Pickup window start", pickup_window_end: "Pickup window end",
  delivery_deadline: "Delivery deadline", budget_max: "Maximum budget", optimization_strategy: "Strategy",
  available_documents: "Available documents", cross_border: "Cross-border operation",
};

export function FreightRecommendationPanel({
  form,
  draftVersion,
  webMcpReady,
  registrationError,
  onApply,
  onStaleDraft,
}: FreightRecommendationPanelProps) {
  const { locale, t } = useLocale();
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
        setNotice(t("La sugerencia quedó obsoleta. Se está recargando el borrador vigente.", "The recommendation is stale. The current draft is being reloaded."));
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
      setError(caught instanceof Error ? caught.message : t("No fue posible consultar las sugerencias.", "Recommendations could not be retrieved."));
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
      setNotice(t("D1-01 guardó y confirmó únicamente los campos seleccionados.", "D1-01 saved and confirmed only the selected fields."));
      setOpen(false);
      setSelectedFields(new Set());
    } catch (caught) {
      if (controller.signal.aborted) return;
      if (caught instanceof RecommendationAcceptanceError && caught.code === "STALE_DRAFT") {
        setOpen(false);
        setSuggestions([]);
        setSelectedFields(new Set());
        setNotice(t("El borrador cambió en el servidor. Se recargó la versión vigente; realiza una nueva consulta para continuar.", "The draft changed on the server. The current version was reloaded; request recommendations again to continue."));
        await onStaleDraft(controller.signal);
        return;
      }
      setError(caught instanceof Error ? caught.message : t("D1-01 no confirmó los cambios.", "D1-01 did not confirm the changes."));
    } finally {
      if (!controller.signal.aborted) setApplying(false);
    }
  }

  const applicableSelectionCount = diff.filter(
    ({ field, selectable }) => selectable && selectedFields.has(field),
  ).length;

  const visibleDiff = useMemo(() => {
    return diff.filter((row) => {
      if (row.selectable) return true;
      if (row.field === "cargo_category_id" || row.field === "cargo_specifications") return false;
      if (JSON.stringify(row.currentValue) === JSON.stringify(row.proposedValue)) return false;
      return true;
    });
  }, [diff]);

  return (
    <>
      <section className={styles.launcher} aria-labelledby="recommendation-title">
        <span className={styles.icon}><Sparkles size={19} aria-hidden="true" /></span>
        <div>
          <h2 id="recommendation-title">{t("Antecedentes de tu organización", "Your organization history")}</h2>
          <p>{t("Consulta mediante WebMCP solo el historial autorizado de tu organización y decide campo por campo qué incorporar.", "Use WebMCP to query only your organization's authorized history, then choose field by field what to apply.")}</p>
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
          {loading ? t("Consultando…", "Loading…") : webMcpReady ? t("Consultar antecedentes", "Review history") : t("WebMCP no disponible", "WebMCP unavailable")}
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
                <span className={styles.eyebrow}>{t("Revisión humana requerida", "Human review required")}</span>
                <h2 id="suggestion-dialog-title">{t("Sugerencias para la solicitud", "Request recommendations")}</h2>
                <p id="suggestion-dialog-description">{t("Nada cambia hasta que selecciones campos y confirmes.", "Nothing changes until you select fields and confirm.")}</p>
              </div>
              <button ref={closeButtonRef} type="button" className={styles.closeButton} onClick={closeWithoutMutation} aria-label={t("Cerrar sin aplicar cambios", "Close without applying changes")}>
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
                    <div className={styles.suggestionTabs} role="tablist" aria-label={t("Sugerencias disponibles", "Available recommendations")}>
                      {suggestions.map((item, index) => (
                        <button
                          type="button"
                          role="tab"
                          aria-selected={index === activeSuggestion}
                          key={item.suggestionId}
                          onClick={() => chooseSuggestion(index)}
                        >{t("Sugerencia", "Recommendation")} {index + 1}</button>
                      ))}
                    </div>
                  ) : null}

                  <section className={styles.evidence} aria-label={t("Fuente y motivo de la sugerencia", "Recommendation source and reason")}>
                    <div><small>{t("Fuente", "Source")}</small><strong>{t(...SOURCE_LABELS[suggestion.sourceType])}</strong></div>
                    <div><small>{t("Motivo", "Reason")}</small><strong>{suggestion.explanation}</strong></div>
                    <ul aria-label={t("Códigos de motivo", "Reason codes")}>
                      {suggestion.reasonCodes.map((reason) => <li key={reason}>{reason}</li>)}
                    </ul>
                  </section>

                  <fieldset className={styles.diffList}>
                    <legend>{t("Selecciona los campos que deseas aplicar", "Select the fields you want to apply")}</legend>
                    {visibleDiff.map((row) => (
                      <label key={row.field} className={!row.selectable ? styles.diffDisabled : undefined}>
                        <input
                          type="checkbox"
                          checked={selectedFields.has(row.field)}
                          disabled={!row.selectable}
                          onChange={() => toggleField(row.field)}
                        />
                        <span className={styles.diffContent}>
                          <span className={styles.diffTitle}>{locale === "en" ? (FIELD_LABELS_EN[row.field] ?? row.label) : row.label}</span>
                          <span className={styles.values}>
                            <span><small>{t("Actual", "Current")}</small><strong>{formatValue(row.currentValue, row.field, t)}</strong></span>
                            <span aria-hidden="true">→</span>
                            <span><small>{t("Sugerido", "Suggested")}</small><strong>{formatValue(row.proposedValue, row.field, t)}</strong></span>
                          </span>
                          {!row.selectable ? (
                            <small className={styles.unavailable}>
                              {locale === "en" ? unavailableReasonEnglish(row.unselectableReason) : (row.unselectableReason || "Visible para comparación; este formulario todavía no expone ese campo.")}
                            </small>
                          ) : null}
                        </span>
                      </label>
                    ))}
                  </fieldset>
                  {!onApply ? (
                    <p className={styles.integrationPending} role="status">
                      {t("Aplicación no configurada en este host. La consulta no modifica el borrador.", "Apply is not configured on this host. The query does not modify the draft.")}
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>

            <footer className={styles.modalFooter}>
              <button type="button" className={styles.cancelButton} onClick={closeWithoutMutation}>{t("Cancelar", "Cancel")}</button>
              <button
                type="button"
                className={styles.applyButton}
                disabled={!onApply || !suggestion || applicableSelectionCount === 0 || loading || applying}
                onClick={() => void applySelection()}
              >
                {applying ? <LoaderCircle className={styles.spinner} size={17} aria-hidden="true" /> : <CheckCircle2 size={17} aria-hidden="true" />}
                {applying ? t("Guardando con D1-01…", "Saving with D1-01…") : onApply ? `${t("Aplicar", "Apply")} ${applicableSelectionCount ? `${applicableSelectionCount} ${t(applicableSelectionCount === 1 ? "campo" : "campos", applicableSelectionCount === 1 ? "field" : "fields")}` : t("selección", "selection")}` : t("Aplicación no configurada", "Apply not configured")}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}

function formatValue(value: RecommendationJsonValue | undefined, field: string | undefined, t: (spanish: string, english: string) => string) {
  if (value === undefined || value === null || value === "") return t("No informado", "Not provided");
  if (typeof value === "boolean") return value ? t("Sí", "Yes") : "No";
  if (typeof value === "string" && value.startsWith("10000000-")) {
    return t("Maquinaria / Repuestos mineros", "Machinery / Mining spares");
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return t("Estándar", "Standard");
  }
  if (Array.isArray(value)) {
    return value.length
      ? value.map((v) => String(v).replace(/_/g, " ")).join(", ")
      : t("Ninguno", "None");
  }
  return String(value);
}

function LoadingState() {
  const { t } = useLocale();
  return <div className={styles.state}><LoaderCircle className={styles.spinner} size={25} aria-hidden="true" /><strong>{t("Consultando antecedentes", "Querying history")}</strong><p>{t("La tool se está ejecutando mediante document.modelContext.", "The tool is executing through document.modelContext.")}</p></div>;
}

function EmptyState() {
  const { t } = useLocale();
  return <div className={styles.state}><History size={25} aria-hidden="true" /><strong>{t("No hay sugerencias disponibles", "No recommendations available")}</strong><p>{t("Puedes continuar y completar el borrador sin aplicar antecedentes.", "You can continue and complete the draft without applying prior history.")}</p></div>;
}

function ErrorState({ message }: { message: string }) {
  const { t } = useLocale();
  return <div className={`${styles.state} ${styles.errorState}`} role="alert"><AlertTriangle size={25} aria-hidden="true" /><strong>{t("No fue posible obtener sugerencias", "Recommendations could not be retrieved")}</strong><p>{message}</p></div>;
}

function unavailableReasonEnglish(reason: string | undefined) {
  if (reason === "No combinable con carga a granel (TOTAL_WEIGHT).") return "Cannot be combined with bulk cargo (TOTAL_WEIGHT).";
  return "Visible for comparison; this form does not expose that field yet.";
}
