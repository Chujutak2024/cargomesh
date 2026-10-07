"""Explicit FK inventory, all-active positives, exact orphans and full rollback.

Ordinary guard suspension requires an observed and explicitly reviewed blocker.
FK, CHECK and deferred triggers are never altered or disabled.
"""

import collections
import csv
import io
import json
import re
import sys

from fk_inventory import V1_CATEGORY, load_inventory, validate_inventory
from fk_orphans import ORPHAN, orphan_mutation


FIXTURE_USER = "d44ffffe-ffff-4fff-8fff-ffffffffffff"
FIXTURE_KEY = "d44ffffd-ffff-4fff-8fff-ffffffffffff"
FIXTURE_ROW = "d44ffffc-ffff-4fff-8fff-ffffffffffff"
V2_CATEGORIES = {"V2_MODELO", "V2_AUXILIAR", "INTERNA_V2_RECEIPTS_GRANTS"}
RECEIPTS = {
    "private.v2_catalog_receipts", "private.v2_facility_command_receipts",
    "private.v2_organization_command_receipts", "private.v2_request_command_receipts",
    "private.v2_workflow_receipts",
}
IDENTITY_TABLES = {
    "public.organization_members", "public.mcp_account_links", "public.carrier_operators",
}

# Suspension is available only after an exact observed writer-guard failure, or
# a demonstrated normalization of the requested orphan. Each retry rolls back.
GUARD_RULES = {
    "workflow_guard": {
        "tables": {
            "asset_status_events", "capacity_consolidations", "carrier_opportunities",
            "execution_events", "incident_updates", "logistics_nodes", "operational_incidents",
            "route_conditions", "route_corridors", "route_planning_policies", "route_plans",
            "route_resource_limits", "scoring_policies", "selection_decisions",
            "transport_plan_candidates", "v2_bookings", "v2_carrier_metrics",
            "v2_carrier_offers", "v2_rankings",
        },
        "errors": [{"state": "PT400", "message": "IMMUTABLE_WORKFLOW_SCOPE"}],
        "normalizes": [],
        "reason": "The ordinary workflow writer guard rejects changed scope before RI triggers inspect the orphan.",
    },
    "resource_binding_leg_guard": {
        "tables": {"plan_resource_bindings"},
        "errors": [
            {"state": "PT400", "message": "IMMUTABLE_RESOURCE_BINDING"},
            {"state": "PT400", "message": "RESOURCE_ASSIGNMENT_MISMATCH"},
        ],
        "normalizes": [],
        "reason": "The ordinary binding writer guard rejects identity or assignment changes before the FK; deferred resource guards remain active.",
    },
    "v2_fleet_command_guard": {
        "tables": {
            "asset_cargo_capabilities", "capacity_calendars", "capacity_pools",
            "cargo_capability_definitions", "repositioning_blocks", "scheduled_maintenances",
            "transport_assets",
        },
        "errors": [
            {"state": "PT400", "message": "INVALID_FLEET_REFERENCE"},
            {"state": "PT400", "message": "IMMUTABLE_FLEET_IDENTITY"},
        ],
        "normalizes": ["carrier_id", "carrier_service_id"],
        "reason": "The ordinary fleet guard derives carrier/service scope or rejects immutable scope before the physical FK.",
    },
    "a_reservation_resource": {
        "tables": {"capacity_reservations"},
        "errors": [{"state": "PT400", "message": "RESOURCE_ASSIGNMENT_MISMATCH"}],
        "normalizes": ["plan_resource_id", "plan_leg_assignment_id"],
        "reason": "The ordinary reservation writer guard derives canonical resource identifiers before RI checks.",
    },
}


def lit(value):
    """Render local fixture values, never connection parameters."""
    if value is None:
        return "null"
    if isinstance(value, (dict, list)):
        value = json.dumps(value, separators=(",", ":"))
    if isinstance(value, bool):
        value = "true" if value else "false"
    return "'" + str(value).replace("'", "''") + "'"


def ident(name):
    if not re.fullmatch(r"[a-z_][a-z0-9_]*", name):
        raise ValueError("Unsupported catalog identifier: " + str(name))
    return '"' + name + '"'


def table_ident(table):
    parts = table.split(".")
    if len(parts) != 2:
        raise ValueError("A schema-qualified table is required")
    return ".".join(ident(part) for part in parts)


def where(row, key):
    return " and ".join(ident(column) + " is not distinct from " + lit(row[column]) for column in key)


def status(positive, negative_state=None, observed=None, expected=None):
    """The positive is a prerequisite; no other diagnostic proves this FK."""
    if not positive:
        return "BLOQUEADO"
    return "PASS" if negative_state == "23503" and observed == expected else "FAIL"


def verdict(cases):
    states = {case["status"] for case in cases}
    return "FAIL" if "FAIL" in states else "BLOQUEADO" if not states or "BLOQUEADO" in states else "PASS"


def guard_candidates(record, catalog):
    """Match explicit reviewed names and ordinary-trigger metadata."""
    candidates = []
    schema, table = record["table"].split(".")
    for trigger in catalog["triggers"]:
        rule = GUARD_RULES.get(trigger["tgname"])
        if not rule or trigger["schema"] != schema or trigger["relation"] != table or table not in rule["tables"]:
            continue
        if trigger["tgisinternal"] or "CONSTRAINT TRIGGER" in trigger["definition"] or "DEFERRABLE" in trigger["definition"]:
            raise ValueError("Reviewed ordinary guard became a constraint/deferred trigger")
        if trigger["tgenabled"] != "O":
            raise ValueError("Reviewed guard is not enabled in the reconstructed catalog")
        candidates.append({"trigger": trigger["tgname"], "errors": rule["errors"],
                           "normalizes": rule["normalizes"], "reason": rule["reason"]})
    return candidates


def paired_fixture(record, data):
    """Find a native reference first; optional fallback keeps a real cohort."""
    children = data[record["table"]]
    parents = [row for row in data[record["referenceTable"]]
               if all(row.get(column) is not None for column in record["referenceColumns"])]
    columns, targets = record["childColumns"], record["referenceColumns"]
    for child in children:
        for parent in parents:
            if all(child.get(a) is not None and child.get(a) == parent.get(b) for a, b in zip(columns, targets)):
                return child, child.copy(), False
    cohort = ("organization_id", "carrier_id", "carrier_service_id")
    for child in children:
        for parent in parents:
            if not all(child.get(key) is None or parent.get(key) is None or child[key] == parent[key] for key in cohort):
                continue
            if record["table"] == record["referenceTable"] and child.get("id") == parent.get("id"):
                continue
            if record["table"] == "public.fulfilment_partners" and "partner_carrier_ref" in columns and parent.get("id") == child.get("carrier_id"):
                continue
            row = child.copy()
            for a, b in zip(columns, targets):
                row[a] = parent[b]
            if record["table"] == "public.capacity_calendars" and "capacity_pool_id" in columns:
                row["transport_asset_id"] = None
            if record["table"] == "public.plan_resources" and "capacity_pool_id" in columns:
                row["asset_id"] = None
            if record["table"] == "public.route_resource_limits" and "combination_id" in columns:
                row["asset_id"] = None
            if record["table"] == "public.mcp_account_links" and "revoked_by_user_id" in columns:
                row.update(status="REVOKED", revoked_at=row["expires_at"])
            return child, row, True
    return None, None, False


def receipt_row(record, data):
    """Isolated receipts use real organization/member aggregate fixtures."""
    for member in data["public.organization_members"]:
        organization = member.get("organization_id")
        if not organization or not any(row.get("id") == organization for row in data["public.organizations"]):
            continue
        row = {"organization_id": organization, "member_id": member["id"],
               "idempotency_key": FIXTURE_KEY, "payload_hash": "0" * 64, "result": {}}
        if record["table"] == "private.v2_facility_command_receipts":
            facility = next((item for item in data["public.facilities"] if item.get("organization_id") == organization), None)
            if not facility:
                continue
            row["facility_id"] = facility["id"]
        if record["table"] == "private.v2_request_command_receipts":
            request = next((item for item in data["public.freight_requests"] if item.get("organization_id") == organization), None)
            if not request:
                continue
            row["request_id"] = request["id"]
        if any(all(existing.get(key) == row[key] for key in ("organization_id", "member_id", "idempotency_key"))
               for existing in data[record["table"]]):
            continue
        return row
    return None


def build_case(record, catalog, data):
    """Create one positive and exact-diagnostic orphan recipe without FK DDL."""
    case = {"constraint": record["constraint"], "table": record["table"],
            "definition": record["definition"], "columns": record["childColumns"],
            "reference": record["referenceTable"] + "(" + ", ".join(record["referenceColumns"]) + ")",
            "category": record["category"], "owner": "HAC-44 / Jean Paul (harness)",
            "domainOwner": "HAC-41 / Axel" if record["table"] in IDENTITY_TABLES else "HAC-40 / Cristhian",
            "ownerLimit": "A failed FK probe alone does not establish a product defect; reproduce before domain escalation.",
            "status": "PENDING", "positive": False, "negative": False,
            "positiveBoundary": "SET CONSTRAINTS ALL IMMEDIATE", "role": "postgres",
            "reason": "", "suspensions": [], "attempts": []}
    table = record["table"]
    column = record["childColumns"][0]
    setup = ""
    if table in RECEIPTS:
        row = receipt_row(record, data)
        case["fixture"] = "isolated receipt INSERT in the per-case rollback subtransaction"
        original = None
    elif table == "private.v2_catalog_grants":
        if any(row.get("id") == FIXTURE_USER for row in data["auth.users"]):
            case.update(status="BLOQUEADO", reason="The isolated local Auth fixture identifier already exists")
            return case
        setup = "insert into auth.users(id) values(" + lit(FIXTURE_USER) + ");"
        if column == "auth_user_id":
            row = {"auth_user_id": FIXTURE_USER, "carrier_id": None, "permission": "CATALOG_ADMIN"}
        else:
            carrier = next(iter(data["public.carriers"]), None)
            row = {"auth_user_id": FIXTURE_USER, "carrier_id": carrier["id"], "permission": "CARRIER_EDITOR"} if carrier else None
        case["fixture"] = "isolated grant INSERT with local Auth id-only fixture; RETURNING ctid; partial UNIQUE unchanged"
        original = None
    else:
        original, row, fallback = paired_fixture(record, data)
        case["fixture"] = "rollback-only optional reference" if fallback else "native persisted reference"
        if fallback and row and table in {
            "public.v2_rankings", "public.execution_events", "public.capacity_consolidations",
        }:
            if any(existing.get("id") == FIXTURE_ROW for existing in data[table]):
                case.update(status="BLOQUEADO", reason="The isolated aggregate fixture identifier already exists")
                return case
            row["id"] = FIXTURE_ROW
            original = None
            case["fixture"] = "isolated aggregate copy INSERT with a compatible optional reference; all ordinary writer guards active"
    if row is None:
        case.update(status="BLOQUEADO", reason="No compatible child/parent fixture with an active positive")
        return case
    keys = {key["schema"] + "." + key["relation"]: key["columns"] for key in catalog["keys"]}
    case["positiveRow"] = {key: row[key] for key in keys.get(table, ("auth_user_id", "carrier_id", "permission"))}
    if original is None:
        good = ("insert into " + table_ident(table) + "(" + ",".join(ident(key) for key in row)
                + ") values(" + ",".join(lit(value) for value in row.values()) + ") returning ctid::text")
    else:
        if table not in keys:
            case.update(status="BLOQUEADO", reason="No reviewed row locator for this table")
            return case
        changed = {key: row[key] for key in record["childColumns"]}
        for key in ("transport_asset_id", "asset_id", "status", "revoked_at"):
            if key in row and row[key] != original.get(key):
                changed[key] = row[key]
        good = ("update " + table_ident(table) + " set "
                + ",".join(ident(key) + "=" + lit(value) for key, value in changed.items())
                + " where " + where(original, keys[table]) + " returning ctid::text")
    fixture_data = data
    if table == "private.v2_catalog_grants":
        fixture_data = {**data, "auth.users": data["auth.users"] + [{"id": FIXTURE_USER}]}
    strategy = orphan_mutation(record, catalog, fixture_data, row)
    case["orphanStrategy"] = strategy
    if not strategy["referenceAbsent"]:
        case.update(status="BLOQUEADO", reason=strategy["reason"])
        return case
    mutation = strategy["mutation"]
    bad = ("update " + table_ident(table) + " set "
           + ",".join(ident(key) + "=" + lit(value) for key, value in mutation.items())
           + " where ctid=$1::tid returning to_jsonb(" + ident(table.split(".")[1]) + ")")
    case["positiveReference"] = {key: row[key] for key in record["childColumns"]}
    case["recipe"] = {"setup": setup, "good": good, "bad": bad, "mutation": mutation,
                      "guards": guard_candidates(record, catalog)}
    return case


CASE_FUNCTION = r"""
create function pg_temp.fk_case(spec jsonb) returns jsonb language plpgsql as $$
declare
    positive boolean := false; negative boolean := false;
    affected integer := 0; bad_affected integer := 0; locator text;
    actual text; state text; message text; actual_row jsonb;
    positive_state text; positive_constraint text; positive_error text;
    positive_row jsonb; positive_reference jsonb; reference_valid boolean := false;
    attempts jsonb := '[]'; suspended jsonb := '[]'; guard jsonb; next_guard jsonb;
    tries integer := 0; expected text := spec->>'constraint'; relation regclass;
begin
    relation := (spec->>'table')::regclass;
    begin
        begin
            if coalesce(spec#>>'{recipe,setup}','')<>'' then
                execute spec#>>'{recipe,setup}';
            end if;
            execute spec#>>'{recipe,good}' into locator;
            get diagnostics affected = row_count;
            set constraints all immediate;
            execute format('select to_jsonb(t) from %s t where ctid=$1::tid',relation)
                into positive_row using locator;
            select jsonb_object_agg(expected.key,positive_row->expected.key)
                into positive_reference from jsonb_each(spec->'positiveReference') expected;
            reference_valid := positive_row is not null and not exists(
                select 1 from jsonb_each(spec->'positiveReference') expected
                where expected.value='null'::jsonb or positive_row->expected.key is distinct from expected.value);
            positive := affected=1 and locator is not null and reference_valid;
            if not positive then positive_error := 'The positive must affect exactly one row with the intended non-null physical reference'; end if;
        exception when others then
            get stacked diagnostics positive_state=returned_sqlstate,
                positive_constraint=constraint_name, positive_error=message_text;
        end;
        if positive then
            loop
                state := null; actual := null; message := null; actual_row := null;
                bad_affected := 0;
                begin
                    for guard in select value from jsonb_array_elements(suspended) loop
                        if not exists(select 1 from pg_trigger where tgrelid=relation
                            and tgname=guard->>'trigger' and not tgisinternal and tgconstraint=0
                            and not tgdeferrable and not tginitdeferred and tgenabled='O') then
                            raise exception 'Reviewed guard is no longer an enabled ordinary trigger';
                        end if;
                        execute format('alter table %s disable trigger %I',relation,guard->>'trigger');
                    end loop;
                    execute spec#>>'{recipe,bad}' into actual_row using locator;
                    get diagnostics bad_affected = row_count;
                    set constraints all immediate;
                    raise exception 'HAC44_NEGATIVE_NO_VIOLATION' using errcode='ZX002';
                exception when others then
                    get stacked diagnostics state=returned_sqlstate, actual=constraint_name, message=message_text;
                end;
                attempts := attempts || jsonb_build_array(jsonb_build_object(
                    'number',tries+1,'observedSqlstate',state,'observedConstraint',actual,
                    'observedMessage',message,'affectedRows',bad_affected,
                    'actualRow',actual_row,'suspended',suspended));
                negative := state='23503' and actual=expected;
                if negative or state='23503' then exit; end if;
                next_guard := null;
                for guard in select value from jsonb_array_elements(spec#>'{recipe,guards}') loop
                    if exists(select 1 from jsonb_array_elements(suspended) used
                        where used->>'trigger'=guard->>'trigger') then continue; end if;
                    if exists(select 1 from jsonb_array_elements(guard->'errors') err
                        where err->>'state'=state and err->>'message'=message)
                        or (state='ZX002' and bad_affected=1 and exists(
                            select 1 from jsonb_array_elements_text(guard->'normalizes') as normalized(column_name)
                            where (spec#>'{recipe,mutation}') ? normalized.column_name
                            and actual_row->normalized.column_name is distinct from
                                (spec#>'{recipe,mutation}')->normalized.column_name)) then
                        next_guard := guard; exit;
                    end if;
                end loop;
                if next_guard is null then exit; end if;
                suspended := suspended || jsonb_build_array(next_guard || jsonb_build_object(
                    'demonstratedByAttempt',tries+1,'blockingSqlstate',state,
                    'blockingMessage',message));
                tries := tries+1;
                if tries>jsonb_array_length(spec#>'{recipe,guards}') then exit; end if;
            end loop;
        end if;
        raise exception 'HAC44_CASE_ROLLBACK' using errcode='ZX001';
    exception when sqlstate 'ZX001' then null;
    end;
    return jsonb_build_object('positive',positive,'negative',negative,
        'positiveAffectedRows',affected,'positiveSqlstate',positive_state,
        'positiveReference',positive_reference,'positiveReferenceVerified',reference_valid,
        'positiveConstraint',positive_constraint,'positiveError',positive_error,
        'observedSqlstate',state,'observedConstraint',actual,'observedMessage',message,
        'attempts',attempts,'suspensions',suspended,
        'guardsEnabledAfterCase',not exists(select 1 from pg_trigger t
            where t.tgrelid=relation and t.tgenabled<>'O' and (t.tgisinternal or t.tgconstraint<>0
                or exists(select 1 from jsonb_array_elements(suspended) g where g->>'trigger'=t.tgname))),
        'status',case when not positive then 'BLOQUEADO' when negative then 'PASS' else 'FAIL' end);
end$$;
"""


def probe_sql(cases):
    query = "begin;\nset local search_path=public,extensions;\n" + CASE_FUNCTION
    for case in cases:
        if case["status"] == "PENDING":
            query += ("select 'HAC44_FK:'||jsonb_build_object('table'," + lit(case["table"])
                      + ",'constraint'," + lit(case["constraint"]) + ",'result',pg_temp.fk_case("
                      + lit(json.dumps(case, separators=(",", ":"))) + "::jsonb))::text;\n")
    return query + "rollback;\n"


def merge_results(cases, output, returncode):
    measured = {}
    for line in output.splitlines():
        if line.startswith("HAC44_FK:"):
            record = json.loads(line.split(":", 1)[1])
            key = record["table"], record["constraint"]
            if key in measured:
                raise ValueError("Duplicate measured FK result")
            measured[key] = record["result"]
    for case in cases:
        if case["status"] != "PENDING":
            continue
        result = measured.get((case["table"], case["constraint"]))
        if not result:
            case.update(status="BLOQUEADO", reason="Missing measured positive/negative result; inspect independent-fk-pairs.log")
            continue
        case.update(result)
        case["positive"] = (result.get("positive") is True and result.get("positiveAffectedRows") == 1
                            and result.get("positiveReferenceVerified") is True)
        case["negative"] = case["positive"] and result.get("observedSqlstate") == "23503" and result.get("observedConstraint") == case["constraint"]
        case["status"] = status(case["positive"], case.get("observedSqlstate"), case.get("observedConstraint"), case["constraint"])
        if case["positive"] and not case.get("guardsEnabledAfterCase"):
            case.update(status="FAIL", reason="An enabled physical constraint or reviewed guard was not restored")
        elif not case["positive"]:
            case["reason"] = case.get("positiveError") or "Positive prerequisite failed"
        elif case["status"] == "FAIL":
            case["reason"] = "Orphan did not fail with SQLSTATE 23503 and the exact expected constraint"
    if returncode:
        for case in cases:
            if case["status"] == "PASS":
                case.update(status="BLOQUEADO", reason="The enclosing SQL transaction did not finish successfully")
    return cases


CSV_FIELDS = ["constraint", "tabla", "referencia", "categoria", "positivo", "negativo",
              "SQLSTATE", "constraint_observado", "estado", "positivo_SQLSTATE",
              "positivo_constraint", "filas_positivo", "dueno", "motivo", "suspensiones",
              "estrategia_huerfano", "dueno_dominio", "limite_dueno"]


def csv_text(cases):
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, CSV_FIELDS, lineterminator="\n")
    writer.writeheader()
    for case in cases:
        writer.writerow({"constraint": case["constraint"], "tabla": case["table"],
            "referencia": case["reference"], "categoria": case["category"],
            "positivo": "PASS" if case.get("positive") else "BLOQUEADO",
            "negativo": "PASS" if case.get("negative") else "BLOQUEADO" if not case.get("positive") else "FAIL",
            "SQLSTATE": case.get("observedSqlstate") or "", "constraint_observado": case.get("observedConstraint") or "",
            "estado": case["status"], "positivo_SQLSTATE": case.get("positiveSqlstate") or "",
            "positivo_constraint": case.get("positiveConstraint") or "", "filas_positivo": case.get("positiveAffectedRows", 0),
            "dueno": case["owner"], "motivo": case.get("reason", ""),
            "suspensiones": json.dumps(case.get("suspensions", []), ensure_ascii=False),
            "estrategia_huerfano": json.dumps(case.get("orphanStrategy", {}), ensure_ascii=False),
            "dueno_dominio": case["domainOwner"], "limite_dueno": case["ownerLimit"]})
    return output.getvalue()


def main():
    from catalog import QUERY
    from common import LOGS, OUT, save, write
    from local import sql

    def read_json(label, query, persist=True):
        result = sql(label, query, persist=persist)
        if result.returncode:
            raise RuntimeError(label + " did not execute; inspect its external log")
        return json.loads(next(line for line in result.stdout.splitlines() if line.startswith(("{", "["))))

    catalog = read_json("fk-catalog-before", QUERY)
    selected = validate_inventory(catalog)
    recorded = json.loads((LOGS / "catalog.json").read_text(encoding="utf-8"))
    if recorded != catalog:
        raise ValueError("The live catalog differs from the reconstructed input; stop instead of inferring scope")
    inventory = load_inventory()
    table_list = read_json("fk-all-table-inventory", "select jsonb_agg(n.nspname||'.'||c.relname order by n.nspname,c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in('r','p') and n.nspname not like 'pg_%' and n.nspname<>'information_schema';")
    counts_query = "select jsonb_object_agg(name,rows) from (" + " union all ".join(
        "select " + lit(table) + " name,count(*) rows from " + table_ident(table) for table in table_list) + ") x;"
    counts_before = read_json("fk-counts-before", counts_query)
    tables = {record["table"] for record in selected} | {record["referenceTable"] for record in selected}
    tables |= {"public.organizations", "public.organization_members", "public.facilities",
               "public.freight_requests", "public.carriers", "auth.users"}
    source_query = "select jsonb_object_agg(name,rows) from (" + " union all ".join(
        "select " + lit(table) + " name,coalesce(jsonb_agg("
        + ("jsonb_build_object('id',id)" if table == "auth.users" else "to_jsonb(t)")
        + "),'[]') rows from " + table_ident(table) + " t" for table in sorted(tables)) + ") x;"
    data = read_json("fk-source-fixtures", source_query, persist=False)
    cases = [build_case(record, catalog, data) for record in selected]
    result = sql("independent-fk-pairs", probe_sql(cases))
    merge_results(cases, result.stdout, result.returncode)
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
        "scope": "Explicit 178+42 V2 FK pairs; all-active ALL IMMEDIATE positives; exact 23503 constraint diagnostics; ordinary guard retry only with observed justification; full rollback; no RLS/business certification",
        "inventory": {"catalog": len(inventory["records"]), "baseline": 178, "newV2": 42, "excludedV1": len(excluded)},
        "tests": sum(int("positiveAffectedRows" in case) + int(bool(case.get("attempts"))) for case in cases),
        "plannedPairs": len(cases), "cases": cases, "excluded": excluded,
        "countsUnchanged": counts_before == counts_after, "catalogUnchanged": catalog == catalog_after})
    save("new-v2-fk-pairs.json", {"status": verdict([case for case in cases if case["category"] in V2_CATEGORIES]),
        "cases": [case for case in cases if case["category"] in V2_CATEGORIES]})
    write(OUT / "HAC-44_fk_220.csv", csv_text(cases))
    write(OUT / "HAC-44_fk_42_V2.csv", csv_text([case for case in cases if case["category"] in V2_CATEGORIES]))
    write(OUT / "HAC-44_fk_40_V1_excluded.csv", "table,constraint,category,reason\n" + "".join(
        ",".join('"' + str(record[key]).replace('"', '""') + '"' for key in ("table", "constraint", "category", "reason"))
        + "\n" for record in excluded))
    print(json.dumps({"status": overall, "selected": len(cases),
        "newV2": dict(collections.Counter(case["status"] for case in cases if case["category"] in V2_CATEGORIES)),
        "all": dict(collections.Counter(case["status"] for case in cases)),
        "countsUnchanged": counts_before == counts_after, "catalogUnchanged": catalog == catalog_after}))
    return {"PASS": 0, "FAIL": 1, "BLOQUEADO": 2}[overall]


if __name__ == "__main__":
    sys.exit(main())
