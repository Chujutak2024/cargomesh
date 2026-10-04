"""Check catalog optimistic concurrency against the dedicated LOCAL V2 scenario."""
from concurrent.futures import ThreadPoolExecutor
import json
import subprocess

CONTAINER = 'supabase_db_cargomesh-v2-local'
ORG = 'c2300000-0000-4000-8000-000000000001'
MEMBER = 'c2320000-0000-4000-8000-000000000001'
USER = 'c2310000-0000-4000-8000-000000000001'
KEYS = [f'd0990000-0000-4000-8000-{i:012}' for i in range(1, 4)]

def sql(query):
    return subprocess.run(['docker', 'exec', '-i', CONTAINER, 'psql', '-X', '-A', '-t',
        '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'], input=query,
        text=True, encoding='utf-8', capture_output=True)

def command(key, record_id=None, version=None, pause=False):
    value = json.dumps({'schemaVersion': '2.0', 'name': 'HAC40 concurrency',
        'categoryId': 'c0000000-0000-0000-0000-000000000001', 'typicalUnits': [],
        'requirements': [], 'preferredEquipment': None, 'active': True})
    claims = json.dumps({'sub': USER, 'role': 'authenticated'})
    ident = f"'{record_id}'" if record_id else 'null'
    query = f"""begin; set local role authenticated; set local "request.jwt.claims"='{claims}';
      select public.command_v2_catalog('{ORG}','{MEMBER}','cargo-profiles',null,null,{ident},
      '{key}',{version if version else 'null'},'{value}'::jsonb);
      {'select pg_sleep(0.4);' if pause else ''} commit;"""
    return sql(query)

def main():
    check = sql(f"select count(*) from private.v2_catalog_receipts where idempotency_key in ({','.join(repr(k) for k in KEYS)});")
    if check.returncode or check.stdout.strip() != '0':
        raise RuntimeError('Reserved test keys unavailable; refusing to overwrite data.')
    created = command(KEYS[0])
    if created.returncode:
        raise RuntimeError(created.stderr)
    entry = next(json.loads(line) for line in created.stdout.splitlines() if line.startswith('{'))
    record_id = entry['record']['id']
    try:
        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(lambda i: command(KEYS[i], record_id, 1, True), (1, 2)))
        assert sum(r.returncode == 0 for r in results) == 1, [r.stderr for r in results]
        loser = next(i for i, r in enumerate(results, 1) if r.returncode)
        assert 'STALE_DRAFT' in results[loser - 1].stderr
        retry = command(KEYS[loser], record_id, 2)
        assert retry.returncode == 0, retry.stderr
        assert sql(f"select version from public.organization_cargo_profiles where id='{record_id}';").stdout.strip() == '3'
        print('PASS: catalog race, one commit/one STALE_DRAFT; failed key reusable at fresh version.')
    finally:
        cleanup = sql(f"begin; delete from private.v2_catalog_receipts where idempotency_key in ({','.join(repr(k) for k in KEYS)}); delete from public.organization_cargo_profiles where id='{record_id}'; commit;")
        if cleanup.returncode:
            raise RuntimeError(cleanup.stderr)

if __name__ == '__main__':
    main()
