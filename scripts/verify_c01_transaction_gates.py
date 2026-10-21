"""Local native C-01 gates. Uses independent PostgreSQL connections, never hosted data."""
from pathlib import Path
import argparse, hashlib, json, re, subprocess, time, uuid

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--repo-root',type=Path,default=Path(__file__).resolve().parents[1])
parser.add_argument('--output',type=Path,required=True)
parser.add_argument('--container',required=True,help='Existing local Supabase Docker database container')
parser.add_argument('--local-only',action='store_true',help='Explicit acknowledgement: isolated local database test')
args=parser.parse_args()
if not args.local_only or not re.fullmatch(r'supabase_db_[A-Za-z0-9_-]+',args.container):
    parser.error('--local-only and a local supabase_db_* container are required')
ROOT=args.repo_root.resolve();OUT=args.output.resolve();CONTAINER=args.container
if not (ROOT/'supabase-v2/migration-manifest.json').is_file():parser.error('CargoMesh V2 repository not found')
OUT.mkdir(parents=True,exist_ok=True)
PREFIX = 'cargomesh_c01_' + uuid.uuid4().hex[:10]
CREATED = []
ORG = 'c2300000-0000-4000-8000-000000000001'
MEMBER = 'c2320000-0000-4000-8000-000000000003'
CLIENT = 'c2310000-0000-4000-8000-000000000002'
CARRIER_USER = 'c2310000-0000-4000-8000-000000000001'
CARRIER = 'c2340000-0000-4000-8000-000000000001'

def command(db):
    return ['docker','exec','-i',CONTAINER,'psql','-X','-qAt','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1','-v','local_only=1']

def run(db, body):
    return subprocess.run(command(db),input=body,text=True,capture_output=True,encoding='utf-8',timeout=120)

def checked(result, label):
    if result.returncode or re.search(r'^not ok ', result.stdout, re.M):
        (OUT/'C01-failure.log').write_text(result.stdout+'\n'+result.stderr,encoding='utf-8')
        raise RuntimeError(label+': '+result.stderr[-2500:]+'; see C01-failure.log')
    return result.stdout

def sql(db, body): return checked(run(db,body),'SQL gate')

def docker(*args):
    return subprocess.run(['docker','exec','-i',CONTAINER,*args],text=True,capture_output=True,encoding='utf-8',timeout=120)

def create(db, template='template0'):
    checked(docker('createdb','-U','postgres','-T',template,db),'create isolated database')
    CREATED.append(db)

def ctx(case='A', actor=CLIENT):
    return f"set search_path=c01_gate,extensions,public; set application_name='c01-{case}'; set \"gate.case\"='{case}'; set role authenticated; set \"request.jwt.claims\"='{{\"sub\":\"{actor}\",\"role\":\"authenticated\"}}';\n"

PREPARE = f"public.prepare_v2_delegated_booking('{ORG}','{MEMBER}',c01_gate.id('booking'),1,gen_random_uuid(),'PREPARE_AUTHORIZED_CAPACITY')"

def fixture(db):
    applied = set(json.loads(sql('postgres',"select coalesce(json_agg(version),'[]') from supabase_migrations.schema_migrations;")))
    schema = checked(docker('pg_dump','-U','postgres','-d','postgres','--schema-only'),'schema dump')
    restore = subprocess.run(command(db)[:command(db).index('-U')+1]+['supabase_admin']+command(db)[command(db).index('-U')+2:],input=schema,text=True,capture_output=True,encoding='utf-8',timeout=120)
    checked(restore,'schema restore')
    catalog = checked(docker('pg_dump','-U','postgres','-d','postgres','--data-only','--no-owner','--no-privileges','-t','public.cargo_categories','-t','public.equipment_types'),'reference catalog')
    sql(db,catalog)
    manifest=json.loads((ROOT/'supabase-v2/migration-manifest.json').read_text(encoding='utf-8'))
    sql(db,'\n'.join((ROOT/e['path']).read_text(encoding='utf-8') for e in manifest['migrations'] if e['version'] not in applied))
    sql(db,(ROOT/'supabase/scenarios/v2-road-baseline/seed.sql').read_text(encoding='utf-8'))
    source=(ROOT/'supabase/tests/46_v2_route_admission.test.sql').read_text(encoding='utf-8')
    marker="insert into refs select 'hold-'||n"
    assert source.count(marker)==1
    setup=source.split(marker)[0].replace('pg_temp.','c01_gate.').replace('create temporary table','create table')
    setup=setup.replace('set local search_path=extensions,public;','create schema c01_gate; grant usage,create on schema c01_gate to authenticated; set local search_path=c01_gate,extensions,public;')
    setup += "\nreset role; select * from finish(); commit;"
    output=sql(db,setup)
    (OUT/'C01-fixture.log').write_text(output,encoding='utf-8')
    # Share the catalogue, but isolate each session's request/booking references.
    sql(db,"""
set search_path=c01_gate,extensions,public;
alter table refs rename to case_refs;
alter table case_refs drop constraint refs_pkey;
alter table case_refs add column case_key text not null default 'A';
alter table case_refs alter column case_key set default coalesce(nullif(current_setting('gate.case',true),''),'A');
alter table case_refs add primary key(case_key,name);
create view refs as select name,value from case_refs where case_key=coalesce(nullif(current_setting('gate.case',true),''),'A') with local check option;
grant select,insert,update,delete on refs to authenticated;
insert into case_refs select name,value,'B' from case_refs where case_key='A';
"""
    +ctx('B',CARRIER_USER)+f"""
update refs set value=public.create_v2_freight_request('{ORG}','c2320000-0000-4000-8000-000000000001',gen_random_uuid(),private.hash_v2_freight_payload(c01_gate.req_payload()),c01_gate.req_payload()) where name='request';
select public.command_v2_freight_request('{ORG}','c2320000-0000-4000-8000-000000000001',gen_random_uuid(),c01_gate.id('request'),1,'SUBMIT',null);
"""+ctx('B')+f"""
update refs set value=public.request_v2_carrier_quote('{ORG}','{MEMBER}',c01_gate.id('request'),2,gen_random_uuid(),now()+interval '1 hour',c01_gate.multi_candidate()||jsonb_build_object('schedule',jsonb_set(c01_gate.cost_schedule(),'{{policyVersion}}','3'))) where name='auto-multi';
update refs set value=c01_gate.client_command('decisions.create',jsonb_build_object('schemaVersion','2.0','planId',q.value->>'planId','selectedOfferIds',jsonb_build_array(q.value->>'offerId'),'consideredOfferIds',jsonb_build_array(q.value->>'offerId'),'policyId',null,'rationale','C01 independent competing intent','evidence',jsonb_build_array(c01_gate.ev()))) from refs q where refs.name='decision' and q.name='auto-multi';
update refs set value=c01_gate.client_command('bookings.create',jsonb_build_object('schemaVersion','2.0','decisionId',c01_gate.id('decision'),'offerId',q.value->>'offerId','authorization','AUTHORIZE','evidence',c01_gate.ev())) from refs q where refs.name='booking' and q.name='auto-multi';
update refs set value=c01_gate.client_command('executions.create',jsonb_build_object('schemaVersion','2.0','bookingId',c01_gate.id('booking'),'serviceId','c2360000-0000-4000-8000-000000000001')) where name='execution';
update refs set value=public.read_v2_workflow('{ORG}','{MEMBER}','plans',c01_gate.ctx(null,null,null,(select (value->>'planId')::uuid from refs where name='auto-multi')),100,0)->0 where name='final-plan';
reset role;
create function c01_gate.attempt_prepare() returns jsonb language plpgsql as $fn$
begin return jsonb_build_object('state','OK','result',{PREPARE});
exception when others then return jsonb_build_object('state',sqlstate,'message',sqlerrm);end;$fn$;
""")

def tap(db,name,body):
    result=run(db,"begin;set search_path=c01_gate,extensions,public;select no_plan();\n"+body+"\nreset role;select * from finish();rollback;")
    out=checked(result,name)
    (OUT/(name+'.log')).write_text(out+'\n'+result.stderr,encoding='utf-8')
    count=sum(x.startswith('ok ') for x in out.splitlines())
    assert count>0
    return {'result':'PASS','assertions':count}

def race(db):
    # A executes the complete native atomic operation, leaving it uncommitted.
    # B starts before A commits. PostgreSQL must show B blocked by A's backend.
    a=subprocess.Popen(command(db),stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,encoding='utf-8')
    b=None
    try:
        a.stdin.write("begin;set local statement_timeout='20s';"+ctx('A')+f"select {PREPARE};select 'A_READY:'||pg_backend_pid();\n")
        a.stdin.flush()
        lines=[]
        while True:
            line=a.stdout.readline()
            if not line: raise RuntimeError('Session A failed: '+a.stderr.read()[-2000:])
            lines.append(line)
            if line.startswith('A_READY:'):
                pid=int(line.split(':')[1]);break
        b=subprocess.Popen(command(db),stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,encoding='utf-8')
        b.stdin.write("begin;set local statement_timeout='20s';"+ctx('B')+"select c01_gate.attempt_prepare();commit;\n")
        b.stdin.close();b.stdin=None
        observed=None
        for _ in range(40):
            state=json.loads(sql(db,f"select coalesce(json_agg(json_build_object('pid',pid,'wait',wait_event_type,'blockers',pg_blocking_pids(pid))),'[]') from pg_stat_activity where datname=current_database() and application_name='c01-B' and {pid}=any(pg_blocking_pids(pid));"))
            if state: observed=state[0];break
            time.sleep(.1)
        assert observed and observed['wait']=='Lock' and observed['pid']!=pid,'No independent transaction lock contention observed'
        a.stdin.write('commit;\n');a.stdin.flush();a.stdin.close();a.stdin=None
        ao,ae=a.communicate(timeout=20);bo,be=b.communicate(timeout=20)
        assert a.returncode==0 and b.returncode==0,ae+'\n'+be
        failure=json.loads(next(x for x in bo.splitlines() if x.startswith('{')))
        assert failure['state']=='PT409',failure
        (OUT/'G01-sessions.log').write_text(''.join(lines)+ao+'\nB: '+bo+'\n'+ae+be,encoding='utf-8')
        checks=tap(db,'G01-concurrency',"""
select is((select count(*)::int from public.v2_bookings where status='CONFIRMED'),1,'only one competing booking confirms');
select is((select count(*)::int from public.capacity_reservations where status='CONFIRMED'),2,'winning booking commits both physical resources');
select is((select count(distinct booking_id)::int from public.capacity_reservations),1,'losing intent leaves no partial holds');
select is((select count(*)::int from private.dispatch_booking_audit),1,'only winner records delegated authorization');
select ok(not exists(select 1 from public.capacity_reservations a join public.capacity_reservations b on a.id<b.id and a.capacity_calendar_id=b.capacity_calendar_id and tstzrange(a.starts_at,a.ends_at,'[)')&&tstzrange(b.starts_at,b.ends_at,'[)') where a.status in('HELD','CONFIRMED') and b.status in('HELD','CONFIRMED')),'no overlapping double reservation');
""")
        facts=json.loads(sql(db,"""
set search_path=c01_gate,extensions,public;
select jsonb_build_object('requestId',c01_gate.id('request'),'offerId',(select value->>'offerId' from refs where name='auto-multi'),'bookingId',c01_gate.id('booking'),
 'reservationIds',(select jsonb_agg(id order by id) from public.capacity_reservations where booking_id=c01_gate.id('booking')),
 'executionStatus',(select status from public.transport_executions where booking_id=c01_gate.id('booking')),
 'price',(select data->'price' from public.v2_carrier_offers where id=(select (value->>'offerId')::uuid from refs where name='auto-multi')),
 'weightKg',(select sum(assigned_weight_kg) from public.load_allocations where assignment_id in(select id from public.plan_resource_bindings where plan_id=(select (value->>'planId')::uuid from refs where name='auto-multi'))));
"""))
        return checks|{'independentSessions':True,'databaseLockObserved':True,'winnerPid':pid,'loserPid':observed['pid'],'conflict':failure,'syntheticWinner':facts}
    finally:
        for p in (a,b):
            if p is not None and p.poll() is None:
                p.terminate()
                try:p.communicate(timeout=5)
                except subprocess.TimeoutExpired:p.kill();p.communicate()

def atomicity(db):
    # A controlled persistence fault after first insert proves rollback inside the
    # actual native transaction. The sequence is test-only, nontransactional evidence.
    return tap(db,'G02-atomicity',"""
create sequence c01_gate.insert_attempts;
create function c01_gate.fail_second() returns trigger language plpgsql set search_path=c01_gate,extensions,public as $fn$
begin
 if nextval('c01_gate.insert_attempts')=2 then
  if (select count(*) from public.capacity_reservations where booking_id=new.booking_id)<>1 then raise exception 'FIRST_RESOURCE_NOT_WRITTEN';end if;
  raise exception 'SECOND_RESOURCE_CHANGED' using errcode='PT409';
 end if;
 return new;
end;$fn$;
create trigger c01_test_fault before insert on public.capacity_reservations for each row execute function c01_gate.fail_second();
"""+ctx()+"""
select is(c01_gate.attempt_prepare()->>'message','SECOND_RESOURCE_CHANGED','failure is reached while inserting the second native resource');
reset role;
select is((select last_value from c01_gate.insert_attempts),2::bigint,'both native resource insertions were attempted');
select is((select count(*)::int from public.capacity_reservations),0,'first resource is rolled back after second resource failure');
select is((select status from public.v2_bookings where id=c01_gate.id('booking')),'AUTHORIZED','booking is never partially confirmed');
select is((select count(*)::int from private.dispatch_booking_audit),0,'failed operation leaves no confirmation audit');
select is((select count(*)::int from private.quote_command_receipts where scope='dispatch-booking'),0,'failed operation leaves no success receipt');
drop trigger c01_test_fault on public.capacity_reservations;
"""+ctx(actor=CARRIER_USER)+f"""
select public.command_v2_catalog('{ORG}','c2320000-0000-4000-8000-000000000001','maintenances','{CARRIER}',null,null,gen_random_uuid(),null,(select value from fixtures where kind='maintenances')||jsonb_build_object('assetId',c01_gate.id('asset-2'),'blockedWindow',c01_gate.cost_schedule()->'operationWindow'));
"""+ctx()+"""
select is(c01_gate.attempt_prepare()->>'state','PT409','real maintenance published after quoting blocks delegated confirmation');
reset role;
select is((select count(*)::int from public.capacity_reservations),0,'unavailable second truck leaves neither truck reserved');
select is((select status from public.v2_bookings where id=c01_gate.id('booking')),'AUTHORIZED','maintenance conflict leaves the commercial authorization unconfirmed');
""")

def commercial(db):
    cases={}
    # A persisted expired fixture is created with the test owner; clients cannot
    # update an issued offer. This exercises the clock/validity branch directly.
    cases['expiredOffer']=tap(db,'G03-expired-offer',"""
update public.v2_carrier_offers set data=jsonb_set(data,'{validity,endsAt}',to_jsonb((now()-interval '1 second')::text)) where id=(select (value->>'offerId')::uuid from refs where name='auto-multi');
"""+ctx()+"""
select is(c01_gate.attempt_prepare()->>'message','PLAN_OR_OFFER_NOT_CURRENT','expired issued offer cannot confirm');
reset role;
select is((select count(*)::int from public.capacity_reservations),0,'expired offer creates no physical reservation');
select is((select status from public.v2_bookings where id=c01_gate.id('booking')),'AUTHORIZED','expired offer never changes booking to confirmed');
""")
    cases['priceIntegrity']=tap(db,'G03-price-integrity',ctx()+"""
select throws_ok($q$update public.v2_carrier_offers set data=jsonb_set(data,'{price,amount}','1') where id=(select (value->>'offerId')::uuid from refs where name='auto-multi')$q$,'42501',null,'Client cannot overwrite issued price directly');
"""+ctx(actor=CARRIER_USER)+f"""
select throws_ok($q$update public.v2_carrier_offers set data=jsonb_set(data,'{{price,amount}}','1') where id=(select (value->>'offerId')::uuid from refs where name='auto-multi')$q$,'42501',null,'Carrier cannot overwrite an accepted issued price directly');
-- Keep the full native offer schema, changing its price/breakdown consistently.
select throws_ok($q$select c01_gate.w('offers.create',
 (select jsonb_build_object('schemaVersion','2.0')||jsonb_object_agg(k,case when k='source' then v-'issuerId' else v end) from public.read_v2_workflow('{ORG}','c2320000-0000-4000-8000-000000000001','offers',c01_gate.ctx(null,'{CARRIER}',null,(select (value->>'offerId')::uuid from refs where name='auto-multi')),100,0) records cross join lateral jsonb_each(records->0->'data') kv(k,v) where k in('carrierReference','planCandidateId','coveredServiceIds','coveredAssignmentIds','price','breakdown','validity','source','issuedAt','estimatedPickupAt','estimatedDeliveryAt','transitDurationSeconds','reservableCapacity','commercialTerms','evidence','supersedesOfferId'))
 ||jsonb_build_object('supersedesOfferId',(select value->>'offerId' from refs where name='auto-multi'),'price',jsonb_build_object('amount',999,'currency','USD'),'breakdown',jsonb_build_array(jsonb_build_object('kind','TRANSPORT','amount',jsonb_build_object('amount',999,'currency','USD'),'treatment','QUOTED','source',c01_gate.ev(),'observedAt','2020-01-01T00:00:00Z','details',null))),
 c01_gate.ctx(null,'{CARRIER}',(select (value->>'opportunityId')::uuid from refs where name='auto-multi')))$q$,'PT409','OFFER_CANNOT_SUPERSEDE','Carrier price revision cannot replace the Client-selected offer');
reset role;
select is((select (data#>>'{{price,amount}}')::numeric from public.v2_carrier_offers where id=(select (value->>'offerId')::uuid from refs where name='auto-multi')),310.80::numeric,'selected price remains exactly the authorized price');
""")
    cases['staleBooking']=tap(db,'G03-stale-booking',ctx()+f"""
select throws_ok($q$select public.prepare_v2_delegated_booking('{ORG}','{MEMBER}',c01_gate.id('booking'),99,gen_random_uuid(),'PREPARE_AUTHORIZED_CAPACITY')$q$,'PT409','STALE_DRAFT','obsolete booking version cannot confirm');
reset role;
select is((select count(*)::int from public.capacity_reservations),0,'stale booking leaves no resources');
""")
    cases['stalePlan']=tap(db,'G03-stale-plan',"insert into refs select 'live-corridor',to_jsonb(r) from public.route_corridors r where id=c01_gate.id('corridor');"+ctx(actor=CARRIER_USER)+"""
select c01_gate.w('corridors.publish',jsonb_build_object('expectedVersion',(select (value->>'version')::integer from refs where name='live-corridor'),'value',(select value->'data' from refs where name='live-corridor')||jsonb_build_object('version','QA-CHANGED')),c01_gate.ctx(null,null,null,c01_gate.id('corridor')));
"""+ctx()+"""
select is(c01_gate.attempt_prepare()->>'message','PLAN_OR_OFFER_NOT_CURRENT','versioned corridor change invalidates old quoted plan');
reset role;
select is((select count(*)::int from public.capacity_reservations),0,'stale route creates no holds');
""")
    cases['changedTariff']=tap(db,'G03-changed-tariff',ctx(actor=CARRIER_USER)+f"""
select public.configure_v2_quote_policy('{CARRIER}',c01_gate.op(),gen_random_uuid(),3,jsonb_set((select value->'value' from refs where name='fleet-policy'),'{{operatingCosts,fuelPricePerLitre}}','2.5'));
"""+ctx()+f"""
select is({PREPARE},null::jsonb,'changed tariff revokes automatic authority for old policy snapshot');
reset role;
select is((select count(*)::int from public.capacity_reservations),0,'policy mismatch cannot silently reserve at a new price');
select is((select status from public.v2_bookings where id=c01_gate.id('booking')),'AUTHORIZED','changed policy returns control to manual review');
""")
    return {'result':'PASS','assertions':sum(x['assertions'] for x in cases.values()),'cases':cases}

def isolation(db):
    foreign_client='c2310000-0000-4000-8000-000000000003'
    foreign_carrier='c2310000-0000-4000-8000-000000000004'
    foreign_org='c2300000-0000-4000-8000-000000000002'
    foreign_member='c2320000-0000-4000-8000-000000000004'
    carrier_member='c2320000-0000-4000-8000-000000000005'
    other_carrier='c2390000-0000-4000-8000-000000000001'
    return tap(db,'G04-organization-isolation',f"""
insert into auth.users(id,aud,role) values('{foreign_client}','authenticated','authenticated'),('{foreign_carrier}','authenticated','authenticated');
insert into public.organization_members(id,organization_id,auth_user_id,display_name,corporate_email,role,status) values
 ('{foreign_member}','{foreign_org}','{foreign_client}','Synthetic isolated Client','isolated-client@cargomesh.test','SUPERVISOR','ACTIVE'),
 ('{carrier_member}','{foreign_org}','{foreign_carrier}','Synthetic isolated Carrier','isolated-carrier@cargomesh.test','SUPERVISOR','ACTIVE');
insert into public.carrier_operators(id,carrier_id,auth_user_id,display_name,role,status,verified_at) values('c2320000-0000-4000-8000-000000000006','{other_carrier}','{foreign_carrier}','Synthetic other Carrier','ADMIN','ACTIVE',now());
insert into private.v2_catalog_grants(auth_user_id,permission,carrier_id) values('{foreign_carrier}','CARRIER_EDITOR','{other_carrier}');
"""+ctx(actor=foreign_client)+f"""
select throws_ok($q$select public.read_v2_workflow('{ORG}','{MEMBER}','bookings',c01_gate.ctx(null,null,null,c01_gate.id('booking')),100,0)$q$,'PT403','FORBIDDEN_WORKFLOW','foreign Client cannot impersonate owning membership');
select is(public.read_v2_workflow('{foreign_org}','{foreign_member}','bookings',c01_gate.ctx(null,null,null,c01_gate.id('booking')),100,0),'[]'::jsonb,'foreign Client sees no booking through its own valid membership');
select throws_ok($q$select public.prepare_v2_delegated_booking('{foreign_org}','{foreign_member}',c01_gate.id('booking'),1,gen_random_uuid(),'PREPARE_AUTHORIZED_CAPACITY')$q$,'PT404','WORKFLOW_NOT_FOUND','foreign Client cannot authorize booking from another organization');
select throws_ok($q$select public.read_v2_carrier_cost_calculation('{CARRIER}',c01_gate.op(),(select (value->>'offerId')::uuid from refs where name='auto-multi'))$q$,'PT403',null,'foreign Client cannot read Carrier internal cost snapshot');
select throws_ok($q$select * from private.quote_issued_offers$q$,'42501',null,'foreign Client cannot bypass private snapshot RPC');
"""+ctx(actor=foreign_carrier)+f"""
select is(public.read_v2_workflow('{foreign_org}','{carrier_member}','offers',c01_gate.ctx(null,'{other_carrier}',null,(select (value->>'offerId')::uuid from refs where name='auto-multi')),100,0),'[]'::jsonb,'different Carrier sees no private offer with its own valid identity');
select throws_ok($q$select public.read_v2_carrier_cost_calculation('{CARRIER}','c2320000-0000-4000-8000-000000000006',(select (value->>'offerId')::uuid from refs where name='auto-multi'))$q$,'PT403',null,'different Carrier cannot read competitor cost profiles');
select throws_ok($q$select public.command_v2_workflow('{foreign_org}','{carrier_member}','bookings.confirm',c01_gate.ctx(null,'{other_carrier}',null,c01_gate.id('booking')),gen_random_uuid(),jsonb_build_object('schemaVersion','2.0','expectedVersion',1,'note','Foreign attempt','evidence',c01_gate.ev(),'carrierReference','FOREIGN','confirmation','CONFIRMED'))$q$,'PT404','WORKFLOW_NOT_FOUND','different Carrier cannot confirm another Carrier booking');
reset role;
select is((select count(*)::int from public.capacity_reservations),0,'foreign attempts produce no reservations');
select is((select status from public.v2_bookings where id=c01_gate.id('booking')),'AUTHORIZED','foreign attempts leave authorized Client booking unchanged');
""")

RESULTS={}
try:
    base=PREFIX+'_base';create(base);fixture(base)
    for key,fn in [('G01',race),('G02',atomicity),('G03',commercial),('G04',isolation)]:
        db=PREFIX+'_'+key.lower();create(db,base)
        RESULTS[key]=fn(db)
        print(key+': '+json.dumps(RESULTS[key]),flush=True)
    (OUT/'C01-GATES.json').write_text(json.dumps({'localOnly':True,'productionWrites':False,'assertions':sum(x['assertions'] for x in RESULTS.values()),'reproducerSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'gates':RESULTS},indent=2),encoding='utf-8')
finally:
    for db in reversed(CREATED):
        assert re.fullmatch(r'cargomesh_c01_[a-f0-9]{10}_(base|g0[1-4])',db)
        checked(docker('dropdb','-U','postgres',db),'drop own isolated database')
    print('Own isolated databases removed.',flush=True)
