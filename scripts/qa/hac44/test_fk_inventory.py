"""Paired regressions for the authorized 178 + 42 selected / 40 excluded scope."""

import copy
import hashlib
import json
import unittest
from collections import Counter
from pathlib import Path

from fk_inventory import load_inventory, validate_inventory


# Independent regression anchors from the clean fe12d41 catalog + delivered
# classification, not recalculated from a changed inventory at test startup.
EXPECTED_DIGESTS = {
    "baseline": "9a3eb962f8c21926ec0455c1489f5b222843ed5b9a0adda68f6c3b57d637f5f9",
    "new": "f4ca7c379ed43b99e20608bb29e519fd73c5095ad951f591050d8edeb2ccf597",
    "excluded": "4119cfd156b75ae8c61b7caabba35a76a8477a49bb482ce7e4ef48296a7f4b0f",
}
NEW_TABLE_COUNTS = {
    "public.asset_cargo_capabilities": 7,
    "public.plan_resource_bindings": 6,
    "public.v2_rankings": 4,
    "public.capacity_consolidations": 6,
    "public.execution_events": 5,
    "private.v2_catalog_grants": 2,
    "private.v2_catalog_receipts": 2,
    "private.v2_facility_command_receipts": 3,
    "private.v2_organization_command_receipts": 2,
    "private.v2_request_command_receipts": 3,
    "private.v2_workflow_receipts": 2,
}
FIELDS = (
    "table", "constraint", "childColumns", "referenceTable", "referenceColumns",
    "definition", "category",
)


def frozen_digest(rows):
    ordered = sorted(rows, key=lambda row: (row["table"], row["constraint"]))
    serialized = [{field: row[field] for field in FIELDS} for row in ordered]
    return hashlib.sha256(json.dumps(
        serialized, sort_keys=True, separators=(",", ":"),
    ).encode("utf-8")).hexdigest()


def fixture_catalog(records):
    """A portable catalog fixture; immutable scope is checked independently above."""
    return {"constraints": [{
        "schema": row["table"].split(".")[0], "relation": row["table"],
        "conname": row["constraint"], "contype": "f", "definition": row["definition"],
        "target": row["referenceTable"],
    } for row in records]}


class FKInventoryTests(unittest.TestCase):
    def control(self):
        """Every negative test first validates the same complete positive fixture."""
        inventory = load_inventory()
        records = inventory["records"]
        catalog = fixture_catalog(records)
        selected = validate_inventory(catalog, inventory)
        self.assertEqual(inventory["originSha"], "fe12d41e474c2c12d9dcd8e77047a0f2b7f0bd66")
        self.assertEqual(len(records), 260)
        self.assertEqual(len({(row["table"], row["constraint"]) for row in records}), 260)
        self.assertEqual(len(selected), 220)
        groups = {
            "baseline": [row for row in records if row["category"] == "BASELINE_178"],
            "new": [row for row in records if row["category"] in (
                "V2_MODELO", "V2_AUXILIAR", "INTERNA_V2_RECEIPTS_GRANTS",
            )],
            "excluded": [row for row in records if row["category"] == "V1_HEREDADA_BASELINE"],
        }
        self.assertEqual({name: len(rows) for name, rows in groups.items()},
                         {"baseline": 178, "new": 42, "excluded": 40})
        self.assertEqual({name: frozen_digest(rows) for name, rows in groups.items()}, EXPECTED_DIGESTS)
        self.assertEqual(Counter(row["table"] for row in groups["new"]), NEW_TABLE_COUNTS)
        self.assertEqual(Counter(row["category"] for row in groups["new"]), {
            "V2_MODELO": 17, "V2_AUXILIAR": 11, "INTERNA_V2_RECEIPTS_GRANTS": 14,
        })
        self.assertTrue(all(row["reason"] for row in groups["excluded"]))
        excluded = {(row["table"], row["constraint"]) for row in groups["excluded"]}
        self.assertTrue(excluded.isdisjoint((row["table"], row["constraint"]) for row in selected))
        self.assertEqual({(row["table"], row["constraint"]) for row in selected}, {
            (row["table"], row["constraint"]) for row in groups["baseline"] + groups["new"]
        })
        return inventory, catalog, selected

    def test_authorized_scope_and_frozen_baseline_are_exact(self):
        self.control()

    def test_duplicate_inventory_identity_is_rejected_at_unchanged_count(self):
        inventory, catalog, _ = self.control()
        baseline = [index for index, row in enumerate(inventory["records"])
                    if row["category"] == "BASELINE_178"]
        inventory["records"][baseline[1]] = copy.deepcopy(inventory["records"][baseline[0]])
        with self.assertRaisesRegex(ValueError, "Duplicate FK identity"):
            validate_inventory(catalog, inventory)

    def test_duplicate_catalog_identity_is_rejected(self):
        inventory, catalog, _ = self.control()
        catalog["constraints"].append(copy.deepcopy(catalog["constraints"][0]))
        with self.assertRaisesRegex(ValueError, "Duplicate FK identity"):
            validate_inventory(catalog, inventory)

    def test_catalog_missing_fk_and_same_count_substitution_are_rejected(self):
        inventory, catalog, _ = self.control()
        for change in ("missing", "substituted"):
            with self.subTest(change=change):
                changed = copy.deepcopy(catalog)
                if change == "missing":
                    changed["constraints"].pop()
                else:
                    changed["constraints"][0]["conname"] = "unexpected_same_count_fk"
                with self.assertRaisesRegex(ValueError, "FK catalog inventory drift"):
                    validate_inventory(changed, inventory)

    def test_changed_fk_definition_is_rejected_even_with_identical_columns(self):
        inventory, catalog, _ = self.control()
        catalog["constraints"][0]["definition"] = catalog["constraints"][0]["definition"].replace(
            "ON DELETE CASCADE", "ON DELETE RESTRICT",
        )
        with self.assertRaisesRegex(ValueError, "Physical FK definition changed"):
            validate_inventory(catalog, inventory)

    def test_catalog_reference_cannot_contradict_its_definition(self):
        inventory, catalog, _ = self.control()
        catalog["constraints"][0]["target"] = "public.carriers"
        with self.assertRaisesRegex(ValueError, "reference table contradicts"):
            validate_inventory(catalog, inventory)

    def test_baseline_and_catalog_cannot_change_together(self):
        inventory, catalog, _ = self.control()
        index = next(index for index, row in enumerate(inventory["records"])
                     if row["category"] == "BASELINE_178")
        inventory["records"][index]["constraint"] += "_changed"
        catalog["constraints"][index]["conname"] += "_changed"
        with self.assertRaisesRegex(ValueError, "Frozen FK scope changed: baseline"):
            validate_inventory(catalog, inventory)

    def test_v1_cannot_leak_into_selected_scope_by_same_count_category_swap(self):
        inventory, catalog, _ = self.control()
        excluded = next(row for row in inventory["records"] if row["category"] == "V1_HEREDADA_BASELINE")
        selected = next(row for row in inventory["records"] if row["category"] == "BASELINE_178")
        excluded["category"], selected["category"] = selected["category"], excluded["category"]
        with self.assertRaisesRegex(ValueError, "Frozen FK scope changed"):
            validate_inventory(catalog, inventory)

    def test_excluded_v1_still_participates_in_catalog_drift_checks(self):
        inventory, catalog, _ = self.control()
        excluded = next(row for row in inventory["records"] if row["category"] == "V1_HEREDADA_BASELINE")
        row = next(row for row in catalog["constraints"]
                   if (row["relation"], row["conname"]) == (excluded["table"], excluded["constraint"]))
        row["definition"] += " DEFERRABLE"
        with self.assertRaisesRegex(ValueError, "Physical FK definition changed"):
            validate_inventory(catalog, inventory)

    def test_composite_column_order_cannot_drift(self):
        inventory, catalog, _ = self.control()
        row = next(row for row in inventory["records"] if row["constraint"] == "resource_binding_leg_fk")
        row["childColumns"].reverse()
        with self.assertRaisesRegex(ValueError, "metadata contradicts"):
            validate_inventory(catalog, inventory)

    def test_grants_without_pk_and_both_relation70_pairs_are_selected(self):
        _, catalog, selected = self.control()
        self.assertNotIn("keys", catalog)
        grants = [row for row in selected if row["table"] == "private.v2_catalog_grants"]
        self.assertEqual({row["constraint"]: row["childColumns"] for row in grants}, {
            "v2_catalog_grants_auth_user_id_fkey": ["auth_user_id"],
            "v2_catalog_grants_carrier_id_fkey": ["carrier_id"],
        })
        bridge = {row["constraint"]: row for row in selected
                  if row["table"] == "public.plan_resource_bindings"}
        self.assertEqual(bridge["resource_binding_leg_fk"]["childColumns"], ["leg_assignment_id", "plan_id"])
        self.assertEqual(bridge["plan_leg_assignments_resource_id_plan_id_fkey"]["childColumns"],
                         ["resource_id", "plan_id"])

    def test_schema_and_authorized_origin_are_required(self):
        inventory, catalog, _ = self.control()
        for key, value in (("originSha", "unauthorized"), ("schemaVersion", 2)):
            with self.subTest(key=key):
                changed = copy.deepcopy(inventory)
                changed[key] = value
                with self.assertRaisesRegex(ValueError, "format or authorized origin"):
                    validate_inventory(catalog, changed)

    def test_missing_exclusion_reason_is_rejected(self):
        inventory, catalog, _ = self.control()
        row = next(row for row in inventory["records"] if row["category"] == "V1_HEREDADA_BASELINE")
        row["reason"] = ""
        with self.assertRaisesRegex(ValueError, "reason must be nonempty"):
            validate_inventory(catalog, inventory)

    def test_optional_inventory_path_preserves_the_same_document(self):
        inventory, _, _ = self.control()
        path = Path(__file__).with_name("fk_inventory.json")
        self.assertEqual(load_inventory(path), inventory)


if __name__ == "__main__":
    unittest.main()
