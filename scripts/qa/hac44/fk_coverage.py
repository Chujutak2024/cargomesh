"""Reconcile the catalog and combine separately executed baseline/strict evidence."""
import collections
import json
import hashlib
import sys
from pathlib import Path
from fk_inventory import V1_CATEGORY, identity, load_inventory, validate_inventory
from fk_strict import (BASELINE_METHOD, STRICT_METHOD, V2_CATEGORIES, build_case,
                       csv_text, lit, merge_results, probe_sql, table_ident, verdict)


def without_strict_exclusion(source):
    return source.replace("from fk_baseline_scope import STRICT_FK_IDENTITIES\n", "", 1).replace(
        ' and (tab, c["conname"]) not in STRICT_FK_IDENTITIES', "", 1)


def verify_baseline_source():
    from common import OUT, run, save, write
    original = run("baseline-source-776b5da", ["git", "show", "776b5da:scripts/qa/hac44/fk_complete.py"])
    current = Path(__file__).with_name("fk_complete.py").read_text(encoding="utf-8")
    if original.returncode or without_strict_exclusion(current) != original.stdout:
        raise ValueError("The original baseline changed beyond the explicit strict exclusion")
    diff = run("baseline-diff-776b5da", ["git", "diff", "776b5da", "--", "scripts/qa/hac44/fk_complete.py"])
    if diff.returncode:
        raise RuntimeError("Cannot measure the baseline diff")
    write(OUT / "repro/baseline-vs-776b5da.patch", diff.stdout)
    save("baseline-method-provenance.json", {"status": "PASS", "source": "776b5da",
        "onlyChange": "Explicit strict-identity exclusion from selection",
        "logicUnchanged": True, "sourceSha256": hashlib.sha256(original.stdout.encode()).hexdigest(),
        "restoredSourceSha256": hashlib.sha256(without_strict_exclusion(current).encode()).hexdigest()})


def reconcile_baseline(cases, records):
    actual = [identity(c) for c in cases]
    expected = {identity(r) for r in records}
    if len(actual) != len(set(actual)) or set(actual) != expected:
        raise ValueError("The base selection does not equal the explicit baseline inventory")


def baseline_evidence(cases, records):
    reconcile_baseline(cases, records)
    indexed = {identity(r): r for r in records}
    result = []
    for case in cases:
        record = indexed[identity(case)]
        pair = case.get("tap", [])
        result.append({**case, "method": BASELINE_METHOD, "category": record["category"],
            "reference": record["referenceTable"] + "(" + ", ".join(record["referenceColumns"]) + ")",
            "positive": bool(pair and pair[0].startswith("ok ")),
            "negative": bool(len(pair) == 2 and all(s.startswith("ok ") for s in pair)),
            "owner": "HAC-44 / Jean Paul (harness)", "domainOwner": "See the owning domain contract",
            "ownerLimit": "Original base physical test; does not certify business rules",
            "role": "postgres", "positiveBoundary": "Original base TAP positive; immediate sibling FKs",
            "diagnosticSource": "Original TAP pair; exact constraint checked inside pg_temp.fk_case"})
    return result


def main():
    from catalog import QUERY
    from common import LOGS, OUT, save, write
    from local import sql
    from common import run
    verify_baseline_source()

    def read_json(label, query, persist=True):
        result = sql(label, query, persist=persist)
        if result.returncode:
            raise RuntimeError(label + " did not execute; inspect its external log")
        return json.loads(next(line for line in result.stdout.splitlines() if line.startswith(("{", "["))))

    catalog = read_json("fk-catalog-before", QUERY)
    selected = validate_inventory(catalog)
    baseline_records = [r for r in selected if r["category"] == "BASELINE_178"]
    strict_records = [r for r in selected if r["category"] in V2_CATEGORIES]
    recorded = json.loads((LOGS / "catalog.json").read_text(encoding="utf-8"))
    if recorded != catalog:
        raise ValueError("The live catalog differs from the reconstructed input; stop instead of inferring scope")
    inventory = load_inventory()
    table_list = read_json("fk-all-table-inventory", "select jsonb_agg(n.nspname||'.'||c.relname order by n.nspname,c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in('r','p') and n.nspname not like 'pg_%' and n.nspname<>'information_schema';")
    counts_query = "select jsonb_object_agg(name,rows) from (" + " union all ".join(
        "select " + lit(table) + " name,count(*) rows from " + table_ident(table) for table in table_list) + ") x;"
    capture = sql("fk-register-explicit-ids", "select hac44_qa.capture_ids();")
    if capture.returncode:
        raise RuntimeError("Cannot capture the explicit cleanup registry")
    counts_before = read_json("fk-counts-before", counts_query)
    baseline_run = run("fk-baseline", [sys.executable, "-X", "utf8", Path(__file__).with_name("fk_complete.py")])
    baseline = json.loads((LOGS / "independent-fk-pairs.json").read_text(encoding="utf-8"))
    reconcile_baseline(baseline["cases"], baseline_records)
    save("baseline-fk-pairs.json", {**baseline, "method": BASELINE_METHOD, "source": "776b5da", "exit": baseline_run.returncode})
    baseline_failed = baseline_run.returncode != 0 or baseline["status"] != "PASS"
    baseline_cases = baseline_evidence(baseline["cases"], baseline_records)
    tables = {record["table"] for record in strict_records} | {record["referenceTable"] for record in strict_records}
    tables |= {"public.organizations", "public.organization_members", "public.facilities",
               "public.freight_requests", "public.carriers", "auth.users"}
    source_query = "select jsonb_object_agg(name,rows) from (" + " union all ".join(
        "select " + lit(table) + " name,coalesce(jsonb_agg("
        + ("jsonb_build_object('id',id)" if table == "auth.users" else "to_jsonb(t)")
        + "),'[]') rows from " + table_ident(table) + " t" for table in sorted(tables)) + ") x;"
    data = read_json("fk-source-fixtures", source_query, persist=False)
    strict_cases = []
    if not baseline_failed:
        strict_cases = [build_case(record, catalog, data) for record in strict_records]
        result = sql("strict-fk-pairs", probe_sql(strict_cases))
        merge_results(strict_cases, result.stdout, result.returncode)
    cases = baseline_cases + strict_cases
    counts_after = read_json("fk-counts-after", counts_query)
    catalog_after = read_json("fk-catalog-after", QUERY)
    if counts_before != counts_after or catalog != catalog_after:
        for case in cases:
            case.update(status="FAIL", reason="Rows or catalog changed despite the rollback boundary")
    excluded = [record for record in inventory["records"] if record["category"] == V1_CATEGORY]
    save("fk-cleanliness.json", {"before": counts_before, "after": counts_after,
        "countsUnchanged": counts_before == counts_after, "catalogUnchanged": catalog == catalog_after,
        "tables": len(table_list), "transaction": "ROLLBACK",
        "catalogScope": "public/private constraints, indexes, functions, triggers, policies and grants"})
    overall = verdict(cases)
    save("independent-fk-pairs.json", {"status": overall,
        "scope": "776b5da baseline code with strict identities excluded: rollback-only non-internal trigger suspension and sibling FK deferral; V2 additions use authenticated invoker with temporary owner writes and ALL IMMEDIATE after return; exact 23503 constraint diagnostics; observed ordinary-guard retries only after valid positive; full rollback; no RLS/business certification",
        "inventory": {"catalog": len(inventory["records"]), "baseline": sum(case["method"] == BASELINE_METHOD for case in cases), "newV2": sum(case["method"] == STRICT_METHOD for case in cases), "excludedV1": len(excluded)},
        "tests": baseline["tests"] + sum(int("positiveAffectedRows" in case) + int(bool(case.get("attempts"))) for case in strict_cases),
        "plannedPairs": len(cases), "cases": cases, "excluded": excluded,
        "countsUnchanged": counts_before == counts_after, "catalogUnchanged": catalog == catalog_after})
    save("new-v2-fk-pairs.json", {"status": verdict([case for case in cases if case["category"] in V2_CATEGORIES]),
        "cases": [case for case in cases if case["category"] in V2_CATEGORIES]})
    write(OUT / f"HAC-44_fk_{len(cases)}.csv", csv_text(cases))
    write(OUT / f"HAC-44_fk_{sum(case['method'] == STRICT_METHOD for case in cases)}_V2.csv", csv_text([case for case in cases if case["category"] in V2_CATEGORIES]))
    write(OUT / f"HAC-44_fk_{len(excluded)}_V1_excluded.csv", "table,constraint,category,reason\n" + "".join(
        ",".join('"' + str(record[key]).replace('"', '""') + '"' for key in ("table", "constraint", "category", "reason"))
        + "\n" for record in excluded))
    print(json.dumps({"status": overall, "selected": len(cases),
        "newV2": dict(collections.Counter(case["status"] for case in cases if case["category"] in V2_CATEGORIES)),
        "all": dict(collections.Counter(case["status"] for case in cases)),
        "countsUnchanged": counts_before == counts_after, "catalogUnchanged": catalog == catalog_after}))
    return 3 if baseline_failed else {"PASS": 0, "FAIL": 1, "BLOQUEADO": 2}[overall]


if __name__ == "__main__":
    sys.exit(main())
