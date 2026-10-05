import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
export async function pending(c:any){
 const {call,modules,output,CARRIER,clone}=c,out=process.env.HAC44_OUT!;
 const r=JSON.parse(readFileSync(out+'/dataset/pending-refs.json','utf8'));
 const e=JSON.parse(readFileSync(out+'/logs/extended-extended-records.json','utf8'));
 const l=JSON.parse(readFileSync(out+'/dataset/ltl-refs.json','utf8'));
 const cp='/carriers/'+CARRIER,audit=(v=1)=>({schemaVersion:'2.0',expectedVersion:v,note:'HAC44 pending transition',evidence:r.limits.data.source});
 const cases:any[]=[];
 await call('pending-B-own-control','/facilities',undefined,undefined,2,200);
 async function test(template:string,path:string,body?:any,shared=false){
  const method=body===undefined?'GET':'POST',rows:any[]=[];
  for(const [actor,http] of [[0,401],[3,403]]){const x=await call('pending-anonymous-or-revoked',path,body,undefined,actor,http);x.template=template;rows.push(x);}
  const foreignStatus=shared?(body===undefined?200:403):(path.startsWith('/carriers/')?403:404);
  const foreign=await call('pending-foreign',path,body,undefined,2,foreignStatus);foreign.template=template;rows.push(foreign);
  if(body!==undefined){const x=await call('pending-invalid-version',path,{...clone(body),expectedVersion:999999},undefined,1,409);x.template=template;rows.push(x);}
  const positive=await call('pending-functional-positive',path,body,undefined,1,200);positive.template=template;
  let valid=positive.http===200;
  if(valid&&method==='GET'){const data=positive.response.data;valid=template==='/api/v2/intake/options'?!!data:Array.isArray(data)?data.length>0:!!data?.id;}
  if(valid&&method==='GET'&&!shared&&foreign.http===200)valid=Array.isArray(foreign.response.data)&&!foreign.response.data.some((x:any)=>Array.isArray(positive.response.data)?positive.response.data.some((a:any)=>a.id===x.id):positive.response.data.id===x.id);
  if(valid&&body!==undefined){const x=await call('pending-stale-after-positive',path,body,undefined,1,409);x.template=template;rows.push(x);}
  cases.push({method,template,path,status:valid&&rows.every(x=>x.status==='PASS')?'PASS':!valid?'BLOQUEADO':'FAIL',positiveHttp:positive.http,validPositive:valid,controls:rows.map(x=>({actor:x.actor,label:x.label,http:x.http,status:x.status})),sharedCatalog:shared});output('cases.json',cases);return positive;
 }
 const get=(template:string,path:string,shared=false)=>test('/api/v2'+template,path,undefined,shared);
 async function pair(template:string,path:string,id:string){await get(template,path);await get(template+'/:id',path+'/'+id);}
 function clean(v:any,s:any):any {while(s?._def&&['ZodEffects','ZodOptional','ZodNullable','ZodDefault'].includes(s._def.typeName))s=s._def.schema??s._def.innerType;if(v===null)return null;if(s?._def.typeName==='ZodObject')return Object.fromEntries(Object.entries(s.shape).filter(([k])=>k in v).map(([k,t])=>[k,clean(v[k],t)]));if(s?._def.typeName==='ZodArray')return v.map((x:any)=>clean(x,s._def.type));return v;}
 const hold=await call('pending-hold-create','/capacity/holds',{schemaVersion:'2.0',bookingId:r.booking.id,assignmentId:r.assignment.id,expiresAt:new Date(Date.now()+3600000).toISOString(),consolidationId:null,evidence:r.limits.data.source},undefined,1,201);assert.equal(hold.http,201);let h=hold.response.data;
 await pair('/bookings/:parentId/execution','/bookings/'+r.booking.id+'/execution',r.execution.id);
 await pair('/bookings/:parentId/reservations','/bookings/'+r.booking.id+'/reservations',h.id);
 await pair('/carriers/:carrierId/bookings',cp+'/bookings',r.booking.id);
 await pair('/carriers/:carrierId/capacity/holds',cp+'/capacity/holds',h.id);
 await pair('/carriers/:carrierId/executions',cp+'/executions',r.execution.id);
 const s=r.second,win=s.execution.data.plannedWindow;
 const driverInput={...clone(c.fixture.drivers),fullName:'HAC44 pending driver',availableWindows:[win],dutyWindow:win,maximumDutySeconds:86400};
 const driver=await call('pending-driver-control',cp+'/drivers',driverInput,undefined,1,201);assert.equal(driver.http,201);
 for(const kind of ['driver-assignments','vehicle-assignments']){const value={...clone(c.fixture[kind]),executionId:s.execution.id,window:win,status:'PROPOSED',...(kind==='driver-assignments'?{driverId:driver.response.data.id}:{assetId:s.asset.id,combinationId:null,reservationId:null})};const row=await call('pending-crew-control',cp+'/'+kind,value,undefined,1,201);assert.equal(row.http,201);e[kind]=row.response.data;}
 const event=await call('pending-asset-event-create',cp+'/assets/'+r.asset.id+'/events',{...audit(),next:'MAINTENANCE',reason:'HAC44 synthetic event fixture'},undefined,1,201);assert.equal(event.http,201);
 await pair('/carriers/:carrierId/assets/:parentId/events',cp+'/assets/'+r.asset.id+'/events',event.response.data.id);
 const events=await call('pending-events-fixture','/executions/'+e.executions.id+'/events',undefined,undefined,1,200);assert(events.response.data?.length);
 await pair('/executions/:parentId/events','/executions/'+e.executions.id+'/events',events.response.data[0].id);
 await pair('/carriers/:carrierId/executions/:parentId/events',cp+'/executions/'+e.executions.id+'/events',events.response.data[0].id);
 await pair('/executions/:parentId/incidents','/executions/'+e.executions.id+'/incidents',e.incidents.id);
 const updates=await call('pending-updates-fixture','/incidents/'+e.incidents.id+'/updates',undefined,undefined,1,200);assert(updates.response.data?.length);
 await pair('/incidents/:parentId/updates','/incidents/'+e.incidents.id+'/updates',updates.response.data[0].id);
 await get('/carriers/:carrierId/incidents/:parentId/updates/:id',cp+'/incidents/'+e.incidents.id+'/updates/'+updates.response.data[0].id);
 await pair('/freight/requests/:requestId/offers','/freight/requests/'+r.request.id+'/offers',r.offer.id);
 for(const [kind,id] of [['routes',r.route.id],['plans',r.plan.id],['offers',r.offer.id],['decisions',r.decision.id]])await get('/'+kind+'/:id','/'+kind+'/'+id);
 await test('/api/v2/intake/options','/intake/options',undefined,true);
 for(const [kind,path,shared] of [['conditions','/routing/conditions',true],['corridors','/routing/corridors',true],['route-policies','/routing/policies',true],['scoring-policies','/scoring/policies',true],['limits',cp+'/route-limits',false],['metrics',cp+'/metrics',false]] as any[]){assert(e[kind]?.id,kind);const current=await call('pending-current-version-control',path+'/'+e[kind].id,undefined,undefined,1,200);assert.equal(current.http,200);const record=current.response.data;await test('/api/v2'+path.replace(CARRIER,':carrierId')+'/:id/revisions',path+'/'+record.id+'/revisions',{expectedVersion:record.version,value:clean(record.data,modules['workflow.ts'].WorkflowInputsV2[kind+'.publish'])},shared);}
 for(const kind of ['driver-assignments','vehicle-assignments']){const record=e[kind];assert(record?.id,kind);await test('/api/v2/carriers/:carrierId/'+kind+'/:id/revisions',cp+'/'+kind+'/'+record.id+'/revisions',{expectedVersion:record.version,value:clean(record.value,modules['catalog.ts'].CatalogInputsV2[kind])});}
 await test('/api/v2/capacity/holds/:id/releases','/capacity/holds/'+h.id+'/releases',audit());
 const hold2=await call('pending-second-hold-control','/capacity/holds',{...hold.request,bookingId:s.booking.id,assignmentId:s.assignment.id,expiresAt:new Date(Date.now()+3600000).toISOString()},undefined,1,201);assert.equal(hold2.http,201);h=hold2.response.data;
 await test('/api/v2/carriers/:carrierId/capacity/holds/:id/releases',cp+'/capacity/holds/'+h.id+'/releases',audit());
 await test('/api/v2/carriers/:carrierId/executions/:id/cancellations',cp+'/executions/'+r.execution.id+'/cancellations',audit());
 const currentBooking=await call('pending-booking-version-control',cp+'/bookings/'+s.booking.id,undefined,undefined,1,200);assert.equal(currentBooking.http,200);
 await test('/api/v2/carriers/:carrierId/bookings/:id/cancellations',cp+'/bookings/'+s.booking.id+'/cancellations',audit(currentBooking.response.data.version));
 await test('/api/v2/freight/requests/:requestId/decisions/:id/revocations','/freight/requests/'+r.request.id+'/decisions/'+r.decision.id+'/revocations',audit());
 await test('/api/v2/carriers/:carrierId/offers/:id/withdrawals',cp+'/offers/'+r.offer.id+'/withdrawals',audit());
 const member=await call('pending-batch-member-control','/capacity/holds',{schemaVersion:'2.0',bookingId:r.ltl.booking.id,assignmentId:r.ltl.assignment.id,expiresAt:new Date(Date.now()+3600000).toISOString(),consolidationId:r.ltl.batch.id,evidence:r.limits.data.source},undefined,1,201);assert.equal(member.http,201);
 await test('/api/v2/carriers/:carrierId/consolidations/:id/cancellations',cp+'/consolidations/'+r.ltl.batch.id+'/cancellations',audit());
 console.log(JSON.stringify({cases:cases.length,pass:cases.filter(x=>x.status==='PASS').length,fail:cases.filter(x=>x.status!=='PASS').length}));
 assert(cases.every(x=>x.status==='PASS'),'Pending route controls failed; preserve exact evidence');
}
