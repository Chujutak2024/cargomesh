import {CommercialEvidenceV2Schema} from '@/shared/schemas/v2/evidence';
import type {RouteAdmissionRecord,RouteAdmissionAssessment} from '@/shared/schemas/v2/route-admission';
/** Same evidence/legacy rules as native workflow. Missing data never grants admission. */
export function assessRouteAdmission(record:RouteAdmissionRecord|undefined,window:{startsAt:string;endsAt:string},now:number):RouteAdmissionAssessment{
 const unknown=():RouteAdmissionAssessment=>({state:'UNKNOWN',reasonCode:'ROUTE_ADMISSION_UNKNOWN'});
 if(!record)return unknown();
 const parsed=CommercialEvidenceV2Schema.safeParse(record.source),start=Date.parse(window.startsAt),end=Date.parse(window.endsAt);
 if(!parsed.success||!Number.isFinite(now)||!Number.isFinite(start)||!Number.isFinite(end)||start>=end)return unknown();
 const e=parsed.data,observed=Date.parse(e.observedAt);
 if(!['VERIFIED','SIMULATED'].includes(e.provenanceStatus)||observed>now||observed>start||!e.validUntil)return unknown();
 const until=Date.parse(e.validUntil);
 if(until<=now||until<end)return {state:'EXPIRED',reasonCode:'ROUTE_ADMISSION_EXPIRED'};
 const decision=record.admission?.decision??(record.compatibilityConfirmed?'ALLOWED':'UNKNOWN');
 if(record.admission&&record.compatibilityConfirmed!==(decision==='ALLOWED'))return unknown();
 return {state:decision,reasonCode:decision==='DENIED'?'ROUTE_ADMISSION_DENIED':decision==='ALLOWED'?'ROUTE_ADMISSION_ALLOWED':'ROUTE_ADMISSION_UNKNOWN'};
}
