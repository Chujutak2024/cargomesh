import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import type { FreightRequestV2Data } from "../v2-intake/contracts";
import { dashboardRequests } from "./client-dashboard-model";
import { filterDashboardActivity } from "./dashboard-activity-model";
import { translate } from "../i18n/config";

function request(id: string, status: FreightRequestV2Data["status"], updatedAt = "2026-10-22T12:00:00Z") {
  return { id, referenceCode: `V2-${id}`, status, updatedAt, origin: { city: "Lima", label: "Warehouse A" }, destination: { city: "Arequipa", label: "Warehouse B" }, cargoSpecification: { totalWeightKg: 1000, totalVolumeM3: 2, description: "Machine parts" } } as FreightRequestV2Data;
}
test("dashboard projects persisted IDs/statuses and cargo without changing source records", () => {
  const records = [request("older", "PENDING", "2026-10-21T12:00:00Z"), request("newer", "DRAFT")];
  const before = JSON.stringify(records);
  for (const locale of ["en", "es"] as const) {
    const result = dashboardRequests(records, locale);
    assert.equal(result.recent[0].id, "newer");
    assert.equal(result.recent[0].fullReference, "V2-newer");
    assert.equal(result.recent[0].status, "DRAFT");
    assert.equal(result.recent[0].route, "Lima → Arequipa");
    assert.match(result.recent[0].cargo, /1 t.*2 m³/);
    assert.equal(result.recent[0].statusLabel, locale === "es" ? "Borrador" : "Draft");
    assert.equal(result.draft?.id, "newer");
    assert.ok(!("contacts" in result.recent[0]));
    assert.ok(!("price" in result.recent[0]));
  }
  assert.equal(JSON.stringify(records), before);
});
test("recent activity is bounded and the last loaded draft can be outside the recent six", () => {
  const records = Array.from({ length: 8 }, (_, index) => request(String(index), index === 7 ? "DRAFT" : "BOOKED", `2026-10-${String(22-index).padStart(2,"0")}T12:00:00Z`));
  const result = dashboardRequests(records, "en");
  assert.equal(result.recent.length, 6);
  assert.equal(result.draft?.id, "7");
  assert.deepEqual(dashboardRequests([], "es"), { recent: [], draft: null });
  assert.equal(dashboardRequests([request("cancelled", "CANCELLED")], "en").draft, null);
});
test("activity controls filter real request states, never infer monthly plans or bookings", () => {
  const items = dashboardRequests(["DRAFT", "PENDING", "BOOKED", "CANCELLED", "FAILED", "AWAITING_SELECTION"].map((state,index) => request(String(index), state as FreightRequestV2Data["status"])), "en").recent;
  assert.equal(filterDashboardActivity(items, "ALL").length, 6);
  assert.deepEqual(filterDashboardActivity(items, "DRAFT").map(row => row.status), ["DRAFT"]);
  assert.deepEqual(filterDashboardActivity(items, "PENDING").map(row => row.status), ["PENDING", "AWAITING_SELECTION"]);
  assert.equal(items.length, 6);
});
test("connected and isolated demo dashboards share presentation but keep separate data readers", () => {
  const connected = readFileSync(new URL("../../app/(cargomesh)/dashboard/page.tsx", import.meta.url), "utf8");
  const demo = readFileSync(new URL("../../app/demo/shipper/dashboard/page.tsx", import.meta.url), "utf8");
  for (const source of [connected, demo]) assert.match(source, /<ClientDashboard/);
  assert.match(connected, /operationsReader\(\)/);
  assert.match(connected, /operationsCount\(requests\)/);
  assert.match(connected, /operationsReadIssues/);
  assert.match(connected, /unavailable=\{!!requests.error\}/);
  assert.match(demo, /listWorkspaceRequests\(\)/);
  const activity = readFileSync(new URL("./dashboard-activity.tsx", import.meta.url), "utf8");
  assert.match(activity, /OperationRequestLink/);
  assert.match(activity, /aria-pressed/);
  assert.match(activity, /unavailable \?/);
  assert.ok(!activity.includes("fetch("));
});
test("mockup layout is container-responsive, not the fixed 1440 by 1000 artboard", () => {
  const css = readFileSync(new URL("./client-dashboard.module.css", import.meta.url), "utf8");
  assert.match(css, /container: client-dashboard \/ inline-size/);
  assert.match(css, /@container client-dashboard \(max-width: 940px\)/);
  assert.match(css, /@container dashboard-activity \(max-width: 430px\)/);
  assert.match(css, /overflow-wrap: anywhere/);
  assert.ok(!css.includes("text-overflow: ellipsis"));
  assert.ok(!css.includes("height: 1000px"));
  const view = readFileSync(new URL("./client-dashboard.tsx", import.meta.url), "utf8");
  assert.ok(!view.includes("Monthly plan"));
  assert.ok(!view.includes("Reorder this shipment"));
  assert.match(view, /draft &&/);
});

test("Client sidebar keeps My shipments and Tracking; bookings/history remain internal tabs", () => {
  const shell = readFileSync(new URL("../../components/app-shell.tsx", import.meta.url), "utf8");
  const navigation = shell.slice(shell.indexOf("const navigation ="), shell.indexOf("const contexts ="));
  const links = [...navigation.matchAll(/href: "([^"]+)"/g)].map(match => match[1]);
  assert.ok(links.includes("/requests"));
  assert.ok(links.includes("/tracking"));
  assert.ok(!links.includes("/bookings"));
  assert.ok(!links.includes("/history"));
  assert.ok(shell.includes('hrefPath === "/requests" && ["/bookings", "/history"].includes(pathname)'));
  const tabs = readFileSync(new URL("./operations-navigation.tsx", import.meta.url), "utf8");
  for (const view of ["requests", "bookings", "history"]) assert.ok(tabs.includes(`view: "${view}" as const`));
});
test("dashboard AI input still dispatches the shared assistant event, trims/bounds text and never saves a request", () => {
  const source = readFileSync(new URL("../v2-intake/conversation-entry.tsx", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  type Node = { type: string; props: Record<string, unknown> };
  const jsx = (type: string, props: Record<string,unknown>) => ({ type, props });
  const exports: { ConversationEntry?: () => Node } = {};
  const events: { type: string; detail: { text: string } }[] = [];
  let state = "  Need to ship " + "x".repeat(1100) + "  ";
  vm.runInNewContext(code, { exports, CustomEvent: class { constructor(public type: string, public init: { detail: object }) {} get detail() { return this.init.detail; } },
    window: { dispatchEvent: (event: typeof events[number]) => events.push(event) },
    require: (name: string) => {
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name === "react") return { useState: () => [state, (value: string) => { state = value; }] };
      if (name === "lucide-react") return new Proxy({}, { get: () => "icon" });
      if (name.endsWith("locale-provider")) return { useLocale: () => ({ t: (es: string, en: string) => translate("en", es, en) }) };
      if (name.endsWith("workspace-link")) return { WorkspaceLink: "Link" };
      if (name.endsWith(".css")) return { __esModule: true, default: new Proxy({}, { get: (_,key) => key }) };
      throw Error(name);
    } });
  const all = (node: unknown): Node[] => Array.isArray(node) ? node.flatMap(all) : node && typeof node === "object" && "props" in node ? [node as Node, ...all((node as Node).props.children)] : [];
  const form = all(exports.ConversationEntry!()).find(node => node.type === "form")!;
  let prevented = false;
  (form.props.onSubmit as (event: object) => void)({ preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(events[0].type, "cargomesh:assistant-message");
  assert.equal(events[0].detail.text.length, 1000);
  assert.ok(events[0].detail.text.startsWith("Need to ship"));
  assert.equal(state, "");
  assert.ok(!source.includes("fetch("));
});
