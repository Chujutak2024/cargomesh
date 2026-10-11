"""CP-1c contract revisions and semantic scenario representations; no inferred PASS."""
import hashlib
import json
from pathlib import Path
from common import ROOT, OUT, write, run, state

REVISED = {35:'O3AsrRVXhiO8iDlZrkKS-248',40:'O3AsrRVXhiO8iDlZrkKS-263',
           73:'rg1mzH5NKyUcr1gneQok-1',83:'TTPNMglXCn0O7Q35afVn-1',90:'cm-v2fix-3'}
UNUSED = {'CapacitySource.availabilityFor','TransportAsset.availabilityFor','CapacityPool.availabilityFor',
          'CapacityCalendar.availableAt','CapacityCalendar.blocks','Driver.qualifiedFor','Driver.availableFor',
          'VehicleCombination.validateCompatibility','VehicleCombination.effectiveCapacityOn'}

def cite(path, term):
    lines=(ROOT/path).read_text(encoding='utf-8-sig').splitlines()
    return path+':'+str(next(i for i,l in enumerate(lines,1) if i>1 and term in l))

def prepare(config):
    current='docs/v2-amazon/models/FULL_MODEL_CURRENT_RELATIONS.json'
    drawing='docs/v2-amazon/diagrams/review-2026-09-24/08-complete-classes-contract-reconciled-2026-10-09.drawio'
    rows=json.loads((ROOT/current).read_text(encoding='utf-8'))['relations']
    for number,key in REVISED.items():
        revision=next(r for r in rows if r.get('number')==number)
        assert revision['umlId']==key
        for d in config['rows']:
            if d['tipo']=='relacion' and d['id'].split()[0]==key:
                d['historicalUmlEnds']=d['umlEnds']
                d['umlEnds']={**d['umlEnds'],'labels':revision['currentEndLabels']}
                d['contractRevision']='UML08 / #118'
                d['umlCitation']=cite(current,'"number": '+str(number)+',')
                d['drawingCitation']=cite(drawing,'id="'+key+'"')
                d['representation']=revision['treatment']
                d['requiredProbes']=['CP1C UML08 relation '+str(number)+' both ends']
                d['coverageObligations']=[('source-end',revision['currentEndLabels'][0]),('target-end',revision['currentEndLabels'][1])]
    return config

def scenario_evidence():
    files=sorted(p for directory in (ROOT/'supabase/scenarios').glob('v2-*') for p in directory.rglob('*') if p.is_file() and p.suffix in ('.json','.sql','.py','.md'))
    manifests=[p for p in files if p.name=='manifest.json']
    representations={'id':'package','clock':'baseClock','source':'provenance','expectedOutcome':'cases','seed':'stableSeedKeys'}
    evidence=[];equivalences=[]
    for field in ('id','label','seed','networkVersion','clock','source','expectedOutcome'):
        equivalents=[]
        for p in manifests:
            data=json.loads(p.read_text(encoding='utf-8'));key=representations.get(field)
            if key and key in data:
                equivalents.append({'path':str(p.relative_to(ROOT)).replace('\\','/'),'key':key,'value':data[key],
                                     'citation':cite(str(p.relative_to(ROOT)).replace('\\','/'),'"'+key+'"')})
        if field=='seed':
            equivalents.extend({'path':str(p.relative_to(ROOT)).replace('\\','/'),'key':'SQL loader input',
                'valueSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'citation':str(p.relative_to(ROOT)).replace('\\','/')+':2'} for p in files if p.name=='seed.sql')
        # Place labels, corridor revisions and clocks in individual business rows
        # are not a scenario label or a network-wide version.
        search=run('cp1c-scenario-semantic-'+field,['rg','-n','--glob','*',
            {'id':'package|stableSeedKeys','label':'label|name|title','seed':'seed.sql|stableSeedKeys|\\\\ir',
             'networkVersion':'networkVersion|graphVersion|corridorVersion|version','clock':'baseClock|clock|now\\(',
             'source':'provenance|source','expectedOutcome':'cases|expectedOutcome|expected|assert'}[field],
            *[str(p.relative_to(ROOT)) for p in files]])
        if search.returncode not in (0,1):raise RuntimeError('Semantic scenario search failed')
        reason=('Verified equivalent name/representation: '+', '.join(x['key'] for x in equivalents)
                if equivalents else 'No verified scenario-level equivalent after semantic search; nested place labels and per-corridor versions do not establish this field')
        row={'sha':state()['head'],'probe':'SCENARIO_FIELD RouteSimulationScenario.'+field,'rowIds':['RouteSimulationScenario.'+field],
             'status':'DOCUMENTACION_DESACTUALIZADA_CANDIDATA','expected':{'umlField':field},
             'observed':{'equivalents':equivalents,'searchedFiles':[str(p.relative_to(ROOT)).replace('\\','/') for p in files],
                         'semanticSearchExit':search.returncode,'semanticHits':search.stdout.splitlines()},
             'reason':reason,'citations':[x['citation'] for x in equivalents] or ['supabase/scenarios/v2-road-baseline/manifest.json:2'],
             'controlPositive':'Parsed actual V2 manifests and hashed native seed inputs; no CRUD or method PASS',
             'owner':'HAC-40 / Cristhian','classification':'DOCUMENTATION_DIFFERENT_NAME' if equivalents else 'DOCUMENTATION_ABSENT_EQUIVALENT_PENDING'}
        evidence.append(row);equivalences.append({'umlField':field,'classification':row['classification'],'equivalents':equivalents,'reason':reason})
    write(OUT/'PROBES/CP1C_SCENARIO_EQUIVALENCES.json',json.dumps({'productSha':state()['head'],'rows':equivalences},ensure_ascii=False,indent=2)+'\n')
    return evidence
