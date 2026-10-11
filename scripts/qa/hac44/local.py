"""Use only named HAC-44 local Docker banks; no connection URL is accepted."""

import hashlib
import importlib.util
import os
import re
import shutil
import socket
import tomllib
from pathlib import Path

from common import OUT, ROOT, run, safe, save, state, write
from banks import Bank, Layout

HEAD = state()["head"]
HARNESS = OUT / "stack-v2"
LAYOUT = Layout.environment()
PROJECT = LAYOUT.project("v2")
DB = "supabase_db_" + PROJECT
BANK = Bank(HARNESS, PROJECT)
cli = os.environ.get("HAC44_CLI") or shutil.which("supabase")
CLI = [cli] if cli else ["npx.cmd" if os.name == "nt" else "npx", "--yes", "supabase@2.117.0"]


def gate():
    """Load the unchanged native gate module from the selected checkout."""
    spec = importlib.util.spec_from_file_location("hac29_gate", ROOT / "supabase-v2/gate.py")
    g = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(g)
    return g


def sql(label, query, persist=True):
    """Execute SQL only through the dedicated HAC-44 local Docker database."""
    BANK.own("sql")
    from real_auth import replace_claims, issued_claims
    query = replace_claims(query, issued_claims)
    rolled_back = bool(re.search(r'\brollback\s*;', query, re.I))
    count_query = """create temporary table qa_counts(name text,n bigint);
do $$declare r record;n bigint;begin for r in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in('r','p') and n.nspname not like 'pg_%' and n.nspname<>'information_schema' order by 1,2 loop execute format('select count(*) from %I.%I',r.nspname,r.relname) into n;insert into qa_counts values(r.nspname||'.'||r.relname,n);end loop;end$$;
select jsonb_object_agg(name,n) from qa_counts;"""
    if rolled_back:
        import json
        before = BANK.raw_sql(label + '-counts-before', count_query)
        if before.returncode:
            raise RuntimeError('Rollback count prerequisite failed')
        before = json.loads(next(line for line in before.stdout.splitlines() if line.startswith('{')))
    if persist:
        write(OUT / "repro/sql" / (label + ".sql"), safe(query))
    result = run(
        label,
        [
            "docker",
            "exec",
            "-i",
            DB,
            "psql",
            "-X",
            "-A",
            "-t",
            "-v",
            "ON_ERROR_STOP=1",
            "-v",
            "local_only=1",
            "-U",
            "postgres",
            "-d",
            "postgres",
        ],
        ROOT,
        query,
    )
    if rolled_back:
        after = BANK.raw_sql(label + '-counts-after', count_query)
        if after.returncode:
            raise RuntimeError('Rollback count verification failed')
        after = json.loads(next(line for line in after.stdout.splitlines() if line.startswith('{')))
        save(label + '-rollback-counts.json', {'status':'PASS' if before == after else 'FAIL',
             'before':before,'after':after,'delta':{k:after.get(k,0)-before.get(k,0) for k in before.keys()|after.keys() if after.get(k,0)!=before.get(k,0)}})
        if before != after:
            raise RuntimeError('Rollback changed owned bank counts')
    return result


def script(label, path, backup=False):
    """Expand local SQL includes and execute the selected scenario script."""
    p = Path(path)
    p = p if p.is_absolute() else ROOT / p
    raw = p.read_text(encoding="utf-8-sig")
    save(
        label + "-source.json",
        {
            "head": HEAD,
            "path": str(p.relative_to(ROOT)) if p.is_relative_to(ROOT) else str(p),
            "sha256": hashlib.sha256(raw.encode()).hexdigest(),
        },
    )

    def expand(file):
        source = file.read_text(encoding="utf-8-sig")
        return re.sub(
            r"^\\ir (.+)$",
            lambda m: expand((file.parent / m[1].strip()).resolve()),
            source,
            flags=re.M,
        )

    return sql(label, ("\\set backup_confirmed 1\n" if backup else "") + expand(p), persist=False)
