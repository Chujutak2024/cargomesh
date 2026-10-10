"use client";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Truck } from "lucide-react";
import { useLocale } from "@/features/i18n/locale-provider";
import { ContentMotion } from "@/features/product-motion/content-motion";
import { LogisticsTruck } from "@/features/logistics-3d/logistics-truck";
import { facilities } from "@/features/v2-workspace/road-locations";
import { changeLocalDraft, type LocalDraft, type LocalDraftEnvelope } from "./local-draft-model";
import { completeLocalDraftStep, localDraftSteps, localDraftStepFromHash, localDraftStepHref, type LocalStepResult } from "./local-draft-flow";
import { localRequestStateLabel } from "./local-request-presentation";
import { dateLabel, locationLabel, LocalRoute, TruckPhoto } from "./local-draft-controls";
import { truckLabel, truckTypes } from "./local-truck-preference";
import { TruckModelControls } from "./truck-model-controls";
import type { SaveLocalDraft } from "./use-local-draft";
import s from "./portal.module.css";
import { RequestReview } from "./request-review";

function subscribeHash(notify: () => void) {
  window.addEventListener("hashchange", notify);
  return () => window.removeEventListener("hashchange", notify);
}
const readHash = () => window.location.hash;
const serverHash = () => "";
type Props = { record: LocalDraftEnvelope; save: SaveLocalDraft; requestId: string };
type Issue = { screen: number; reason: "invalid" | "previous" | "storage"; step?: number };

export function LocalDraftWizard({ record, save, requestId }: Props) {
  const { locale, t } = useLocale(), draft = record.draft;
  const hash = useSyncExternalStore(subscribeHash, readHash, serverHash);
  const active = localDraftStepFromHash(hash, draft.completedStep);
  const [issue, setIssue] = useState<Issue | null>(null);
  const errorId = useId(), errorRef = useRef<HTMLParagraphElement>(null);
  const visibleIssue = issue?.screen === active ? issue : null;
  const label = (index: number) => localDraftSteps[index][locale];
  const go = (index: number) => { setIssue(null); window.location.hash = localDraftStepHref(index); };
  const change = (fields: Partial<LocalDraft>) => {
    const stored = save(current => changeLocalDraft(current, fields, new Date().toISOString()));
    setIssue(stored ? null : { screen: active, reason: "storage" });
  };
  useEffect(() => { if (issue) errorRef.current?.focus({ preventScroll: false }); }, [issue]);
  const next = (visibleFields: Partial<LocalDraft> = {}) => {
    const outcome: { value: LocalStepResult | null } = { value: null };
    const stored = save(current => {
      const now = new Date().toISOString();
      const changed = Object.entries(visibleFields).some(([key, value]) => current.draft[key as keyof LocalDraft] !== value);
      const edited = changed ? changeLocalDraft(current, visibleFields, now) : current;
      const result = completeLocalDraftStep(edited, active, now);
      outcome.value = result;
      return result.ok ? result.record : edited;
    });
    const result = outcome.value;
    if (result && !result.ok) { setIssue({ screen: active, reason: result.reason, step: result.step }); return; }
    if (!stored || !result) { setIssue({ screen: active, reason: "storage" }); return; }
    if (active < 4) go(result.nextStep); else setIssue(null);
  };
  const invalid = visibleIssue?.reason === "invalid";
  const fieldError = { "aria-invalid": invalid || undefined, "aria-describedby": invalid ? errorId : undefined };
  const total = draft.quantity * draft.unitWeightKg;
  const descriptions = [
    t("Escoge las ciudades de recogida y entrega.", "Choose pickup and delivery cities."),
    t("Consulta la ruta vial y elige tu camión preferido.", "Inspect the road route and choose your preferred truck."),
    t("Indica qué transportarás y su peso.", "Describe the cargo and its weight."),
    t("Confirma las fechas de recogida y entrega.", "Confirm pickup and delivery dates."),
    t("Revisa los datos antes de confirmar la revisión.", "Check the details before confirming the review."),
  ];
  const validationCopy = [
    t("Elige ciudades distintas de una red terrestre conectada.", "Choose distinct cities on a connected land network."),
    t("Si usas tu camión, escribe un modelo de al menos dos caracteres.", "For your own truck, enter a model with at least two characters."),
    t("Añade una descripción, unidades enteras mayores que cero y un peso positivo.", "Enter a description, a positive whole unit count and a positive weight."),
    t("Completa ambas fechas. La entrega debe ser igual o posterior a la recogida.", "Enter both dates. Delivery must be on or after pickup."),
    t("Hay datos incompletos. Vuelve al paso pendiente y compruébalo.", "Some data is incomplete. Return to the pending step and check it."),
  ];

  return <section className={`${s.card} ${s.localWizard}`} aria-label={t("Revisión de la solicitud", "Request review")}>
    <nav aria-label={t("Pasos de la solicitud", "Request steps")}>
      <ol className={s.wizardSteps}>{localDraftSteps.map((step, index) => <li key={step.id} data-complete={index < draft.completedStep}>
        <button type="button" aria-current={index === active ? "step" : undefined}
          aria-label={`${index + 1}. ${step[locale]}${index < draft.completedStep ? t(", comprobado", ", checked") : ""}`} onClick={() => go(index)}>
          <span className={s.wizardStepNumber}>{index < draft.completedStep ? <Check size={16} aria-hidden="true"/> : index + 1}</span>
          <span className={s.wizardStepLabel}>{step[locale]}</span>
        </button>
      </li>)}</ol>
    </nav>
    <ContentMotion identity={active} focusOnChange>
      <div className={s.wizardTitle}><div><span className={s.eyebrow}>{t("Paso", "Step")} {active + 1} / 5</span>
        <h2 tabIndex={-1}>{label(active)}</h2><p>{descriptions[active]}</p></div>
        <span className={s.status}>{localRequestStateLabel(draft, locale)}</span>
      </div>
      <form noValidate onSubmit={event => {
        event.preventDefault();
        // Date pickers/autofill can commit on blur: validate the dates visible at submission.
        const fields = new FormData(event.currentTarget);
        next(active === 3 ? { pickupDate: String(fields.get("pickupDate") ?? ""), deliveryDate: String(fields.get("deliveryDate") ?? "") } : {});
      }}>
        <div className={s.wizardBody}>
          {active === 0 ? <div className={s.wizardFormWidth}>
            <div className={s.fields}>{(["originId", "destinationId"] as const).map(key => <label className={s.field} key={key}>
              {key === "originId" ? t("Origen", "Origin") : t("Destino", "Destination")}
              <select {...fieldError} value={draft[key]} onChange={event => change({ [key]: event.target.value })}>
                {facilities.map(item => <option key={item.id} value={item.id}>{locationLabel(item.id, locale)}</option>)}
              </select>
            </label>)}</div>
          </div> : null}

          {active === 1 ? <div className={s.wizardRouteGrid}>
            <LocalRoute draft={draft} embedded/>
            <section className={s.wizardTruckPanel} aria-label={t("Camión preferido", "Preferred truck")}>
              <div className={s.truckChoiceHeading}><h3>{t("Camión preferido", "Preferred truck")}</h3>
                <button type="button" onClick={() => change({ truckPreference: null })} disabled={!draft.truckPreference}>{t("Sin preferencia", "No preference")}</button></div>
              <div className={s.truckChoices}>{truckTypes.map(item => <button key={item.id} type="button" className={s.truckChoice}
                aria-label={item[locale]} aria-pressed={draft.truckPreference?.type === item.id}
                onClick={() => { if (draft.truckPreference?.type !== item.id) change({ truckPreference: { type: item.id, model: "", photoDataUrl: null } }); }}>
                <span className={s.truckChoiceVisual}><LogisticsTruck variant={item.id} thumbnail/></span>
                <strong>{item[locale]}</strong><span className={s.truckChoiceSelected}>{draft.truckPreference?.type === item.id ? <><CheckCircle2 size={14} aria-hidden="true"/>{t("Seleccionado", "Selected")}</> : t("Elegir", "Choose")}</span>
              </button>)}</div>
              <div className={s.truckOwnCard} data-selected={draft.truckPreference?.type === "custom"}>
                <div className={s.truckOwnHeading}><h3><Truck size={19} aria-hidden="true"/>{t("Mi camión", "My truck")}</h3>
                  <button type="button" aria-pressed={draft.truckPreference?.type === "custom"}
                    onClick={() => { if (draft.truckPreference?.type !== "custom") change({ truckPreference: { type: "custom", model: "", photoDataUrl: null } }); }}>
                    {draft.truckPreference?.type === "custom" ? t("Seleccionado", "Selected") : t("Usar mi camión", "Use my truck")}
                  </button></div>
                {draft.truckPreference?.type === "custom" ? <div className={s.truckOwnContent}>
                  <TruckPhoto t={t} photo={draft.truckPreference.photoDataUrl} onChange={photoDataUrl => {
                    const stored = save(current => current.draft.truckPreference?.type === "custom"
                      ? changeLocalDraft(current, { truckPreference: { ...current.draft.truckPreference, photoDataUrl, modelAssetId: null } }, new Date().toISOString()) : current);
                    setIssue(stored ? null : { screen: active, reason: "storage" });
                  }}/>
                  <div><label className={s.field}>{t("Modelo de camión", "Truck model")}<input {...fieldError} maxLength={80}
                    placeholder={t("Ej. Volvo FH 460", "E.g. Volvo FH 460")} value={draft.truckPreference.model}
                    onChange={event => change({ truckPreference: { ...draft.truckPreference!, model: event.target.value } })}/></label>
                    <TruckModelControls t={t} requestId={requestId} preference={draft.truckPreference} onModel={(modelAssetId,expectedPhoto)=>{
                      let accepted=false;
                      const stored=save(current=>{
                        if(current.originalRaw!==record.originalRaw||current.draft.truckPreference?.type!=="custom"||current.draft.truckPreference.photoDataUrl!==expectedPhoto)return current;
                        accepted=true;return changeLocalDraft(current,{truckPreference:{...current.draft.truckPreference,modelAssetId}},new Date().toISOString());
                      });
                      return stored&&accepted;
                    }}/>
                  </div>
                </div> : null}
              </div>
              <p className={s.wizardHint}>{t("Elige el tipo de camión que necesitas. La selección no realiza una reserva.", "Choose the truck type you need. Selection does not create a booking.")}</p>
            </section>
          </div> : null}

          {active === 2 ? <div className={s.wizardFormWidth}>
            <label className={s.field}>{t("Descripción de carga", "Cargo description")}<input {...fieldError} maxLength={120} value={draft.cargoDescription} onChange={event => change({ cargoDescription: event.target.value })}/></label>
            <div className={`${s.fields} ${s.wizardFieldRow}`}>
              <label className={s.field}>{t("Unidades", "Units")}<input {...fieldError} type="number" min={1} max={1000000} step={1} value={draft.quantity}
                onChange={event => { const value = event.target.value === "" ? 0 : event.target.valueAsNumber; if (Number.isFinite(value) && value >= 0 && value <= 1_000_000) change({ quantity: value }); }}/></label>
              <label className={s.field}>{t("Peso por unidad (kg)", "Unit weight (kg)")}<input {...fieldError} type="number" min={0} max={1000000} step="any" value={draft.unitWeightKg}
                onChange={event => { const value = event.target.value === "" ? 0 : event.target.valueAsNumber; if (Number.isFinite(value) && value >= 0 && value <= 1_000_000) change({ unitWeightKg: value }); }}/></label>
            </div><div className={s.wizardTotal}><span>{t("Peso total calculado", "Calculated total weight")}</span><strong>{total.toLocaleString(locale === "es" ? "es-PE" : "en-US")} kg</strong></div>
          </div> : null}

          {active === 3 ? <div className={s.wizardFormWidth}>
            <div className={s.fields}>
              <label className={s.field}>{t("Fecha de recogida", "Pickup date")}<input {...fieldError} name="pickupDate" type="date" value={draft.pickupDate} onChange={event => change({ pickupDate: event.target.value })}/></label>
              <label className={s.field}>{t("Fecha de entrega", "Delivery date")}<input {...fieldError} name="deliveryDate" type="date" min={draft.pickupDate || undefined} value={draft.deliveryDate} onChange={event => change({ deliveryDate: event.target.value })}/></label>
            </div>
          </div> : null}

          {active === 4 ? <RequestReview draft={draft} requestId={requestId} onEdit={go}/> : null}
        </div>
        {visibleIssue ? <p ref={errorRef} id={errorId} role="alert" tabIndex={-1} className={s.error}>
          {visibleIssue.reason === "storage" ? t("No se pudieron guardar los cambios. Inténtalo de nuevo.", "Changes could not be saved. Try again.")
            : visibleIssue.reason === "previous" ? <>{t("Comprueba primero", "Check first")}: <button type="button" onClick={() => go(visibleIssue.step ?? 0)}>{label(visibleIssue.step ?? 0)} →</button></>
              : validationCopy[active]}
        </p> : null}
        {active === 4 && draft.savedForReview ? <p className={s.wizardSuccess} role="status"><CheckCircle2 size={18} aria-hidden="true"/>{t("Solicitud revisada. Los cambios se han guardado en este dispositivo.", "Request reviewed. Changes have been saved on this device.")}</p> : null}
        <footer className={s.wizardFooter}>
          <div>{active > 0 ? <button type="button" onClick={() => go(active - 1)}><ArrowLeft size={16} aria-hidden="true"/>{t("Anterior", "Previous")}</button> : <a className={s.localButton} href="#/dashboard">{t("Volver al panel", "Back to dashboard")}</a>}</div>
          <button className={s.primary} type="submit" disabled={active === 4 && draft.savedForReview}>
            {active === 4 ? draft.savedForReview ? t("Revisión guardada", "Review saved") : t("Confirmar revisión", "Confirm review") : t("Validar y continuar", "Validate and continue")}
            {active < 4 ? <ArrowRight size={16} aria-hidden="true"/> : null}
          </button>
        </footer>
      </form>
    </ContentMotion>
  </section>;
}
