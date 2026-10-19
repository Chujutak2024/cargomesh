from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import subprocess,json,uuid,argparse,re
parser=argparse.ArgumentParser()
parser.add_argument('--database',required=True)
parser.add_argument('--evidence-dir',required=True)
args=parser.parse_args()
assert re.fullmatch(r'hac50_scenario_border_[a-z0-9_]+',args.database)
HERE=Path(args.evidence_dir).resolve();HERE.mkdir(parents=True,exist_ok=True)
DB=args.database
BASE=['docker','exec','-i','supabase_db_hac45-carrier-local','psql','-X','-At','-v','ON_ERROR_STOP=1','-U','postgres','-d',DB]
C='e5000001-0000-4000-8000-000000000005';OP='e5000003-0000-4000-8000-000000000005'
AUTH="set local role authenticated;set local request.jwt.claims='{\"sub\":\"e5000002-0000-4000-8000-000000000005\",\"role\":\"authenticated\"}';"
def query(text,check=True):
 p=subprocess.run(BASE,input=text.encode(),capture_output=True)
 if check and p.returncode:raise RuntimeError(p.stderr.decode()[-1500:])
 return p
def data(p):return [json.loads(line) for line in p.stdout.decode().splitlines() if line.startswith('{')]
def lit(v):return "'"+json.dumps(v).replace("'","''")+"'::jsonb"
def call(action,value=None,version=None,crossing=None,key=None):
 def u(v):return "'"+v+"'" if v else 'null'
 return f"select public.border_operations_v2('{OP}','{C}','{action}',{u(crossing)},{version if version is not None else 'null'},{u(key)},{lit(value) if value is not None else 'null'});"
def execute(command,delay=False):return query('begin;'+AUTH+command+('select pg_sleep(0.2);' if delay else '')+'commit;',False)
marker=query("select shobj_description(oid,'pg_database') from pg_database where datname=current_database();").stdout.strip()
assert marker==b'LOCAL_ONLY:v2-carrier-fleet-80'
context=data(query("select jsonb_build_object('schemaVersion','2.0','serviceId',carrier_service_id,'laneId',id,'executionId',null,'operationReference','SIMULATED:border:race', 'routeFingerprint',repeat('c',64),'fromCountry','GT','toCountry','SV','checkpointReference','SIMULATED test checkpoint','window',jsonb_build_object('startsAt',now()-interval '1 hour','endsAt',now()+interval '1 day'),'requiredDocuments',jsonb_build_array('MANIFEST'),'provenance','SIMULATED') from public.service_lanes where carrier_service_id='e5000005-0000-4000-8000-000000000051' order by id limit 1;"))[0]
context['operationReference']='SIMULATED:border:race:'+str(uuid.uuid4())
docs=data(query("select jsonb_build_object('code','MANIFEST','reference','SIMULATED:manifest','checkedAt',now()-interval '2 hours','validUntil',now()+interval '2 days');"))
ids=[]
try:
 key=str(uuid.uuid4());create=call('create',context,0,key=key)
 with ThreadPoolExecutor(2) as pool:results=list(pool.map(lambda _:execute(create,True),range(2)))
 assert all(p.returncode==0 for p in results)
 first,second=[data(p)[0] for p in results]
 crossing=first['data']['id'];ids.append(crossing)
 assert crossing==second['data']['id'] and sorted([first['replay'],second['replay']])==[False,True]
 assert execute(call('review',{'status':'IN_REVIEW','documents':docs,'note':'SIMULATED review'},1,crossing,str(uuid.uuid4()))).returncode==0
 commands=[call('review',{'status':s,'documents':docs,'note':'SIMULATED concurrent review'},2,crossing,str(uuid.uuid4())) for s in ['APPROVED','NEEDS_DOCUMENTS']]
 with ThreadPoolExecutor(2) as pool:results=list(pool.map(lambda cmd:execute(cmd,True),commands))
 assert sum(p.returncode==0 for p in results)==1
 assert sum(b'STALE_DRAFT' in p.stderr for p in results)==1
 current=data(execute(call('read',crossing=crossing)))[0]['data']
 if current['reviewStatus']=='NEEDS_DOCUMENTS':
  execute(call('review',{'status':'IN_REVIEW','documents':docs,'note':'SIMULATED resubmission'},3,crossing,str(uuid.uuid4())))
  current=data(execute(call('review',{'status':'APPROVED','documents':docs,'note':'SIMULATED approval'},4,crossing,str(uuid.uuid4()))))[0]['data']
 native=[]
 # Read real PostgreSQL projections and compare SQL document readiness to the pure TypeScript policy.
 for label,change in [('complete',None),('missing',"'[]'::jsonb"),('expired',"jsonb_set(documents,'{0,validUntil}',to_jsonb(now()-interval '1 minute'))")]:
  mutation=f"update public.carrier_border_crossings set documents={change} where id='{crossing}';" if change else ''
  q=f"begin;{mutation}select jsonb_build_object('label','{label}','now',now(),'record',private.border_record(t),'sqlReady',private.border_documents_current(context,documents)) from public.carrier_border_crossings t where id='{crossing}';rollback;"
  native.extend(data(query(q)))
 (HERE/'native-readback.json').write_text(json.dumps(native,indent=2)+'\n')
 print(json.dumps({'concurrentIdempotentCreate':True,'concurrentRevisionOneWinner':True,'staleWriterConflict':True,'nativePolicyCases':len(native),'hostedChanges':False}))
finally:
 for crossing in ids:
  # Exact records created by this runner in the marked disposable bank only.
  assert uuid.UUID(crossing)
  query(f"begin;delete from private.border_command_receipts where result#>>'{{data,id}}'='{crossing}';delete from private.border_command_events where crossing_id='{crossing}';delete from public.carrier_border_crossings where id='{crossing}' and context->>'operationReference'='{context['operationReference']}';commit;")
