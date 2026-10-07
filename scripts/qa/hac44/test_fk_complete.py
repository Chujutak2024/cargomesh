"""Paired regression controls for exact FK evidence without a database."""

import copy
import csv
import io
import json
import unittest

from fk_complete import (CASE_FUNCTION, FIXTURE_USER, ORPHAN, build_case, csv_text,
                         guard_candidates, merge_results, probe_sql, status, verdict)


def record(table="public.children", constraint="child_parent_fk", columns=None,
           parent="public.parents", targets=None):
    columns, targets = columns or ["parent_id"], targets or ["id"]
    return {"table": table, "constraint": constraint, "childColumns": columns,
            "referenceTable": parent, "referenceColumns": targets,
            "definition": "FOREIGN KEY (" + ", ".join(columns) + ") REFERENCES "
                          + parent + "(" + ", ".join(targets) + ")",
            "category": "V2_MODELO", "reason": "Explicit regression fixture"}


def metadata(table="children", columns=None, triggers=None):
    return {"keys": [{"schema": "public", "relation": table, "columns": columns or ["id"]}],
            "triggers": triggers or [], "constraints": [catalog_fk(record())]}


def catalog_fk(fk):
    schema, relation = fk["table"].split(".")
    return {"schema": schema, "relation": relation, "contype": "f",
            "conname": fk["constraint"], "definition": fk["definition"]}


def fixtures():
    return {"public.children": [{"id": "child", "parent_id": "parent"}],
            "public.parents": [{"id": "parent"}]}


def measured(case, **changes):
    result = {"positive": True, "positiveAffectedRows": 1, "negative": True,
              "positiveReferenceVerified": True,
              "observedSqlstate": "23503", "observedConstraint": case["constraint"],
              "guardsEnabledAfterCase": True, "attempts": [{"number": 1}], "suspensions": []}
    result.update(changes)
    return "HAC44_FK:" + json.dumps({"table": case["table"], "constraint": case["constraint"], "result": result})


class ExactDiagnosticTests(unittest.TestCase):
    def positive(self):
        self.assertEqual(status(True, "23503", "expected", "expected"), "PASS")

    def test_failed_positive_blocks_a_matching_negative(self):
        self.positive()
        self.assertEqual(status(False, "23503", "expected", "expected"), "BLOQUEADO")

    def test_wrong_constraint_or_sqlstate_is_fail(self):
        self.positive()
        for state, name in [("23503", "another_fk"), ("23514", "expected"), (None, None), ("PT400", "expected")]:
            self.assertEqual(status(True, state, name, "expected"), "FAIL")

    def test_zero_affected_rows_or_absent_result_never_passes(self):
        good = build_case(record(), metadata(), fixtures())
        merge_results([good], measured(good), 0)
        self.assertEqual(good["status"], "PASS")
        zero = build_case(record(), metadata(), fixtures())
        merge_results([zero], measured(zero, positiveAffectedRows=0), 0)
        self.assertEqual(zero["status"], "BLOQUEADO")
        missing = build_case(record(), metadata(), fixtures())
        merge_results([missing], "", 0)
        self.assertEqual(missing["status"], "BLOQUEADO")

    def test_process_failure_or_unrestored_guards_invalidates_pass(self):
        good = build_case(record(), metadata(), fixtures())
        merge_results([good], measured(good), 0)
        self.assertEqual(good["status"], "PASS")
        for code, changes, expected in [(1, {}, "BLOQUEADO"), (0, {"guardsEnabledAfterCase": False}, "FAIL")]:
            case = build_case(record(), metadata(), fixtures())
            merge_results([case], measured(case, **changes), code)
            self.assertEqual(case["status"], expected)

    def test_wrong_constraint_cannot_hide_behind_reported_pass(self):
        good = build_case(record(), metadata(), fixtures())
        merge_results([good], measured(good), 0)
        self.assertEqual(good["status"], "PASS")
        bad = build_case(record(), metadata(), fixtures())
        merge_results([bad], measured(bad, observedConstraint="other_fk", status="PASS"), 0)
        self.assertEqual(bad["status"], "FAIL")
        self.assertFalse(bad["negative"])

    def test_normalized_or_null_positive_reference_never_passes(self):
        good = build_case(record(), metadata(), fixtures())
        merge_results([good], measured(good), 0)
        self.assertEqual(good["status"], "PASS")
        for verified in (False, None):
            case = build_case(record(), metadata(), fixtures())
            merge_results([case], measured(case, positiveReferenceVerified=verified), 0)
            self.assertEqual(case["status"], "BLOQUEADO")
            self.assertFalse(case["negative"])

    def test_duplicate_results_fail_and_table_identity_is_retained(self):
        good = build_case(record(), metadata(), fixtures())
        line = measured(good)
        merge_results([good], line, 0)
        self.assertEqual(good["status"], "PASS")
        duplicate = build_case(record(), metadata(), fixtures())
        with self.assertRaises(ValueError):
            merge_results([duplicate], line + "\n" + line, 0)

    def test_overall_verdict_keeps_blocked_and_failed_cases(self):
        self.assertEqual(verdict([{"status": "PASS"}]), "PASS")
        self.assertEqual(verdict([{"status": "PASS"}, {"status": "BLOQUEADO"}]), "BLOQUEADO")
        self.assertEqual(verdict([{"status": "BLOQUEADO"}, {"status": "FAIL"}]), "FAIL")
        self.assertEqual(verdict([]), "BLOQUEADO")


class FixtureTests(unittest.TestCase):
    def test_native_positive_is_paired_with_ctid_orphan_and_no_global_bypass(self):
        case = build_case(record(), metadata(), fixtures())
        self.assertEqual(case["status"], "PENDING")
        self.assertIn('"parent_id"=\'parent\'', case["recipe"]["good"])
        self.assertIn("returning ctid::text", case["recipe"]["good"])
        self.assertIn("where ctid=$1::tid", case["recipe"]["bad"])
        self.assertIn(ORPHAN, case["recipe"]["bad"])
        self.assertEqual(case["recipe"]["setup"], "")
        self.assertEqual(case["recipe"]["guards"], [])
        missing = fixtures(); missing["public.parents"] = []
        self.assertEqual(build_case(record(), metadata(), missing)["status"], "BLOQUEADO")

    def test_orphan_collision_is_blocked_with_a_noncolliding_control(self):
        self.assertEqual(build_case(record(), metadata(), fixtures())["status"], "PENDING")
        collision = fixtures(); collision["public.parents"].append({"id": ORPHAN})
        self.assertEqual(build_case(record(), metadata(), collision)["status"], "BLOQUEADO")

    def test_composite_orphan_changes_first_component_not_shared_plan(self):
        fk = record(columns=["resource_id", "plan_id"], targets=["id", "plan_id"])
        data = {"public.children": [{"id": "child", "resource_id": "resource", "plan_id": "plan"}],
                "public.parents": [{"id": "resource", "plan_id": "plan"}]}
        cat = {**metadata(), "constraints": [catalog_fk(fk)]}
        case = build_case(fk, cat, data)
        self.assertEqual(case["status"], "PENDING")
        self.assertEqual(case["recipe"]["mutation"], {"resource_id": ORPHAN})
        data["public.parents"] = []
        self.assertEqual(build_case(fk, cat, data)["status"], "BLOQUEADO")

    def test_empty_facility_receipts_get_real_same_organization_fixture(self):
        fk = record("private.v2_facility_command_receipts", "receipt_facility_fk",
                    ["facility_id", "organization_id"], "public.facilities", ["id", "organization_id"])
        data = {"private.v2_facility_command_receipts": [], "public.facilities": [{"id": "facility", "organization_id": "org-b"}],
                "public.organization_members": [{"id": "member-a", "organization_id": "org-a"}, {"id": "member-b", "organization_id": "org-b"}],
                "public.organizations": [{"id": "org-a"}, {"id": "org-b"}]}
        cat = {"keys": [{"schema": "private", "relation": "v2_facility_command_receipts",
                         "columns": ["organization_id", "member_id", "idempotency_key"]}],
               "triggers": [], "constraints": [catalog_fk(fk)]}
        case = build_case(fk, cat, data)
        self.assertEqual(case["status"], "PENDING")
        self.assertEqual(case["positiveRow"]["organization_id"], "org-b")
        self.assertIn("insert into", case["recipe"]["good"])
        self.assertIn("0" * 64, case["recipe"]["good"])
        data["public.facilities"] = []
        self.assertEqual(build_case(fk, cat, data)["status"], "BLOQUEADO")

    def test_optional_workflow_scope_uses_isolated_positive_insert(self):
        fk = record("public.v2_rankings", "ranking_carrier_fk", ["carrier_id"], "public.carriers")
        data = {"public.v2_rankings": [{"id": "ranking", "carrier_id": None, "status": "MATERIALIZED", "data": {}}],
                "public.carriers": [{"id": "carrier"}]}
        cat = {**metadata("v2_rankings"), "constraints": [catalog_fk(fk)]}
        case = build_case(fk, cat, data)
        self.assertEqual(case["status"], "PENDING")
        self.assertIn('insert into "public"."v2_rankings"', case["recipe"]["good"])
        self.assertNotIn("disable trigger", case["recipe"]["good"])
        data["public.carriers"] = []
        self.assertEqual(build_case(fk, cat, data)["status"], "BLOQUEADO")

    def test_grants_use_real_columns_and_ctid_without_a_primary_key(self):
        data = {"private.v2_catalog_grants": [], "auth.users": [{"id": "real-auth"}],
                "public.carriers": [{"id": "real-carrier"}]}
        cat = {"keys": [], "triggers": [], "constraints": [
            catalog_fk(record("private.v2_catalog_grants", "grant_auth_user_id_fk", ["auth_user_id"], "auth.users")),
            catalog_fk(record("private.v2_catalog_grants", "grant_carrier_id_fk", ["carrier_id"], "public.carriers")),
        ]}
        for column, parent in [("auth_user_id", "auth.users"), ("carrier_id", "public.carriers")]:
            fk = record("private.v2_catalog_grants", "grant_" + column + "_fk", [column], parent)
            case = build_case(fk, cat, data)
            self.assertEqual(case["status"], "PENDING")
            self.assertIn('"auth_user_id"', case["recipe"]["good"])
            self.assertIn('"carrier_id"', case["recipe"]["good"])
            self.assertIn("returning ctid::text", case["recipe"]["good"])
            self.assertIn("where ctid=$1::tid", case["recipe"]["bad"])
            self.assertNotIn("password", case["recipe"]["setup"])
            self.assertTrue(case["orphanStrategy"]["otherForeignKeysVerified"])
            collision = copy.deepcopy(data); collision["auth.users"].append({"id": FIXTURE_USER})
            self.assertEqual(build_case(fk, cat, collision)["status"], "BLOQUEADO")


class BoundaryTests(unittest.TestCase):
    def ordinary(self):
        return {"schema": "public", "relation": "plan_resource_bindings", "tgname": "resource_binding_leg_guard",
                "tgisinternal": False, "tgenabled": "O", "definition": "CREATE TRIGGER resource_binding_leg_guard BEFORE UPDATE"}

    def test_guard_whitelist_rejects_deferred_internal_or_disabled_metadata(self):
        fk = record("public.plan_resource_bindings")
        ordinary = self.ordinary()
        self.assertEqual(len(guard_candidates(fk, {"triggers": [ordinary]})), 1)
        for change in [{"tgisinternal": True}, {"tgenabled": "D"},
                       {"definition": "CREATE CONSTRAINT TRIGGER x DEFERRABLE INITIALLY DEFERRED"}]:
            with self.assertRaises(ValueError):
                guard_candidates(fk, {"triggers": [{**ordinary, **change}]})
        unreviewed = {**ordinary, "tgname": "another_domain_guard"}
        self.assertEqual(guard_candidates(fk, {"triggers": [unreviewed]}), [])

    def test_positive_boundary_precedes_success_and_all_attempts_roll_back(self):
        case = build_case(record(), metadata(), fixtures())
        sql = probe_sql([case]).lower()
        self.assertTrue(sql.startswith("begin;"))
        self.assertTrue(sql.endswith("rollback;\n"))
        self.assertLess(CASE_FUNCTION.index("set constraints all immediate"), CASE_FUNCTION.index("positive := affected=1"))
        self.assertIn("positive_row->expected.key is distinct from expected.value", sql)
        self.assertIn("tgconstraint=0", sql)
        self.assertIn("not tgdeferrable and not tginitdeferred", sql)
        self.assertIn("demonstratedbyattempt", sql)
        self.assertNotIn("alter constraint", sql)
        self.assertNotIn("initially deferred", sql)
        self.assertNotIn("disable trigger all", sql)
        self.assertNotIn("capture_ids", sql)
        blocked = {**case, "status": "BLOQUEADO"}
        self.assertNotIn("select 'hac44_fk:'", probe_sql([blocked]).lower())

    def test_csv_preserves_real_fail_and_blocked_diagnostics(self):
        good = build_case(record(), metadata(), fixtures())
        merge_results([good], measured(good), 0)
        bad = build_case(record(), metadata(), fixtures())
        merge_results([bad], measured(bad, observedConstraint="other_fk"), 0)
        blocked = build_case(record(), metadata(), fixtures())
        merge_results([blocked], measured(blocked, positive=False, positiveAffectedRows=0), 0)
        rows = list(csv.DictReader(io.StringIO(csv_text([good, bad, blocked]))))
        self.assertEqual([row["estado"] for row in rows], ["PASS", "FAIL", "BLOQUEADO"])
        self.assertEqual(rows[1]["SQLSTATE"], "23503")
        self.assertEqual(rows[1]["constraint_observado"], "other_fk")
        self.assertEqual(rows[2]["positivo"], "BLOQUEADO")


if __name__ == "__main__":
    unittest.main()
