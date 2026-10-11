import { randomUUID } from "node:crypto";
import { FreightRequestV2ResponseSchema } from "../../../cargomesh/src/shared/schemas/v2/freight-request.ts";

export function planCardinality(first: any, second: any, replay: any, conflict: any) {
  const a = first.response?.data, b = second.response?.data, r = replay?.response?.data;
  const id = (value: any) => typeof value === "string" && value.length > 0;
  const checks = {
    distinctPlans: id(a?.id) && id(b?.id) && a.id !== b.id,
    distinctRouteSnapshots: id(a?.data?.routeId) && id(b?.data?.routeId) && a.data.routeId !== b.data.routeId,
    samePlanOnReplay: replay?.http === 200 && id(a?.id) && r?.id === a.id,
    sameRouteOnReplay: id(a?.data?.routeId) && r?.data?.routeId === a.data.routeId,
    changedPayloadConflict: conflict?.http === 409,
  };
  return {
    status: first.http !== 201 ? "BLOQUEADO"
      : second.http === 201 && Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
    positive: first.http, negative: second.http,
    firstId: a?.id, secondId: b?.id, firstRouteId: a?.data?.routeId, secondRouteId: b?.data?.routeId,
    replay: replay?.http, conflict: conflict?.http, checks,
    expected: "Distinct plans own distinct route snapshots; identical key/payload replays the same plan; changed payload conflicts",
  };
}

export function arrayReadProjection(schema: any, raw: any, path: string) {
  const get = (value: any) => path.split(".").reduce((v: any, key: string) => v?.[key], value);
  const variant = (value: any, omit = false) => {
    const copy = structuredClone(raw);
    const keys = path.split("."), last = keys.pop()!;
    const parent = keys.reduce((v: any, key: string) => v?.[key], copy);
    if (!parent) return null;
    if (omit) delete parent[last]; else parent[last] = value;
    return copy;
  };
  const current = schema.safeParse(raw), omitted = schema.safeParse(variant(undefined, true));
  const positive = schema.safeParse(variant([])), negative = schema.safeParse(variant(null));
  const passed = current.success && Array.isArray(get(raw)) && positive.success
    && Array.isArray(get(positive.data)) && omitted.success
    && Array.isArray(get(omitted.data)) && get(omitted.data).length === 0 && !negative.success;
  return { status: passed ? "PASS" : "FAIL", path,
    checks: { validResponse: current.success, explicitArray: positive.success,
      omittedNormalizesToArray: omitted.success && Array.isArray(get(omitted.data)), nullRejected: !negative.success },
    outputNode: { type: "ZodArray", optional: false, nullable: false },
    value: get(raw), expected: "Omission normalizes to an array; a valid array passes; null is rejected" };
}

export async function contract({
  call,
  refs,
  fixture,
  records,
  roundtrips,
  output,
  CARRIER,
  SERVICE,
  clone,
}: any) {
  const suffix = Date.now();
  const path = "/carriers/" + CARRIER + "/assets";
  const a = clone(refs.asset.value);
  a.code = "HAC44_REQUIRED_POS_" + suffix;
  a.roadVehicle.plate = "HAC44-POS-" + suffix;
  const positive = await call("required-road-positive", path, a, undefined, 1, 201);
  const negative = await call(
    "required-road-null-bodytype",
    path,
    {
      ...a,
      code: "HAC44_REQUIRED_NULL_" + suffix,
      roadVehicle: { ...a.roadVehicle, plate: "HAC44-NULL-" + suffix, bodyType: null },
    },
    undefined,
    1,
    400,
  );
  output("required-field-result.json", {
    status: positive.http !== 201 ? "BLOQUEADO" : negative.http === 400 ? "PASS" : "FAIL",
    positive: positive.http,
    negative: negative.http,
    expected:
      "UML RoadVehicle.bodyType is required; null must be rejected or explicitly reconciled by approved contract",
    actual: negative.response,
  });
  const q = "/freight/requests/" + refs.request.id + "/plans";
  const p = {
    schemaVersion: "2.0",
    routeId: refs.route.id,
    assignments: [
      {
        legSequence: 1,
        serviceId: SERVICE,
        laneId: "d4480000-0000-4000-8000-000000000001",
        calendarId: refs.calendar.id,
        assetId: refs.asset.id,
        capacityPoolId: null,
        combinationId: null,
        role: "LOAD_BEARING",
        window: refs.execution.data.plannedWindow,
        allocations: [{ unitIndex: 0, quantity: 1 }],
      },
    ],
  };
  const planKey = randomUUID();
  const p1 = await call("route-plan-cardinality-positive", q, p, planKey, 1, 201);
  let p2: any = { http: null }, replay: any, conflict: any;
  if (p1.http === 201) {
    p2 = await call("route-plan-second-valid", q, p, undefined, 1, 201);
    replay = await call("route-plan-identical-replay", q, p, planKey, 1, 200);
    const different = clone(p);
    different.assignments[0].window.endsAt = new Date(
      Date.parse(p.assignments[0].window.endsAt) + 1000,
    ).toISOString();
    conflict = await call("route-plan-changed-payload-conflict", q, different, planKey, 1, 409);
  }
  output("route-cardinality-result.json", { ...planCardinality(p1, p2, replay, conflict), blueprintRouteId: refs.route.id });
  const request = await call("read-normalization-positive", "/freight/requests/" + refs.request.id,
    undefined, undefined, 1, 200);
  output("normalization-result.json", {
    ...(request.http === 200 ? arrayReadProjection(FreightRequestV2ResponseSchema, request.response,
      "data.cargoSpecification.availableDocuments") : { status: "BLOQUEADO", reason: "Authenticated request read did not pass" }),
    schema: "freight-request.ts:FreightRequestV2ResponseSchema", http: request.http,
    id: request.response?.data?.id, positive: request.http,
    negative: "null rejected by the current response schema",
  });
  const cats = await call(
    "category-version-read-control",
    "/cargo-categories",
    undefined,
    undefined,
    1,
    200,
  );
  const category = cats.response.data?.find((r: any) => r.value.code.startsWith("HAC44_API"));
  output("category-version-result.json", {
    status:
      cats.http !== 200 || !category
        ? "BLOQUEADO"
        : typeof category.value?.version === "string"
            && /^[1-9]\d*$/.test(category.value.version)
            && category.value.version === String(category.version)
          ? "PASS"
          : "FAIL",
    positiveCodeType: typeof category?.value?.code,
    actualVersionType: typeof category?.value?.version,
    actualVersion: category?.value?.version,
    envelopeVersion: category?.version,
    expected:
      "CargoCategory value.version is a positive integer string projected from the technical revision",
  });
  const own = "/carriers/d4490000-0000-4000-8000-000000000001/depots";
  const depot = {
    ...clone(fixture.depots),
    schemaVersion: "2.0",
    code: "HAC44_B_CARRIER_DEPOT_" + suffix,
  };
  const b = await call("carrier-B-write-positive", own, depot, undefined, 2, 201);
  if (b.http === 201) {
    const rd = await call(
      "carrier-B-read-positive",
      own + "/" + b.response.data.id,
      undefined,
      undefined,
      2,
      200,
    );
    roundtrips.push({
      kind: "depots",
      id: b.response.data.id,
      input: depot,
      written: b.response.data,
      read: rd.response.data,
      status:
        JSON.stringify(b.response.data) === JSON.stringify(rd.response.data) ? "PASS" : "FAIL",
    });
  }
  const denied = await call(
    "carrier-B-write-foreign",
    "/carriers/" + CARRIER + "/depots",
    { ...depot, code: "HAC44_B_FORGED_A" },
    undefined,
    2,
    403,
  );
  output("carrier-isolation-result.json", {
    status: b.http !== 201 ? "BLOQUEADO" : denied.http === 403 ? "PASS" : "FAIL",
    positive: b.http,
    negative: denied.http,
    scope:
      "Carrier B editor has a valid own write, cannot mutate foreign carrier A; real authenticated HTTP",
  });
}
