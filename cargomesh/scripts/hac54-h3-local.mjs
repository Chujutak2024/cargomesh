// Explicit synthetic local consent only. Extends H2 to booking/confirmed capacity/planned execution, not delivery.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {selectCommercialOption,authorizeBooking} from '../src/features/shipper-portal/shipper-api.ts';
import {refreshRequestCommercial} from '../src/features/shipper-portal/shipper-commercial-client.ts';
import {resolveBookingOffer} from '../src/features/shipper-portal/commercial-view.ts';
const api=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL??''),app=new URL(process.env.HAC54_LOCAL_APP_URL??'http://localhost:3000');
assert.equal(api.origin,'http://127.0.0.1:61321');assert.ok(['localhost','127.0.0.1'].includes(app.hostname)&&app.protocol==='http:');
assert.equal(process.env.HAC54_LOCAL_AUTHORIZE_SYNTHETIC_BOOKING,'1','Explicit local test consent required. No live commercial transaction.');
assert.ok(Date.now()<Date.parse('2026-10-22T00:00:00Z'),'Dated scenario expired; do not change historic quote dates.');
const requestId='745929db-5a19-48f1-8667-3c04358c0771',offerId='a1e63e89-7454-42bc-bf0e-d26c9d3338a8',carrierId='c2340000-0000-4000-8000-000000000001';
const key=name=>{const h=createHash('sha256').update('HAC54-H3-2026-10-20:'+name).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;};
const tokens={};
for(const [actor,email,password] of [['client','qa-v2-a@cargomesh.test',process.env.HAC54_LOCAL_CLIENT_PASSWORD],['foreign','qa-v2-b@cargomesh.test',process.env.HAC54_LOCAL_CLIENT_PASSWORD],['carrier','hac54.carrier.local@cargomesh.test',process.env.HAC54_LOCAL_CARRIER_PASSWORD]]){
 const auth=createClient(api.origin,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const login=await auth.auth.signInWithPassword({email,password});assert.equal(login.error,null);tokens[actor]=login.data.session.access_token;
}
async function call(path,actor='client',body,name){
 const res=await fetch(new URL('/api/v2'+path,app),{method:body?'POST':'GET',signal:AbortSignal.timeout(45000),
  headers:{...(tokens[actor]?{Authorization:`Bearer ${tokens[actor]}`} : {}),...(body?{'Content-Type':'application/json','Idempotency-Key':key(name??path)}:{})},...(body?{body:JSON.stringify(body)}:{})});
 return {status:res.status,body:await res.json().catch(()=>null)};
}
const fetcher=(path,init)=>fetch(new URL(String(path),app),{...init,headers:{...init?.headers,Authorization:`Bearer ${tokens.client}`}});
const initial=await refreshRequestCommercial(requestId,'c2300000-0000-4000-8000-000000000001',AbortSignal.timeout(45000),fetcher);
const current=initial.workflow.offers.find(row=>row.id===offerId),plan=initial.workflow.plans.find(row=>row.id===current.data.planCandidateId),ranking=initial.workflow.ranking.at(-1);
assert.ok(current&&plan&&ranking);const prefix='/freight/requests/'+requestId,carrier='/carriers/'+carrierId;
const evidence={reference:'HAC54-H3-LOCAL-EXPLICIT-CONSENT',provider:'CargoMesh synthetic local test',observedAt:'2026-10-20T00:00:00.000Z',validUntil:'2026-10-28T00:00:00.000Z',provenanceStatus:'SIMULATED'};
const old=await call(prefix+'/decisions','client',{schemaVersion:'2.0',planId:plan.id,selectedOfferIds:['b7a755cd-6445-4eb4-9ae0-0de21c7125cb'],consideredOfferIds:[],policyId:ranking.data.policyId,rationale:'Negative superseded offer test',evidence:[evidence]},'superseded');assert.equal(old.status,409);
const selection={requestId,planId:plan.id,offerIds:[offerId],consideredOfferIds:[offerId],policyId:ranking.data.policyId,
 rationale:'Explicit synthetic local Client selection; no live contract.',intent:{idempotencyKey:key('selection'),observedAt:evidence.observedAt}};
const decision=await selectCommercialOption(selection,fetcher);assert.equal((await selectCommercialOption(selection,fetcher)).id,decision.id);
const input={decisionId:decision.id,offerId,intent:{idempotencyKey:key('booking'),observedAt:evidence.observedAt}};
let persistedId;
await assert.rejects(authorizeBooking(input,async(path,init)=>{const response=await fetcher(path,init);const body=await response.json();assert.ok(response.ok,JSON.stringify(body));persistedId=body.data.id;throw Error('Intentional response loss AFTER native persistence');}),{code:'NETWORK_ERROR'});
const booking=await authorizeBooking(input,fetcher);assert.equal(booking.id,persistedId);assert.equal(booking.data.offerId,offerId);
const duplicate=await call('/bookings','client',{schemaVersion:'2.0',decisionId:decision.id,offerId,authorization:'AUTHORIZE',evidence},'different-key-same-booking');assert.equal(duplicate.status,409);
const changed=await call('/bookings','client',{schemaVersion:'2.0',decisionId:decision.id,offerId,authorization:'AUTHORIZE',evidence:{...evidence,reference:'Changed payload negative'}},'booking');assert.equal(changed.status,409);
const historic=await call('/freight/requests/37bbd439-cbb7-41bc-b1a3-ad57451ff12b/bookings');assert.equal(historic.status,200);
const historicBooking=historic.body.data[0];assert.ok(historicBooking?.data.offerId);
const expired=await call('/bookings','client',{schemaVersion:'2.0',decisionId:historicBooking.data.decisionId,offerId:historicBooking.data.offerId,authorization:'AUTHORIZE',evidence},'expired-offer');
assert.equal(expired.status,409);assert.equal(expired.body.error.code,'DECISION_OFFER_NOT_CURRENT');
assert.equal((await call('/bookings/'+booking.id,'foreign')).status,404);assert.equal((await call('/bookings/'+booking.id,'anonymous')).status,401);
const audit={schemaVersion:'2.0',expectedVersion:1,note:'Explicit local Carrier test',evidence,carrierReference:'HAC54-H3-LOCAL',confirmation:'CONFIRMED'};
const before=(await call('/bookings/'+booking.id)).body.data;
if(before.data.carrierConfirmationStatus==='PENDING'){
 const missing=await call(`${carrier}/bookings/${booking.id}/confirmations`,'carrier',audit,'missing-capacity');assert.equal(missing.status,409);assert.equal(missing.body.error.code,'CAPACITY_COMMITMENT_REQUIRED');
}
assert.equal((await call(`${carrier}/bookings/${booking.id}/confirmations`,'carrier',{...audit,expectedVersion:999},'stale-booking')).status,409);
async function save(name,path,body,actor='client'){const r=await call(path,actor,body,name);assert.ok(r.status===200||r.status===201,`${name}: ${r.status} ${JSON.stringify(r.body)}`);return r.body.data;}
const serviceId=current.data.coveredServiceIds[0];
const execution=await save('execution','/executions',{schemaVersion:'2.0',bookingId:booking.id,serviceId});
const assignment=plan.data.legAssignments.find(row=>current.data.coveredAssignmentIds.includes(row.id));
const hold=await save('hold','/capacity/holds',{schemaVersion:'2.0',bookingId:booking.id,assignmentId:assignment.id,planResourceId:assignment.resources[0].resourceId,
 expiresAt:'2026-10-22T00:00:00.000Z',consolidationId:null,evidence});
await save('hold-confirm',`${carrier}/capacity/holds/${hold.id}/confirmations`,{schemaVersion:'2.0',expectedVersion:1,note:'Confirm synthetic capacity through native Carrier authority',evidence},'carrier');
await save('booking-confirm',`${carrier}/bookings/${booking.id}/confirmations`,audit,'carrier');
const final=await refreshRequestCommercial(requestId,initial.request.organizationId,AbortSignal.timeout(45000),fetcher);
const saved=final.workflow.bookings.find(row=>row.id===booking.id);assert.equal(saved.data.carrierConfirmationStatus,'CONFIRMED');
assert.equal(final.workflow.bookings.filter(row=>row.data.decisionId===decision.id&&row.data.offerId===offerId).length,1);
assert.equal(resolveBookingOffer(saved,final.workflow.decisions,final.workflow.offers).id,offerId);
assert.equal(final.workflow.executions.find(row=>row.id===execution.id).status,'PLANNED');
assert.equal(final.workflow.holds.find(row=>row.id===hold.id).status,'CONFIRMED');
assert.deepEqual((await call(`${carrier}/bookings/${booking.id}`,'carrier')).body.data,saved);
console.log(JSON.stringify({localOnly:true,syntheticConsent:true,requestId,decisionId:decision.id,offerId,bookingId:booking.id,executionId:execution.id,holdId:hold.id,
 bookingStatus:saved.data.carrierConfirmationStatus,executionStatus:'PLANNED',checks:['selection replay same ID','lost booking response then exact retry: one persisted booking','same pair with another key 409','same key changed payload 409','superseded offer 409','historic expired offer 409',
 'foreign tenant 404 (existence hidden) / anonymous 401',...(before.data.carrierConfirmationStatus==='PENDING'?['missing capacity 409']:['existing confirmed booking: missing-capacity check not repeated']),
 'stale booking version 409','native hold confirmed','Client/Carrier same confirmed booking','planned execution: NOT started or delivered']},null,2));
