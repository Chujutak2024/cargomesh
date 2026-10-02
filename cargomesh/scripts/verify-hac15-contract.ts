/** Read-only comparison with fetched teammate refs; never integrates their code. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { scenarioData } from "../src/features/v2-road-map/road-map-qa-fixtures";
import { getMapPresentation } from "../src/features/v2-road-map/road-map-model";

const app = process.cwd();
const backend = "origin/feat/be2-v2-road-serviceability";
const intake = "origin/feat/fe1-v2-intake-eligibility";
const git = (...args: string[]) => execFileSync("git", args, { cwd: app, encoding: "utf8" }).trim();
async function main() {
const cache = path.resolve(app, "node_modules/.cache/hac15-contract");
await mkdir(cache, { recursive: true });
const temporary = await mkdtemp(path.join(cache, "snapshot-"));
const checks: string[] = [];
try {
  for (const name of ["serviceability", "freight-request", "intake-options"]) {
    await writeFile(path.join(temporary, `${name}.ts`), git("show", `${backend}:cargomesh/src/shared/schemas/v2/${name}.ts`));
  }
  await writeFile(path.join(temporary, "contracts.ts"), git("show", `${intake}:cargomesh/src/features/v2-intake/contracts.ts`));
  await mkdir(path.join(temporary, "mappers"));
  await writeFile(path.join(temporary, "mappers/road-map-props.mapper.ts"), git("show", `${intake}:cargomesh/src/features/v2-intake/mappers/road-map-props.mapper.ts`));
  const ownContract = path.relative(temporary, path.join(app, "src/features/v2-road-map/road-map-contract")).replaceAll("\\", "/");
  await writeFile(path.join(temporary, "compatibility.ts"), `
import type { RoadCandidateMapViewProps as MapProps, RoadRoutePreviewDto } from "${ownContract}";
import type { RoadCandidateMapViewProps as IntakeProps } from "./contracts";
import type { RoadRoutePreviewV2 } from "./serviceability";
import type { CanonicalLocationV2 } from "./freight-request";
type Assert<T extends true> = T;
export type MapperAccepted = Assert<IntakeProps extends MapProps ? true : false>;
export type ApiRouteAccepted = Assert<RoadRoutePreviewV2 extends RoadRoutePreviewDto ? true : false>;
export type ApiLocationAccepted = Assert<CanonicalLocationV2 extends MapProps["origin"] ? true : false>;
`);
  execFileSync(process.execPath, [path.join(app, "node_modules/typescript/lib/tsc.js"),
    "--noEmit", "--strict", "--skipLibCheck", "--target", "ES2022", "--moduleResolution", "node",
    path.join(temporary, "compatibility.ts")], { cwd: app, encoding: "utf8" });
  checks.push("Luis mapper props and HAC-12 route/location types accepted without casts");

  const api = await import(pathToFileURL(path.join(temporary, "serviceability.ts")).href);
  const locations = await import(pathToFileURL(path.join(temporary, "freight-request.ts")).href);
  const mapper = await import(pathToFileURL(path.join(temporary, "mappers/road-map-props.mapper.ts")).href);
  const zero = scenarioData("zero");
  const evaluation = {
    schemaVersion: "2.0",
    data: {
      freightRequestId: "00000000-0000-4000-8000-00000000c230", evaluatedDraftVersion: 1,
      evaluatedAt: "2026-10-02T12:00:00Z", overallStatus: zero.overallStatus,
      summaryCounts: { totalEvaluated: 0, eligibleCount: 0, unknownCount: 0, ineligibleCount: 0 },
      commercialNotice: "EVALUATION_ONLY_NO_OFFER_OR_BOOKING", candidates: zero.candidates,
    },
  };
  assert.equal(zero.origin.city, "Piura");
  assert.equal(zero.destination.city, "Arequipa");
  assert.equal(zero.overallStatus, "ineligible");
  api.RoadServiceabilityEvaluationV2ResponseSchema.parse(evaluation);
  assert.equal(api.RoadServiceabilityEvaluationV2ResponseSchema.safeParse({ ...evaluation,
    data: { ...evaluation.data, overallStatus: "unknown" } }).success, false);
  checks.push("Piura/Arequipa zero-candidate fixture passes real Zod; former unknown fails");
  const onSelectCandidate = () => {};
  const mapped = mapper.mapServiceabilityToMapViewProps(
    { origin: zero.origin, destination: zero.destination }, evaluation.data, null, onSelectCandidate,
  );
  assert.equal(mapped.overallStatus, "ineligible");
  assert.equal(mapped.selectedCandidateId, null);
  assert.equal(mapped.onSelectCandidate, onSelectCandidate);
  assert.deepEqual(mapped.origin, zero.origin);
  assert.deepEqual(getMapPresentation(mapped).paths, []);
  checks.push("Actual Luis mapper preserves zero-candidate evaluation, canonical endpoints and parent callback");

  for (const scenario of ["eligible", "empty-legs", "google-source"] as const) {
    const preview = scenarioData(scenario).candidates[0].routePreview;
    api.RoadRoutePreviewV2Schema.parse(preview);
  }
  const unknown = scenarioData("unknown");
  assert.equal(unknown.candidates[0].routePreview, null);
  assert.deepEqual(getMapPresentation({ ...unknown, selectedCandidateId: "road-b", onSelectCandidate() {} }).paths, []);
  checks.push("SIMULATED, empty legs, UNKNOWN/no trace and null preview respect API/map boundary");

  for (const scenario of ["missing", "missing-both"] as const) {
    const fixture = scenarioData(scenario);
    for (const location of [fixture.origin, fixture.destination]) {
      locations.CanonicalLocationV2Schema.parse({ facilityId: null, region: null, ...location });
    }
    const model = getMapPresentation({ ...fixture, selectedCandidateId: "road-a", onSelectCandidate() {} });
    assert.equal(model.paths.length, 0);
    assert.equal(model.markers.length, scenario === "missing" ? 1 : 0);
  }
  checks.push("Nullable canonical coordinates pass real schema; no invented pins or trace");
  const malformed = scenarioData("unknown-points").candidates[0].routePreview;
  assert.equal(api.RoadRoutePreviewV2Schema.safeParse(malformed).success, false);
  assert.equal(getMapPresentation({ ...scenarioData("unknown-points"), selectedCandidateId: "road-a", onSelectCandidate() {} }).paths.length, 0);
  checks.push("Deliberately invalid UNKNOWN-with-points fixture rejected by API and suppressed by map");
  for (const scenario of ["label-markup", "label-characters", "eligible"] as const) {
    const fixture = scenarioData(scenario);
    for (const endpoint of [fixture.origin, fixture.destination]) {
      const parsed = locations.CanonicalLocationV2Schema.parse({ facilityId: null, region: null, ...endpoint });
      assert.equal(parsed.label, endpoint.label);
    }
  }
  checks.push("Actual canonical schema accepts markup, special characters and normal names unchanged; renderer must use text");
  // No external API/DB requests: these are schemas at the fetched commit, not runtime service proof.
  console.log(JSON.stringify({ status: "PASS", backendSha: git("rev-parse", backend),
    intakeSha: git("rev-parse", intake), checks, apiRuntimeVerified: false }, null, 2));
} finally {
  // Only the verified temporary child of our dependency cache can be removed.
  if (path.dirname(temporary) !== cache) throw new Error("Unexpected contract snapshot path");
  await rm(temporary, { recursive: true, force: true });
}
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
