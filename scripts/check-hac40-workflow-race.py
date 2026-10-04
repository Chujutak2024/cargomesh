"""Real workflow races on the dedicated local V2 stack; never a hosted target."""
from concurrent.futures import ThreadPoolExecutor
import json,uuid
from hac40_workflow_local_fixture import prepare,cleanup,sql,literal,ORG,MEMBER,USER,CARRIER

def command(action,context,value,key=None,pause=True):
 return sql(f'''begin;set local role authenticated;set local "request.jwt.claims"='{{"sub":"{USER}","role":"authenticated"}}';
 select public.command_v2_workflow('{ORG}','{MEMBER}',{literal(action)},{literal(json.dumps(context))}::jsonb,'{key or uuid.uuid4()}',{literal(json.dumps(value))}::jsonb);
 {'select pg_sleep(0.3);' if pause else ''}commit;''')

def race(calls,expected):
 with ThreadPoolExecutor(max_workers=2) as pool:results=[f.result() for f in [pool.submit(call) for call in calls]]
 assert sum(r.returncode==0 for r in results)==1,[r.stderr for r in results]
 assert expected in next(r.stderr for r in results if r.returncode),[r.stderr for r in results]
 return results

def main():
 state=prepare();refs=state['refs'];ctx={'requestId':None,'carrierId':None,'parentId':None,'id':None}
 evidence=refs['limits']['data']['source']
 try:
  expiry=sql("select to_char(now()+interval '1 hour','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"');").stdout.strip()
  value={'schemaVersion':'2.0','bookingId':refs['booking']['id'],'assignmentId':refs['assignment']['id'],'expiresAt':expiry,'consolidationId':None,'evidence':evidence}
  calls=race([lambda:command('holds.create',ctx,value),lambda:command('holds.create',ctx,value)],'23P01')
  winner=next(r for r in calls if r.returncode==0);hold=next(json.loads(line)['record'] for line in winner.stdout.splitlines() if line.startswith('{'))
  carrier={**ctx,'carrierId':CARRIER,'id':hold['id']};audit={'schemaVersion':'2.0','expectedVersion':1,'note':'Local concurrent confirmation','evidence':evidence}
  race([lambda:command('holds.confirm',carrier,audit),lambda:command('holds.confirm',carrier,audit)],'STALE_DRAFT')
  booking={**ctx,'carrierId':CARRIER,'id':refs['booking']['id']};confirm={**audit,'carrierReference':'QA-RACE','confirmation':'CONFIRMED'}
  release={**audit,'expectedVersion':2};owner={**ctx,'id':hold['id']}
  race([lambda:command('bookings.confirm',booking,confirm),lambda:command('holds.release',owner,release)],'409')
  print('PASS: duplicate commitment: one hold; same-version confirmation: one commit/one stale; release vs booking: one transition, no confirmed booking without capacity.')
 finally:cleanup(state)

if __name__=='__main__':main()
