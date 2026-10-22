"use client";

import { AlertTriangle, CalendarClock, CheckCircle2, Edit3, FileCheck2, Loader2, MapPin, PackageCheck, RefreshCw, Send, ShieldCheck, Truck } from "lucide-react";
import {WorkspaceLink as Link} from "@/features/workspace-mode/workspace-link";
import { useEffect, useRef, useState } from "react";
import { Button, Dialog, Input, Select, Textarea } from "@/components/ui";
import { EquipmentCodeV2Schema } from "@/shared/schemas/v2/freight-request";
import { useLocale } from "@/features/i18n/locale-provider";
import { CandidateResults } from "@/features/v2-intake/components/candidate-results";
import { RoadCandidateMapBoundary } from "@/features/v2-intake/components/road-candidate-map-boundary";
import type { FreightLocationV2, FreightRequestV2Data, RoadServiceabilityEvaluationV2Data } from "@/features/v2-intake/contracts";
import { getRoadServiceabilityV2, reconcileCandidateSelection } from "@/features/v2-intake/v2-intake-client";
import { mapServiceabilityToMapViewProps } from "@/features/v2-intake/mappers/road-map-props.mapper";
import { authorizeBooking, requestCarrierOffer, reviseFreightRequest, selectCommercialOption, ShipperApiError, submitFreightRequest } from "./shipper-api";
import { formatDateTime, formatMass, latestRecord, requestStatusLabel, requestStatusTone, requestToRevisionInput, type WorkflowRecordV2 } from "./shipper-model";
import styles from "./shipper-portal.module.css";
import { LocationResolver } from "./location-resolver";
import { CommercialPanel } from "./commercial-panel";
import { bookingsStillNeeded } from "./commercial-view";
import {refreshRequestCommercial} from './shipper-commercial-client';
import { OutcomePanel } from "./outcome-panel";
import { buildOfferBriefing } from "./offer-briefing";
import { NovaVoicePreview } from "@/features/v2-conversation-prep/nova-voice-preview";
import { RequestFacts } from "./request-facts";
import { inspectRankedOption, inspectOffer, opportunityTargets, type CommercialContext } from "./commercial-context";
import { commonResponseChannels, emptyCommercialCatalog, type CommercialCatalog } from "./commercial-catalog";
import { OpportunityPanel, carrierLabel } from "./opportunity-panel";
import comparisonStyles from "./commercial-comparison.module.css";
import { CommercialIntents } from "./commercial-intent";
import { BookingResources } from "./booking-resources";
import {QuoteSearchPanel} from "./quote-search-panel";
import {IncidentRecoveryPanel} from './incident-recovery-panel';
import {BookingConfirmationWindow} from "@/features/booking-confirmation/panel";
import {findRequestQuotes} from "./quote-api";
import {BookingPreparation,prepareBookingCapacity} from "./booking-preparation";
import {requestContractState} from './contract-state';

type Workflow = Record<string, WorkflowRecordV2[]>;
type EditState = {
  originLabel: string; originCity: string; destinationLabel: string; destinationCity: string;
  pickupStartsAt: string; pickupEndsAt: string; deliveryStartsAt: string; deliveryEndsAt: string;
  description: string; equipment: string; quantity: string; weightPerUnitKg: string; volumePerUnitM3: string;
};

export function RequestWorkspace({ initialRequest, initialWorkflow, initialCatalog, memberId, commercialRefreshEnabled = true, readIncomplete = false }: {
  initialRequest: FreightRequestV2Data;
  initialWorkflow: Workflow; initialCatalog?: CommercialCatalog; memberId?: string; commercialRefreshEnabled?:boolean; readIncomplete?: boolean;
}) {
  const { locale, localeTag, t } = useLocale();
  const [request, setRequest] = useState(initialRequest);
  const [workflow, setWorkflow] = useState(initialWorkflow);
  const [catalog, setCatalog] = useState(initialCatalog ?? emptyCommercialCatalog);
  const [commercialReadBlocked, setCommercialReadBlocked] = useState(false);
  const [opportunityKey, setOpportunityKey] = useState<string | null>(null);
  const [opportunityDeadline, setOpportunityDeadline] = useState("");
  const [responseChannel, setResponseChannel] = useState<"MANUAL" | "API" | "MCP">("MANUAL");
  const [opportunityConsent, setOpportunityConsent] = useState(false);
  const opportunityKeys = useRef(new Map<string, string>());
  const opportunityBusy = useRef(false);
  const [evaluation, setEvaluation] = useState<RoadServiceabilityEvaluationV2Data | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "evaluating" | "saving" | "submitting" | "deciding" | "booking" | "refreshing" | "requesting">("idle");
  const [error, setError] = useState<ShipperApiError | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [offerVoiceOpen, setOfferVoiceOpen] = useState(false);
  const [offerVoiceTurns, setOfferVoiceTurns] = useState<string[]>([]);
  const [bookingConsent, setBookingConsent] = useState(false);
  const bookingInFlight = useRef(false);
  const commercialIntents = useRef(new CommercialIntents());
  const selectionInFlight = useRef(false);
  function intent(action: "selection" | "booking", payload: unknown) {
    return commercialIntents.current.get({ organizationId: request.organizationId, requestId: request.id, memberId: memberId ?? "preview" },
      action, payload, memberId ? window.sessionStorage : undefined);
  }
  const [placeConfirmed, setPlaceConfirmed] = useState(false);
  const [resolvedOrigin, setResolvedOrigin] = useState<FreightLocationV2 | null>(null);
  const [resolvedDestination, setResolvedDestination] = useState<FreightLocationV2 | null>(null);
  const [edit, setEdit] = useState<EditState>(() => editState(initialRequest));
  const offers = (workflow.offers ?? []).filter((item): item is Extract<WorkflowRecordV2, { kind: "offers" }> => item.kind === "offers");
  const opportunities = (workflow.opportunities ?? []).filter((item): item is Extract<WorkflowRecordV2, { kind: "opportunities" }> => item.kind === "opportunities");
  const acceptedOpportunities = opportunities.filter(item => item.status === "ACCEPTED");
  const plans = (workflow.plans ?? []).filter((item): item is Extract<WorkflowRecordV2, { kind: "plans" }> => item.kind === "plans");
  const ranking = latestRecord((workflow.ranking ?? []).filter((item): item is Extract<WorkflowRecordV2, { kind: "ranking" }> => item.kind === "ranking"));
  const commercialContext: CommercialContext = { request, offers, opportunities, plans, ranking };
  const offerBriefing = buildOfferBriefing(offers, ranking, Date.now(), commercialContext);
  const opportunityTarget = opportunityTargets(commercialContext).find(target => target.key === opportunityKey);
  const offerRequestChannels = opportunityTarget ? commonResponseChannels(opportunityTarget.serviceIds, opportunityTarget.carrierId, catalog) : [];
  const existingDecision = latestRecord((workflow.decisions ?? []).filter((item): item is Extract<WorkflowRecordV2, { kind: "decisions" }> => item.kind === "decisions" && item.data.status === "SELECTED"));
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);
  const selectedOption = ranking?.data.options[selectedOptionIndex] ?? null;
  const [decision, setDecision] = useState(existingDecision);
  const activeBookings = (workflow.bookings ?? []).filter((item): item is Extract<WorkflowRecordV2, { kind: "bookings" }> => item.kind === "bookings");
  const contract = requestContractState(request,activeBookings,(workflow.executions??[]).filter(row=>row.kind==='executions'));
  const contractLabels = {CONFIRMED:t('Reserva confirmada','Booking confirmed'),PARTIAL:t('Confirmación parcial','Partially confirmed'),AWAITING_CARRIER:t('Esperando al transportista','Awaiting carrier'),IN_PROGRESS:t('En curso','In progress'),COMPLETED:t('Finalizada','Completed')};
  const incidents = (workflow.incidents ?? []).filter((item): item is Extract<WorkflowRecordV2, { kind: "incidents" }> => item.kind === "incidents");

  const quoteIntents = useRef(new Map<string,string>());
  const quoteBusy = useRef(false);
  async function searchQuotes(deadline: string) {
    if (!contract.canRequestQuotes || phase !== "idle" || quoteBusy.current || refreshBusy.current || readIncomplete || commercialReadBlocked)
      throw new Error("QUOTATION_BUSY");
    quoteBusy.current = true; setPhase("requesting"); setError(null);
    try {
      const quoteDeadline = Date.parse(deadline);
      if (!Number.isFinite(quoteDeadline) || quoteDeadline <= Date.now() || quoteDeadline > Date.parse(request.pickupWindow.startsAt))
        throw new ShipperApiError("INVALID_RESPONSE_DEADLINE",t("El plazo debe ser futuro y anterior al recojo.","Choose a future deadline before pickup."),400,false);
      let current = request;
      if (current.status === "DRAFT") { current = await submitFreightRequest(current.id, current.draftVersion); setRequest(current); }
      const input = {schemaVersion:"2.0",expectedDraftVersion:current.draftVersion,responseDeadline:deadline,consent:"REQUEST_QUOTES"};
      const fingerprint = JSON.stringify([current.organizationId,memberId,current.id,input]);
      if (!quoteIntents.current.has(fingerprint)) quoteIntents.current.set(fingerprint,crypto.randomUUID());
      const result = await findRequestQuotes(current.id,input,quoteIntents.current.get(fingerprint)!);
      const fresh = await refreshRequestCommercial(current.id,current.organizationId,new AbortController().signal);
      setRequest(fresh.request);setWorkflow(old=>({...old,...fresh.workflow}));setCatalog(fresh.catalog);
      quoteIntents.current.delete(fingerprint);
      return result;
    } catch (caught) { setError(toShipperError(caught)); throw caught; }
    finally {quoteBusy.current=false;setPhase("idle");}
  }
  async function evaluate(next = request) {
    if(refreshBusy.current)return;
    setPhase("evaluating"); setError(null); setEvaluation(null); setSelectedCandidateId(null);
    try {
      const response = await getRoadServiceabilityV2(next.id, next.draftVersion);
      setEvaluation(response.data);
      setSelectedCandidateId(reconcileCandidateSelection(null, response.data));
    } catch (caught) { setError(toShipperError(caught)); }
    finally { setPhase("idle"); }
  }

  async function saveRevision() {
    if(readIncomplete||phase!=="idle"||refreshBusy.current)return;
    const placeChanged = edit.originLabel !== request.origin.label || edit.originCity !== request.origin.city
      || edit.destinationLabel !== request.destination.label || edit.destinationCity !== request.destination.city;
    if (placeChanged && !placeConfirmed) {
      setError(new ShipperApiError("PLACE_CONFIRMATION_REQUIRED", t("Confirma explícitamente los nuevos extremos antes de guardar.", "Explicitly confirm the new endpoints before saving."), 400, false));
      return;
    }
    setPhase("saving"); setError(null); setEvaluation(null); setSelectedCandidateId(null);
    try {
      const value = requestToRevisionInput(request);
      const quantity = positiveNumber(edit.quantity, "quantity"), weight = positiveNumber(edit.weightPerUnitKg, "weight"), volume = positiveNumber(edit.volumePerUnitM3, "volume");
      const units = value.cargoSpecification.units.map((unit, index) => index === 0 ? { ...unit, quantity, weightPerUnitKg: weight, volumePerUnitM3: volume } : unit);
      value.origin = resolvedOrigin ?? { ...value.origin, facilityId: placeChanged ? null : value.origin.facilityId,
        label: edit.originLabel.trim(), city: edit.originCity.trim(), lat: placeChanged ? null : value.origin.lat, lng: placeChanged ? null : value.origin.lng };
      value.destination = resolvedDestination ?? { ...value.destination, facilityId: placeChanged ? null : value.destination.facilityId,
        label: edit.destinationLabel.trim(), city: edit.destinationCity.trim(), lat: placeChanged ? null : value.destination.lat, lng: placeChanged ? null : value.destination.lng };
      value.pickupWindow = { startsAt: toIso(edit.pickupStartsAt), endsAt: toIso(edit.pickupEndsAt) };
      value.deliveryWindow = { startsAt: toIso(edit.deliveryStartsAt), endsAt: toIso(edit.deliveryEndsAt) };
      const equipment = edit.equipment ? EquipmentCodeV2Schema.parse(edit.equipment) : null;
      value.requiredEquipment = equipment; value.preferredEquipment = equipment;
      value.cargoSpecification = { ...value.cargoSpecification, description: edit.description.trim(), units,
        totalWeightKg: units.reduce((sum, unit) => sum + unit.quantity * unit.weightPerUnitKg, 0),
        totalVolumeM3: units.reduce((sum, unit) => sum + unit.quantity * unit.volumePerUnitM3, 0) };
      const next = await reviseFreightRequest(request.id, request.draftVersion, value);
      setRequest(next); setEdit(editState(next)); setPlaceConfirmed(false); setResolvedOrigin(null); setResolvedDestination(null); setEditOpen(false);
      await evaluate(next);
    } catch (caught) { setError(toShipperError(caught)); }
    finally { setPhase("idle"); }
  }

  async function submit() {
    if(readIncomplete||phase!=="idle"||refreshBusy.current)return;
    setPhase("submitting"); setError(null);
    try { const next = await submitFreightRequest(request.id, request.draftVersion); setRequest(next); setDecisionOpen(false); }
    catch (caught) { setError(toShipperError(caught)); }
    finally { setPhase("idle"); }
  }

  async function chooseOption() {
    if (readIncomplete || commercialReadBlocked || refreshBusy.current || selectionInFlight.current || !selectedOption || !ranking || phase !== "idle") return;
    if (!inspectRankedOption(selectedOption, commercialContext).available) {
      setError(new ShipperApiError("OFFER_UNAVAILABLE", t("Una oferta de esta alternativa caducó, fue retirada o ya no está disponible. Recarga para revisar alternativas actuales.", "An offer in this option expired, was withdrawn or is no longer available. Reload to review current alternatives."), 409, false));
      return;
    }
    selectionInFlight.current = true; setPhase("deciding"); setError(null);
    try {
      const value = { requestId: request.id, planId: selectedOption.planId,
        offerIds: [...selectedOption.offerIds].sort(), consideredOfferIds: offers.filter(offer => inspectOffer(offer, commercialContext).current).map(offer => offer.id).sort(),
        policyId: ranking.data.policyId, rationale: "Alternative explicitly selected by the shipper in CargoMesh Web." };
      const saved = await selectCommercialOption({ ...value, intent: intent("selection", { requestVersion: request.draftVersion, rankingId: ranking.id, ...value }) });
      if (saved.kind !== "decisions") throw new ShipperApiError("CONTRACT_MISMATCH", "Decision endpoint returned another record kind.", 502, false);
      if (saved.organizationId !== request.organizationId) throw new ShipperApiError("INVALID_SCOPE", "Decision tenant mismatch.", 403, false);
      setDecision(saved); setWorkflow((current) => ({ ...current, decisions: [...(current.decisions ?? []), saved] })); setDecisionOpen(false); setBookingConsent(false); setBookingOpen(true);
    } catch (caught) { setError(toShipperError(caught)); }
    finally { selectionInFlight.current = false; setPhase("idle"); }
  }

  async function book() {
    if (readIncomplete || commercialReadBlocked || refreshBusy.current || phase!=="idle" || !decision || !bookingConsent || bookingInFlight.current) return;
    const pending = bookingsStillNeeded(decision.data.selectedOfferIds, activeBookings, decision.id);
    if (!pending.length) { setBookingOpen(false); return; }
    if (!pending.every((id) => { const offer = offers.find((item) => item.id === id); return offer && inspectOffer(offer, commercialContext).current; })) {
      setError(new ShipperApiError("OFFER_UNAVAILABLE", t("La oferta seleccionada ya no está vigente. Recarga antes de autorizar.", "The selected offer is no longer valid. Reload before authorizing."), 409, false));
      return;
    }
    bookingInFlight.current = true;
    setPhase("booking"); setError(null);
    try {
      for (const offerId of pending) {
        const value = { decisionId: decision.id, offerId };
        const saved = await authorizeBooking({ ...value, intent: intent("booking", value) });
        if (saved.organizationId !== request.organizationId || saved.requestId !== request.id || saved.carrierId !== offers.find(offer => offer.id === offerId)?.carrierId) {
          throw new ShipperApiError("INVALID_SCOPE", "Booking request/tenant/Carrier mismatch.", 403, false);
        }
        setWorkflow((current) => ({ ...current, bookings: [...(current.bookings ?? []).filter((item) => item.id !== saved.id), saved] }));
        await prepareBookingCapacity(saved.id,saved.version,intent("booking",{operation:"capacity",bookingId:saved.id,version:saved.version}).idempotencyKey);
      }
      const fresh = await refreshRequestCommercial(request.id,request.organizationId,new AbortController().signal);
      setRequest(fresh.request);setWorkflow(current=>({...current,...fresh.workflow}));setCatalog(fresh.catalog);
      setBookingConsent(false); setBookingOpen(false);
    } catch (caught) { setError(toShipperError(caught)); }
    finally { bookingInFlight.current = false; setPhase("idle"); }
  }

  async function sendOpportunity() {
    if (readIncomplete || commercialReadBlocked || phase !== "idle" || refreshBusy.current || opportunityBusy.current
      || !opportunityConsent || !opportunityTarget?.current || opportunityTarget.existing.length || !offerRequestChannels.includes(responseChannel)) return;
    const deadline = new Date(opportunityDeadline);
    if (!Number.isFinite(deadline.getTime()) || deadline.getTime() <= Date.now() || deadline.getTime() > Date.parse(request.pickupWindow.endsAt)) {
      setError(new ShipperApiError("INVALID_RESPONSE_DEADLINE", t("El plazo debe ser futuro y no superar el fin de recojo.", "The response deadline must be in the future and no later than pickup end."), 400, false)); return;
    }
    const value = { schemaVersion: "2.0" as const, planId: opportunityTarget.plan.id, carrierId: opportunityTarget.carrierId,
      assignmentIds: opportunityTarget.assignmentIds, responseDeadline: deadline.toISOString(), responseChannel };
    const fingerprint = JSON.stringify({ requestId: request.id, ...value });
    const key = opportunityKeys.current.get(fingerprint) ?? crypto.randomUUID();
    opportunityKeys.current.set(fingerprint, key);
    opportunityBusy.current = true; setPhase("requesting"); setError(null);
    try {
      const saved = await requestCarrierOffer(request.id, value, key);
      if (saved.organizationId !== request.organizationId) throw new ShipperApiError("INVALID_SCOPE", "Opportunity organization mismatch.", 403, false);
      setWorkflow(current => ({ ...current, opportunities: [...(current.opportunities ?? []).filter(row => row.id !== saved.id), saved] }));
      setOpportunityKey(null); setOpportunityConsent(false);
    } catch (caught) { setError(toShipperError(caught)); }
    finally { opportunityBusy.current = false; setPhase("idle"); }
  }

  const commercialRefresh=useRef<AbortController|null>(null),refreshBusy=useRef(false);
  useEffect(()=>()=>commercialRefresh.current?.abort(),[]);
  async function refreshCommercial(quiet = false){
    if(phase!=="idle"||refreshBusy.current||!commercialRefreshEnabled||readIncomplete)return;
    if (quiet && (decisionOpen || bookingOpen || opportunityKey)) return;
    refreshBusy.current=true;const controller=new AbortController();commercialRefresh.current=controller;
    if(!quiet){setPhase("refreshing");setError(null);setDecisionOpen(false);setBookingOpen(false);setBookingConsent(false);}
    try{const fresh=await refreshRequestCommercial(request.id,request.organizationId,controller.signal);if(controller.signal.aborted)return;
      const nextRanking=latestRecord((fresh.workflow.ranking??[]).filter((r):r is Extract<WorkflowRecordV2,{kind:"ranking"}>=>r.kind==="ranking"));
      setSelectedOptionIndex(selectedOption ? nextRanking?.data.options.findIndex(option=>option.planId===selectedOption.planId&&option.offerIds.length===selectedOption.offerIds.length&&option.offerIds.every(id=>selectedOption.offerIds.includes(id)))??-1 : -1);
      setRequest(fresh.request);setWorkflow(old=>({...old,...fresh.workflow}));setCatalog(fresh.catalog);setCommercialReadBlocked(false);
      setDecision(latestRecord((fresh.workflow.decisions??[]).filter((r):r is Extract<WorkflowRecordV2,{kind:"decisions"}>=>r.kind==="decisions"&&r.data.status==="SELECTED")));}
    catch(error){if(!controller.signal.aborted){setError(toShipperError(error));setCommercialReadBlocked(true);setDecisionOpen(false);setBookingOpen(false);setBookingConsent(false);}}
    finally{refreshBusy.current=false;if(!controller.signal.aborted&&!quiet)setPhase("idle");}
  }
  useEffect(() => {
    if (!commercialRefreshEnabled || readIncomplete) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && phase === "idle") void refreshCommercial(true);
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [commercialRefreshEnabled, readIncomplete, phase, request.id, request.organizationId, decisionOpen, bookingOpen, opportunityKey, selectedOptionIndex, ranking?.id]);
  const mapProps = evaluation ? mapServiceabilityToMapViewProps(request, evaluation, selectedCandidateId, setSelectedCandidateId) : null;
  return <div className={styles.page}>
    <header className={styles.hero}><div className={styles.heroCopy}><h1>{request.referenceCode}</h1><p>{request.origin.city} → {request.destination.city}</p></div>
      <div className={styles.heroActions}>{commercialRefreshEnabled && !readIncomplete?<Button variant="secondary" disabled={phase!=="idle"} isLoading={phase==="refreshing"} onClick={()=>void refreshCommercial()}><RefreshCw size={16}/>{t("Actualizar ofertas y reservas","Refresh offers & bookings")}</Button>:null}{request.status === "DRAFT" ? <Button variant="secondary" disabled={phase!=="idle" || readIncomplete} onClick={() => setEditOpen(true)}><Edit3 size={16}/>{t("Editar borrador", "Edit draft")}</Button> : null}
        <Button disabled={phase!=="idle"} isLoading={phase === "evaluating"} loadingLabel={t("Evaluando…", "Evaluating…")} onClick={() => void evaluate()}><RefreshCw size={16}/>{t("Reevaluar", "Reevaluate")}</Button></div></header>

    {error ? <ErrorNotice error={error} t={t} /> : null}
    {commercialReadBlocked ? <p className={styles.notice} role="status">{t("La última actualización falló. Los datos conservados son una lectura anterior; actualiza antes de seleccionar, invitar o reservar.", "The last refresh failed. Retained data is an earlier read; refresh before selecting, inviting or booking.")}</p> : null}
    {!readIncomplete && !commercialReadBlocked && contract.canRequestQuotes && offerBriefing.currentOfferCount > 0 ? <section className={styles.offerArrival} role="status" aria-live="polite">
      <div><strong>{t("Llegaron ofertas de transportistas", "Carrier offers have arrived")}</strong>
        <p>{offerBriefing.currentOfferCount} {t("oferta(s) vigente(s)", "current offer(s)")} · {offerBriefing.recommended
          ? t(`El ranking recomienda revisar primero la opción ${offerBriefing.recommended.position}.`, `The ranking recommends reviewing option ${offerBriefing.recommended.position} first.`)
          : t("Aún no hay un plan completo y clasificado para recomendar.", "No complete ranked plan is ready to recommend yet.")}</p></div>
      <Button variant="secondary" onClick={() => { setOfferVoiceTurns([]); setOfferVoiceOpen(true); }}>{t("Escuchar opciones con Nova", "Hear options with Nova")}</Button>
    </section> : !readIncomplete && !commercialReadBlocked && contract.canRequestQuotes && acceptedOpportunities.length > 0 ? <section className={styles.offerArrival} role="status" aria-live="polite">
      <div><strong>{t("Un transportista aceptó revisar la solicitud", "A carrier accepted the opportunity")}</strong>
        <p>{t("Aún no ha enviado una oferta con precio. Te avisaremos aquí cuando llegue; todavía no hay una opción que Nova pueda recomendar.", "No priced offer has arrived yet. We will show it here when it arrives; Nova has no option to recommend yet.")}</p></div>
    </section> : null}
    <section className={styles.panel}><div className={styles.summary}>
      <Summary label={t("Estado", "Status")} value={!readIncomplete&&contract.phase?contractLabels[contract.phase]:requestStatusLabel(request.status, locale)} badge={!readIncomplete&&contract.confirmed.length?'positive':requestStatusTone(request.status)} />
      <Summary label={t("Carga", "Cargo")} value={`${formatMass(request.cargoSpecification.totalWeightKg, localeTag)} · ${request.cargoSpecification.totalVolumeM3.toLocaleString(localeTag)} m³`} />
      <Summary label={t("Ventana de recojo", "Pickup window")} value={formatDateTime(request.pickupWindow.startsAt, localeTag)} />
      <Summary label={t("Clase solicitada", "Requested class")} value={request.serviceType ?? "UNKNOWN"} />
    </div></section>
    <RequestFacts request={request}/>
    {!readIncomplete ? <IncidentRecoveryPanel request={request}/> : null}
    {!readIncomplete && contract.canRequestQuotes && commercialRefreshEnabled ? <QuoteSearchPanel requestId={request.id} busy={phase!=="idle"||commercialReadBlocked} canSearch={request.status==="DRAFT"||request.status==="PENDING"} onSearch={searchQuotes} onNova={()=>{setOfferVoiceTurns([]);setOfferVoiceOpen(true);}}/> : null}
    {!readIncomplete && contract.canRequestQuotes ? <OpportunityPanel context={commercialContext} catalog={catalog} busy={phase !== "idle" || commercialReadBlocked}
      onRequest={key => { const target = opportunityTargets(commercialContext).find(row => row.key === key); if (!target || phase !== "idle" || commercialReadBlocked) return;
        const channels = commonResponseChannels(target.serviceIds, target.carrierId, catalog); if (!channels.length) return;
        setOpportunityKey(key); setOpportunityDeadline(""); setResponseChannel(channels[0]); setOpportunityConsent(false); }} t={t} localeTag={localeTag}/> : null}

    <div className={styles.detailGrid}><div className={styles.page}>
      <section className={styles.panel}><header className={styles.panelHeader}><div><h2>{t("Factibilidad y mapa", "Serviceability and map")}</h2></div><MapPin size={18}/></header>
        {phase === "evaluating" ? <div className={styles.empty} role="status"><Loader2 className="animate-spin"/><strong>{t("Consultando evaluación vigente…", "Loading current evaluation…")}</strong></div>
          : evaluation ? <div className={styles.section}><CandidateResults evaluation={evaluation} selectedCandidateId={selectedCandidateId} onSelectCandidate={setSelectedCandidateId} t={t}/>{mapProps ? <RoadCandidateMapBoundary props={mapProps} t={t}/> : null}</div>
          : <div className={styles.empty}><span className={styles.emptyIcon}><MapPin size={22}/></span><strong>{t("Evaluación aún no cargada", "Evaluation not loaded yet")}</strong><p>{t("Reevaluar consulta el servicio V2; no usa una ruta anterior mientras carga.", "Reevaluate queries the V2 service; it does not keep an old route while loading.")}</p><Button disabled={phase!=="idle"} onClick={() => void evaluate()}>{t("Evaluar ahora", "Evaluate now")}</Button></div>}
      </section>
      {!readIncomplete ? <CommercialPanel context={commercialContext} catalog={catalog} selectedOptionIndex={selectedOptionIndex} setSelectedOptionIndex={setSelectedOptionIndex}
        decision={decision} bookings={activeBookings} busy={phase!=="idle" || commercialReadBlocked} onDecide={() => {if(phase==="idle" && !commercialReadBlocked)setDecisionOpen(true);}} onBook={() => { if(phase!=="idle" || commercialReadBlocked)return; setBookingConsent(false); setBookingOpen(true); }} t={t} localeTag={localeTag}/> : <section className={styles.panel}><div className={styles.section}><strong>{t("Alternativas pendientes de lectura completa", "Options await a complete read")}</strong><p>{t("Reintenta la lectura superior. Selección y reserva permanecen bloqueadas hasta recuperar los registros necesarios.", "Retry the read above. Selection and booking stay blocked until the required records are loaded.")}</p></div></section>}
    </div>
      <aside className={styles.page}><section className={styles.panel}><header className={styles.panelHeader}><div><h2>{t("Siguiente acción", "Next action")}</h2></div><Send size={18}/></header><div className={styles.section}>
        {request.status === "FAILED" ? <p className={styles.notice} data-tone="danger"><AlertTriangle size={17}/>{t("La solicitud falló. Revisa la trazabilidad y los datos persistidos; corrige mediante una revisión permitida o crea una nueva solicitud. No se reintenta en silencio.", "The request failed. Review traceability and persisted data; correct it through an allowed revision or create a new request. It is never retried silently.")}</p> : null}
        {request.status === "CANCELLED" ? <p className={styles.notice} data-tone="warning"><AlertTriangle size={17}/>{t("Esta solicitud fue cancelada y no puede continuar a ofertas o booking. Crea una solicitud nueva si la operación sigue vigente.", "This request was cancelled and cannot continue to offers or booking. Create a new request if the operation is still needed.")}</p> : null}
        {request.status === "DRAFT" ? <><p className={styles.notice} data-tone="warning"><AlertTriangle size={17}/>{t("Enviar bloquea la versión esperada. Un conflicto 409 debe recargarse, no ocultarse.", "Submit uses the expected version. A 409 conflict must be reloaded, not hidden.")}</p><Button disabled={phase!=="idle" || readIncomplete} isLoading={phase === "submitting"} onClick={() => void submit()}><Send size={16}/>{t("Enviar solicitud", "Submit request")}</Button></> : null}
        {!readIncomplete && contract.canRequestQuotes && request.status !== "DRAFT" && !ranking ? <p className={styles.notice}><CalendarClock size={17}/>{t("La solicitud está enviada. Las alternativas y ofertas aparecerán cuando el backend las persista.", "The request is submitted. Alternatives and offers appear when the backend persists them.")}</p> : null}
        {!readIncomplete && ranking && !decision ? <Button disabled={phase!=="idle" || commercialReadBlocked || !inspectRankedOption(selectedOption, commercialContext).available} onClick={() => setDecisionOpen(true)}><FileCheck2 size={16}/>{t("Revisar selección", "Review selection")}</Button> : null}
        {!readIncomplete && decision && bookingsStillNeeded(decision.data.selectedOfferIds, activeBookings, decision.id).length ? <Button disabled={phase!=="idle" || commercialReadBlocked} onClick={() => { setBookingConsent(false); setBookingOpen(true); }}><PackageCheck size={16}/>{t("Autorizar booking", "Authorize booking")}</Button> : null}
        {activeBookings.length ? <Link className={styles.primary} href="/bookings"><Truck size={16}/>{t("Ver reservas", "View bookings")}</Link> : null}
      </div></section>
      <section className={styles.panel} aria-label={t("Historial de la solicitud", "Request history")}><div className={styles.timeline}>
        <Timeline label={t("Solicitud creada", "Request created")} value={formatDateTime(request.createdAt, localeTag)} />
        <Timeline label={t("Última revisión", "Last revision")} value={`${formatDateTime(request.updatedAt, localeTag)} · v${request.draftVersion}`} />
        <Timeline label={t("Ofertas recibidas", "Offers received")} value={readIncomplete ? "—" : String(offers.length)} />
        <Timeline label={t("Decisión", "Decision")} value={readIncomplete ? t("Sin verificar", "Unverified") : decision?.status ?? t("Pendiente", "Pending")} />
        <Timeline label={t("Bookings", "Bookings")} value={readIncomplete ? "—" : String(activeBookings.length)} />
      </div></section>
      {!readIncomplete ? <OutcomePanel requests={[request]} offers={offers} bookings={activeBookings} incidents={incidents} t={t} localeTag={localeTag}/> : null}
      {activeBookings.map(booking => <section className={styles.panel} key={booking.id}><BookingConfirmationWindow bookingId={booking.id} canAct={!readIncomplete&&!commercialReadBlocked&&phase==="idle"} onChanged={()=>void refreshCommercial()}/>{booking.status==="AUTHORIZED"?<BookingPreparation id={booking.id} version={booking.version} enabled={!readIncomplete&&!commercialReadBlocked&&phase==="idle"} onChanged={()=>void refreshCommercial()}/>:null}<BookingResources booking={booking}
        rows={[...(workflow.holds??[]),...(workflow.executions??[])]} offers={offers}
        decisions={(workflow.decisions??[]).filter(row=>row.kind==="decisions")} complete={!readIncomplete && !commercialReadBlocked}
        t={t} localeTag={localeTag}/></section>)}</aside>
    </div>

    <Dialog open={Boolean(opportunityTarget)} title={t("Solicitar oferta al transportista", "Request a Carrier offer")}
      description={t("Revisa el destinatario y el plazo antes de enviar la oportunidad.", "Review the recipient and deadline before sending the opportunity.")} closeLabel={t("Cancelar", "Cancel")} onClose={() => { if (phase !== "requesting") setOpportunityKey(null); }}>
      {opportunityTarget ? <div className={comparisonStyles.confirmation}>
        {error ? <ErrorNotice error={error} t={t}/> : null}
        <strong>{carrierLabel(opportunityTarget.carrierId, catalog, t)}</strong><p>{request.referenceCode} · v{request.draftVersion} · {t("Plan", "Plan")} {opportunityTarget.plan.id.slice(0, 8)} · {opportunityTarget.assignmentIds.length} {t("tramos", "assignments")}</p>
        <Input label={t("Responder antes de", "Response deadline")} type="datetime-local" required disabled={phase === "requesting"} value={opportunityDeadline} min={localInput(new Date().toISOString())} max={localInput(request.pickupWindow.endsAt)} onChange={event => { setOpportunityDeadline(event.target.value); setOpportunityConsent(false); }}/>
        <Select label={t("Canal publicado de respuesta", "Published response channel")} value={responseChannel} disabled={phase === "requesting"} onChange={event => { setResponseChannel(event.target.value as typeof responseChannel); setOpportunityConsent(false); }}>
          {offerRequestChannels.map(channel => <option key={channel} value={channel}>{channel === "MANUAL" ? t("Portal manual", "Manual portal") : channel}</option>)}</Select>
        <p>{t("Solo se registra una oportunidad para este transportista. El envío externo depende de su canal configurado; no se crea una oferta, un precio ni una reserva.", "Only an opportunity for this Carrier is recorded. External delivery depends on its configured channel; no offer, price or booking is created.")}</p>
        <label className={styles.confirm}><input type="checkbox" checked={opportunityConsent} disabled={phase === "requesting"} onChange={event => setOpportunityConsent(event.target.checked)}/>{t("Confirmo el transportista, los tramos y el plazo. Quiero solicitar esta cotización.", "I confirm the Carrier, assignments and deadline. I want to request this quote.")}</label>
        <Button disabled={phase !== "idle" || !opportunityConsent || !opportunityDeadline || !opportunityTarget.current || opportunityTarget.existing.length > 0 || !offerRequestChannels.includes(responseChannel) || commercialReadBlocked} isLoading={phase === "requesting"} onClick={() => void sendOpportunity()}>{t("Enviar oportunidad", "Send opportunity")}</Button>
      </div> : null}
    </Dialog>
    <EditDialog open={editOpen} edit={edit} setEdit={setEdit} request={request} confirmed={placeConfirmed} setConfirmed={setPlaceConfirmed}
      onResolveOrigin={(location) => { setResolvedOrigin(location); setEdit((current) => ({ ...current, originLabel: location.label, originCity: location.city })); setPlaceConfirmed(true); }}
      onResolveDestination={(location) => { setResolvedDestination(location); setEdit((current) => ({ ...current, destinationLabel: location.label, destinationCity: location.city })); setPlaceConfirmed(true); }}
      busy={phase === "saving"} onClose={() => setEditOpen(false)} onSave={() => void saveRevision()} t={t}/>
    <Dialog open={decisionOpen} title={t("Confirmar alternativa", "Confirm alternative")} description={t("Esta decisión queda auditada y no crea una reserva por sí sola.", "This decision is audited and does not create a booking by itself.")} closeLabel={t("Cerrar", "Close")} onClose={() => setDecisionOpen(false)}>
      <div className={styles.dialogCopy}>{error ? <ErrorNotice error={error} t={t}/> : null}<p>{selectedOption ? `${t("Plan", "Plan")}: ${selectedOption.planId} · ${selectedOption.offerIds.length} ${t("oferta(s)", "offer(s)")}` : t("No hay opción seleccionada.", "No option selected.")}</p><p>{t("La comparación es una instantánea: el servidor volverá a validar vigencia, permisos y elegibilidad.", "The comparison is a snapshot: the server will revalidate validity, permissions and eligibility.")}</p><Button disabled={readIncomplete || commercialReadBlocked || !inspectRankedOption(selectedOption, commercialContext).available || phase !== "idle"} isLoading={phase === "deciding"} onClick={() => void chooseOption()}><CheckCircle2 size={16}/>{t("Confirmar selección", "Confirm selection")}</Button></div>
    </Dialog>
    <Dialog open={offerVoiceOpen} title={t("Opciones del carrier", "Carrier options")} description={t("Nova explica ofertas persistidas y el ranking vigente. La selección y la reserva requieren tu confirmación en pantalla.", "Nova explains persisted offers and the current ranking. Selecting and booking require your confirmation on screen.")} closeLabel={t("Cerrar", "Close")} onClose={() => setOfferVoiceOpen(false)}>
      <div className={styles.offerVoice}><p>{offerBriefing.script}</p>
        {offerVoiceOpen ? <NovaVoicePreview offerRequestId={request.id} autoStart voiceContext={offerVoiceTurns.slice(-16)} onTurn={(turn) => {
          if (turn.final) setOfferVoiceTurns((current) => [...current.slice(-15), `${turn.role === "user" ? "Customer" : "CargoMesh"}: ${turn.text.slice(0, 300)}`]);
        }}/> : null}
        {offerVoiceTurns.length ? <div aria-label="Nova offer conversation">{offerVoiceTurns.map((turn, index) => <p key={`${index}-${turn.slice(0, 20)}`}>{turn}</p>)}</div> : null}
        <Button variant="secondary" onClick={() => setOfferVoiceOpen(false)}>{t("Revisar ofertas en pantalla", "Review offers on screen")}</Button>
      </div>
    </Dialog>
    <Dialog open={bookingOpen} title={t("Autorizar booking", "Authorize booking")} description={t("Acción comercial explícita. No puede inferirse del ranking ni del chat.", "Explicit commercial action. It cannot be inferred from ranking or chat.")} closeLabel={t("Cancelar", "Cancel")} onClose={() => setBookingOpen(false)}>
      <div className={styles.dialogCopy}>{error ? <ErrorNotice error={error} t={t}/> : null}<p>{decision ? `${bookingsStillNeeded(decision.data.selectedOfferIds, activeBookings, decision.id).length} ${t("oferta(s) pendientes de autorización", "offer(s) awaiting authorization")}.` : t("Primero confirma una decisión.", "Confirm a decision first.")}</p>
        {decision && activeBookings.some((item) => item.data.decisionId === decision.id && typeof item.data.offerId !== "string") ? <p className={styles.notice} data-tone="warning"><AlertTriangle size={16}/>{t("Ya existe una autorización. El DTO de booking no identifica la oferta vinculada; no reintentamos otra automáticamente para evitar duplicados. Revisa Reservas o consulta al equipo operativo.", "An authorization already exists. The booking DTO does not identify its offer; we will not automatically retry another to avoid duplicates. Review Bookings or contact operations.")}</p> : null}
        {decision?.data.selectedOfferIds.map((id) => { const offer = offers.find((item) => item.id === id); return <div className={styles.consentOffer} key={id}><strong>{offer ? carrierLabel(offer.carrierId, catalog, t) : t("Oferta no disponible", "Offer unavailable")}</strong>{offer ? <span>{offer.data.carrierReference} · {t("Oferta", "Offer")} v{offer.data.offerVersion}</span> : null}<span>{offer ? `${offer.data.price.currency} ${offer.data.price.amount.toLocaleString(localeTag, { minimumFractionDigits: 2 })} · ${t("vigente hasta", "valid until")} ${formatDateTime(offer.data.validity.endsAt, localeTag)}` : id}</span>{offer?.data.commercialTerms.length ? <ul>{offer.data.commercialTerms.map((term, index) => <li key={`${term.code}-${index}`}>{term.code}: {term.description}</li>)}</ul> : <span>{t("Sin condiciones adicionales declaradas", "No additional terms declared")}</span>}</div>; })}
        <p>{t("El carrier aún puede confirmar o rechazar. Esta autorización no garantiza transporte ni sustituye sus condiciones comerciales.", "The carrier may still confirm or reject. This authorization does not guarantee transport or replace its commercial terms.")}</p>
        <label className={styles.confirm}><input type="checkbox" checked={bookingConsent} onChange={(event) => setBookingConsent(event.target.checked)}/><span>{t("He revisado transportista, precio, vigencia y condiciones de las ofertas indicadas. Autorizo solicitar estas reservas y la retención temporal de capacidad.", "I have reviewed the carrier, price, validity and terms of the listed offers. I authorize requesting these bookings and temporary capacity holds.")}</span></label>
        <Button disabled={readIncomplete || commercialReadBlocked || !decision || !bookingConsent || phase !== "idle" || !bookingsStillNeeded(decision.data.selectedOfferIds, activeBookings, decision.id).length} isLoading={phase === "booking"} onClick={() => void book()}><ShieldCheck size={16}/>{t("Autorizar ofertas pendientes", "Authorize pending offers")}</Button></div>
    </Dialog>
  </div>;
}

function EditDialog({ open, edit, setEdit, request, confirmed, setConfirmed, onResolveOrigin, onResolveDestination, busy, onClose, onSave, t }: {
  open: boolean; edit: EditState; setEdit: (next: EditState) => void; request: FreightRequestV2Data; confirmed: boolean; setConfirmed: (next: boolean) => void;
  onResolveOrigin: (location: FreightLocationV2) => void; onResolveDestination: (location: FreightLocationV2) => void;
  busy: boolean; onClose: () => void; onSave: () => void; t: (es: string, en: string) => string;
}) {
  const field = (key: keyof EditState) => (value: string) => setEdit({ ...edit, [key]: value });
  const placeChanged = edit.originLabel !== request.origin.label || edit.originCity !== request.origin.city || edit.destinationLabel !== request.destination.label || edit.destinationCity !== request.destination.city;
  return <Dialog open={open} title={t("Editar borrador versionado", "Edit versioned draft")} description={t(`Se guardará contra draftVersion ${request.draftVersion} y después se reevaluará.`, `It will save against draftVersion ${request.draftVersion} and then reevaluate.`)} closeLabel={t("Cerrar", "Close")} onClose={onClose}>
    <div className={styles.editGrid}><Input label={t("Referencia de origen", "Origin reference")} value={edit.originLabel} onChange={(e) => field("originLabel")(e.target.value)}/><Input label={t("Ciudad de origen", "Origin city")} value={edit.originCity} onChange={(e) => field("originCity")(e.target.value)}/>
      <Input label={t("Referencia de destino", "Destination reference")} value={edit.destinationLabel} onChange={(e) => field("destinationLabel")(e.target.value)}/><Input label={t("Ciudad de destino", "Destination city")} value={edit.destinationCity} onChange={(e) => field("destinationCity")(e.target.value)}/>
      <LocationResolver
  label={t("Buscar origen autorizado", "Search authorized origin")}
  onConfirmed={onResolveOrigin}
  onProposedCoordinates={(lat, lng) => {
    setEdit({
      ...edit,
      originLabel: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
    });
    setConfirmed(false);
  }}
/>

<LocationResolver
  label={t("Buscar destino autorizado", "Search authorized destination")}
  onConfirmed={onResolveDestination}
  onProposedCoordinates={(lat, lng) => {
    setEdit({
      ...edit,
      destinationLabel: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
    });
    setConfirmed(false);
  }}
/>
      <Input label={t("Inicio recojo", "Pickup start")} type="datetime-local" value={edit.pickupStartsAt} onChange={(e) => field("pickupStartsAt")(e.target.value)}/><Input label={t("Fin recojo", "Pickup end")} type="datetime-local" value={edit.pickupEndsAt} onChange={(e) => field("pickupEndsAt")(e.target.value)}/>
      <Input label={t("Inicio entrega", "Delivery start")} type="datetime-local" value={edit.deliveryStartsAt} onChange={(e) => field("deliveryStartsAt")(e.target.value)}/><Input label={t("Fin entrega", "Delivery end")} type="datetime-local" value={edit.deliveryEndsAt} onChange={(e) => field("deliveryEndsAt")(e.target.value)}/>
      <Textarea fieldClassName={styles.wide} label={t("Descripción", "Description")} value={edit.description} onChange={(e) => field("description")(e.target.value)}/>
      <Select label={t("Equipo ROAD", "ROAD equipment")} value={edit.equipment} onChange={(e) => field("equipment")(e.target.value)}><option value="">UNKNOWN</option>{["BOX_TRUCK", "REEFER_TRUCK", "FLATBED", "TANKER_TRUCK", "TRACTOR_TRAILER"].map((code) => <option key={code}>{code}</option>)}</Select>
      <Input label={t("Cantidad primera unidad", "First unit quantity")} type="number" min="1" step="1" value={edit.quantity} onChange={(e) => field("quantity")(e.target.value)}/><Input label={t("Kg por unidad", "Kg per unit")} type="number" min="0.001" step="0.001" value={edit.weightPerUnitKg} onChange={(e) => field("weightPerUnitKg")(e.target.value)}/><Input label={t("m³ por unidad", "m³ per unit")} type="number" min="0.001" step="0.001" value={edit.volumePerUnitM3} onChange={(e) => field("volumePerUnitM3")(e.target.value)}/>
      {placeChanged ? <label className={`${styles.confirm} ${styles.wide}`}><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)}/><span>{t("Confirmo que estas referencias manuales serán los nuevos extremos operativos. La selección no confirma ruta, cobertura ni capacidad.", "I confirm that these manual references will become the new operational endpoints. Selection does not confirm route, coverage, or capacity.")}</span></label> : null}
      <Button className={styles.wide} isLoading={busy} disabled={placeChanged && !confirmed} onClick={onSave}>{t("Guardar revisión y reevaluar", "Save revision and reevaluate")}</Button>
    </div>
  </Dialog>;
}

function Summary({ label, value, badge }: { label: string; value: string; badge?: string }) { return <div className={styles.summaryItem}><small>{label}</small>{badge ? <span className={styles.status} data-tone={badge}>{value}</span> : <strong>{value}</strong>}</div>; }
function Timeline({ label, value }: { label: string; value: string }) { return <div className={styles.timelineItem}><span className={styles.timelineDot}><CheckCircle2 size={13}/></span><div><strong>{label}</strong><span>{value}</span></div></div>; }
function ErrorNotice({ error, t }: { error: ShipperApiError; t: (es: string, en: string) => string }) {
  const guidance = error.status === 409 ? t("Recarga la solicitud: otra sesión cambió la versión.", "Reload the request: another session changed the version.")
    : error.status === 401 ? t("Tu sesión expiró. Vuelve a iniciar sesión.", "Your session expired. Sign in again.")
    : error.status === 403 ? t("Tu usuario no tiene permiso para esta organización o acción.", "Your user lacks permission for this organization or action.")
    : error.status === 0 ? t("Revisa la conexión y vuelve a intentar.", "Check the connection and try again.")
    : error.retryable ? t("El servicio indicó que puedes reintentar.", "The service indicated that you can retry.") : t("Corrige los datos o revisa el contrato antes de reintentar.", "Correct the data or review the contract before retrying.");
  return <div className={styles.error} role="alert"><AlertTriangle size={18}/><div><strong>{error.code}</strong><div>{error.message}</div><small>{guidance}</small></div></div>;
}
function editState(request: FreightRequestV2Data): EditState { const unit = request.cargoSpecification.units[0]; return {
  originLabel: request.origin.label, originCity: request.origin.city, destinationLabel: request.destination.label, destinationCity: request.destination.city,
  pickupStartsAt: localInput(request.pickupWindow.startsAt), pickupEndsAt: localInput(request.pickupWindow.endsAt), deliveryStartsAt: localInput(request.deliveryWindow.startsAt), deliveryEndsAt: localInput(request.deliveryWindow.endsAt),
  description: request.cargoSpecification.description, equipment: request.requiredEquipment ?? "", quantity: String(unit?.quantity ?? 1), weightPerUnitKg: String(unit?.weightPerUnitKg ?? 1), volumePerUnitM3: String(unit?.volumePerUnitM3 ?? 1),
}; }
function localInput(value: string) { const date = new Date(value), offset = date.getTimezoneOffset() * 60000; return new Date(date.getTime() - offset).toISOString().slice(0, 16); }
function toIso(value: string) { const parsed = new Date(value); if (Number.isNaN(parsed.getTime())) throw new ShipperApiError("VALIDATION_ERROR", "Invalid date and time.", 400, false); return parsed.toISOString(); }
function positiveNumber(value: string, field: string) { const parsed = Number(value); if (!Number.isFinite(parsed) || parsed <= 0 || (field === "quantity" && !Number.isInteger(parsed))) throw new ShipperApiError("VALIDATION_ERROR", `${field} must be positive.`, 400, false); return parsed; }
function toShipperError(error: unknown) { if (error instanceof ShipperApiError) return error; if (error && typeof error === "object" && "code" in error && "status" in error) return new ShipperApiError(String(error.code), error instanceof Error ? error.message : String(error.code), Number(error.status), Boolean("retryable" in error && error.retryable)); return new ShipperApiError("UNEXPECTED_ERROR", error instanceof Error ? error.message : "Unexpected error.", 500, false); }
