"""Explicit, versioned HAC-44 FK scope; reject catalog drift before any probe."""

import hashlib
import json
import re
from pathlib import Path


ORIGIN_SHA = "776b5da4225045cbf68a35706423dce0684ea793"
V1_CATEGORY = "V1_HEREDADA_BASELINE"
# Frozen from the authorized clean catalog and the separately delivered 82-FK
# classification. Reasons may improve; identities and physical scope may not drift.
GROUP_DIGESTS = {
    "baseline": "9a3eb962f8c21926ec0455c1489f5b222843ed5b9a0adda68f6c3b57d637f5f9",
    "new": "738c069d54668a56ff186e9885edec0ff70c4bffbbb0d302f105654fe42ab109",
    "excluded": "4119cfd156b75ae8c61b7caabba35a76a8477a49bb482ce7e4ef48296a7f4b0f",
}


def load_inventory(path=None):
    """Read the committed list; an optional path supports independent regressions."""
    path = Path(path) if path is not None else Path(__file__).with_name("fk_inventory.json")
    return json.loads(path.read_text(encoding="utf-8-sig"))


def qualified(relation, schema="public"):
    """Normalize regclass names without changing their schema or table identity."""
    if not isinstance(relation, str) or not relation:
        raise ValueError("Missing FK relation identity")
    return relation if "." in relation else schema + "." + relation


def definition_parts(definition):
    """Read ordered physical columns, rather than guessing an id or primary key."""
    match = re.match(
        r"^FOREIGN KEY \(([^)]+)\) REFERENCES ([\w.]+)\(([^)]+)\)(?: |$)",
        definition,
    )
    if not match:
        raise ValueError("Unsupported physical FK definition: " + definition)
    return (
        [column.strip().strip('"') for column in match[1].split(",")],
        qualified(match[2]),
        [column.strip().strip('"') for column in match[3].split(",")],
    )


def identity(record):
    """Constraint names alone need not be unique across PostgreSQL relations."""
    return record["table"], record["constraint"]


def group_records(records):
    return {
        "baseline": [row for row in records if row["category"] == "BASELINE_178"],
        "new": [row for row in records if row["category"] not in ("BASELINE_178", V1_CATEGORY)],
        "excluded": [row for row in records if row["category"] == V1_CATEGORY],
    }


def group_digest(records):
    fields = (
        "table", "constraint", "childColumns", "referenceTable", "referenceColumns",
        "definition", "category",
    )
    physical = [{key: row[key] for key in fields} for row in sorted(records, key=identity)]
    encoded = json.dumps(physical, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def validate_inventory(catalog, inventory=None):
    """Select explicit authorized identities only when the measured catalog agrees."""
    inventory = load_inventory() if inventory is None else inventory
    if inventory.get("schemaVersion") != 1 or inventory.get("originSha") != ORIGIN_SHA:
        raise ValueError("Inventory format or authorized origin SHA changed")
    records = inventory.get("records")
    if not isinstance(records, list) or not all(isinstance(row, dict) for row in records):
        raise ValueError("Inventory records must be explicit FK objects")
    required = {
        "table", "constraint", "childColumns", "referenceTable", "referenceColumns",
        "definition", "category", "reason",
    }
    for row in records:
        if not required.issubset(row):
            raise ValueError("Incomplete FK inventory record")
        if not all(isinstance(row[key], str) and row[key].strip() for key in (
            "table", "constraint", "referenceTable", "definition", "category", "reason",
        )):
            raise ValueError("FK identity, category and reason must be nonempty strings")
        if "." not in row["table"] or "." not in row["referenceTable"]:
            raise ValueError("Inventory FK tables must be schema-qualified")
        for key in ("childColumns", "referenceColumns"):
            values = row[key]
            if (not isinstance(values, list) or not values
                    or not all(isinstance(value, str) and value for value in values)
                    or len(set(values)) != len(values)):
                raise ValueError("FK columns must be an ordered nonempty list without duplicates")
        if len(row["childColumns"]) != len(row["referenceColumns"]):
            raise ValueError("FK child and reference arity differ")
        if definition_parts(row["definition"]) != (
            row["childColumns"], row["referenceTable"], row["referenceColumns"],
        ):
            raise ValueError("Inventory physical FK metadata contradicts its definition")
    expected = {identity(row): row for row in records}
    if len(expected) != len(records):
        raise ValueError("Duplicate FK identity in the explicit inventory")
    for name, group in group_records(records).items():
        if group_digest(group) != GROUP_DIGESTS[name]:
            raise ValueError("Frozen FK scope changed: " + name)
    actual = {}
    for constraint in catalog.get("constraints", []):
        if constraint.get("contype") != "f":
            continue
        table = qualified(constraint["relation"], constraint.get("schema", "public"))
        key = table, constraint["conname"]
        if key in actual:
            raise ValueError("Duplicate FK identity in the measured catalog")
        actual[key] = constraint
    if set(actual) != set(expected):
        missing = sorted(set(expected) - set(actual))
        unexpected = sorted(set(actual) - set(expected))
        raise ValueError("FK catalog inventory drift; missing=" + repr(missing)
                         + "; unexpected=" + repr(unexpected))
    for key, row in expected.items():
        constraint = actual[key]
        if constraint["definition"] != row["definition"]:
            raise ValueError("Physical FK definition changed: " + repr(key))
        if definition_parts(constraint["definition"]) != (
            row["childColumns"], row["referenceTable"], row["referenceColumns"],
        ):
            raise ValueError("Physical FK columns or reference changed: " + repr(key))
        if qualified(constraint["target"]) != row["referenceTable"]:
            raise ValueError("Catalog reference table contradicts the FK definition: " + repr(key))
    return [row for row in records if row["category"] != V1_CATEGORY]
