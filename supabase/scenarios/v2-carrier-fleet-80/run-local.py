"""Validate the Carrier scenario in one explicitly named schema-only Docker database."""
from pathlib import Path
import argparse
import hashlib
import json
import re
import subprocess
import sys

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
parser=argparse.ArgumentParser()
parser.add_argument('--container',default='supabase_db_hac45-carrier-local')
parser.add_argument('--schema-source',default='hac50_depot_limits_20261015_v3')
parser.add_argument('--database',default='hac50_scenario_fleet80_global_v1')
parser.add_argument('--evidence-dir',required=True)
args=parser.parse_args()
assert args.container=='supabase_db_hac45-carrier-local', 'Dedicated local Docker container required'
assert re.fullmatch(r'hac50_scenario_[a-z0-9_]+',args.database)
assert re.fullmatch(r'[a-z0-9_]+',args.schema_source) and args.schema_source!=args.database
OUT=Path(args.evidence_dir).resolve();OUT.mkdir(parents=True,exist_ok=True)
manifest=json.loads((HERE/'manifest.json').read_text(encoding='utf-8'))

def run(command,data=None,check=True):
    p=subprocess.run(command,input=data,capture_output=True)
    if check and p.returncode:
        raise RuntimeError(p.stderr.decode('utf-8',errors='replace')[-2500:])
    return p

def sql(text,db=None,check=True):
    return run(['docker','exec','-i',args.container,'psql','-X','-At','-v','ON_ERROR_STOP=1',
        '-U','postgres','-d',db or args.database],text.encode('utf-8'),check)

def source(name):
    return (HERE/name).read_text(encoding='utf-8').replace('\\ir guard.sql', (HERE/'guard.sql').read_text(encoding='utf-8'))

def record(label,p):
    (OUT/(label+'.txt')).write_bytes(p.stdout+p.stderr)
    if p.returncode: raise RuntimeError(f'{label} failed; see local evidence')

def fingerprint():
    checks=[]
    # Include every public application row, private grants and synthetic Auth users.
    tables=json.loads(sql("select coalesce(json_agg(tablename order by tablename),'[]'::json) from pg_tables where schemaname='public'").stdout)
    for table in tables:
        assert re.fullmatch(r'[a-z0-9_]+',table)
        checks.append(f"select '{table}',coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') from public.{table} t;")
    checks.extend(["select 'auth-users',coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from auth.users t;",
                   "select 'grants',coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') from private.v2_catalog_grants t;"])
    # Only the digest is retained; no Auth rows or credential columns are logged.
    return hashlib.sha256(sql('\n'.join(checks)).stdout).hexdigest()

marker='LOCAL_ONLY:v2-carrier-fleet-80'
exists=sql(f"select exists(select 1 from pg_database where datname='{args.database}');",'postgres').stdout.strip()==b't'
if not exists:
    run(['docker','exec',args.container,'createdb','-U','postgres',args.database])
    dump=run(['docker','exec',args.container,'pg_dump','--schema-only','-U','postgres','-d',args.schema_source]).stdout
    restore=run(['docker','exec','-i',args.container,'psql','-X','-v','ON_ERROR_STOP=1','-U','supabase_admin','-d',args.database],dump)
    (OUT/'SCHEMA_ONLY_RESTORE.txt').write_bytes(restore.stdout+restore.stderr)
    sql(f"comment on database {args.database} is '{marker}';")
    assert sql('select count(*) from public.carriers;').stdout.strip()==b'0', 'Source rows must not be copied'
else:
    actual=sql("select shobj_description(oid,'pg_database') from pg_database where datname=current_database();").stdout.decode().strip()
    assert actual==marker, 'Refusing to reuse an unmarked database'

# Remove only the exact synthetic probe row left if an earlier verification was interrupted.
sql("delete from public.carriers where id='ffff0050-0000-4000-8000-000000000001' and code='HAC50_FOREIGN_SENTINEL' and name='[SYNTHETIC] Foreign sentinel';")

bad=sql(source('seed.sql'),check=False)
assert bad.returncode and b'HAC50_SCENARIO_LOCAL_ONLY' in bad.stderr
record('SEED',sql('\\set local_only 1\n'+source('seed.sql')))
first=fingerprint()
record('REPLAY',sql('\\set local_only 1\n'+source('seed.sql')))
assert fingerprint()==first, 'Same input replay changed persisted data'

changed=source('seed.sql').replace('[SYNTHETIC] Driver C01-01','[SYNTHETIC] Altered driver',1)
bad=sql('\\set local_only 1\n'+changed,check=False)
assert bad.returncode and b'HAC50_SCENARIO_ROW_CONFLICT' in bad.stderr
assert fingerprint()==first, 'Conflicting seed did not roll back'

tap=sql('\\set local_only 1\n'+source('verify.sql'))
record('PGTAP',tap)
assert b'not ok ' not in tap.stdout and b'not ok ' not in tap.stderr, 'pgTAP negative result'
readback=[]
for carrier in manifest['carriers']:
    kinds=['carriers','services','depots','assets','calendars','maintenances','repositioning-blocks',
           'asset-capabilities','capability-definitions','drivers','vehicle-assignments','driver-assignments']
    expr=','.join("'%s',public.read_v2_carrier_catalog('%s','%s','%s',null,%s,100,0)" %
        (kind,carrier['operatorId'],kind,carrier['id'],"'%s'" % carrier['id'] if kind=='carriers' else 'null') for kind in kinds)
    claims=json.dumps({'sub':carrier['userId'],'role':'authenticated'})
    query=f"begin;set local role authenticated;set local request.jwt.claims='{claims}';select jsonb_build_object({expr});rollback;"
    output=sql(query).stdout.decode().splitlines()
    data=json.loads(next(line for line in output if line.startswith('{')))
    for service in carrier['serviceIds']:
        expr=','.join("'%s',public.read_v2_carrier_catalog('%s','%s','%s','%s',null,100,0)" %
            (kind,carrier['operatorId'],kind,carrier['id'],service) for kind in ['areas','lanes'])
        output=sql(f"begin;set local role authenticated;set local request.jwt.claims='{claims}';select jsonb_build_object({expr});rollback;").stdout.decode().splitlines()
        scoped=json.loads(next(line for line in output if line.startswith('{')))
        for kind,values in scoped.items(): data.setdefault(kind,[]).extend(values)
    readback.append({'carrierId':carrier['id'],'rows':data})
readback_path=OUT/'catalog-readback.json'
readback_path.write_text(json.dumps(readback,indent=2)+'\n',encoding='utf-8')
node=subprocess.run(['node','--conditions=react-server','--import','tsx',str(HERE/'verify-catalog.ts'),
    str(readback_path),str(HERE/'manifest.json')],cwd=ROOT/'cargomesh',capture_output=True)
record('CANONICAL_AND_AVAILABILITY',node)

# A foreign sentinel proves cleanup is constrained to its own rows. Dry run rolls back.
sentinel="insert into public.carriers(id,name,code,provider_type,status,supports_webmcp) values('ffff0050-0000-4000-8000-000000000001','[SYNTHETIC] Foreign sentinel','HAC50_FOREIGN_SENTINEL','CARRIER','ACTIVE',false) on conflict(id) do nothing;"
sql(sentinel)
with_sentinel=fingerprint()
record('CLEANUP_GUARD_PROBE',sql('\\set local_only 1\n'+source('cleanup-probe.sql')))
assert fingerprint()==with_sentinel, 'Cleanup guard probe changed persisted data'
assert sql("select count(*) from public.carriers where code='HAC50_FOREIGN_SENTINEL';").stdout.strip()==b'1'
sql("delete from public.carriers where id='ffff0050-0000-4000-8000-000000000001' and code='HAC50_FOREIGN_SENTINEL';")
assert fingerprint()==first, 'Probe changed scenario data'
summary={'database':args.database,'schemaSource':args.schema_source,'schemaOnlyCopy':True,
    'counts':{'carriers':10,'depots':16,'vehicles':80,'drivers':80},'states':manifest['expectedStates'],
    'seedGuard':True,'replayUnchanged':True,'conflictingReplayRolledBack':True,
    'cleanupGuardPreserved':True,'probePreservedForeignRow':True,'physicalRowCleanupSupported':False,
    'hostedActions':False,'clientRequestsCreated':False,'roadGeometryCreated':False}
(OUT/'RESULTS.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8')
print(json.dumps(summary,indent=2))
