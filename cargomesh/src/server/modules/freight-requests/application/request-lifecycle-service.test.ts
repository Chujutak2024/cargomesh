import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CreateFreightRequestV2InputSchema } from "@/shared/schemas/v2/freight-request";
import { RequestLifecycleServiceV2, type RequestLifecycleRepositoryV2 } from "./request-lifecycle-service";
import type { PersistedV2Draft } from "./draft-service";
const actor = { memberId: "c2320000-0000-4000-8000-000000000001", organizationId: "c2300000-0000-4000-8000-000000000001" };
const id = "d0420000-0000-4000-8000-000000000001";
const input = CreateFreightRequestV2InputSchema.parse(JSON.parse(readFileSync(
  "../docs/v2-amazon/delivery/fixtures/hac27/create-request.json", "utf8")));
describe("Request lifecycle command boundary", () => {
  it("rejects forged tenants, unknown actions, invalid versions and malformed keys before persistence", async () => {
    let writes = 0;
    const repo: RequestLifecycleRepositoryV2 = { list: async () => [], command: async () => { writes++; throw new Error("unexpected"); } };
    const service = new RequestLifecycleServiceV2(repo);
    await assert.rejects(service.revise(actor, id, { expectedDraftVersion: 1,
      value: { ...input, organizationId: "c2300000-0000-4000-8000-000000000002" } }, id), { code: "FORBIDDEN_TENANT" });
    await assert.rejects(service.submit(actor, id, { expectedDraftVersion: 0 }, id));
    await assert.rejects(service.submit(actor, id, { expectedDraftVersion: 1, status: "BOOKED" }, id));
    await assert.rejects(service.revise(actor, id, { expectedDraftVersion: 1, value: input }, "invalid"));
    assert.equal(writes, 0);
  });
  it("list pagination is bounded and validates the repository tenant", async () => {
    const service = new RequestLifecycleServiceV2({ list: async () => [], command: async () => { throw new Error("unexpected"); } });
    assert.deepEqual((await service.list(actor, {})).data, []);
    await assert.rejects(service.list(actor, { limit: 1000 }));
    const foreign = { data: { organizationId: "foreign" } } as PersistedV2Draft;
    const leaking = new RequestLifecycleServiceV2({ list: async () => [foreign], command: async () => { throw new Error("unexpected"); } });
    await assert.rejects(leaking.list(actor, {}), { code: "FORBIDDEN_TENANT" });
  });
});
