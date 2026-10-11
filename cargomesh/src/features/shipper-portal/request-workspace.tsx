"use client";

import { AlertTriangle, CalendarClock, CheckCircle2, Edit3, FileCheck2, Loader2, MapPin, PackageCheck, RefreshCw, Send, ShieldCheck, Truck } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, Button, Dialog, Input, Select, Textarea } from "@/components/ui";
import { EquipmentCodeV2Schema } from "@/shared/schemas/v2/freight-request";
import { useLocale } from "@/features/i18n/locale-provider";
import { CandidateResults } from "@/features/v2-intake/components/candidate-results";
import { RoadCandidateMapBoundary } from "@/features/v2-intake/components/road-candidate-map-boundary";
import type { FreightLocationV2, FreightRequestV2Data, RoadServiceabilityEvaluationV2Data } from "@/features/v2-intake/contracts";
import { getRoadServiceabilityV2, reconcileCandidateSelection } from "@/features/v2-intake/v2-intake-client";
import { mapServiceabilityToMapViewProps } from "@/features/v2-intake/mappers/road-map-props.mapper";
import { authorizeBooking, reviseFreightRequest, selectCommercialOption, ShipperApiError, submitFreightRequest } from "./shipper-api";
import { formatDateTime, formatMass, latestRecord, requestStatusLabel, requestStatusTone, requestToRevisionInput, type WorkflowRecordV2 } from "./shipper-model";
import styles from "./shipper-portal.module.css";
import { LocationResolver } from "./location-resolver";

type Workflow = Record<string, WorkflowRecordV2[]>;
type EditState = {
  originLabel: string; originCity: string; destinationLabel: string; destinationCity: string;
  pickupStartsAt: string; pickupEndsAt: string; deliveryStartsAt: string; deliveryEndsAt: string;
  description: string; equipment: string; quantity: string; weightPerUnitKg: string; volumePerUnitM3: string;
};

export function RequestWorkspace({ initialRequest, initialWorkflow }: {
  initialRequest: FreightRequestV2Data;
  initialWorkflow: Workflow;
}) {
  const { locale, localeTag, t } = useLocale();
  const [request, setRequest] = useState(initialRequest);
  const [workflow, setWorkflow] = useState(initialWorkflow);
  const [evaluation, setEvaluation] = useState<RoadServiceabilityEvaluationV2Data | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "evaluating" | "saving" | "submitting" | "deciding" | "booking">("idle");
  const [error, setError] = useState<ShipperApiError | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [placeConfirmed, setPlaceConfirmed] = useState(false);
  const [resolvedOrigin, setResolvedOrigin] = useState<FreightLocationV2 | null>(null);
  const [resolvedDestination, setResolvedDestination] = useState<FreightLocationV2 | null>(null);
  const [edit, setEdit] = useState<EditState>(() => editState(initialRequest));
  const offers = (workflow.offers ?? []).filter((item): item is Extract<WorkflowRecordV2, { kind: "offers" }> => item.kind === "offers");
  const ranking = latestRecord((workflow.ranking ?? []).filter((item): item is Extract<WorkflowRecordV2, { kind: "ranking" }> => item.kind === "ranking"));
  const existingDecision = latestRecord((workflow.decisions ?? []).filter((item): item is Extract<WorkflowRecordV2, { kind: "decisions" }> => item.kind === "decisions" && item.data.status === "SELECTED"));
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);
  const selectedOption = ranking?.data.options[selectedOptionIndex] ?? null;
  const [decision, setDecision] = useState(existingDecision);
  const activeBookings = (workflow.bookings ?? []).filter((item): item is Extract<WorkflowRecordV2, { kind: "bookings" }> => item.kind === "bookings");

  async function evaluate(next = request) {
    setPhase("evaluating"); setError(null); setEvaluation(null); setSelectedCandidateId(null);
    try {
      const response = await getRoadServiceabilityV2(next.id, next.draftVersion);
      setEvaluation(response.data);
      setSelectedCandidateId(reconcileCandidateSelection(null, response.data));
    } catch (caught) { setError(toShipperError(caught)); }
    finally { setPhase("idle"); }
  }

  async function saveRevision() {
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
    setPhase("submitting"); setError(null);
    try { const next = await submitFreightRequest(request.id, request.draftVersion); setRequest(next); setDecisionOpen(false); }
    catch (caught) { setError(toShipperError(caught)); }
    finally { setPhase("idle"); }
  }

  async function chooseOption() {
    if (!selectedOption || !ranking) return;
    setPhase("deciding"); setError(null);
    try {
      const saved = await selectCommercialOption({ requestId: request.id, planId: selectedOption.planId,
        offerIds: selectedOption.offerIds, consideredOfferIds: offers.filter((offer) => offer.data.status === "RECEIVED").map((offer) => offer.id),
        policyId: ranking.data.policyId, rationale: t("Alternativa seleccionada explícitamente por el shipper en CargoMesh Web.", "Alternative explicitly selected by the shipper in CargoMesh Web.") });
      if (saved.kind !== "decisions") throw new ShipperApiError("CONTRACT_MISMATCH", "Decision endpoint returned another record kind.", 502, false);
      setDecision(saved); setWorkflow((current) => ({ ...current, decisions: [...(current.decisions ?? []), saved] })); setDecisionOpen(false); setBookingOpen(true);
    } catch (caught) { setError(toShipperError(caught)); }
    finally { setPhase("idle"); }
  }

  async function book() {
    if (!decision) return;
    setPhase("booking"); setError(null);
    try {
      const saved: WorkflowRecordV2[] = [];
      for (const offerId of decision.data.selectedOfferIds) saved.push(await authorizeBooking({ decisionId: decision.id, offerId }));
      setWorkflow((current) => ({ ...current, bookings: [...(current.bookings ?? []), ...saved] })); setBookingOpen(false);
    } catch (caught) { setError(toShipperError(caught)); }
    finally { setPhase("idle"); }
  }

  const mapProps = evaluation ? mapServiceabilityToMapViewProps(request, evaluation, selectedCandidateId, setSelectedCandidateId) : null;
  return <div className={styles.page}>
    <header className={styles.hero}><div className={styles.heroCopy}><span className={styles.eyebrow}>{t("Solicitud shipper", "Shipper request")} · v{request.draftVersion}</span><h1>{request.referenceCode}</h1><p>{request.origin.label} → {request.destination.label}</p></div>
      <div className={styles.heroActions}>{request.status === "DRAFT" ? <Button variant="secondary" onClick={() => setEditOpen(true)}><Edit3 size={16}/>{t("Editar borrador", "Edit draft")}</Button> : null}
        <Button isLoading={phase === "evaluating"} loadingLabel={t("Evaluando…", "Evaluating…")} onClick={() => void evaluate()}><RefreshCw size={16}/>{t("Reevaluar", "Reevaluate")}</Button></div></header>

    {error ? <ErrorNotice error={error} t={t} /> : null}
    <section className={styles.panel}><div className={styles.summary}>
      <Summary label={t("Estado", "Status")} value={requestStatusLabel(request.status, locale)} badge={requestStatusTone(request.status)} />
      <Summary label={t("Carga", "Cargo")} value={`${formatMass(request.cargoSpecification.totalWeightKg, localeTag)} · ${request.cargoSpecification.totalVolumeM3.toLocaleString(localeTag)} m³`} />
      <Summary label={t("Ventana de recojo", "Pickup window")} value={formatDateTime(request.pickupWindow.startsAt, localeTag)} />
      <Summary label={t("Clase solicitada", "Requested class")} value={request.serviceType ?? "UNKNOWN"} />
    </div><p className={styles.notice}><ShieldCheck size={17}/>{t("Esta solicitud, su evaluación, sus ofertas y su reserva son recursos distintos. CargoMesh no convierte datos faltantes en confirmaciones.", "This request, its evaluation, offers, and booking are distinct resources. CargoMesh never converts missing data into confirmations.")}</p></section>

    <div className={styles.detailGrid}><div className={styles.page}>
      <section className={styles.panel}><header className={styles.panelHeader}><div><h2>{t("Factibilidad y mapa", "Serviceability and map")}</h2><p>GET /serviceability · draftVersion {request.draftVersion}</p></div><MapPin size={18}/></header>
        {phase === "evaluating" ? <div className={styles.empty} role="status"><Loader2 className="animate-spin"/><strong>{t("Consultando evaluación vigente…", "Loading current evaluation…")}</strong></div>
          : evaluation ? <div className={styles.section}><CandidateResults evaluation={evaluation} selectedCandidateId={selectedCandidateId} onSelectCandidate={setSelectedCandidateId} t={t}/>{mapProps ? <RoadCandidateMapBoundary props={mapProps} t={t}/> : null}</div>
          : <div className={styles.empty}><span className={styles.emptyIcon}><MapPin size={22}/></span><strong>{t("Evaluación aún no cargada", "Evaluation not loaded yet")}</strong><p>{t("Reevaluar consulta el servicio V2; no usa una ruta anterior mientras carga.", "Reevaluate queries the V2 service; it does not keep an old route while loading.")}</p><Button onClick={() => void evaluate()}>{t("Evaluar ahora", "Evaluate now")}</Button></div>}
      </section>
      <CommercialPanel offers={offers} ranking={ranking} selectedOptionIndex={selectedOptionIndex} setSelectedOptionIndex={setSelectedOptionIndex}
        decision={decision} bookings={activeBookings} onDecide={() => setDecisionOpen(true)} onBook={() => setBookingOpen(true)} t={t} localeTag={localeTag}/>
    </div>
      <aside className={styles.page}><section className={styles.panel}><header className={styles.panelHeader}><div><h2>{t("Siguiente acción", "Next action")}</h2><p>{t("El estado del servidor manda", "Server state is authoritative")}</p></div><Send size={18}/></header><div className={styles.section}>
        {request.status === "FAILED" ? <p className={styles.notice} data-tone="danger"><AlertTriangle size={17}/>{t("La solicitud falló. Revisa la trazabilidad y los datos persistidos; corrige mediante una revisión permitida o crea una nueva solicitud. No se reintenta en silencio.", "The request failed. Review traceability and persisted data; correct it through an allowed revision or create a new request. It is never retried silently.")}</p> : null}
        {request.status === "CANCELLED" ? <p className={styles.notice} data-tone="warning"><AlertTriangle size={17}/>{t("Esta solicitud fue cancelada y no puede continuar a ofertas o booking. Crea una solicitud nueva si la operación sigue vigente.", "This request was cancelled and cannot continue to offers or booking. Create a new request if the operation is still needed.")}</p> : null}
        {request.status === "DRAFT" ? <><p className={styles.notice} data-tone="warning"><AlertTriangle size={17}/>{t("Enviar bloquea la versión esperada. Un conflicto 409 debe recargarse, no ocultarse.", "Submit uses the expected version. A 409 conflict must be reloaded, not hidden.")}</p><Button isLoading={phase === "submitting"} onClick={() => void submit()}><Send size={16}/>{t("Enviar solicitud", "Submit request")}</Button></> : null}
        {request.status !== "DRAFT" && !ranking ? <p className={styles.notice}><CalendarClock size={17}/>{t("La solicitud está enviada. Las alternativas y ofertas aparecerán cuando el backend las persista.", "The request is submitted. Alternatives and offers appear when the backend persists them.")}</p> : null}
        {ranking && !decision ? <Button onClick={() => setDecisionOpen(true)}><FileCheck2 size={16}/>{t("Revisar selección", "Review selection")}</Button> : null}
        {decision && !activeBookings.length ? <Button onClick={() => setBookingOpen(true)}><PackageCheck size={16}/>{t("Autorizar booking", "Authorize booking")}</Button> : null}
        {activeBookings.length ? <Link className={styles.primary} href="/bookings"><Truck size={16}/>{t("Ver reservas", "View bookings")}</Link> : null}
        <Link className={styles.secondary} href="/freight-request/new?assistant=open">{t("Abrir asistente", "Open assistant")}</Link>
      </div></section>
      <section className={styles.panel}><header className={styles.panelHeader}><div><h2>{t("Trazabilidad", "Traceability")}</h2><p>{t("Recursos persistidos asociados", "Related persisted resources")}</p></div></header><div className={styles.timeline}>
        <Timeline label={t("Solicitud creada", "Request created")} value={formatDateTime(request.createdAt, localeTag)} />
        <Timeline label={t("Última revisión", "Last revision")} value={`${formatDateTime(request.updatedAt, localeTag)} · v${request.draftVersion}`} />
        <Timeline label={t("Ofertas recibidas", "Offers received")} value={String(offers.length)} />
        <Timeline label={t("Decisión", "Decision")} value={decision?.status ?? t("Pendiente", "Pending")} />
        <Timeline label={t("Bookings", "Bookings")} value={String(activeBookings.length)} />
      </div></section></aside>
    </div>

    <EditDialog open={editOpen} edit={edit} setEdit={setEdit} request={request} confirmed={placeConfirmed} setConfirmed={setPlaceConfirmed}
      onResolveOrigin={(location) => { setResolvedOrigin(location); setEdit((current) => ({ ...current, originLabel: location.label, originCity: location.city })); setPlaceConfirmed(true); }}
      onResolveDestination={(location) => { setResolvedDestination(location); setEdit((current) => ({ ...current, destinationLabel: location.label, destinationCity: location.city })); setPlaceConfirmed(true); }}
      busy={phase === "saving"} onClose={() => setEditOpen(false)} onSave={() => void saveRevision()} t={t}/>
    <Dialog open={decisionOpen} title={t("Confirmar alternativa", "Confirm alternative")} description={t("Esta decisión queda auditada y no crea una reserva por sí sola.", "This decision is audited and does not create a booking by itself.")} closeLabel={t("Cerrar", "Close")} onClose={() => setDecisionOpen(false)}>
      <div className={styles.dialogCopy}><p>{selectedOption ? `${t("Plan", "Plan")}: ${selectedOption.planId} · ${selectedOption.offerIds.length} ${t("oferta(s)", "offer(s)")}` : t("No hay opción seleccionada.", "No option selected.")}</p><p>{t("Confirma que revisaste el costo, vigencia, datos faltantes y explicación del ranking.", "Confirm that you reviewed price, validity, missing data, and the ranking explanation.")}</p><Button disabled={!selectedOption} isLoading={phase === "deciding"} onClick={() => void chooseOption()}><CheckCircle2 size={16}/>{t("Confirmar selección", "Confirm selection")}</Button></div>
    </Dialog>
    <Dialog open={bookingOpen} title={t("Autorizar booking", "Authorize booking")} description={t("Acción comercial explícita. No puede inferirse del ranking ni del chat.", "Explicit commercial action. It cannot be inferred from ranking or chat.")} closeLabel={t("Cancelar", "Cancel")} onClose={() => setBookingOpen(false)}>
      <div className={styles.dialogCopy}><p>{decision ? `${decision.data.selectedOfferIds.length} ${t("oferta(s) serán autorizadas", "offer(s) will be authorized")}.` : t("Primero confirma una decisión.", "Confirm a decision first.")}</p><p>{t("El carrier aún puede confirmar o rechazar. La autorización no se muestra como transporte confirmado.", "The carrier may still confirm or reject. Authorization is not displayed as confirmed transport.")}</p><Button disabled={!decision} isLoading={phase === "booking"} onClick={() => void book()}><ShieldCheck size={16}/>{t("Sí, autorizo el booking", "Yes, authorize booking")}</Button></div>
    </Dialog>
  </div>;
}

function CommercialPanel({ offers, ranking, selectedOptionIndex, setSelectedOptionIndex, decision, bookings, onDecide, onBook, t, localeTag }: {
  offers: Extract<WorkflowRecordV2, { kind: "offers" }>[]; ranking: Extract<WorkflowRecordV2, { kind: "ranking" }> | null;
  selectedOptionIndex: number; setSelectedOptionIndex: (index: number) => void; decision: Extract<WorkflowRecordV2, { kind: "decisions" }> | null;
  bookings: Extract<WorkflowRecordV2, { kind: "bookings" }>[]; onDecide: () => void; onBook: () => void; t: (es: string, en: string) => string; localeTag: string;
}) {
  const unavailableOffers = offers.filter((offer) => offer.data.status !== "RECEIVED" || Date.parse(offer.data.validity.endsAt) <= Date.now());
  return <section className={styles.panel}><header className={styles.panelHeader}><div><h2>{t("Ofertas y ranking", "Offers and ranking")}</h2><p>{t("Precio y score sólo desde recursos V2 persistidos", "Price and score only from persisted V2 resources")}</p></div><FileCheck2 size={18}/></header>
    {!offers.length ? <div className={styles.empty}><span className={styles.emptyIcon}><FileCheck2 size={22}/></span><strong>{t("Todavía no hay ofertas", "No offers yet")}</strong><p>{t("No se muestra precio, carrier o ETA de ejemplo.", "No sample price, carrier, or ETA is shown.")}</p></div>
      : <div className={styles.section}>{unavailableOffers.length ? <p className={styles.notice} data-tone="warning"><AlertTriangle size={17}/>{t(`${unavailableOffers.length} oferta(s) ya no están disponibles. Revisa vigencia y selecciona únicamente una alternativa actual.`, `${unavailableOffers.length} offer(s) are no longer available. Review validity and select only a current alternative.`)}</p> : null}<div className={styles.cards}>{offers.map((offer) => <article className={styles.offer} key={offer.id}><div className={styles.offerHead}><div><h3>{offer.data.carrierReference}</h3><p>{offer.data.source.channel} · {offer.data.status} · v{offer.data.offerVersion}</p></div><strong className={styles.price}>{offer.data.price.currency} {offer.data.price.amount.toLocaleString(localeTag, { minimumFractionDigits: 2 })}</strong></div>
        <dl className={styles.breakdown}>{offer.data.breakdown.map((item, index) => <div key={`${item.kind}-${index}`}><dt>{item.kind} · {item.treatment}</dt><dd>{item.amount ? `${item.amount.currency} ${item.amount.amount.toLocaleString(localeTag)}` : t("Desconocido", "Unknown")}</dd></div>)}</dl><p>{t("Válida hasta", "Valid until")}: {formatDateTime(offer.data.validity.endsAt, localeTag)}</p></article>)}</div>
        {ranking ? <div className={styles.cards}>{ranking.data.options.map((option, index) => <button type="button" className={styles.offer} data-selected={selectedOptionIndex === index} onClick={() => setSelectedOptionIndex(index)} key={`${option.planId}-${index}`}><div className={styles.offerHead}><div><h3>#{option.position} · {t("Plan", "Plan")} {option.planId.slice(0, 8)}</h3><p>{t("Score", "Score")}: {option.score.toFixed(3)} · {option.missingData.length ? `${t("Faltan", "Missing")}: ${option.missingData.join(", ")}` : t("Datos completos del ranking", "Complete ranking data")}</p></div><Badge tone={index === selectedOptionIndex ? "confirmed" : "neutral"}>{option.offerIds.length} {t("oferta(s)", "offer(s)")}</Badge></div></button>)}</div> : <p className={styles.notice} data-tone="warning"><AlertTriangle size={17}/>{t("Hay ofertas, pero el backend aún no publicó un ranking explicable.", "Offers exist, but the backend has not published an explainable ranking yet.")}</p>}
        {ranking && !decision ? <Button onClick={onDecide}>{t("Revisar y seleccionar", "Review and select")}</Button> : null}
        {decision && !bookings.length ? <Button onClick={onBook}>{t("Continuar a consentimiento de booking", "Continue to booking consent")}</Button> : null}
      </div>}
  </section>;
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
      <LocationResolver label={t("Buscar origen autorizado", "Search authorized origin")} onConfirmed={onResolveOrigin}/><LocationResolver label={t("Buscar destino autorizado", "Search authorized destination")} onConfirmed={onResolveDestination}/>
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
