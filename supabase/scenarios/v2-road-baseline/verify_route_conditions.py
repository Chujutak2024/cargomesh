"""HAC-13 scenario contract checks; standard library only, no DB writes or app imports."""
from copy import deepcopy
from datetime import datetime, timedelta
from pathlib import Path
from uuid import UUID
import argparse
import json
import re
import sys
import unittest

SCENARIO = Path(__file__).resolve().parent
FIXTURE = SCENARIO / "fixtures/route-conditions.json"
REFERENCE_AT = "2026-10-05T12:00:00Z"
KINDS = {"CLOSURE", "DELAY", "HAZARD", "RESTRICTION"}
SEVERITIES = {"INFO", "WARNING", "CRITICAL"}
DOMAIN_FIELDS = {"kind", "location", "observedAt", "validUntil", "source", "confidence"}
LOCATION_FIELDS = {"facilityId", "label", "countryCode", "region", "city", "lat", "lng"}
PROJECTION_FIELDS = {"code", "severity", "description", "provenanceStatus"}
INSTANT = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def exact_fields(value, fields, name):
    require(isinstance(value, dict), f"{name} must be an object")
    missing = fields - value.keys()
    require(not missing, f"{name} missing fields: {sorted(missing)}")
    require(value.keys() == fields, f"{name} has unexpected fields")


def instant(value):
    require(isinstance(value, str) and INSTANT.fullmatch(value), "invalid explicit Instant")
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def scenario_catalog():
    """Standalone reference controls from existing scenario identities/request fixtures."""
    manifest = json.loads((SCENARIO / "manifest.json").read_text(encoding="utf-8-sig"))
    places = {}
    for filename in ("positive.json", "zero.json"):
        request = json.loads((SCENARIO / "fixtures" / filename).read_text(encoding="utf-8-sig"))["requestBody"]
        for key in ("origin", "destination"):
            location = {field: request[key].get(field) for field in LOCATION_FIELDS}
            require(location["facilityId"] in manifest["stableSeedKeys"].values(), "reference facility missing from manifest")
            places[location["facilityId"]] = location
    return {"facilities": list(places.values()),
            "lanes": [manifest["stableSeedKeys"]["laneAtoB"], manifest["stableSeedKeys"]["unknownLane"]]}


def validate_condition(condition, catalog):
    exact_fields(condition, DOMAIN_FIELDS, "RouteCondition")
    require(condition["kind"] in KINDS, "invalid kind")
    require(condition["source"] == "SIMULATED", "source must be SIMULATED")
    require(condition["confidence"] == "SIMULATED", "confidence must be SIMULATED")
    start, end = instant(condition["observedAt"]), instant(condition["validUntil"])
    require(start < end, "inverted or empty validity range")
    location = condition["location"]
    exact_fields(location, LOCATION_FIELDS, "location")
    UUID(location["facilityId"])
    places = {place["facilityId"]: place for place in catalog["facilities"]}
    require(location["facilityId"] in places, "unknown scenario facility")
    require(location == places[location["facilityId"]], "location differs from canonical scenario facility")


def state_at(condition, at):
    if condition is None:
        return "absent"
    reference = instant(at)
    if reference < instant(condition["observedAt"]):
        return "not_yet_active"
    return "expired" if reference >= instant(condition["validUntil"]) else "active"


def project(condition, at):
    """Only a condition array; never creates routePreview, legs or waypoints."""
    if state_at(condition, at) != "active":
        return []
    return [{
        "code": f"RC_{condition['kind']}",
        "severity": "INFO",
        "description": (
            f"[SYNTHETIC] SIMULATED {condition['kind']} at {condition['location']['label']}; "
            f"observedAt={condition['observedAt']}; validUntil={condition['validUntil']} (exclusive). "
            "Display fixture only; no real incident or ETA, eligibility or capacity effect."
        ),
        "provenanceStatus": "SIMULATED",
    }]


def validate_projection(items):
    require(isinstance(items, list), "expectedProjection must be an array")
    for item in items:
        exact_fields(item, PROJECTION_FIELDS, "projection")
        require(isinstance(item["code"], str) and item["code"] in {f"RC_{kind}" for kind in KINDS}, "invalid projection code")
        require(item["severity"] in SEVERITIES, "severity outside documented enum")
        require(item["severity"] == "INFO", "fixture severity must be INFO")
        require(item["provenanceStatus"] == "SIMULATED", "projection must be SIMULATED")
        require(isinstance(item["description"], str) and item["description"].startswith("[SYNTHETIC] SIMULATED "), "synthetic description required")


def validate_fixture(data, catalog):
    exact_fields(data, {"assumption", "referenceAt", "cases"}, "fixture")
    require(data["assumption"]["status"] == "SUPUESTO"
            and data["assumption"]["pendingConfirmation"] == "Tech Lead / HAC-27", "assumption must remain explicit")
    require(data["referenceAt"] == REFERENCE_AT, "fixed referenceAt changed")
    require(isinstance(data["cases"], list), "cases must be an array")
    seen = set()
    names = set()
    for case in data["cases"]:
        exact_fields(case, {"id", "case", "association", "condition", "expectedProjection"}, "case")
        require(str(UUID(case["id"])) == case["id"] and case["id"].startswith("c2400000-"), "fixture ID outside c2400000")
        require(case["id"] not in seen, "duplicate fixture identity")
        seen.add(case["id"])
        names.add(case["case"])
        exact_fields(case["association"], {"scenario", "laneId"}, "association")
        require(case["association"]["scenario"] == SCENARIO.name, "wrong scenario")
        require(case["association"]["laneId"] in catalog["lanes"], "unknown scenario lane")
        if case["condition"] is not None:
            validate_condition(case["condition"], catalog)
        require(state_at(case["condition"], data["referenceAt"]) == case["case"], "case state does not match fixed reference")
        validate_projection(case["expectedProjection"])
        require(project(case["condition"], data["referenceAt"]) == case["expectedProjection"], "expectedProjection differs from approved projection")
    require({"active", "expired", "absent"} <= names, "missing active/expired/absence controls")


def active_for_lane(data, lane_id, at):
    return [item for case in data["cases"] if case["association"]["laneId"] == lane_id
            for item in project(case["condition"], at)]


class ContractChecks(unittest.TestCase):
    def setUp(self):
        self.active = deepcopy(next(case for case in DATA["cases"] if case["case"] == "active"))
        self.expired = next(case for case in DATA["cases"] if case["case"] == "expired")
        self.absent = next(case for case in DATA["cases"] if case["case"] == "absent")

    def positive_control(self):
        try:
            validate_condition(self.active["condition"], CATALOG)
            self.assertIn(self.active["association"]["laneId"], CATALOG["lanes"])
            self.assertEqual(state_at(self.active["condition"], REFERENCE_AT), "active")
            validate_projection(self.active["expectedProjection"])
            self.assertEqual(project(self.active["condition"], REFERENCE_AT), self.active["expectedProjection"])
        except (ValueError, AssertionError) as error:
            self.fail(f"BLOCKED: positive control failed: {error}")

    def test_valid_fixture_and_scenario_references(self):
        self.positive_control()
        validate_fixture(DATA, CATALOG)

    def test_expired_and_exclusive_end(self):
        self.positive_control()
        validate_condition(self.expired["condition"], CATALOG)
        self.assertEqual(state_at(self.expired["condition"], REFERENCE_AT), "expired")
        self.assertEqual(project(self.expired["condition"], REFERENCE_AT), [])
        end = self.active["condition"]["validUntil"]
        self.assertEqual(state_at(self.active["condition"], end), "expired")
        self.assertEqual(project(self.active["condition"], end), [])

    def test_start_inclusive_and_before_start(self):
        self.positive_control()
        start = self.active["condition"]["observedAt"]
        self.assertEqual(project(self.active["condition"], start), self.active["expectedProjection"])
        before = (instant(start) - timedelta(seconds=1)).isoformat()
        self.assertEqual(state_at(self.active["condition"], before), "not_yet_active")
        self.assertEqual(project(self.active["condition"], before), [])

    def test_absence_with_present_lane_control(self):
        self.positive_control()
        self.assertEqual(active_for_lane(DATA, self.active["association"]["laneId"], REFERENCE_AT), self.active["expectedProjection"])
        self.assertIsNone(self.absent["condition"])
        self.assertIn(self.absent["association"]["laneId"], CATALOG["lanes"])
        self.assertEqual(active_for_lane(DATA, self.absent["association"]["laneId"], REFERENCE_AT), [])

    def test_missing_source(self):
        self.positive_control()
        bad = deepcopy(self.active["condition"])
        del bad["source"]
        with self.assertRaisesRegex(ValueError, "source"):
            validate_condition(bad, CATALOG)

    def test_missing_validity(self):
        for field in ("observedAt", "validUntil"):
            with self.subTest(field=field):
                self.positive_control()
                bad = deepcopy(self.active["condition"])
                del bad[field]
                with self.assertRaisesRegex(ValueError, field):
                    validate_condition(bad, CATALOG)

    def test_non_simulated_source_and_confidence(self):
        for field in ("source", "confidence"):
            with self.subTest(field=field):
                self.positive_control()
                bad = deepcopy(self.active["condition"])
                bad[field] = "VERIFIED"
                with self.assertRaisesRegex(ValueError, field):
                    validate_condition(bad, CATALOG)

    def test_inverted_and_empty_range(self):
        for end in ("2026-09-30T00:00:00Z", self.active["condition"]["observedAt"]):
            with self.subTest(end=end):
                self.positive_control()
                bad = deepcopy(self.active["condition"])
                bad["validUntil"] = end
                with self.assertRaisesRegex(ValueError, "validity range"):
                    validate_condition(bad, CATALOG)

    def test_projection_strict_fields_and_enum(self):
        mutations = (("observedAt", REFERENCE_AT), ("severity", "DECORATIVE"), ("code", "RC_NORMAL"), ("provenanceStatus", "VERIFIED"))
        for field, value in mutations:
            with self.subTest(field=field):
                self.positive_control()
                bad = deepcopy(self.active["expectedProjection"])
                bad[0][field] = value
                with self.assertRaises(ValueError):
                    validate_projection(bad)
        self.positive_control()
        missing = deepcopy(self.active["expectedProjection"])
        del missing[0]["description"]
        with self.assertRaisesRegex(ValueError, "description"):
            validate_projection(missing)

    def test_domain_strictness_and_canonical_location(self):
        for field, value in (("etaHours", 1), ("kind", "NORMAL"), ("observedAt", "not-an-instant")):
            with self.subTest(field=field):
                self.positive_control()
                bad = deepcopy(self.active["condition"])
                bad[field] = value
                with self.assertRaises(ValueError):
                    validate_condition(bad, CATALOG)
        self.positive_control()
        bad = deepcopy(self.active["condition"])
        bad["location"]["lat"] = -12.0
        with self.assertRaisesRegex(ValueError, "canonical"):
            validate_condition(bad, CATALOG)

    def test_oracle_and_association_fail_closed(self):
        for field, value in (("expectedProjection", []), ("association", {"scenario": SCENARIO.name, "laneId": "c2400000-0000-4000-8000-000000000099"})):
            with self.subTest(field=field):
                self.positive_control()
                bad = deepcopy(DATA)
                bad["cases"][0][field] = value
                with self.assertRaises(ValueError):
                    validate_fixture(bad, CATALOG)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog-file", type=Path, help="Read-only canonical facility/lane export from the local gate")
    args = parser.parse_args()
    DATA = json.loads(FIXTURE.read_text(encoding="utf-8-sig"))
    CATALOG = json.loads(args.catalog_file.read_text(encoding="utf-8-sig")) if args.catalog_file else scenario_catalog()
    result = unittest.TextTestRunner(stream=sys.stdout, verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(ContractChecks))
    if result.wasSuccessful() and not result.skipped:
        print(f"PASS: RouteCondition contract checks; fixed reference={REFERENCE_AT}; "
              f"catalog={'local DB' if args.catalog_file else 'scenario artifacts'}; no DB writes")
    sys.exit(0 if result.wasSuccessful() and not result.skipped else 1)
