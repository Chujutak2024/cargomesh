"""Real two-session crew races against the dedicated local V2 stack; no hosted access."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import json,subprocess

ROOT=Path(__file__).resolve().parents[1]
CONTAINER='supabase_db_cargomesh-v2-local'
ORG='c2300000-0000-4000-8000-000000000001';MEMBER='c2320000-0000-4000-8000-000000000001'
USER='c2310000-0000-4000-8000-000000000001';CARRIER='c2340000-0000-4000-8000-000000000001'
SID='c2360000-0000-4000-8000-000000000001';EXECUTION='d1580000-0000-4000-8000-000000000001'
KEYS=[f'd1590000-0000-4000-8000-{i:012}' for i in range(1,12)]
fixtures=json.loads((ROOT/'supabase/scenarios/v2-road-baseline/fixtures/hac40-crew.json').read_text())
fleet=json.loads((ROOT/'supabase/scenarios/v2-road-baseline/fixtures/hac40-fleet.json').read_text())
def sql(query):
 return subprocess.run(['docker','exec','-i',CONTAINER,'psql','-X','-A','-t','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose'],input=query,text=True,capture_output=True)
def literal(value):return "'"+value.replace("'","''")+"'"
def cmd(kind,key,value,ident=None,version=None,pause=False):
 body=literal(json.dumps(value));claims=literal(json.dumps({'sub':USER,'role':'authenticated'}))
 return sql(f'''begin;set local role authenticated;set local "request.jwt.claims"={claims};
 select public.command_v2_catalog('{ORG}','{MEMBER}','{kind}','{CARRIER}',null,
 {literal(ident) if ident else 'null'},'{key}',{version if version else 'null'},{body}::jsonb);
 {'select pg_sleep(0.3);' if pause else ''}commit;''')
def result(r,field='record'):
 assert r.returncode==0,r.stderr
 return next(json.loads(line)[field] if field else json.loads(line) for line in r.stdout.splitlines() if line.startswith('{'))
def race(calls,expected):
 with ThreadPoolExecutor(max_workers=2) as pool:results=[future.result() for future in [pool.submit(call) for call in calls]]
 assert sum(r.returncode==0 for r in results)==1,[r.stderr for r in results]
 assert expected in next(r.stderr for r in results if r.returncode),[r.stderr for r in results]
 return results
def main():
 check=sql(f"select count(*) from private.v2_catalog_receipts where idempotency_key in ({','.join(literal(k) for k in KEYS)});select count(*) from private.v2_catalog_grants where auth_user_id='{USER}' and carrier_id='{CARRIER}';select count(*) from public.transport_executions where id='{EXECUTION}';")
 assert check.returncode==0 and check.stdout.split()==['0','0','0'],'Reserved fixtures unavailable; refusing overwrite.'
 request_id=None;driver_id=None;asset_id=None
 grant=sql(f"insert into private.v2_catalog_grants(auth_user_id,carrier_id,permission) values('{USER}','{CARRIER}','CARRIER_EDITOR');")
 assert grant.returncode==0,grant.stderr
 try:
  payload=json.loads((ROOT/'supabase/scenarios/v2-road-baseline/fixtures/positive.json').read_text())['requestBody']
  body=literal(json.dumps(payload))
  request_id=result(sql(f'''begin;set local role authenticated;set local "request.jwt.claims"='{{"sub":"{USER}","role":"authenticated"}}';
   select public.create_v2_freight_request('{ORG}','{MEMBER}','{KEYS[0]}',private.hash_v2_freight_payload({body}::jsonb),{body}::jsonb);commit;'''),None)['id']
  execution=sql(f"insert into public.transport_executions(id,organization_id,freight_request_id,carrier_id,carrier_service_id,status,planned_starts_at,planned_ends_at) values('{EXECUTION}','{ORG}','{request_id}','{CARRIER}','{SID}','PLANNED','2027-01-15T00:00:00Z','2027-01-16T00:00:00Z');")
  assert execution.returncode==0,execution.stderr
  driver=fixtures['drivers'];driver_id=result(cmd('drivers',KEYS[1],driver))['id']
  edits=race([lambda:cmd('drivers',KEYS[2],driver,driver_id,1,True),lambda:cmd('drivers',KEYS[3],driver,driver_id,1,True)],'STALE_DRAFT')
  failed_key=KEYS[2] if edits[0].returncode else KEYS[3]
  assert result(cmd('drivers',failed_key,driver,driver_id,2))['version']==3
  assignment={**fixtures['driver-assignments'],'driverId':driver_id,'executionId':EXECUTION}
  race([lambda:cmd('driver-assignments',KEYS[4],assignment,pause=True),lambda:cmd('driver-assignments',KEYS[5],assignment,pause=True)],'23P01')
  asset={**fleet['assets'],'code':'CREW_RACE','roadVehicle':{**fleet['assets']['roadVehicle'],'plate':'QA-CREW-RACE'}}
  asset_id=result(cmd('assets',KEYS[6],asset))['id']
  vehicle={**fixtures['vehicle-assignments'],'assetId':asset_id,'executionId':EXECUTION,'reservationId':None}
  maintenance={**fleet['maintenances'],'assetId':asset_id,'blockedWindow':vehicle['window']}
  race([lambda:cmd('vehicle-assignments',KEYS[7],vehicle,pause=True),lambda:cmd('maintenances',KEYS[8],maintenance,pause=True)],'FLEET_COMMITMENT_CONFLICT')
  print('PASS: driver revision race: one commit/one STALE_DRAFT; failed key reusable.')
  print('PASS: concurrent assignments of one driver: exactly one commit; native overlap exclusion.')
  print('PASS: vehicle assignment vs maintenance: exactly one commit; other FLEET_COMMITMENT_CONFLICT.')
 finally:
  # Disable only immutable command guards for removal of identifiers created by this local test.
  cleanup=f'''begin;alter table public.driver_assignments disable trigger crew_command_guard;
   alter table public.vehicle_assignments disable trigger crew_command_guard;alter table public.drivers disable trigger crew_command_guard;
   delete from public.driver_assignments where execution_id='{EXECUTION}';delete from public.vehicle_assignments where execution_id='{EXECUTION}';
   delete from public.drivers where id={literal(driver_id) if driver_id else 'null'};
   alter table public.driver_assignments enable trigger crew_command_guard;alter table public.vehicle_assignments enable trigger crew_command_guard;alter table public.drivers enable trigger crew_command_guard;
   delete from public.scheduled_maintenances where transport_asset_id={literal(asset_id) if asset_id else 'null'};
   delete from public.transport_assets where id={literal(asset_id) if asset_id else 'null'};
   delete from public.transport_executions where id='{EXECUTION}';
   delete from public.freight_requests where id={literal(request_id) if request_id else 'null'};
   delete from private.v2_catalog_receipts where organization_id='{ORG}' and member_id='{MEMBER}' and idempotency_key in ({','.join(literal(k) for k in KEYS)});
   delete from private.v2_catalog_grants where auth_user_id='{USER}' and carrier_id='{CARRIER}' and permission='CARRIER_EDITOR';commit;'''
  cleaned=sql(cleanup);assert cleaned.returncode==0,cleaned.stderr
if __name__=='__main__':main()
