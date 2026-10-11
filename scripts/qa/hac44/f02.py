"""Run incorporated CP-2 recipes as new measurements in the owned local bank."""
import json
import hashlib
import sys
from pathlib import Path
from common import ROOT, OUT, run, save, write
from local import BANK, CLI, LAYOUT, HEAD
from f02_rules import paired, apply_directed_retests


def main():
    BANK.own('f02-coverage')
    save('f02-harness-cut.json',{'productSha':HEAD,'files':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in Path(__file__).parent.iterdir() if p.is_file()}})
    audit=run('f02-source-audit',[sys.executable,Path(__file__).with_name('f02_source_audit.py')])
    if audit.returncode:raise RuntimeError('Exact source audit prerequisite failed')
    inputs = json.loads(Path(__file__).with_name('f02_descriptors.json').read_text(encoding='utf-8'))
    # Historical metadata selects contracts; historical verdicts/results are never imported.
    write(OUT / 'PROBES/INDICE_198.json', json.dumps(inputs['inventory'], ensure_ascii=False, indent=2) + '\n')
    env = {'NODE_OPTIONS':'--conditions=react-server','HAC44_ROOT':str(ROOT), 'HAC44_EVIDENCE':str(OUT),
           'HAC44_CLI_JSON':json.dumps(CLI),'HAC44_API_URL':LAYOUT.api_url,'HAC44_HTTP_PORT':str(LAYOUT.app_port),
           'HAC44_BANK_DB':BANK.db,'HAC44_SOURCE_SHA':HEAD}
    cases = []
    measurements = []
    for recipe, artifact in [('f02_focal.mts','CP2_FOCAL_RESULTADOS.json'),('f02_probes.mts','CP2_RESULTADOS.json'),('f02_native.mts','CP1B_NATIVE.json'),('f02_audit.mts','CP1B_AUDIT.json')]:
        result = run('f02-' + recipe, ['node', ROOT/'cargomesh/node_modules/tsx/dist/cli.mjs',
                     '--tsconfig',ROOT/'cargomesh/tsconfig.json',Path(__file__).with_name(recipe)],
                     cwd=ROOT/'cargomesh',timeout=1200,env_extra=env)
        path = OUT/'PROBES'/artifact
        data = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {'evidence':[],'complete':False}
        fresh=[{**row,'source':'PROBES/'+artifact+'#'+str(i+1)} for i,row in enumerate(data['evidence'])]
        if artifact=='CP1B_AUDIT.json':
            measurements=apply_directed_retests(measurements,fresh)
        else:
            measurements.extend(fresh)
        cases.append({'case':recipe,'status':'PASS' if result.returncode==0 and data.get('complete') else 'BLOQUEADO',
                      'exit':result.returncode,'reason':None if data.get('complete') else 'Campaign incomplete; inspect sanitized command log'})
    for row in measurements:
        raw = row.get('status')
        checked = paired(row)
        cases.append({'case':row['probe'],'status':'BLOQUEADO' if checked=='BLOQUEADO' else raw if raw in ('PASS','BLOQUEADO') else
                      'FAIL' if raw == 'DIFERENCIA' else 'BLOQUEADO', 'source':row['source'],
                      'rawStatus':raw,'controlPositive':row.get('controlPositive')})
    status = 'FAIL' if any(c['status']=='FAIL' for c in cases) else 'BLOQUEADO' if any(c['status']=='BLOQUEADO' for c in cases) else 'PASS'
    relation_run=run('f02-relations',[sys.executable,Path(__file__).with_name('f02_relations.py')])
    cases.append({'case':'Fresh relationship audit','status':'PASS' if relation_run.returncode==0 else 'BLOQUEADO','exit':relation_run.returncode})
    if relation_run.returncode and status=='PASS':status='BLOQUEADO'
    save('f02-results.json',{'status':status,'cases':cases,'productSha':HEAD})
    return {'PASS':0,'FAIL':1,'BLOQUEADO':2}[status]


if __name__ == '__main__':
    sys.exit(main())
