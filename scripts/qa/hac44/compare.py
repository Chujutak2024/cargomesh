"""Compare classifications with CP-1; report every semantic change explicitly."""

import collections
import json
import os
from pathlib import Path

from common import LOGS, save
from normalized_compare import compare_matrices


def main():
    """Run the local evidence checks owned by this script."""
    baseline = Path(os.environ["HAC44_CP1"]).resolve()
    changes = []
    same = {}
    counts = {}
    specs = {
        "classes": ("class-matrix.json", ("clase",)),
        "attributes": ("attribute-matrix.json", ("clase", "atributo")),
        "relations": ("relationship-matrix.json", ("numero",)),
        "endpoints": ("endpoint-matrix.json", ("method", "path")),
    }
    for kind, (file, cols) in specs.items():
        before = json.loads((baseline / "logs" / file).read_text(encoding="utf-8"))
        after = json.loads((LOGS / file).read_text(encoding="utf-8"))
        key = lambda row: tuple(row[c] for c in cols)
        b = {key(x): x for x in before}
        a = {key(x): x for x in after}
        assert set(a) == set(b)
        counts[kind] = {
            "before": dict(collections.Counter(x["estado"] for x in before)),
            "after": dict(collections.Counter(x["estado"] for x in after)),
        }
        same[kind] = 0
        for identity, row in a.items():
            old = b[identity]
            if old["estado"] == row["estado"]:
                same[kind] += 1
            else:
                changes.append(
                    {
                        "kind": kind,
                        "key": list(identity),
                        "before": old["estado"],
                        "after": row["estado"],
                        "evidence": row.get(
                            "evidencia",
                            row.get("evidencia_roundtrip", row.get("evidencia_semantica")),
                        ),
                    }
                )
                assert old["estado"] == "PARCIAL" and row["estado"] in ("COMPLETO", "IMPLEMENTADO")
    fkBefore = json.loads(
        (baseline / "logs/independent-fk-pairs.json").read_text(encoding="utf-8")
    )["cases"]
    fkAfter = json.loads((LOGS / "independent-fk-pairs.json").read_text(encoding="utf-8"))["cases"]
    b = {x["constraint"]: x for x in fkBefore}
    a = {x["constraint"]: x for x in fkAfter}
    assert set(a) == set(b)
    fkChanges = [
        {"constraint": k, "before": b[k]["status"], "after": a[k]["status"], "tap": a[k].get("tap")}
        for k in a
        if a[k]["status"] != b[k]["status"]
    ]
    assert all(x["before"] == "BLOQUEADO" and x["after"] == "PASS" for x in fkChanges)
    counts["fk"] = {
        "before": dict(collections.Counter(x["status"] for x in fkBefore)),
        "after": dict(collections.Counter(x["status"] for x in fkAfter)),
    }
    save(
        "cp1-comparison.json",
        {
            "status": "PASS",
            "classificationChanges": changes,
            "fkPromotions": fkChanges,
            "unchanged": same,
            "counts": counts,
            "limit": (
                "Evidence UUIDs, call counts, SHA, provenance and the new method map are "
                "regenerated; classification equality is checked by stable UML/route/FK "
                "keys."
            ),
        },
    )
    print(
        "PASS exact CP1 classifications: "
        + str(len(changes))
        + " matrix promotions; "
        + str(len(fkChanges))
        + " FK promotions"
    )
    if os.environ.get("HAC44_CP2"):
        compare_matrices(Path(os.environ["HAC44_CP2"]).resolve())


if __name__ == "__main__":
    main()
