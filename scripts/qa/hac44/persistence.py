"""Verify a persisted BOX positive and reject bodyType=null without a stored row."""

import json
import sys
from common import LOGS, save


def evaluate(calls, data):
    controls = []
    positive = next((c for c in calls if c["label"] == "required-road-positive"), None)
    negative = next((c for c in calls if c["label"] == "required-road-null-bodytype"), None)
    assets = data.get("public.transport_assets")
    result = {"status": "BLOQUEADO", "controls": controls,
              "source": "fk-source-fixtures.log (live local PostgreSQL snapshot, not a mock)"}
    if not positive or positive.get("http") != 201 or not isinstance(assets, list):
        result["reason"] = "Positive creation or physical snapshot prerequisite is missing/failed"
        return result
    identifier = positive.get("response", {}).get("data", {}).get("id")
    rows = [r for r in assets if identifier and r.get("id") == identifier]
    valid = len(rows) == 1 and rows[0].get("body_type") == "BOX"
    controls.append({"label": positive["label"], "status": "PASS" if valid else "FAIL",
                     "http": positive["http"], "id": identifier, "matchedRows": len(rows),
                     "storedBodyType": rows[0].get("body_type") if rows else None})
    if not valid:
        controls.append({"label": "required-road-null-bodytype", "status": "BLOQUEADO",
                         "reason": "BOX creation/persistence positive did not validate"})
        result["status"] = "FAIL"
        return result
    code = negative.get("request", {}).get("code") if negative else None
    if not negative or not code:
        result["reason"] = "Missing negative call or exact synthetic code for absence check"
        return result
    stored = [r for r in assets if r.get("code", r.get("data", {}).get("code")) == code]
    passed = negative.get("http") == 400 and not stored
    controls.append({"label": negative["label"], "status": "PASS" if passed else "FAIL",
                     "http": negative.get("http"), "expected": 400, "code": code, "matchedRows": len(stored)})
    result["status"] = "PASS" if passed else "FAIL"
    result["reason"] = "BOX persisted; null rejected with no matching stored asset" if passed else "Null rejection/absence check failed"
    return result


def main():
    try:
        calls = json.loads((LOGS / "contract-api-results.json").read_text(encoding="utf-8"))
        source = (LOGS / "fk-source-fixtures.log").read_text(encoding="utf-8")
        data = json.loads(next(line for line in source.splitlines() if line.startswith("{")))
        result = evaluate(calls, data)
    except (OSError, ValueError, StopIteration) as error:
        result = {"status": "BLOQUEADO", "reason": "Missing/invalid physical evidence: " + str(error)}
    save("contract-persistence-result.json", result)
    print(json.dumps(result, ensure_ascii=False))
    return {"PASS": 0, "FAIL": 1, "BLOQUEADO": 2}[result["status"]]


if __name__ == "__main__":
    sys.exit(main())
