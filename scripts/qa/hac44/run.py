"""Sequential local verification; product counterexamples stay red."""
from local import *
def child(name,*args,expected=0):
 p=run('runner-'+name+'-'+'-'.join(args),[sys.executable,'-X','utf8',Path(__file__).with_name(name)]+list(args),timeout=1800)
 assert p.returncode==expected,(name,args,p.returncode,expected)
def cycles():
 completed=[]
 for cycle in (1,2):
  if cycle!=1 or '--seeded' not in sys.argv:child('lifecycle.py','seed')
  child('lifecycle.py','verify')
  for mode in ('run','extended','ltl'):child('api_runner.py',mode)
  child('pending.py');child('api_runner.py','pending');child('api_runner.py','auth-verify');child('api_runner.py','contract')
  child('contract_verdict.py',expected=1)
  known=json.loads((LOGS/'contract-verdict.json').read_text(encoding='utf-8'))
  assert {c['case'] for c in known['cases'] if c['status']=='FAIL'}=={'contract-required-field-result.json','contract-route-cardinality-result.json','contract-category-version-result.json'}
  assert all(c['status'] in ('PASS','FAIL') for c in known['cases'])
  for name in ('rls.py','races.py','fk_complete.py'):child(name)
  child('persistence.py')
  child('lifecycle.py','verify');child('matrix.py')
  child('lifecycle.py','cleanup')
  result=json.loads((LOGS/'full-flow-cleanup-result.json').read_text(encoding='utf-8'))
  archive=OUT/'cycles'/str(cycle);archive.mkdir(parents=True,exist_ok=True)
  for directory in ('logs','dataset','backups'):
   target=archive/directory;target.mkdir(exist_ok=True)
   for source in (OUT/directory).glob('*'):
    if source.is_file():shutil.copy2(source,target/source.name)
  completed.append({'cycle':cycle,'status':'PASS','removedRows':result['removedRows'],'remainingRows':result['remainingRows'],'baselineRestored':result['baselineRestored'],'triggersRestored':result['triggersRestored'],'contract':'FAIL retained in three preexisting product counterexamples','archive':str(archive.relative_to(OUT))});save('two-cycles.json',completed)
  print('PASS complete cycle '+str(cycle),flush=True)
if __name__=='__main__':
 if sys.argv[1]=='cycles':cycles()
 elif sys.argv[1]=='all':
  child('provenance.py');child('gates.py');child('runtime.py','start');child('sources.py');child('catalog.py');cycles();child('generate.py');child('checks.py')
 else:raise SystemExit('Use: python scripts/qa/hac44/run.py all | cycles [--seeded]')
