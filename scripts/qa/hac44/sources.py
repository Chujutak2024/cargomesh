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
from local import HEAD


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


def main():
    """Run the local evidence checks owned by this script."""
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
    sections = []
    current = None
    mode = None
    rels = []
    for number, line in enumerate(
        (OUT / "repro/sources" / Path(paths[1]).name).read_text(encoding="utf-8").splitlines(), 1
    ):
        m = re.match(r"^## (\d+)\. (\w+) — (.+)", line)
        if m:
            current = {
                "number": int(m[1]),
                "name": m[2],
                "treatment": m[3],
                "line": number,
                "attributes": [],
                "physical": [],
            }
            sections.append(current)
            mode = None
        elif line.startswith("| Atributo y tipo UML"):
            mode = "attribute"
        elif line.startswith("| Columna física"):
            mode = "physical"
        elif current and line.startswith("| `"):
            parts = splitrow(line)
            if mode == "attribute" and len(parts) == 4:
                current["attributes"].append(
                    {
                        "uml": parts[0].strip("`"),
                        "treatment": parts[1],
                        "representation": parts[2],
                        "limit": parts[3],
                        "line": number,
                    }
                )
            elif mode == "physical" and len(parts) == 3:
                current["physical"].append(
                    {
                        "column": parts[0].strip("`"),
                        "type": parts[1].strip("`"),
                        "nullable": parts[2],
                        "line": number,
                    }
                )
        m = re.match(r"^\| (\d+) \| `(\w+)` → `(\w+)` \| (.*?) \| (.*?) \|$", line)
        if m:
            rels.append(
                {
                    "number": int(m[1]),
                    "source": m[2],
                    "target": m[3],
                    "label": m[4],
                    "implementation": m[5],
                    "line": number,
                }
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
