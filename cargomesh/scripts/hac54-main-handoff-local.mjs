// Local, dated seam check of the actual FE-1 clients against the approved main APIs.
// Never imports the visual demo or grants access. Leaves human selection/consent untouched.
import assert from 'node:assert/strict';
import {createServerClient} from '@supabase/ssr';
import {localHarness,localRecipe} from './hac54-local-harness.mjs';
import {scenarioPolicy} from './hac54-scenario-policy.mjs';
import {loadIntakeOptions,createFreightRequestV2,getFreightRequestV2,getRoadServiceabilityV2,
 assertFreightRequestRoundTrip,assertServiceabilityCorrelation} from '../src/features/v2-intake/v2-intake-client.ts';
import {requestToRevisionInput} from '../src/features/shipper-portal/shipper-model.ts';
import {refreshRequestCommercial} from '../src/features/shipper-portal/shipper-commercial-client.ts';
import {inspectRankedOption} from '../src/features/shipper-portal/commercial-context.ts';
import {CargoReadinessV2ResponseSchema} from '../src/shared/schemas/v2/cargo-readiness.ts';

const recipe=localRecipe('v2-hac54-validation-2026-10-21');
scenarioPolicy('v2-hac54-validation-2026-10-21',recipe,'prepare');
assert.equal(process.env.HAC54_LOCAL_AUTHORIZE_SYNTHETIC_DRAFT,'1','Explicit synthetic local DRAFT consent required.');
const h=await localHarness(recipe.package+':main-handoff'),baseRecipe=localRecipe('v2-hac54-h2');
const base=await h.get('/freight/requests/'+baseRecipe.refs.baseRequest);
const options=await loadIntakeOptions(h.fetcher,'api');
assert.equal(options.source,'api');assert.equal(options.fixtureReason,null);

// This endpoint uses the same SSR cookie session as the page, not the workflow bearer adapter.
const jar=new Map(),ssr=createServerClient(h.api.origin,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{
 cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(({name,value})=>jar.set(name,value))},
});
assert.equal((await ssr.auth.setSession((await h.clients.client.auth.getSession()).data.session)).error,null);
const response=await fetch(new URL('/api/v2/client-context?limit=25&offset=0',h.app),{
 headers:{Cookie:[...jar].map(([name,value])=>`${name}=${value}`).join('; ')},redirect:'manual',signal:AbortSignal.timeout(45000),
});
const context=await response.json();
let contextBlocker=null;
if(response.status!==200){
 // Report this known upstream/data incompatibility; never fake a successful context response.
 assert.equal(response.status,400);assert.equal(context.error?.code,'VALIDATION_ERROR');
 assert.match(context.error.message,/value\.defaultCurrency.*USD/);
 contextBlocker='LOCAL_QA_ORGANIZATION_PEN_VS_USD_CONTRACT';
}else{
 assert.equal(context.organization.id,base.organizationId);
 assert.ok(context.facilities.data.every(row=>row.organizationId===base.organizationId));
}
const ownFacilities=await h.get('/facilities?limit=100&offset=0');
assert.ok(ownFacilities.every(row=>row.organizationId===base.organizationId));
const facility=city=>{
 const selected=options.options.data.facilities.find(row=>row.city===city);assert.ok(selected);
 assert.ok(ownFacilities.some(row=>row.id===selected.facilityId));
 const {code:_code,...location}=selected;return location;
};
const input=requestToRevisionInput(structuredClone(base));
input.origin=facility('Lima');input.destination=facility('Arequipa');
input.pickupWindow=recipe.pickupWindow;input.deliveryWindow=recipe.deliveryWindow;
input.cargoSpecification.description='[SYNTHETIC HAC54 Oct 21] Current main intake/facilities API seam; no commercial submission.';
const key=h.key('intake-draft');
const created=await createFreightRequestV2(input,key,h.fetcher),replay=await createFreightRequestV2(input,key,h.fetcher);
assert.equal(created.data.id,replay.data.id);
const loaded=await getFreightRequestV2(created.data.id,h.fetcher);
assertFreightRequestRoundTrip(created.data,loaded.data);assert.equal(loaded.data.status,'DRAFT');
assert.equal(loaded.data.origin.facilityId,input.origin.facilityId);assert.equal(loaded.data.destination.facilityId,input.destination.facilityId);
const readiness=CargoReadinessV2ResponseSchema.parse((await h.call(`/freight/requests/${loaded.data.id}/cargo-readiness?expectedDraftVersion=${loaded.data.draftVersion}`)).body).data;
assert.equal(readiness.freightRequestId,loaded.data.id);assert.equal(readiness.evaluatedDraftVersion,loaded.data.draftVersion);
assert.equal(readiness.captureStatus,'COMPLETE');assert.equal(readiness.operationalStatus,'NOT_EVALUATED');
const evaluation=await getRoadServiceabilityV2(loaded.data.id,loaded.data.draftVersion,h.fetcher);
assertServiceabilityCorrelation(loaded.data,evaluation.data);
const stale=await h.call(`/freight/requests/${loaded.data.id}/cargo-readiness?expectedDraftVersion=${loaded.data.draftVersion+1}`);
assert.equal(stale.status,409);
assert.equal((await h.call(`/freight/requests/${loaded.data.id}/cargo-readiness`,'foreign')).status,404);
assert.equal((await h.call(`/freight/requests/${loaded.data.id}/cargo-readiness`,'anonymous')).status,401);
const conflicting={...input,cargoSpecification:{...input.cargoSpecification,description:input.cargoSpecification.description+' changed'}};
await assert.rejects(()=>createFreightRequestV2(conflicting,key,h.fetcher),error=>error.status===409);

// Discover the persisted case by its exact synthetic marker; do not encode local database UUIDs in runtime.
const rows=await h.get('/freight/requests?limit=100&offset=0');
const manual=rows.find(row=>row.cargoSpecification.description===`[SYNTHETIC ${recipe.package}] ${recipe.manualSelectionCase}`);assert.ok(manual);
const commercial=await refreshRequestCommercial(manual.id,base.organizationId,AbortSignal.timeout(45000),h.fetcher);
const ranking=commercial.workflow.ranking.at(-1);assert.ok(ranking);
const commercialContext={request:commercial.request,...commercial.workflow,ranking};
assert.equal(commercial.workflow.offers.length,2);assert.equal(ranking.data.options.length,2);
assert.ok(ranking.data.options.every(option=>inspectRankedOption(option,commercialContext).available));
assert.ok(commercial.workflow.offers.every(offer=>commercial.catalog.carriers[offer.carrierId]?.state==='AVAILABLE'));
console.log('HAC54_HANDOFF_RESULT='+JSON.stringify({localOnly:true,fixture:false,organizationId:base.organizationId,
 clientContext:{status:response.status,blocker:contextBlocker},
 intakeDraftId:loaded.data.id,draftVersion:loaded.data.draftVersion,captureStatus:readiness.captureStatus,
 operationalStatus:readiness.operationalStatus,serviceability:evaluation.data.overallStatus,
 idempotencyReplay:true,payloadConflictStatus:409,staleVersionStatus:stale.status,foreignStatus:404,anonymousStatus:401,
 manualRequestId:manual.id,availableRankedOptions:ranking.data.options.length,humanDecisionCount:commercial.workflow.decisions.length,
 humanBookingCount:commercial.workflow.bookings.length,selectionOrBookingMutated:false}));
// Independent assertions passed, but the integrated context is NOT accepted while blocked.
if(contextBlocker)process.exitCode=2;
