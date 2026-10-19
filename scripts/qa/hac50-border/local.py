"""Reproduce HAC-50 border checks in a new, explicitly named local Docker bank."""
from pathlib import Path
import argparse,json,re,subprocess
ROOT=Path(__file__).resolve().parents[3]
parser=argparse.ArgumentParser()
parser.add_argument('--database',default='hac50_scenario_border_20261016_verified')
parser.add_argument('--schema-source',default='hac50_scenario_fleet80_global_v1')
parser.add_argument('--evidence-dir',required=True)
args=parser.parse_args()
assert re.fullmatch(r'hac50_scenario_border_[a-z0-9_]+',args.database)
assert re.fullmatch(r'hac50_[a-z0-9_]+',args.schema_source) and args.database!=args.schema_source
OUT=Path(args.evidence_dir).resolve();OUT.mkdir(parents=True,exist_ok=True)
CONTAINER='supabase_db_hac45-carrier-local'
def run(cmd,body=None,label=None):
 p=subprocess.run(cmd,input=body,capture_output=True)
 if label:(OUT/(label+'.txt')).write_bytes(p.stdout+p.stderr)
 if p.returncode:raise RuntimeError(f'{label or "command"} failed; inspect local evidence')
 return p.stdout
def sql(s,db=None,label=None,user='postgres'):
 return run(['docker','exec','-i',CONTAINER,'psql','-X','-At','-v','ON_ERROR_STOP=1','-U',user,'-d',db or args.database],s.encode(),label)
exists=sql(f"select exists(select 1 from pg_database where datname='{args.database}');",'postgres').strip()
assert exists==b'f','Use a new bank name; this runner never resets or drops a database.'
run(['docker','exec',CONTAINER,'createdb','-U','postgres',args.database])
dump=run(['docker','exec',CONTAINER,'pg_dump','--schema-only','-U','postgres','-d',args.schema_source])
sql(dump.decode(),label='SCHEMA_ONLY_RESTORE',user='supabase_admin')
sql(f"comment on database {args.database} is 'LOCAL_ONLY:v2-carrier-fleet-80';")
assert sql('select count(*) from public.carriers;').strip()==b'0'
migration=ROOT/'supabase-v2/supabase/migrations/20261016165018_hac50_border_operations.sql'
sql('begin;\n'+migration.read_text()+'\ncommit;',label='MIGRATION')
tap=sql((ROOT/'supabase/tests/36_v2_hac50_border_operations.test.sql').read_text(),label='PGTAP_STANDALONE')
assert b'not ok ' not in tap
count=sum(line.startswith(b'ok ') for line in tap.splitlines())
assert count>=61
assert sql('select count(*) from public.carriers;').strip()==b'0','pgTAP fixtures must roll back'
run(['python',str(ROOT/'supabase/scenarios/v2-carrier-fleet-80/run-local.py'),
 '--schema-source',args.schema_source,'--database',args.database,'--evidence-dir',str(OUT/'scenario')],label='SCENARIO_BASELINE')
run(['python',str(Path(__file__).with_name('races.py')),'--database',args.database,'--evidence-dir',str(OUT)],label='CONCURRENCY')
run(['node','--conditions=react-server','--import','tsx',str(Path(__file__).with_name('native-readback.ts')),str(OUT/'native-readback.json')],label='NATIVE_PARITY')
summary={'database':args.database,'schemaOnlyCopy':True,'standalonePgTap':count,
 'testFixturesRolledBack':True,'concurrentIdempotentCreate':True,'concurrentRevisionOneWinner':True,
 'nativePolicyParityCases':3,'hostedChanges':False,'frontendConnected':False}
(OUT/'RESULTS.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(summary,indent=2))
