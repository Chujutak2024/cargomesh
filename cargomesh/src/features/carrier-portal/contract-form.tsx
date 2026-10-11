"use client";
import { useId, useRef, useState } from "react";
import { z } from "zod";
import { Check, Plus, X } from "lucide-react";
import { useLocale } from "@/features/i18n/locale-provider";
import { mutationReceipt, portalErrorCopy, portalRequest } from "./api";
import s from "./portal.module.css";

type Value = unknown;
export { emptyInput } from "./form-model";
import { emptyInput, unwrapped, projectInput, localDateTime, utcDateTime } from "./form-model";
const labels: Record<string,string> = {
 code:"Código", name:"Nombre", commercialName:"Nombre comercial", legalName:"Razón social", registeredCountry:"País registrado",
 businessIdType:"Tipo de identificación fiscal", businessIdValue:"Identificación fiscal", providerType:"Tipo de transportista",
 operationalPhone:"Teléfono operativo", location:"Ubicación", label:"Referencia de ubicación", city:"Ciudad", region:"Región",
 countryCode:"Código de país", lat:"Latitud", lng:"Longitud", active:"Activo", handling:"Manipulación", mode:"Modo",
 serviceClass:"Clase de servicio", maxWeightKg:"Peso máximo (kg)", maxVolumeM3:"Volumen máximo (m³)",
 responseChannels:"Canales de respuesta", admittedCargoTypes:"Categorías admitidas", temperatureRange:"Rango de temperatura",
 minCelsius:"Mínima (°C)", maxCelsius:"Máxima (°C)", requiredCertifications:"Certificaciones necesarias",
 supportsHazardous:"Admite carga peligrosa", supportsFragile:"Admite carga frágil", supportsOversized:"Admite sobredimensionada",
 geography:"Área geográfica", granularity:"Precisión territorial", postalCode:"Código postal", geometry:"Geometría", coordinates:"Coordenadas",
 role:"Función", inclusion:"Inclusión", source:"Fuente", partnerId:"Socio", evidence:"Evidencia", reference:"Referencia",
 verifiedAt:"Fecha de verificación", observedAt:"Fecha de observación", occurredAt:"Fecha del incidente", validFrom:"Vigente desde",
 validUntil:"Vigente hasta", pickupAreaId:"Área de recogida", deliveryAreaId:"Área de entrega", kind:"Tipo",
 borderReviewRequired:"Requiere revisión de frontera", plannedTransitMinutes:"Tránsito declarado (min)",
 transitProvenanceStatus:"Estado de la evidencia de tránsito", crossBorderProhibited:"Cruce de frontera prohibido",
 crossBorderProhibitionReference:"Referencia de la prohibición", registeredName:"Nombre registrado", partnerCarrierRef:"Transportista asociado",
 agreementValidFrom:"Acuerdo vigente desde", agreementValidUntil:"Acuerdo vigente hasta", coverageEvidence:"Evidencia de cobertura",
 serviceId:"Servicio", assetId:"Activo", equipmentType:"Equipo", usefulCapacityKg:"Capacidad útil (kg)", usableVolumeM3:"Volumen útil (m³)",
 operatingStatus:"Estado operativo", homeDepotId:"Depósito de origen", provenance:"Procedencia", roadVehicle:"Vehículo terrestre",
 plate:"Matrícula", registrationCode:"Registro", registeredAt:"Fecha de registro", brand:"Marca", model:"Modelo", variant:"Variante",
 bodyType:"Carrocería", usableDimensions:"Dimensiones útiles (cm)", length:"Largo", width:"Ancho", height:"Alto",
 grossWeightLimitKg:"Peso bruto máximo (kg)", odometerKm:"Odómetro (km)", conditionReason:"Motivo de condición", axleConfig:"Configuración de ejes",
 serviceWindow:"Ventana del servicio", startsAt:"Inicio", endsAt:"Fin", declaredCapacity:"Capacidad declarada", weightKg:"Peso (kg)", volumeM3:"Volumen (m³)",
 supportedCargoCategoryIds:"Categorías de carga", capacityPoolId:"Cupo", timezone:"Zona horaria", horizon:"Horizonte de disponibilidad",
 lastVerifiedAt:"Última verificación", freshness:"Estado de la evidencia", complete:"Agenda completa", availableWindows:"Ventanas disponibles",
 readyPickupAreaId:"Área disponible de recogida", blockedWindow:"Ventana bloqueada", reason:"Motivo", calendarId:"Calendario",
 occupiedWindow:"Ventana ocupada", origin:"Origen", nextPickup:"Siguiente recogida", estimatedTravelSeconds:"Tránsito estimado (s)",
 definitionId:"Definición", categoryId:"Categoría", certifications:"Certificaciones", requirements:"Requisitos",
 driverId:"Conductor", vehicleCombinationId:"Combinación", transportExecutionId:"Operación", assignedWindow:"Ventana de asignación",
 status:"Estado", response:"Respuesta", note:"Nota", provider:"Proveedor / declarante", provenanceStatus:"Estado de procedencia",
 carrierReference:"Referencia del transportista", planCandidateId:"Plan", coveredServiceIds:"Servicios cubiertos",
 coveredAssignmentIds:"Asignaciones cubiertas", price:"Precio", amount:"Importe", currency:"Moneda", breakdown:"Desglose",
 treatment:"Tratamiento", details:"Detalle", validity:"Vigencia", issuedAt:"Emitida el", estimatedPickupAt:"Recogida estimada",
 estimatedDeliveryAt:"Entrega estimada", transitDurationSeconds:"Duración declarada (s)", reservableCapacity:"Capacidad reservable",
 commercialTerms:"Condiciones comerciales", description:"Descripción", supersedesOfferId:"Oferta anterior sustituida",
 confirmation:"Confirmación", severity:"Severidad", action:"Acción", correlationId:"Referencia de correlación",
 bookingId:"Booking", routeId:"Ruta", window:"Ventana", compatibleRequirementCodes:"Requisitos compatibles",
 cargoCategoryIds:"Categorías", next:"Siguiente estado", expectedVersion:"Versión esperada",
 carrierOperatorId:"Operador", displayName:"Nombre", email:"Correo", phone:"Teléfono", license:"Licencia",
 assets:"Activos", maxCargoWeightKg:"Peso máximo (kg)", maxCargoVolumeM3:"Volumen máximo (m³)",
 combinationId:"Combinación", registrationReference:"Referencia de registro", verifiedBy:"Verificado por",
 manufacturerPayloadLimitKg:"Carga útil del fabricante (kg)", routeGrossLimitKg:"Límite bruto de ruta (kg)",
 maximumDutySeconds:"Jornada máxima (s)", dutyWindow:"Ventana de jornada", readyAt:"Disponible desde",
 availability:"Disponibilidad", maximumDrivingSeconds:"Conducción máxima (s)",
 fullName:"Nombre completo", portalAccountId:"Cuenta del portal", licenseClass:"Clase de licencia", licenseValidUntil:"Vencimiento de licencia",
 licenseTimezone:"Zona horaria de licencia", qualifications:"Habilitaciones", experienceYears:"Años de experiencia", dutyStatus:"Estado de jornada",
 usedDutySeconds:"Jornada utilizada (s)", assetIds:"Activos de la combinación", coupledWindow:"Ventana de acople", configuration:"Configuración",
 combinedTareKg:"Tara combinada (kg)", compatibilityEvidence:"Evidencia de compatibilidad", executionId:"Operación", acceptedLicenseClasses:"Licencias aceptadas",
 requiredQualifications:"Habilitaciones requeridas", policyEvidence:"Evidencia de política", reservationId:"Reserva", capacityCommitted:"Capacidad comprometida",
 type:"Tipo de geometría", channel:"Canal de respuesta", requestId:"Solicitud", sentAt:"Fecha de envío", planId:"Plan de transporte",
 assignmentIds:"Asignaciones", responseDeadline:"Plazo de respuesta", responseChannel:"Canal de respuesta", assignmentSnapshots:"Asignaciones consultadas",
 issuerId:"Emisor", offerVersion:"Versión de oferta", confirmedAt:"Fecha de confirmación", authorizedAt:"Fecha de autorización", authorizedBy:"Autorizado por",
 authorizationStatus:"Estado de autorización", carrierConfirmationStatus:"Confirmación del transportista", capacityEvidence:"Evidencia de capacidad",
 authorizationEvidence:"Evidencia de autorización", expiresAt:"Fecha de vencimiento", parentReservationId:"Reserva anterior", consolidationId:"Viaje consolidado",
 plannedWindow:"Ventana planificada", actualStartedAt:"Inicio registrado", actualCompletedAt:"Fin registrado", lastKnownPosition:"Última posición registrada",
 reportedBy:"Reportado por", at:"Fecha del evento", actorId:"Actor", previous:"Estado anterior", createdBy:"Creado por",
 sampleSize:"Tamaño de muestra", onTimeRate:"Tasa de puntualidad", successfulDeliveryRate:"Tasa de entrega", period:"Período",
 corridorId:"Corredor"
};
export function fieldLabel(key: string, es: boolean) {
  return es && labels[key] ? labels[key] : key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, x=>x.toUpperCase());
}
const valueLabels:Record<string,[string,string]>={
 DRAFT:["Por completar","Incomplete"],ACTIVE:["Activo","Active"],INACTIVE:["Inactivo","Inactive"],SENT:["Enviada","Sent"],
 ACCEPTED:["Aceptada","Accepted"],DECLINED:["Declinada","Declined"],CONFIRMED:["Confirmada","Confirmed"],REJECTED:["Rechazada","Rejected"],
 CANCELLED:["Cancelada","Cancelled"],COMPLETED:["Completada","Completed"],WITHDRAWN:["Retirada","Withdrawn"],
 UNKNOWN:["Desconocido","Unknown"],SIMULATED:["SIMULADO","SIMULATED"],ESTIMATED:["Estimado","Estimated"],VERIFIED:["Verificado","Verified"],
 ROAD:["Carretera","Road"],RAIL:["Ferrocarril","Rail"],SEA:["Marítimo","Sea"],AIR:["Aéreo","Air"],
 MANUAL:["Registro manual","Manual entry"],OWN:["Propio","Own"],PARTNER:["Socio","Partner"],
 CARRIER:["Transportista","Carrier"],OWNER_OPERATOR:["Propietario operador","Owner operator"],SMALL_FLEET:["Flota pequeña","Small fleet"],ENTERPRISE_CARRIER:["Transportista empresarial","Enterprise carrier"],
 CLOSURE:["Cierre","Closure"],DELAY:["Demora","Delay"],HAZARD:["Riesgo","Hazard"],RESTRICTION:["Restricción","Restriction"],
 PICKUP:["Recogida","Pickup"],DELIVERY:["Entrega","Delivery"],INCLUDE:["Incluir","Include"],EXCLUDE:["Excluir","Exclude"],
 eligible:["Elegible","Eligible"],unknown:["Desconocido","Unknown"],ineligible:["No elegible","Ineligible"],
 AWAITING_SELECTION:["Pendiente de selección","Awaiting selection"],IN_PROGRESS:["En curso","In progress"]
};
export function valueLabel(value:string,es:boolean){return valueLabels[value]?.[es?0:1]??value;}
function Field({ schema, value, onChange, name, path, errors, es }: { schema:z.ZodTypeAny; value:Value; onChange:(value:Value)=>void;
 name:string; path:string; errors:Record<string,string>; es:boolean }) {
 const id = useId(), type=unwrapped(schema), label=fieldLabel(name,es), nullable=schema.isNullable() || schema.isOptional();
 if (name==="schemaVersion" || name==="expectedVersion" || path==="source.issuerId") return null;
 if (type instanceof z.ZodLiteral) return <div className={s.constant}><span>{label}</span><strong>{String(type.value)}</strong></div>;
 if (nullable && value == null) return <div className={s.nullField}><span>{label}</span><small>{es?"Sin dato":"No data"}</small>
   <button type="button" aria-label={(es?"Añadir dato: ":"Add data: ")+label} onClick={()=>onChange(emptyInput(type))}>{es?"Añadir dato":"Add data"} <Plus size={14} aria-hidden="true"/></button></div>;
 const clear=nullable?<button className={s.clear} type="button" aria-label={(es?"Quitar ":"Remove ")+label} onClick={()=>onChange(schema.isNullable()?null:undefined)}><X size={14} aria-hidden="true"/></button>:null;
 if (type instanceof z.ZodUnion || type instanceof z.ZodDiscriminatedUnion) {
  const options=type.options as z.ZodTypeAny[];
  const selected=Math.max(0,options.findIndex(option=>option.safeParse(value).success ||
   unwrapped(option) instanceof z.ZodObject && value!==null && typeof value==="object" &&
   Object.entries((unwrapped(option) as z.ZodObject<z.ZodRawShape>).shape).some(([key,field])=>
    field instanceof z.ZodLiteral && (value as Record<string,unknown>)[key]===field.value)));
  return <fieldset className={s.fieldGroup}><legend>{label}</legend><label htmlFor={id}>{es?"Formato":"Format"}</label>
   <select id={id} value={selected} onChange={e=>onChange(emptyInput(options[Number(e.target.value)]))}>{options.map((option,i)=>{
    const object=unwrapped(option); const literal=object instanceof z.ZodObject?Object.values(object.shape as Record<string,z.ZodTypeAny>).find(x=>x instanceof z.ZodLiteral):null;
    return <option key={i} value={i}>{literal instanceof z.ZodLiteral?String(literal.value):(es?"Opción ":"Option ")+(i+1)}</option>;})}</select>
   <Field schema={options[selected]} value={value} onChange={onChange} name={name} path={path} errors={errors} es={es}/></fieldset>;
 }
 if (type instanceof z.ZodTuple) return <fieldset className={s.fieldGroup}><legend>{label}</legend>{type.items.map((item:z.ZodTypeAny,i:number)=><Field
  key={i} schema={item} value={Array.isArray(value)?value[i]:undefined} onChange={v=>onChange(type.items.map((_:unknown,j:number)=>j===i?v:Array.isArray(value)?value[j]:undefined))}
  name={i===0?"lng":"lat"} path={path+"."+i} errors={errors} es={es}/>)}</fieldset>;
 if (type instanceof z.ZodRecord) {
  const data=value && typeof value==="object"?value as Record<string,unknown>:{};
  return <fieldset className={s.fieldGroup}><legend>{label}</legend>{Object.entries(data).map(([key,v])=><div className={s.arrayRow} key={key}>
   <Field schema={type.valueSchema} value={v} onChange={next=>onChange({...data,[key]:next})} name={key} path={path+"."+key} errors={errors} es={es}/>
   <button type="button" aria-label={(es?"Quitar ":"Remove ")+key} onClick={()=>onChange(Object.fromEntries(Object.entries(data).filter(([k])=>k!==key)))}><X size={16}/></button></div>)}
   <button type="button" onClick={()=>onChange({...data,[String(Object.keys(data).length+1)]:emptyInput(type.valueSchema)})}>{es?"Añadir criterio":"Add criterion"}</button></fieldset>;
 }
 if (type instanceof z.ZodObject) {
  const data=value && typeof value==="object"?value as Record<string,Value>:{};
  return <fieldset className={s.fieldGroup}><legend>{label}</legend>{clear}<div className={s.fields}>
   {Object.entries(type.shape as Record<string,z.ZodTypeAny>).map(([key,child])=><Field key={key} schema={child} value={data[key]}
    onChange={v=>onChange({...data,[key]:v})} name={key} path={path?path+"."+key:key} errors={errors} es={es}/>)}
  </div></fieldset>;
 }
 if (type instanceof z.ZodArray) {
  const values=Array.isArray(value)?value:[];
  return <fieldset className={s.fieldGroup}><legend>{label}</legend>{clear}
   {values.map((v,i)=><div className={s.arrayRow} key={i}><Field schema={type.element} value={v}
    onChange={next=>onChange(values.map((old,j)=>j===i?next:old))} name={name+" "+(i+1)} path={path+"."+i} errors={errors} es={es}/>
    <button type="button" onClick={()=>onChange(values.filter((_,j)=>j!==i))} aria-label={(es?"Quitar elemento ":"Remove item ")+(i+1)+" "+label}><X size={16} aria-hidden="true"/></button></div>)}
   <button type="button" onClick={()=>onChange([...values,emptyInput(type.element)])}><Plus size={14} aria-hidden="true"/>{es?"Añadir elemento":"Add item"}</button>
   {errors[path]?<small className={s.error}>{errors[path]}</small>:null}
  </fieldset>;
 }
 const help=id+"-help", error=id+"-error", common={id,"aria-invalid":errors[path]?true:undefined,
  "aria-describedby":[help,errors[path]?error:""].filter(Boolean).join(" ")};
 const fallback=!(type instanceof z.ZodEnum || type instanceof z.ZodString || type instanceof z.ZodNumber || type instanceof z.ZodBoolean);
 return <div className={s.field}><label htmlFor={id}>{label}</label>{clear}
  {type instanceof z.ZodEnum?<select {...common} value={typeof value==="string"?value:""} onChange={e=>onChange(e.target.value)}>
    <option value="">{es?"Seleccionar":"Select"}</option>{type.options.map((x:string)=><option key={x} value={x}>{valueLabel(x,es)}</option>)}</select>:
   type instanceof z.ZodBoolean?<input {...common} type="checkbox" checked={value===true} onChange={e=>onChange(e.target.checked)}/>:
   fallback?<textarea {...common} rows={3} value={typeof value==="string"?value:JSON.stringify(value??"")}
     onChange={e=>{try{onChange(JSON.parse(e.target.value));}catch{onChange(e.target.value)}}}/>:
   <input {...common} type={type instanceof z.ZodNumber?"number":type instanceof z.ZodString&&type.isDatetime?"datetime-local":"text"} step={type instanceof z.ZodNumber?"any":undefined}
    value={type instanceof z.ZodString&&type.isDatetime?localDateTime(value):typeof value==="string" || typeof value==="number"?value:""} onChange={e=>onChange(type instanceof z.ZodNumber && e.target.value!==""?Number(e.target.value):type instanceof z.ZodString&&type.isDatetime?utcDateTime(e.target.value):e.target.value)}/>}
  <small id={help}>{type instanceof z.ZodString && type.isDatetime? (es?"Hora local de este dispositivo. Se guarda con zona horaria.":"Local device time. Saved with an explicit timezone."):
    name.endsWith("Id") || name.endsWith("Ids") ? (es?"Referencia de un registro existente.":"Reference to an existing record."):
    fallback?(es?"Valor estructurado según el contrato.":"Structured value according to the contract."):
    type instanceof z.ZodString && type.isUUID?"UUID":""}</small>
  {errors[path]?<small id={error} className={s.error}>{errors[path]}</small>:null}
 </div>;
}
export function ContractForm({ schema, initial, path, revision, title, onSaved, onClose, onBusyChange }:{
 schema:z.ZodTypeAny; initial?:unknown; path:string; revision?:number; title:string; onSaved:()=>void; onClose:()=>void; onBusyChange?:(busy:boolean)=>void }) {
 const {locale,t}=useLocale(),es=locale==="es";
 const [value,setValue]=useState<Value>(initial===undefined?emptyInput(schema):projectInput(schema,initial)),[errors,setErrors]=useState<Record<string,string>>({});
 const [review,setReview]=useState(false),[busy,setBusy]=useState(false),[failure,setFailure]=useState("");
 const receipt=useRef<ReturnType<typeof mutationReceipt>|null>(null),form=useRef<HTMLFormElement>(null),errorSummary=useRef<HTMLParagraphElement>(null);
 const checked=schema.safeParse(value);
 const submit=async()=>{
   if (!checked.success || busy) return;
   const body=revision?{expectedVersion:revision,value:checked.data}:checked.data;
   receipt.current=mutationReceipt(receipt.current,path,body,()=>crypto.randomUUID());
   setBusy(true);onBusyChange?.(true);setFailure("");
   try { await portalRequest(path,{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":receipt.current.key},body:JSON.stringify(body)});
     onSaved();onClose(); }catch(error){setFailure(portalErrorCopy(error,es));}finally{setBusy(false);onBusyChange?.(false);}
 };
 return <form ref={form} className={s.editor} onSubmit={e=>{e.preventDefault();const result=schema.safeParse(value);
  if (!result.success) {const next=Object.fromEntries(result.error.issues.map(i=>[i.path.join("."),t("Revisa este dato y su coherencia con el formulario.","Check this value and its consistency with the form.")]));
    setErrors(next);requestAnimationFrame(()=>{const field=form.current?.querySelector<HTMLElement>('input[aria-invalid="true"],select[aria-invalid="true"],textarea[aria-invalid="true"]');(field??errorSummary.current)?.focus();});return;}
  setErrors({});setReview(true);}}>
  <div className={s.editorHeading}><div><h2>{title}</h2><p>{t("Se guardará mediante el servicio V2, con tu sesión y permisos.","Saved through the V2 service using your session and permissions.")}</p></div>
   <button type="button" disabled={busy} onClick={onClose} aria-label={t("Cerrar formulario","Close form")}><X size={20} aria-hidden="true"/></button></div>
  {review?<><h3>{t("Confirma la acción","Confirm the action")}</h3><p>{t("Revisa los datos antes de enviarlos. La acción queda atribuida a tu cuenta.","Review the data before sending. The action is attributed to your account.")}</p>
   <dl className={s.reviewData}>{Object.entries((checked.success?checked.data:{}) as Record<string,unknown>).filter(([k])=>k!=="schemaVersion").map(([k,v])=>
    <div key={k}><dt>{fieldLabel(k,es)}</dt><dd><DataValue value={v} es={es}/></dd></div>)}</dl>
  </>:<Field schema={schema} value={value} onChange={v=>{setValue(v);setReview(false);setErrors({});}} name={es?"Datos":"Data"} path="" errors={errors} es={es}/>}
  {Object.keys(errors).length?<p ref={errorSummary} tabIndex={-1} role="alert" className={s.error}>{t("Hay datos incompletos o incompatibles. Revísalos antes de continuar.","Some data is incomplete or inconsistent. Review it before continuing.")}</p>:null}
  {failure?<p role="alert" className={s.error}>{failure}</p>:null}
  <footer className={s.editorFooter}><button type="button" disabled={busy} onClick={review?()=>setReview(false):onClose}>{review?t("Volver a editar","Edit again"):t("Cancelar","Cancel")}</button>
   {review?<button className={s.primary} type="button" disabled={busy} onClick={()=>void submit()}><Check size={16} aria-hidden="true"/>{busy?t("Guardando…","Saving…"):t("Confirmar y guardar","Confirm and save")}</button>:
    <button className={s.primary} type="submit">{t("Revisar acción","Review action")}</button>}</footer>
 </form>;
}

export function DataValue({value,es}:{value:unknown;es:boolean}) {
 if(value==null || value==="") return <span>{es?"Sin dato":"No data"}</span>;
 if(typeof value==="boolean") return <span>{value?(es?"Sí":"Yes"):(es?"No":"No")}</span>;
 if(Array.isArray(value)) return value.length?<ol className={s.valueList}>{value.map((v,i)=><li key={i}><DataValue value={v} es={es}/></li>)}</ol>:<span>{es?"Sin elementos":"No items"}</span>;
 if(typeof value==="object") return <dl className={s.nestedData}>{Object.entries(value).filter(([key])=>key!=="schemaVersion").map(([key,v])=><div key={key}><dt>{fieldLabel(key,es)}</dt><dd><DataValue value={v} es={es}/></dd></div>)}</dl>;
 return <span>{typeof value==="string"?valueLabel(value,es):String(value)}</span>;
}
