"""Local orphan vectors: absent tuples, existing components and sibling FK checks.

The snapshot can prove only physical references. CHECKs and guards remain active
in the runner, and SQLSTATE plus the exact constraint decide the measured result.
"""

import itertools

from fk_inventory import definition_parts, qualified


ORPHAN = "d44fffff-ffff-4fff-8fff-ffffffffffff"


def foreign_keys(table, catalog):
    """Read every sibling FK, including excluded scope, without changing it."""
    records = []
    for constraint in catalog.get("constraints", []):
        if constraint.get("contype") != "f":
            continue
        if qualified(constraint["relation"], constraint.get("schema", "public")) != table:
            continue
        columns, target, references = definition_parts(constraint["definition"])
        records.append({"table": table, "constraint": constraint["conname"],
                        "childColumns": columns, "referenceTable": target,
                        "referenceColumns": references, "definition": constraint["definition"]})
    return records


def parent_tuples(record, data):
    rows = data.get(record["referenceTable"])
    if rows is None or any(any(column not in row for column in record["referenceColumns"]) for row in rows):
        return None
    columns = record["referenceColumns"]
    return {tuple(row[column] for column in columns) for row in rows
            if all(column in row and row[column] is not None for column in columns)}


def satisfied(record, row, data):
    """MATCH SIMPLE/FULL null handling is evidence, never an FK bypass."""
    columns = record["childColumns"]
    if any(column not in row for column in columns):
        return False
    values = tuple(row[column] for column in columns)
    if any(value is None for value in values):
        return all(value is None for value in values) if "MATCH FULL" in record["definition"] else True
    parents = parent_tuples(record, data)
    return parents is not None and values in parents


def nullable_columns(table, catalog):
    return {column["column_name"] for column in catalog.get("columns", [])
            if column["table_schema"] + "." + column["table_name"] == table
            and column["is_nullable"] == "YES"}


def isolate_nullable(row, siblings, data, nullable, target_columns):
    """Keep the target nonnull; nullable extra fields may satisfy sibling MATCH SIMPLE."""
    violated = next((record for record in siblings if not satisfied(record, row, data)), None)
    if violated is None:
        return row
    if "MATCH FULL" in violated["definition"]:
        candidates = [violated["childColumns"]]
    else:
        candidates = [[column] for column in violated["childColumns"]]
    for columns in candidates:
        if any(column in target_columns or column not in nullable for column in columns):
            continue
        if not any(row.get(column) is not None for column in columns):
            continue
        changed = row.copy()
        changed.update({column: None for column in columns})
        isolated = isolate_nullable(changed, siblings, data, nullable, target_columns)
        if isolated is not None:
            return isolated
    return None


def existing_component_candidates(record, parents, row):
    """Prefer one changed component, then combinations of observed component values."""
    columns = record["childColumns"]
    values = [sorted({parent[index] for parent in parents}, key=str) for index in range(len(columns))]
    seen = set()
    for index, column in enumerate(columns):
        for value in values[index]:
            candidate = tuple(value if position == index else row.get(key)
                              for position, key in enumerate(columns))
            if candidate not in seen:
                seen.add(candidate)
                yield dict(zip(columns, candidate))
    for candidate in itertools.product(*values):
        if candidate not in seen:
            seen.add(candidate)
            yield dict(zip(columns, candidate))


def orphan_mutation(record, catalog, data, positive_row):
    """Return a verified absent target tuple, with honest sibling-isolation limits.

    ``mutation`` may include additional columns only when the catalog marks them
    nullable. ``otherForeignKeysVerified`` covers snapshot reference integrity;
    it does not predict a SQL PASS or certify CHECKs, triggers or business rules.
    """
    columns = record["childColumns"]
    parents = parent_tuples(record, data)
    if parents is None or any(column not in positive_row for column in columns):
        return {"kind": "unavailable", "mutation": {}, "referenceAbsent": False, "otherForeignKeysVerified": False,
                "reason": "Missing target fixture snapshot or positive FK columns; orphan absence is unverified."}
    all_fks = foreign_keys(record["table"], catalog)
    expected = next((item for item in all_fks if item["constraint"] == record["constraint"]), None)
    if expected is None or any(expected[key] != record[key] for key in (
        "childColumns", "referenceTable", "referenceColumns", "definition",
    )):
        raise ValueError("Target orphan FK does not agree with the measured catalog")
    siblings = [item for item in all_fks if item["constraint"] != record["constraint"]]
    nullable = nullable_columns(record["table"], catalog)

    def evaluate(mutation, kind, explanation):
        changed = {**positive_row, **mutation}
        target = tuple(changed[column] for column in columns)
        if any(value is None for value in target) or target in parents:
            return None
        isolated = isolate_nullable(changed, siblings, data, nullable, set(columns))
        if isolated is None:
            return None
        final = {column: value for column, value in isolated.items()
                 if column not in positive_row or value != positive_row[column]}
        if not final:
            return None
        extra_nulls = sorted(column for column, value in final.items()
                             if column not in columns and value is None)
        if extra_nulls:
            explanation += " Nullable sibling FK fields set to NULL: " + ", ".join(extra_nulls) + "."
        return {"kind": kind, "mutation": final, "referenceAbsent": True, "otherForeignKeysVerified": True,
                "reason": explanation + " All sibling FK references are valid in the fixture snapshot; CHECKs and guards remain runtime controls."}

    # A new identifier cannot collide with a UNIQUE resource assignment. Prefer
    # it only when it is absent and all sibling references can remain valid.
    generic = {columns[0]: ORPHAN}
    candidate = evaluate(generic, "sentinel", "A nonnull sentinel creates an absent target reference.")
    if candidate is not None:
        return candidate
    if len(columns) > 1:
        for mutation in existing_component_candidates(record, parents, positive_row):
            candidate = evaluate(mutation, "existing_components", "The composite reference tuple is absent although its component values exist in the parent snapshot.")
            if candidate is not None:
                return candidate
    changed = {**positive_row, **generic}
    absent = all(changed[column] is not None for column in columns) and tuple(changed[column] for column in columns) not in parents
    violations = [item["constraint"] for item in siblings if not satisfied(item, changed, data)]
    return {"kind": "unisolated_sentinel" if absent else "unavailable", "mutation": generic if absent else {}, "referenceAbsent": absent,
            "otherForeignKeysVerified": False,
            "reason": ("No isolated reference vector exists in the available fixture snapshot; "
                       "the generic sentinel is absent but may be masked by sibling FKs: "
                       + ", ".join(violations) + ". The runtime exact SQLSTATE/constraint decides FAIL or PASS."
                       if absent else "The sentinel target tuple already exists or is nullable; no verified orphan vector is available.")}
