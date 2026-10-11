import { existsSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";
export async function pending(c: any) {
  const { call, modules, output, CARRIER, clone } = c,
    out = process.env.HAC44_OUT!;
  const load = (path: string) => existsSync(out + path)
    ? JSON.parse(readFileSync(out + path, "utf8")) : {};
  const r = load("/dataset/pending-refs.json");
  const e = load("/logs/extended-extended-records.json");
  const cp = "/carriers/" + CARRIER,
    audit = (v = 1) => ({
      schemaVersion: "2.0",
      expectedVersion: v,
      note: "HAC44 pending transition",
      evidence: r.limits.data.source,
    });
  const cases: any[] = [];
  async function dependent(
    templates: string[], dependencies: Record<string, any>, action: () => Promise<void>, method = "GET",
  ) {
    const missing = Object.keys(dependencies).filter((key) => !dependencies[key]);
    if (!missing.length) return action();
    for (const template of templates) cases.push({
      method, template: "/api/v2" + template, status: "BLOQUEADO",
      dependency: missing.join(", "), reason: "Missing prerequisite: " + missing.join(", "),
      validPositive: false, controls: [],
    });
    output("cases.json", cases);
  }
  const pairTemplates = (template: string) => [template, template + "/:id"];
  async function fixture(label: string, path: string, body?: any, expected = 201) {
    const row = await call(label, path, body, undefined, 1, expected);
    return row.http === expected ? row.response.data : undefined;
  }
  await call("pending-B-own-control", "/facilities", undefined, undefined, 2, 200);
  async function test(template: string, path: string, body?: any, shared = false) {
    const method = body === undefined ? "GET" : "POST",
      rows: any[] = [];
    for (const [actor, http] of [
      [0, 401],
      [3, 403],
    ]) {
      const x = await call("pending-anonymous-or-revoked", path, body, undefined, actor, http);
      x.template = template;
      rows.push(x);
    }
    const foreignStatus = shared
      ? body === undefined
        ? 200
        : 403
      : path.startsWith("/carriers/")
        ? 403
        : 404;
    const foreign = await call("pending-foreign", path, body, undefined, 2, foreignStatus);
    foreign.template = template;
    rows.push(foreign);
    if (body !== undefined) {
      const x = await call(
        "pending-invalid-version",
        path,
        { ...clone(body), expectedVersion: 999999 },
        undefined,
        1,
        409,
      );
      x.template = template;
      rows.push(x);
    }
    const positive = await call("pending-functional-positive", path, body, undefined, 1, 200);
    positive.template = template;
    let valid = positive.http === 200;
    if (valid && method === "GET") {
      const data = positive.response.data;
      valid =
        template === "/api/v2/intake/options"
          ? !!data
          : Array.isArray(data)
            ? data.length > 0
            : !!data?.id;
    }
    if (valid && method === "GET" && !shared && foreign.http === 200)
      valid =
        Array.isArray(foreign.response.data) &&
        !foreign.response.data.some((x: any) =>
          Array.isArray(positive.response.data)
            ? positive.response.data.some((a: any) => a.id === x.id)
            : positive.response.data.id === x.id,
        );
    if (valid && body !== undefined) {
      const x = await call("pending-stale-after-positive", path, body, undefined, 1, 409);
      x.template = template;
      rows.push(x);
    }
    cases.push({
      method,
      template,
      path,
      status:
        valid && rows.every((x) => x.status === "PASS") ? "PASS" : !valid ? "BLOQUEADO" : "FAIL",
      positiveHttp: positive.http,
      validPositive: valid,
      ...(!valid ? { dependency: "functional positive: " + template,
        reason: "Functional positive failed or returned no records (HTTP " + positive.http + ")" } : {}),
      controls: rows.map((x) => ({
        actor: x.actor,
        label: x.label,
        http: x.http,
        status: x.status,
      })),
      sharedCatalog: shared,
    });
    output("cases.json", cases);
    return positive;
  }
  const get = (template: string, path: string, shared = false) =>
    test("/api/v2" + template, path, undefined, shared);
  async function pair(template: string, path: string, id: string) {
    await get(template, path);
    await get(template + "/:id", path + "/" + id);
  }
  function clean(v: any, s: any): any {
    while (
      s?._def &&
      ["ZodEffects", "ZodOptional", "ZodNullable", "ZodDefault"].includes(s._def.typeName)
    )
      s = s._def.schema ?? s._def.innerType;
    if (v === null) return null;
    if (s?._def.typeName === "ZodObject")
      return Object.fromEntries(
        Object.entries(s.shape)
          .filter(([k]) => k in v)
          .map(([k, t]) => [k, clean(v[k], t)]),
      );
    if (s?._def.typeName === "ZodArray") return v.map((x: any) => clean(x, s._def.type));
    return v;
  }
  let hold: any;
  await dependent([], { "pending.booking.id": r.booking?.id, "pending.assignment.id": r.assignment?.id,
    "pending.limits.data.source": r.limits?.data?.source }, async () => {
    hold = await fixture("pending-hold-create", "/capacity/holds", {
      schemaVersion: "2.0", bookingId: r.booking.id, assignmentId: r.assignment.id,
      expiresAt: new Date(Date.now() + 3600000).toISOString(), consolidationId: null,
      evidence: r.limits.data.source,
    });
  });
  for (const [template, dependencies, path, id] of [
    ["/bookings/:parentId/execution", { "pending.booking.id": r.booking?.id, "pending.execution.id": r.execution?.id },
      () => "/bookings/" + r.booking.id + "/execution", () => r.execution.id],
    ["/bookings/:parentId/reservations", { "pending.booking.id": r.booking?.id, "pending hold positive": hold?.id },
      () => "/bookings/" + r.booking.id + "/reservations", () => hold.id],
    ["/carriers/:carrierId/bookings", { "pending.booking.id": r.booking?.id }, () => cp + "/bookings", () => r.booking.id],
    ["/carriers/:carrierId/capacity/holds", { "pending hold positive": hold?.id }, () => cp + "/capacity/holds", () => hold.id],
    ["/carriers/:carrierId/executions", { "pending.execution.id": r.execution?.id }, () => cp + "/executions", () => r.execution.id],
  ] as any[]) await dependent(pairTemplates(template), dependencies, async () => { await pair(template, path(), id()); });

  const second = r.second;
  let driver: any;
  await dependent([], { "pending.second.execution.data.plannedWindow": second?.execution?.data?.plannedWindow,
    "fixture.drivers": c.fixture.drivers }, async () => {
    const win = second.execution.data.plannedWindow;
    driver = await fixture("pending-driver-control", cp + "/drivers", {
      ...clone(c.fixture.drivers), fullName: "HAC44 pending driver", availableWindows: [win],
      dutyWindow: win, maximumDutySeconds: 86400,
    });
  });
  for (const kind of ["driver-assignments", "vehicle-assignments"]) {
    await dependent([], { "pending.second.execution.id": second?.execution?.id,
      "pending.second.execution.data.plannedWindow": second?.execution?.data?.plannedWindow,
      [kind === "driver-assignments" ? "pending driver positive" : "pending.second.asset.id"]:
        kind === "driver-assignments" ? driver?.id : second?.asset?.id,
      ["fixture." + kind]: c.fixture[kind] }, async () => {
      e[kind] = await fixture("pending-crew-control", cp + "/" + kind, {
        ...clone(c.fixture[kind]), executionId: second.execution.id,
        window: second.execution.data.plannedWindow, status: "PROPOSED",
        ...(kind === "driver-assignments" ? { driverId: driver.id }
          : { assetId: second.asset.id, combinationId: null, reservationId: null }),
      });
    });
  }
  let event: any;
  await dependent([], { "pending.asset.id": r.asset?.id, "pending.limits.data.source": r.limits?.data?.source }, async () => {
    event = await fixture("pending-asset-event-create", cp + "/assets/" + r.asset.id + "/events",
      { ...audit(), next: "MAINTENANCE", reason: "HAC44 synthetic event fixture" });
  });
  await dependent(pairTemplates("/carriers/:carrierId/assets/:parentId/events"),
    { "pending.asset.id": r.asset?.id, "pending asset event positive": event?.id }, async () => {
      await pair("/carriers/:carrierId/assets/:parentId/events", cp + "/assets/" + r.asset.id + "/events", event.id);
    });
  let events: any;
  await dependent([], { "extended.executions.id": e.executions?.id }, async () => {
    events = await fixture("pending-events-fixture", "/executions/" + e.executions.id + "/events", undefined, 200);
  });
  for (const [template, path] of [
    ["/executions/:parentId/events", () => "/executions/" + e.executions.id + "/events"],
    ["/carriers/:carrierId/executions/:parentId/events", () => cp + "/executions/" + e.executions.id + "/events"],
  ] as const) await dependent(pairTemplates(template),
    { "extended.executions.id": e.executions?.id, "extended execution event positive": events?.[0]?.id }, async () => {
      await pair(template, path(), events[0].id);
    });
  await dependent(pairTemplates("/executions/:parentId/incidents"),
    { "extended.executions.id": e.executions?.id, "extended.incidents.id": e.incidents?.id }, async () => {
      await pair("/executions/:parentId/incidents", "/executions/" + e.executions.id + "/incidents", e.incidents.id);
    });
  let updates: any;
  await dependent([], { "extended.incidents.id": e.incidents?.id }, async () => {
    updates = await fixture("pending-updates-fixture", "/incidents/" + e.incidents.id + "/updates", undefined, 200);
  });
  await dependent(pairTemplates("/incidents/:parentId/updates"),
    { "extended.incidents.id": e.incidents?.id, "extended incident update positive": updates?.[0]?.id }, async () => {
      await pair("/incidents/:parentId/updates", "/incidents/" + e.incidents.id + "/updates", updates[0].id);
    });
  await dependent(["/carriers/:carrierId/incidents/:parentId/updates/:id"],
    { "extended.incidents.id": e.incidents?.id, "extended incident update positive": updates?.[0]?.id }, async () => {
      await get("/carriers/:carrierId/incidents/:parentId/updates/:id", cp + "/incidents/" + e.incidents.id + "/updates/" + updates[0].id);
    });
  await dependent(pairTemplates("/freight/requests/:requestId/offers"),
    { "pending.request.id": r.request?.id, "pending.offer.id": r.offer?.id }, async () => {
      await pair("/freight/requests/:requestId/offers", "/freight/requests/" + r.request.id + "/offers", r.offer.id);
    });
  for (const [kind, record] of [["routes", r.route], ["plans", r.plan], ["offers", r.offer], ["decisions", r.decision]] as const)
    await dependent(["/" + kind + "/:id"], { ["pending." + kind + ".id"]: record?.id }, async () => {
      await get("/" + kind + "/:id", "/" + kind + "/" + record.id);
    });
  await test("/api/v2/intake/options", "/intake/options", undefined, true);
  for (const [kind, path, shared] of [
    ["conditions", "/routing/conditions", true], ["corridors", "/routing/corridors", true],
    ["route-policies", "/routing/policies", true], ["scoring-policies", "/scoring/policies", true],
    ["limits", cp + "/route-limits", false], ["metrics", cp + "/metrics", false],
  ] as any[]) {
    const template = path.replace(CARRIER, ":carrierId") + "/:id/revisions";
    let record: any;
    await dependent([], { ["extended." + kind + ".id"]: e[kind]?.id }, async () => {
      record = await fixture("pending-current-version-control", path + "/" + e[kind].id, undefined, 200);
    });
    await dependent([template], { ["extended." + kind + ".id"]: e[kind]?.id,
      [kind + " current version positive"]: record?.id }, async () => {
      await test("/api/v2" + template, path + "/" + record.id + "/revisions", {
        expectedVersion: record.version, value: clean(record.data, modules["workflow.ts"].WorkflowInputsV2[kind + ".publish"]),
      }, shared);
    }, "POST");
  }
  for (const kind of ["driver-assignments", "vehicle-assignments"]) {
    const record = e[kind];
    await dependent(["/carriers/:carrierId/" + kind + "/:id/revisions"],
      { ["pending " + kind + " positive"]: record?.id }, async () => {
        await test("/api/v2/carriers/:carrierId/" + kind + "/:id/revisions", cp + "/" + kind + "/" + record.id + "/revisions", {
          expectedVersion: record.version, value: clean(record.value, modules["catalog.ts"].CatalogInputsV2[kind]),
        });
      }, "POST");
  }
  await dependent(["/capacity/holds/:id/releases"],
    { "pending hold positive": hold?.id, "pending.limits.data.source": r.limits?.data?.source }, async () => {
      await test("/api/v2/capacity/holds/:id/releases", "/capacity/holds/" + hold.id + "/releases", audit());
    }, "POST");
  let hold2: any;
  await dependent([], { "pending.second.booking.id": second?.booking?.id,
    "pending.second.assignment.id": second?.assignment?.id, "pending.limits.data.source": r.limits?.data?.source }, async () => {
    hold2 = await fixture("pending-second-hold-control", "/capacity/holds", {
      schemaVersion: "2.0", bookingId: second.booking.id, assignmentId: second.assignment.id,
      expiresAt: new Date(Date.now() + 3600000).toISOString(), consolidationId: null, evidence: r.limits.data.source,
    });
  });
  await dependent(["/carriers/:carrierId/capacity/holds/:id/releases"],
    { "pending second hold positive": hold2?.id, "pending.limits.data.source": r.limits?.data?.source }, async () => {
      await test("/api/v2/carriers/:carrierId/capacity/holds/:id/releases", cp + "/capacity/holds/" + hold2.id + "/releases", audit());
    }, "POST");
  await dependent(["/carriers/:carrierId/executions/:id/cancellations"],
    { "pending.execution.id": r.execution?.id, "pending.limits.data.source": r.limits?.data?.source }, async () => {
      await test("/api/v2/carriers/:carrierId/executions/:id/cancellations", cp + "/executions/" + r.execution.id + "/cancellations", audit());
    }, "POST");
  let currentBooking: any;
  await dependent([], { "pending.second.booking.id": second?.booking?.id }, async () => {
    currentBooking = await fixture("pending-booking-version-control", cp + "/bookings/" + second.booking.id, undefined, 200);
  });
  await dependent(["/carriers/:carrierId/bookings/:id/cancellations"],
    { "pending.second.booking.id": second?.booking?.id, "pending booking version positive": currentBooking?.id,
      "pending.limits.data.source": r.limits?.data?.source }, async () => {
      await test("/api/v2/carriers/:carrierId/bookings/:id/cancellations", cp + "/bookings/" + second.booking.id + "/cancellations", audit(currentBooking.version));
    }, "POST");
  await dependent(["/freight/requests/:requestId/decisions/:id/revocations"],
    { "pending.request.id": r.request?.id, "pending.decision.id": r.decision?.id,
      "pending.limits.data.source": r.limits?.data?.source }, async () => {
      await test("/api/v2/freight/requests/:requestId/decisions/:id/revocations", "/freight/requests/" + r.request.id + "/decisions/" + r.decision.id + "/revocations", audit());
    }, "POST");
  await dependent(["/carriers/:carrierId/offers/:id/withdrawals"],
    { "pending.offer.id": r.offer?.id, "pending.limits.data.source": r.limits?.data?.source }, async () => {
      await test("/api/v2/carriers/:carrierId/offers/:id/withdrawals", cp + "/offers/" + r.offer.id + "/withdrawals", audit());
    }, "POST");
  let member: any;
  await dependent([], { "pending.ltl.booking.id": r.ltl?.booking?.id, "pending.ltl.assignment.id": r.ltl?.assignment?.id,
    "pending.ltl.batch.id": r.ltl?.batch?.id, "pending.limits.data.source": r.limits?.data?.source }, async () => {
    member = await fixture("pending-batch-member-control", "/capacity/holds", {
      schemaVersion: "2.0", bookingId: r.ltl.booking.id, assignmentId: r.ltl.assignment.id,
      expiresAt: new Date(Date.now() + 3600000).toISOString(), consolidationId: r.ltl.batch.id, evidence: r.limits.data.source,
    });
  });
  await dependent(["/carriers/:carrierId/consolidations/:id/cancellations"],
    { "pending.ltl.batch.id": r.ltl?.batch?.id, "pending batch member positive": member?.id,
      "pending.limits.data.source": r.limits?.data?.source }, async () => {
      await test("/api/v2/carriers/:carrierId/consolidations/:id/cancellations", cp + "/consolidations/" + r.ltl.batch.id + "/cancellations", audit());
    }, "POST");
  console.log(
    JSON.stringify({
      cases: cases.length,
      pass: cases.filter((x) => x.status === "PASS").length,
      fail: cases.filter((x) => x.status === "FAIL").length,
      blocked: cases.filter((x) => x.status === "BLOQUEADO").length,
    }),
  );
  assert(
    cases.every((x) => x.status === "PASS" || x.status === "BLOQUEADO"),
    "Pending route controls failed; preserve exact evidence",
  );
}
