"""Actual two-session fleet races, dedicated LOCAL V2 stack and explicit fixtures only."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import json,subprocess

CONTAINER='supabase_db_cargomesh-v2-local'
ORG='c2300000-0000-4000-8000-000000000001';MEMBER='c2320000-0000-4000-8000-000000000001'
USER='c2310000-0000-4000-8000-000000000001';CARRIER='c2340000-0000-4000-8000-000000000001'
KEYS=[f'd1990000-0000-4000-8000-{i:012}' for i in range(1,7)]
fixtures=json.loads((Path(__file__).resolve().parents[1]/'supabase/scenarios/v2-road-baseline/fixtures/hac40-fleet.json').read_text())

def sql(query):
    return subprocess.run(['docker','exec','-i',CONTAINER,'psql','-X','-A','-t','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],input=query,text=True,capture_output=True)

def cmd(kind,key,value,ident=None,version=None,pause=False):
    body=json.dumps(value).replace("'","''")
    claims=json.dumps({'sub':USER,'role':'authenticated'})
    return sql(f"""begin;set local role authenticated;set local "request.jwt.claims"='{claims}';
    select public.command_v2_catalog('{ORG}','{MEMBER}','{kind}','{CARRIER}',null,
    {repr(ident) if ident else 'null'},'{key}',{version if version else 'null'},'{body}'::jsonb);
    {'select pg_sleep(0.4);' if pause else ''}commit;""")

def record(result):
    assert result.returncode==0,result.stderr
    return next(json.loads(line)['record'] for line in result.stdout.splitlines() if line.startswith('{'))

def main():
    check=sql(f"select count(*) from private.v2_catalog_receipts where idempotency_key in ({','.join(repr(k) for k in KEYS)});select count(*) from private.v2_catalog_grants where auth_user_id='{USER}' and carrier_id='{CARRIER}';")
    assert check.returncode==0 and check.stdout.split()==['0','0'],'Reserved test keys/grants unavailable; refusing overwrite.'
    grant=sql(f"insert into private.v2_catalog_grants(auth_user_id,carrier_id,permission) values('{USER}','{CARRIER}','CARRIER_EDITOR');")
    assert grant.returncode==0,grant.stderr
    asset_id=None;cal_id=None
    try:
        value={**fixtures['assets'],'code':'FLEET_RACE','roadVehicle':{**fixtures['assets']['roadVehicle'],'plate':'RACE-001'}}
        asset_id=record(cmd('assets',KEYS[0],value))['id']
        with ThreadPoolExecutor(max_workers=2) as pool:
            results=list(pool.map(lambda i:cmd('assets',KEYS[i],value,asset_id,1,True),(1,2)))
        assert sum(r.returncode==0 for r in results)==1,[r.stderr for r in results]
        loser=next(i for i,r in enumerate(results,1) if r.returncode)
        assert 'STALE_DRAFT' in results[loser-1].stderr
        assert record(cmd('assets',KEYS[loser],value,asset_id,2))['version']==3
        calendar={**fixtures['calendars'],'assetId':asset_id}
        cal_id=record(cmd('calendars',KEYS[3],calendar))['id']
        maintenance={**fixtures['maintenances'],'assetId':asset_id}
        hold=f"""begin;insert into public.capacity_reservations(id,capacity_calendar_id,starts_at,ends_at,status)
        values('{KEYS[5]}','{cal_id}','2027-01-10T01:00:00Z','2027-01-10T02:00:00Z','HELD');select pg_sleep(0.4);commit;"""
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures=[pool.submit(cmd,'maintenances',KEYS[4],maintenance,None,None,True),pool.submit(sql,hold)]
            results=[f.result() for f in futures]
        assert sum(r.returncode==0 for r in results)==1,[r.stderr for r in results]
        assert 'FLEET_COMMITMENT_CONFLICT' in next(r.stderr for r in results if r.returncode)
        print('PASS: fleet revision race: one commit/one STALE_DRAFT, failed key reusable.')
        print('PASS: maintenance vs hold: exactly one commit, other FLEET_COMMITMENT_CONFLICT.')
    finally:
        cleanup=sql(f"""begin;
        delete from public.capacity_reservations where id='{KEYS[5]}';
        delete from public.scheduled_maintenances where transport_asset_id={repr(asset_id) if asset_id else 'null'};
        delete from public.capacity_calendars where id={repr(cal_id) if cal_id else 'null'};
        delete from public.transport_assets where id={repr(asset_id) if asset_id else 'null'};
        delete from private.v2_catalog_receipts where organization_id='{ORG}' and member_id='{MEMBER}' and idempotency_key in ({','.join(repr(k) for k in KEYS)});
        delete from private.v2_catalog_grants where auth_user_id='{USER}' and carrier_id='{CARRIER}' and permission='CARRIER_EDITOR';commit;""")
        assert cleanup.returncode==0,cleanup.stderr

if __name__=='__main__':main()
