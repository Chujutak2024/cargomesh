import assert from "node:assert/strict";
import test from "node:test";
import { IdentityServiceV2, type IdentityRepositoryV2 } from "./identity-service";
import { V2DraftError } from "../../freight-requests/application/draft-service";
const id = "c2340000-0000-4000-8000-000000000001";
const foreign = "c2340000-0000-4000-8000-000000000002";
const key = "c2340000-0000-4000-8000-000000000003";
const record = { kind: "integrations", value: { id, carrierId: id, serviceId: key, channel: "API",
  endpointRef: "env://CARRIER_RESPONSE_URL", verifiedAt: null, status: "PENDING", evidence: null, version: 1 } };
function repository(overrides: Partial<IdentityRepositoryV2> = {}): IdentityRepositoryV2 {
  const unused = async (): Promise<never> => { throw new Error("unexpected repository call"); };
  return { read: unused, link: unused, configure: unused, diagnose: unused, directory: unused, ...overrides };
}
test("integration configuration accepts references and forbids raw secrets or self-verification", async () => {
  let called = 0;
  const service = new IdentityServiceV2(repository({ configure: async () => { called++; return { record, replay: false }; } }));
  const input = { serviceId: key, channel: "API", endpointRef: "env://CARRIER_RESPONSE_URL", enabled: true, expectedVersion: 0 };
  assert.equal((await service.configure(id, input, key)).data.status, "PENDING");
  for (const unsafe of [{ ...input, endpointRef: "https://host.test/?token=secret" }, { ...input, verifiedAt: "2026-10-08T00:00:00Z" },
    { ...input, status: "ACTIVE" }, { ...input, secret: "private-value" }]) await assert.rejects(service.configure(id, unsafe, key));
  assert.equal(called, 1);
});
test("identity directory refuses a well-formed record from another carrier", async () => {
  const service = new IdentityServiceV2(repository({ read: async () => [{ ...record, value: { ...record.value, carrierId: foreign } }] }));
  await assert.rejects(service.read("integrations", { organizationId: null, carrierId: id }, {}),
    e => e instanceof V2DraftError && e.code === "FORBIDDEN_IDENTITY");
});
test("MCP consent cannot carry caller-controlled identity, permissions or provider", async () => {
  const service = new IdentityServiceV2(repository());
  const valid = { oauthClientId: "fixture-client", expectedVersion: 0, consent: true };
  for (const input of [{ ...valid, consent: false }, { ...valid, authUserId: id }, { ...valid, provider: "ALEXA_PLUS" },
    { ...valid, scopes: ["admin"] }]) await assert.rejects(service.link("consent", id, null, input, key));
});
