"""Paired controls for absent tuples without disabling physical constraints."""

import copy
import unittest

from fk_orphans import ORPHAN, foreign_keys, orphan_mutation, satisfied


def fk(name, columns, parent, targets=None, match=""):
    targets = targets or ["id"]
    return {"table": "public.children", "constraint": name, "childColumns": columns,
            "referenceTable": "public." + parent, "referenceColumns": targets,
            "definition": "FOREIGN KEY (" + ", ".join(columns) + ") REFERENCES "
                          + "public." + parent + "(" + ", ".join(targets) + ")" + match}


def catalog(records, nullable=()):
    return {"constraints": [{"schema": "public", "relation": "children", "contype": "f",
                             "conname": item["constraint"], "definition": item["definition"]}
                            for item in records],
            "columns": [{"table_schema": "public", "table_name": "children",
                         "column_name": column, "is_nullable": "YES"} for column in nullable]}


def components():
    records = [fk("assignment_scope_fk", ["assignment_id", "plan_id"], "assignments", ["id", "plan_id"]),
               fk("assignment_fk", ["assignment_id"], "assignments"),
               fk("plan_fk", ["plan_id"], "plans")]
    row = {"id": "child", "assignment_id": "assignment-a", "plan_id": "plan-a"}
    data = {"public.assignments": [{"id": "assignment-a", "plan_id": "plan-a"},
                                   {"id": "assignment-b", "plan_id": "plan-b"}],
            "public.plans": [{"id": "plan-a"}, {"id": "plan-b"}]}
    return records, row, data


class OrphanVectorTests(unittest.TestCase):
    def positive(self, records, row, data):
        for record in records:
            self.assertTrue(satisfied(record, row, data), record["constraint"])

    def test_composite_absent_tuple_keeps_each_existing_component_and_sibling(self):
        records, row, data = components()
        self.positive(records, row, data)
        before = copy.deepcopy((row, data))
        vector = orphan_mutation(records[0], catalog(records), data, row)
        changed = {**row, **vector["mutation"]}
        self.assertEqual(vector["kind"], "existing_components")
        self.assertTrue(vector["referenceAbsent"])
        self.assertTrue(vector["otherForeignKeysVerified"])
        self.assertFalse(satisfied(records[0], changed, data))
        self.positive(records[1:], changed, data)
        self.assertNotIn(ORPHAN, vector["mutation"].values())
        for index, column in enumerate(records[0]["childColumns"]):
            self.assertIn(changed[column], {parent[records[0]["referenceColumns"][index]]
                                            for parent in data["public.assignments"]})
        self.assertEqual((row, data), before)

    def test_complete_parent_grid_reports_unisolated_sentinel_instead_of_false_proof(self):
        records, row, data = components()
        data["public.assignments"] += [{"id": "assignment-a", "plan_id": "plan-b"},
                                       {"id": "assignment-b", "plan_id": "plan-a"}]
        self.positive(records, row, data)
        vector = orphan_mutation(records[0], catalog(records), data, row)
        changed = {**row, **vector["mutation"]}
        self.assertEqual(vector["kind"], "unisolated_sentinel")
        self.assertTrue(vector["referenceAbsent"])
        self.assertFalse(vector["otherForeignKeysVerified"])
        self.assertFalse(satisfied(records[0], changed, data))
        self.assertFalse(satisfied(records[1], changed, data))
        self.assertIn("assignment_fk", vector["reason"])

    def test_isolated_sentinel_avoids_existing_resource_unique_collision(self):
        records = [fk("resource_plan_fk", ["resource_id", "plan_id"], "resources", ["id", "plan_id"]),
                   fk("plan_fk", ["plan_id"], "plans")]
        row = {"id": "binding-a", "resource_id": "resource-a", "plan_id": "plan-a"}
        other = {"id": "binding-b", "resource_id": "resource-b", "plan_id": "plan-b"}
        data = {"public.resources": [{"id": "resource-a", "plan_id": "plan-a"},
                                     {"id": "resource-b", "plan_id": "plan-b"}],
                "public.plans": [{"id": "plan-a"}, {"id": "plan-b"}],
                "public.children": [row, other]}
        cat = catalog(records)
        cat["constraints"].append({"schema": "public", "relation": "children", "contype": "u",
                                   "conname": "resource_binding_resource_unique",
                                   "definition": "UNIQUE (resource_id)"})
        self.positive(records, row, data)
        self.positive(records, other, data)
        self.assertEqual(len({item["resource_id"] for item in data["public.children"]}), 2)
        colliding = {**row, "resource_id": other["resource_id"]}
        self.assertFalse(satisfied(records[0], colliding, data))
        self.positive(records[1:], colliding, data)
        self.assertEqual(colliding["resource_id"], other["resource_id"])
        vector = orphan_mutation(records[0], cat, data, row)
        changed = {**row, **vector["mutation"]}
        self.assertEqual(vector["kind"], "sentinel")
        self.assertEqual(vector["mutation"], {"resource_id": ORPHAN})
        self.assertTrue(vector["referenceAbsent"])
        self.assertTrue(vector["otherForeignKeysVerified"])
        self.assertFalse(satisfied(records[0], changed, data))
        self.positive(records[1:], changed, data)
        self.assertNotEqual(changed["resource_id"], other["resource_id"])
        self.assertEqual(cat["constraints"][-1]["definition"], "UNIQUE (resource_id)")

    def nullable_fixture(self, match=""):
        records = [fk("carrier_fk", ["carrier_id"], "carriers"),
                   fk("service_scope_fk", ["service_id", "carrier_id"], "services", ["id", "carrier_id"], match)]
        row = {"carrier_id": "carrier-a", "service_id": "service-a"}
        data = {"public.carriers": [{"id": "carrier-a"}],
                "public.services": [{"id": "service-a", "carrier_id": "carrier-a"}]}
        return records, row, data

    def test_only_catalog_nullable_extra_column_can_isolate_simple_sibling(self):
        records, row, data = self.nullable_fixture()
        self.positive(records, row, data)
        vector = orphan_mutation(records[0], catalog(records, ["service_id"]), data, row)
        changed = {**row, **vector["mutation"]}
        self.assertEqual(vector["mutation"], {"carrier_id": ORPHAN, "service_id": None})
        self.assertTrue(vector["otherForeignKeysVerified"])
        self.assertFalse(satisfied(records[0], changed, data))
        self.positive(records[1:], changed, data)
        self.assertIn("service_id", vector["reason"])
        forbidden = orphan_mutation(records[0], catalog(records), data, row)
        self.assertEqual(forbidden["mutation"], {"carrier_id": ORPHAN})
        self.assertFalse(forbidden["otherForeignKeysVerified"])

    def test_match_full_cannot_null_only_extra_column_or_the_target(self):
        records, row, data = self.nullable_fixture(" MATCH FULL")
        self.positive(records, row, data)
        vector = orphan_mutation(records[0], catalog(records, ["service_id", "carrier_id"]), data, row)
        self.assertEqual(vector["mutation"], {"carrier_id": ORPHAN})
        self.assertFalse(vector["otherForeignKeysVerified"])
        self.assertFalse(satisfied(records[1], {**row, "service_id": None}, data))
        self.assertTrue(satisfied(records[1], {"carrier_id": None, "service_id": None}, data))

    def test_sentinel_collision_is_unavailable_with_a_noncolliding_control(self):
        record = fk("parent_fk", ["parent_id"], "parents")
        row, data = {"parent_id": "parent"}, {"public.parents": [{"id": "parent"}]}
        self.positive([record], row, data)
        self.assertTrue(orphan_mutation(record, catalog([record]), data, row)["referenceAbsent"])
        collision = {"public.parents": data["public.parents"] + [{"id": ORPHAN}]}
        vector = orphan_mutation(record, catalog([record]), collision, row)
        self.assertFalse(vector["referenceAbsent"])
        self.assertEqual(vector["mutation"], {})

    def test_missing_snapshot_or_projection_is_unverified_with_valid_control(self):
        record = fk("parent_fk", ["parent_id"], "parents")
        row, data = {"parent_id": "parent"}, {"public.parents": [{"id": "parent"}]}
        self.positive([record], row, data)
        self.assertTrue(orphan_mutation(record, catalog([record]), data, row)["referenceAbsent"])
        for incomplete in ({}, {"public.parents": [{"other": "parent"}]}):
            vector = orphan_mutation(record, catalog([record]), incomplete, row)
            self.assertFalse(vector["referenceAbsent"])
            self.assertEqual(vector["mutation"], {})
        missing_column = orphan_mutation(record, catalog([record]), data, {})
        self.assertFalse(missing_column["referenceAbsent"])

    def test_catalog_target_mismatch_is_rejected_after_same_catalog_positive(self):
        records, row, data = components()
        self.positive(records, row, data)
        self.assertTrue(orphan_mutation(records[0], catalog(records), data, row)["referenceAbsent"])
        mismatched = {**records[0], "referenceColumns": ["plan_id", "id"]}
        with self.assertRaises(ValueError):
            orphan_mutation(mismatched, catalog(records), data, row)
        with self.assertRaises(ValueError):
            orphan_mutation(records[0], catalog(records[1:]), data, row)

    def test_all_catalog_siblings_are_checked_without_scope_filter(self):
        records, row, data = components()
        self.positive(records, row, data)
        all_fks = foreign_keys("public.children", catalog(records))
        self.assertEqual({item["constraint"] for item in all_fks}, {item["constraint"] for item in records})
        missing_sibling = {**data}; missing_sibling.pop("public.plans")
        vector = orphan_mutation(records[0], catalog(records), missing_sibling, row)
        self.assertFalse(vector["otherForeignKeysVerified"])
        self.assertIn("plan_fk", vector["reason"])


if __name__ == "__main__":
    unittest.main()
