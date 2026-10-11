/** Actual local Auth sessions -> unchanged Next request stores -> Hono -> RPC.
 * Business responses and expectations are saved; credentials remain in memory.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const root = process.cwd().replaceAll("\\", "/").replace(/\/cargomesh$/, "");
const out = process.env.CP_OUT!;
const sessions = JSON.parse(process.env.CP_SESSIONS!);
const fixture = JSON.parse(readFileSync(out + "/dataset/carrier-refs.json", "utf8"));
const refs = fixture.refs;
const id = (name: string) => refs[name].id;
const origin = "http://127.0.0.1:" + Number(process.env.CP_PORT);
const results: any[] = [];
const save = (name: string, value: unknown) => {
  const text = JSON.stringify(value, null, 2) + "\n";
  writeFileSync(out + "/logs/" + name, text);
  assert.equal(readFileSync(out + "/logs/" + name, "utf8"), text);
};
const ev = () => ({ reference: "fixture:carrier-portal-http", provider: "LOCAL_ONLY / SIMULATED",
  observedAt: new Date(Date.now() - 86400000).toISOString(), validUntil: new Date(Date.now() + 864000000).toISOString(),
  provenanceStatus: "SIMULATED" });
const audit = (version = 1) => ({ schemaVersion: "2.0", expectedVersion: version, note: "Synthetic local operation", evidence: ev() });
async function main() {
const require = createRequire(root + "/cargomesh/package.json");
require("next/dist/server/node-environment");
const { workAsyncStorage } = require("next/dist/server/app-render/work-async-storage.external");
const { workUnitAsyncStorage } = require("next/dist/server/app-render/work-unit-async-storage.external");
const { createRequestStoreForAPI } = require("next/dist/server/async-storage/request-store");
const { NextRequest } = require("next/server");
const { createClient } = require("@supabase/supabase-js");
const { createHonoApp } = await import(pathToFileURL(root + "/cargomesh/src/server/hono/app.ts").href);
const app = createHonoApp();
const server = createServer(async (req, res) => {
  try {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const request = new NextRequest(origin + req.url, { method: req.method, headers: req.headers,
      ...(body.length ? { body, duplex: "half" } : {}) });
    const url = new URL(request.url);
    const store = createRequestStoreForAPI(request, { pathname: url.pathname, search: url.search },
      { tags: [], expirationsByCacheHandler: new Map() }, undefined, undefined);
    const response = await workAsyncStorage.run({ route: url.pathname, isStaticGeneration: false },
      () => workUnitAsyncStorage.run(store, () => app.fetch(request)));
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch { res.writeHead(500); res.end(JSON.stringify({ error: { code: "QA_TRANSPORT_ERROR" } })); }
});
await new Promise<void>(resolve => server.listen(Number(process.env.CP_PORT), "127.0.0.1", resolve));
async function call(label: string, actor: string | null, path: string, expected: number, body?: any,
  check: (value: any) => boolean = () => true, cookie = false) {
  const headers: Record<string, string> = {};
  if (actor) {
    if (cookie) {
      const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } });
      headers.Cookie = client.auth.storageKey + "=base64-" + Buffer.from(JSON.stringify(sessions[actor])).toString("base64url");
      headers.Origin = origin;
    } else headers.Authorization = "Bearer " + sessions[actor].access_token;
  }
  if (body !== undefined) Object.assign(headers, { "Content-Type": "application/json", "Idempotency-Key": randomUUID() });
  const response = await fetch(origin + "/api/v2" + path, { method: body === undefined ? "GET" : "POST", headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const value = await response.json();
  const row = { label, actor, method: body === undefined ? "GET" : "POST", path: "/api/v2" + path,
    authentication: cookie ? "actual-local-Auth-cookie" : actor ? "actual-local-Auth-Bearer" : "anonymous",
    expected, observed: response.status, pass: response.status === expected && check(value), body, response: value };
  results.push(row); save("carrier-http-cases.json", results);
  console.log(label + ": expected=" + expected + " observed=" + response.status + " " + (row.pass ? "PASS" : "FAIL"));
  if (!row.pass) {
    Object.assign(row, { failureKind: "HAC45_RETEST_FAILURE" });
    save("carrier-http-cases.json", results);
  }
  return { row, value, data: value.data };
}
const nonempty = (value: any) => Array.isArray(value.data) && value.data.length > 0;
const pair = (negative: any, positive: any) => Object.assign(negative.row, {
  positiveControl: positive.row.label,
  pairVerdict: positive.row.pass ? negative.row.pass ? "PASS" : "FAIL" : "BLOQUEADO" });
const carrierPath = "/carriers/" + id("C1");
// HAC45 integration:26-30; resources.ts:65. Member catalog endpoint controls
// retain /carriers; carrier catalog certification follows the actual Web path.
const portalPath = "/carrier-portal/carriers/" + id("C1");
let blocked = false;
const permissionChecks: any[] = [];
try {
  for (const actor of ["c1-admin", "c1-operator", "c1-dispatcher"])
    await call(actor + "-own-open", actor, carrierPath + "/opportunities", 200, undefined, nonempty);
  for (const actor of ["c2-admin", "c2-operator"])
    await call(actor + "-own-open", actor, "/carriers/" + id("C2") + "/opportunities", 200, undefined, nonempty);
  await call("cookie-open-positive", "c1-admin", carrierPath + "/opportunities", 200, undefined, nonempty, true);
  for (const actor of ["c2-operator", "inactive", "invited", "unverified", "expired", "revoked"]) {
    const control = await call(actor + "-control", actor === "c2-operator" ? actor : "c1-admin",
      "/carriers/" + id(actor === "c2-operator" ? "C2" : "C1") + "/opportunities", 200, undefined, nonempty);
    const negative = await call(actor + "-negative", actor, carrierPath + "/opportunities", 403, undefined,
      v => v.error?.code === "FORBIDDEN_CARRIER_IDENTITY");
    Object.assign(negative.row, { positiveControl: control.row.label,
      pairVerdict: !control.row.pass ? "BLOQUEADO" : negative.row.pass ? "PASS" : "FAIL" });
  }
  const anonymousControl = await call("anonymous-control", "c1-admin", carrierPath + "/opportunities", 200, undefined, nonempty);
  const anonymous = await call("anonymous-negative", null, carrierPath + "/opportunities", 401);
  Object.assign(anonymous.row, { positiveControl: anonymousControl.row.label,
    pairVerdict: anonymousControl.row.pass && anonymous.row.pass ? "PASS" : "BLOQUEADO" });
  const profileControl = await call("portal-profile-carrier-only", "c1-admin", portalPath, 200, undefined, v => v.data?.id === id("C1"), true);
  for (const [actor, role, carrier] of [["c1-admin", "ADMIN", "C1"], ["c1-operator", "OPERATOR", "C1"],
    ["c1-dispatcher", "DISPATCHER", "C1"], ["c2-admin", "ADMIN", "C2"], ["c2-operator", "OPERATOR", "C2"]]) {
    await call(actor + "-portal-access", actor, "/carrier-portal/access", 200, undefined,
      v => v.data?.length === 1 && v.data[0].carrierId === id(carrier) && v.data[0].role === role);
    const own = await call(actor + "-portal-profile", actor, "/carrier-portal/carriers/" + id(carrier), 200,
      undefined, v => v.data?.id === id(carrier));
    pair(await call(actor + "-portal-other-profile-negative", actor, "/carrier-portal/carriers/" + id(carrier === "C1" ? "C2" : "C1"), 403), own);
  }
  for (const actor of ["inactive", "invited", "unverified", "expired", "revoked", "shipper", "setup"]) {
    await call(actor + "-portal-access-empty", actor, "/carrier-portal/access", 200, undefined,
      v => Array.isArray(v.data) && v.data.length === 0);
    pair(await call(actor + "-portal-profile-negative", actor, portalPath, 403, undefined,
      v => v.error?.code === "FORBIDDEN_CARRIER_IDENTITY"), profileControl);
    const catalogControl = await call(actor + "-portal-catalog-control", "c1-admin", portalPath + "/services", 200, undefined, nonempty);
    pair(await call(actor + "-portal-catalog-negative", actor, portalPath + "/services", 403, undefined,
      v => v.error?.code === "FORBIDDEN_CARRIER_IDENTITY"), catalogControl);
  }
  for (const carrier of ["C1", "C2"]) {
    const path = "/carriers/" + id(carrier);
    const profile = await call(carrier + "-setup-profile-endpoint-control", "setup", path, 200, undefined,
      v => v.data?.id === id(carrier));
    Object.assign(profile.row, { certification: "ENDPOINT_CONTROL_ONLY; setup OWNER + CATALOG_ADMIN is not a carrier principal" });
    const catalog = await call(carrier + "-setup-catalog-endpoint-control", "setup", path + "/services", 200, undefined, nonempty);
    Object.assign(catalog.row, { certification: "ENDPOINT_CONTROL_ONLY; does not certify carrier authorization" });
    const own = await call(carrier + "-carrier-workflow-control", carrier === "C1" ? "c1-admin" : "c2-admin",
      path + "/opportunities", 200, undefined, nonempty);
    pair(await call(carrier + "-shipper-no-carrier-negative", "shipper", path + "/opportunities", 403, undefined,
      v => v.error?.code === "FORBIDDEN_CARRIER_IDENTITY"), own);
    // I10/I14 scope carrier principals; they do not prohibit authenticated
    // shipper discovery reads. Record this separately from carrier permission.
    const discovery = await call(carrier + "-shipper-discovery-observation", "shipper", path + "/services", 200, undefined, nonempty);
    Object.assign(discovery.row, { certification: "SHIPPER_DISCOVERY_OBSERVATION; no catalog grant; not a carrier authorization control",
      contractLimit: "IDENTITY_AND_MCP_CHANNELS.md:9,10,14; PRODUCT_SCOPE.md:47 does not establish a shipper catalog-read prohibition" });
  }
  for (const path of ["services", "depots", "assets", "drivers", "calendars", "asset-capabilities", "capability-definitions"])
    await call("portal-catalog-" + path, "c1-admin", portalPath + "/" + path, 200, undefined, nonempty);
  const profileRevision = { value: profileControl.data.value, expectedVersion: profileControl.data.version };
  const revisionControl = await call("admin-profile-revision-positive", "c1-admin", portalPath + "/revisions", 200,
    profileRevision, v => v.data?.id === id("C1") && v.data?.version === profileControl.data.version + 1, true);
  for (const actor of ["c1-operator", "c1-dispatcher", "c2-admin", "shipper", "inactive", "invited", "unverified", "expired", "revoked"])
    pair(await call(actor + "-profile-revision-negative", actor, portalPath + "/revisions", 403, profileRevision,
      // Catalog HTTP maps PT403 to FORBIDDEN_CATALOG; workflow preserves its
      // role code. supabase-catalog-repository.ts:8 is the HTTP boundary.
      v => v.error?.code === (["c1-operator", "c1-dispatcher"].includes(actor) ? "FORBIDDEN_CATALOG" : "FORBIDDEN_CARRIER_IDENTITY")), revisionControl);
  const offerBody = (suffix = "") => ({ schemaVersion: "2.0", carrierReference: "HAC44_CP_OFFER" + suffix,
    planCandidateId: id(suffix ? "conflict-plan" : "plan"), coveredServiceIds: [id("C1-service")],
    coveredAssignmentIds: [id(suffix ? "conflict-assignment" : "assignment")],
    price: { amount: 100, currency: "USD" }, breakdown: [{ kind: "TRANSPORT", amount: { amount: 100, currency: "USD" },
      treatment: "QUOTED", source: ev(), observedAt: ev().observedAt, details: null }],
    validity: { startsAt: new Date(Date.now() - 3600000).toISOString(), endsAt: new Date(Date.now() + 28800000).toISOString() },
    source: { channel: "MANUAL", evidence: ev() }, issuedAt: new Date().toISOString(), estimatedPickupAt: null,
    estimatedDeliveryAt: null, transitDurationSeconds: 3600, reservableCapacity: { weightKg: 1000, volumeM3: 2 },
    commercialTerms: [], evidence: [ev()], supersedesOfferId: null });
  const offers: any[] = [], bookings: any[] = [], executions: any[] = [];
  for (const suffix of ["", "conflict-"]) {
    const prefix = suffix ? "conflict-" : "";
    const offer = await call(prefix + "fresh-offer", "c1-operator", carrierPath + "/opportunities/" + id(prefix + "opportunity") + "/offers",
      201, offerBody(suffix), v => v.meta?.idempotentReplay === false && !!v.data?.id);
    if (!offer.data?.id) throw new Error("Functional offer prerequisite missing");
    offers.push(offer.data);
    const decision = await call(prefix + "shipper-select", "shipper", "/freight/requests/" + id(prefix + "request") + "/decisions", 201,
      { schemaVersion: "2.0", planId: id(prefix + "plan"), selectedOfferIds: [offer.data.id], rationale: "Synthetic explicit shipper decision",
        policyId: id("scorepolicy"), consideredOfferIds: [offer.data.id], evidence: [ev()] });
    if (!decision.data?.id) throw new Error("Decision prerequisite missing");
    const booking = await call(prefix + "shipper-authorize", "shipper", "/bookings", 201,
      { schemaVersion: "2.0", decisionId: decision.data.id, offerId: offer.data.id, authorization: "AUTHORIZE", evidence: ev() });
    if (!booking.data?.id) throw new Error("Booking prerequisite missing");
    bookings.push(booking.data);
    const execution = await call(prefix + "shipper-prepare-execution", "shipper", "/executions", 201,
      { schemaVersion: "2.0", bookingId: booking.data.id, serviceId: id("C1-service") });
    if (!execution.data?.id) throw new Error("Execution prerequisite missing");
    executions.push(execution.data);
  }
  await call("calendar-plan-before-occupancy", "shipper", "/plans/" + id("conflict-plan"), 200, undefined,
    v => v.data?.status === "eligible");
  const hold = await call("calendar-free-positive", "shipper", "/capacity/holds", 201,
    { schemaVersion: "2.0", bookingId: bookings[0].id, assignmentId: id("assignment"),
      expiresAt: new Date(Date.now() + 3600000).toISOString(), consolidationId: null, evidence: ev() });
  if (!hold.data?.id) throw new Error("Hold prerequisite missing");
  await call("carrier-confirm-capacity", "c1-operator", carrierPath + "/capacity/holds/" + hold.data.id + "/confirmations", 200, audit());
  const busy = await call("calendar-occupied-negative", "shipper", "/capacity/holds", 409,
    { schemaVersion: "2.0", bookingId: bookings[1].id, assignmentId: id("conflict-assignment"),
      expiresAt: new Date(Date.now() + 3600000).toISOString(), consolidationId: null, evidence: ev() },
    v => v.error?.code === "BOOKING_ASSIGNMENT_NOT_CURRENT");
  Object.assign(busy.row, { positiveControl: hold.row.label, pairVerdict: hold.row.pass ? busy.row.pass ? "PASS" : "FAIL" : "BLOQUEADO" });
  await call("carrier-confirm-booking", "c1-operator", carrierPath + "/bookings/" + bookings[0].id + "/confirmations", 200,
    { ...audit(), carrierReference: "HAC44_CP_BOOKING", confirmation: "CONFIRMED" });
  const crew = JSON.parse(readFileSync(root + "/supabase/scenarios/v2-road-baseline/fixtures/hac40-crew.json", "utf8"));
  const driverBody = { ...crew["driver-assignments"], serviceId: id("C1-service"), driverId: id("C1-driver"),
    executionId: executions[0].id, window: refs.window, status: "CONFIRMED" };
  const carrierDriver = await call("portal-driver-assignment-carrier-only", "c1-admin", portalPath + "/driver-assignments", 201, driverBody);
  for (const actor of ["c1-operator", "c1-dispatcher", "c2-admin", "shipper"])
    pair(await call(actor + "-portal-driver-write-negative", actor, portalPath + "/driver-assignments", 403, driverBody,
      v => v.error?.code === (["c1-operator", "c1-dispatcher"].includes(actor) ? "FORBIDDEN_CATALOG" : "FORBIDDEN_CARRIER_IDENTITY")), carrierDriver);
  const controlDriverBody = { ...driverBody, driverId: id("C1-control-driver") };
  const driver = await call("driver-free-positive", "setup", carrierPath + "/driver-assignments", 201, controlDriverBody);
  Object.assign(driver.row, { certification: "ENDPOINT_CONTROL_ONLY; independent catalog setup, not carrier authorization" });
  pair(await call("shipper-no-catalog-grant-negative", "shipper", carrierPath + "/driver-assignments", 403,
    driverBody, v => v.error?.code === "FORBIDDEN_CATALOG"), driver);
  const driverBusy = await call("driver-occupied-negative", "setup", carrierPath + "/driver-assignments", 409,
    { ...controlDriverBody, executionId: executions[1].id }, v => v.error?.code === "FLEET_COMMITMENT_CONFLICT");
  Object.assign(driverBusy.row, { positiveControl: driver.row.label, pairVerdict: driver.row.pass ? driverBusy.row.pass ? "PASS" : "FAIL" : "BLOQUEADO" });
  await call("vehicle-confirmed-positive", "setup", carrierPath + "/vehicle-assignments", 201,
    { ...crew["vehicle-assignments"], serviceId: id("C1-service"), executionId: executions[0].id, assetId: id("C1-asset"),
      reservationId: hold.data.id, window: refs.window, capacityCommitted: hold.data.data.capacityCommitted, status: "CONFIRMED" });
  await call("dispatcher-start", "c1-dispatcher", carrierPath + "/executions/" + executions[0].id + "/starts", 200, audit());
  const incident = await call("dispatcher-incident", "c1-dispatcher", carrierPath + "/executions/" + executions[0].id + "/incidents", 201,
    { schemaVersion: "2.0", kind: "DELAY", severity: "WARNING", occurredAt: new Date().toISOString(), location: null,
      description: "[SYNTHETIC] Paired incident history fixture", evidence: [ev()] });
  if (!incident.data?.id) throw new Error("Incident prerequisite missing");
  await call("dispatcher-resolve-incident", "c1-dispatcher", carrierPath + "/incidents/" + incident.data.id + "/updates", 200,
    { ...audit(), action: "RESOLVE" });
  const currentExecution = await call("execution-version-before-complete", "c1-dispatcher", carrierPath + "/executions/" + executions[0].id, 200);
  await call("dispatcher-complete", "c1-dispatcher", carrierPath + "/executions/" + executions[0].id + "/completions", 200,
    audit(currentExecution.data.version));
  await call("carrier-closed-booking", "c1-admin", carrierPath + "/bookings/" + bookings[0].id, 200, undefined,
    v => v.data?.status === "COMPLETED");
  // Fill formerly empty collections through the native HTTP writers, with
  // nonempty exact-ID controls and cross-carrier/role denials in the same run.
  const metricBody = { schemaVersion: "2.0", period: {
    startsAt: new Date(Date.now() - 172800000).toISOString(), endsAt: new Date(Date.now() - 86400000).toISOString() },
    corridorId: id("corridor"), mode: "ROAD", sampleSize: 3, onTimeRate: 1,
    successfulDeliveryRate: 1, source: ev() };
  const nativeRows: Record<string, any> = {};
  for (const carrier of ["C1", "C2"]) {
    const admin = carrier === "C1" ? "c1-admin" : "c2-admin";
    const path = "/carriers/" + id(carrier);
    nativeRows[carrier + "-metric"] = await call(carrier + "-admin-metric-native-positive", admin,
      path + "/metrics", 201, metricBody, v => !!v.data?.id && v.data?.data.sampleSize === 3);
    const consolidationBody = { schemaVersion: "2.0", serviceId: id(carrier + "-ltl-service"),
      calendarId: id(carrier + "-ltl-calendar"), routeId: id(carrier === "C1" ? "route" : "C2-route"),
      window: refs.window, cargoCategoryIds: ["c0000000-0000-0000-0000-000000000001"],
      compatibleRequirementCodes: [], evidence: ev() };
    nativeRows[carrier + "-consolidation"] = await call(carrier + "-consolidation-native-positive",
      carrier === "C1" ? "c1-dispatcher" : "c2-operator", path + "/consolidations", 201, consolidationBody,
      v => !!v.data?.id && v.data?.status === "OPEN");
    // Event touches only the spare LTL asset after the booking closes.
    const eventBody = { ...audit(refs[carrier + "-ltl-asset"].version), next: "MAINTENANCE",
      reason: "[SYNTHETIC] Asset authorization fixture" };
    nativeRows[carrier + "-event"] = await call(carrier + "-asset-event-native-positive",
      carrier === "C1" ? "c1-dispatcher" : "c2-operator", path + "/assets/" + id(carrier + "-ltl-asset") + "/events",
      201, eventBody, v => !!v.data?.id && v.data?.data.next === "MAINTENANCE");
    if (carrier === "C1") {
      for (const actor of ["c1-operator", "c1-dispatcher"])
        pair(await call(actor + "-metrics-role-negative", actor, path + "/metrics", 403, metricBody,
          v => v.error?.code === "FORBIDDEN_CARRIER_ROLE"), nativeRows[carrier + "-metric"]);
      pair(await call("other-carrier-metrics-write-negative", "c2-admin", path + "/metrics", 403, metricBody,
        v => v.error?.code === "FORBIDDEN_CARRIER_IDENTITY"), nativeRows[carrier + "-metric"]);
      pair(await call("other-carrier-consolidation-write-negative", "c2-operator", path + "/consolidations", 403, consolidationBody,
        v => v.error?.code === "FORBIDDEN_CARRIER_IDENTITY"), nativeRows[carrier + "-consolidation"]);
      pair(await call("other-carrier-asset-event-write-negative", "c2-operator", path + "/assets/" + id("C1-ltl-asset") + "/events",
        403, eventBody, v => v.error?.code === "FORBIDDEN_CARRIER_IDENTITY"), nativeRows[carrier + "-event"]);
    }
  }
  const ownPaths = [
    ["metrics", "/metrics", nativeRows["C1-metric"]],
    ["consolidations", "/consolidations", nativeRows["C1-consolidation"]],
    ["asset-events", "/assets/" + id("C1-ltl-asset") + "/events", nativeRows["C1-event"]],
  ] as const;
  for (const [kind, suffix, written] of ownPaths) {
    let control: any;
    for (const actor of ["c1-admin", "c1-operator", "c1-dispatcher"]) {
      const read = await call(actor + "-" + kind + "-exact-row-positive", actor, carrierPath + suffix, 200, undefined,
        v => Array.isArray(v.data) && v.data.some((r: any) => r.id === written.data.id && r.carrierId === id("C1"))
          && v.data.every((r: any) => r.carrierId === id("C1")));
      if (!control) control = read;
    }
    for (const actor of ["c2-admin", "c2-operator", "shipper"])
      pair(await call(actor + "-" + kind + "-foreign-read-negative", actor, carrierPath + suffix, 403, undefined,
        v => v.error?.code === "FORBIDDEN_CARRIER_IDENTITY"), control);
  }
  // DISPATCHER's restriction is on commands, not own-carrier history reads.
  pair(await call("dispatcher-offer-role-negative", "c1-dispatcher", carrierPath + "/opportunities/" + id("opportunity") + "/offers",
    403, offerBody(), v => v.error?.code === "FORBIDDEN_CARRIER_ROLE"), { row: results.find(r => r.label === "fresh-offer") });
  pair(await call("dispatcher-booking-confirm-role-negative", "c1-dispatcher", carrierPath + "/bookings/" + bookings[0].id + "/confirmations",
    403, { ...audit(), carrierReference: "HAC44_ROLE_NEGATIVE", confirmation: "CONFIRMED" },
    v => v.error?.code === "FORBIDDEN_CARRIER_ROLE"), { row: results.find(r => r.label === "carrier-confirm-booking") });
  pair(await call("dispatcher-hold-confirm-role-negative", "c1-dispatcher", carrierPath + "/capacity/holds/" + hold.data.id + "/confirmations",
    403, audit(), v => v.error?.code === "FORBIDDEN_CARRIER_ROLE"), { row: results.find(r => r.label === "carrier-confirm-capacity") });
  // Capacity control is measured before any own commitment changes its source.
  // The new overweight request retains the otherwise compatible GENERAL cargo.
  const request = refs.request;
  const payload = { schemaVersion: "2.0", origin: refs.opportunity.data.origin, destination: refs.opportunity.data.destination,
    pickupWindow: { startsAt: refs.window.startsAt, endsAt: new Date(Date.now() + 14400000).toISOString() },
    deliveryWindow: { startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 28800000).toISOString() },
    acceptedModes: ["ROAD"], requiredEquipment: null, cargoSpecification: { ...refs.opportunity.data.cargoSpecification,
      totalWeightKg: 11000, units: refs.opportunity.data.cargoSpecification.units.map((u: any) => ({ ...u, weightPerUnitKg: 11000 })) },
    contacts: { pickup: { name: "Synthetic pickup", phoneE164: "+51911111111" }, recipient: { name: "Synthetic recipient", phoneE164: "+51922222222" } },
    budget: { amount: 500, currency: "USD" } };
  const overweight = await call("overweight-request", "shipper", "/freight/requests", 201, payload);
  if (overweight.data?.id) {
    const requestId = overweight.data.id;
    await call("overweight-submit", "shipper", "/freight/requests/" + requestId + "/submissions", 200, { expectedDraftVersion: 1 });
    const route = await call("overweight-route", "shipper", "/freight/requests/" + requestId + "/routes", 201,
      { schemaVersion: "2.0", corridorIds: [id("corridor")], policyId: id("policy") });
    if (route.data?.id) {
      const planBody = { schemaVersion: "2.0", routeId: route.data.id, assignments: [{ legSequence: 1, serviceId: id("C2-service"),
        laneId: id("C2-lane"), calendarId: id("C2-calendar"), assetId: id("C2-asset"), capacityPoolId: null,
        combinationId: null, role: "LOAD_BEARING", window: refs.window, allocations: [{ unitIndex: 0, quantity: 1 }] }] };
      const control = await call("capacity-sufficient-positive", "shipper", "/plans/" + id("C2-plan"), 200, undefined,
        v => v.data?.status === "eligible");
      const capacity = await call("capacity-insufficient-negative", "shipper", "/freight/requests/" + requestId + "/plans", 201, planBody,
        v => v.data?.status === "ineligible" && JSON.stringify(v.data).includes("CAPACITY"));
      Object.assign(capacity.row, { expectedDomain: "ineligible with capacity reason", positiveControl: control.row.label,
        pairVerdict: control.row.pass ? capacity.row.pass ? "PASS" : "FAIL" : "BLOQUEADO" });
    }
  }
  const { carrierResources, resourcePath } = await import(pathToFileURL(root + "/cargomesh/src/features/carrier-portal/resources.ts").href);
  const { parseRecords } = await import(pathToFileURL(root + "/cargomesh/src/features/carrier-portal/records.ts").href);
  const { canCreateCarrierRecord, canReviseCarrierRecord, canCarrierAction } = await import(pathToFileURL(root + "/cargomesh/src/features/carrier-portal/permissions.ts").href);
  const coverage = [];
  for (const resource of carrierResources) {
    const parent = resource.parent === "service" ? id("C1-service") : resource.parent === "execution" ? executions[0].id
      : resource.parent === "asset" ? id("C1-ltl-asset") : incident.data.id;
    const path = resourcePath(id("C1"), resource, parent).replace(/^\/api\/v2/, "");
    let control: any;
    for (const [actor, role] of [["c1-admin", "ADMIN"], ["c1-operator", "OPERATOR"], ["c1-dispatcher", "DISPATCHER"]] as const) {
      const probe = await call(actor === "c1-admin" ? "screen-" + resource.key : actor + "-screen-" + resource.key,
        actor, path + "?limit=25&offset=0", 200, undefined, v => {
          try { return nonempty(v) && parseRecords(resource, v.data, id("C1")).length === v.data.length; } catch { return false; }
        });
      if (!control) control = probe;
      const record = probe.data?.[0];
      if (record?.id) await call(actor + "-detail-" + resource.key, actor, path + "/" + record.id, 200, undefined,
        v => { try { return v.data?.id === record.id && parseRecords(resource, [v.data], id("C1")).length === 1; } catch { return false; } });
      const expectedCreate = !!resource.schema && (resource.family === "catalog" || ["limits", "metrics"].includes(resource.key)
        ? role === "ADMIN" : ["incidents", "consolidations", "asset-events"].includes(resource.key));
      const expectedRevise = role === "ADMIN" && !!resource.schema && (resource.family === "catalog" || ["limits", "metrics"].includes(resource.key));
      permissionChecks.push({ role, resource: resource.key, expectedCreate, observedCreate: canCreateCarrierRecord(role, resource),
        expectedRevise, observedRevise: canReviseCarrierRecord(role, resource),
        pass: expectedCreate === canCreateCarrierRecord(role, resource) && expectedRevise === canReviseCarrierRecord(role, resource) });
      pair(await call(actor + "-other-carrier-screen-negative-" + resource.key, actor,
        path.replace(id("C1"), id("C2")), 403, undefined, v => v.error?.code === "FORBIDDEN_CARRIER_IDENTITY"), probe);
      coverage.push({ key: resource.key, actor, role, section: resource.section, family: resource.family, path,
        observed: probe.row.observed, rows: Array.isArray(probe.data) ? probe.data.length : null,
        classification: probe.row.pass ? "FUNCTIONAL_DATA_OBSERVED" : "HAC45_RETEST_FAILURE" });
    }
    for (const actor of ["c2-admin", "c2-operator", "shipper"])
      pair(await call(actor + "-foreign-screen-negative-" + resource.key, actor, path, 403, undefined,
        v => v.error?.code === "FORBIDDEN_CARRIER_IDENTITY"), control);
  }
  for (const kind of ["nodes", "conditions"]) {
    for (const actor of ["c1-admin", "c1-operator", "c1-dispatcher"]) {
      const control = await call(actor + "-map-" + kind, actor, portalPath + "/routing/" + kind + "?limit=100&offset=0", 200,
        undefined, nonempty);
      pair(await call(actor + "-other-map-negative-" + kind, actor,
        "/carrier-portal/carriers/" + id("C2") + "/routing/" + kind, 403), control);
      pair(await call(actor + "-shipper-map-negative-" + kind, "shipper", portalPath + "/routing/" + kind, 403), control);
    }
  }
  // UI action permission expectations are explicit contract roles/states; never
  // derive the expected value from the function under test.
  for (const [action, status, allowedRoles] of [
    ["bookings.confirm", "AUTHORIZED", ["ADMIN", "OPERATOR"]], ["holds.confirm", "HELD", ["ADMIN", "OPERATOR"]],
    ["offers.create", "SENT", ["ADMIN", "OPERATOR"]], ["executions.start", "PLANNED", ["ADMIN", "OPERATOR", "DISPATCHER"]],
    ["incidents.update", "OPEN", ["ADMIN", "OPERATOR", "DISPATCHER"]], ["consolidations.close", "OPEN", ["ADMIN", "OPERATOR", "DISPATCHER"]],
    ["executions.start", "COMPLETED", []], ["bookings.confirm", "COMPLETED", []],
  ] as const) for (const role of ["ADMIN", "OPERATOR", "DISPATCHER"] as const) {
    const expected = (allowedRoles as readonly string[]).includes(role);
    permissionChecks.push({ role, action, status, expected, observed: canCarrierAction(role, action, status),
      pass: expected === canCarrierAction(role, action, status) });
  }
  save("carrier-portal-endpoints.json", coverage);
} catch (error) {
  blocked = true;
  save("carrier-http-blocker.json", { message: error instanceof Error ? error.message : "Unknown fixture dependency" });
  console.log("BLOQUEADO downstream prerequisite; see carrier-http-blocker.json");
} finally {
  save("carrier-http-cases.json", results);
  save("carrier-portal-permissions.json", permissionChecks);
  save("carrier-http-summary.json", { total: results.length, passed: results.filter(r => r.pass).length, blocked,
    permissionChecks: permissionChecks.length, permissionFailures: permissionChecks.filter(r => !r.pass).length,
    failed: results.filter(r => !r.pass).length, paired: results.filter(r => r.pairVerdict).map(r => ({ label: r.label, verdict: r.pairVerdict })) });
  await new Promise<void>(resolve => server.close(() => resolve()));
  if (blocked || results.some(r => !r.pass) || results.some(r => r.pairVerdict === "BLOQUEADO") || permissionChecks.some(r => !r.pass)) process.exitCode = 1;
}
}
main().catch(() => { console.error("BLOQUEADO HTTP harness initialization; no credential diagnostics"); process.exitCode = 1; });
