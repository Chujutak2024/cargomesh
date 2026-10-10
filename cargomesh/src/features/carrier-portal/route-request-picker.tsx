"use client";
import { ArrowUpRight, MapPin, Truck } from "lucide-react";
import type { LocalRequestEntry } from "./local-request-demo";
import { localRequestReference } from "./local-request-presentation";
import { locationLabel } from "./local-draft-controls";
import { journeySnapshot } from "./journey-model";
import s from "./route-request-picker.module.css";
import { useOperations } from "./use-operations";
import { requestOperation } from "./operations-model";
import { useLocale } from "@/features/i18n/locale-provider";
export function RouteRequestPicker({ entries, activeId, select }: { entries: LocalRequestEntry[]; activeId: string; select: (id: string) => boolean }) {
  const operations = useOperations();
  const { t, locale } = useLocale();
  return <section className={s.root} aria-label={t("Pedidos en seguimiento", "Tracked orders")}>
    <header><div className={s.title}><Truck size={19} aria-hidden="true"/><h2>{t("Pedidos en seguimiento", "Tracked orders")}</h2><span>{entries.length}</span></div>
      <p>{t("Cambia de pedido para ver su ruta.", "Choose an order to see its route.")}</p>
      <label>{t("Pedido seleccionado", "Selected order")}<select value={activeId} onChange={event => select(event.target.value)}>{entries.map(entry => <option key={entry.id} value={entry.id}>{localRequestReference(entry.id)} · {locationLabel(entry.record.draft.destinationId, locale)}</option>)}</select></label>
    </header>
    <div className={s.list}>{entries.map(entry => {
      const inactive = requestOperation(operations.state, entry.id).status === "CANCELLED";
      const journey = journeySnapshot(entry.id, 0, inactive), active = activeId === entry.id;
      const phase = inactive ? "stopped" : journey.progress >= .8 ? "arrival" : journey.progress >= .4 ? "road" : "departure";
      return <button type="button" key={entry.id} aria-pressed={active} data-phase={phase} onClick={() => select(entry.id)}>
        <div className={s.identity}><strong>{localRequestReference(entry.id)}</strong><span className={s.percent}>{Math.round(journey.progress * 100)}%</span></div>
        <small className={s.destination}><MapPin size={12} aria-hidden="true"/>{locationLabel(entry.record.draft.destinationId, locale)}{active ? <ArrowUpRight size={14} aria-hidden="true"/> : null}</small>
        <div className={s.row}><em><i aria-hidden="true"/>{journey.status}</em><span className={s.progress} aria-hidden="true"><span style={{ width: `${journey.progress * 100}%` }}/></span></div>
      </button>;
    })}</div>
  </section>;
}
