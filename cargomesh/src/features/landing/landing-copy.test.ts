import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { landingCopy } from "./landing-copy";

test("keeps Spanish active while preparing matching English copy", () => {
  assert.equal(landingCopy.es.hero.primaryCta, "Probar la demo");
  assert.equal(landingCopy.en.hero.primaryCta, "Try the demo");
  assert.equal(landingCopy.es.nav.howItWorks, "Cómo funciona");
  assert.equal(landingCopy.en.nav.howItWorks, "How it works");
});

test("keeps the same landing copy structure in both locales", () => {
  assert.deepEqual(Object.keys(landingCopy.es), Object.keys(landingCopy.en));
  assert.equal(landingCopy.es.flow.steps.length, 4);
  assert.equal(landingCopy.en.flow.steps.length, landingCopy.es.flow.steps.length);
  assert.equal(landingCopy.es.shippers.companies.length, 3);
  assert.equal(landingCopy.en.shippers.companies.length, landingCopy.es.shippers.companies.length);
});

test("labels shipper metrics as demo evidence without losing the requested social proof", () => {
  assert.equal(landingCopy.es.shippers.demoLabel, "Indicadores del escenario demostrativo");
  assert.deepEqual(
    landingCopy.es.shippers.companies.map(({ name, highlight, description }) => ({ name, highlight, description })),
    [
      { name: "ACME Mining Perú", highlight: "98% satisfacción", description: "1,400 toneladas movidas" },
      { name: "Agrícola del Valle Sur", highlight: "96% satisfacción", description: "Cadena de frío certificada" },
      { name: "Cemento & Concreto Andino", highlight: "94% satisfacción", description: "Corredor centro-sur" },
    ],
  );
});

test("keeps the public hero free of credentials and provider route contracts", () => {
  const pageSource = readFileSync(new URL("../../app/page.tsx", import.meta.url), "utf8");

  assert.equal(pageSource.includes("/providers/[carrierSlug]"), false);
  assert.equal(pageSource.includes("@empresa"), false);
  assert.equal(pageSource.includes("password"), false);
  assert.match(pageSource, /href="\/login"/);
  assert.match(pageSource, /href="#como-funciona"/);
});
