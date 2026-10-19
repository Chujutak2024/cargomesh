"use client";
import {navigateJuanHash} from "./juan-navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocale } from "@/features/i18n/locale-provider";
import { LogisticsTruck } from "@/features/logistics-3d/logistics-truck";
import { importLocalDraft, LEGACY_ORIGIN, type LocalDraftEnvelope } from "./local-draft-model";
import { localDraftStepHref } from "./local-draft-flow";
import { LocalRoute } from "./local-draft-controls";
import { LocalDraftWizard } from "./local-draft-wizard";
import { LocalRequestDirectory } from "./local-request-directory";
import { LocalDashboard } from "./local-dashboard";
import {LocalRouteWorkspace} from "./local-route-workspace";
import {useOperations} from "./use-operations";
import {requestOperation} from "./operations-model";
import {useFleetDemo} from "./use-fleet-demo";
import {demoFleetVehicles} from "./fleet-demo";
import {TruckInspection} from "./truck-inspection";
import {inspectRequest} from "./truck-inspection-model";
import {type TruckPreference, truckLabel } from "./local-truck-preference";
import type { SaveLocalDraft } from "./use-local-draft";
import type { LocalRequestEntry } from "./local-request-demo";
import s from "./portal.module.css";
type Props = { record: LocalDraftEnvelope; view: string; save: SaveLocalDraft; entries: LocalRequestEntry[]; activeId: string; select: (id: string) => boolean };
export function LocalDraftWorkspace({ record, view, save, entries, activeId, select }: Props) {
  const { locale, t } = useLocale(), draft = record.draft;
  const operations=useOperations(),operation=requestOperation(operations.state,activeId);
  const {demo}=useFleetDemo(operations.inventory,operations.ready);
  const vehicles=useMemo(()=>demoFleetVehicles(demo,operations.inventory),[demo,operations.inventory]);
  const assigned=operation.status!=="CANCELLED"?vehicles.find(v=>v.id===operation.vehicleId):undefined;
  const [inspecting,setInspecting]=useState(false);
  useEffect(()=>setInspecting(false),[activeId,view]);
  const inspection=useMemo(()=>inspectRequest(draft,activeId,operations.state.carriers,assigned,operation.carrierId),[draft,activeId,operations.state.carriers,assigned,operation.carrierId]);
  const show=(content:ReactNode)=><>{content}{inspecting?<TruckInspection key={activeId} context={inspection} onClose={()=>setInspecting(false)}/>:null}</>;
  const preferredTruck:TruckPreference|null = assigned&&operation.status!=="CANCELLED"?{type:assigned.variant,model:assigned.model??"",photoDataUrl:assigned.photoDataUrl??null}:draft.truckPreference;
  const truckVisual = <LogisticsTruck compact variant={preferredTruck?.type === "custom" ? undefined : preferredTruck?.type}
    onInspect={()=>setInspecting(true)} suspended={inspecting}
    custom={preferredTruck?.type === "custom"} modelAssetId={preferredTruck?.type === "custom" ? preferredTruck.modelAssetId : null}
    label={preferredTruck ? truckLabel(preferredTruck, locale) : t("Camión de referencia", "Reference truck")}
    photo={preferredTruck?.type === "custom" ? preferredTruck.photoDataUrl : null}
    caption={preferredTruck?.type === "custom" ? preferredTruck.photoDataUrl
      ? t("Foto de tu camión preferido · sin asignación", "Preferred truck photo · not assigned")
      : t("Visual genérico · modelo 3D de tu camión no disponible", "Generic visual · your truck's 3D model is unavailable") : undefined}/>;
  if (view === "tracking") return show(<LocalRouteWorkspace requestId={activeId} draft={draft} entries={entries} select={select} onInspect={()=>setInspecting(true)}/>);
  if (view === "shipments") return show(<LocalRequestDirectory record={record} truckVisual={truckVisual} entries={entries} activeId={activeId}
    onOpen={id => { if (select(id)) navigateJuanHash(`/shipments/details/${id}`); }}
    onRoute={id => { if (select(id)) navigateJuanHash("/tracking"); }}/>);
  if (view === "request" || view === "desk") return operation.status==="CANCELLED"?<section className={s.card}><h2>Solicitud cancelada</h2><p>{operation.cancelReason}</p><a href="#/tracking">Consultar historial</a></section>:<LocalDraftWizard key={activeId} requestId={activeId} record={record} save={save}/>;
  return show(<LocalDashboard record={record} entries={entries} activeId={activeId} select={select} truckVisual={truckVisual}/>);
}

export function LocalDraftRecovery({ phase, retry, save }: { phase: string; retry: () => void; save: SaveLocalDraft }) {
  const { t } = useLocale(); const [raw, setRaw] = useState(""), [message, setMessage] = useState("");
  return <div className={s.localRecovery}>
    {phase !== "ready" ? <p role="status">{phase === "reading" ? t("Recuperando la solicitud guardada…", "Recovering your saved request…")
      : phase === "empty" ? t("No se encontró una solicitud guardada en este navegador.", "No saved request was found in this browser.")
        : phase === "storage-error" ? t("No se pudo guardar la solicitud. Comprueba el almacenamiento del navegador.", "The request could not be saved. Check browser storage.")
          : phase === "invalid" ? t("La solicitud no tiene un formato válido. Se conservó la copia original.", "The request format is invalid. The original copy was preserved.")
            : t("No se pudo recuperar la solicitud. Abre la versión anterior y pulsa «Recuperar solicitud».", "The previous request could not be reached. Open the previous version and select Recover request.")}</p> : null}
    {phase !== "ready" && phase !== "reading" ? <button onClick={retry}>{t("Recuperar solicitud", "Recover request")}</button> : null}
    <details><summary>{t("Transferir una solicitud desde otro navegador", "Transfer a request from another browser")}</summary><p>{t("Pega los datos exportados de la solicitud. Se conservará la copia original y se actualizará esta pantalla.", "Paste exported request data. This preserves the original copy and updates this screen.")}</p><label className={s.field}>{t("Datos de la solicitud (JSON)", "Request data (JSON)")}<textarea maxLength={420000} value={raw} onChange={e => setRaw(e.target.value)} rows={4}/></label><button disabled={!raw.trim()} onClick={() => {
      try { if (save(importLocalDraft(raw, LEGACY_ORIGIN, new Date().toISOString()))) { setRaw(""); setMessage(t("Solicitud transferida y guardada.", "Request transferred and saved.")); } }
      catch { setMessage(t("Los datos no son válidos. La solicitud guardada no se ha modificado.", "Invalid data. The saved request has not been changed.")); }
    }}>{t("Importar solicitud", "Import request")}</button><p role="status">{message}</p></details>
  </div>;
}
