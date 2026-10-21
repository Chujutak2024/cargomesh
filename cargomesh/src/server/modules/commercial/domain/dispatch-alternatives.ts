import type {RoadService} from '../../road-serviceability/domain/evaluate-road';
import {proposeDispatch,type DispatchProposal} from './dispatch-planner';
type Found=Extract<DispatchProposal,{status:'FOUND'}>;
/** Enumerate bounded asset subsets. Every subset receives the same hard feasibility checks.
 * This optimizes only constructed direct-FTL plans; it does not claim a global routing optimum. */
export function proposeDispatchAlternatives(...args:Parameters<typeof proposeDispatch>):{status:'FOUND';plans:Found[];algorithm:'BOUNDED_ASSET_SUBSETS_V1'}|Exclude<DispatchProposal,Found>{
 const [request,prefs,road,service,option,now,notBefore]=args;
 if(option.costMode!=='COST_PLUS'){const p=proposeDispatch(...args);return p.status==='FOUND'?{status:'FOUND',plans:[p],algorithm:'BOUNDED_ASSET_SUBSETS_V1'}:p;}
 const capacities=service.capacities.filter(c=>c.role==='CARRIER'&&c.sourceType==='TRANSPORT_ASSET'&&c.calendarId).sort((a,b)=>a.id.localeCompare(b.id));
 const max=Math.min(request.cargoSpecification.divisible?option.maxResources??1:1,capacities.length),subsets:RoadService['capacities'][]=[];
 let exceeded=false;
 const walk=(start:number,remaining:number,selected:RoadService['capacities'])=>{if(exceeded)return;if(!remaining){subsets.push(selected);if(subsets.length>128)exceeded=true;return;}for(let i=start;i<=capacities.length-remaining;i++)walk(i+1,remaining-1,[...selected,capacities[i]]);};
 for(let count=1;count<=max&&!exceeded;count++)walk(0,count,[]);
 if(exceeded)return {status:'REQUIRES_REVIEW',reason:'DISPATCH_ASSET_SUBSET_LIMIT'};
 const plans:Found[]=[];let work=0;
 for(const subset of subsets){const p=proposeDispatch(request,prefs,road,{...service,capacities:subset},option,now,notBefore);work++;
  if(p.status==='FOUND'&&!plans.some(old=>JSON.stringify([old.schedule,old.resources])===JSON.stringify([p.schedule,p.resources])))plans.push(p);
  else if(p.status==='REQUIRES_REVIEW'&&/LIMIT/.test(p.reason))return p;
 }
 return plans.length?{status:'FOUND',plans,algorithm:'BOUNDED_ASSET_SUBSETS_V1'}:{status:'REQUIRES_REVIEW',reason:work?'NO_VERIFIED_SLOT_IN_ACCEPTED_WINDOWS':'TRUCK_RESOURCE_REQUIRED'};
}
export function compareDispatchPlans(a:{schedule:Found['schedule'];totalCents:number},b:{schedule:Found['schedule'];totalCents:number},urgency:'URGENT'|'SCHEDULED'){
 const arrival=Date.parse(a.schedule.deliveryAt)-Date.parse(b.schedule.deliveryAt),price=a.totalCents-b.totalCents;
 return (urgency==='URGENT'?arrival||price:price||arrival)||Date.parse(a.schedule.pickupAt)-Date.parse(b.schedule.pickupAt)||a.schedule.routeId.localeCompare(b.schedule.routeId);
}
