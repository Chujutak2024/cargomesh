"""Regression controls for current verdicts, completion and missing evidence."""
import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
import run as runner


class RunnerTests(unittest.TestCase):
    def exercise(self, defect=None):
        with tempfile.TemporaryDirectory(prefix="hac44-run-unit-") as folder:
            out = Path(folder)
            number = 0
            def execute(_label, args, **_kwargs):
                nonlocal number
                number += 1
                key = (Path(args[3]).name, *args[4:])
                code = 0
                for name in runner.ARTIFACTS.get(key, []):
                    rows = [{"case": case, "status": "PASS"} for case in sorted(runner.CONTRACT_CASES)] if name == "contract-verdict.json" else [{"label": "valid-positive", "status": "PASS"}]
                    if defect == "contract" and name == "contract-verdict.json":
                        rows[0]["status"] = "FAIL"  # A current failure, unrelated to the old three-case set.
                    if defect == "blocked" and name == "contract-verdict.json":
                        rows[0]["status"] = "BLOQUEADO"
                    if defect == "http" and name == "extended-api-results.json":
                        rows += [{"label": "extended-plans-create", "status": "FAIL", "http": 500, "expected": 201},
                                 {"label": "extended-calendars-list", "status": "FAIL", "http": 409, "expected": 200}]
                    if defect == "missing" and name == "contract-verdict.json":
                        continue
                    if defect == "incomplete" and name == "contract-verdict.json":
                        rows.pop()
                    if defect == "invalid-after-fail" and name == "contract-verdict.json":
                        rows[0]["status"] = "FAIL"
                        rows[1]["status"] = "UNKNOWN"
                    payload = {"status": runner.verdict(r["status"] for r in rows), "cases": rows, "generation": number} if name == "contract-verdict.json" else rows
                    (out / "logs" / name).write_text(json.dumps(payload), encoding="utf-8")
                if defect == "command" and key == ("persistence.py",): code = 1
                if defect == "setup" and key == ("gates.py",): code = 1
                if defect == "baseline" and key == ("fk_coverage.py",): code = 3
                return SimpleNamespace(returncode=code)
            result = runner.Runner(out, execute)
            with contextlib.redirect_stdout(io.StringIO()):
                code = result.all()
            measured = json.loads((out / "logs/runner-results.json").read_text(encoding="utf-8"))
            return code, measured, result.completed

    def positive(self):
        code, data, cycles = self.exercise()
        self.assertEqual(code, 0)
        self.assertEqual(data["status"], "PASS")
        self.assertEqual(len(cycles), 2)
        self.assertTrue(all(c["cleanup"]["status"] == "PASS" for c in cycles))
        self.assertEqual(data["commands"][-2]["script"], "generate.py")
        self.assertEqual(data["commands"][-1]["script"], "checks.py")
        return data

    def test_current_all_pass_needs_no_historical_failures(self):
        self.positive()

    def test_contract_fail_keeps_nonzero_exit_and_completes(self):
        self.positive()
        code, data, cycles = self.exercise("contract")
        self.assertEqual(code, 1)
        self.assertEqual(data["status"], "FAIL")
        self.assertTrue(any(c["source"] == "contract-verdict.json" and c["status"] == "FAIL" for c in data["cases"]))
        self.assertTrue(all(c["cleanup"]["status"] == "PASS" for c in cycles))
        self.assertEqual(data["commands"][-1]["script"], "checks.py")

    def test_http_product_failures_are_reported_even_when_child_exits_zero(self):
        self.positive()
        code, data, _ = self.exercise("http")
        self.assertEqual(code, 1)
        failures = [c for c in data["cases"] if c.get("http") in [500, 409]]
        self.assertTrue(failures)
        self.assertTrue(all(c["status"] == "FAIL" for c in failures))

    def test_blocked_measurement_never_passes(self):
        self.positive()
        code, data, _ = self.exercise("blocked")
        self.assertEqual(code, 2)
        self.assertEqual(data["status"], "BLOQUEADO")

    def test_missing_or_incomplete_contract_evidence_never_passes(self):
        self.positive()
        for defect in ["missing", "incomplete"]:
            with self.subTest(defect=defect):
                code, data, _ = self.exercise(defect)
                self.assertEqual(code, 2)
                self.assertEqual(data["status"], "BLOQUEADO")

    def test_invalid_case_does_not_hide_an_observed_fail(self):
        self.positive()
        code, data, _ = self.exercise("invalid-after-fail")
        self.assertEqual(code, 1)
        self.assertTrue(any(c["status"] == "FAIL" for c in data["cases"]))

    def test_failed_subprocess_does_not_skip_cleanup_or_final_checks(self):
        self.positive()
        code, data, cycles = self.exercise("command")
        self.assertEqual(code, 1)
        self.assertTrue(all(c["cleanup"]["status"] == "PASS" for c in cycles))
        self.assertEqual(data["commands"][-1]["script"], "checks.py")

    def test_failed_setup_blocks_dependent_writes(self):
        self.positive()
        code, data, _ = self.exercise("setup")
        self.assertEqual(code, 1)
        self.assertTrue(all(c["exit"] is None for c in data["commands"] if c["script"] == "lifecycle.py"))

    def test_failed_original_baseline_stops_after_cleanup(self):
        self.positive()
        code, data, cycles = self.exercise("baseline")
        self.assertEqual(code, 1)
        self.assertEqual(len(cycles), 1)
        self.assertEqual(cycles[0]["cleanup"]["status"], "PASS")
        self.assertEqual(data["commands"][-1]["script"], "lifecycle.py")
        self.assertEqual(data["commands"][-1]["args"], ["cleanup"])
        self.assertFalse(any(c["script"] in ("persistence.py", "matrix.py", "generate.py", "checks.py")
                             for c in data["commands"]))

    def test_stale_success_is_not_reused(self):
        self.positive()
        with tempfile.TemporaryDirectory(prefix="hac44-run-stale-") as folder:
            result = runner.Runner(folder, lambda *_args, **_kwargs: SimpleNamespace(returncode=0))
            (result.logs / "contract-verdict.json").write_text(json.dumps({"status": "PASS", "cases": [
                {"case": name, "status": "PASS"} for name in runner.CONTRACT_CASES]}), encoding="utf-8")
            with contextlib.redirect_stdout(io.StringIO()):
                row = result.child("contract_verdict.py")
            self.assertEqual(row["status"], "BLOQUEADO")
            self.assertEqual(result.snapshot()["exit"], 2)


if __name__ == "__main__":
    unittest.main()
