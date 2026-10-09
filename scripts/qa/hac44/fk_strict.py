"""Physical FK probes with an authenticated caller through deferred evaluation.

Temporary owner helpers perform physical writes (production tables intentionally
revoke direct client writes). The invoker evaluates queued constraints after the
helper returns, exactly as after a SECURITY DEFINER production command. This is
physical integrity evidence, not certification of a production RPC or RLS.
"""

STRICT_METHOD = "authenticated-deferred-exact-fk"
BASELINE_METHOD = "existing-postgres-exact-fk"

STRICT_FUNCTION = r"""
create function pg_temp.fk_owner_write(spec jsonb, negative boolean, locator text,
    suspended jsonb) returns jsonb language plpgsql security definer as $$
declare target regclass; row_value jsonb; affected integer; guard jsonb;
begin
    target := (spec->>'table')::regclass;
    if not negative then
        if coalesce(spec#>>'{recipe,setup}','')<>'' then
            execute spec#>>'{recipe,setup}';
        end if;
        execute spec#>>'{recipe,good}' into locator;
        get diagnostics affected = row_count;
        execute format('select to_jsonb(t) from %s t where ctid=$1::tid',target)
            into row_value using locator;
    else
        for guard in select value from jsonb_array_elements(suspended) loop
            if not exists(select 1 from pg_trigger where tgrelid=target
                and tgname=guard->>'trigger' and not tgisinternal and tgconstraint=0
                and not tgdeferrable and not tginitdeferred and tgenabled='O') then
                raise exception 'Reviewed guard is no longer an enabled ordinary trigger';
            end if;
            execute format('alter table %s disable trigger %I',target,guard->>'trigger');
        end loop;
        execute spec#>>'{recipe,bad}' into row_value using locator;
        get diagnostics affected = row_count;
    end if;
    return jsonb_build_object('locator',locator,'row',row_value,'affected',affected);
end$$;
create function pg_temp.fk_strict_case(spec jsonb) returns jsonb language plpgsql as $$
declare
    positive boolean := false; negative boolean := false; reference_valid boolean := false;
    result jsonb; row_value jsonb; locator text; affected integer := 0;
    state text; actual text; message text; positive_state text; positive_error text;
    positive_constraint text; role_before text; role_after text;
    attempts jsonb := '[]'; suspended jsonb := '[]'; guard jsonb; next_guard jsonb;
    bad_affected integer := 0; tries integer := 0; expected text := spec->>'constraint';
begin
    begin
        begin
            role_before := current_user;
            if role_before<>'authenticated' or
                current_setting('request.jwt.claims',true)::jsonb->>'role'<>'authenticated' then
                raise exception 'Strict positive requires authenticated and JWT claims';
            end if;
            result := pg_temp.fk_owner_write(spec,false,null,'[]');
            affected := (result->>'affected')::integer;
            locator := result->>'locator'; row_value := result->'row';
            set constraints all immediate;
            role_after := current_user;
            if role_after<>'authenticated' then raise exception 'Caller role changed at ALL IMMEDIATE'; end if;
            reference_valid := row_value is not null and not exists(
                select 1 from jsonb_each(spec->'positiveReference') e
                where e.value='null'::jsonb or row_value->e.key is distinct from e.value);
            positive := affected=1 and locator is not null and reference_valid;
            if not positive then positive_error := 'Positive must affect one row with the intended non-null reference'; end if;
        exception when others then
            get stacked diagnostics positive_state=returned_sqlstate,
                positive_constraint=constraint_name,positive_error=message_text;
        end;
        if positive then
            loop
                state := null; actual := null; message := null; row_value := null; bad_affected := 0;
                begin
                    result := pg_temp.fk_owner_write(spec,true,locator,suspended);
                    bad_affected := (result->>'affected')::integer; row_value := result->'row';
                    set constraints all immediate;
                    if current_user<>'authenticated' then raise exception 'Negative caller role changed'; end if;
                    raise exception 'HAC44_NEGATIVE_NO_VIOLATION' using errcode='ZX002';
                exception when others then
                    get stacked diagnostics state=returned_sqlstate,actual=constraint_name,message=message_text;
                end;
                attempts := attempts || jsonb_build_array(jsonb_build_object(
                    'number',tries+1,'observedSqlstate',state,'observedConstraint',actual,
                    'observedMessage',message,'affectedRows',bad_affected,'actualRow',row_value,'suspended',suspended));
                negative := state='23503' and actual=expected;
                if negative or state='23503' then exit; end if;
                next_guard := null;
                for guard in select value from jsonb_array_elements(spec#>'{recipe,guards}') loop
                    if exists(select 1 from jsonb_array_elements(suspended) used
                        where used->>'trigger'=guard->>'trigger') then continue; end if;
                    if exists(select 1 from jsonb_array_elements(guard->'errors') err
                        where err->>'state'=state and err->>'message'=message)
                        or (state='ZX002' and bad_affected=1 and exists(
                            select 1 from jsonb_array_elements_text(guard->'normalizes') n(column_name)
                            where (spec#>'{recipe,mutation}') ? n.column_name
                            and row_value->n.column_name is distinct from (spec#>'{recipe,mutation}')->n.column_name)) then
                        next_guard := guard; exit;
                    end if;
                end loop;
                if next_guard is null then exit; end if;
                suspended := suspended || jsonb_build_array(next_guard || jsonb_build_object(
                    'demonstratedByAttempt',tries+1,'blockingSqlstate',state,'blockingMessage',message));
                tries := tries+1;
                if tries>jsonb_array_length(spec#>'{recipe,guards}') then exit; end if;
            end loop;
        end if;
        raise exception 'HAC44_CASE_ROLLBACK' using errcode='ZX001';
    exception when sqlstate 'ZX001' then null;
    end;
    return jsonb_build_object('positive',positive,'negative',negative,'positiveAffectedRows',affected,
        'positiveSqlstate',positive_state,'positiveConstraint',positive_constraint,'positiveError',positive_error,
        'positiveReferenceVerified',reference_valid,'positiveRoleBeforeConstraints',role_before,
        'positiveRoleAfterConstraints',role_after,'positiveWriteRole','temporary owner helper',
        'observedSqlstate',state,'observedConstraint',actual,'observedMessage',message,
        'attempts',attempts,'suspensions',suspended,
        'guardsEnabledAfterCase',not exists(select 1 from pg_trigger t
            where t.tgrelid=(spec->>'table')::regclass and t.tgenabled<>'O'),
        'status',case when not positive then 'BLOQUEADO' when negative then 'PASS' else 'FAIL' end);
end$$;
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
V2_CATEGORIES = {"V2_MODELO", "V2_AUXILIAR", "INTERNA_V2_RECEIPTS_GRANTS", "HAC41_MODELO", "HAC41_INTERNA"}
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
    "offer_issuer_guard": {
        "tables": {"v2_carrier_offers"},
        "errors": [{"state": "PT400", "message": "IMMUTABLE_OFFER_ISSUER"}],
        "normalizes": [],
        "reason": "HAC-41 ordinary issuer guard rejects issuer changes before RI; suspension requires its exact observed failure after an active positive.",
    },
    "incident_condition_guard": {
        "tables": {"incident_route_conditions"},
        "errors": [{"state": "PT400", "message": "INCIDENT_CONDITION_ROUTE_MISMATCH"}],
        "normalizes": [],
        "reason": "Observed #111 ordinary association guard rejects a missing incident/condition before RI checks; valid positive uses the native linked route and period.",
    },
    "leg_partner_guard": {
        "tables": {"plan_leg_assignments"},
        "errors": [{"state": "PT400", "message": "PARTNER_SERVICE_MISMATCH"}],
        "normalizes": [],
        "reason": "Observed #111 ordinary partner guard rejects the absent partner before RI checks; the positive validates the actual carrier and agreement with all triggers active.",
    },
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


def hac41_row(record, data):
    """Small physical fixtures inside each strict rollback, with native parents."""
    table = record["table"]
    user = next((row for row in data["auth.users"] if row["id"] == "d4410000-0000-4000-8000-000000000001"), None)
    member = next((row for row in data["public.organization_members"] if user and row.get("auth_user_id") == user["id"] and row.get("status") == "ACTIVE"), None)
    operator = next((row for row in data["public.carrier_operators"] if user and row.get("auth_user_id") == user["id"] and row.get("status") == "ACTIVE"), None)
    common = {"idempotency_key": FIXTURE_KEY, "payload_hash": "0" * 64, "result": {}}
    if table == "private.v2_identity_receipts" and user:
        return {**common, "auth_user_id": user["id"]}
    if table == "private.v2_carrier_workflow_receipts" and operator:
        return {**common, "carrier_id": operator["carrier_id"], "operator_id": operator["id"]}
    if table == "private.v2_mcp_confirmations" and member:
        return {"id": FIXTURE_ROW, "auth_user_id": member["auth_user_id"],
                "organization_id": member["organization_id"], "member_id": member["id"],
                "action": "offers.create", "context": {}, "value": {},
                "idempotency_key": FIXTURE_KEY, "payload_hash": "0" * 64}
    if table == "public.response_integrations" and operator:
        service = next((row for row in data["public.carrier_services"] if row["carrier_id"] == operator["carrier_id"]), None)
        if service:
            return {"id": FIXTURE_ROW, "carrier_id": service["carrier_id"], "carrier_service_id": service["id"],
                    "channel": "MANUAL", "status": "PENDING"}
    return None


def build_case(record, catalog, data):
    """Create one positive and exact-diagnostic orphan recipe without FK DDL."""
    case = {"constraint": record["constraint"], "table": record["table"],
            "definition": record["definition"], "columns": record["childColumns"],
            "reference": record["referenceTable"] + "(" + ", ".join(record["referenceColumns"]) + ")",
            "category": record["category"], "owner": "HAC-44 / Jean Paul (harness)",
            "domainOwner": "HAC-41 / Axel" if record["table"] in IDENTITY_TABLES or record["category"].startswith("HAC41_") else "HAC-40 / Cristhian",
            "ownerLimit": "A failed FK probe alone does not establish a product defect; reproduce before domain escalation.",
            "status": "PENDING", "positive": False, "negative": False,
            "positiveBoundary": "SET CONSTRAINTS ALL IMMEDIATE", "role": "postgres",
            "reason": "", "suspensions": [], "attempts": []}
    if record["category"] not in V2_CATEGORIES:
        raise ValueError("The strict module cannot measure a baseline or V1 identity")
    case["method"] = STRICT_METHOD
    case["role"] = "authenticated"
    table = record["table"]
    column = record["childColumns"][0]
    setup = ""
    if record["category"].startswith("HAC41_") and table != "public.v2_carrier_offers":
        row = hac41_row(record, data)
        original = None
        case["fixture"] = "HAC-41 isolated physical INSERT; real native parents; per-case rollback"
    elif table in RECEIPTS:
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



def probe_sql(cases):
    query = "begin;\nset local search_path=public,extensions;\n" + STRICT_FUNCTION
    for case in cases:
        if case["status"] == "PENDING":
            strict = True
            if strict:
                query += "do $$begin perform set_config('hac44.previous_claims',coalesce(current_setting('request.jwt.claims',true),''),true);end$$;\n"
                query += "set local role authenticated;\nset local \"request.jwt.claims\"='{\"sub\":\"d4410000-0000-4000-8000-000000000001\",\"role\":\"authenticated\"}';\n"
            function = "pg_temp.fk_strict_case("
            query += ("select 'HAC44_FK:'||jsonb_build_object('table'," + lit(case["table"])
                      + ",'constraint'," + lit(case["constraint"]) + ",'result'," + function
                      + lit(json.dumps(case, separators=(",", ":"))) + "::jsonb))::text;\n")
            if strict:
                query += "reset role;\n"
                query += "do $$begin perform set_config('request.jwt.claims',current_setting('hac44.previous_claims'),true);end$$;\n"
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
            case.update(status="BLOQUEADO", reason="Missing measured positive/negative result; inspect strict-fk-pairs.log")
            continue
        case.update(result)
        case["positive"] = (result.get("positive") is True and result.get("positiveAffectedRows") == 1
                            and result.get("positiveReferenceVerified") is True)
        if case.get("method") == STRICT_METHOD:
            case["positive"] = case["positive"] and all(result.get(k) == "authenticated" for k in (
                "positiveRoleBeforeConstraints", "positiveRoleAfterConstraints"))
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
              "estrategia_huerfano", "dueno_dominio", "limite_dueno", "metodo", "rol_antes_constraints", "rol_despues_constraints"]


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
            "dueno_dominio": case["domainOwner"], "limite_dueno": case["ownerLimit"],
            "metodo": case["method"], "rol_antes_constraints": case.get("positiveRoleBeforeConstraints", ""),
            "rol_despues_constraints": case.get("positiveRoleAfterConstraints", "")})
    return output.getvalue()
