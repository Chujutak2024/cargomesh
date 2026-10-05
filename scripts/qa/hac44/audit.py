"""Final local-only evidence, scope and restoration checks."""
from common import *
import collections
def main():
 commands={'branch':['git','branch','--show-current'],'head':['git','rev-parse','HEAD'],'remoteBase':['git','rev-parse','origin/codex/v2-amazon-contracts'],'scope':['git','diff','--cached','--name-only'],'originalBranch':['git','branch','--show-current'],'originalHead':['git','rev-parse','HEAD'],'originalStatus':['git','status','--porcelain=v1']};results={}
 original=os.environ.get('HAC44_ORIGINAL')
 for label,args in commands.items():
  if label.startswith('original') and not original:continue
  p=run('audit-'+label,args,Path(original) if label.startswith('original') else ROOT);assert p.returncode==0;results[label]=p.stdout.strip()
 assert results['branch']=='codex/v2-full-flow-qa'
 if original:
  before=json.loads((LOGS/'cut.json').read_text(encoding='utf-8'))['originalBefore']
  for key in ('branch','head','status'):assert results['original'+key.title()]==before[key],'Original checkout changed: '+key
 for path in results['scope'].splitlines():assert path.startswith(('scripts/qa/hac44/','supabase/scenarios/v2-full-flow-qa/')),path
 cp1=Path(os.environ['HAC44_CP1']);before=json.loads((cp1/'logs/catalog.json').read_text(encoding='utf-8'));after=json.loads((LOGS/'catalog.json').read_text(encoding='utf-8'))
 constraints=lambda c:{(x['schema'],x['relation'],x['conname']):x['definition'] for x in c['constraints']}
 # PostgreSQL internal RI trigger names contain rebuild-specific OIDs. Compare
 # normalized definitions/states as a multiset so no trigger count is discarded.
 normalize=lambda text:re.sub(r'RI_ConstraintTrigger_([ac])_\d+',r'RI_ConstraintTrigger_\1_OID',text)
 triggers=lambda c:collections.Counter((x['schema'],x['relation'],normalize(x['tgname']),x['tgenabled'],normalize(x['definition'])) for x in c['triggers'])
 assert constraints(before)==constraints(after),'Physical constraints changed';assert triggers(before)==triggers(after),'Trigger definition/state changed'
 results.update(constraintsRestored=True,triggersRestored=True)
 cycles=json.loads((LOGS/'two-cycles.json').read_text(encoding='utf-8'));assert len(cycles)==2 and all(x['remainingRows']==0 for x in cycles)
 for name,field in [('matrix-counts.json',None),('pending-cases.json','status'),('independent-fk-pairs.json','cases')]:
  values=[]
  for number in ('1','2'):
   value=json.loads((OUT/'cycles'/number/'logs'/name).read_text(encoding='utf-8'))
   values.append(value if field is None else [(x.get('template',x.get('constraint')),x['status']) for x in (value['cases'] if field=='cases' else value)])
  assert values[0]==values[1],name
 results.update(twoCyclesEquivalent=True,scopeVerified=True)
 leaks=[]
 for path in list((ROOT/'scripts/qa/hac44').glob('*'))+list((ROOT/'supabase/scenarios/v2-full-flow-qa').glob('*')):
  if not path.is_file():continue
  raw=path.read_text(encoding='utf-8-sig')
  if re.search(r'eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}|sb_secret_[\w-]+|sb_publishable_[\w-]+|[A-Z]:[\\/]Users[\\/]',raw):leaks.append(path.name)
 assert not leaks,leaks
 results['secretAndMachinePathScan']='PASS';save('final-audit.json',results);print('PASS scope, source, two-cycle equivalence, constraint/trigger restoration and secret/path scan')
if __name__=='__main__':main()
