"""Protect the original baseline method and its disjoint catalog selection."""
import copy
import subprocess
import unittest
from pathlib import Path

from fk_baseline_scope import STRICT_FK_IDENTITIES
from fk_coverage import baseline_evidence, reconcile_baseline, without_strict_exclusion
from fk_inventory import group_records, identity, load_inventory, hac41_records


class BaselineTests(unittest.TestCase):
    def control(self):
        records = group_records(load_inventory()["records"])["baseline"]
        cases = [{"table": r["table"], "constraint": r["constraint"], "status": "PASS",
                  "tap": ["ok 1 - positive", "ok 2 - exact FK orphan"]} for r in records]
        reconcile_baseline(cases, records)
        self.assertTrue(all(c["positive"] and c["negative"] for c in baseline_evidence(cases, records)))
        return cases, records

    def test_source_equals_authorized_base_except_exclusion(self):
        root = Path(__file__).resolve().parents[3]
        original = subprocess.check_output(["git", "show", "776b5da:scripts/qa/hac44/fk_complete.py"],
                                           cwd=root).decode("utf-8").replace("\r\n", "\n")
        source = Path(__file__).with_name("fk_complete.py").read_text(encoding="utf-8")
        self.assertEqual(without_strict_exclusion(source), original)
        for fragment in (' disable trigger "', '" deferrable initially deferred;'):
            self.assertIn(fragment, original)
            changed = source.replace(fragment, fragment + "UNAUTHORIZED_CHANGE", 1)
            self.assertNotEqual(without_strict_exclusion(changed), original)

    def test_exclusion_is_exactly_the_explicit_strict_inventory(self):
        self.control()
        groups = group_records(load_inventory()["records"])
        self.assertEqual(STRICT_FK_IDENTITIES, {identity(r) for r in groups["new"] + hac41_records()})
        self.assertFalse(STRICT_FK_IDENTITIES & {identity(r) for r in groups["baseline"]})
        self.assertFalse(STRICT_FK_IDENTITIES & {identity(r) for r in groups["excluded"]})
        self.assertIn(("public.plan_leg_assignments", "plan_leg_assignments_fulfilment_partner_id_fkey"),
                      STRICT_FK_IDENTITIES)

    def test_missing_duplicate_and_wrong_identity_do_not_reconcile(self):
        cases, records = self.control()
        for changed in (cases[:-1], cases + [cases[0]],
                        [{**cases[0], "constraint": "unexpected_fk"}] + cases[1:]):
            with self.assertRaises(ValueError):
                reconcile_baseline(changed, records)

    def test_original_failed_positive_stays_blocked(self):
        cases, records = self.control()
        failed = copy.deepcopy(cases)
        failed[0].update(status="BLOQUEADO", tap=["not ok 1 - positive", "ok 2 - negative"])
        evidence = baseline_evidence(failed, records)
        self.assertEqual(evidence[0]["status"], "BLOQUEADO")
        self.assertFalse(evidence[0]["positive"])
        self.assertFalse(evidence[0]["negative"])


if __name__ == "__main__":
    unittest.main()
