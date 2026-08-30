"use client";

import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  Building2,
  CalendarClock,
  Check,
  FileCheck2,
  MapPin,
  PackageCheck,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import type { FreightIntakeModel } from "@/features/freight-ui/view-models";
import styles from "./freight-intake-form.module.css";

const steps = [
  { label: "Organización", icon: Building2 },
  { label: "Ruta", icon: MapPin },
  { label: "Carga", icon: Boxes },
  { label: "Programación", icon: CalendarClock },
  { label: "Revisión", icon: PackageCheck },
];

const documentOptions = ["Factura comercial", "Packing list", "Ficha técnica"];

export function FreightIntakeForm({ initialValue }: { initialValue: FreightIntakeModel }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initialValue);

  const totals = useMemo(() => ({
    weightKg: form.quantity * form.unitWeightKg,
    volumeM3: form.quantity * form.lengthCm * form.widthCm * form.heightCm / 1_000_000,
  }), [form.heightCm, form.lengthCm, form.quantity, form.unitWeightKg, form.widthCm]);

  function update<K extends keyof FreightIntakeModel>(key: K, value: FreightIntakeModel[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleDocument(document: string) {
    setForm((current) => ({
      ...current,
      documents: current.documents.includes(document)
        ? current.documents.filter((item) => item !== document)
        : [...current.documents, document],
    }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < steps.length - 1) {
      setStep((current) => current + 1);
      return;
    }
    router.push(`/dispatch/${encodeURIComponent(form.requestId)}?fixture=three`);
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>B-02 · Intake de carga</span>
          <h1>Nueva solicitud de transporte</h1>
          <p>Revisa el perfil sugerido, ajusta la operación y confirma la búsqueda de opciones.</p>
        </div>
        <div className={styles.draftBadge}><ShieldCheck size={16} aria-hidden="true" /> Borrador seguro</div>
      </header>

      <ol className={styles.stepper} aria-label="Progreso del formulario">
        {steps.map(({ label, icon: Icon }, index) => (
          <li key={label}>
            <button
              type="button"
              className={`${styles.step} ${index === step ? styles.stepActive : ""} ${index < step ? styles.stepDone : ""}`}
              aria-current={index === step ? "step" : undefined}
              onClick={() => setStep(index)}
            >
              <span>{index < step ? <Check size={16} aria-hidden="true" /> : <Icon size={16} aria-hidden="true" />}</span>
              <small>Paso {index + 1}</small>
              <strong>{label}</strong>
            </button>
          </li>
        ))}
      </ol>

      <form className={styles.formLayout} onSubmit={submit}>
        <section className={styles.formCard} aria-labelledby={`step-title-${step}`}>
          {step === 0 ? (
            <>
              <FormHeading id="step-title-0" title="Organización y solicitante" description="El contexto empresarial se aplica sin convertirlo en una identidad de acceso." />
              <div className={styles.fieldGrid}>
                <Field label="Organización activa"><input value={form.organization} readOnly /></Field>
                <Field label="Solicitante"><input value={form.requester} readOnly /></Field>
                <Field label="Perfil habitual" wide>
                  <select value={form.cargoProfile} onChange={(event) => update("cargoProfile", event.target.value)}>
                    <option>Repuestos y maquinaria minera</option>
                    <option>Carga general paletizada</option>
                    <option>Equipos industriales</option>
                  </select>
                </Field>
              </div>
              <InfoBox>El perfil autocompleta valores sugeridos. Todos pueden revisarse antes de confirmar.</InfoBox>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <FormHeading id="step-title-1" title="Origen y destino" description="Define el corredor y los contactos operativos de recojo y entrega." />
              <div className={styles.fieldGrid}>
                <Field label="Origen"><input required value={form.origin} onChange={(event) => update("origin", event.target.value)} /></Field>
                <Field label="Destino"><input required value={form.destination} onChange={(event) => update("destination", event.target.value)} /></Field>
                <Field label="Contacto de recojo"><input required value={form.pickupContact} onChange={(event) => update("pickupContact", event.target.value)} /></Field>
                <Field label="Contacto de entrega"><input required value={form.deliveryContact} onChange={(event) => update("deliveryContact", event.target.value)} /></Field>
                <Field label="Paso fronterizo" wide><input value={form.borderCrossing} onChange={(event) => update("borderCrossing", event.target.value)} /></Field>
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <FormHeading id="step-title-2" title="Características de la carga" description="La normalización se actualiza desde la cantidad, el peso y las dimensiones unitarias." />
              <div className={styles.fieldGrid}>
                <Field label="Categoría"><input required value={form.cargoCategory} onChange={(event) => update("cargoCategory", event.target.value)} /></Field>
                <Field label="Método de ingreso">
                  <select value={form.entryMethod} onChange={(event) => update("entryMethod", event.target.value)}>
                    <option>Pallets</option><option>Bultos</option><option>Maquinaria</option><option>Sacos</option>
                  </select>
                </Field>
                <Field label="Cantidad"><input min="1" required type="number" value={form.quantity} onChange={(event) => update("quantity", Number(event.target.value))} /></Field>
                <Field label="Peso unitario (kg)"><input min="1" required type="number" value={form.unitWeightKg} onChange={(event) => update("unitWeightKg", Number(event.target.value))} /></Field>
                <Field label="Largo (cm)"><input min="1" required type="number" value={form.lengthCm} onChange={(event) => update("lengthCm", Number(event.target.value))} /></Field>
                <Field label="Ancho (cm)"><input min="1" required type="number" value={form.widthCm} onChange={(event) => update("widthCm", Number(event.target.value))} /></Field>
                <Field label="Alto (cm)"><input min="1" required type="number" value={form.heightCm} onChange={(event) => update("heightCm", Number(event.target.value))} /></Field>
              </div>
              <div className={styles.totals} aria-live="polite">
                <div><small>Peso normalizado</small><strong>{totals.weightKg.toLocaleString("es-PE")} kg</strong></div>
                <div><small>Volumen normalizado</small><strong>{totals.volumeM3.toLocaleString("es-PE", { maximumFractionDigits: 2 })} m³</strong></div>
              </div>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <FormHeading id="step-title-3" title="Programación y políticas" description="Configura la ventana, el presupuesto y los documentos disponibles." />
              <div className={styles.fieldGrid}>
                <Field label="Fecha y hora de recojo"><input required type="datetime-local" value={form.pickupDate} onChange={(event) => update("pickupDate", event.target.value)} /></Field>
                <Field label="Presupuesto máximo (USD)"><input min="1" required type="number" value={form.budgetMaxUsd} onChange={(event) => update("budgetMaxUsd", Number(event.target.value))} /></Field>
                <Field label="Estrategia"><input value={form.strategy} readOnly /></Field>
              </div>
              <fieldset className={styles.documentFieldset}>
                <legend>Documentos disponibles</legend>
                {documentOptions.map((document) => (
                  <label key={document}><input type="checkbox" checked={form.documents.includes(document)} onChange={() => toggleDocument(document)} /> <span>{document}</span></label>
                ))}
              </fieldset>
            </>
          ) : null}

          {step === 4 ? (
            <>
              <FormHeading id="step-title-4" title="Revisión y confirmación" description="Confirma que la intención logística esté completa antes de evaluar providers." />
              <div className={styles.reviewGrid}>
                <ReviewItem label="Organización" value={`${form.organization} · ${form.requester}`} />
                <ReviewItem label="Ruta" value={`${form.origin} → ${form.destination}`} />
                <ReviewItem label="Carga" value={`${form.quantity} ${form.entryMethod.toLowerCase()} · ${totals.weightKg.toLocaleString("es-PE")} kg · ${totals.volumeM3.toFixed(1)} m³`} />
                <ReviewItem label="Política" value={`${form.strategy} · Presupuesto $${form.budgetMaxUsd.toLocaleString("en-US")} USD`} />
                <ReviewItem label="Documentos" value={form.documents.length ? form.documents.join(", ") : "Sin documentos adjuntos"} />
              </div>
              <div className={styles.readyNotice}><FileCheck2 size={20} aria-hidden="true" /><span><strong>Solicitud completa y lista para evaluación</strong><small>La capacidad real se validará mediante WebMCP durante el dispatch.</small></span></div>
            </>
          ) : null}

          <footer className={styles.actions}>
            <button type="button" className={styles.secondaryButton} disabled={step === 0} onClick={() => setStep((current) => current - 1)}><ArrowLeft size={17} aria-hidden="true" /> Anterior</button>
            <button type="submit" className={styles.primaryButton}>{step === steps.length - 1 ? "Confirmar y buscar opciones" : "Continuar"}<ArrowRight size={17} aria-hidden="true" /></button>
          </footer>
        </section>

        <aside className={styles.summaryCard} aria-label="Resumen de la solicitud">
          <span className={styles.eyebrow}>Resumen en vivo</span>
          <h2>{form.requestId}</h2>
          <dl>
            <div><dt>Corredor</dt><dd>{form.origin}<br />{form.destination}</dd></div>
            <div><dt>Carga</dt><dd>{totals.weightKg.toLocaleString("es-PE")} kg · {totals.volumeM3.toFixed(1)} m³</dd></div>
            <div><dt>Presupuesto</dt><dd>${form.budgetMaxUsd.toLocaleString("en-US")} USD</dd></div>
            <div><dt>Estrategia</dt><dd>{form.strategy}</dd></div>
          </dl>
          <p><ShieldCheck size={16} aria-hidden="true" /> Los datos son fixtures editables de B-02; no se realizan consultas privilegiadas.</p>
        </aside>
      </form>
    </div>
  );
}

function FormHeading({ id, title, description }: { id: string; title: string; description: string }) {
  return <header className={styles.formHeading}><span className={styles.eyebrow}>Configuración</span><h2 id={id}>{title}</h2><p>{description}</p></header>;
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={wide ? styles.fieldWide : undefined}><span>{label}</span>{children}</label>;
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return <p className={styles.infoBox}><ShieldCheck size={17} aria-hidden="true" /> {children}</p>;
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return <div><small>{label}</small><strong>{value}</strong></div>;
}
