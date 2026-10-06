"""Cross-check the two HTTP bodyType controls against the physical FK snapshot."""

import json

from common import LOGS, save


def main():
    """Run the local evidence checks owned by this script."""
    calls = json.loads((LOGS / "contract-api-results.json").read_text(encoding="utf-8"))
    source = (LOGS / "fk-source-fixtures.log").read_text(encoding="utf-8")
    data = json.loads(next(line for line in source.splitlines() if line.startswith("{")))
    pairs = []
    for label, expected in [
        ("required-road-positive", "BOX"),
        ("required-road-null-bodytype", None),
    ]:
        call = next(x for x in calls if x["label"] == label)
        assert call["http"] == 201
        identifier = call["response"]["data"]["id"]
        row = next(x for x in data["public.transport_assets"] if x["id"] == identifier)
        assert row["body_type"] == expected
        pairs.append(
            {
                "label": label,
                "id": identifier,
                "http": call["http"],
                "storedBodyType": row["body_type"],
                "physicalSnapshotControl": "PASS",
            }
        )
    save(
        "contract-persistence-result.json",
        {
            "status": "FAIL",
            "reason": "Required bodyType accepts and persists NULL; BOX positive persists too",
            "controls": pairs,
            "source": "fk-source-fixtures.log (live local PostgreSQL snapshot, not a mock)",
        },
    )
    print("PASS both persistence controls; retained product contract remains FAIL")


if __name__ == "__main__":
    main()
