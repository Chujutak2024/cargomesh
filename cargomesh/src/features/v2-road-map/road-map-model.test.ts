import assert from "node:assert/strict";
import test from "node:test";
import type { RoadCandidateMapViewProps } from "./road-map-contract";
import { getMapPresentation, isGoogleRoutesSource, providerNote } from "./road-map-model";

const sample: RoadCandidateMapViewProps = {
  origin: { label: "Planta Callao Norte", city: "Callao", countryCode: "PE", lat: -12.0464, lng: -77.1181 },
  destination: { label: "Centro de distribución Arequipa", city: "Arequipa", countryCode: "PE", lat: -16.409, lng: -71.5375 },
  overallStatus: "eligible",
  candidates: [
    {
      candidateId: "road-a", status: "eligible",
      carrier: { id: "carrier-a", code: "ROAD-A", commercialName: "Transportista A" },
      service: { id: "service-a", code: "ROAD-SUR", mode: "ROAD" },
      carrierName: "Transportista A", serviceCode: "ROAD-SUR",
      routePreview: {
        corridorCode: "PE-PANAM-SUR-1S", distanceKm: 1015, estimatedTransitHours: 18.5,
        geometrySource: "SCENARIO_SYNTHETIC_GEOMETRY", provenanceStatus: "SIMULATED",
        legs: [{ sequence: 1, mode: "ROAD", originLabel: "Callao", destinationLabel: "Arequipa",
          waypoints: [{ lat: -12.0464, lng: -77.1181 }, { lat: -14.0678, lng: -75.7286 }, { lat: -16.409, lng: -71.5375 }], conditions: [] }],
      },
    },
    {
      candidateId: "road-b", status: "unknown",
      carrier: { id: "carrier-b", code: "ROAD-B", commercialName: "Transportista B" },
      service: { id: "service-b", code: "ROAD-SUR-B", mode: "ROAD" },
      carrierName: "Transportista B", serviceCode: "ROAD-SUR-B", routePreview: null,
    },
  ],
  selectedCandidateId: "road-a",
  onSelectCandidate: () => {},
};

test("draws only declared simulated geometry and labels the Google map honestly", () => {
  const result = getMapPresentation(sample);
  assert.equal(result.paths.length, 1);
  assert.equal(result.paths[0].length, 3);
  assert.equal(result.distanceKm, 1015);
  assert.equal(providerNote("google", result, "es"), "Mapa: Google Maps Platform · Geometría simulada");
  assert.doesNotMatch(providerNote("google", result, "es"), /Google Routes/);
});

test("routePreview null, empty legs and UNKNOWN never draw a route", () => {
  const nullPreview = getMapPresentation({ ...sample, selectedCandidateId: "road-b" });
  assert.deepEqual(nullPreview.paths, []);
  assert.equal(nullPreview.markers.length, 2);
  assert.equal(providerNote("google", nullPreview, "es"), "Mapa: Google Maps Platform · Geometría de ruta no disponible");
  const emptyLegs = getMapPresentation({ ...sample, candidates: [{ ...sample.candidates[0], routePreview: { ...sample.candidates[0].routePreview!, legs: [] } }] });
  assert.deepEqual(emptyLegs.paths, []);
  const unknown = getMapPresentation({ ...sample, candidates: [{ ...sample.candidates[0], routePreview: { ...sample.candidates[0].routePreview!, provenanceStatus: "UNKNOWN" } }] });
  assert.deepEqual(unknown.paths, []);
  assert.equal(unknown.distanceKm, null);
});

test("missing canonical coordinates prevent geometry without inventing markers", () => {
  const missingOrigin = getMapPresentation({ ...sample, origin: { ...sample.origin, lat: null } });
  assert.deepEqual(missingOrigin.paths, []);
  assert.deepEqual(missingOrigin.markers.map(({ kind }) => kind), ["destination"]);
  const missingBoth = getMapPresentation({ ...sample, origin: { ...sample.origin, lat: null }, destination: { ...sample.destination, lng: null } });
  assert.deepEqual(missingBoth.markers, []);
  assert.deepEqual(missingBoth.paths, []);
});

test("selection is entirely controlled by parent props", () => {
  const first = getMapPresentation(sample);
  const second = getMapPresentation({ ...sample, selectedCandidateId: "road-b" });
  assert.equal(first.selectedCandidate?.candidateId, "road-a");
  assert.equal(second.selectedCandidate?.candidateId, "road-b");
  assert.deepEqual(second.paths, []);
  const none = getMapPresentation({ ...sample, selectedCandidateId: null });
  assert.equal(none.selectedCandidate, null);
  assert.deepEqual(none.paths, []);
});

test("zero candidates is a domain empty state, with canonical markers only", () => {
  const result = getMapPresentation({ ...sample, candidates: [], selectedCandidateId: null });
  assert.equal(result.selectedCandidate, null);
  assert.equal(result.markers.length, 2);
  assert.deepEqual(result.paths, []);
});

test("provider note uses actual renderer and Google Routes only for an explicit source", () => {
  const estimated = getMapPresentation({ ...sample, candidates: [{ ...sample.candidates[0], routePreview: { ...sample.candidates[0].routePreview!, provenanceStatus: "ESTIMATED", geometrySource: "GOOGLE_ROUTES" } }] });
  assert.equal(providerNote("google", estimated, "es"), "Mapa: Google Maps Platform · Ruta: Google Routes · Datos estimados");
  assert.equal(isGoogleRoutesSource(" google_routes_api "), true);
  assert.equal(isGoogleRoutesSource("SCENARIO_SYNTHETIC_GEOMETRY"), false);
  assert.equal(providerNote("openstreetmap", estimated, "en"), "Map: OpenStreetMap · Route: Google Routes · Estimated data");
  assert.equal(providerNote("none", estimated, "es"), "Proveedor cartográfico: no disponible");
  const otherSource = getMapPresentation({ ...sample, candidates: [{ ...sample.candidates[0], routePreview: { ...sample.candidates[0].routePreview!, provenanceStatus: "VERIFIED", geometrySource: "OTHER_SOURCE" } }] });
  assert.doesNotMatch(providerNote("google", otherSource, "es"), /Google Routes/);
});
