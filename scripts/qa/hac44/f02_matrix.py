"""Derive the F-02 row/method matrices only from this execution's artifacts."""
import collections
import csv
import io
import json
from pathlib import Path
from common import OUT, LOGS, write, save, state
from f02_rules import attribute_verdict, contract_verdict, class_verdict, apply_directed_retests


def load_evidence():
    rows=[]
    for filename in ('CP2_RESULTADOS.json','CP2_FOCAL_RESULTADOS.json','CP1B_NATIVE.json','CP1B_SOURCE_AUDIT.json','CP1B_RELATIONS.json'):
        path=OUT/'PROBES'/filename
        if path.exists():
            data=json.loads(path.read_text(encoding='utf-8'))
            if data.get('sha') != state()['head']:
                raise ValueError('F02 measurement belongs to another cut')
            rows.extend({**r,'source':'PROBES/'+filename+'#'+str(i+1)} for i,r in enumerate(data['evidence']))
    path=OUT/'PROBES/CP1B_AUDIT.json'
    if path.exists():
        data=json.loads(path.read_text(encoding='utf-8'))
        if data.get('sha')!=state()['head']:raise ValueError('Directed audit belongs to another product cut')
        supplemental=[{**r,'source':'PROBES/CP1B_AUDIT.json#'+str(i+1)} for i,r in enumerate(data['evidence'])]
        rows=apply_directed_retests(rows,supplemental)
    return rows


def csvwrite(name,rows):
    text=io.StringIO(newline='');writer=csv.DictWriter(text,fieldnames=list(dict.fromkeys(k for r in rows for k in r)),lineterminator='\n');writer.writeheader()
    writer.writerows({k:json.dumps(v,ensure_ascii=False) if isinstance(v,(dict,list)) else v for k,v in row.items()} for row in rows)
    write(OUT/name,text.getvalue())


def main():
    prepared=OUT/'PROBES/CP1B_DESCRIPTORS.json'
    config=json.loads((prepared if prepared.exists() else Path(__file__).with_name('f02_descriptors.json')).read_text(encoding='utf-8'))
    evidence=load_evidence()
    methods=[]
    for d in config['methods']:
        status,reason=contract_verdict(d['requiredProbes'],evidence,d)
        if d.get('partialUntilRuntimeMeasured') and status!='EVIDENCIA_MEDIDA':
            status='PARCIAL'
            reason=d['previousMeasurementRejected']+'; '+reason
        methods.append({**d,'estado':status,'motivo':reason+'; '+d['representationLimit'],
                        'classification':'EVIDENCIA_FALTANTE' if status in ('PARCIAL','BLOQUEADO') else status,
                        'evidence':[r['source'] for r in evidence if r['probe'] in d['requiredProbes']],
                        'productSha':state()['head']})
    save('f02-method-matrix.json',methods);csvwrite('HAC-44_metodos_F02.csv',methods)
    reconciliation=[]
    if any(d.get('contractRevision')=='UML08 / #118' for d in config['rows']):
        from cp1c_reconciliation import reconcile
        reconciliation=reconcile(config,evidence,methods)
        csvwrite('RECONCILIACION_9.csv',reconciliation)
    measured=[]
    for d in config['rows']:
        if d['originCategory']!='EVIDENCIA_PENDIENTE':
            continue  # Reconcile the nine separately; keep the 189-row cohort fixed.
        if d['tipo']=='atributo':status,reason=attribute_verdict(d,evidence)
        elif d['tipo']=='relacion':status,reason=contract_verdict(d['requiredProbes'],evidence,d)
        else:continue
        selected=[r for r in evidence if d['id'] in r.get('rowIds',[]) or
                  d['tipo']=='relacion' and d['id'].split()[0] in r.get('rowIds',[]) or r['probe'] in d['requiredProbes']]
        if d['tipo']=='relacion' and status=='BLOQUEADO' and not any(r['probe'] in d['requiredProbes'] for r in evidence) and any(r.get('status')=='PASS' for r in selected):
            status='PARCIAL'
            reason += '; exact native sub-observables executed; full two-end obligations remain unresolved'
        missing=[name for name in d['requiredProbes'] if not any(r['probe']==name for r in evidence)]
        failures=[r['probe'] for r in selected if r.get('status') in ('BLOQUEADO','DIFERENCIA')]
        if missing:reason += '; missing exact probes: ' + ', '.join(missing)
        if failures:reason += '; unresolved observations (retain raw status): ' + ', '.join(failures)
        if status=='BLOQUEADO' and not d['requiredProbes']:
            reason += '; representation: ' + d['representation'] + '; retest: ' + d['retestCriterion']
        measured.append({**d,'estado':status,'motivo':reason,'evidence':[r['source']+' '+r['probe'] for r in selected],
                         'baseline42':'EVIDENCIA_PENDIENTE (external probes not incorporated)', 'productSha':state()['head']})
    attrs={d['id']:d for d in measured+reconciliation if d['tipo']=='atributo'}
    relations=[d for d in measured if d['tipo']=='relacion']
    full_attrs=json.loads((LOGS/'attribute-matrix.json').read_text(encoding='utf-8')) if (LOGS/'attribute-matrix.json').exists() else []
    full_relations=json.loads((LOGS/'relationship-matrix.json').read_text(encoding='utf-8')) if (LOGS/'relationship-matrix.json').exists() else []
    current_relation={d['id'].split()[0]:d for d in relations+[r for r in reconciliation if r['tipo']=='relacion']}
    def current_state(row):
        return 'EVIDENCIA_MEDIDA' if row['estado']=='COMPLETO' else row['estado'] if row['estado'] in ('EVIDENCIA_MEDIDA','BLOQUEADO') else 'PARCIAL'
    for d in config['rows']:
        if d['tipo']!='clase' or d['originCategory']!='EVIDENCIA_PENDIENTE':continue
        av=[attrs[r['clase']+'.'+r['atributo']]['estado'] if r['clase']+'.'+r['atributo'] in attrs else current_state(r) for r in full_attrs if r['clase']==d['id']]
        rv=[current_relation[r['uml_id']]['estado'] if r['uml_id'] in current_relation else current_state(r) for r in full_relations if d['id'] in (r['origen'],r['destino'])]
        mv=[m['estado'] for m in methods if m['clase']==d['id']]
        status,reason=class_verdict(av,rv,mv)
        unresolved=[a['id']+'='+a['estado'] for a in attrs.values() if a.get('field',{}).get('clase')==d['id'] and a['estado']!='EVIDENCIA_MEDIDA']
        unresolved += [r['id']+'='+r['estado'] for r in relations if d['id'] in r['id'].split()[1:] and r['estado']!='EVIDENCIA_MEDIDA']
        unresolved += [m['id']+'='+m['estado'] for m in methods if m['clase']==d['id'] and m['estado']!='EVIDENCIA_MEDIDA']
        reason += '; '+d['id']+' unresolved contracts: '+('; '.join(unresolved) or 'Unresolved attributes/associations in the full current model matrix')
        measured.append({**d,'estado':status,'motivo':reason,'evidence':['logs/f02-method-matrix.json'],
                         'baseline42':'EVIDENCIA_PENDIENTE (external probes not incorporated)','productSha':state()['head']})
    for row in measured:
        row['classification']='EVIDENCIA_FALTANTE' if row['estado'] in ('PARCIAL','BLOQUEADO') else row['estado']
        if row['classification']=='EVIDENCIA_FALTANTE':row['owner']='HAC-44 / Jean Paul (measurement)'
    save('f02-row-matrix.json',measured)
    # Uniform columns preserve complete per-row evidence without storing credentials.
    columns=('tipo','id','estado','motivo','classification','contractMode','representation','owner','requiredProbes','evidence','baseline29','baseline42','retestCriterion','productSha')
    csvwrite('COBERTURA_189.csv',[{k:d.get(k,'') for k in columns} for d in measured])
    if reconciliation:
        full_columns=columns+('originCategory','historicalUml07Status','currentContractRef')
        csvwrite('COBERTURA_198.csv',[{k:d.get(k,'') for k in full_columns} for d in measured+reconciliation])
    counts={kind:dict(collections.Counter(d['estado'] for d in measured if d['tipo']==kind)) for kind in ('atributo','relacion','clase')}
    counts['metodo']=dict(collections.Counter(d['estado'] for d in methods))
    save('f02-counts.json',counts)
    csvwrite('CAMBIOS_29c385f_42a4fde.csv',[{k:d.get(k,'') for k in ('tipo','id','baseline29','baseline42','estado','motivo','evidence')} for d in measured])
    # Overlay only the authorized cohort on freshly generated full matrices.
    matrix_specs=[('atributo','attribute-matrix.json','HAC-44_matriz_atributos.csv',lambda r:r['clase']+'.'+r['atributo']),
                  ('relacion','relationship-matrix.json','HAC-44_matriz_relaciones.csv',lambda r:r['uml_id']+' '+r['origen']+' → '+r['destino']),
                  ('clase','class-matrix.json','HAC-44_matriz_clases.csv',lambda r:r['clase'])]
    for kind,filename,output,key in matrix_specs:
        path=LOGS/filename
        if not path.exists():continue
        rows=json.loads(path.read_text(encoding='utf-8'));index={d['id']:d for d in measured+reconciliation if d['tipo']==kind}
        for row in rows:
            d=index.get(key(row))
            row.setdefault('estado_pre_f02',row['estado'])
            if d:row.update(estado=d['estado'],f02_motivo=d['motivo'],f02_evidencia=d['evidence'])
            else:row.update(f02_motivo='Outside the 189-row cohort; unchanged measured rule',f02_evidencia=[])
        save(filename,rows);csvwrite(output,rows)
    print(json.dumps(counts,ensure_ascii=False))


if __name__=='__main__':main()
