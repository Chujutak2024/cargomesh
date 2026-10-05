"""Run repository checks, keeping command output outside the checkout."""
from common import *
if __name__=='__main__':
 from provenance import main as provenance;provenance()
 executable=shutil.which('pnpm.cmd' if os.name=='nt' else 'pnpm');assert executable
 results={}
 for name in sys.argv[1:] or ['typecheck','test:release']:
  assert name in ('typecheck','test:release')
  # The supplied dependencies are independently matched against the lockfile.
  # pnpm 11 defaults to installing before scripts when its workspace metadata is absent.
  p=run(name,[executable,name],ROOT/'cargomesh',timeout=1800,env_extra={'pnpm_config_verify_deps_before_run':'false'})
  results[name]={'exit':p.returncode,'status':'PASS' if p.returncode==0 else 'FAIL'}
 save('repository-checks.json',results)
 sys.exit(0 if all(r['exit']==0 for r in results.values()) else 1)
