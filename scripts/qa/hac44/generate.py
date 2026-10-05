"""Generate matrices from the selected checkout and its freshly executed evidence.
For another SHA, supply its clean checkout and a fresh external evidence folder.
No old catalog or API result is imported as current execution evidence.
"""
from local import *
def main():
 changed=run('selected-sha-input-check',['git','diff','--name-only',HEAD,'--','supabase-v2/supabase/migrations','supabase-v2/migration-manifest.json','cargomesh/src','docs/v2-amazon/models','docs/v2-amazon/delivery','docs/v2-amazon/diagrams']).stdout.strip()
 assert not changed,'The live source/migrations must match the selected source SHA'
 for name,args in [('sources.py',[]),('catalog.py',[]),('api_runner.py',['inventory']),('matrix.py',[]),('methods.py',[])]:
  p=run('generate-'+name,[sys.executable,'-X','utf8',Path(__file__).with_name(name)]+args,timeout=1200);assert p.returncode==0
 print('PASS fresh source/catalog/Zod/Hono matrix generation for '+HEAD)
if __name__=='__main__':main()
