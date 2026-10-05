from local import *
from concurrent.futures import ThreadPoolExecutor
import uuid
ORG='d4400000-0000-4000-8000-000000000001';MEMBER='d4420000-0000-4000-8000-000000000001';USER='d4410000-0000-4000-8000-000000000001';CARRIER='d4440000-0000-4000-8000-000000000001'
def literal(v):return "'"+str(v).replace("'","''")+"'"
def command(label,action,ctx,value,key=None):
 return sql(label,"\\set VERBOSITY verbose\nbegin;set local role authenticated;set local \"request.jwt.claims\"="+literal(json.dumps({'sub':USER,'role':'authenticated'}))+";select public.command_v2_workflow("+','.join([literal(ORG),literal(MEMBER),literal(action),literal(json.dumps(ctx))+'::jsonb',literal(key or uuid.uuid4()),literal(json.dumps(value))+'::jsonb'])+");select pg_sleep(0.3);commit;")
def race(label,calls,error):
 with ThreadPoolExecutor(max_workers=2) as pool:results=[f.result() for f in [pool.submit(c) for c in calls]]
 passed=sum(r.returncode==0 for r in results)==1 and error in next((r.stderr for r in results if r.returncode),'')
 return {'case':label,'status':'PASS' if passed else 'FAIL','positiveCommits':sum(r.returncode==0 for r in results),'rejected':sum(r.returncode!=0 for r in results),'expectedError':error,'outputs':[{'exit':r.returncode,'stdout':r.stdout,'stderr':r.stderr} for r in results]}
def main():
 if len(sys.argv)>1:
  refs=json.loads((LOGS/'race-refs.json').read_text(encoding='utf-8'));cases=json.loads((LOGS/'independent-races.json').read_text(encoding='utf-8'))[:4]
  return offer_race(refs,cases)
 source=(OUT/'dataset/workflow-seed.sql').read_text(encoding='utf-8').replace('HAC44_WORKFLOW_QA','HAC44_RACE_QA').replace('QA-001','HAC44-RACE-001').replace('QA-1','HAC44-RACE-1')
 p=sql('race-seed',source);assert p.returncode==0
 refs=json.loads(next(l.split('HAC44_REFS:',1)[1] for l in p.stdout.splitlines() if l.startswith('HAC44_REFS:')));save('race-refs.json',refs)
 ctx={'requestId':None,'carrierId':None,'parentId':None,'id':None};ev=refs['limits']['data']['source']
 expiry=sql('race-clock',"select to_char(now()+interval '1 hour','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"');").stdout.strip()
 value={'schemaVersion':'2.0','bookingId':refs['booking']['id'],'assignmentId':refs['assignment']['id'],'expiresAt':expiry,'consolidationId':None,'evidence':ev}
 cases=[race('duplicate-reservation',[lambda:command('race-hold-a','holds.create',ctx,value),lambda:command('race-hold-b','holds.create',ctx,value)],'23P01')]
 winner=next(x for x in cases[0]['outputs'] if x['exit']==0);hold=next(json.loads(l)['record'] for l in winner['stdout'].splitlines() if l.startswith('{'))
 carrier={**ctx,'carrierId':CARRIER,'id':hold['id']};audit={'schemaVersion':'2.0','expectedVersion':1,'note':'HAC44 independent concurrent transition','evidence':ev}
 cases.append(race('same-version-confirmation',[lambda:command('race-confirm-a','holds.confirm',carrier,audit),lambda:command('race-confirm-b','holds.confirm',carrier,audit)],'STALE_DRAFT'))
 booking={**ctx,'carrierId':CARRIER,'id':refs['booking']['id']};owner={**ctx,'id':hold['id']}
 cases.append(race('booking-versus-release',[lambda:command('race-booking','bookings.confirm',booking,{**audit,'carrierReference':'HAC44-RACE','confirmation':'CONFIRMED'}),lambda:command('race-release','holds.release',owner,{**audit,'expectedVersion':2})],'PT409'))
 p=sql('race-final-invariant',f"select jsonb_build_object('bookingStatus',b.status,'holdStatus',r.status,'coherent',not(b.status='CONFIRMED' and r.status<>'CONFIRMED')) from public.v2_bookings b join public.capacity_reservations r on r.booking_id=b.id where b.id='{refs['booking']['id']}';")
 invariant=json.loads(p.stdout);cases.append({'case':'coherent-booking-capacity','status':'PASS' if invariant['coherent'] else 'FAIL','evidence':invariant})
 return offer_race(refs,cases)
def offer_race(refs,cases):
 # Two concurrent issuances with one idempotency key must return one physical offer.
 def project(v,s):
  if s.get('type')=='ZodObject':return {k:project(v[k],t) for k,t in s['fields'].items() if k in v}
  if s.get('type')=='ZodArray':return [project(x,s['element']) for x in v]
  return v
 schema=json.loads((LOGS/'schema-trees.json').read_text(encoding='utf-8'))['workflow.ts:WorkflowInputsV2:offers.create'];offer=project(dict(refs['offer']['data']),schema);offer['schemaVersion']='2.0';offer['supersedesOfferId']=None
 ctx={'requestId':None,'carrierId':None,'parentId':None,'id':None}
 key=str(uuid.uuid4());c={**ctx,'carrierId':CARRIER,'parentId':refs['opportunity']['id']}
 with ThreadPoolExecutor(max_workers=2) as pool:rs=[f.result() for f in [pool.submit(command,'race-offer-'+n,'offers.create',c,offer,key) for n in ('a','b')]]
 records=[next((json.loads(l) for l in r.stdout.splitlines() if l.startswith('{')),None) for r in rs]
 ok=all(r.returncode==0 for r in rs) and records[0]['record']['id']==records[1]['record']['id'] and sorted(r['replay'] for r in records)==[False,True]
 cases.append({'case':'offer-idempotency-concurrent','status':'PASS' if ok else 'FAIL','outputs':[{'exit':r.returncode,'stdout':r.stdout,'stderr':r.stderr} for r in rs]})
 save('independent-races.json',cases);print(json.dumps({'cases':len(cases),'statuses':[x['status'] for x in cases]}));assert all(c['status']=='PASS' for c in cases)
if __name__=='__main__':main()
