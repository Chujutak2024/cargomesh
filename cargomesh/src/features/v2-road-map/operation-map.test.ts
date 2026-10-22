import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import { registerHooks } from "node:module";
import { isValidElement, type ReactElement } from "react";
import { operationMapCases, operationFixture } from "./operation-map.test-cases";
import { routeRecordToPresentation } from "../shipper-portal/tracking-model";
import { operationRouteFacts } from "./operation-route-model";
import { formatOperationInstant, type OperationMapTranslate } from "./operation-route-format";
import type { MapFailure } from "./schematic-map-model";
import { googleMapsAuthFailed, loadGoogleMaps, onGoogleMapsAuthFailure, retryGoogleMaps } from "./google-maps-loader";

// Node does not load CSS modules. Keep the actual React components and their element trees.
const css = registerHooks({ load(url, context, nextLoad) {
  return url.endsWith(".module.css") ? { format: "module", source: "export default {};", shortCircuit: true } : nextLoad(url, context);
} });
let SchematicMapView: typeof import("./schematic-map-view").SchematicMapView;
let OperationRouteFactsView: typeof import("./operation-route-facts").OperationRouteFactsView;
before(async () => {
  ({ SchematicMapView } = await import("./schematic-map-view"));
  ({ OperationRouteFactsView } = await import("./operation-route-facts"));
});
after(() => css.deregister());

/** Inspect actual hook-free React output without react-dom/server's react-server restriction. */
function rendered(node: unknown) {
  const elements: ReactElement<Record<string, unknown>>[] = [], text: string[] = [];
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if (typeof value === "string" || typeof value === "number") { text.push(String(value)); return; }
    if (!isValidElement<Record<string, unknown>>(value)) return;
    if (typeof value.type === "function") { walk((value.type as (props: Record<string, unknown>) => unknown)(value.props)); return; }
    elements.push(value); walk(value.props.children);
  };
  walk(node);
  return { elements, text: text.join("") };
}
const en: OperationMapTranslate = (_es, english) => english;
const es: OperationMapTranslate = (spanish) => spanish;

for (const [name, run] of operationMapCases) test(name, run);

const failures: Array<[MapFailure, string]> = [["not-authorized", "Not authorized for this site"], ["timed-out", "Timed out"],
  ["not-configured", "Not configured"], ["unavailable", "Provider unavailable"]];
for (const [failure, label] of failures) test(`fallback renders ${failure} safely with this operation and Retry`, () => {
  const f = operationFixture(), view = rendered(SchematicMapView({ presentation: routeRecordToPresentation(f.route), failure, onRetry() {} }));
  assert.match(view.text, /Schematic view · Google Maps unavailable · not a road map, not GPS/);
  assert.ok(view.text.includes(label));
  assert.match(view.text, /Facility C01_SIM_A/); assert.match(view.text, /Facility C01_SIM_B/);
  assert.match(view.text, /SIMULATED/); assert.match(view.text, /Retry map/);
  assert.ok(view.elements.some(element => element.type === "svg"));
  assert.ok(view.elements.some(element => element.type === "polyline" && element.props["data-provenance"] === "SIMULATED"));
  assert.equal(view.elements.some(element => ["img", "iframe", "script", "image"].includes(String(element.type))), false);
  assert.doesNotMatch(view.text, /Lima|Arequipa|tile|maps.googleapis/);
});

test("endpoints have a labeled dashed connection; an absent route has no geometry", () => {
  const f = operationFixture(); f.route.data.legs = [];
  const view = rendered(SchematicMapView({ presentation: routeRecordToPresentation(f.route), failure: "not-configured" }));
  assert.ok(view.elements.some(element => element.type === "polyline" && element.props.strokeDasharray === "8 7"));
  assert.match(view.text, /Schematic connection — not a verified road route/);
  assert.match(view.text, /Facility C01_SIM_A/);
  const empty = rendered(SchematicMapView({ presentation: routeRecordToPresentation(null), failure: "not-configured" }));
  assert.equal(empty.elements.some(element => ["svg", "polyline"].includes(String(element.type))), false);
});

test("markup labels remain text nodes, never injected HTML", () => {
  const f = operationFixture(), label = "<img onerror=REDACTION_TEST_CANARY>";
  f.route.data.origin.label = label;
  const view = rendered(SchematicMapView({ presentation: routeRecordToPresentation(f.route), failure: "not-authorized" }));
  assert.ok(view.text.includes(label));
  assert.equal(view.elements.some(element => element.type === "img" || element.props.dangerouslySetInnerHTML !== undefined), false);
});

test("route facts translate every section and show explicit PET/UTC instead of raw instants", () => {
  const f = operationFixture(), facts = operationRouteFacts(f.route, f.context.offers[0], f.context.plans[0], f.ex, [f.corridor]);
  const english = rendered(OperationRouteFactsView({ facts, locale: "en", t: en })).text;
  assert.match(english, /Displayed geometry/); assert.match(english, /Contracted commercial corridor/);
  assert.match(english, /Delivery estimate at quote time/); assert.match(english, /not a live ETA/);
  assert.match(english, /6.5 h \(390 min\)/); assert.match(english, /120 min/); assert.match(english, /60 min/);
  assert.match(english, /does not establish paid time/);
  assert.match(english, /2 Nov 2026, 08:00 PET \(13:00 UTC\)/);
  assert.match(english, /3 Nov 2026, 19:00 PET \(4 Nov 2026, 00:00 UTC\)/);
  assert.doesNotMatch(english, /\d{4}-\d{2}-\d{2}T|987654|driverHourlyCost|margin|markup/);
  facts.commercial.corridors[0].drivingSeconds = null;
  facts.commercial.corridors[0].drivingSource = null;
  const spanish = rendered(OperationRouteFactsView({ facts, locale: "es", t: es })).text;
  assert.match(spanish, /Geometría mostrada/); assert.match(spanish, /Corredor comercial contratado/);
  assert.match(spanish, /Estimación de entrega al cotizar/); assert.match(spanish, /no es una ETA en vivo/);
  assert.match(spanish, /Observado:/); assert.match(spanish, /Válido hasta:/); assert.match(spanish, /No disponible/);
  assert.doesNotMatch(spanish, /Displayed geometry|Booked offer|Valid until|Driving time|Quote validity|\d{4}-\d{2}-\d{2}T/);
});

test("the local instant helper handles UTC date rollover and unavailable values", () => {
  assert.equal(formatOperationInstant("2026-11-02T08:00:00-05:00", "en", en), "2 Nov 2026, 08:00 PET (13:00 UTC)");
  assert.equal(formatOperationInstant("2026-11-03T01:00:00Z", "en", en), "2 Nov 2026, 20:00 PET (3 Nov 2026, 01:00 UTC)");
  assert.equal(formatOperationInstant(null, "en", en), "Time unavailable");
  assert.equal(formatOperationInstant("invalid", "es", es), "Fecha no disponible");
});

test("native mock timers cover readiness, timeout, auth and retry replacing the previous script", async context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const names = ["window", "document", "google"] as const;
  const originals = names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const);
  const setGlobal = (name: typeof names[number], value: unknown) => Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  type Script = { src: string; async: boolean; onerror: null | (() => void); removed: boolean; remove: () => void };
  const scripts: Script[] = [], mutations: string[] = [];
  const fakeWindow = {
    setTimeout: (callback: () => void, delay: number) => setTimeout(callback, delay),
    gm_authFailure: undefined as undefined | (() => void), __cargomeshGoogleMapsReady: undefined as undefined | (() => void),
  };
  setGlobal("window", fakeWindow);
  setGlobal("document", {
    querySelectorAll: () => scripts.filter(script => !script.removed),
    createElement: () => {
      const script: Script = { src: "", async: false, onerror: null, removed: false, remove() { this.removed = true; mutations.push("remove"); } };
      return script;
    },
    head: { appendChild: (script: Script) => { scripts.push(script); mutations.push("append"); } },
  });
  setGlobal("google", undefined);
  const unsubscribe = onGoogleMapsAuthFailure(() => { authNotifications++; });
  let authNotifications = 0;
  try {
    const ready = loadGoogleMaps("UNIT_TEST_PLACEHOLDER");
    assert.equal(loadGoogleMaps("UNIT_TEST_PLACEHOLDER"), ready, "Concurrent loads share one script");
    setGlobal("google", { maps: { Map() {} } }); fakeWindow.__cargomeshGoogleMapsReady!();
    await ready;
    assert.equal(scripts.filter(script => !script.removed).length, 1);

    setGlobal("google", undefined); retryGoogleMaps();
    const timeout = assert.rejects(loadGoogleMaps("UNIT_TEST_PLACEHOLDER"), /MAP_PROVIDER_TIMEOUT/);
    context.mock.timers.tick(12000); await timeout;

    const denied = assert.rejects(loadGoogleMaps("UNIT_TEST_PLACEHOLDER"), /MAP_PROVIDER_AUTH_FAILED/);
    fakeWindow.gm_authFailure!(); await denied;
    assert.equal(googleMapsAuthFailed(), true); assert.equal(authNotifications, 1);
    const previous = scripts.at(-1)!;
    setGlobal("google", { maps: { Map() {} } }); retryGoogleMaps();
    const mutationCount = mutations.length, retry = loadGoogleMaps("UNIT_TEST_PLACEHOLDER");
    assert.equal(previous.removed, true);
    assert.deepEqual(mutations.slice(mutationCount), ["remove", "append"]);
    assert.equal(scripts.filter(script => !script.removed).length, 1);
    fakeWindow.__cargomeshGoogleMapsReady!(); await retry;
    assert.equal(googleMapsAuthFailed(), false);

    setGlobal("google", undefined); retryGoogleMaps();
    const unavailable = assert.rejects(loadGoogleMaps("UNIT_TEST_PLACEHOLDER"), /MAP_PROVIDER_UNAVAILABLE/);
    scripts.at(-1)!.onerror!(); await unavailable;
  } finally {
    unsubscribe(); context.mock.timers.reset();
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
});
