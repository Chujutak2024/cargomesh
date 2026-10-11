"""Reconcile the nine historical documentary rows against executed CP-1c proof."""
import json
from common import OUT, LOGS, write, state
from f02_rules import contract_verdict

DICTIONARY='docs/v2-amazon/models/MCP_ACCOUNT_LINK_UML_DICTIONARY_REV_2026-10-09.md'

def identity_field_proof(field, history, roundtrips, result):
    cases={r['case']:r for r in result.get('cases',[])}
    expected={'historical links read':200,'verified PKCE consent':201,
              'ordinary bearer cannot forge client consent':403,'foreign revocation denied':404}
    controls=all(cases.get(name,{}).get('status')=='PASS' and cases[name].get('http')==code for name,code in expected.items())
    legacy=history.get('legacy',[])
    verified=[r for r in roundtrips if r.get('kind')=='links' and r.get('status')=='PASS']
    positive=bool(verified) and all(isinstance(r['written'].get(field),str) and r['written'][field].strip() and r['written']==r['read'] for r in verified)
    historical=history.get('status')=='PASS' and bool(legacy) and all(field in r and r[field] is None for r in legacy)
    auth=result.get('status')=='PASS' and result.get('actualAuthSessions') is True and result.get('actualPKCE') is True
    return controls and positive and historical and auth

def reconcile(config, evidence, methods):
    def read(name,default):
        p=LOGS/name
        return json.loads(p.read_text(encoding='utf-8')) if p.exists() else default
    history=read('identity-history.json',{});roundtrips=read('identity-roundtrips.json',[]);identity=read('identity-result.json',{})
    rows=[]
    for d in config['rows']:
        if d['originCategory']!='DOCUMENTACION_DESACTUALIZADA':continue
        if d['tipo']=='relacion':
            status,reason=contract_verdict(d['requiredProbes'],evidence,d)
            selected=[r['source'] for r in evidence if r['probe'] in d['requiredProbes']]
            reference=d.get('contractRevision','Historical contract; reconciliation pending')
        elif d['tipo']=='atributo':
            field=d['id'].split('.')[-1];passed=identity_field_proof(field,history,roundtrips,identity)
            status='EVIDENCIA_MEDIDA' if passed else 'BLOQUEADO'
            reason='Historical NULL read and concrete verified PKCE link roundtrip measured against ordinary-session forgery and foreign revocation controls' if passed else 'Missing valid historical NULL / verified consent field pair from the current identity execution'
            selected=['logs/identity-history.json','logs/identity-roundtrips.json','logs/identity-result.json'];reference=DICTIONARY
        else:
            status='PARCIAL'
            unresolved=[m['id']+'='+m['estado'] for m in methods if m['clase']==d['id'] and m['estado']!='EVIDENCIA_MEDIDA']
            reason='Current dictionary reconciles historical nullable proof with verified consent; individual method coverage remains unresolved: '+', '.join(unresolved)
            selected=['logs/identity-result.json','logs/f02-method-matrix.json'];reference=DICTIONARY
        rows.append({**d,'estado':status,'motivo':reason,'evidence':selected,'productSha':state()['head'],
                     'historicalUml07Status':'DOCUMENTACION_DESACTUALIZADA','currentContractRef':reference,
                     'classification':'EVIDENCIA_FALTANTE' if status in ('PARCIAL','BLOQUEADO') else 'RECONCILIACION_DOCUMENTAL_MEDIDA'})
    write(OUT/'PROBES/CP1C_DOCUMENTARY_RECONCILIATION.json',json.dumps({'productSha':state()['head'],'rows':rows},ensure_ascii=False,indent=2)+'\n')
    return rows
