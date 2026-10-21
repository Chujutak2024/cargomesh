import type {DispatchOption,DispatchPreferences,DispatchSchedule} from "@/shared/schemas/v2/dispatch";
import type {CreateFreightRequestV2Input as FreightRequestV2Data} from "@/shared/schemas/v2/freight-request";
import type {RoadRequest,RoadService} from "../../road-serviceability/domain/evaluate-road";
import {planWholePackages} from "./multi-resource-plan";
export type DispatchProposal={status:"FOUND";laneId:string;schedule:DispatchSchedule;resources:Extract<ReturnType<typeof planWholePackages>,{status:'FOUND'}>["resources"]}|{status:"REQUIRES_REVIEW"|"NOT_ALLOWED";reason:string};
/** Event-boundary search over accepted windows, not fixed minute samples or an inferred country service. */
export function proposeDispatch(request:{cargoSpecification:Pick<FreightRequestV2Data['cargoSpecification'],'units'|'divisible'>},preferences:DispatchPreferences,road:RoadRequest,service:RoadService,option:DispatchOption,now:number,notBefore=now):DispatchProposal{
 if(!option.policy.allowedPriorities.includes(preferences.urgency))return {status:'NOT_ALLOWED',reason:'PRIORITY_NOT_ACCEPTED'};
 if(option.serviceId!==service.id||!service.lanes.some(l=>l.id===option.laneId))return {status:'REQUIRES_REVIEW',reason:'DISPATCH_SCOPE_MISMATCH'};
 const loading=option.policy.loadingMinutes*60000,unloading=option.policy.unloadingMinutes*60000,travel=option.transitSeconds*1000;
 // Leave a short execution budget; the database still checks notice against its own clock.
 const earliest=Math.max(now+option.policy.minNoticeMinutes*60000+5000,notBefore);
 const dates=new Set<number>();
 for(const w of preferences.pickupWindows)dates.add(Math.max(earliest,Date.parse(w.startsAt)));
 for(const w of preferences.deliveryWindows)dates.add(Date.parse(w.startsAt)-travel-loading);
 for(const c of service.capacities){for(const w of c.calendar?.availableWindows??[])dates.add(Date.parse(w.startsAt));for(const w of [...(c.calendar?.reservations??[]),...(c.calendar?.maintenance??[]),...(c.calendar?.repositioning??[])])dates.add(Date.parse(w.endsAt));}
 const starts=[...dates].filter(t=>Number.isFinite(t)&&t>=earliest&&preferences.pickupWindows.some(w=>t>=Date.parse(w.startsAt)&&t<Date.parse(w.endsAt)&&t+loading<=Date.parse(w.endsAt))).sort((a,b)=>a-b);
 if(starts.length>256)return {status:'REQUIRES_REVIEW',reason:'DISPATCH_EVENT_LIMIT'};
 let attempts=0,work=0;let best:Extract<DispatchProposal,{status:"FOUND"}>|null=null;
 const scoped={...service,lanes:service.lanes.filter(l=>l.id===option.laneId)};
 for(const start of starts){for(const delivery of [...preferences.deliveryWindows].sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt))){
  if(++attempts>256||work>100000)return {status:'REQUIRES_REVIEW',reason:'DISPATCH_SEARCH_LIMIT'};
  const arrival=Math.max(start+loading+travel,Date.parse(delivery.startsAt)),end=arrival+Math.max(unloading,1);
  if(end>Date.parse(delivery.endsAt))continue;
  const operationWindow={startsAt:new Date(start).toISOString(),endsAt:new Date(end).toISOString()};
  const proposal=planWholePackages({...road,operationWindow,pickupWindow:{startsAt:operationWindow.startsAt,endsAt:new Date(start+Math.max(loading,1)).toISOString()},deliveryWindow:{startsAt:new Date(arrival).toISOString(),endsAt:operationWindow.endsAt}},request.cargoSpecification.units,request.cargoSpecification.divisible,scoped);
  work+=proposal.visited;
  if(proposal.status==='FOUND'&&(!best||arrival<Date.parse(best.schedule.deliveryAt)))best={status:'FOUND',laneId:option.laneId,resources:proposal.resources,schedule:{policyVersion:option.policyVersion,pickupAt:operationWindow.startsAt,deliveryAt:new Date(arrival).toISOString(),operationWindow,routeId:option.routeId,transitSeconds:option.transitSeconds}};
  if(proposal.status==='REQUIRES_REVIEW'&&/LIMIT/.test(proposal.reason))return {status:'REQUIRES_REVIEW',reason:proposal.reason};
 }}
 return best??{status:'REQUIRES_REVIEW',reason:'NO_VERIFIED_SLOT_IN_ACCEPTED_WINDOWS'};
}
