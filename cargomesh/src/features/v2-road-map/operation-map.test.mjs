import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { operationMapCases, operationFixture } from "./operation-map.test-cases";
import { routeRecordToPresentation } from "../shipper-portal/tracking-model";
import { SchematicMapView } from "./schematic-map-view";
import { OperationRouteFactsView } from "./operation-route-facts";
import { operationRouteFacts } from "./operation-route-model";

for (const [name, run] of operationMapCases) test(name, run);

test.each([
  ["not-authorized", "Not authorized for this site"], ["timed-out", "Timed out"],
  ["not-configured", "Not configured"], ["unavailable", "Provider unavailable"],
])("fallback renders %s safely with operation labels, SIMULATED legs and retry", (failure, label) => {
  const f = operationFixture();
  const html = renderToStaticMarkup(React.createElement(SchematicMapView, {
    presentation: routeRecordToPresentation(f.route), failure, onRetry() {},
  }));
  expect(html).toContain("Schematic view · Google Maps unavailable · not a road map, not GPS");
  expect(html).toContain(label);
  expect(html).toContain("Facility C01_SIM_A");
  expect(html).toContain("Facility C01_SIM_B");
  expect(html).toContain("SIMULATED");
  expect(html).toContain("Retry map");
  expect(html).toContain("<svg");
  expect(html).not.toMatch(/<img|<iframe|<script|<image|Lima|Arequipa|tile|maps.googleapis/);
});

test("endpoints remain visible with an explicit dashed schematic connection, empty scope draws nothing", () => {
  const f = operationFixture();
  f.route.data.legs = [];
  const html = renderToStaticMarkup(React.createElement(SchematicMapView, { presentation: routeRecordToPresentation(f.route), failure: "not-configured" }));
  expect(html).toContain("stroke-dasharray=\"8 7\"");
  expect(html).toContain("Schematic connection — not a verified road route");
  expect(html).toContain("Facility C01_SIM_A");
  const empty = renderToStaticMarkup(React.createElement(SchematicMapView, { presentation: routeRecordToPresentation(null), failure: "not-configured" }));
  expect(empty).not.toContain("<svg");
  expect(empty).not.toContain("<polyline");
});

test("labels are text and the commercial view never calls an operation window paid time", () => {
  const f = operationFixture();
  f.route.data.origin.label = "<img onerror=REDACTION_TEST_CANARY>";
  const html = renderToStaticMarkup(React.createElement(SchematicMapView, { presentation: routeRecordToPresentation(f.route), failure: "not-authorized" }));
  expect(html).toContain("&lt;img");
  expect(html).not.toContain("<img");
  const facts = operationRouteFacts(f.route, f.context.offers[0], f.context.plans[0], f.ex, [f.corridor]);
  const factHtml = renderToStaticMarkup(React.createElement(OperationRouteFactsView, { facts }));
  expect(factHtml).toContain("Displayed geometry");
  expect(factHtml).toContain("Contracted commercial corridor");
  expect(factHtml).toContain("Delivery estimate at quote time");
  expect(factHtml).toContain("not a live ETA");
  expect(factHtml).toContain("6.5 h (390 min)");
  expect(factHtml).toContain("120 min");
  expect(factHtml).toContain("60 min");
  expect(factHtml).toContain("does not establish paid time");
  expect(factHtml).not.toMatch(/987654|driverHourlyCost|margin|markup/);
});

test("loader readiness is a positive control for timeout and authentication failures; retry rechecks auth", async () => {
  vi.useFakeTimers();
  const scripts = [];
  const fakeWindow = { setTimeout, clearTimeout };
  vi.stubGlobal("window", fakeWindow);
  vi.stubGlobal("document", { createElement: () => ({}), head: { appendChild: script => scripts.push(script) } });
  vi.stubGlobal("google", undefined);
  try {
    vi.resetModules();
    let loader = await import("./google-maps-loader");
    const ready = loader.loadGoogleMaps("UNIT_TEST_PLACEHOLDER");
    vi.stubGlobal("google", { maps: { Map() {} } });
    fakeWindow.__cargomeshGoogleMapsReady();
    await expect(ready).resolves.toBeUndefined();

    vi.resetModules();
    vi.stubGlobal("google", undefined);
    loader = await import("./google-maps-loader");
    const timeout = loader.loadGoogleMaps("UNIT_TEST_PLACEHOLDER");
    const timedOut = expect(timeout).rejects.toThrow("MAP_PROVIDER_TIMEOUT");
    await vi.advanceTimersByTimeAsync(12000);
    await timedOut;

    vi.resetModules();
    loader = await import("./google-maps-loader");
    const denied = loader.loadGoogleMaps("UNIT_TEST_PLACEHOLDER");
    const rejected = expect(denied).rejects.toThrow("MAP_PROVIDER_AUTH_FAILED");
    fakeWindow.gm_authFailure();
    await rejected;
    expect(loader.googleMapsAuthFailed()).toBe(true);
    vi.stubGlobal("google", { maps: { Map() {} } });
    const before = scripts.length;
    loader.retryGoogleMaps();
    const retry = loader.loadGoogleMaps("UNIT_TEST_PLACEHOLDER");
    expect(scripts.length).toBe(before + 1);
    fakeWindow.__cargomeshGoogleMapsReady();
    await expect(retry).resolves.toBeUndefined();
  } finally {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});
