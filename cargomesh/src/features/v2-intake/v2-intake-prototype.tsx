"use client";

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ClipboardCheck,
  Info,
  MapPinned,
  Package,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useRef, useState } from "react";

import { Badge, Button, Dialog, Input, Select } from "@/components/ui";
import { useLocale } from "@/features/i18n/locale-provider";
import {
  CARGO_TYPES,
  EMPTY_PROTOTYPE_DRAFT,
  EQUIPMENT_PREFERENCES,
  PACKAGING_TYPES,
  PROTOTYPE_FACILITIES,
  PROTOTYPE_SCENARIO,
  PROVISIONAL_PROTOTYPE_DRAFT,
  findPrototypeFacility,
  getPrototypeFacilityScenarioRole,
  getPrototypeEvidence,
  validatePrototypeReview,
  validatePrototypeStep,
  type PrototypeStep,
  type PrototypeValidationIssue,
  type V2IntakePrototypeDraft,
} from "./prototype-model";
import styles from "./v2-intake-prototype.module.css";

const STEP_ICONS = [MapPinned, Package, CalendarDays, ClipboardCheck] as const;

export function V2IntakePrototype() {
  const { locale, t } = useLocale();
  const [draft, setDraft] = useState<V2IntakePrototypeDraft>(EMPTY_PROTOTYPE_DRAFT);
  const [step, setStep] = useState<PrototypeStep>(1);
  const [maxVisited, setMaxVisited] = useState<PrototypeStep>(1);
  const [issues, setIssues] = useState<PrototypeValidationIssue[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  const origin = findPrototypeFacility(draft.originFacilityId);
  const destination = findPrototypeFacility(draft.destinationFacilityId);
  const evidence = getPrototypeEvidence(draft);
  const stepLabels = [
    t("Sedes y ubicación", "Facilities & location"),
    t("Carga y volumen", "Cargo & volume"),
    t("Fecha y equipo", "Date & equipment"),
    t("Resumen", "Summary"),
  ];

  const update = (field: keyof V2IntakePrototypeDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setIssues((current) => current.filter((issue) => issue.field !== field));
  };
  const errorFor = (field: keyof V2IntakePrototypeDraft) => {
    const issue = issues.find((candidate) => candidate.field === field);
    if (!issue) return undefined;
    if (issue.code === "same-facility") return t("Origen y destino deben ser sedes distintas.", "Origin and destination must be different facilities.");
    if (issue.code === "positive-number") return t("Ingresa un número mayor que cero.", "Enter a number greater than zero.");
    if (issue.code === "invalid-date") return t("Ingresa una fecha válida.", "Enter a valid date.");
    return t("Este campo es obligatorio.", "This field is required.");
  };
  const focusValidationSummary = () => {
    requestAnimationFrame(() => errorRef.current?.focus());
  };
  const enterReview = () => {
    const validation = validatePrototypeReview(draft);
    if (!validation.valid) {
      setStep(validation.invalidStep);
      setIssues(validation.issues);
      focusValidationSummary();
      return false;
    }

    setIssues([]);
    setStep(4);
    setMaxVisited((current) => Math.max(current, 4) as PrototypeStep);
    return true;
  };
  const goNext = () => {
    const nextIssues = validatePrototypeStep(step, draft);
    setIssues(nextIssues);
    if (nextIssues.length) {
      focusValidationSummary();
      return;
    }
    if (step < 4) {
      const next = (step + 1) as PrototypeStep;
      if (next === 4) {
        enterReview();
        return;
      }
      setStep(next);
      setMaxVisited((current) => Math.max(current, next) as PrototypeStep);
    }
  };
  const confirmPrototype = () => {
    if (enterReview()) setDialogOpen(true);
  };
  const loadExample = () => {
    setDraft(PROVISIONAL_PROTOTYPE_DRAFT);
    setIssues([]);
  };
  const reset = () => {
    setDraft(EMPTY_PROTOTYPE_DRAFT);
    setStep(1);
    setMaxVisited(1);
    setIssues([]);
  };

  return (
    <div className={styles.page}>
      <div className={styles.frame}>
        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>{t("CargoMesh V2 · Sprint 1", "CargoMesh V2 · Sprint 1")}</span>
            <h1>{t("Prototipo de solicitud de transporte", "Freight request prototype")}</h1>
            <p>{t(
              "Valida la captura de sedes, carga y preferencias antes de conectar persistencia, subasta o selección de transportistas.",
              "Validate facilities, cargo, and preferences before connecting persistence, bidding, or carrier selection.",
            )}</p>
          </div>
          <div className={styles.heroActions}>
            <Badge tone="preliminary">{t("Escenario sintético V2", "Synthetic V2 scenario")}</Badge>
            <Button variant="secondary" type="button" onClick={loadExample}><Sparkles size={16} aria-hidden="true" />{t("Cargar ejemplo V2", "Load V2 example")}</Button>
          </div>
        </header>

        <div className={styles.notice} role="note">
          <Info size={18} aria-hidden="true" />
          <div><strong>{t("Vista de validación sin guardado", "Validation view without saving")}</strong><span>{t("Los cambios permanecen sólo en este navegador. Elegir sedes no confirma ruta, cobertura, capacidad ni precio; tampoco crea o persiste una solicitud.", "Changes remain only in this browser. Selecting facilities does not confirm a route, coverage, capacity, or price; it also does not create or persist a request.")}</span></div>
        </div>

        <nav className={styles.stepper} aria-label={t("Pasos del prototipo", "Prototype steps")}>
          {stepLabels.map((label, index) => {
            const number = (index + 1) as PrototypeStep;
            const Icon = STEP_ICONS[index];
            const active = step === number;
            const complete = step > number;
            return (
              <button
                className={`${styles.stepButton} ${active ? styles.stepButtonActive : ""} ${complete ? styles.stepButtonComplete : ""}`}
                disabled={number > maxVisited}
                key={label}
                type="button"
                aria-current={active ? "step" : undefined}
                onClick={() => {
                  if (number === 4) {
                    enterReview();
                    return;
                  }
                  setStep(number);
                  setIssues([]);
                }}
              >
                <span className={styles.stepNumber}>{complete ? <Check size={15} aria-hidden="true" /> : <Icon size={15} aria-hidden="true" />}</span>
                <span className={styles.stepCopy}><small>{t(`Paso ${number}`, `Step ${number}`)}</small><strong>{label}</strong></span>
              </button>
            );
          })}
        </nav>

        <div className={styles.workspace}>
          <section className={styles.card} aria-labelledby={`prototype-step-${step}`}>
            <header className={styles.cardHeader}>
              <div><span className={styles.eyebrow}>{t(`Paso ${step} de 4`, `Step ${step} of 4`)}</span><h2 id={`prototype-step-${step}`}>{stepLabels[step - 1]}</h2><p>{stepDescription(step, t)}</p></div>
              <Badge tone={step === 4 ? "confirmed" : "preliminary"}>{step === 4 ? t("Listo para validar", "Ready to validate") : t("Entrada preliminar", "Preliminary input")}</Badge>
            </header>

            <div className={styles.cardBody}>
              {issues.length ? <div className={styles.errorSummary} role="alert" tabIndex={-1} ref={errorRef}><strong>{t("Revisa los campos marcados", "Review the marked fields")}</strong><span>{t(`Hay ${issues.length} dato(s) pendiente(s) en este paso.`, `There are ${issues.length} pending field(s) in this step.`)}</span></div> : null}
              {step === 1 ? <FacilityStep draft={draft} update={update} errorFor={errorFor} t={t} origin={origin} destination={destination} /> : null}
              {step === 2 ? <CargoStep draft={draft} update={update} errorFor={errorFor} t={t} /> : null}
              {step === 3 ? <ScheduleStep draft={draft} update={update} errorFor={errorFor} t={t} /> : null}
              {step === 4 ? <ReviewStep draft={draft} t={t} origin={origin} destination={destination} locale={locale} /> : null}
            </div>

            <footer className={styles.footer}>
              <Button variant="ghost" type="button" onClick={reset}><RotateCcw size={16} aria-hidden="true" />{t("Reiniciar", "Reset")}</Button>
              <div className={styles.footerRight}>
                {step > 1 ? <Button variant="secondary" type="button" onClick={() => { setStep((step - 1) as PrototypeStep); setIssues([]); }}><ArrowLeft size={16} aria-hidden="true" />{t("Anterior", "Back")}</Button> : null}
                {step < 4 ? <Button type="button" onClick={goNext}>{t("Continuar", "Continue")}<ArrowRight size={16} aria-hidden="true" /></Button> : <Button variant="accent" type="button" onClick={confirmPrototype}><ClipboardCheck size={16} aria-hidden="true" />{t("Validar prototipo", "Validate prototype")}</Button>}
              </div>
            </footer>
          </section>

          <aside className={`${styles.card} ${styles.summary}`} aria-label={t("Resumen en vivo", "Live summary")}>
            <header className={styles.cardHeader}><div><span className={styles.eyebrow}>{t("Resumen en vivo", "Live summary")}</span><h2>{t("Solicitud preliminar", "Preliminary request")}</h2><p>{t("Los estados indican el nivel de evidencia disponible.", "Statuses show the available evidence level.")}</p></div></header>
            <div className={styles.summaryBody}>
              <SummaryRow label={t("Origen", "Origin")} value={origin ? `${origin.name} · ${origin.city}, ${origin.countryCode}` : t("Sin seleccionar", "Not selected")} tone={origin ? "preliminary" : "neutral"} status={origin ? t("Preliminar", "Preliminary") : t("Pendiente", "Pending")} />
              <SummaryRow label={t("Destino", "Destination")} value={destination ? `${destination.name} · ${destination.city}, ${destination.countryCode}` : t("Sin seleccionar", "Not selected")} tone={destination ? "preliminary" : "neutral"} status={destination ? t("Preliminar", "Preliminary") : t("Pendiente", "Pending")} />
              <SummaryRow label={t("Carga", "Cargo")} value={draft.cargoDescription || t("Sin describir", "Not described")} tone={draft.cargoDescription ? "preliminary" : "neutral"} status={draft.cargoDescription ? t("Preliminar", "Preliminary") : t("Pendiente", "Pending")} />
              <SummaryRow label={t("Ruta y cobertura", "Route & coverage")} value={t("No evaluadas en HAC-24", "Not evaluated in HAC-24")} tone={evidence.route.status} status={t("Desconocido", "Unknown")} hint={t("Las sedes seleccionadas no confirman ruta, cobertura, capacidad, precio ni persistencia.", "Selected facilities do not confirm route, coverage, capacity, price, or persistence.")} />
              <SummaryRow label={t("Modo", "Mode")} value="ROAD" tone={evidence.transportMode.status} status={t("Confirmado", "Confirmed")} />
            </div>
            <div className={styles.statusLegend}>
              <Legend tone="preliminary" label={t("Preliminar", "Preliminary")} text={t("Dato editable del prototipo.", "Editable prototype data.")} />
              <Legend tone="unknown" label={t("Desconocido", "Unknown")} text={t("Sin evidencia suficiente; no equivale a no.", "Insufficient evidence; it does not mean no.")} />
              <Legend tone="confirmed" label={t("Confirmado", "Confirmed")} text={t("Definido por el contrato V2 aprobado.", "Defined by the approved V2 contract.")} />
            </div>
          </aside>
        </div>
      </div>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={t("Prototipo validado", "Prototype validated")} description={t("HAC-24 · Hito de diseño y navegación", "HAC-24 · Design and navigation milestone")} closeLabel={t("Cerrar", "Close")}>
        <div className={styles.dialogMessage}><Badge tone="confirmed">{t("Flujo navegable completado", "Navigable flow completed")}</Badge><p><strong>{t("No se envió ninguna solicitud.", "No request was submitted.")}</strong> {t("Esta confirmación sólo demuestra la navegación, validación y semántica V2. La persistencia, subasta y consulta de carriers se conectarán en un sprint posterior.", "This confirmation only demonstrates V2 navigation, validation, and semantics. Persistence, bidding, and carrier queries will be connected in a later sprint.")}</p></div>
      </Dialog>
    </div>
  );
}

type Translate = (spanish: string, english: string) => string;
type FieldHelpers = {
  draft: V2IntakePrototypeDraft;
  update: (field: keyof V2IntakePrototypeDraft, value: string) => void;
  errorFor: (field: keyof V2IntakePrototypeDraft) => string | undefined;
  t: Translate;
};

function FacilityStep({ draft, update, errorFor, t, origin, destination }: FieldHelpers & { origin: ReturnType<typeof findPrototypeFacility>; destination: ReturnType<typeof findPrototypeFacility> }) {
  return <><h3 className={styles.sectionTitle}><MapPinned size={16} aria-hidden="true" />{t("Selecciona sedes del escenario sintético V2", "Select facilities from the synthetic V2 scenario")}</h3><div className={styles.scenarioMeta}><Badge tone="preliminary">{PROTOTYPE_SCENARIO.provenance}</Badge><span>{PROTOTYPE_SCENARIO.packageName}</span></div><div className={styles.formGrid}><Select label={t("Sede de origen", "Origin facility")} value={draft.originFacilityId} error={errorFor("originFacilityId")} hint={t("Catálogo sintético alineado con v2-road-baseline.", "Synthetic catalog aligned with v2-road-baseline.")} onChange={(event) => update("originFacilityId", event.target.value)}><option value="">{t("Seleccionar origen", "Select origin")}</option>{PROTOTYPE_FACILITIES.map((facility) => <option value={facility.id} key={facility.id}>{facility.name} · {facility.city}, {facility.countryCode}</option>)}</Select><Select label={t("Sede de destino", "Destination facility")} value={draft.destinationFacilityId} error={errorFor("destinationFacilityId")} hint={t("Debe ser distinta a la sede de origen.", "Must differ from the origin facility.")} onChange={(event) => update("destinationFacilityId", event.target.value)}><option value="">{t("Seleccionar destino", "Select destination")}</option>{PROTOTYPE_FACILITIES.map((facility) => <option value={facility.id} key={facility.id}>{facility.name} · {facility.city}, {facility.countryCode}</option>)}</Select>{origin ? <FacilityCard facility={origin} t={t} /> : null}{destination ? <FacilityCard facility={destination} t={t} /> : null}</div><div className={styles.boundaryNotice} role="note"><Info size={16} aria-hidden="true" /><span>{t("La selección sólo identifica puntos del intake. No confirma ruta, cobertura carrier, capacidad, precio ni persistencia.", "Selection only identifies intake points. It does not confirm a route, carrier coverage, capacity, price, or persistence.")}</span></div><RoutePreview t={t} /></>;
}

function FacilityCard({ facility, t }: { facility: NonNullable<ReturnType<typeof findPrototypeFacility>>; t: Translate }) {
  const scenarioRole = getPrototypeFacilityScenarioRole(facility.id);
  const scenarioNote = scenarioRole === "NO_DECLARED_COVERAGE"
    ? t("El baseline no declara área de servicio ni lane para Piura.", "The baseline declares no service area or lane for Piura.")
    : t("Punto del ejemplo Lima → Arequipa; aún requiere evaluación operativa.", "Endpoint in the Lima → Arequipa example; operational evaluation is still required.");
  return <article className={styles.siteCard}><div className={styles.siteMeta}><Badge tone="preliminary">{t("Sintético", "Synthetic")}</Badge><Badge tone="confirmed">V2Facility</Badge></div><strong>{facility.code} · {facility.name}</strong><span>{facility.addressLine} · {facility.city}, {facility.countryCode}</span><small>{scenarioNote}</small></article>;
}

function RoutePreview({ t }: { t: Translate }) {
  return <section className={styles.routePreview} aria-label={t("Interfaz provisional del mapa", "Provisional map interface")}><div className={styles.routeTop}><div><h3>{t("Interfaz de ruta", "Route interface")}</h3><p>{t("Espacio acordado para integrar el resultado cartográfico de HAC-25 sin asumir datos.", "Reserved space to integrate the HAC-25 map result without assuming data.")}</p></div><Badge tone="unknown">{t("Mapa desconocido", "Map unknown")}</Badge></div><div className={styles.routeLine} aria-hidden="true"><span /></div><div className={styles.unknownGrid}><UnknownItem label={t("Distancia", "Distance")} t={t} /><UnknownItem label="ETA" t={t} /><UnknownItem label={t("Cobertura", "Coverage")} t={t} /></div></section>;
}

function UnknownItem({ label, t }: { label: string; t: Translate }) {
  return <div className={styles.unknownItem}><small>{label}</small><strong>{t("Desconocido", "Unknown")}</strong></div>;
}

function CargoStep({ draft, update, errorFor, t }: FieldHelpers) {
  return <><h3 className={styles.sectionTitle}><Package size={16} aria-hidden="true" />{t("Describe la unidad de transporte", "Describe the transport unit")}</h3><div className={styles.formGrid}><Select label={t("Tipo de carga", "Cargo type")} value={draft.cargoType} error={errorFor("cargoType")} onChange={(event) => update("cargoType", event.target.value)}><option value="">{t("Seleccionar taxonomía", "Select taxonomy")}</option>{CARGO_TYPES.map((value) => <option value={value} key={value}>{cargoLabel(value, t)}</option>)}</Select><Select label={t("Embalaje", "Packaging")} value={draft.packagingType} error={errorFor("packagingType")} onChange={(event) => update("packagingType", event.target.value)}><option value="">{t("Seleccionar embalaje", "Select packaging")}</option>{PACKAGING_TYPES.map((value) => <option value={value} key={value}>{packagingLabel(value, t)}</option>)}</Select><Input fieldClassName={styles.wide} label={t("Descripción de la carga", "Cargo description")} value={draft.cargoDescription} error={errorFor("cargoDescription")} placeholder={t("Ej. equipos de mantenimiento industrial", "E.g. industrial maintenance equipment")} onChange={(event) => update("cargoDescription", event.target.value)} /><Input label={t("Peso total (kg)", "Total weight (kg)")} type="number" min="0" step="1" inputMode="decimal" value={draft.weightKg} error={errorFor("weightKg")} onChange={(event) => update("weightKg", event.target.value)} /><Input label={t("Volumen total (m³)", "Total volume (m³)")} type="number" min="0" step="0.1" inputMode="decimal" value={draft.volumeM3} error={errorFor("volumeM3")} hint={t("CBM preliminar; no calcula capacidad de carrier.", "Preliminary CBM; it does not calculate carrier capacity.")} onChange={(event) => update("volumeM3", event.target.value)} /></div></>;
}

function ScheduleStep({ draft, update, errorFor, t }: FieldHelpers) {
  return <><h3 className={styles.sectionTitle}><CalendarDays size={16} aria-hidden="true" />{t("Indica la necesidad operativa", "Describe the operational need")}</h3><div className={styles.formGrid}><Input label={t("Fecha de retiro", "Pickup date")} type="date" value={draft.pickupDate} error={errorFor("pickupDate")} onChange={(event) => update("pickupDate", event.target.value)} /><Select label={t("Preferencia de equipo", "Equipment preference")} value={draft.equipmentPreference} error={errorFor("equipmentPreference")} hint={t("Preferencia, no confirmación de disponibilidad.", "Preference, not an availability confirmation.")} onChange={(event) => update("equipmentPreference", event.target.value)}>{EQUIPMENT_PREFERENCES.map((value) => <option value={value} key={value}>{equipmentLabel(value, t)}</option>)}</Select><Input fieldClassName={styles.wide} label={t("Notas operativas (opcional)", "Operational notes (optional)")} value={draft.notes} placeholder={t("Restricciones o contexto para revisión posterior", "Constraints or context for later review")} onChange={(event) => update("notes", event.target.value)} /></div><section className={styles.routePreview}><div className={styles.routeTop}><div><h3>{t("Disponibilidad de equipo", "Equipment availability")}</h3><p>{t("La preferencia será evaluada cuando existan servicios y evidencia de capacidad.", "The preference will be evaluated when services and capacity evidence exist.")}</p></div><Badge tone="unknown">{t("Desconocido", "Unknown")}</Badge></div></section></>;
}

function ReviewStep({ draft, t, origin, destination, locale }: { draft: V2IntakePrototypeDraft; t: Translate; origin: ReturnType<typeof findPrototypeFacility>; destination: ReturnType<typeof findPrototypeFacility>; locale: "es" | "en" }) {
  const date = draft.pickupDate ? new Intl.DateTimeFormat(locale === "es" ? "es-PE" : "en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${draft.pickupDate}T00:00:00Z`)) : t("Pendiente", "Pending");
  return <div className={styles.reviewGrid}><ReviewSection title={t("Sedes", "Facilities")} tone="preliminary" status={t("Preliminar", "Preliminary")} items={[[t("Origen", "Origin"), origin ? `${origin.name} · ${origin.city}` : t("Pendiente", "Pending")], [t("Destino", "Destination"), destination ? `${destination.name} · ${destination.city}` : t("Pendiente", "Pending")]]} /><ReviewSection title={t("Carga", "Cargo")} tone="preliminary" status={t("Preliminar", "Preliminary")} items={[[t("Tipo", "Type"), cargoLabel(draft.cargoType, t)], [t("Embalaje", "Packaging"), packagingLabel(draft.packagingType, t)], [t("Peso / volumen", "Weight / volume"), `${draft.weightKg} kg · ${draft.volumeM3} m³`], [t("Descripción", "Description"), draft.cargoDescription]]} /><ReviewSection title={t("Planificación", "Planning")} tone="preliminary" status={t("Preliminar", "Preliminary")} items={[[t("Retiro", "Pickup"), date], [t("Equipo preferido", "Preferred equipment"), equipmentLabel(draft.equipmentPreference, t)]]} /><ReviewSection title={t("Evidencia operativa", "Operational evidence")} tone="unknown" status={t("Desconocido", "Unknown")} items={[[t("Ruta / cobertura / capacidad", "Route / coverage / capacity"), t("No confirmadas por seleccionar sedes", "Not confirmed by facility selection")], [t("Disponibilidad / precio / ofertas", "Availability / price / offers"), t("No consultados en este prototipo", "Not queried in this prototype")], [t("Persistencia", "Persistence"), t("No conectada; no se crea solicitud", "Not connected; no request is created")]]} /></div>;
}

function ReviewSection({ title, tone, status, items }: { title: string; tone: "preliminary" | "unknown"; status: string; items: string[][] }) {
  return <section className={styles.reviewSection}><header><h3>{title}</h3><Badge tone={tone}>{status}</Badge></header><div className={styles.reviewList}>{items.map(([label, value]) => <div className={styles.reviewItem} key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></section>;
}

function SummaryRow({ label, value, tone, status, hint }: { label: string; value: string; tone: "preliminary" | "unknown" | "confirmed" | "neutral"; status: string; hint?: string }) {
  return <div className={styles.summaryRow}><span>{label}</span><div className={styles.summaryValue}><strong>{value}</strong><Badge tone={tone}>{status}</Badge></div>{hint ? <small className={styles.summaryHint}>{hint}</small> : null}</div>;
}

function Legend({ tone, label, text }: { tone: "preliminary" | "unknown" | "confirmed"; label: string; text: string }) {
  return <div className={styles.legendItem}><Badge tone={tone}>{label}</Badge><span>{text}</span></div>;
}

function stepDescription(step: PrototypeStep, t: Translate) {
  const descriptions = [t("Elige puntos operativos del catálogo V2 provisional.", "Choose operational points from the provisional V2 catalog."), t("Captura taxonomía, peso y CBM sin inferir capacidad.", "Capture taxonomy, weight, and CBM without inferring capacity."), t("Registra fecha y preferencia sin prometer disponibilidad.", "Record date and preference without promising availability."), t("Distingue datos preliminares, desconocidos y confirmados.", "Distinguish preliminary, unknown, and confirmed data.")];
  return descriptions[step - 1];
}

function cargoLabel(value: string, t: Translate) {
  return ({ MINING_PARTS: t("Repuestos mineros", "Mining parts"), INDUSTRIAL_SUPPLIES: t("Suministros industriales", "Industrial supplies"), GENERAL_CARGO: t("Carga general", "General cargo"), OTHER: t("Otro", "Other") } as Record<string, string>)[value] ?? t("Pendiente", "Pending");
}

function packagingLabel(value: string, t: Translate) {
  return ({ PALLET: t("Pallet", "Pallet"), CRATE: t("Cajón", "Crate"), BULK: t("Granel", "Bulk"), OTHER: t("Otro", "Other") } as Record<string, string>)[value] ?? t("Pendiente", "Pending");
}

function equipmentLabel(value: string, t: Translate) {
  return ({ NO_PREFERENCE: t("Sin preferencia", "No preference"), DRY_VAN: t("Furgón seco", "Dry van"), FLATBED: t("Plataforma", "Flatbed"), LOWBOY: t("Cama baja", "Lowboy") } as Record<string, string>)[value] ?? t("Pendiente", "Pending");
}
