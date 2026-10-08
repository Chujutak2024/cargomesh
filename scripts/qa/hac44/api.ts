import { readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createHmac, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
const root = process.env.HAC44_ROOT!,
  out = process.env.HAC44_OUT!;
const output = (file: string, x: any) => {
  file = (process.env.HAC44_LOG_PREFIX ?? "") + file;
  const s = JSON.stringify(
    x,
    (_k, v) => (v instanceof RegExp ? { source: v.source, flags: v.flags } : v),
    2,
  );
  writeFileSync(out + "/logs/" + file, s);
  assert.equal(readFileSync(out + "/logs/" + file, "utf8"), s);
};
const load = async (path: string) =>
  await import(pathToFileURL(root + "/cargomesh/src/" + path).href);
function schemaTree(schema: any, depth = 0): any {
  if (depth > 14) return { type: "DepthLimit" };
  if (!schema?._def) return null;
  const optional = schema.isOptional(),
    nullable = schema.isNullable();
  while (
    ["ZodEffects", "ZodOptional", "ZodNullable", "ZodDefault", "ZodBranded"].includes(
      schema._def.typeName,
    )
  )
    schema = schema._def.schema ?? schema._def.innerType ?? schema._def.type;
  const d = schema._def,
    n: any = { type: d.typeName, optional, nullable };
  if (d.typeName === "ZodObject")
    n.fields = Object.fromEntries(
      Object.entries(schema.shape).map(([k, v]) => [k, schemaTree(v, depth + 1)]),
    );
  if (d.typeName === "ZodArray") n.element = schemaTree(d.type, depth + 1);
  if (["ZodUnion", "ZodDiscriminatedUnion"].includes(d.typeName))
    n.options = [...d.options].map((v) => schemaTree(v, depth + 1));
  if (d.typeName === "ZodTuple") n.items = d.items.map((v: any) => schemaTree(v, depth + 1));
  if (d.typeName === "ZodEnum") n.values = d.values;
  if (d.typeName === "ZodLiteral") n.value = d.value;
  if (d.checks) n.checks = d.checks;
  if (d.minLength) n.minLength = d.minLength;
  if (d.maxLength) n.maxLength = d.maxLength;
  if (d.unknownKeys) n.unknownKeys = d.unknownKeys;
  return n;
}
async function main() {
  const { createHonoApp } = await load("server/hono/app.ts");
  const app = createHonoApp();
  const routes = [
    ...new Map(
      app.routes
        .filter((r: any) => ["GET", "POST"].includes(r.method) && !r.path.endsWith("/health"))
        .map((r: any) => [r.method + " " + r.path, { method: r.method, path: r.path }]),
    ).values(),
  ] as any[];
  output("routes-runtime.json", routes);
  const trees: any = {};
  const modules: any = {};
  for (const file of JSON.parse(process.env.HAC44_SCHEMA_FILES!)) {
    const m = await load("shared/schemas/v2/" + file);
    modules[file] = m;
    for (const [name, val] of Object.entries(m)) {
      if ((val as any)?._def) trees[file + ":" + name] = schemaTree(val);
      else if (val && typeof val === "object")
        for (const [kind, schema] of Object.entries(val))
          if ((schema as any)?._def) trees[file + ":" + name + ":" + kind] = schemaTree(schema);
    }
  }
  output("schema-trees.json", trees);
  if (process.argv.includes("--inventory")) {
    console.log("PASS routes=" + routes.length + " schemas=" + Object.keys(trees).length);
    return;
  }
  const refs = JSON.parse(readFileSync(out + "/dataset/refs.json", "utf8"));
  const fixture = JSON.parse(readFileSync(out + "/dataset/api-fixtures.json", "utf8"));
  const ORG = "d4400000-0000-4000-8000-000000000001",
    MEMBER = "d4420000-0000-4000-8000-000000000001",
    CARRIER = "d4440000-0000-4000-8000-000000000001",
    SERVICE = "d4460000-0000-4000-8000-000000000001";
  const token = (n: number) => {
    const enc = (x: any) => Buffer.from(JSON.stringify(x)).toString("base64url");
    const s =
      enc({ alg: "HS256", typ: "JWT" }) +
      "." +
      enc({
        sub: "d4410000-0000-4000-8000-00000000000" + n,
        role: "authenticated",
        aud: "authenticated",
        email: "qa-hac44-" + (n === 1 ? "a" : n === 2 ? "b" : "revoked") + "@cargomesh.test",
        iat: Math.floor(Date.now() / 1000) - 10,
        exp: Math.floor(Date.now() / 1000) + 3600,
      });
    return (
      s + "." + createHmac("sha256", process.env.HAC44_JWT_SECRET!).update(s).digest("base64url")
    );
  };
  const TOKENS = [null, token(1), token(2), token(3)];
  const server = createServer(async (req, res) => {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      const r = await app.fetch(
        new Request("http://127.0.0.1:62040" + req.url, {
          method: req.method,
          headers: req.headers as any,
          ...(body.length ? { body, duplex: "half" } : {}),
        } as any),
      );
      res.writeHead(r.status, Object.fromEntries(r.headers));
      res.end(Buffer.from(await r.arrayBuffer()));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: "QA_TRANSPORT_ERROR" }));
    }
  });
  await new Promise<void>((resolve) => server.listen(62040, "127.0.0.1", resolve));
  const results: any[] = [];
  const roundtrips: any[] = [];
  async function call(
    label: string,
    path: string,
    body?: any,
    key = randomUUID(),
    actor = 1,
    expected?: number | number[],
  ) {
    const method = body === undefined ? "GET" : "POST";
    const response = await fetch("http://127.0.0.1:62040/api/v2" + path, {
      method,
      headers: {
        ...(TOKENS[actor] ? { Authorization: "Bearer " + TOKENS[actor] } : {}),
        ...(body !== undefined
          ? { "Content-Type": "application/json", "Idempotency-Key": key }
          : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const raw = await response.text();
    let value: any;
    try {
      value = JSON.parse(raw);
    } catch {
      value = { raw };
    }
    const status =
      expected === undefined
        ? "OBSERVED"
        : [expected].flat().includes(response.status)
          ? "PASS"
          : "FAIL";
    const row = {
      label,
      method,
      path,
      actor,
      expected,
      status,
      http: response.status,
      request: body ?? null,
      response: value,
    };
    results.push(row);
    output("api-results.json", results);
    return row;
  }
  const clone = (v: any) => JSON.parse(JSON.stringify(v));
  const records: any = {};
  const catalogPaths: any = {};
  const pathFor = (kind: string) =>
    kind === "preferences"
      ? "/organizations/current/preferences"
      : ["cargo-categories", "cargo-profiles", "carriers"].includes(kind)
        ? "/" + kind
        : ["areas", "lanes"].includes(kind)
          ? `/carriers/${CARRIER}/services/${SERVICE}/${kind}`
          : `/carriers/${CARRIER}/${kind}`;
  const evidence = refs.limits.data.source;
  const audit = (version = 1) => ({
    schemaVersion: "2.0",
    expectedVersion: version,
    note: "HAC44 synthetic audit",
    evidence,
  });
  try {
    if (process.argv.includes("--pending")) {
      const { pending } = await import("./http_pending.ts");
      await pending({
        call,
        refs,
        fixture,
        records,
        roundtrips,
        modules,
        output,
        CARRIER,
        SERVICE,
        clone,
        evidence,
      });
      return;
    }
    if (process.argv.includes("--replay-read")) {
      await call("replay-active-A", "/organizations/current", undefined, undefined, 1, 200);
      await call("replay-active-B", "/facilities", undefined, undefined, 2, 200);
      await call("replay-revoked", "/organizations/current", undefined, undefined, 3, 403);
      await call("replay-anonymous", "/organizations/current", undefined, undefined, 0, 401);
      assert(results.every((r) => r.status === "PASS"));
      console.log("PASS replay identities 4/4");
      return;
    }
    if (process.argv.includes("--contract-read")) {
      const previous = JSON.parse(readFileSync(out + "/logs/contract-api-results.json", "utf8"));
      for (const label of ["required-road-positive", "required-road-null-bodytype"]) {
        const r = previous.find((x: any) => x.label === label);
        assert.equal(r.http, 201);
        const rd = await call(
          label + "-get",
          r.path + "/" + r.response.data.id,
          undefined,
          undefined,
          1,
          200,
        );
        assert.deepEqual(rd.response.data, r.response.data);
      }
      console.log("PASS persisted required-field counterexample POST→GET 2/2");
      return;
    }
    if (process.argv.includes("--contract")) {
      const { contract } = await import("./http_contract.ts");
      await contract({
        call,
        refs,
        fixture,
        records,
        roundtrips,
        modules,
        output,
        CARRIER,
        SERVICE,
        clone,
        evidence,
      });
      console.log(
        JSON.stringify({
          calls: results.length,
          pass: results.filter((x) => x.status === "PASS").length,
          fail: results.filter((x) => x.status === "FAIL").length,
        }),
      );
      return;
    }
    if (process.argv.includes("--auth-verify")) {
      const lr = JSON.parse(readFileSync(out + "/dataset/ltl-refs.json", "utf8"));
      const bp = `/carriers/${CARRIER}/consolidations/${lr.batch.id}`;
      await call("ltl-auth-positive", bp, undefined, undefined, 1, 200);
      await call("ltl-auth-foreign", bp, undefined, undefined, 2, 403);
      await call("ltl-auth-anonymous", bp, undefined, undefined, 0, 401);
      await call("ltl-auth-revoked", bp, undefined, undefined, 3, 403);
      const previous = JSON.parse(readFileSync(out + "/logs/api-results.json", "utf8")).filter(
        (r: any) => r.label === "inventory-probe",
      );
      const controls: any[] = [];
      for (const p of previous) {
        const active = await call(
          "active-auth-control",
          p.path,
          p.method === "POST" ? {} : undefined,
          undefined,
          1,
        );
        const revoked = await call(
          "revoked-auth-negative",
          p.path,
          p.method === "POST" ? {} : undefined,
          undefined,
          3,
          403,
        );
        const good = ![401, 403, 500].includes(active.http);
        controls.push({
          method: p.method,
          template: p.template,
          active: active.http,
          revoked: revoked.http,
          status: good && revoked.http === 403 ? "PASS" : "BLOQUEADO",
          limit:
            "Authentication boundary only; invalid payload/unknown ID is not business certification",
        });
      }
      output("controls.json", controls);
      console.log(
        JSON.stringify({
          routes: controls.length,
          statuses: controls.reduce(
            (a: any, x: any) => ((a[x.status] = (a[x.status] ?? 0) + 1), a),
            {},
          ),
        }),
      );
      return;
    }
    if (process.argv.includes("--ltl")) {
      const { ltl } = await import("./http_ltl.ts");
      await ltl({
        call,
        refs: JSON.parse(readFileSync(out + "/dataset/ltl-refs.json", "utf8")),
        fixture,
        records,
        roundtrips,
        output,
        CARRIER,
        clone,
      });
      console.log(
        JSON.stringify({
          calls: results.length,
          pass: results.filter((x) => x.status === "PASS").length,
          fail: results.filter((x) => x.status === "FAIL").length,
        }),
      );
      return;
    }
    if (process.argv.includes("--extended")) {
      const { extend } = await import("./http_extended.ts");
      await extend({
        call,
        refs,
        fixture,
        records,
        roundtrips,
        modules,
        output,
        CARRIER,
        SERVICE,
        clone,
        audit,
        evidence,
      });
      console.log(
        JSON.stringify({
          calls: results.length,
          pass: results.filter((x) => x.status === "PASS").length,
          fail: results.filter((x) => x.status === "FAIL").length,
        }),
      );
      return;
    }
    await call("auth-positive", "/organizations/current", undefined, undefined, 1, 200);
    await call("auth-negative-anonymous", "/organizations/current", undefined, undefined, 0, 401);
    await call("auth-negative-revoked", "/organizations/current", undefined, undefined, 3, 403);
    await call(
      "tenant-positive",
      "/freight/requests/" + refs.request.id,
      undefined,
      undefined,
      1,
      200,
    );
    await call(
      "tenant-negative",
      "/freight/requests/" + refs.request.id,
      undefined,
      undefined,
      2,
      404,
    );
    const current = await call(
      "organization-read",
      "/organizations/current",
      undefined,
      undefined,
      1,
      200,
    );
    if (current.http === 200) {
      const v = current.response.data;
      await call(
        "organization-revision",
        "/organizations/current/revisions",
        { expectedVersion: v.version, value: v.value },
        undefined,
        1,
        200,
      );
    }
    for (const kind of [
      "preferences",
      "cargo-categories",
      "cargo-profiles",
      "carriers",
      "depots",
      "services",
      "partners",
      "areas",
      "lanes",
      "assets",
      "capacity-pools",
      "capability-definitions",
      "asset-capabilities",
      "calendars",
      "maintenances",
      "repositioning-blocks",
      "drivers",
      "vehicle-combinations",
      "driver-assignments",
      "vehicle-assignments",
    ]) {
      let value = clone(fixture[kind]);
      if (!value) {
        results.push({
          label: kind + "-fixture",
          status: "BLOCKED",
          reason: "No source fixture",
          method: "POST",
          path: pathFor(kind),
        });
        continue;
      }
      value.schemaVersion = "2.0";
      if (value.code) value.code = "HAC44_API2_" + kind.toUpperCase().replaceAll("-", "_");
      if (value.roadVehicle?.plate) value.roadVehicle.plate = "HAC44-API2";
      const substitutions: any = {
        CATEGORY: records["cargo-categories"]?.id ?? "c0000000-0000-0000-0000-000000000001",
        PICKUP: records.areas?.id ?? "d4470000-0000-4000-8000-000000000001",
        DELIVERY: records.delivery?.id ?? "d4470000-0000-4000-8000-000000000002",
        ASSET: records.assets?.id ?? refs.asset.id,
        CALENDAR: records.calendars?.id ?? refs.calendar.id,
        DEFINITION: records["capability-definitions"]?.id ?? refs.definition.id,
        DRIVER: records.drivers?.id,
        EXECUTION: refs.execution.id,
        RESERVATION: refs.hold?.id ?? null,
      };
      const replace = (x: any, k = ""): any =>
        typeof x === "string"
          ? k === "role"
            ? x
            : (substitutions[x] ?? x)
          : Array.isArray(x)
            ? x.map((y) => replace(y, k))
            : x && typeof x === "object"
              ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, replace(v, k)]))
              : x;
      value = replace(value);
      if (kind === "drivers") {
        value.availableWindows = [refs.execution.data.plannedWindow];
        value.dutyWindow = refs.execution.data.plannedWindow;
        value.maximumDutySeconds = 86400;
      }
      if (kind.endsWith("-assignments")) {
        value.window = refs.execution.data.plannedWindow;
        value.status = "PROPOSED";
        value.assetId = kind === "vehicle-assignments" ? refs.asset.id : value.assetId;
        value.reservationId = kind === "vehicle-assignments" ? null : value.reservationId;
        if (kind === "driver-assignments") {
          delete value.assetId;
          delete value.reservationId;
        }
      }
      if (kind === "vehicle-assignments") value.reservationId = null;
      const path = pathFor(kind),
        key = randomUUID();
      catalogPaths[kind] = path;
      const created = await call(kind + "-create", path, value, key, 1, 201);
      if (created.http !== 201) continue;
      records[kind] = created.response.data;
      const id = created.response.data.id;
      await call(kind + "-replay", path, value, key, 1, 200);
      const read = await call(kind + "-read", path + "/" + id, undefined, undefined, 1, 200);
      await call(kind + "-list", path + "?limit=100", undefined, undefined, 1, 200);
      const equal = JSON.stringify(created.response.data) === JSON.stringify(read.response.data);
      roundtrips.push({
        kind,
        path,
        id,
        status: equal ? "PASS" : "FAIL",
        input: value,
        written: created.response.data,
        read: read.response.data,
      });
      const revised = await call(
        kind + "-revision",
        path + "/" + id + "/revisions",
        { expectedVersion: 1, value },
        undefined,
        1,
        200,
      );
      await call(
        kind + "-stale",
        path + "/" + id + "/revisions",
        { expectedVersion: 1, value },
        undefined,
        1,
        409,
      );
      if (kind === "areas") {
        const d = {
          ...clone(value),
          role: "DELIVERY",
          geography: { ...value.geography, city: "Arequipa" },
        };
        const r = await call("delivery-create", path, d, undefined, 1, 201);
        if (r.http === 201) records.delivery = r.response.data;
      }
    }
    const reqValue = clone(fixture.requestBody);
    const k = randomUUID();
    const created = await call("request-create", "/freight/requests", reqValue, k, 1, 201);
    if (created.http === 201) {
      records.request = created.response.data;
      const id = records.request.id;
      const read = await call(
        "request-read",
        "/freight/requests/" + id,
        undefined,
        undefined,
        1,
        200,
      );
      roundtrips.push({
        kind: "request",
        id,
        status:
          JSON.stringify(created.response.data) === JSON.stringify(read.response.data)
            ? "PASS"
            : "FAIL",
        input: reqValue,
        written: created.response.data,
        read: read.response.data,
      });
      await call("request-replay", "/freight/requests", reqValue, k, 1, 200);
      await call(
        "request-hash-conflict",
        "/freight/requests",
        { ...reqValue, budget: { amount: 999, currency: "USD" } },
        k,
        1,
        409,
      );
      await call(
        "request-revise",
        "/freight/requests/" + id + "/revisions",
        { expectedDraftVersion: 1, value: reqValue },
        undefined,
        1,
        200,
      );
      await call(
        "request-stale",
        "/freight/requests/" + id + "/revisions",
        { expectedDraftVersion: 1, value: reqValue },
        undefined,
        1,
        409,
      );
      await call(
        "serviceability",
        "/freight/requests/" + id + "/serviceability",
        undefined,
        undefined,
        1,
        200,
      );
      await call(
        "request-submit",
        "/freight/requests/" + id + "/submissions",
        { expectedDraftVersion: 2 },
        undefined,
        1,
        200,
      );
      await call(
        "request-double-submit",
        "/freight/requests/" + id + "/submissions",
        { expectedDraftVersion: 3 },
        undefined,
        1,
        [409, 400],
      );
    }
    const nodes = await call(
      "node-create",
      "/routing/nodes",
      { ...clone(refs.origin.data), name: "HAC44 API node" },
      undefined,
      1,
      201,
    );
    if (nodes.http === 201) {
      records.node = nodes.response.data;
      const rd = await call(
        "node-read",
        "/routing/nodes/" + records.node.id,
        undefined,
        undefined,
        1,
        200,
      );
      roundtrips.push({
        kind: "nodes",
        id: records.node.id,
        status:
          JSON.stringify(nodes.response.data) === JSON.stringify(rd.response.data)
            ? "PASS"
            : "FAIL",
        input: nodes.request,
        written: nodes.response.data,
        read: rd.response.data,
      });
      const value = clone(nodes.response.data.data);
      await call(
        "node-revision",
        "/routing/nodes/" + records.node.id + "/revisions",
        { expectedVersion: 1, value },
        undefined,
        1,
        200,
      );
      await call(
        "node-stale",
        "/routing/nodes/" + records.node.id + "/revisions",
        { expectedVersion: 1, value },
        undefined,
        1,
        409,
      );
    }
    const paths: any = {
      origin: "/routing/nodes",
      destination: "/routing/nodes",
      corridor: "/routing/corridors",
      policy: "/routing/policies",
      limits: `/carriers/${CARRIER}/route-limits`,
      scorepolicy: "/scoring/policies",
      route: `/freight/requests/${refs.request.id}/routes`,
      plan: `/freight/requests/${refs.request.id}/plans`,
      opportunity: `/carriers/${CARRIER}/opportunities`,
      offer: `/carriers/${CARRIER}/offers`,
      ranking: `/freight/requests/${refs.request.id}/ranking`,
      decision: `/freight/requests/${refs.request.id}/decisions`,
      booking: "/bookings",
      execution: "/executions",
    };
    for (const [name, path] of Object.entries(paths)) {
      await call(
        "workflow-" + name + "-read",
        path + "/" + refs[name].id,
        undefined,
        undefined,
        1,
        200,
      );
      await call("workflow-" + name + "-list", path as string, undefined, undefined, 1, 200);
    }
    await call("booking-foreign", "/bookings/" + refs.booking.id, undefined, undefined, 2, 404);
    const hold = await call(
      "hold-create",
      "/capacity/holds",
      {
        schemaVersion: "2.0",
        bookingId: refs.booking.id,
        assignmentId: refs.assignment.id,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        consolidationId: null,
        evidence,
      },
      undefined,
      1,
      201,
    );
    if (hold.http === 201) {
      refs.hold = hold.response.data;
      records.hold = refs.hold;
      await call("hold-read", "/capacity/holds/" + refs.hold.id, undefined, undefined, 1, 200);
      await call(
        "booking-invalid-transition",
        `/carriers/${CARRIER}/bookings/${refs.booking.id}/confirmations`,
        { ...audit(), carrierReference: "HAC44", confirmation: "CONFIRMED" },
        undefined,
        1,
        409,
      );
      await call(
        "hold-confirm",
        `/carriers/${CARRIER}/capacity/holds/${refs.hold.id}/confirmations`,
        audit(),
        undefined,
        1,
        200,
      );
      await call(
        "booking-confirm",
        `/carriers/${CARRIER}/bookings/${refs.booking.id}/confirmations`,
        { ...audit(), carrierReference: "HAC44", confirmation: "CONFIRMED" },
        undefined,
        1,
        200,
      );
      await call(
        "hold-invalid-release",
        `/capacity/holds/${refs.hold.id}/releases`,
        audit(2),
        undefined,
        1,
        409,
      );
      await call(
        "booking-cancel",
        `/bookings/${refs.booking.id}/cancellations`,
        audit(2),
        undefined,
        1,
        200,
      );
      const released = await call(
        "hold-release-observed",
        `/capacity/holds/${refs.hold.id}`,
        undefined,
        undefined,
        1,
        200,
      );
      assert.equal(released.response.data?.status, "RELEASED");
    }
    // Each documented route is reached through the real router. Invalid payload probes are never positive functional certification.
    const catalogIds: any = Object.fromEntries(
      Object.entries(records).map(([k, v]: any) => [k, v.id]),
    );
    function params(route: string) {
      let kind = route
        .split("/")
        .filter((x: string) => !x.startsWith(":") && !["api", "v2", "revisions"].includes(x))
        .at(-1)!;
      let id = catalogIds[kind];
      const wm: any = {
        nodes: refs.origin.id,
        corridors: refs.corridor.id,
        policies: route.includes("scoring") ? refs.scorepolicy.id : refs.policy.id,
        "route-limits": refs.limits.id,
        routes: refs.route.id,
        plans: refs.plan.id,
        opportunities: refs.opportunity.id,
        offers: refs.offer.id,
        ranking: refs.ranking.id,
        decisions: refs.decision.id,
        bookings: refs.booking.id,
        execution: refs.execution.id,
        executions: refs.execution.id,
        holds: refs.hold?.id,
        reservations: refs.hold?.id,
        requests: records.request?.id ?? refs.request.id,
      };
      id = id ?? wm[kind] ?? "d4444444-4444-4444-8444-444444444444";
      return route
        .replace(":carrierId", CARRIER)
        .replace(":serviceId", SERVICE)
        .replace(":requestId", refs.request.id)
        .replace(
          ":parentId",
          route.includes("assets/")
            ? refs.asset.id
            : route.includes("bookings/")
              ? refs.booking.id
              : refs.execution.id,
        )
        .replace(":id", id);
    }
    for (const route of routes) {
      const path = params(route.path).replace("/api/v2", "");
      const observed = await call(
        "inventory-probe",
        path,
        route.method === "POST" ? {} : undefined,
        undefined,
        1,
      );
      observed.template = route.path;
      const anon = await call(
        "inventory-auth-control",
        path,
        route.method === "POST" ? {} : undefined,
        undefined,
        0,
        401,
      );
      anon.template = route.path;
    }
    output("api-results.json", results);
    output("roundtrips.json", roundtrips);
    output("api-created-records.json", records);
    output("api-refs-final.json", refs);
    console.log(
      JSON.stringify({
        calls: results.length,
        pass: results.filter((x) => x.status === "PASS").length,
        fail: results.filter((x) => x.status === "FAIL").length,
        observed: results.filter((x) => x.status === "OBSERVED").length,
        routes: routes.length,
        roundtrips: roundtrips.length,
      }),
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    output("api-results.json", results);
    output("roundtrips.json", roundtrips);
    output("api-created-records.json", records);
  }
}
main().catch((e) => {
  console.error(String(e));
  process.exitCode = 1;
});
