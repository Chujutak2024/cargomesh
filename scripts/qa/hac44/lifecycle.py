"""Seed/verify/counts/cleanup only the dedicated local HAC44 scenario."""

import json
import sys

from common import OUT, ROOT, run, save, write
from local import DB, HEAD, script, sql, BANK

SCENARIO = ROOT / "supabase/scenarios/v2-full-flow-qa"
DATASET = OUT / "dataset"


def seed():
    """Create the synthetic dataset and record its explicit identifiers."""
    p = script("full-flow-seed", SCENARIO / "seed.sql")
    assert p.returncode == 0
    for marker, name in [("HAC44_REFS:", "refs.json"), ("HAC44_LTL_REFS:", "ltl-refs.json")]:
        rows = [line[len(marker) :] for line in p.stdout.splitlines() if line.startswith(marker)]
        assert len(rows) == 1, (marker, len(rows))
        write(DATASET / name, json.dumps(json.loads(rows[0]), ensure_ascii=False, indent=2) + "\n")
    write(
        DATASET / "workflow-seed.sql",
        (SCENARIO / "workflow-seed.sql").read_text(encoding="utf-8-sig"),
    )
    save(
        "full-flow-seed-result.json",
        {
            "status": "PASS",
            "head": HEAD,
            "roots": "d440-d44f",
            "nativeIds": "external refs.json / ltl-refs.json + exact registry",
            "credentials": "LOCAL_ONLY_AUTH_PLACEHOLDER, no passwords or persisted tokens",
        },
    )


def verify():
    """Verify the local dataset with its native positive controls."""
    p = script("full-flow-verify", SCENARIO / "verify.sql")
    assert p.returncode == 0 and "PASS HAC44" in p.stdout
    counts = json.loads(
        next(
            l.split("HAC44_COUNTS:", 1)[1]
            for l in p.stdout.splitlines()
            if l.startswith("HAC44_COUNTS:")
        )
    )
    save("full-flow-counts.json", counts)
    p = sql(
        "explicit-id-registry",
        (
            "select jsonb_agg(jsonb_build_object('table',relation,'key',key) order by "
            "relation,key) from hac44_qa.ids where "
            "run_id=hac44_qa.current_run();"
        ),
    )
    assert p.returncode == 0
    save("full-flow-explicit-ids.json", json.loads(p.stdout))
    print("PASS full-flow canonical seed verified")


def cleanup():
    """Back up the dataset and remove only its registered exact identifiers."""
    BANK.own("cleanup")
    assert script("counts-before-cleanup", SCENARIO / "counts.sql").returncode == 0
    # Back up scenario rows without Auth credentials; incoming FK audit lives in cleanup.sql.
    backup = run(
        "full-flow-backup",
        [
            "docker",
            "exec",
            DB,
            "pg_dump",
            "-U",
            "postgres",
            "--data-only",
            "--schema=public",
            "--schema=private",
            "--schema=hac44_qa",
            "postgres",
        ],
    )
    assert backup.returncode == 0
    write(OUT / "backups/full-flow-before-cleanup.sql", backup.stdout)
    auth = sql(
        "auth-placeholder-backup",
        (
            "select jsonb_agg(jsonb_build_object('id',id,'email',email,'role',role,"
            "'fixture',raw_app_meta_data->>'fixture','created_at',created_at)) from "
            "auth.users where id in('d4410000-0000-4000-8000-000000000001',"
            "'d4410000-0000-4000-8000-000000000002',"
            "'d4410000-0000-4000-8000-000000000003');"
        ),
    )
    assert auth.returncode == 0
    write(OUT / "backups/auth-local-placeholder-allowlist.json", auth.stdout)
    p = script("full-flow-cleanup", SCENARIO / "cleanup.sql", backup=True)
    assert p.returncode == 0

    def marker(prefix):
        return json.loads(
            next(l[len(prefix) :] for l in p.stdout.splitlines() if l.startswith(prefix))
        )

    before = marker("HAC44_BEFORE:")
    after = marker("HAC44_AFTER:")
    assert sum(after.values()) == 0 and before.get("auth.users") == 3
    save(
        "full-flow-cleanup-result.json",
        {
            "status": "PASS",
            "before": before,
            "after": after,
            "removedRows": sum(before.values()),
            "remainingRows": sum(after.values()),
            "tables": len(after),
            "baselineRestored": True,
            "triggersRestored": True,
        },
    )
    print(
        "PASS full-flow cleanup "
        + str(sum(before.values()))
        + "→0 rows, unchanged baseline/triggers"
    )


if __name__ == "__main__":
    {"seed": seed, "verify": verify, "cleanup": cleanup}[sys.argv[1]]()
