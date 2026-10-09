"""Both complete cuts reconcile; inventory membership never proves a pair."""
import copy
import unittest

from fk_inventory import hac41_records, identity, load_inventory, reconcile_catalog, validate_inventory
from fk_strict import STRICT_METHOD, build_case, merge_results
from test_fk_inventory import fixture_catalog
from test_fk_complete import measured


class HAC41InventoryTests(unittest.TestCase):
    def controls(self):
        old = load_inventory()["records"]
        added = hac41_records()
        catalogs = [fixture_catalog(old), fixture_catalog(old + added)]
        for catalog in catalogs:
            selected = validate_inventory(catalog)
            self.assertEqual(len(selected), len({identity(row) for row in selected}))
        a, b = [reconcile_catalog(catalog) for catalog in catalogs]
        self.assertTrue(all(row["status"] == "NOT_PRESENT_IN_CUT" for row in a["hac41"]))
        self.assertTrue(all(row["status"] == "PRESENT_UNMEASURED" for row in b["hac41"]))
        self.assertEqual(b["catalog"] - a["catalog"], len(added))
        return catalogs

    def test_both_cuts_have_no_duplicates_and_absence_is_explicit(self):
        self.controls()

    def test_duplicates_abort_in_both_cuts_with_positive_controls(self):
        for catalog in self.controls():
            catalog["constraints"].append(copy.deepcopy(catalog["constraints"][-1]))
            with self.assertRaisesRegex(ValueError, "Duplicate FK identity"):
                validate_inventory(catalog)

    def test_partial_hac41_cohort_aborts_after_both_controls(self):
        _, catalog = self.controls()
        catalog["constraints"].pop()
        with self.assertRaisesRegex(ValueError, "Partial HAC-41"):
            validate_inventory(catalog)

    def test_receipt_positive_failure_prevents_matching_negative_credit(self):
        self.controls()
        record = next(row for row in hac41_records() if row["table"] == "private.v2_identity_receipts")
        data = {"auth.users": [{"id": "d4410000-0000-4000-8000-000000000001"}],
                "public.organization_members": [], "public.carrier_operators": [],
                "private.v2_identity_receipts": []}
        catalog = {"keys": [{"schema": "private", "relation": "v2_identity_receipts", "columns": ["auth_user_id", "idempotency_key"]}],
                   "constraints": fixture_catalog([record])["constraints"], "triggers": []}
        case = build_case(record, catalog, data)
        self.assertEqual(case["method"], STRICT_METHOD)
        self.assertEqual(case["status"], "PENDING")
        merge_results([case], measured(case), 0)
        self.assertEqual(case["status"], "PASS")
        failed = build_case(record, catalog, data)
        merge_results([failed], measured(failed, positive=False, positiveAffectedRows=0), 0)
        self.assertEqual(failed["status"], "BLOQUEADO")
        self.assertFalse(failed["negative"])


if __name__ == "__main__":
    unittest.main()
