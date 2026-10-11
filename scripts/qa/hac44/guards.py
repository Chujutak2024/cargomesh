"""Prove the local_only boundary with a positive connection/control per denial."""

from common import ROOT, save
from local import script, sql


def main():
    """Run the local evidence checks owned by this script."""
    scenario = ROOT / "supabase/scenarios/v2-full-flow-qa"
    results = []
    for name in ("seed.sql", "verify.sql", "cleanup.sql", "counts.sql"):
        positive = script("guard-positive-" + name, scenario / "counts.sql")
        assert positive.returncode == 0 and "HAC44_COUNTS:" in positive.stdout
        negative = sql(
            "guard-negative-" + name,
            "\\set local_only 0\n" + (scenario / name).read_text(encoding="utf-8-sig"),
            persist=False,
        )
        assert negative.returncode != 0 and "LOCAL_ONLY" in negative.stderr
        results.append(
            {
                "script": name,
                "status": "PASS",
                "positiveExit": positive.returncode,
                "negativeExit": negative.returncode,
                "positive": "Same bank + valid local_only count operation",
                "negative": "Fails before any write or include",
            }
        )
    save("local-only-guards.json", results)
    source = (scenario / "control.sql").read_text(encoding="utf-8-sig")
    positive = sql("uuid-collision-positive", "begin;" + source + "rollback;", persist=False)
    assert positive.returncode == 0
    negative = sql(
        "uuid-collision-negative",
        (
            "begin;insert into public.organizations(id,code,name,status,"
            "default_currency) values('d4400000-0000-4000-8000-00000000ffff',"
            "'HAC44_COLLISION_CONTROL','LOCAL_ONLY collision control','ACTIVE',"
            "'USD');"
        )
        + source,
        persist=False,
    )
    assert negative.returncode != 0 and "HAC44_UUID_COLLISION" in negative.stderr
    save(
        "uuid-collision-guard.json",
        {
            "status": "PASS",
            "positiveExit": positive.returncode,
            "negativeExit": negative.returncode,
            "fixture": "Explicit synthetic org ID; aborted transaction auto-rolls back; no DELETE",
        },
    )


if __name__ == "__main__":
    main()
