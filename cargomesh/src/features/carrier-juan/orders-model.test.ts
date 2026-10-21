import test from 'node:test';import assert from 'node:assert/strict';
import {booking,execution,fixture,id,at,period} from '@/features/carrier-portal/commercial-test-fixtures';
import {WorkflowRecordV2Schema} from '@/shared/schemas/v2/workflow';
import {orderRelationships,executionResources,holdResources,capacitySummary,orderActionAllowed,orderSelectionFromHash,linkedCommercialId,type OrdersSnapshot,type Hold} from './orders-model';
import {readOrders,readExecutionEvents,sendOrderCommand,orderCommandPath} from './orders-client';
import {mutationReceipt} from '@/features/carrier-portal/api';
const now=Date.parse(at),signal=()=>new AbortController().signal;
const row=(n:number,value:Record<string,unknown>)=>({id:id(n),carrierId:id(1),version:1,updatedAt:at,value:{schemaVersion:'2.0',serviceId:id(5),...value}});
export function ordersFixture():OrdersSnapshot{
 const s=fixture(),o=s.opportunities[0];o.data.assignmentSnapshots=[{id:id(30),serviceId:id(5),legAssignmentId:id(6),resourceId:id(31),capacityNeeded:{weightKg:100,volumeM3:1},window:period,resource:{calendarId:id(47),assetId:id(48),role:'LOAD_BEARING',window:period}}];
 const b=booking(),e=execution();
 const hold=WorkflowRecordV2Schema.parse({...b,id:id(40),status:'CONFIRMED',kind:'holds',data:{bookingId:b.id,assignmentId:id(6),planResourceId:id(31),calendarId:id(47),window:period,expiresAt:'2026-10-16T15:00:00Z',active:true,consolidationId:null,parentReservationId:null,capacityCommitted:{weightKg:100,volumeM3:1},evidence:{reference:'Controlled verified evidence',verifiedAt:at,validUntil:'2026-11-01T00:00:00Z',provenanceStatus:'VERIFIED'}}}) as Hold;
 return {...s,carrierId:id(1),opportunities:[o],bookings:[b],executions:[e],holds:[hold],issues:[],resources:{services:[row(5,{mode:'ROAD'})],calendars:[row(47,{assetId:id(48),capacityPoolId:null,source:'Recorded calendar'})],assets:[row(48,{code:'ACTUAL_ASSET'})],drivers:[row(49,{fullName:'Actual assigned driver'})],'vehicle-combinations':[],'capacity-pools':[],
 'vehicle-assignments':[row(50,{executionId:e.id,assetId:id(48),combinationId:null,reservationId:hold.id,status:'CONFIRMED',window:period,capacityCommitted:{weightKg:100,volumeM3:1}})],'driver-assignments':[row(51,{executionId:e.id,driverId:id(49),role:'PRIMARY',status:'CONFIRMED',window:period})]}};
}
test('Orders retains public and legacy aliases while accepting only real detail identities',()=>{
 assert.equal(orderSelectionFromHash('#/tracking/details/'+id(12)),id(12));assert.equal(orderSelectionFromHash('#/orders/details/'+id(12)),id(12));assert.equal(orderSelectionFromHash('#/tracking/details/example-2'),null);
 assert.equal(linkedCommercialId('#/desk/details/'+id(11),'offers'),id(11));
});
test('booking correlation includes Carrier, organization, request, offer and service; missing links remain explicit',()=>{
 const s=ordersFixture(),b=s.bookings[0];assert.equal(orderRelationships(b,s).offer?.id,id(11));assert.equal(orderRelationships(b,s).executions.length,1);
 const bad={...s,offers:[{...s.offers[0],organizationId:id(90)}]};assert.equal(orderRelationships(b,bad).offer,null);assert.equal(orderRelationships(b,bad).executions.length,0);assert.ok(orderRelationships(b,bad).issues.length);
 const wrongService={...s,executions:[{...s.executions[0],data:{...s.executions[0].data,serviceId:id(90)}}]};assert.equal(orderRelationships(b,wrongService).executions.length,0);assert.equal(orderRelationships(b,wrongService).linkedExecutions.length,1);
});
test('multiple operations and reservations remain attached without guessing a single truck or completion',()=>{
 const s=ordersFixture(),b=s.bookings[0];s.executions.push({...s.executions[0],id:id(65),status:'IN_PROGRESS'});s.holds.push({...s.holds[0],id:id(66)});
 const r=orderRelationships(b,s);assert.equal(r.executions.length,2);assert.equal(r.holds.length,2);
 b.status='CONFIRMED';b.data.carrierConfirmationStatus='CONFIRMED';s.executions[0].status='COMPLETED';assert.equal(orderRelationships(b,s).stage,'In progress');s.executions[1].status='COMPLETED';assert.equal(orderRelationships(b,s).stage,'Completed');s.partial=true;assert.notEqual(orderRelationships(b,s).stage,'Completed');
});
test('active execution with revoked authorization stays in review',()=>{
 const s=ordersFixture(),b=s.bookings[0];b.status='CANCELLED';b.data.authorizationStatus='REVOKED';b.data.carrierConfirmationStatus='CANCELLED';s.executions[0].status='IN_PROGRESS';assert.equal(orderRelationships(b,s).stage,'Needs review');delete b.data.offerId;assert.equal(orderRelationships(b,s).stage,'Needs review');
});
test('recorded resources require execution, service, reservation and combination references',()=>{
 const s=ordersFixture(),e=s.executions[0],r=executionResources(e,s);assert.equal(r.vehicles[0].asset?.id,id(48));assert.equal(r.drivers[0].driver?.id,id(49));
 s.resources.assets[0].value={serviceId:id(80),code:'OTHER_SERVICE'};assert.equal(executionResources(e,s).vehicles[0].asset,null);assert.ok(executionResources(e,s).issues.length);
 const h=s.holds[0];assert.equal(holdResources(h,s).asset,null);assert.equal(holdResources({...h,organizationId:id(80)},s).calendar,null);
});
test('capacity is unverified without every resource binding, fresh verified evidence and complete reads',()=>{
 const s=ordersFixture(),b=s.bookings[0];assert.match(capacitySummary(b,s,now).label,/^Verified/);
 const insufficient={...s,holds:[{...s.holds[0],data:{...s.holds[0].data,capacityCommitted:{weightKg:1,volumeM3:1}}}]};assert.match(capacitySummary(b,insufficient,now).label,/unverified/);
 const noBindings={...s,opportunities:[{...s.opportunities[0],data:{...s.opportunities[0].data,assignmentSnapshots:[{id:id(30),serviceId:id(5)}]}}]};assert.match(capacitySummary(b,noBindings,now).label,/unverified/);
 const simulated={...s,holds:[{...s.holds[0],data:{...s.holds[0].data,evidence:{...s.holds[0].data.evidence,provenanceStatus:'SIMULATED' as const}}}]};assert.match(capacitySummary(b,simulated,now).label,/^Simulated/);assert.equal(capacitySummary(b,simulated,now).ready,true);assert.match(capacitySummary(b,{...s,partial:true},now).label,/Unknown/);
});
test('booking confirmation requires capacity, while rejection remains a separate audited decision',()=>{
 const s=ordersFixture(),b=s.bookings[0];assert.equal(orderActionAllowed('bookings.confirm',b,s,'ADMIN',now,'CONFIRMED'),true);
 assert.equal(orderActionAllowed('bookings.confirm',b,{...s,holds:[]},'ADMIN',now,'CONFIRMED'),false);
 assert.equal(orderActionAllowed('bookings.confirm',b,{...s,holds:[]},'OPERATOR',now,'REJECTED'),true);
 for(const action of ['bookings.confirm','bookings.cancel'] as const)assert.equal(orderActionAllowed(action,b,s,'DISPATCHER',now,'REJECTED'),false);
});
test('reservation expiry, grouped children, committed assignments and roles block invalid commands',()=>{
 const s=ordersFixture(),h={...s.holds[0],status:'HELD'};s.holds=[h];assert.equal(orderActionAllowed('holds.confirm',h,s,'ADMIN',now),true);assert.equal(orderActionAllowed('holds.confirm',h,s,'DISPATCHER',now),false);
 assert.equal(orderActionAllowed('holds.confirm',{...h,data:{...h.data,expiresAt:at}},s,'ADMIN',now),false);
 assert.equal(orderActionAllowed('holds.release',h,s,'ADMIN',now),false);s.resources['vehicle-assignments']=[];assert.equal(orderActionAllowed('holds.release',h,s,'ADMIN',now),true);
 assert.equal(orderActionAllowed('holds.release',{...h,data:{...h.data,parentReservationId:id(80)}},s,'ADMIN',now),false);
});
test('start requires a confirmed booking, recorded crew, matching reservations and the real window',()=>{
 const s=ordersFixture(),b=s.bookings[0],e=s.executions[0];b.status='CONFIRMED';b.data.carrierConfirmationStatus='CONFIRMED';
 assert.equal(orderActionAllowed('executions.start',e,s,'DISPATCHER',Date.parse('2026-10-16T13:00:00Z')),true);assert.equal(orderActionAllowed('executions.start',e,s,'ADMIN',now),false);
 assert.equal(orderActionAllowed('executions.start',e,{...s,resources:{...s.resources,'driver-assignments':[]}},'ADMIN',Date.parse('2026-10-16T13:00:00Z')),false);
 e.status='IN_PROGRESS';assert.equal(orderActionAllowed('executions.complete',e,s,'DISPATCHER',now),true);assert.equal(orderActionAllowed('executions.cancel',e,s,'DISPATCHER',now),true);
});
const response=(data:unknown,meta:object={nextOffset:null})=>Response.json({schemaVersion:'2.0',data,meta});
test('bounded collection reads never call Client endpoints and allow empty catalogs',async()=>{
 const paths:string[]=[];const s=await readOrders(id(1),signal(),async path=>{paths.push(String(path));return response([]);});assert.deepEqual(s.bookings,[]);assert.equal(s.partial,false);assert.equal(paths.length,13);assert.ok(paths.every(p=>p.includes('/carriers/')));assert.ok(!paths.some(p=>p.includes('/freight/')));
});
test('partial resource reads preserve bookings, while denial and late cancellation invalidate the read',async()=>{
 const f=ordersFixture();const partial=await readOrders(id(1),signal(),async path=>{const key=String(path).split('/').at(-1)!.split('?')[0];if(key==='assets')return Response.json({error:{code:'UNAVAILABLE'}},{status:503});return response(key in f?f[key as 'bookings']:[]);});assert.equal(partial.bookings.length,1);
 assert.equal(partial.partial,true);assert.ok(partial.issues.length);
 await assert.rejects(readOrders(id(1),signal(),async()=>Response.json({error:{code:'FORBIDDEN'}},{status:403})),{status:403});const c=new AbortController();c.abort();await assert.rejects(readOrders(id(1),c.signal,async()=>response([])),error=>(error as Error).name==='AbortError');
});
test('history reads use only the opened execution endpoint and validate scope and partial pages',async()=>{
 const s=ordersFixture(),e=s.executions[0],event=WorkflowRecordV2Schema.parse({...e,id:id(70),kind:'execution-events',status:'RECORDED',data:{schemaVersion:'2.0',expectedVersion:1,note:'Started',evidence:s.offers[0].data.source.evidence,action:'executions.start',at,actorId:id(99)}});
 const result=await readExecutionEvents(id(1),e,signal(),async path=>{assert.match(String(path),new RegExp('/executions/'+e.id+'/events'));return response([event],{partial:true,nextOffset:null});});assert.equal(result.records.length,1);assert.equal(result.partial,true);
 await assert.rejects(readExecutionEvents(id(1),e,signal(),async()=>response([{...event,organizationId:id(80)}])),/INVALID_ORDER_SCOPE/);
});
test('one audited transition uses expected version and stable receipt; stale conflict is not success',async()=>{
 const s=ordersFixture(),b=s.bookings[0],value={schemaVersion:'2.0',expectedVersion:1,note:'Reject booking',evidence:s.offers[0].data.source.evidence,carrierReference:'Carrier reference',confirmation:'REJECTED' as const};
 const path=orderCommandPath(id(1),'bookings.confirm',b),receipt=mutationReceipt(null,path,value,()=>id(90));assert.equal(mutationReceipt(receipt,path,value,()=>id(91)).key,id(90));assert.equal(mutationReceipt(receipt,path,{...value,note:'Changed'},()=>id(91)).key,id(91));
 const input={carrierId:id(1),role:'ADMIN' as const,action:'bookings.confirm' as const,row:b,snapshot:s,value,key:receipt.key,signal:signal()};
 await assert.rejects(sendOrderCommand(input,async()=>Response.json({error:{code:'STALE_DRAFT'}},{status:409}),now),/STALE_DRAFT/);
 let calls=0;const saved=await sendOrderCommand(input,async(url,init)=>{calls++;assert.equal(url,path);assert.equal(new Headers(init?.headers).get('Idempotency-Key'),id(90));assert.equal(JSON.parse(String(init?.body)).expectedVersion,1);return response({...b,status:'REJECTED',version:2,data:{...b.data,carrierConfirmationStatus:'REJECTED'}});},now);assert.equal(saved.status,'REJECTED');assert.equal(calls,1);
});
test('operation cancellation sends no automatic booking or hold release; refresh derives actual recorded changes',async()=>{
 const s=ordersFixture(),e=s.executions[0],value={schemaVersion:'2.0',expectedVersion:1,note:'Cancel operation',evidence:s.offers[0].data.source.evidence};let calls=0;
 const saved=await sendOrderCommand({carrierId:id(1),role:'DISPATCHER',action:'executions.cancel',row:e,snapshot:s,value,key:id(90),signal:signal()},async path=>{calls++;assert.ok(String(path).endsWith('/executions/'+e.id+'/cancellations'));return response({...e,status:'CANCELLED',version:2});},now);assert.equal(calls,1);assert.equal(saved.status,'CANCELLED');assert.equal(s.holds[0].status,'CONFIRMED');
});

test('stale targets and incompatible command responses never become successful transitions',async()=>{
 const s=ordersFixture(),b=s.bookings[0];
 assert.equal(orderActionAllowed('bookings.confirm',{...b,version:2},s,'ADMIN',now,'REJECTED'),false);
 const value={schemaVersion:'2.0',expectedVersion:1,note:'Reject after review',evidence:s.offers[0].data.source.evidence,carrierReference:'Recorded reference',confirmation:'REJECTED' as const};
 const input={carrierId:id(1),role:'ADMIN' as const,action:'bookings.confirm' as const,row:b,snapshot:s,value,key:id(90),signal:signal()};
 for(const wrong of [{organizationId:id(80)},{version:1},{data:{...b.data,offerId:id(80),carrierConfirmationStatus:'REJECTED'}}]){
  await assert.rejects(sendOrderCommand(input,async()=>response({...b,status:'REJECTED',version:2,data:{...b.data,carrierConfirmationStatus:'REJECTED'},...wrong}),now),/INVALID_ORDER_RESPONSE/);
 }
 let calls=0;await assert.rejects(sendOrderCommand({...input,role:'DISPATCHER'},async()=>{calls++;return response(b);},now),/ORDER_ACTION_UNAVAILABLE/);assert.equal(calls,0);
});

test('a confirmed command changes the derived board only after a new persisted-record read',async()=>{
 const before=ordersFixture(),b=before.bookings[0];
 const saved=await sendOrderCommand({carrierId:id(1),role:'ADMIN',action:'bookings.confirm',row:b,snapshot:before,value:{schemaVersion:'2.0',expectedVersion:1,note:'Carrier rejects after review',evidence:before.offers[0].data.source.evidence,carrierReference:'Controlled reference',confirmation:'REJECTED'},key:id(90),signal:signal()},async()=>response({...b,status:'REJECTED',version:2,data:{...b.data,carrierConfirmationStatus:'REJECTED'}}),now);
 assert.equal(orderRelationships(b,before).stage,'Booking review');
 const after=await readOrders(id(1),signal(),async path=>{const key=String(path).split('/').at(-1)!.split('?')[0];return response(key==='bookings'?[saved]:key in before?before[key as 'offers']:key==='holds'?before.holds:before.resources[key]??[]);});
 assert.equal(orderRelationships(after.bookings[0],after).stage,'Closed');assert.equal(before.bookings[0].version,1);
});


test('unknown organization or request references cannot prove an order relationship',()=>{
 const s=ordersFixture(),b=s.bookings[0];b.organizationId=null;s.offers[0].organizationId=null;s.executions[0].organizationId=null;s.holds[0].organizationId=null;
 const r=orderRelationships(b,s);assert.equal(r.offer,null);assert.equal(r.linkedExecutions.length,0);assert.equal(r.referencedHolds.length,0);assert.equal(orderActionAllowed('bookings.cancel',b,s,'ADMIN',now),false);
});

test('privacy-safe native multi-truck projection requires a distinct confirmed reservation per binding',()=>{
 const s=ordersFixture(),b=s.bookings[0],first=s.holds[0],calendar=s.resources.calendars[0];
 const second={...first,id:id(70),data:{...first.data,planResourceId:id(71),calendarId:id(72)}};
 s.holds.push(second);s.resources.calendars.push({...calendar,id:id(72),value:{...(calendar.value as Record<string,unknown>),assetId:id(73)}});s.resources.assets.push(row(73,{code:'SECOND_TRUCK'}));
 s.opportunities[0].data.assignmentSnapshots=[{id:id(30),legAssignmentId:id(6),serviceId:id(5),window:period,allocationSummary:{role:'LOAD_BEARING',equipment:'BOX_TRUCK',units:[{unitIndex:0,quantity:1,weightKg:100,volumeM3:1}]}},{id:id(74),legAssignmentId:id(6),serviceId:id(5),window:period,allocationSummary:{role:'LOAD_BEARING',equipment:'BOX_TRUCK',units:[{unitIndex:0,quantity:1,weightKg:100,volumeM3:1}]}}];
 assert.equal(capacitySummary(b,s,now).ready,true);
 assert.equal(orderActionAllowed('bookings.confirm',b,s,'ADMIN',now,'CONFIRMED'),true);
 assert.equal(capacitySummary(b,{...s,holds:[first]},now).ready,false,'one hold cannot cover two identical cargo bindings');
 assert.equal(capacitySummary(b,{...s,holds:[first,{...second,data:{...second.data,capacityCommitted:{weightKg:99,volumeM3:1}}}]},now).ready,false);
 assert.equal(capacitySummary(b,{...s,holds:[first,{...second,carrierId:id(90)}]},now).ready,false);
 assert.equal(capacitySummary(b,{...s,partial:true},now).ready,false);
});
