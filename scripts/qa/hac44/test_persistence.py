"""A rejected negative is certified only after a real persisted BOX control."""
import copy
import unittest
from persistence import evaluate


class PersistenceTests(unittest.TestCase):
    def fixtures(self):
        calls = [{"label": "required-road-positive", "http": 201, "response": {"data": {"id": "positive"}}},
                 {"label": "required-road-null-bodytype", "http": 400, "request": {"code": "exact-negative"}, "response": {}}]
        data = {"public.transport_assets": [{"id": "positive", "body_type": "BOX", "code": "positive-code"}]}
        self.assertEqual(evaluate(calls, data)["status"], "PASS")
        return copy.deepcopy(calls), copy.deepcopy(data)

    def test_400_and_persisted_positive_pass(self):
        calls, data = self.fixtures()
        result = evaluate(calls, data)
        self.assertEqual([r["status"] for r in result["controls"]], ["PASS", "PASS"])
        self.assertEqual(result["controls"][0]["storedBodyType"], "BOX")
        self.assertEqual(result["controls"][1]["matchedRows"], 0)

    def test_201_null_negative_remains_fail(self):
        calls, data = self.fixtures()
        calls[1]["http"] = 201
        data["public.transport_assets"].append({"id": "bad", "body_type": None, "code": "exact-negative"})
        self.assertEqual(evaluate(calls, data)["status"], "FAIL")

    def test_400_with_stored_negative_remains_fail(self):
        calls, data = self.fixtures()
        data["public.transport_assets"].append({"id": "bad", "body_type": None, "code": "exact-negative"})
        self.assertEqual(evaluate(calls, data)["status"], "FAIL")

    def test_failed_positive_blocks_negative(self):
        calls, data = self.fixtures()
        calls[0]["http"] = 500
        self.assertEqual(evaluate(calls, data)["status"], "BLOQUEADO")

    def test_unpersisted_or_wrong_positive_does_not_certify_absence(self):
        calls, data = self.fixtures()
        for assets in [[], [{"id": "positive", "body_type": None}]]:
            with self.subTest(assets=assets):
                result = evaluate(calls, {"public.transport_assets": assets})
                self.assertEqual(result["status"], "FAIL")
                self.assertEqual(result["controls"][-1]["status"], "BLOQUEADO")

    def test_missing_negative_identity_or_snapshot_blocks(self):
        calls, data = self.fixtures()
        calls[1]["request"] = {}
        self.assertEqual(evaluate(calls, data)["status"], "BLOQUEADO")
        self.assertEqual(evaluate(calls, {})["status"], "BLOQUEADO")


if __name__ == "__main__":
    unittest.main()
