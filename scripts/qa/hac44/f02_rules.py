"""Fail-closed semantic coverage rules; descriptors never supply verdicts."""

def apply_directed_retests(rows, supplemental):
    """Explicit same-row retries replace only the named campaign observation."""
    current=list(rows)
    for row in supplemental:
        selector=row.get('supersedes',{})
        if not selector.get('source') or selector.get('probe')!=row['probe'] or not selector.get('reason'):
            raise ValueError('Directed retry needs an exact source/probe and correction reason')
        replaced=[r for r in current if r['probe']==selector['probe'] and r.get('source','').startswith(selector['source']+'#') and r.get('rowIds')==row.get('rowIds')]
        row={**row,'supersededEvidence':[{'source':r['source'],'status':r['status']} for r in replaced]}
        current=[r for r in current if r not in replaced]+[row]
    return current

def paired(row):
    observed = row.get('observed', {})
    if row.get('status') == 'BLOQUEADO':
        return 'BLOQUEADO'
    if isinstance(observed, dict) and 'positive' in observed:
        positive = observed['positive']
        if not positive.get('accepted') or positive.get('role') != 'authenticated' or not positive.get('actualSession'):
            return 'BLOQUEADO'
        if row.get('probe','').startswith('XOR plan capacity source') and positive.get('value',{}).get('status') != 'eligible':
            return 'BLOQUEADO'
        negative = observed.get('negative')
        if negative is not None and (negative.get('role') != 'authenticated' or not negative.get('actualSession')):
            return 'BLOQUEADO'
        if row.get('rollbackDelta') != 0 or row.get('countsBefore') != row.get('countsAfter'):
            return 'BLOQUEADO'
    elif isinstance(observed, dict) and 'positiveHttp' in observed:
        if observed['positiveHttp'] not in (200,201):
            return 'BLOQUEADO'
    elif isinstance(observed, dict) and 'positiveNative' in observed:
        if observed['positiveNative'].get('accepted') is not True:
            return 'BLOQUEADO'
    elif not row.get('controlPositive'):
        return 'PARCIAL'
    return 'PASS' if row.get('status') == 'PASS' else 'PARCIAL'


def attribute_verdict(descriptor, evidence):
    identifier = descriptor['id']
    exact = [r for r in evidence if identifier in r.get('rowIds', [])]
    documentary = next((r for r in exact if r.get('status')=='DOCUMENTACION_DESACTUALIZADA_CANDIDATA'),None)
    if documentary:
        return 'DOCUMENTACION_DESACTUALIZADA', 'Candidate, not PASS: '+documentary['reason']+'; citations: '+', '.join(documentary['citations'])
    read = [r for r in exact if r['probe'] == 'FIELD_READ ' + identifier or r['probe'].startswith('FIELD roundtrip')
            or r['probe'].startswith('PROJECTION ') or r['probe'].startswith('DERIVED ') or r['probe'].startswith('UNKNOWN ')]
    # Projection descriptors deliberately have no direct product HTTP DTO. A
    # nominal CRUD lookup is not a positive prerequisite for their real adapter.
    if descriptor.get('representation','').startswith('|') and descriptor.get('field',{}).get('dto_lectura')=='NO_TYPED_OUTPUT':
        read = [r for r in read if not r['probe'].startswith('FIELD_READ ')]
    required = descriptor['requiredProbes']
    controls = [next((r for r in exact if r['probe']==name), None) for name in required]
    if any(r is not None and paired(r)=='BLOQUEADO' for r in controls) or any(r.get('status')=='BLOQUEADO' for r in read):
        failed = next((r for r in controls if r is not None and paired(r)=='BLOQUEADO'),next((r for r in read if r.get('status')=='BLOQUEADO'),None))
        return 'BLOQUEADO', identifier+': exact prerequisite '+failed['probe']+' failed: '+str(failed.get('observed'))
    if not read:
        return 'BLOQUEADO', identifier+': no current exact field record at '+descriptor.get('field',{}).get('ruta_output','unknown path')+' in '+descriptor.get('representation','unknown representation')
    concrete = any(r.get('status')=='PASS' and (r.get('observed',{}).get('value') is not None
                   or not required and descriptor.get('nullableOutput') or r['probe'].startswith(('FIELD roundtrip','PROJECTION ','DERIVED ','UNKNOWN '))) for r in read)
    if not concrete:
        return 'PARCIAL', 'Exact field was read, but a concrete value or justified nullable/derived boundary was not measured'
    if not required:
        return 'EVIDENCIA_MEDIDA', 'Exact read of a derived/historical field in its real representation; writable NULL/omission is not applicable'
    if all(r is not None and paired(r)=='PASS' for r in controls):
        return 'EVIDENCIA_MEDIDA', 'Concrete exact field read and four paired DB/HTTP NULL/omission controls passed'
    return 'PARCIAL', 'Concrete read exists; exact paired DB/HTTP NULL/omission coverage is incomplete or differs'


def contract_verdict(required, evidence, descriptor=None):
    exact = [next((r for r in evidence if r['probe']==name),None) for name in required]
    if not required or not any(exact):
        return 'BLOQUEADO', (descriptor or {}).get('blockedCause','Exact probe(s) not executed: '+', '.join(required or ['descriptor has no chosen observable']))
    if any(r is not None and paired(r)=='BLOQUEADO' for r in exact):
        failed=next(r for r in exact if r is not None and paired(r)=='BLOQUEADO')
        return 'BLOQUEADO', 'Exact prerequisite '+failed['probe']+' failed: '+str(failed.get('observed'))
    if all(r is not None and paired(r)=='PASS' for r in exact):
        return 'EVIDENCIA_MEDIDA', 'Every descriptor observable and paired frontier passed in this cut'
    causes=[r.get('reason',r['probe']+': observed '+str(r.get('status'))) for r in exact if r is not None and paired(r)!='PASS']
    causes += ['Exact probe missing: '+name for name,r in zip(required,exact) if r is None]
    return 'PARCIAL', '; '.join(causes)


def class_verdict(attributes, relations, methods):
    states = attributes + relations + methods
    if states and all(s=='EVIDENCIA_MEDIDA' for s in states):
        return 'EVIDENCIA_MEDIDA', 'All exact attribute, association and individual method measurements passed'
    if states and all(s=='BLOQUEADO' for s in states):
        return 'BLOQUEADO', 'No executable class observable completed'
    return 'PARCIAL', 'Class aggregation retains every unresolved attribute, association and individual method'
