"""Paired regressions for strict diagnostics and preserved baseline method."""

import unittest

from fk_strict import build_case, merge_results, probe_sql
from fk_strict import BASELINE_METHOD, STRICT_METHOD
from test_fk_complete import fixtures, measured, metadata, record


class StrictTests(unittest.TestCase):
    def control(self):
        case = build_case(record(), metadata(), fixtures())
        self.assertEqual(case["method"], STRICT_METHOD)
        merge_results([case], measured(case), 0)
        self.assertEqual(case["status"], "PASS")
        return case

    def test_both_authenticated_boundary_measurements_are_required(self):
        self.control()
        for key in ("positiveRoleBeforeConstraints", "positiveRoleAfterConstraints"):
            for role in ("postgres", None):
                case = build_case(record(), metadata(), fixtures())
                merge_results([case], measured(case, **{key: role}), 0)
                self.assertEqual(case["status"], "BLOQUEADO")
                self.assertFalse(case["negative"])

    def test_baseline_and_v1_cannot_enter_the_strict_module(self):
        self.control()
        for category in ("BASELINE_178", "V1_HEREDADA_BASELINE"):
            with self.assertRaises(ValueError):
                build_case({**record(), "category": category}, metadata(), fixtures())
        case = build_case(record(), metadata(), fixtures())
        source = probe_sql([case])
        self.assertIn("'result',pg_temp.fk_strict_case(", source)
        self.assertNotIn("'result',pg_temp.fk_case(", source)
        self.assertIn("set local role authenticated", source)
        self.assertIn('set local "request.jwt.claims"', source)


if __name__ == "__main__":
    unittest.main()
