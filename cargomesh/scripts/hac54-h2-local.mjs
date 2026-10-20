// One explicit local H2 transaction; no bookings, execution mutations, hosted services or hidden fixtures.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {fileURLToPath} from 'node:url';
import {CreateFreightRequestV2InputSchema} from '../src/shared/schemas/v2/freight-request.ts';
import {WorkflowRecordV2Schema,WorkflowInputsV2} from '../src/shared/schemas/v2/workflow.ts';
import {requestToRevisionInput} from '../src/features/shipper-portal/shipper-model.ts';
import {refreshRequestCommercial} from '../src/features/shipper-portal/shipper-commercial-client.ts';
import {inspectOffer,inspectRankedOption} from '../src/features/shipper-portal/commercial-context.ts';
import {buildOfferBriefing} from '../src/features/shipper-portal/offer-briefing.ts';
const api=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL??''),app=new URL(process.env.HAC54_LOCAL_APP_URL??'http://localhost:3000');
assert.equal(api.origin,'http://127.0.0.1:61321');assert.ok(['localhost','127.0.0.1'].includes(app.hostname)&&app.protocol==='http:');
const gateway=JSON.parse(execFileSync('docker',['inspect','supabase_kong_cargomesh-v2-local'],{encoding:'utf8'}))[0];
assert.ok(gateway.State.Running&&gateway.NetworkSettings.Ports['8000/tcp'].some(p=>p.HostPort==='61321'));
const seed=readFileSync(fileURLToPath(new URL('../../supabase/scenarios/v2-hac54-h2/seed.sql',import.meta.url)),'utf8');
const recipe=JSON.parse(execFileSync('docker',['exec','-i','supabase_db_cargomesh-v2-local','psql','-U','postgres','-d','postgres','-X','-A','-t','-q','-v','ON_ERROR_STOP=1','-v','local_only=1'],{input:seed,encoding:'utf8'}).trim());
const at=Date.parse(recipe.clock),now=Date.now();assert.ok(now>=at&&now<Date.parse(recipe.validity.endsAt),'This dated scenario has expired. Publish an explicit new recipe; do not silently move historic dates.');
const opts={auth:{persistSession:false,autoRefreshToken:false}};
const customer=createClient(api.origin,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,opts),operator=createClient(api.origin,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,opts),setupAdmin=createClient(api.origin,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,opts);
const clientLogin=await customer.auth.signInWithPassword({email:'qa-v2-a@cargomesh.test',password:process.env.HAC54_LOCAL_CLIENT_PASSWORD});assert.equal(clientLogin.error,null);
const carrierLogin=await operator.auth.signInWithPassword({email:'hac54.carrier.local@cargomesh.test',password:process.env.HAC54_LOCAL_CARRIER_PASSWORD});assert.equal(carrierLogin.error,null);
// The existing local Carrier ADMIN is needed only to publish physical limits. Use local mail OTP, never reset its password or upgrade the quoting OPERATOR.
const adminEmail='fe1.carrier.local@example.invalid';
async function setupSession(send=false){
 if(send){const r=await setupAdmin.auth.signInWithOtp({email:adminEmail,options:{shouldCreateUser:false}});assert.equal(r.error,null);}
 const mailbox=await(await fetch('http://127.0.0.1:61324/api/v1/messages')).json();
 const message=mailbox.messages.find(row=>row.To.some(to=>to.Address===adminEmail));
 if(!message)return null;
 const body=await(await fetch('http://127.0.0.1:61324/api/v1/message/'+message.ID)).json();
 const urls=[...(body.HTML??'').matchAll(/https?:\/\/[^"\s<>]+/g)].map(match=>match[0].replaceAll('&amp;','&'));
 const link=urls.map(value=>new URL(value)).find(url=>url.origin===api.origin&&url.pathname==='/auth/v1/verify'&&url.searchParams.get('type')==='magiclink');
 if(!link)return null;
 const r=await setupAdmin.auth.verifyOtp({token_hash:link.searchParams.get('token'),type:'magiclink'});return r.error?null:r.data.session;
}
const adminSession=await setupSession()??await setupSession(true);assert.ok(adminSession,'Existing synthetic Carrier ADMIN must authenticate through local mail OTP.');
const tokens={client:clientLogin.data.session.access_token,carrier:carrierLogin.data.session.access_token,setup:adminSession.access_token},rows={},checks=[];
const key=name=>{const h=createHash('sha256').update(recipe.caseKey+':'+name).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;};
async function call(path,actor='client',body,name){
 const res=await fetch(new URL('/api/v2'+path,app),{method:body?'POST':'GET',signal:AbortSignal.timeout(45_000),
  headers:{Authorization:`Bearer ${tokens[actor]}`,...(body?{'Content-Type':'application/json','Idempotency-Key':key(name??path)}:{})},...(body?{body:JSON.stringify(body)}:{})});
 return{status:res.status,body:await res.json().catch(()=>null)};
}
async function save(name,path,body,actor='client'){
 const r=await call(path,actor,body,name);assert.ok(r.status===200||r.status===201,`${name}: ${r.status} ${JSON.stringify(r.body)}`);
 rows[name]=r.body.data;return rows[name];
}
const replace=value=>JSON.parse(JSON.stringify(value).replace(/"@(asset|plan|assignment)"/g,(_,name)=>JSON.stringify(name==='assignment'?rows.plan.data.legAssignments[0].id:rows[name].id)));
const base=await call('/freight/requests/'+recipe.refs.baseRequest);assert.equal(base.status,200);
const input=requestToRevisionInput(base.body.data);input.pickupWindow=recipe.pickupWindow;input.deliveryWindow=recipe.deliveryWindow;input.cargoSpecification.description=recipe.description;
const q=await save('request','/freight/requests',CreateFreightRequestV2InputSchema.parse(input));
const prefix=`/freight/requests/${q.id}`,carrierPrefix=`/carriers/${recipe.refs.carrier}`;
// Request creation replay can return its current snapshot. The original intended submission remains against v1.
await save('submitted',prefix+'/submissions',{expectedDraftVersion:1});
await save('asset',carrierPrefix+'/assets',recipe.asset);
await save('definition',carrierPrefix+'/capability-definitions',recipe.definition);
const {requirements:_requirements,maxWeightKg:_maxWeight,...capability}=recipe.definition;
await save('capability',carrierPrefix+'/asset-capabilities',{...capability,assetId:rows.asset.id,definitionId:rows.definition.id});
await save('calendar',carrierPrefix+'/calendars',replace(recipe.calendar));
await save('limits',carrierPrefix+'/route-limits',replace(recipe.limits),'setup');
await save('route',prefix+'/routes',{schemaVersion:'2.0',corridorIds:[recipe.refs.corridor],policyId:recipe.refs.routePolicy});
await save('plan',prefix+'/plans',WorkflowInputsV2['plans.create'].parse({schemaVersion:'2.0',routeId:rows.route.id,assignments:[{
 legSequence:1,serviceId:recipe.refs.service,laneId:recipe.refs.lane,window:recipe.planWindow,resources:[{
  calendarId:rows.calendar.id,assetId:rows.asset.id,capacityPoolId:null,combinationId:null,role:'LOAD_BEARING',allocations:[{unitIndex:0,quantity:1}]}]}]}));
assert.equal(rows.plan.data.eligibility,'eligible',JSON.stringify(rows.plan.data));
const invite=WorkflowInputsV2['opportunities.create'].parse({schemaVersion:'2.0',planId:rows.plan.id,carrierId:recipe.refs.carrier,
 assignmentIds:rows.plan.data.legAssignments.map(row=>row.id),responseDeadline:recipe.responseDeadline,responseChannel:'MANUAL'});
await save('opportunity',prefix+'/opportunities',invite);
const replay=await call(prefix+'/opportunities','client',invite,'opportunity');assert.equal(replay.status,200);assert.equal(replay.body.data.id,rows.opportunity.id);assert.equal(replay.body.meta.idempotentReplay,true);checks.push('opportunity idempotent replay');
const opp=await call(`${carrierPrefix}/opportunities/${rows.opportunity.id}`,'carrier');assert.equal(opp.status,200);assert.equal(opp.body.data.requestId,q.id);
await save('response',`${carrierPrefix}/opportunities/${rows.opportunity.id}/responses`,{schemaVersion:'2.0',expectedVersion:1,response:'ACCEPTED',note:'Explicit synthetic local Carrier review; no booking.',evidence:recipe.evidence},'carrier');
const stale=await call(`${carrierPrefix}/opportunities/${rows.opportunity.id}/responses`,'carrier',{schemaVersion:'2.0',expectedVersion:999,response:'ACCEPTED',note:'Synthetic stale-version negative',evidence:recipe.evidence},'stale-response');assert.equal(stale.status,409);checks.push('stale Carrier response denied');
const denied=await call(`${carrierPrefix}/opportunities/${rows.opportunity.id}/offers`,'client',replace(recipe.quote),'denied-issuer');assert.equal(denied.status,403);checks.push('Client cannot issue Carrier quote');
await save('offer1',`${carrierPrefix}/opportunities/${rows.opportunity.id}/offers`,WorkflowInputsV2['offers.create'].parse(replace(recipe.quote)),'carrier');
const quote2=replace(recipe.quote);quote2.price.amount=recipe.revisedAmount;quote2.breakdown[0].amount.amount=recipe.revisedAmount;quote2.supersedesOfferId=rows.offer1.id;
await save('offer2',`${carrierPrefix}/opportunities/${rows.opportunity.id}/offers`,WorkflowInputsV2['offers.create'].parse(quote2),'carrier');
assert.equal(rows.offer2.data.offerVersion,2);assert.equal(rows.offer2.data.source.issuerId,'d54c0000-0000-4000-8000-000000000001');
await save('scorePolicy','/scoring/policies',recipe.scoringPolicy);
await save('ranking',prefix+'/ranking',{schemaVersion:'2.0',policyId:rows.scorePolicy.id});
const fresh=await refreshRequestCommercial(q.id,q.organizationId,AbortSignal.timeout(45_000),(path,init)=>fetch(new URL(String(path),app),{...init,headers:{...init?.headers,Authorization:`Bearer ${tokens.client}`}}));
const context={request:fresh.request,offers:fresh.workflow.offers,opportunities:fresh.workflow.opportunities,plans:fresh.workflow.plans,ranking:fresh.workflow.ranking.find(row=>row.id===rows.ranking.id)};
const current=context.offers.find(row=>row.id===rows.offer2.id),previous=context.offers.find(row=>row.id===rows.offer1.id);
for(const row of [current,previous,rows.plan,rows.opportunity,rows.ranking])WorkflowRecordV2Schema.parse(row);
assert.equal(inspectOffer(current,context).current,true);assert.ok(inspectOffer(previous,context).reasons.includes('SUPERSEDED'));
assert.ok(context.ranking.data.options.length>0);assert.equal(inspectRankedOption(context.ranking.data.options[0],context).available,true);
const briefing=buildOfferBriefing(context.offers,context.ranking,Date.now(),context);assert.ok(briefing.recommended);assert.equal(briefing.recommended.price,'USD 325.00');
const carrierRead=await call(`${carrierPrefix}/offers/${current.id}`,'carrier');assert.equal(carrierRead.status,200);assert.deepEqual(carrierRead.body.data,current);
assert.deepEqual(fresh.workflow.bookings,[]);assert.deepEqual(fresh.workflow.decisions,[]);checks.push('same persisted Client/Carrier quote v2','old v1 superseded','native ranked option available','no decisions or bookings created');
console.log(JSON.stringify({localOnly:true,caseKey:recipe.caseKey,clock:recipe.clock,requestId:q.id,reference:context.request.referenceCode,
 planId:rows.plan.id,opportunityId:rows.opportunity.id,offerId:current.id,offerVersion:current.data.offerVersion,issuerId:current.data.source.issuerId,
 price:current.data.price,validUntil:current.data.validity.endsAt,rankingId:rows.ranking.id,checks,
 clientUrl:new URL(`/clients/requests/${q.id}`,app).href,carrierUrl:new URL('/carriers/requests',app).href,briefing:briefing.script},null,2));
