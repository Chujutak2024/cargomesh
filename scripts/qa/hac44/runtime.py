"""Start HTTP services after the native database-only gate, preserving local volumes."""

import json
import re
import subprocess
import sys
import tomllib

from common import OUT, run, save, write
from gates import EXCLUDED
from local import CLI, HARNESS, PROJECT, BANK, LAYOUT
from banks import Bank, preflight


def start():
    """Start loopback HTTP services while preserving the dedicated database volume."""
    config = tomllib.loads((HARNESS / "supabase/config.toml").read_text(encoding="utf-8-sig"))
    assert config["project_id"] == PROJECT and config["api"]["port"] == LAYOUT.port_base + 1
    # CLI start regards an existing database-only bank as already started.
    if BANK.resources():
        BANK.stop(CLI)
    else:
        BANK.prove_stopped_volume()
    from common import save
    save("http-bank-preflight.json", preflight([config], LAYOUT.app_port))
    assert (
        run(
            "http-start", CLI + ["start", "--workdir", HARNESS, "--exclude", EXCLUDED], timeout=900
        ).returncode
        == 0
    )
    p = subprocess.run(
        CLI + ["status", "--workdir", str(HARNESS), "--output", "json"],
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    BANK.own("http-started")
    assert p.returncode == 0 and json.loads(p.stdout)["API_URL"] == LAYOUT.api_url
    print("PASS dedicated local HTTP stack; volume preserved")


def stop():
    """Stop only verified HAC-44 projects and preserve their local volumes."""
    for path, project in [
        (HARNESS, PROJECT),
        (OUT / "gate/workdir-v1", LAYOUT.project("v1")),
        (OUT / "gate/workdir-baseline", LAYOUT.project("baseline")),
    ]:
        if path.joinpath("supabase/config.toml").exists():
            config = tomllib.loads(
                path.joinpath("supabase/config.toml").read_text(encoding="utf-8-sig")
            )
            assert config["project_id"] == project
            bank = Bank(path, project)
            if bank.resources():
                bank.own("final-cleanup")
                query = """create temporary table cleanup_auth_counts(name text,n bigint);
do $$declare r record;n bigint;begin for r in select c.relname from pg_class c join pg_namespace s on s.oid=c.relnamespace where s.nspname='auth' and c.relkind in('r','p') and c.relname<>'schema_migrations' loop execute format('select count(*) from auth.%I',r.relname) into n;insert into cleanup_auth_counts values('auth.'||r.relname,n);end loop;end$$;
select coalesce((select jsonb_object_agg(name,n) from cleanup_auth_counts),'{}'::jsonb)||jsonb_build_object('organizations',(select count(*) from public.organizations),'carriers',(select count(*) from public.carriers),'facilities',(select count(*) from public.facilities));"""
                before = bank.raw_sql("final-counts-before-" + project, query)
                if before.returncode:
                    raise RuntimeError("Cannot count own bank before final cleanup")
                counts = json.loads(before.stdout)
                reset = any(counts.values())
                if reset:
                    # Record only physical Auth keys and their FK graph. Never export
                    # passwords, refresh tokens, PKCE verifiers or session payloads.
                    auth_keys = bank.raw_sql("final-auth-key-backup-" + project, """
create temporary table auth_key_backup(relation text,keys jsonb);
do $$declare r record;projection text;begin
 for r in select c.oid,c.relname from pg_class c join pg_namespace s on s.oid=c.relnamespace where s.nspname='auth' and c.relkind in('r','p') and c.relname<>'schema_migrations' loop
  select string_agg(format('%L,t.%I',a.attname,a.attname),',' order by u.ord) into projection
  from pg_constraint p cross join lateral unnest(p.conkey) with ordinality u(num,ord)
  join pg_attribute a on a.attrelid=p.conrelid and a.attnum=u.num
  where p.conrelid=r.oid and p.contype='p';
  if projection is not null then execute format('insert into auth_key_backup select %L,jsonb_build_object(%s) from auth.%I t','auth.'||r.relname,projection,r.relname);end if;
 end loop;
end$$;
select jsonb_build_object('physicalKeys',coalesce((select jsonb_agg(to_jsonb(t)) from auth_key_backup t),'[]'::jsonb),
 'incomingFKs',coalesce((select jsonb_agg(jsonb_build_object('child',conrelid::regclass::text,'parent',confrelid::regclass::text,'onDelete',confdeltype,'definition',pg_get_constraintdef(oid))) from pg_constraint where contype='f' and confrelid in(select c.oid from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='auth')),'[]'::jsonb));
""")
                    if auth_keys.returncode:
                        raise RuntimeError("Cannot back up nonsecret Auth keys before own reset")
                    save("final-auth-key-backup-" + project + ".json", json.loads(auth_keys.stdout))
                    bank.own("disable-seed-for-final-reset")
                    source = path.joinpath("supabase/config.toml").read_text(encoding="utf-8-sig")
                    source = re.sub(r"(\[db.seed\][^\[]*?\benabled\s*=\s*)true", r"\1false", source)
                    write(path / "supabase/config.toml", source)
                    bank.reset(CLI)
                bank.own("final-counts")
                after = bank.raw_sql("final-counts-after-" + project, query)
                if after.returncode == 0 and any(json.loads(after.stdout).values()):
                    from teardown import clean_ids
                    clean_ids(bank)
                    after = bank.raw_sql("final-counts-after-exact-ids-" + project, query)
                if after.returncode or any(json.loads(after.stdout).values()):
                    raise RuntimeError("Own bank final cleanup is not zero")
                save("final-cleanliness-" + project + ".json", {"status": "PASS", "before": counts,
                     "after": json.loads(after.stdout), "ownedReset": reset, "remainingBusinessRoots": 0})
                bank.stop(CLI)


if __name__ == "__main__":
    {"start": start, "stop": stop}[sys.argv[1]]()
