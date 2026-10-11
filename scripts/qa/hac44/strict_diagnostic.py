"""Independent strict measurement when the unchanged base gate blocks the run.

This diagnostic never promotes the integral runner verdict or resumes its cycles.
It uses the same strict builder/probe/merger as the original 45 physical FK cases.
"""
import json
import sys
from catalog import QUERY
from common import OUT, save, write
from local import sql
from fk_inventory import validate_inventory, reconcile_catalog
from fk_strict import V2_CATEGORIES, build_case, probe_sql, merge_results, verdict, lit, table_ident, csv_text


def main():
    def read(label, query, persist=True):
        result = sql(label, query, persist=persist)
        if result.returncode:
            raise RuntimeError("Strict diagnostic prerequisite failed: " + label)
        return json.loads(next(line for line in result.stdout.splitlines() if line.startswith(("{", "["))))

    catalog = read("diagnostic-strict-catalog-before", QUERY)
    selected = [row for row in validate_inventory(catalog) if row["category"] in V2_CATEGORIES]
    tables = {row["table"] for row in selected} | {row["referenceTable"] for row in selected}
    tables |= {"public.organizations", "public.organization_members", "public.carrier_operators",
               "public.carrier_services", "public.facilities", "public.freight_requests", "public.carriers", "auth.users"}
    source_query = "select jsonb_object_agg(name,rows) from (" + " union all ".join(
        "select " + lit(table) + " name,coalesce(jsonb_agg("
        + ("jsonb_build_object('id',id)" if table == "auth.users" else "to_jsonb(t)")
        + "),'[]') rows from " + table_ident(table) + " t" for table in sorted(tables)) + ") x;"
    data = read("diagnostic-strict-fixtures", source_query, persist=False)
    all_tables = read("diagnostic-count-table-list", "select jsonb_agg(n.nspname||'.'||c.relname order by n.nspname,c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in('r','p') and n.nspname not like 'pg_%' and n.nspname<>'information_schema';")
    counts_query = "select jsonb_object_agg(name,rows) from (" + " union all ".join(
        "select " + lit(table) + " name,count(*) rows from " + table_ident(table) for table in all_tables) + ") x;"
    before = read("diagnostic-strict-counts-before", counts_query)
    cases = [build_case(row, catalog, data) for row in selected]
    measured = sql("diagnostic-strict-pairs", probe_sql(cases))
    merge_results(cases, measured.stdout, measured.returncode)
    after = read("diagnostic-strict-counts-after", counts_query)
    catalog_after = read("diagnostic-strict-catalog-after", QUERY)
    if before != after or catalog != catalog_after:
        for case in cases:
            case.update(status="FAIL", reason="Counts or catalog changed despite strict rollback")
    result = {"status": verdict(cases), "scope": "Independent strict diagnostic; integral base gate remains blocked",
              "cases": cases, "countsUnchanged": before == after, "catalogUnchanged": catalog == catalog_after,
              "inventory": reconcile_catalog(catalog), "before": before, "after": after}
    save("strict-diagnostic-pairs.json", result)
    write(OUT / ("HAC-44_fk_" + str(len(cases)) + "_V2_diagnostic.csv"), csv_text(cases))
    print(json.dumps({"status": result["status"], "cases": len(cases),
                      "hac41": {case["constraint"]: case["status"] for case in cases if case["category"].startswith("HAC41_")}}))
    return {"PASS": 0, "FAIL": 1, "BLOQUEADO": 2}[result["status"]]


if __name__ == "__main__":
    sys.exit(main())
