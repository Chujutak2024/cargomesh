import assert from "node:assert/strict";
import test from "node:test";

import {
  ELIGIBLE_UNKNOWN_EVALUATION_FIXTURE,
  ROAD_REQUEST_FIXTURE,
  ZERO_CANDIDATE_EVALUATION_FIXTURE,
} from "../fixtures/contract-flow.fixture";
import { mapServiceabilityToMapViewProps } from "./road-map-props.mapper";

test("mapper projects nested carrier and service plus flat aliases", () => {
  const onSelect = () => undefined;
  const props = mapServiceabilityToMapViewProps(
    ROAD_REQUEST_FIXTURE,
    ELIGIBLE_UNKNOWN_EVALUATION_FIXTURE,
    "cand-road-01",
    onSelect,
  );
  assert.equal(props.candidates[0].carrier.commercialName, "SurFrío Logística Vial S.A.C.");
  assert.equal(props.candidates[0].carrierName, "SurFrío Logística Vial S.A.C.");
  assert.equal(props.candidates[0].service.code, "ROAD-REEFER-PE-SUR");
  assert.equal(props.candidates[0].serviceCode, "ROAD-REEFER-PE-SUR");
  assert.equal(props.selectedCandidateId, "cand-road-01");
  assert.equal(props.onSelectCandidate, onSelect);
});

test("mapper preserves UNKNOWN route preview with empty legs", () => {
  const props = mapServiceabilityToMapViewProps(
    ROAD_REQUEST_FIXTURE,
    ELIGIBLE_UNKNOWN_EVALUATION_FIXTURE,
    "cand-road-02",
    () => undefined,
  );
  assert.equal(props.candidates[1].routePreview?.provenanceStatus, "UNKNOWN");
  assert.deepEqual(props.candidates[1].routePreview?.legs, []);
  assert.equal(ELIGIBLE_UNKNOWN_EVALUATION_FIXTURE.candidates[1].checks.capacityWindow.provenance.observedAt, null);
});

test("mapper preserves zero candidates instead of inventing a route", () => {
  const props = mapServiceabilityToMapViewProps(
    ROAD_REQUEST_FIXTURE,
    ZERO_CANDIDATE_EVALUATION_FIXTURE,
    null,
    () => undefined,
  );
  assert.equal(props.overallStatus, "ineligible");
  assert.deepEqual(props.candidates, []);
});

test("mapper normalizes an absent route preview to null", () => {
  const evaluation = structuredClone(ELIGIBLE_UNKNOWN_EVALUATION_FIXTURE);
  evaluation.candidates[0].routePreview = null;
  const props = mapServiceabilityToMapViewProps(ROAD_REQUEST_FIXTURE, evaluation, null, () => undefined);
  assert.equal(props.candidates[0].routePreview, null);
});

test("mapper preserves provider condition severity strings from HAC-12", () => {
  const evaluation = structuredClone(ELIGIBLE_UNKNOWN_EVALUATION_FIXTURE);
  const preview = evaluation.candidates[0].routePreview;
  assert.ok(preview);
  preview.legs[0].conditions[0].severity = "PROVIDER_ADVISORY";
  const props = mapServiceabilityToMapViewProps(ROAD_REQUEST_FIXTURE, evaluation, "cand-road-01", () => undefined);
  assert.equal(props.candidates[0].routePreview?.legs[0].conditions[0].severity, "PROVIDER_ADVISORY");
});
