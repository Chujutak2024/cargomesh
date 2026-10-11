"""Live paired controls for the strict caller/constraint boundary; temporary only."""

import json
import sys

from fk_strict import STRICT_FUNCTION


def main():
    from common import save
    from local import sql

    spec = {
        "table": "pg_temp.strict_child", "constraint": "strict_child_parent_id_fkey",
        "positiveReference": {"parent_id": 1},
        "recipe": {"setup": "", "good": "insert into pg_temp.strict_child values(1,1) returning ctid::text",
                   "bad": "update pg_temp.strict_child set parent_id=999 where ctid=$1::tid returning to_jsonb(strict_child)",
                   "mutation": {"parent_id": 999}, "guards": []},
    }
    call = "select pg_temp.fk_strict_case('" + json.dumps(spec).replace("'", "''") + "'::jsonb)"
    query = """begin;
create temporary table strict_parent(id integer primary key);
create temporary table strict_child(id integer primary key,parent_id integer references strict_parent(id));
insert into strict_parent values(1);
create function pg_temp.strict_caller_trigger() returns trigger language plpgsql as $$begin
    if current_user<>'authenticated' then raise exception 'WRONG_DEFERRED_CALLER'; end if;
    return null;
end$$;
create constraint trigger strict_caller after insert or update on strict_child
    deferrable initially deferred for each row execute function pg_temp.strict_caller_trigger();
""" + STRICT_FUNCTION + """
set local role authenticated;
set local "request.jwt.claims"='{"sub":"d4410000-0000-4000-8000-000000000001","role":"authenticated"}';
""" + call.replace("select ", "select 'POSITIVE:'||", 1) + "::text;\nreset role;\n"
    query += call.replace("select ", "select 'WRONG_ROLE:'||", 1) + "::text;\n"
    query += """create or replace function pg_temp.strict_caller_trigger() returns trigger language plpgsql as $$begin
    raise exception 'POSITIVE_DEFERRED_FAILURE';
end$$;
set local role authenticated;
""" + call.replace("select ", "select 'FAILED_POSITIVE:'||", 1) + "::text;\nreset role;\nrollback;\n"
    result = sql("strict-caller-paired-controls", query)
    assert result.returncode == 0, "Live strict controls did not execute"
    records = {}
    for line in result.stdout.splitlines():
        for prefix in ("POSITIVE", "WRONG_ROLE", "FAILED_POSITIVE"):
            if line.startswith(prefix + ":"):
                records[prefix] = json.loads(line.split(":", 1)[1])
    good = records["POSITIVE"]
    assert good["status"] == "PASS" and good["observedSqlstate"] == "23503"
    assert good["observedConstraint"] == spec["constraint"]
    assert good["positiveRoleBeforeConstraints"] == good["positiveRoleAfterConstraints"] == "authenticated"
    for key in ("WRONG_ROLE", "FAILED_POSITIVE"):
        assert records[key]["status"] == "BLOQUEADO" and not records[key]["positive"]
        assert not records[key]["attempts"], "A failed positive must prevent the negative"
    assert records["FAILED_POSITIVE"]["positiveError"] == "POSITIVE_DEFERRED_FAILURE"
    save("strict-caller-controls.json", {"status": "PASS", "cases": [
         {"case": key, "status": "PASS", "expected": "PASS" if key == "POSITIVE" else "BLOQUEADO",
          "observed": value} for key, value in records.items()],
         "boundary": "Temporary tables/functions only; authenticated invoker; owner writes; deferred invoker trigger; ROLLBACK"})
    print("PASS live strict controls: authenticated deferred trigger, exact FK, wrong role and failed positive")
    return 0


if __name__ == "__main__":
    sys.exit(main())
