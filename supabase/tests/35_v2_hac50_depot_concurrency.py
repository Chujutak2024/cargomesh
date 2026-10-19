"""Two real PostgreSQL sessions. Local Docker only; creates a schema-only disposable bank."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import subprocess,json,uuid
ROOT=Path(__file__).resolve().parents[2]
CONTAINER='supabase_db_hac45-carrier-local'
SOURCE='postgres'
BANK='hac50_depot_concurrency_'+uuid.uuid4().hex[:12]
def command(args,data=None):
 p=subprocess.run(args,input=data,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 if p.returncode:raise RuntimeError(p.stderr.decode(errors='replace')[-2500:])
 return p.stdout
def sql(text,user='postgres',must_pass=True):
 p=subprocess.run(['docker','exec','-i',CONTAINER,'psql','-X','-At','-v','ON_ERROR_STOP=1','-v','local_only=1','-U',user,'-d',BANK],input=text.encode(),stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 if must_pass and p.returncode:raise RuntimeError(p.stderr.decode(errors='replace')[-2500:])
 return p
assert BANK.startswith('hac50_depot_concurrency_') and BANK!=SOURCE
command(['docker','exec',CONTAINER,'createdb','-U','postgres',BANK])
dump=command(['docker','exec',CONTAINER,'pg_dump','--schema-only','-U','postgres','-d',SOURCE])
sql(dump.decode(),'supabase_admin')
sql((ROOT/'supabase-v2/supabase/migrations/20261015055541_hac50_depot_operations.sql').read_text(encoding='utf-8-sig'))
sql((ROOT/'supabase/scenarios/v2-road-baseline/seed.sql').read_text(encoding='utf-8-sig'))
fixture=(ROOT/'supabase/tests/35_v2_hac50_depot_operations.test.sql').read_text(encoding='utf-8-sig').split("select is(pg_temp.depot_call('policy.read')")[0]
sql(fixture+"select pg_temp.depot_call('policy.save',(select v from depot_refs where name='policy'),0,null,gen_random_uuid());commit;")
depot=sql('select depot_id from public.depot_operating_policies;').stdout.decode().strip()
assert len(depot)==36
carrier='c2340000-0000-4000-8000-000000000001';operator='c5020000-0000-4000-8000-000000000001'
def attempt(key,days):
 auth="begin;set local role authenticated;set local request.jwt.claims='"+json.dumps({'sub':'c5010000-0000-4000-8000-000000000001','role':'authenticated'})+"';"
 value="jsonb_build_object('schemaVersion','2.0','serviceId','c2360000-0000-4000-8000-000000000001','resourceCode','DOCK','activity','LOAD','equipmentType','BOX_TRUCK','window',jsonb_build_object('startsAt',date_trunc('day',now())+interval '"+str(days)+" days 14 hours','endsAt',date_trunc('day',now())+interval '"+str(days)+" days 15 hours'),'units',1,'executionId',null,'status','CONFIRMED','reason','SIMULATED concurrency gate')"
 query=auth+f"select public.depot_operations_v2('{operator}','{carrier}','{depot}','appointment.save',null,0,'{key}',{value});select pg_sleep(0.4);commit;"
 return sql(query,must_pass=False)
with ThreadPoolExecutor(2) as pool:
 results=list(pool.map(lambda key:attempt(key,2),[str(uuid.uuid4()),str(uuid.uuid4())]))
assert sorted(p.returncode==0 for p in results)==[False,True],[(p.returncode,p.stderr.decode()) for p in results]
assert 'DEPOT_SLOT_UNAVAILABLE' in next(p.stderr.decode() for p in results if p.returncode)
key=str(uuid.uuid4())
with ThreadPoolExecutor(2) as pool:results=list(pool.map(lambda _:attempt(key,3),range(2)))
assert all(p.returncode==0 for p in results)
replay=[json.loads(next(line for line in p.stdout.decode().splitlines() if line.startswith('{'))) for p in results]
assert sorted(r['replay'] for r in replay)==[False,True]
assert replay[0]['data']['id']==replay[1]['data']['id']
assert sql('select count(*) from public.depot_appointments;').stdout.decode().strip()=='2'
print(json.dumps({'bank':BANK,'sourceRowsCopied':False,'competingConfirmations':'1 success, 1 DEPOT_SLOT_UNAVAILABLE','concurrentSameKey':'1 creation, 1 replay; same appointment','confirmedRecords':2}))
