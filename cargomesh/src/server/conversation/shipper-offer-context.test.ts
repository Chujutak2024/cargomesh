import assert from "node:assert/strict";
import test from "node:test";
import { collectShipperOfferContext, type OfferContextReads } from "./shipper-offer-context";
import { commercialFixture, id, at } from "@/features/shipper-portal/commercial-context.test-fixtures";
import { buildOfferBriefing } from "@/features/shipper-portal/offer-briefing";

function reads(fixture = commercialFixture()): OfferContextReads {
  return { request: async () => fixture.request,
    workflow: async (kind, _id, page) => ({ data: kind === "ranking" ? fixture.ranking ? [fixture.ranking] : [] : fixture[kind], meta: { ...page, nextOffset: null } }) };
}
test("voice receives the same canonical request, plan, opportunity, quote and backend rank as the Client", async () => {
  const source = commercialFixture(), context = await collectShipperOfferContext(source.request.id, source.request.organizationId, reads(source));
  assert.deepEqual(context, source);
  const briefing = buildOfferBriefing(context.offers, context.ranking, Date.parse(at), context);
  assert.equal(briefing.recommended?.position, 1); assert.match(briefing.script, /Request status AWAITING_SELECTION, revision 1/);
  assert.match(briefing.script, /offer version 1/); assert.match(briefing.script, /does not select a plan or authorize a booking/);
});
test("request authorization is checked before reading commercial collections", async () => {
  const source = commercialFixture(); let queried = false;
  await assert.rejects(collectShipperOfferContext(source.request.id, id(90), { request: async () => source.request,
    workflow: async () => { queried = true; throw new Error("must not query"); } }), /FORBIDDEN_OFFER_SCOPE/);
  assert.equal(queried, false);
});
for (const kind of ["plans", "opportunities", "offers", "ranking"] as const) test(`voice refuses foreign ${kind} instead of accepting browser/label correlation`, async () => {
  const source = commercialFixture();
  if (kind === "ranking") source.ranking!.organizationId = id(90); else source[kind][0].organizationId = id(90);
  await assert.rejects(collectShipperOfferContext(source.request.id, source.request.organizationId, reads(source)), /FORBIDDEN_OFFER_SCOPE/);
});
test("missing plan or opportunity never turns an offer-only voice context into a recommendation", async () => {
  const source = commercialFixture(); source.plans = [];
  const context = await collectShipperOfferContext(source.request.id, source.request.organizationId, reads(source));
  assert.equal(buildOfferBriefing(context.offers, context.ranking, Date.parse(at), context).recommended, null);
});
test("empty native collections are honest while failed/partial/malformed reads are not signed as complete", async () => {
  const source = commercialFixture(), empty = reads({ ...source, plans: [], opportunities: [], offers: [], ranking: null });
  assert.deepEqual((await collectShipperOfferContext(source.request.id, source.request.organizationId, empty)).offers, []);
  for (const mode of ["unavailable", "partial", "malformed"] as const) {
    const normal = reads(source);
    await assert.rejects(collectShipperOfferContext(source.request.id, source.request.organizationId, { ...normal, workflow: async (kind, requestId, page) => {
      if (mode === "unavailable") throw new Error("database unavailable");
      if (mode === "malformed") return { data: [], meta: undefined };
      const original = kind === "ranking" ? source.ranking! : source[kind][0];
      return { data: Array.from({ length: 100 }, (_, n) => ({ ...original, id: id(1000 + page.offset + n) })), meta: { ...page, nextOffset: page.offset + 100 } };
    } }));
  }
});
test("native authorization failure and expired quotes cannot be promoted by the server voice reader", async () => {
  const source = commercialFixture(), normal = reads(source), denied = Object.assign(new Error("Unauthorized"), { httpStatus: 401 });
  await assert.rejects(collectShipperOfferContext(source.request.id, source.request.organizationId, { ...normal, workflow: async () => { throw denied; } }), caught => caught === denied);
  const context = await collectShipperOfferContext(source.request.id, source.request.organizationId, normal);
  assert.equal(buildOfferBriefing(context.offers, context.ranking, Date.parse("2026-10-23T00:00:00Z"), context).recommended, null);
});

test('voice plan facts count distinct carrying trucks and retain only quoted dates and provenance',async()=>{
 const {quoteVoicePlanFacts,quoteVoiceScript}=await import('@/server/modules/commercial/domain/quote-history');
 const context=commercialFixture(),plan=context.plans[0],leg=plan.data.legAssignments[0],binding=leg.resources[0];
 leg.resources.push({...binding,bindingId:id(301),resourceId:id(302),resource:{...binding.resource,assetId:id(303)}});
 context.offers[0].data.estimatedPickupAt='2026-10-17T10:00:00Z';context.offers[0].data.estimatedDeliveryAt='2026-10-17T15:00:00Z';
 const now=Date.parse('2026-10-17T11:00:00Z'),briefing=buildOfferBriefing(context.offers,context.ranking,now,context);
 const facts=quoteVoicePlanFacts(briefing.options,context);assert.equal(facts[0].truckCount,2);assert.equal(facts[0].pickupAt,new Date(context.offers[0].data.estimatedPickupAt!).toISOString());assert.equal(facts[0].deliveryAt,new Date(context.offers[0].data.estimatedDeliveryAt!).toISOString());
 const script=quoteVoiceScript({count:1,options:facts,recommended:1,status:'PENDING',weight:1000,volume:2,origin:'Lima',destination:'Arequipa'},'No recorded history.');assert.match(script,/2 carrying truck/);assert.match(script,/Quoted delivery/);assert.match(script,/No booking or departure is confirmed/);assert.ok(!script.includes('CARRIER_MARKUP'));context.offers[0].data.estimatedDeliveryAt=null;assert.equal(quoteVoicePlanFacts(briefing.options,context)[0].deliveryAt,null);
});
