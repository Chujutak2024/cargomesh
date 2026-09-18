import assert from "node:assert/strict";
import test from "node:test";
import { localeTag, parseLocale, translate } from "./config";

test("English is the safe default when no locale preference exists", () => {
  assert.equal(parseLocale(undefined), "en");
  assert.equal(parseLocale(null), "en");
  assert.equal(parseLocale("unsupported"), "en");
});

test("an explicit supported preference is preserved", () => {
  assert.equal(parseLocale("en"), "en");
  assert.equal(parseLocale("es"), "es");
  assert.equal(localeTag("en"), "en-US");
  assert.equal(localeTag("es"), "es-PE");
  assert.equal(translate("en", "Proveedor", "Provider"), "Provider");
  assert.equal(translate("es", "Proveedor", "Provider"), "Proveedor");
});
