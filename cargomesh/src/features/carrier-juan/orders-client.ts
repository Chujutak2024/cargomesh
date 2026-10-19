import {WorkflowRecordV2Schema,WorkflowInputsV2} from '@/shared/schemas/v2/workflow';
import {portalRequest,PortalApiError,portalErrorCopy} from '@/features/carrier-portal/api';
import {readFleetResource} from '@/features/carrier-portal/fleet-client';
import {readCommercial,readCommercialDetail} from '@/features/carrier-portal/commercial-client';
import {parseCommercialRecord,type Booking} from '@/features/carrier-portal/commercial-model';
import {validCarrierId,type PortalRecord} from '@/features/carrier-portal/records';
import type {CarrierPortalRole} from '@/features/carrier-portal/permissions';
import {orderActionAllowed,sameOrderScope,type OrdersSnapshot,type OrderAction,type ActionTarget,type Hold,type ExecutionEvent} from './orders-model';
const keys=['holds','services','assets','vehicle-combinations','capacity-pools','calendars','drivers','vehicle-assignments','driver-assignments'] as const;
export async function readOrders(carrierId:string,signal:AbortSignal,fetcher:typeof fetch=fetch):Promise<OrdersSnapshot>{
 const [commercial,results]=await Promise.all([readCommercial(carrierId,signal,fetcher),Promise.allSettled(keys.map(key=>readFleetResource(carrierId,key,signal,fetcher)))]);
 if(signal.aborted)throw new DOMException('Aborted','AbortError');
 const denied=results.find(r=>r.status==='rejected'&&r.reason instanceof PortalApiError&&[401,403].includes(r.reason.status));if(denied?.status==='rejected')throw denied.reason;
 const resources:Record<string,PortalRecord[]>={},issues:string[]=[];let holds:Hold[]=[];
 results.forEach((result,i)=>{const key=keys[i];if(result.status==='rejected'){issues.push(key+': '+portalErrorCopy(result.reason,false));resources[key]=[];return;}
  if(result.value.truncated)issues.push(key+': Partial catalog.');if(key==='holds')holds=result.value.records.map(r=>parseCommercialRecord('holds',r,carrierId));else resources[key]=result.value.records;
 });
 return {...commercial,carrierId,holds,resources,issues,partial:commercial.partial||issues.length>0};
}
export const readOrderDetail=(carrierId:string,id:string,signal:AbortSignal,fetcher:typeof fetch=fetch)=>readCommercialDetail(carrierId,'bookings',id,signal,fetcher);
export async function readExecutionEvents(carrierId:string,e:Extract<ActionTarget,{kind:'executions'}>,signal:AbortSignal,fetcher:typeof fetch=fetch){
 if(!validCarrierId(carrierId)||!validCarrierId(e.id)||e.carrierId!==carrierId)throw new PortalApiError(400,'INVALID_ORDER_SCOPE');
 const records:ExecutionEvent[]=[];let offset:number|null=0;const offsets=new Set<number>();let partial=false;
 for(let page=0;page<10&&offset!==null;page++){
  if(offsets.has(offset))throw new PortalApiError(502,'INVALID_RESPONSE');offsets.add(offset);
  const result=await portalRequest(`/api/v2/carriers/${carrierId}/executions/${e.id}/events?limit=100&offset=${offset}`,{signal},fetcher);
  if(!Array.isArray(result.data)||result.data.length>100)throw new PortalApiError(502,'INVALID_RESPONSE');
  const rows=result.data.map(raw=>parseCommercialRecord('execution-events',raw,carrierId));
  if(rows.some(r=>!sameOrderScope(r,e)||r.data.executionId!==undefined&&r.data.executionId!==e.id||records.some(p=>p.id===r.id))||new Set(rows.map(r=>r.id)).size!==rows.length)throw new PortalApiError(502,'INVALID_ORDER_SCOPE');
  records.push(...rows);partial ||= result.meta?.partial===true;offset=result.meta?.nextOffset??null;
 }
 if(signal.aborted)throw new DOMException('Aborted','AbortError');return {executionId:e.id,records,partial:partial||offset!==null};
}
const suffix:Record<OrderAction,string>={'bookings.confirm':'confirmations','bookings.cancel':'cancellations','holds.confirm':'confirmations','holds.release':'releases','executions.start':'starts','executions.complete':'completions','executions.cancel':'cancellations'};
export function orderCommandPath(carrierId:string,action:OrderAction,row:ActionTarget){
 if(!validCarrierId(carrierId)||!validCarrierId(row.id)||row.carrierId!==carrierId||!action.startsWith(row.kind+'.'))throw new PortalApiError(400,'INVALID_ORDER_SCOPE');
 return `/api/v2/carriers/${carrierId}/${row.kind==='holds'?'capacity/holds':row.kind}/${row.id}/${suffix[action]}`;
}
export async function sendOrderCommand(input:{carrierId:string;role:CarrierPortalRole;action:OrderAction;row:ActionTarget;snapshot:OrdersSnapshot;value:unknown;key:string;signal:AbortSignal},fetcher:typeof fetch=fetch,now=Date.now()){
 const {row,action}=input,path=orderCommandPath(input.carrierId,action,row),value=WorkflowInputsV2[action].parse(input.value);
 if(!validCarrierId(input.key)||!orderActionAllowed(action,row,input.snapshot,input.role,now,'confirmation' in value&&(value.confirmation==='CONFIRMED'||value.confirmation==='REJECTED')?value.confirmation:undefined))throw new PortalApiError(409,'ORDER_ACTION_UNAVAILABLE');
 if(value.expectedVersion!==row.version)throw new PortalApiError(409,'STALE_ORDER');
 const response=await portalRequest(path,{method:'POST',signal:input.signal,headers:{'Content-Type':'application/json','Idempotency-Key':input.key},body:JSON.stringify(value)},fetcher);
 const saved=WorkflowRecordV2Schema.parse(response.data);
 const expected=action==='bookings.confirm'&&'confirmation' in value?value.confirmation:({'bookings.cancel':'CANCELLED','holds.confirm':'CONFIRMED','holds.release':'RELEASED','executions.start':'IN_PROGRESS','executions.complete':'COMPLETED','executions.cancel':'CANCELLED'} as Partial<Record<OrderAction,string>>)[action];
 if(saved.kind!==row.kind||saved.id!==row.id||!sameOrderScope(saved,row)||saved.status!==expected||saved.version<=row.version)throw new PortalApiError(502,'INVALID_ORDER_RESPONSE');
 if(saved.kind==='executions'&&row.kind==='executions'&&(saved.data.bookingId!==row.data.bookingId||saved.data.serviceId!==row.data.serviceId)
 ||saved.kind==='holds'&&row.kind==='holds'&&(saved.data.bookingId!==row.data.bookingId||saved.data.assignmentId!==row.data.assignmentId||saved.data.planResourceId!==row.data.planResourceId||saved.data.calendarId!==row.data.calendarId)
 ||saved.kind==='bookings'&&row.kind==='bookings'&&(saved.data.offerId!==row.data.offerId||saved.data.decisionId!==row.data.decisionId))throw new PortalApiError(502,'INVALID_ORDER_RESPONSE');
 return saved as ActionTarget;
}
