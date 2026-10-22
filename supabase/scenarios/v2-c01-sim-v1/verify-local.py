from pathlib import Path
import argparse,hashlib,json,re,subprocess,uuid

parser=argparse.ArgumentParser(description='Validate C01 manifest and one native flow in an isolated local database only.')
parser.add_argument('--repo-root',type=Path,default=Path(__file__).resolve().parents[3])
parser.add_argument('--output',type=Path,required=True)
parser.add_argument('--container',required=True)
parser.add_argument('--local-only',action='store_true')
parser.add_argument('--extra-flow',type=Path,help='Additional controlled assertions inside the isolated C01 transaction; never hosted.')
parser.add_argument('--extra-check',type=Path,help='Additional standalone pgTAP contract in the same temporary database.')
parser.add_argument('--recovery-race',action='store_true',help='Commit only the temporary C01 fixture and test concurrent recovery commands there.')
args=parser.parse_args()
if not args.local_only or not re.fullmatch(r'supabase_db_[A-Za-z0-9_-]+',args.container):parser.error('--local-only and a local supabase_db_* container required')
ROOT=args.repo_root.resolve();SOURCE=Path(__file__).resolve().parent;OUT=args.output.resolve();OUT.mkdir(parents=True,exist_ok=True)
CONTAINER=args.container;DB='cargomesh_c01_dataset_'+uuid.uuid4().hex[:10]
manifest_text=(SOURCE/'C01-SIM-v1.json').read_text(encoding='utf-8')
# Git's Windows CRLF checkout must preserve the reviewed LF artifact hash.
manifest=json.loads(manifest_text);digest=hashlib.sha256(manifest_text.encode('utf-8')).hexdigest()
validation=subprocess.run(['node','--conditions=react-server','--import','tsx',str(SOURCE/'validate-manifest.cjs'),str(ROOT),str(SOURCE/'C01-SIM-v1.json'),str(OUT/'MANIFEST-VALIDATION.json')],cwd=ROOT/'cargomesh',capture_output=True,text=True,encoding='utf-8',timeout=60)
if validation.returncode:raise RuntimeError('Manifest schema validation failed: '+validation.stderr[-2000:])
print(validation.stdout.strip(),flush=True)
def docker(args,body=None):return subprocess.run(['docker','exec','-i',CONTAINER,*args],input=body,text=True,capture_output=True,encoding='utf-8',timeout=120)
def sql(body,db=DB,user='postgres'):return docker(['psql','-X','-qAt','-U',user,'-d',db,'-v','ON_ERROR_STOP=1','-v','local_only=1','-v','c01_expected_sha256='+digest],body)
def checked(r,label):
 if r.returncode or re.search(r'^not ok ',r.stdout,re.M):
  (OUT/'LOCAL-FAILURE.log').write_text(r.stdout+'\n'+r.stderr,encoding='utf-8');raise RuntimeError(label+': '+r.stderr[-2000:]+'; see LOCAL-FAILURE.log')
 return r.stdout
created=False
try:
 applied=set(json.loads(checked(sql("select coalesce(json_agg(version),'[]') from supabase_migrations.schema_migrations;",'postgres'),'local ledger')))
 checked(docker(['createdb','-U','postgres','-T','template0',DB]),'temporary database');created=True
 schema=checked(docker(['pg_dump','-U','postgres','-d','postgres','--schema-only']),'schema')
 checked(sql(schema,user='supabase_admin'),'restore schema')
 reference=checked(docker(['pg_dump','-U','postgres','-d','postgres','--data-only','--no-owner','--no-privileges','-t','public.cargo_categories','-t','public.equipment_types']),'reference')
 checked(sql(reference),'restore normative catalogue')
 entries=json.loads((ROOT/'supabase-v2/migration-manifest.json').read_text(encoding='utf-8'))['migrations']
 checked(sql('\n'.join((ROOT/e['path']).read_text(encoding='utf-8') for e in entries if e['version'] not in applied)),'pending local DDL')
 checked(sql((ROOT/'supabase/scenarios/v2-road-baseline/seed.sql').read_text(encoding='utf-8')),'local guarded baseline')
 # Mirror ONLY known identity metadata. Auth IDs below are generated for this
 # isolated database and never included in a production manifest or credentials.
 c=manifest['existingReferences']['client'];r=manifest['existingReferences']['carrier']
 checked(sql(f"""
insert into public.organizations(id,code,name,status,default_currency) values('{c['organizationId']}','{c['expectedCode']}','[SYNTHETIC] Pacific Produce','ACTIVE','USD');
insert into public.carriers(id,code,name,provider_type,status,supports_webmcp) values('{r['carrierId']}','{r['expectedCode']}','[SYNTHETIC] HAC44 ROAD','CARRIER','ACTIVE',false);
with u as(insert into auth.users(id,aud,role) values(gen_random_uuid(),'authenticated','authenticated') returning id)
insert into public.organization_members(id,organization_id,auth_user_id,display_name,corporate_email,role,status) select '{c['memberId']}','{c['organizationId']}',id,'Synthetic C01 Client','c01-client@example.invalid','SUPERVISOR','ACTIVE' from u;
with u as(insert into auth.users(id,aud,role) values(gen_random_uuid(),'authenticated','authenticated') returning id)
insert into public.carrier_operators(id,carrier_id,auth_user_id,display_name,role,status,verified_at) select '{r['operatorId']}','{r['carrierId']}',id,'Synthetic C01 Carrier ADMIN','ADMIN','ACTIVE',now() from u;
insert into private.v2_catalog_grants(auth_user_id,permission,carrier_id) select auth_user_id,'CARRIER_EDITOR',carrier_id from public.carrier_operators where id='{r['operatorId']}';
-- A catalog administrator already exists in the guarded baseline.
insert into private.v2_catalog_grants(auth_user_id,permission) values('c2310000-0000-4000-8000-000000000001','CATALOG_ADMIN') on conflict do nothing;
 insert into public.organizations(id,code,name,status,default_currency) values('e4400000-0000-4000-8000-000000000001','HAC44-PREP-A','[SYNTHETIC] HAC44 A','ACTIVE','USD');
 insert into public.organization_members(id,organization_id,auth_user_id,display_name,corporate_email,role,status) values('e4420000-0000-4000-8000-000000000001','e4400000-0000-4000-8000-000000000001','c2310000-0000-4000-8000-000000000001','Synthetic existing technical catalog member','catalog-c01@example.invalid','SUPERVISOR','ACTIVE');
create schema c01_verification;
create table c01_verification.history(table_name text,id uuid,snapshot jsonb);
do $h$declare t text;begin
 foreach t in array array['organizations','organization_members','carriers','carrier_operators','facilities','carrier_services','service_areas','service_lanes','transport_assets','drivers','capacity_calendars','route_resource_limits','route_corridors'] loop
  execute format('insert into c01_verification.history select %L,id,to_jsonb(x) from public.%I x',t,t);
 end loop;end;$h$;
"""),'local identity metadata')
 activations=[]
 for n in [1,2]:
  output=checked(sql((SOURCE/'seed.sql').read_text(encoding='utf-8')),f'activation {n}')
  (OUT/f'LOCAL-ACTIVATION-{n}.log').write_text(output,encoding='utf-8')
  result=json.loads(next(line for line in output.splitlines() if line.startswith('{"')))
  activations.append(result)
 assert activations[0]['references']==activations[1]['references'],'Replay must conserve generated record IDs'
 (OUT/'LOCAL-REFERENCES.json').write_text(json.dumps(activations[0],indent=2),encoding='utf-8')
 refs=activations[0]['references']
 checked(sql("create table c01_verification.refs(name text primary key,id uuid);insert into c01_verification.refs select key,value::uuid from jsonb_each_text('"+json.dumps(refs)+"');grant usage on schema c01_verification to authenticated;grant select on c01_verification.refs to authenticated;"),'native references')
 (OUT/'LOCAL-REQUEST.json').write_text(json.dumps(activations[0]['requestTemplate'],indent=2),encoding='utf-8')
 case=(SOURCE/'verify-flow.sql').read_text(encoding='utf-8').replace('__REQUEST__',json.dumps(activations[0]['requestTemplate'])).replace('__CREW_TEMPLATES__',json.dumps(manifest['postBookingAssignments']['operations'])).replace('__ORG__',c['organizationId']).replace('__MEMBER__',c['memberId']).replace('__CARRIER__',r['carrierId']).replace('__OPERATOR__',r['operatorId'])
 if args.extra_flow:
  extra=args.extra_flow.resolve().read_text(encoding='utf-8').replace('__ORG__',c['organizationId']).replace('__MEMBER__',c['memberId']).replace('__CARRIER__',r['carrierId']).replace('__OPERATOR__',r['operatorId'])
  case=case.replace('select * from finish();',extra+'\nselect * from finish();')
 if args.extra_check:
  (OUT/'LOCAL-RECOVERY-CONTRACT.log').write_text(checked(sql(args.extra_check.resolve().read_text(encoding='utf-8')),'recovery SQL contract'),encoding='utf-8')
 if args.recovery_race:
  if args.extra_flow:raise RuntimeError('Race setup requires baseline C01, without --extra-flow')
  case=case.replace('rollback;','commit;')
 output=checked(sql(case),'single native C01 dataset flow')
 (OUT/'LOCAL-FLOW.log').write_text(output,encoding='utf-8')
 facts=json.loads(next(line for line in output.splitlines() if line.startswith('{"') and 'C01_RESULT' in line))['C01_RESULT']
 if args.recovery_race:
  execution=json.loads(checked(sql("select jsonb_build_object('id',id) from public.transport_executions where booking_id='"+facts['bookingId']+"';"),'temporary execution identity'))['id']
  race=subprocess.run(['python',str(ROOT/'supabase/scenarios/v2-incident-recovery/verify-race.py'),'--container',CONTAINER,'--database',DB,'--organization',c['organizationId'],'--member',c['memberId'],'--carrier',r['carrierId'],'--operator',r['operatorId'],'--execution',execution,'--request-file',str(OUT/'LOCAL-REQUEST.json'),'--local-only'],capture_output=True,text=True,encoding='utf-8',timeout=60)
  (OUT/'LOCAL-RECOVERY-RACE.log').write_text(checked(race,'concurrent recovery commands'),encoding='utf-8')
 result={'localOnly':True,'hostedWrites':0,'datasetSHA256':digest,'manifestSchemaValidation':json.loads((OUT/'MANIFEST-VALIDATION.json').read_text()),'activationCount':2,'sameGeneratedIds':True,'nativeFlowAssertions':sum(x.startswith('ok ') for x in output.splitlines()),'result':'PASS','facts':facts,'autoConfirm':False,'datasetIdAssignmentsAreLocalOnly':True}
 (OUT/'LOCAL-RESULTADO.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
 print(json.dumps({'result':result['result'],'datasetSHA256':digest,'assertions':result['nativeFlowAssertions'],'activationReplays':2,'computedPrice':facts['computedPrice'],'executionStatus':facts['executionStatus'],'hostedWrites':0}),flush=True)
finally:
 if created:
  assert re.fullmatch(r'cargomesh_c01_dataset_[a-f0-9]{10}',DB)
  checked(docker(['dropdb','-U','postgres',DB]),'remove own temporary database');print('Own temporary database removed.',flush=True)
