import collections
import hashlib
import html
import json
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

from common import OUT, ROOT, run, save


def plain(s):
    return html.unescape(re.sub(r"<[^>]*>", "", re.sub(r"<br\s*/?>", "\n", s, flags=re.I))).strip()


def parse(path):
    """Extract UML classes, attributes, methods and edges from the reviewed diagram."""
    cells = list(ET.parse(path).getroot().iter("mxCell"))
    classes = []
    for x in cells:
        if "swimlane;" not in x.get("style", ""):
            continue
        name = plain(re.search(r"<b>(.*?)</b>", x.get("value", ""), re.S)[1])
        attrs = []
        methods = []
        for child in cells:
            if child.get("parent") != x.get("id"):
                continue
            for line in plain(child.get("value", "")).splitlines():
                line = line.strip()
                if re.match(r"^[+\-#]?\s*[\w?]+\s*:", line):
                    attrs.append(re.sub(r"^[+\-#]\s*", "", line))
                elif "(" in line:
                    methods.append(line)
        classes.append({"id": x.get("id"), "name": name, "attributes": attrs, "methods": methods})
    names = {x["id"]: x["name"] for x in classes}
    edges = []
    for x in cells:
        if x.get("edge") != "1":
            continue
        edges.append(
            {
                "id": x.get("id"),
                "source": names.get(x.get("source"), x.get("source")),
                "target": names.get(x.get("target"), x.get("target")),
                "label": plain(x.get("value", "")),
                "labels": [
                    {
                        "text": plain(c.get("value", "")),
                        "geometry": (
                            dict(c.find("mxGeometry").attrib)
                            if c.find("mxGeometry") is not None
                            else {}
                        ),
                    }
                    for c in cells
                    if c.get("parent") == x.get("id") and c.get("value")
                ],
            }
        )
    return {
        "classes": classes,
        "relations": edges,
        "counts": {
            "classes": len(classes),
            "attributes": sum(len(x["attributes"]) for x in classes),
            "relations": len(edges),
        },
    }


def splitrow(line):
    parts = []
    buf = ""
    inside = False
    escaped = False
    for char in line.strip("|"):
        if char == "|" and not inside and not escaped:
            parts.append(buf.strip().replace("\\|", "|"))
            buf = ""
        else:
            buf += char
        if char == "`" and not escaped:
            inside = not inside
        escaped = char == "\\" and not escaped
    parts.append(buf.strip().replace("\\|", "|"))
    return parts


def parse_dictionary(text, official, design):
    """Read the flat dictionary and its referenced relations, validating UML 07 exactly."""
    expected = {"classes": 57, "attributes": 397, "relations": 93}
    if official["counts"] != expected:
        raise ValueError(f"UML 07 inventory mismatch: expected {expected}, got {official['counts']}")
    sections = {}
    table = False
    for number, line in enumerate(text.splitlines(), 1):
        if line.startswith("## "):
            table = False
        if line.startswith("| Clase | Atributo UML | Tipo UML | Opcional UML |"):
            table = True
            continue
        if not table or not line.startswith("|") or line.startswith("|---"):
            continue
        parts = splitrow(line)
        if len(parts) != 8 or parts[3] not in ("True", "False"):
            raise ValueError(f"Invalid flat UML dictionary row at line {number}: {parts}")
        name, attr, kind, optional, representation, treatment, owner, operations = parts
        current = sections.setdefault(name, {
            "number": len(sections) + 1, "name": name, "treatment": "Flat UML dictionary",
            "line": number, "attributes": [], "physical": [],
        })
        current["attributes"].append({
            "uml": attr + ("?" if optional == "True" else "") + ": " + kind.replace(" / ", " | "),
            "treatment": treatment, "representation": representation,
            "limit": owner + "; " + operations, "line": number,
        })
    relations = design.get("relations", [])
    counts = {"classes": len(sections),
              "attributes": sum(len(c["attributes"]) for c in sections.values()),
              "relations": len(relations)}
    if counts != expected:
        raise ValueError(f"UML dictionary inventory mismatch: expected {expected}, got {counts}")
    inventory = {c["name"]: c["attributes"] for c in official["classes"]}
    mismatches = [name for name, c in sections.items()
                  if name not in inventory or [a["uml"] for a in c["attributes"]] != inventory[name]]
    if sections.keys() != inventory.keys() or mismatches:
        raise ValueError(f"UML dictionary class/attribute mismatch: {mismatches}; "
                         f"missing={sorted(inventory.keys() - sections.keys())}")
    identity = lambda r: (r["umlId"], r["source"], r["target"], r["label"], tuple(r["endLabels"]))
    actual = collections.Counter(identity(r) for r in relations)
    canonical = collections.Counter((r["id"], r["source"], r["target"], r["label"],
                                     tuple(x["text"] for x in r["labels"]))
                                    for r in official["relations"])
    if actual != canonical:
        raise ValueError("UML dictionary relation mismatch in referenced physical design")
    return list(sections.values()), relations


def main():
    """Run the local evidence checks owned by this script."""
    from local import HEAD
    paths = [
        "docs/v2-amazon/diagrams/review-2026-09-24/07-complete-classes-sprint2-reviewed.drawio",
        "docs/v2-amazon/delivery/HAC27_UML_ATTRIBUTE_DICTIONARY_2026-10-02.md",
        "docs/v2-amazon/delivery/SPRINT2_HAC27_CLASS_DB_API_CONTRACT.md",
        "docs/v2-amazon/models/FULL_MODEL_UML_INVENTORY.json",
        "docs/v2-amazon/models/FULL_MODEL_TARGETS.json",
        "docs/v2-amazon/models/FULL_MODEL_PHYSICAL_DESIGN.json",
        "docs/v2-amazon/models/FULL_MODEL_DER.md",
        "docs/v2-amazon/delivery/HAC40_API_ENDPOINTS.md",
        "docs/v2-amazon/delivery/HAC40_WORKFLOW_API.md",
        "docs/v2-amazon/delivery/HAC40_FULL_API_AND_CLOSURE.md",
    ]
    sources = []
    for path in paths:
        blob = subprocess.run(
            ["git", "show", HEAD + ":" + path], cwd=ROOT, capture_output=True, check=True
        ).stdout
        target = OUT / "repro/sources" / Path(path).name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(blob)
        assert target.read_bytes() == blob
        sources.append({"head": HEAD, "path": path, "sha256": hashlib.sha256(blob).hexdigest()})
    official = parse(OUT / "repro/sources" / Path(paths[0]).name)
    sections, rels = parse_dictionary(
        (OUT / "repro/sources" / Path(paths[1]).name).read_text(encoding="utf-8"),
        official,
        json.loads((OUT / "repro/sources" / "FULL_MODEL_PHYSICAL_DESIGN.json").read_text(encoding="utf-8")),
    )
    new = {x["name"]: x for x in official["classes"]}
    mismatches = [
        {"class": c["name"]}
        for c in sections
        if [x["uml"] for x in c["attributes"]] != new[c["name"]]["attributes"]
    ]
    save(
        "sources.json",
        {
            "sources": sources,
            "official": official,
            "dictionary": sections,
            "relationships": rels,
            "dictionaryMismatch": mismatches,
            "dictionaryCounts": {
                "classes": len(sections),
                "attributes": sum(len(c["attributes"]) for c in sections),
                "relations": len(rels),
            },
            "reuse": (
                "Parser and documentary audit reviewed from hac12-revision-3cf966f and "
                "hac12-revision-9f4f079; no old results "
                "reused"
            ),
        },
    )
    print(
        json.dumps(
            {
                "hash": sources[0]["sha256"],
                "uml": official["counts"],
                "dictionary": {
                    "classes": len(sections),
                    "attributes": sum(len(c["attributes"]) for c in sections),
                    "relations": len(rels),
                },
                "mismatches": mismatches,
            },
            ensure_ascii=False,
        )
    )
    for label, args in [
        ("model-inventory-check", [sys.executable, ROOT / "scripts/check-v2-full-model.py"]),
        ("der-check", [sys.executable, ROOT / "scripts/build-v2-full-der.py", "--check"]),
    ]:
        run(label, args, ROOT)


if __name__ == "__main__":
    main()
