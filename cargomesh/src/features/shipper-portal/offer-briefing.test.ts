import assert from "node:assert/strict";
import test from "node:test";
import type { WorkflowRecordV2 } from "./shipper-model";
import { buildOfferBriefing } from "./offer-briefing";

type Offer = Extract<WorkflowRecordV2, { kind: "offers" }>;
type Ranking = Extract<WorkflowRecordV2, { kind: "ranking" }>;
const now = Date.parse("2026-10-18T12:00:00Z");
const offer = (id: string, status = "RECEIVED") => ({ id, kind: "offers", data: {
  status, price: { amount: 250, currency: "USD" }, validity: {
    startsAt: "2026-10-17T00:00:00Z", endsAt: "2026-10-20T00:00:00Z",
  },
} }) as Offer;
const ranking = (ids: string[]) => ({ kind: "ranking", data: { options: ids.map((id, index) => ({
  position: index + 1, planId: id, offerIds: [id], costCents: 25000 + index * 5000, score: 1 - index / 10,
})) } }) as Ranking;

test("only a current, complete ranked plan is recommended; no offer or ranking cannot invent one", () => {
  const first = offer("10000000-0000-4000-8000-000000000001");
  const second = offer("10000000-0000-4000-8000-000000000002", "WITHDRAWN");
  const available = buildOfferBriefing([first, second], ranking([second.id, first.id]), now);
  assert.equal(available.currentOfferCount, 1);
  assert.equal(available.recommended?.position, 2);
  assert.match(available.script, /stored scoring policy/);
  assert.doesNotMatch(available.script, /Option 1:/);
  assert.equal(buildOfferBriefing([first], null, now).recommended, null);
  assert.equal(buildOfferBriefing([second], ranking([second.id]), now).recommended, null);
});
