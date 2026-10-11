"""Current endpoint inventory grows from sources; missing routes retain evidence."""

import ast
import json
import re
import tempfile
import unittest
from pathlib import Path


class EndpointInventoryTests(unittest.TestCase):
    def exercise(self, documented, runtime, records):
        source = Path(__file__).with_name("matrix.py").read_text(encoding="utf-8")
        fn = next(n for n in ast.parse(source).body if isinstance(n, ast.FunctionDef) and n.name == "endpoints")
        with tempfile.TemporaryDirectory() as folder:
            out = Path(folder); logs = out / "logs"; logs.mkdir()
            docs = out / "repro/sources"; docs.mkdir(parents=True)
            (docs / "HAC40_API_ENDPOINTS.md").write_text("\n".join(
                f"| {r['method']} | `{r['path']}` |" for r in documented), encoding="utf-8")
            (logs / "routes-runtime.json").write_text(json.dumps(runtime), encoding="utf-8")
            (logs / "api-results.json").write_text(json.dumps(records), encoding="utf-8")
            saved = {}
            context = {"LOGS": logs, "OUT": out, "json": json, "re": re, "jsonstr": json.dumps,
                       "save": lambda name, data: saved.update({name: data}), "csvwrite": lambda *_: None}
            exec(compile(ast.Module(body=[fn], type_ignores=[]), "endpoint-matrix", "exec"), context)
            return context["endpoints"](), saved

    def control(self):
        routes = [{"method": "GET", "path": "/api/v2/example"}]
        calls = [{"method": "GET", "path": "/example", "actor": actor, "http": http,
                  "status": "PASS", "authMechanism": "literal-fixture-Bearer" if actor else "anonymous",
                  "label": "functional-positive" if actor else "anonymous-negative"}
                 for actor, http in [(1, 200), (0, 401)]]
        rows, _ = self.exercise(routes, routes, calls)
        self.assertEqual(rows[0]["estado"], "IMPLEMENTADO")
        return routes, calls

    def test_new_source_route_is_discovered_without_editing_a_counter(self):
        routes, calls = self.control()
        new = {"method": "POST", "path": "/api/v2/example/:id/association"}
        records = calls + [{"method": "POST", "path": "/example/real-id/association",
                            "status": "PASS", "authMechanism": "literal-fixture-Bearer" if actor else "anonymous",
                            "actor": actor, "http": http, "label": "association-control"}
                           for actor, http in [(1, 200), (0, 401)]]
        rows, delta = self.exercise(routes + [new], routes + [new], records)
        self.assertEqual([r["path"] for r in rows], [r["path"] for r in routes + [new]])
        self.assertTrue(all(r["estado"] == "IMPLEMENTADO" for r in rows))
        self.assertFalse(delta["endpoint-documentary-delta.json"]["missingFromCode"])
        missing, _ = self.exercise(routes + [new], routes, records)
        self.assertEqual(missing[-1]["estado"], "FALTANTE")

    def test_parameter_alias_is_reconciled_but_a_distinct_url_stays_missing(self):
        routes, calls = self.control()
        documented = {"method": "POST", "path": "/api/v2/example/:assignmentId/link"}
        runtime = {"method": "POST", "path": "/api/v2/example/:parentId/link"}
        records = calls + [{"method": "POST", "path": "/example/real-id/link",
                            "status": "PASS", "authMechanism": "literal-fixture-Bearer" if actor else "anonymous",
                            "actor": actor, "http": http, "label": "link-control"}
                           for actor, http in [(1, 200), (0, 401)]]
        rows, saved = self.exercise(routes + [documented], routes + [runtime], records)
        self.assertEqual(rows[-1]["estado"], "IMPLEMENTADO")
        self.assertEqual(saved["endpoint-documentary-delta.json"]["parameterAliases"], [
            {"method": "POST", "documentedPath": documented["path"], "runtimePath": runtime["path"]}])
        missing, _ = self.exercise(routes + [documented], routes + [{**runtime, "path": runtime["path"] + "/other"}], records)
        self.assertEqual(missing[-1]["estado"], "FALTANTE")

    def test_authentication_or_probe_alone_cannot_certify_functionality(self):
        routes, calls = self.control()
        for records in ([calls[1]], [{**calls[0], "label": "inventory-probe"}, calls[1]],
                        [{**calls[0], "label": "proposal-route-presence-probe"}, calls[1]],
                        [{**calls[0], "status": "OBSERVED"}, calls[1]], [{**calls[0], "status": "FAIL"}, calls[1]]):
            rows, _ = self.exercise(routes, routes, records)
            self.assertEqual(rows[0]["estado"], "PARCIAL")

    def test_invalid_bearer_401_cannot_replace_a_failed_anonymous_control(self):
        routes, calls = self.control()
        invalid_bearer = {**calls[1], "authMechanism": "explicit-invalid-Bearer", "label": "invalid-credential-auth-negative"}
        rows, _ = self.exercise(routes, routes, [calls[0], invalid_bearer])
        self.assertEqual(rows[0]["estado"], "PARCIAL")
        self.assertEqual(rows[0]["anon_401"], 0)

    def test_duplicate_or_empty_documentary_inventory_is_rejected(self):
        routes, calls = self.control()
        for documented in ([], routes + routes):
            with self.assertRaises(AssertionError):
                self.exercise(documented, routes, calls)


if __name__ == "__main__":
    unittest.main()
