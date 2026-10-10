// Local synthetic fixtures, real Bearer identity, Next/Hono and native workflow commands.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { WorkflowRecordV2Schema } from "../src/shared/schemas/v2/workflow.ts";
import { readRequestWorkflow } from "../src/features/v2-intake/workflow-chat-client.ts";
import { summarizeWorkflow } from "../src/features/v2-intake/workflow-chat-summary.ts";
const root = resolve(import.meta.dirname, "../..");
const app = process.env.HAC40_APP_URL ?? "http://127.0.0.1:3172";
const api = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const password = process.env.HAC12_LOCAL_QA_PASSWORD;
if (!api || !anon || !password || [app, api].some(url => !["127.0.0.1", "localhost"].includes(new URL(url).hostname))) throw new Error("Dedicated local stack required.");
const statePath = resolve(root, "tmp/hac40-workflow-http-state.json");
if (existsSync(statePath)) throw new Error("Fixture state exists; cleanup before retrying.");
const python = process.env.HAC40_PYTHON ?? "python";
function fixture(action) { execFileSync(python, [resolve(root, "scripts/hac40_workflow_local_fixture.py"), action, "--state", statePath], { cwd: root, stdio: "pipe" }); }
const auth = createClient(api, anon, { auth: { persistSession: false, autoRefreshToken: false } });
const second = createClient(api, anon, { auth: { persistSession: false, autoRefreshToken: false } });
const login = await auth.auth.signInWithPassword({ email: "qa-v2-a@cargomesh.test", password });
assert.equal(login.error, null);const token = login.data.session.access_token;
const other = await second.auth.signInWithPassword({ email: "qa-v2-b@cargomesh.test", password });
assert.equal(other.error, null);
async function call(path, body, key = crypto.randomUUID(), access = token) {
 const response = await fetch(new URL("/api/v2" + path, app), { method: body ? "POST" : "GET",
  headers: { ...(access ? { Authorization: `Bearer ${access}` } : {}), ...(body ? { "Content-Type": "application/json", "Idempotency-Key": key } : {}) },
  ...(body ? { body: JSON.stringify(body) } : {}) });
 return { status: response.status, body: await response.json() };
}
// Exercise the actual chat reader/formatter over real HTTP; no mock responses.
function chatFetcher(access = token) {
 return (path, init) => {
  assert.equal(init?.credentials, "same-origin");
  assert.equal(init?.cache, "no-store");
  assert.ok(String(path).startsWith("/api/v2/"));
  return fetch(new URL(String(path), app), { ...init, headers: access ? { Authorization: `Bearer ${access}` } : {} });
 };
}
async function chatRecord(requestId, kind, expected) {
 const rows = await readRequestWorkflow(requestId, kind, chatFetcher());
 assert.ok(rows.every(row => row.requestId === requestId && row.kind === kind));
 assert.deepEqual(rows.find(row => row.id === expected.id), expected, `chat ${kind} must match the persisted HTTP projection`);
 return rows;
}
let state;
try {
 fixture("prepare");state=JSON.parse(readFileSync(statePath, "utf8"));const refs=state.refs;
 const carrier="c2340000-0000-4000-8000-000000000001";
 for (const value of Object.values(refs).filter(v => v.kind)) WorkflowRecordV2Schema.parse(value);
 const paths={ origin:"/routing/nodes", destination:"/routing/nodes", corridor:"/routing/corridors", policy:"/routing/policies",
  limits:`/carriers/${carrier}/route-limits`, scorepolicy:"/scoring/policies", route:`/freight/requests/${refs.request.id}/routes`,
  plan:`/freight/requests/${refs.request.id}/plans`, opportunity:`/carriers/${carrier}/opportunities`, offer:`/carriers/${carrier}/offers`,
  ranking:`/freight/requests/${refs.request.id}/ranking`, decision:`/freight/requests/${refs.request.id}/decisions`, booking:"/bookings", execution:"/executions" };
 for (const [name,path] of Object.entries(paths)) {
  const read=await call(path+"/"+refs[name].id);assert.equal(read.status,200,`${name}: ${JSON.stringify(read.body)}`);WorkflowRecordV2Schema.parse(read.body.data);
  const list=await call(path);assert.equal(list.status,200,JSON.stringify(list.body));assert.ok(list.body.data.some(row=>row.id===refs[name].id));
 }
 assert.equal((await call("/bookings/"+refs.booking.id,undefined,undefined,other.data.session.access_token)).status,404);
 assert.equal((await call("/routing/nodes",undefined,undefined,null)).status,401);
 for (const kind of ["offers", "bookings", "executions"]) {
  const name = {offers:"offer", bookings:"booking", executions:"execution"}[kind];
  const persisted = await call(paths[name] + "/" + refs[name].id);
  const rows = await chatRecord(refs.request.id, kind, persisted.body.data);
  const summary = summarizeWorkflow(kind, rows);
  assert.ok(summary.length);
  if (kind === "bookings") assert.match(summary, /Shipper authorization is not carrier confirmation/);
  if (kind === "executions") assert.match(summary, /persisted status, not live GPS/);
  await assert.rejects(readRequestWorkflow(refs.request.id, kind, chatFetcher(null)), /sign in again/);
 }
 const foreignOffers = readRequestWorkflow(refs.request.id, "offers", async (path, init) => {
  const response = await chatFetcher(other.data.session.access_token)(path, init);
  assert.equal(response.status, 404, "foreign request must be hidden rather than fail with an unrelated error");
  return response;
 });
 await assert.rejects(foreignOffers, /could not load the current workflow/);
 for (const kind of ["bookings", "executions"])
  assert.deepEqual(await readRequestWorkflow(refs.request.id, kind, chatFetcher(other.data.session.access_token)), []);
 const oldAssignment=refs.plan.data.assignments[0];
 const resource={calendarId:oldAssignment.resource.verificationSource.calendarId,assetId:refs.asset.id,
  capacityPoolId:null,combinationId:null,role:"LOAD_BEARING",allocations:oldAssignment.allocations.map(({unitIndex,quantity})=>({unitIndex,quantity}))};
 const assignment={legSequence:oldAssignment.sequence,serviceId:oldAssignment.serviceId,laneId:oldAssignment.resource.verificationSource.laneId,
  window:oldAssignment.window,resources:[resource]};
 const planBody={schemaVersion:"2.0",routeId:refs.route.id,assignments:[assignment]};
 const planPath=`/freight/requests/${refs.request.id}/plans`;const planKey=crypto.randomUUID();
 const plan=await call(planPath,planBody,planKey);assert.equal(plan.status,201,JSON.stringify(plan.body));WorkflowRecordV2Schema.parse(plan.body.data);
 assert.equal(plan.body.data.data.legAssignments.length,1);assert.equal(plan.body.data.data.legAssignments[0].resources.length,1);
 assert.notEqual(plan.body.data.data.routeId,refs.route.id,"each plan owns a distinct route snapshot");
 const planReplay=await call(planPath,planBody,planKey);assert.equal(planReplay.status,200);assert.deepEqual(planReplay.body.data,plan.body.data);
 assert.equal((await call(planPath,{...planBody,assignments:[{...assignment,resources:[resource,resource]}]})).status,400);
 assert.equal((await call(planPath,{...planBody,assignments:[{...assignment,resources:[]}]})).status,400);
 const node={...refs.origin.data,name:"HTTP independent node"};const key=crypto.randomUUID();
 const created=await call("/routing/nodes",node,key);assert.equal(created.status,201,JSON.stringify(created.body));state.refs.httpNode=created.body.data;writeFileSync(statePath,JSON.stringify(state));
 const replay=await call("/routing/nodes",node,key);assert.equal(replay.status,200);assert.deepEqual(replay.body.data,created.body.data);
 assert.equal((await call("/routing/nodes",{...node,name:"different"},key)).status,409);
 const revision=await call(`/routing/nodes/${created.body.data.id}/revisions`,{expectedVersion:1,value:node});assert.equal(revision.status,200,JSON.stringify(revision.body));
 assert.equal((await call(`/routing/nodes/${created.body.data.id}/revisions`,{expectedVersion:1,value:node})).status,409);
 const evidence=refs.limits.data.source;
 const hold=await call("/capacity/holds",{schemaVersion:"2.0",bookingId:refs.booking.id,assignmentId:refs.assignment.id,expiresAt:new Date(Date.now()+3600000).toISOString(),consolidationId:null,evidence});
 assert.equal(hold.status,201,JSON.stringify(hold.body));WorkflowRecordV2Schema.parse(hold.body.data);
 const audit={schemaVersion:"2.0",expectedVersion:1,note:"HTTP carrier confirms",evidence};
 const confirmed=await call(`/carriers/${carrier}/capacity/holds/${hold.body.data.id}/confirmations`,audit);assert.equal(confirmed.status,200,JSON.stringify(confirmed.body));
 const booked=await call(`/carriers/${carrier}/bookings/${refs.booking.id}/confirmations`,{...audit,carrierReference:"QA-HTTP-BOOK",confirmation:"CONFIRMED"});
 assert.equal(booked.status,200,JSON.stringify(booked.body));assert.equal(booked.body.data.data.capacityEvidence.length,1);
 const confirmedChat = await chatRecord(refs.request.id, "bookings", booked.body.data);
 assert.match(summarizeWorkflow("bookings", confirmedChat), /carrier confirmed/i);
 const release=await call(`/capacity/holds/${hold.body.data.id}/releases`,{...audit,expectedVersion:2});assert.equal(release.status,409);
 const cancel=await call(`/bookings/${refs.booking.id}/cancellations`,{...audit,expectedVersion:2});assert.equal(cancel.status,200,JSON.stringify(cancel.body));
 const after=await call(`/capacity/holds/${hold.body.data.id}`);assert.equal(after.body.data.status,"RELEASED");
 await chatRecord(refs.request.id, "bookings", cancel.body.data);
 console.log("PASS: chat/API integration: persisted offers/bookings/executions, confirmation and cancellation readback, anonymous denial and tenant isolation; no live GPS or booking mutation claim.");
 console.log("PASS: 14 workflow collections/details; typed native outputs; actor isolation; POST/replay/hash conflict/revision/stale; hold→confirm→booking→atomic cancellation over authenticated HTTP.");
} finally {
 if (state) { fixture("cleanup"); unlinkSync(statePath); }
 await auth.auth.signOut({scope:"global"});await second.auth.signOut({scope:"global"});
}
