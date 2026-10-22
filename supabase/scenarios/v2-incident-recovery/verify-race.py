"""Real concurrent native commands, exclusively in the runner's disposable local database."""
import argparse,concurrent.futures,json,re,subprocess,uuid
from pathlib import Path
p=argparse.ArgumentParser()
for name in ['container','database','organization','member','carrier','operator','execution','request-file']:p.add_argument('--'+name,required=True)
p.add_argument('--local-only',action='store_true');a=p.parse_args()
if not a.local_only or not re.fullmatch(r'cargomesh_c01_dataset_[a-f0-9]{10}',a.database) or not re.fullmatch(r'supabase_db_[A-Za-z0-9_-]+',a.container):p.error('Disposable local C01 database required')
for name in ['organization','member','carrier','operator','execution']:uuid.UUID(getattr(a,name))
def literal(v):return "'"+v.replace("'","''")+"'"
def sql(body):return subprocess.run(['docker','exec','-i',a.container,'psql','-X','-qAt','-U','postgres','-d',a.database,'-v','ON_ERROR_STOP=1'],input=body,capture_output=True,text=True,encoding='utf-8',timeout=15)
def checked(r):
 if r.returncode:raise RuntimeError(r.stderr)
 return r.stdout
facts=json.loads(checked(sql("select jsonb_build_object('client',(select auth_user_id from public.organization_members where id='"+a.member+"'),'carrier',(select auth_user_id from public.carrier_operators where id='"+a.operator+"'),'reservations',(select jsonb_agg(id order by id) from public.capacity_reservations where execution_id='"+a.execution+"' and parent_reservation_id is null));")))
def session(who):return 'begin;set local statement_timeout=10000;set local role authenticated;select set_config(\'request.jwt.claims\','+literal(json.dumps({'sub':facts[who],'role':'authenticated'}))+',true);'
evidence={'reference':'simulation:recovery-race','provider':'Recovery local fixture','observedAt':'2026-10-21T00:00:00Z','validUntil':'2026-11-04T00:00:00Z','provenanceStatus':'SIMULATED'}
incidents=[]
for n in range(2):
 v={'schemaVersion':'2.0','kind':'Carrier accident','severity':'CRITICAL','occurredAt':'2026-10-21T00:00:00Z','location':None,'description':'SYNTHETIC concurrency fixture','evidence':[evidence]}
 ctx={'requestId':None,'carrierId':a.carrier,'parentId':a.execution,'id':None}
 r=checked(sql(session('carrier')+"select public.command_v2_carrier_workflow('"+a.operator+"','incidents.create',"+literal(json.dumps(ctx))+"::jsonb,'"+str(uuid.uuid4())+"',"+literal(json.dumps(v))+"::jsonb);commit;"))
 incidents.append(next(json.loads(line)['record']['id'] for line in r.splitlines() if line.startswith('{') and 'record' in json.loads(line)))
request=json.loads(Path(a.request_file).read_text())
def run(n,key):
 value={'schemaVersion':'2.0','expectedIncidentVersion':1,'cause':'CARRIER_ACCIDENT','reservationIds':[facts['reservations'][n]],'origin':{'label':request['origin'].get('label','Synthetic pickup'),'countryCode':'PE','city':'Lima'},'pickupWindow':request['pickupWindow'],'deliveryWindow':request['deliveryWindow'],'timeZone':'America/Lima','consent':'AUTHORIZE_RECOVERY_SEARCH'}
 return sql(session('client')+"select public.create_v2_incident_recovery('"+a.organization+"','"+a.member+"','"+incidents[n]+"','"+key+"',"+literal(json.dumps(value))+"::jsonb);select pg_sleep(0.5);commit;")
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 key=str(uuid.uuid4());same=list(pool.map(lambda _:run(0,key),range(2)))
 results=[next(json.loads(line) for line in checked(r).splitlines() if line.startswith('{') and 'replacementRequestId' in json.loads(line)) for r in same]
 assert results[0]['id']==results[1]['id']
 different=list(pool.map(lambda _:run(1,str(uuid.uuid4())),range(2)))
 assert sum(r.returncode==0 for r in different)==1
 assert any('RECOVERY_NOT_ALLOWED' in r.stderr for r in different if r.returncode)
counts=json.loads(checked(sql("select jsonb_build_object('cases',(select count(*) from public.incident_recoveries),'allocations',(select count(*) from public.incident_recovery_reservations));")))
assert counts=={'cases':2,'allocations':2},counts
print(json.dumps({'result':'PASS','sameKeySameCase':True,'differentKeysOneWinner':True,'counts':counts,'localOnly':True,'hostedWrites':0}))
