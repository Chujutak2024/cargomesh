"""Native recipe for the previously partial HTTP routes."""

import json
import time

from common import OUT, ROOT, write
from local import sql

if __name__ == "__main__":
    refs = {}
    for suffix in ("primary", "second"):
        source = (ROOT / "supabase/scenarios/v2-full-flow-qa/workflow-seed.sql").read_text(
            encoding="utf-8-sig"
        )
        tag = str(time.time_ns())
        source = (
            source.replace("HAC44_WORKFLOW_QA", "HAC44_PENDING_" + tag)
            .replace("QA-001", "HAC44-PENDING-" + tag)
            .replace("QA-1", "HAC44-PENDING-" + tag)
        )
        p = sql("pending-native-seed-" + suffix, source)
        assert p.returncode == 0
        data = json.loads(
            next(
                l.split("HAC44_REFS:", 1)[1]
                for l in p.stdout.splitlines()
                if l.startswith("HAC44_REFS:")
            )
        )
        if suffix == "primary":
            refs = data
        else:
            refs["second"] = data
    source = (ROOT / "supabase/scenarios/v2-full-flow-qa/ltl-seed.sql").read_text(
        encoding="utf-8-sig"
    )
    source = "begin;\n" + source[source.index("create extension if not exists pgtap") :]
    tag = str(time.time_ns())
    source = (
        source.replace("FLEET_QA", "HAC44_PENDING_LTL_" + tag)
        .replace("HAC44_LTL_QA", "HAC44_PENDING_LTL_" + tag)
        .replace("HAC44-LTL-001", "HAC44-PENDING-" + tag)
        .replace("HAC44-LTL-1", "HAC44-PENDING-" + tag)
    )
    p = sql("pending-native-seed-ltl", source)
    assert p.returncode == 0
    refs["ltl"] = json.loads(
        next(
            l.split("HAC44_LTL_REFS:", 1)[1]
            for l in p.stdout.splitlines()
            if l.startswith("HAC44_LTL_REFS:")
        )
    )
    write(OUT / "dataset/pending-refs.json", json.dumps(refs, ensure_ascii=False, indent=2) + "\n")
