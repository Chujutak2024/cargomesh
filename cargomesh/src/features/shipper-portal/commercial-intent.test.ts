import assert from "node:assert/strict";
import test from "node:test";
import { CommercialIntents } from "./commercial-intent";
const scope = { organizationId: "org", memberId: "member", requestId: "request" };
test("commercial retries retain both key and evidence time across remounts; actors and choices stay separate", () => {
  const values = new Map<string,string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => {values.set(key,value);} };
  const first = new CommercialIntents().get(scope, "selection", { offer: "v2" }, storage);
  assert.deepEqual(new CommercialIntents().get(scope,"selection",{ offer: "v2" },storage), first);
  assert.notEqual(new CommercialIntents().get({...scope,memberId:"another"},"selection",{offer:"v2"},storage).idempotencyKey, first.idempotencyKey);
  assert.notEqual(new CommercialIntents().get(scope,"selection",{offer:"v3"},storage).idempotencyKey, first.idempotencyKey);
  assert.notEqual(new CommercialIntents().get(scope,"booking",{offer:"v2"},storage).idempotencyKey, first.idempotencyKey);
});
test("corrupt or blocked session storage stops before mutation instead of silently rotating an ambiguous key", () => {
  assert.throws(() => new CommercialIntents().get(scope,"booking",{}, {getItem:()=>"corrupt",setItem:()=>{}}));
  assert.throws(() => new CommercialIntents().get(scope,"booking",{}, {getItem:()=>null,setItem:()=>{throw Error("blocked");}}));
});
