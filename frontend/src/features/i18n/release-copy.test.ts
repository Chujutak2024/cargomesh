import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CANONICAL_ANDES_PROVIDER_URL,
  JUDGE_FLOW_STEPS,
  JUDGE_TOOL_GUIDE,
  PROVIDER_TOOL_NAMES,
  WEBMCP_CLEANUP_SNIPPET,
  WEBMCP_COVERAGE_SNIPPET,
  WEBMCP_DISCOVERY_SNIPPET,
} from "./judge-guide-content";

const source = (relativePath: string) => readFileSync(
  new URL(relativePath, import.meta.url),
  "utf8",
);

test("the judge flow exposes bilingual intake, recommendation, provider and booking copy", () => {
  const intake = source("../../components/freight-intake-form.tsx");
  const recommendations = source("../recommendations/freight-recommendation-panel.tsx");
  const provider = source("../../app/providers/[carrierSlug]/provider-webmcp-host.tsx");
  const booking = source("../../components/booking-workspace.tsx");

  assert.match(intake, /New freight request/);
  assert.match(intake, /Saved; subject to provider coverage and capacity validation/);
  assert.doesNotMatch(intake, /Pendiente de persistencia y validación operativa/);
  assert.match(recommendations, /Human review required/);
  assert.match(recommendations, /Apply not configured/);
  assert.match(provider, /Available tools/);
  assert.match(booking, /Causal evidence/);
});

test("canonical protocol values remain untranslated", () => {
  const intake = source("../../components/freight-intake-form.tsx");
  const provider = source("../../app/providers/[carrierSlug]/provider-webmcp-host.tsx");

  for (const canonical of ["BALANCED", "STALE_DRAFT", "TOTAL_WEIGHT", "SCHEDULED", "ASAP"]) {
    assert.match(intake, new RegExp(canonical));
  }
  for (const tool of ["book_freight", "get_provider_booking_status"]) {
    assert.match(provider, new RegExp(tool));
  }
});

test("the judge catalog keeps one intake tool separate from exactly five provider tools", () => {
  const intakeTools = JUDGE_TOOL_GUIDE.filter((tool) => tool.scope === "intake");
  const providerTools = JUDGE_TOOL_GUIDE.filter((tool) => tool.scope === "provider");

  assert.equal(intakeTools.length, 1);
  assert.equal(intakeTools[0]?.name, "get_freight_request_recommendations");
  assert.equal(intakeTools[0]?.readOnlyHint, true);
  assert.deepEqual(providerTools.map((tool) => tool.name), [...PROVIDER_TOOL_NAMES]);
  assert.equal(new Set(providerTools.map((tool) => tool.name)).size, 5);
  assert.ok(providerTools.every((tool) => tool.host === CANONICAL_ANDES_PROVIDER_URL));
});

test("the judge catalog mirrors the registered WebMCP annotations", () => {
  const book = JUDGE_TOOL_GUIDE.find((tool) => tool.name === "book_freight");
  const readOnlyTools = JUDGE_TOOL_GUIDE.filter((tool) => tool.name !== "book_freight");

  assert.equal(book?.effect, "state-changing");
  assert.equal(book?.readOnlyHint, false);
  assert.equal(book?.destructiveHint, true);
  assert.equal(book?.uiEntry, "/dispatch/<runId>");
  assert.ok(readOnlyTools.every((tool) => tool.effect === "read-only"));
  assert.ok(readOnlyTools.every((tool) => tool.readOnlyHint === true));
  assert.ok(JUDGE_TOOL_GUIDE.every((tool) => tool.untrustedContentHint === false));
  assert.ok(JUDGE_TOOL_GUIDE.every((tool) => tool.description.es.length > 20 && tool.description.en.length > 20));
  const status = JUDGE_TOOL_GUIDE.find((tool) => tool.name === "get_provider_booking_status");
  assert.match(status?.description.en ?? "", /polling can consume the configured one-shot response/);
  assert.match(status?.expected.en ?? "", /Booking Bridge persists the transition/);
});

test("the walkthrough is self-contained and distinguishes verified recovery from a public reset", () => {
  assert.deepEqual(JUDGE_FLOW_STEPS.map((step) => step.id), [
    "sign-in",
    "open-intake",
    "review-history",
    "start-orchestration",
    "inspect-provider",
    "inspect-ranking",
    "book",
    "review-recovery",
    "verify-cleanup",
  ]);
  assert.match(JUDGE_FLOW_STEPS.at(-1)?.description.en ?? "", /same tab/);
  assert.match(JUDGE_FLOW_STEPS.find((step) => step.id === "review-recovery")?.description.en ?? "", /do not attempt to reset production/);
  assert.ok(JUDGE_FLOW_STEPS.every((step) => step.title.es && step.title.en && step.expected.es && step.expected.en));
});

test("DevTools examples rediscover actual RegisteredTool objects and keep execution read-only", () => {
  assert.match(WEBMCP_DISCOVERY_SNIPPET, /document\.modelContext/);
  assert.match(WEBMCP_DISCOVERY_SNIPPET, /Expected 5 provider tools/);
  assert.match(WEBMCP_COVERAGE_SNIPPET, /const tools = await mc\.getTools\(\)/);
  assert.match(WEBMCP_COVERAGE_SNIPPET, /tools\.find/);
  assert.match(WEBMCP_COVERAGE_SNIPPET, /readOnlyHint !== true/);
  assert.match(WEBMCP_COVERAGE_SNIPPET, /mc\.executeTool\(tool, JSON\.stringify/);
  assert.doesNotMatch(WEBMCP_COVERAGE_SNIPPET, /book_freight/);
  assert.match(WEBMCP_CLEANUP_SNIPPET, /remainingProviderTools/);
  assert.match(WEBMCP_CLEANUP_SNIPPET, /expected: \[\]/);
});

test("Judge Drawer exposes the bilingual no-video path, catalog, and safe console guide", () => {
  const drawer = source("../../components/judge-drawer.tsx");

  assert.match(drawer, /Prueba CargoMesh sin ver el video/);
  assert.match(drawer, /Test CargoMesh without the video/);
  assert.match(drawer, /Paso a paso para el jurado/);
  assert.match(drawer, /Catálogo WebMCP: 1 intake \+ 5 provider/);
  assert.match(drawer, /Prueba segura en DevTools/);
  assert.match(drawer, /No ejecutes book_freight manualmente/);
  assert.match(drawer, /do not cross Result Bridge or persist events or offers/);
});
