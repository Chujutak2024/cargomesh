"""Two-session optimistic concurrency check on the dedicated LOCAL V2 container.

Requires the explicit V2 baseline scenario; only this script's reserved UUID
keys are written/deleted. Does not accept a connection string or hosted target.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import json
import subprocess

ROOT = Path(__file__).resolve().parents[1]
CONTAINER = 'supabase_db_cargomesh-v2-local'
ORG = 'c2300000-0000-4000-8000-000000000001'
MEMBER = 'c2320000-0000-4000-8000-000000000001'
USER = 'c2310000-0000-4000-8000-000000000001'
KEYS = [f'd0490000-0000-4000-8000-{i:012}' for i in range(1, 4)]

def sql(query, allow_error=False):
    result = subprocess.run(['docker', 'exec', '-i', CONTAINER, 'psql', '-X', '-A', '-t',
        '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'], input=query,
        text=True, encoding='utf-8', capture_output=True)
    if result.returncode and not allow_error:
        raise RuntimeError(result.stderr)
    return result

def literal(value):
    return "'" + json.dumps(value, ensure_ascii=False).replace("'", "''") + "'::jsonb"

def auth():
    claims = json.dumps({'sub': USER, 'role': 'authenticated'})
    return f"begin; set local role authenticated; set local \"request.jwt.claims\" = '{claims}';\n"

def main():
    if sql(f"select count(*) from public.freight_requests where creation_idempotency_key='{KEYS[0]}';").stdout.strip() != '0':
        raise RuntimeError('Reserved race-test key already exists; refusing to overwrite it')
    value = json.loads((ROOT / 'docs/v2-amazon/delivery/fixtures/hac27/create-request.json').read_text(encoding='utf-8'))
    value['origin'] = {'facilityId': 'c2330000-0000-4000-8000-000000000001'}
    value['destination'] = {'facilityId': 'c2330000-0000-4000-8000-000000000002'}
    raw = literal(value)
    created = sql(auth() + f"select public.create_v2_freight_request('{ORG}','{MEMBER}','{KEYS[0]}',"
        f"private.hash_v2_freight_payload({raw}),{raw}); commit;")
    record = next(json.loads(line) for line in created.stdout.splitlines() if line.startswith('{'))
    request_id = record['id']
    try:
        def mutate(i, version=1, pause=True):
            body = json.loads(json.dumps(value))
            body['cargoSpecification']['description'] = f'Race writer {i}'
            return sql(auth() + f"select public.command_v2_freight_request('{ORG}','{MEMBER}','{KEYS[i]}',"
                f"'{request_id}',{version},'REVISE',{literal(body)});"
                + ('select pg_sleep(1);' if pause else '') + 'commit;', allow_error=True)
        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(mutate, (1, 2)))
        winners = [i for i, result in enumerate(results, 1) if result.returncode == 0]
        losers = [i for i, result in enumerate(results, 1) if result.returncode != 0 and 'STALE_DRAFT' in result.stderr]
        if len(winners) != 1 or len(losers) != 1:
            raise RuntimeError('Expected one commit and one STALE_DRAFT: ' + repr([(r.returncode,r.stderr) for r in results]))
        if sql(f"select draft_version from public.freight_requests where id='{request_id}';").stdout.strip() != '2':
            raise RuntimeError('Race did not increment exactly once')
        retry = mutate(losers[0], version=2, pause=False)
        if retry.returncode:
            raise RuntimeError('Failed command consumed its key: ' + retry.stderr)
        if sql(f"select draft_version from public.freight_requests where id='{request_id}';").stdout.strip() != '3':
            raise RuntimeError('Legitimate fresh-version retry did not commit')
        print('PASS: two sessions, one revision commit, one STALE_DRAFT, failed key reusable at fresh version')
    finally:
        sql(f"begin; delete from private.v2_request_command_receipts where request_id='{request_id}';"
            f"delete from public.freight_requests where id='{request_id}' and creation_idempotency_key='{KEYS[0]}'; commit;")

if __name__ == '__main__':
    main()
