import assert from "node:assert/strict";
import test from "node:test";
import { authorizeBooking, selectCommercialOption, ShipperApiError } from "./shipper-api";

test("commercial selection sends explicit evidence and a unique idempotency key", async () => {
  let captured: RequestInit | undefined;
  const fetcher = async (_input: RequestInfo | URL, init?: RequestInit) => {
    captured = init;
    return new Response(JSON.stringify({ schemaVersion: "2.0", error: {
      code: "VALIDATION_ERROR", message: "Fixture stops before persistence.", retryable: false,
    } }), { status: 400, headers: { "Content-Type": "application/json" } });
  };
  await assert.rejects(selectCommercialOption({
    requestId: "10000000-0000-4000-8000-000000000001", planId: "10000000-0000-4000-8000-000000000002",
    offerIds: ["10000000-0000-4000-8000-000000000003"],
    consideredOfferIds: ["10000000-0000-4000-8000-000000000003"], policyId: null, rationale: "Selected by shipper.",
  }, fetcher), (error: unknown) => error instanceof ShipperApiError && error.code === "VALIDATION_ERROR");
  const headers = captured?.headers as Record<string, string>;
  assert.match(headers["Idempotency-Key"], /^[0-9a-f-]{36}$/i);
  assert.equal(JSON.parse(String(captured?.body)).evidence[0].reference, "SHIPPER_WEB_EXPLICIT_SELECTION");
});

test("booking authorization keeps the same idempotency key on retry and parses a persisted pending booking", async () => {
  const id = "10000000-0000-4000-8000-000000000001";
  const at = "2026-10-10T00:00:00Z";
  const evidence = { reference: "SHIPPER_WEB_EXPLICIT_BOOKING_CONSENT", provider: "CargoMesh Web", observedAt: at, validUntil: null, provenanceStatus: "VERIFIED" };
  const booking = { id, organizationId: id, carrierId: id, requestId: id, kind: "bookings", status: "AUTHORIZED", version: 1,
    createdAt: at, updatedAt: at, data: { decisionId: id, offerId: id, carrierReference: null, confirmedAt: null,
      authorizedAt: at, authorizedBy: id, authorizationStatus: "AUTHORIZED", carrierConfirmationStatus: "PENDING",
      capacityEvidence: [], authorizationEvidence: evidence } };
  const keys: string[] = [];
  const bodies: string[] = [];
  const fetcher = async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "GET") return Response.json({ schemaVersion: "2.0", data: booking });
    keys.push((init?.headers as Record<string, string>)["Idempotency-Key"]);
    bodies.push(String(init?.body));
    return new Response(JSON.stringify({ schemaVersion: "2.0", data: booking, meta: { idempotentReplay: keys.length > 1, environmentProfile: "v2-clean" } }), { status: 200 });
  };
  const input = { decisionId: id, offerId: id, intent: { idempotencyKey: "20000000-0000-4000-8000-000000000002", observedAt: at } };
  const saved = await authorizeBooking(input, fetcher);
  assert.equal(saved.kind, "bookings");
  if (saved.kind !== "bookings") throw new Error("Booking response expected.");
  assert.equal(saved.data.carrierConfirmationStatus, "PENDING");
  assert.equal((await authorizeBooking(input, fetcher)).id, id);
  assert.deepEqual(keys, [input.intent.idempotencyKey, input.intent.idempotencyKey]);
  assert.equal(bodies[0], bodies[1], "the canonical payload, including observedAt, must remain byte-identical");
});

test("booking conflict stays visible instead of creating a local confirmation", async () => {
  const fetcher = async () => new Response(JSON.stringify({ error: { code: "DECISION_OFFER_NOT_CURRENT", message: "Offer expired.", retryable: false } }), { status: 409 });
  await assert.rejects(authorizeBooking({ decisionId: "10000000-0000-4000-8000-000000000001", offerId: "10000000-0000-4000-8000-000000000001" }, fetcher), (error: unknown) => error instanceof ShipperApiError && error.status === 409 && error.code === "DECISION_OFFER_NOT_CURRENT");
});

test("wrong booking/decision/offer response cannot become a success", async () => {
  const id="10000000-0000-4000-8000-000000000001", other="10000000-0000-4000-8000-000000000002", at="2026-10-20T00:00:00Z";
  const record={id,kind:"bookings",organizationId:id,requestId:id,carrierId:id,version:1,status:"AUTHORIZED",createdAt:at,updatedAt:at,
    data:{decisionId:other,offerId:id,carrierReference:null,confirmedAt:null,authorizedAt:at,authorizedBy:id,authorizationStatus:"AUTHORIZED",carrierConfirmationStatus:"PENDING",capacityEvidence:[],
      authorizationEvidence:{reference:"test",provider:"test",observedAt:at,validUntil:null,provenanceStatus:"SIMULATED"}}};
  await assert.rejects(authorizeBooking({decisionId:id,offerId:id},async()=>Response.json({schemaVersion:"2.0",data:record,meta:{idempotentReplay:false,environmentProfile:"v2-clean"}})),{code:"INVALID_SCOPE"});
});

test("lost response preserves the exact selection body on retry instead of generating another decision intent", async () => {
  const id="10000000-0000-4000-8000-000000000001", calls:RequestInit[]=[];
  const input={requestId:id,planId:id,offerIds:[id],consideredOfferIds:[id],policyId:null,rationale:"Explicit selection",
    intent:{idempotencyKey:id,observedAt:"2026-10-20T00:00:00.000Z"}};
  const fetcher=async(_path:RequestInfo|URL,init?:RequestInit)=>{calls.push(init!);throw Error("Connection closed");};
  for(let i=0;i<2;i++)await assert.rejects(selectCommercialOption(input,fetcher),{code:"NETWORK_ERROR"});
  assert.equal(calls[0].body,calls[1].body);assert.deepEqual(calls[0].headers,calls[1].headers);
});
