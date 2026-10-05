"""Use only named HAC-44 local Docker banks; no connection URL is accepted."""
from common import *
import importlib.util,socket,tomllib
HEAD=state()['head'];HARNESS=OUT/'stack-v2';PROJECT='hac44-full-flow-v2';DB='supabase_db_'+PROJECT
cli=os.environ.get('HAC44_CLI') or shutil.which('supabase')
CLI=[cli] if cli else ['npx.cmd' if os.name=='nt' else 'npx','--yes','supabase@2.117.0']
def gate():
 spec=importlib.util.spec_from_file_location('hac29_gate',ROOT/'supabase-v2/gate.py');g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g);return g
def sql(label,query,persist=True):
 assert DB=='supabase_db_hac44-full-flow-v2'
 if persist:write(OUT/'repro/sql'/(label+'.sql'),safe(query))
 return run(label,['docker','exec','-i',DB,'psql','-X','-A','-t','-v','ON_ERROR_STOP=1','-v','local_only=1','-U','postgres','-d','postgres'],ROOT,query)
def script(label,path,backup=False):
 p=Path(path);p=p if p.is_absolute() else ROOT/p;raw=p.read_text(encoding='utf-8-sig')
 save(label+'-source.json',{'head':HEAD,'path':str(p.relative_to(ROOT)) if p.is_relative_to(ROOT) else str(p),'sha256':hashlib.sha256(raw.encode()).hexdigest()})
 def expand(file):
  source=file.read_text(encoding='utf-8-sig')
  return re.sub(r'^\\ir (.+)$',lambda m:expand((file.parent/m[1].strip()).resolve()),source,flags=re.M)
 return sql(label,('\\set backup_confirmed 1\n' if backup else '')+expand(p),persist=False)
