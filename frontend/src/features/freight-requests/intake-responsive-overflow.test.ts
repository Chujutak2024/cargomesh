import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Persistent contract test: validates that freight-intake-form.module.css
 * contains the mobile overflow prevention rules identified during
 * UAT P0 fix (fix/antigravity-p0-uat).
 *
 * Root cause: CSS Grid children default to min-width: auto (max-content),
 * which ignores flex-wrap on narrow viewports (390px) and forces horizontal
 * scroll. The fix ensures min-width: 0 on all grid-participating containers.
 */

const CSS_PATH = resolve(
  import.meta.dirname,
  "../../components/freight-intake-form.module.css"
);
const css = readFileSync(CSS_PATH, "utf8");

test("subSectionCard has min-width: 0 to prevent grid overflow", () => {
  const rule = css.match(/\.subSectionCard\s*\{[^}]*\}/);
  assert.ok(rule, ".subSectionCard rule must exist");
  assert.ok(
    rule[0].includes("min-width: 0") || rule[0].includes("min-width:0"),
    ".subSectionCard must include min-width: 0"
  );
});

test("subSectionHeader has min-width: 0 to prevent grid overflow", () => {
  const rule = css.match(/\.subSectionHeader\s*\{[^}]*\}/);
  assert.ok(rule, ".subSectionHeader rule must exist");
  assert.ok(
    rule[0].includes("min-width: 0") || rule[0].includes("min-width:0"),
    ".subSectionHeader must include min-width: 0"
  );
});

test("contextGrid has min-width: 0 to prevent grid overflow", () => {
  const rule = css.match(/\.contextGrid\s*\{[^}]*\}/);
  assert.ok(rule, ".contextGrid rule must exist");
  assert.ok(
    rule[0].includes("min-width: 0") || rule[0].includes("min-width:0"),
    ".contextGrid must include min-width: 0"
  );
});

test("contextInfoCard has min-width: 0 to prevent grid overflow", () => {
  const rule = css.match(/\.contextInfoCard\s*\{[^}]*\}/);
  assert.ok(rule, ".contextInfoCard rule must exist");
  assert.ok(
    rule[0].includes("min-width: 0") || rule[0].includes("min-width:0"),
    ".contextInfoCard must include min-width: 0"
  );
});

test("contextValue has min-width: 0 and flex-wrap: wrap for mobile", () => {
  const rule = css.match(/\.contextValue\s*\{[^}]*\}/);
  assert.ok(rule, ".contextValue rule must exist");
  assert.ok(
    rule[0].includes("min-width: 0") || rule[0].includes("min-width:0"),
    ".contextValue must include min-width: 0"
  );
  assert.ok(
    rule[0].includes("flex-wrap: wrap") || rule[0].includes("flex-wrap:wrap"),
    ".contextValue must include flex-wrap: wrap"
  );
});

test("inputs and selects inside subSectionCard have max-width: 100%", () => {
  // The combined rule ".subSectionCard input, .subSectionCard select" must
  // include max-width: 100% to prevent overflow on narrow viewports.
  assert.ok(
    css.includes(".subSectionCard input") &&
      css.includes(".subSectionCard select"),
    "CSS must have explicit input/select rules for .subSectionCard"
  );
  // Find the combined rule line
  const inputRule = css
    .split("\n")
    .find(
      (line) =>
        line.includes(".subSectionCard input") &&
        line.includes("max-width: 100%")
    );
  assert.ok(
    inputRule,
    ".subSectionCard input rule must include max-width: 100%"
  );
});

test("620px media query stacks subSectionHeader vertically on mobile", () => {
  // The CSS is minified on a single line, so we search for the media query
  // by finding lines containing both the breakpoint and the target class.
  const mediaLine = css
    .split("\n")
    .find(
      (line) =>
        line.includes("max-width: 620px") ||
        line.includes("max-width:620px")
    );
  assert.ok(mediaLine, "620px mobile media query must exist");
  assert.ok(
    mediaLine.includes(".subSectionHeader"),
    "620px media query must target .subSectionHeader"
  );
  assert.ok(
    mediaLine.includes("flex-direction: column") ||
      mediaLine.includes("flex-direction:column"),
    "620px media query must set .subSectionHeader to flex-direction: column"
  );
});

test("special handling textarea has an explicit light CargoMesh surface", () => {
  const rule = css.match(/\.notesTextarea\s*\{[^}]*\}/);
  assert.ok(rule, ".notesTextarea rule must exist");
  assert.match(rule[0], /background:\s*#f4fbf8/);
  assert.match(rule[0], /color:\s*#1f302d/);
});
