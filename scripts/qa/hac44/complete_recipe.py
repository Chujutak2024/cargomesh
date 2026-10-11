"""Build the canonical native full-operation recipe from versioned QA inputs.
Use --check to verify the committed recipe; this never writes product sources.
"""

import json
import re
import sys

from common import ROOT, write
from sql_layout import format_sql


def build():
    """Build or check the native completed-operation recipe."""
    scenario = ROOT / "supabase/scenarios/v2-full-flow-qa"
    source = (
        (scenario / "workflow-seed.sql")
        .read_text(encoding="utf-8-sig")
        .replace("HAC44_WORKFLOW_QA", "HAC44_COMPLETE_QA")
        .replace("QA-001", "HAC44-COMPLETE-001")
        .replace("QA-1", "HAC44-COMPLETE-1")
    )
    crew = (ROOT / "supabase/tests/21_v2_hac40_crew.test.sql").read_text(encoding="utf-8-sig")
    inputs = {
        m[1]: json.loads(m[2].replace("c23", "d44"))
        for m in re.finditer(r"insert into crew_inputs values\('([^']+)','(\{[^\n]+?\})'\);", crew)
    }
    added = (
        "\n-- Complete B4/B5 through authenticated native writers; no domain guard is "
        "suspended.\n\ncreate or replace function pg_temp.audit(v integer default 1) "
        "returns jsonb language sql as $$\n    select "
        "jsonb_build_object('schemaVersion',\n               '2.0', 'expectedVersion',"
        " v, 'note', 'HAC44 canonical simulated operation', 'evidence',\n             "
        "  pg_temp.ev());\n$$;\n"
    )
    added += (
        "select pg_temp.save('hold','holds.create',"
        "jsonb_build_object('schemaVersion','2.0','bookingId',pg_temp.id('booking'),"
        "'assignmentId',pg_temp.id('assignment'),'expiresAt',now()+interval '1 hour',"
        "'consolidationId',null,'evidence',"
        "pg_temp.ev()));\n"
    )
    added += (
        "select pg_temp.w('holds.confirm',pg_temp.audit(),pg_temp.ctx(null,"
        "'d4440000-0000-4000-8000-000000000001',null,pg_temp.id('hold')));\nselect "
        "pg_temp.w('bookings.confirm',pg_temp.audit()||jsonb_build_object('carrierRef"
        "erence','HAC44-COMPLETE','confirmation','CONFIRMED'),pg_temp.ctx(null,"
        "'d4440000-0000-4000-8000-000000000001',null,"
        "pg_temp.id('booking')));\n"
    )
    for kind in ("drivers", "driver-assignments", "vehicle-assignments"):
        v = inputs[kind]
        v["evidence"]["validUntil"] = "2030-01-01T00:00:00Z"
        if kind == "drivers":
            v["licenseValidUntil"] = "2030-01-01"
            v["fullName"] = "LOCAL_ONLY HAC44 canonical driver"
            v["maximumDutySeconds"] = 86400
        else:
            v["status"] = "CONFIRMED"
        value = "'" + json.dumps(v).replace("'", "''") + "'::jsonb"
        if kind == "drivers":
            value += (
                "||jsonb_build_object('availableWindows',jsonb_build_array(pg_temp.win()),"
                "'dutyWindow',pg_temp.win())"
            )
        else:
            value += (
                "||jsonb_build_object('executionId',pg_temp.id('execution'),'window',pg_temp.win()"
            )
            value += (
                ",'driverId',pg_temp.id('drivers'))"
                if kind == "driver-assignments"
                else (
                    ",'assetId',pg_temp.id('asset'),'reservationId',pg_temp.id('hold'),"
                    "'capacityCommitted',(select value#>'{data,capacityCommitted}' from refs "
                    "where name='hold'))"
                )
            )
        added += (
            "insert into refs select '"
            + kind
            + (
                "',public.command_v2_catalog('d4400000-0000-4000-8000-000000000001',"
                "'d4420000-0000-4000-8000-000000000001',"
                "'"
            )
            + kind
            + "','d4440000-0000-4000-8000-000000000001',null,null,gen_random_uuid(),null,"
            + value
            + ")->'record';\n"
        )
    added += (
        "select pg_temp.w('executions.start',pg_temp.audit(),pg_temp.ctx(null,"
        "'d4440000-0000-4000-8000-000000000001',null,"
        "pg_temp.id('execution')));\n"
    )
    added += (
        "select pg_temp.save('incident','incidents.create',"
        "jsonb_build_object('schemaVersion','2.0','kind','LOCAL_ONLY_QA_DELAY',"
        "'severity','WARNING','occurredAt',now(),'location',(select value#>'{data,"
        "location}' from refs where name='origin'),'description','HAC44 SIMULATED "
        "incident','evidence',jsonb_build_array(pg_temp.ev())),pg_temp.ctx(null,"
        "'d4440000-0000-4000-8000-000000000001',"
        "pg_temp.id('execution')));\n"
    )
    added += (
        "select pg_temp.w('incidents.update',pg_temp.audit()||jsonb_build_object('act"
        "ion','RESOLVE'),pg_temp.ctx(null,'d4440000-0000-4000-8000-000000000001',"
        "null,pg_temp.id('incident')));\nselect pg_temp.w('executions.complete',"
        "pg_temp.audit(2),pg_temp.ctx(null,'d4440000-0000-4000-8000-000000000001',"
        "null,pg_temp.id('execution')));\n"
    )
    source = source.replace("reset role;", added + "reset role;").replace(
        "HAC44_REFS:", "HAC44_COMPLETE_REFS:"
    )
    source = format_sql(source)
    path = scenario / "complete-seed.sql"
    if "--check" in sys.argv:
        assert path.read_text(encoding="utf-8-sig") == source
        print("PASS canonical recipe matches native inputs")
    else:
        write(path, source)


if __name__ == "__main__":
    build()
