import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { localeTag, translate } from "../i18n/config";
import { bookingStatusPresentation, formatDateTime } from "./shipper-model";

type Node = { type: string; props: { children?: unknown; [key: string]: unknown } };
const jsx = (type: string, props: Node["props"]) => ({ type, props });
const source = readFileSync(new URL("./booking-card.tsx", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const moduleExports: { BookingCard?: (props: object) => Node } = {};
vm.runInNewContext(code, { exports: moduleExports, require: (name: string) => {
  if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
  if (name === "lucide-react") return { CalendarDays: "icon", CircleAlert: "icon", Clock3: "icon", PackageCheck: "icon", ShieldCheck: "icon" };
  if (name.endsWith("i18n/config")) return { localeTag, translate };
  if (name === "./shipper-model") return { bookingStatusPresentation, formatDateTime };
  if (name.endsWith(".css")) return { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) };
  throw new Error(`Unexpected presentation dependency: ${name}`);
} });
const render = moduleExports.BookingCard!;
const flatten = (value: unknown): string => {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(flatten).join(" ");
  return value && typeof value === "object" && "props" in value ? flatten((value as Node).props.children) : "";
};
const booking = { version: 3, data: { carrierConfirmationStatus: "CONFIRMED", authorizedAt: "2026-10-21T12:00:00Z", confirmedAt: null, capacityEvidence: [] } };
const props = { booking, offer: null, reference: "V2-37bbd439cbb741bcb1a3ad57451ff12b", carrier: "A carrier with a very long authorized organization name", locale: "en", children: "linked resources", action: "review request" };

test("booking presentation preserves the full reference, status and supplied action", () => {
  const text = flatten(render(props));
  assert.ok(text.includes(props.reference));
  assert.ok(text.includes(props.carrier));
  assert.ok(text.includes("Carrier confirmed"));
  assert.match(text, /Version\s+3/);
  assert.ok(text.includes("linked resources"));
  assert.ok(text.includes("review request"));
});

test("missing offer/response remain unknown; a supplied linked offer keeps its original validity", () => {
  const unavailable = flatten(render(props));
  assert.ok(unavailable.includes("Detail unavailable"));
  assert.ok(unavailable.includes("Unknown"));
  assert.ok(!unavailable.includes("USD"));
  const offer = { data: { price: { currency: "USD", amount: 350 }, validity: { endsAt: "2026-10-22T00:00:00Z" } } };
  const available = flatten(render({ ...props, offer }));
  assert.ok(available.includes("USD 350.00"));
  assert.ok(available.includes("Original offer validity"));
});

test("pending, rejected and cancelled states retain their real consequences in both languages", () => {
  for (const locale of ["en", "es"] as const) for (const status of ["PENDING", "REJECTED", "CANCELLED"] as const) {
    const presentation = bookingStatusPresentation(status, locale);
    const text = flatten(render({ ...props, locale, booking: { ...booking, data: { ...booking.data, carrierConfirmationStatus: status } } }));
    assert.ok(text.includes(presentation.label));
    assert.ok(text.includes(presentation.consequence));
    assert.ok(!text.includes(bookingStatusPresentation("CONFIRMED", locale).label));
  }
});

test("booking layout has its own container-aware grid and wraps long identifiers/statuses instead of clipping", () => {
  const css = readFileSync(new URL("./booking-card.module.css", import.meta.url), "utf8");
  assert.match(css, /container: client-bookings \/ inline-size/);
  assert.match(css, /@container client-bookings \(min-width: 800px\)/);
  assert.match(css, /@container client-bookings \(min-width: 1440px\)/);
  assert.match(css, /repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /repeat\(3,minmax\(0,1fr\)\)/);
  assert.ok(!css.includes("repeat(4"));
  assert.match(css, /overflow-wrap: anywhere/);
  assert.match(css, /white-space: normal/);
  assert.ok(!css.includes("text-overflow: ellipsis"));
  for (const path of ["../../app/(cargomesh)/bookings/page.tsx", "../../app/demo/shipper/bookings/page.tsx"]) {
    const page = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.ok(page.includes("<BookingCard"));
    assert.ok(!page.includes("styles.facilityGrid"));
  }
});

test("client pages no longer duplicate the floating assistant with header or hero shortcuts", () => {
  for (const path of ["../../components/app-shell.tsx", "../../app/(cargomesh)/dashboard/page.tsx", "../../app/demo/shipper/dashboard/page.tsx", "./request-workspace.tsx", "../v2-intake/v2-intake-prototype.tsx"]) {
    const page = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.ok(!page.includes("assistantButton"));
    assert.ok(!page.includes("freight-request/new?assistant=open"));
    assert.ok(!page.includes('t("Escribir al asistente", "Write to assistant")'));
  }
});
