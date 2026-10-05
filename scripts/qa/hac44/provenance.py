"""Verify supplied direct dependencies against the exact lock; no installation."""
from common import *
def main():
 lock=(ROOT/'cargomesh/pnpm-lock.yaml').read_text(encoding='utf-8-sig');records=[]
 for match in re.finditer(r"^      '?([^'\n:]+)'?:\n        specifier: [^\n]+\n        version: ([^\n]+)",lock,re.M):
  name,version=match.groups();version=version.split('(')[0].strip("'");path=ROOT/'cargomesh/node_modules'/name/'package.json';assert path.exists(),name
  actual=json.loads(path.read_text(encoding='utf-8'))['version'];assert actual==version,(name,version,actual)
  records.append({'name':name,'lock':version,'runtime':actual,'status':'PASS'})
 assert records;save('dependency-provenance.json',{'status':'PASS','dependencies':records,'lockSha256':hashlib.sha256(lock.encode()).hexdigest(),'installation':'Supplied local dependencies; no auto-install; no strict-ssl change','pnpm11':'pnpm_config_verify_deps_before_run=false prevents implicit installation; version verification above remains required'})
 print('PASS '+str(len(records))+' direct dependencies match lock')
if __name__=='__main__':main()
