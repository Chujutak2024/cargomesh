"""Run only native IncidentUpdate retries, preserving the earlier campaign."""
import json,sys,hashlib
from pathlib import Path
from common import ROOT,OUT,run,save
from local import BANK,CLI,LAYOUT,HEAD
from f02_rules import paired
def main():
    BANK.own('f02-directed-audit')
    save('f02-directed-audit-cut.json',{'productSha':HEAD,'files':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in Path(__file__).parent.iterdir() if p.is_file()}})
    env={'NODE_OPTIONS':'--conditions=react-server','HAC44_ROOT':str(ROOT),'HAC44_EVIDENCE':str(OUT),'HAC44_CLI_JSON':json.dumps(CLI),'HAC44_API_URL':LAYOUT.api_url,'HAC44_HTTP_PORT':str(LAYOUT.app_port),'HAC44_BANK_DB':BANK.db,'HAC44_SOURCE_SHA':HEAD}
    p=run('f02-directed-audit',[ 'node',ROOT/'cargomesh/node_modules/tsx/dist/cli.mjs','--tsconfig',ROOT/'cargomesh/tsconfig.json',Path(__file__).with_suffix('.mts')],cwd=ROOT/'cargomesh',timeout=600,env_extra=env)
    if p.returncode:return p.returncode
    data=json.loads((OUT/'PROBES/CP1B_AUDIT.json').read_text(encoding='utf-8'))
    if data.get('sha')!=HEAD or not data.get('complete') or not data.get('evidence'):return 2
    if any(r['status']=='DIFERENCIA' for r in data['evidence']):return 1
    return 0 if all(paired(r)=='PASS' for r in data['evidence']) else 2
if __name__=='__main__':sys.exit(main())
