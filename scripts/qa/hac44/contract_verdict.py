import json
import sys

from common import LOGS, save

names = [
    "contract-required-field-result.json",
    "contract-route-cardinality-result.json",
    "contract-category-version-result.json",
    "contract-carrier-isolation-result.json",
]
cases = []
for f in names:
    d = json.loads((LOGS / f).read_text(encoding="utf-8"))
    cases.append(
        {
            "case": f,
            "status": d["status"],
            "positive": d.get("positive", d.get("positiveCodeType")),
            "negative": d.get("negative", d.get("actualVersionType")),
        }
    )
    print(json.dumps(cases[-1]))
save(
    "contract-verdict.json",
    {
        "status": (
            "FAIL"
            if any(x["status"] == "FAIL" for x in cases)
            else "BLOQUEADO" if any(x["status"] == "BLOQUEADO" for x in cases) else "PASS"
        ),
        "cases": cases,
    },
)
sys.exit(
    1
    if any(x["status"] == "FAIL" for x in cases)
    else 2 if any(x["status"] == "BLOQUEADO" for x in cases) else 0
)
