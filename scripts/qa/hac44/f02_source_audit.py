"""Record exact searches, UML ends and scenario representation without verdict inflation."""
import json
import re
from pathlib import Path
from common import ROOT, OUT, run, write, state

NATIVE = {
 'CargoUnit.totalWeightKg':('cargomesh/src/shared/schemas/v2/freight-request.ts','export function cargoUnitTotalsV2'),
 'CargoUnit.totalVolumeM3':('cargomesh/src/shared/schemas/v2/freight-request.ts','export function cargoUnitTotalsV2'),
 'CargoSpecification.validate':('cargomesh/src/shared/schemas/v2/freight-request.ts','export const CargoSpecificationV2Schema'),
 **{i:('cargomesh/src/server/modules/fleet/domain/assignment-policy.ts','export function evaluateFleetAvailability') for i in ('CapacitySource.availabilityFor','TransportAsset.availabilityFor','CapacityPool.availabilityFor','CapacityCalendar.availableAt','CapacityCalendar.blocks')},
 **{i:('cargomesh/src/server/modules/fleet/domain/assignment-policy.ts','export function evaluateDriverAssignment') for i in ('Driver.qualifiedFor','Driver.availableFor')},
 **{i:('cargomesh/src/server/modules/fleet/domain/assignment-policy.ts','export function evaluateVehicleCombination') for i in ('VehicleCombination.validateCompatibility','VehicleCombination.effectiveCapacityOn')},
}
EXISTING = {
 'FreightRequest.submit':('cargomesh/src/server/modules/freight-requests/application/request-lifecycle-service.ts','async submit('),
 'TransportPlanCandidate.assessEligibility':('supabase-v2/supabase/migrations/20261004154048_hac40_workflow.sql','create function private.workflow_evaluate_plan('),
 'PlanLegAssignment.validateEligibility':('supabase-v2/supabase/migrations/20261004154048_hac40_workflow.sql','select * into lane from public.service_lanes where id=a.lane_id;'),
 **{i:('supabase-v2/supabase/migrations/20261007170000_hac40_planner_qa_fixes.sql','create or replace function public.command_v2_route_planner(') for i in ('RoutePlanner.findAlternatives','RoutePlanner.replan')},
 'RoutePlanner.explain':('cargomesh/src/server/modules/workflow/application/route-planner-service.ts','async explain('),
}

def citation(path,term):
    lines=(ROOT/path).read_text(encoding='utf-8-sig').splitlines()
    hits=[i for i,l in enumerate(lines,1) if term in l and i>1]
    if not hits:raise ValueError('Source symbol not found: '+path+' '+term)
    return path+':'+str(hits[-1])

def prepare(config):
    """Change metadata only. Missing method measurements remain QA-owned."""
    inventory_path='docs/v2-amazon/models/FULL_MODEL_UML_INVENTORY.json'
    inv=json.loads((ROOT/inventory_path).read_text(encoding='utf-8'))
    for d in config['rows']:
        if d['tipo']=='relacion':
            uml=next(r for r in inv['relations'] if r['umlId']==d['id'].split()[0])
            d['umlEnds']={'source':uml['source'],'target':uml['target'],'labels':uml['endLabels']}
            d['umlCitation']=citation(inventory_path,'"umlId": "'+uml['umlId']+'"')
            d['drawingCitation']=citation(inv['source'],'id="'+uml['umlId']+'"')
            d['coverageObligations']=[('source-end',uml['endLabels'][0]),('target-end',uml['endLabels'][-1])] if uml['endLabels'] else [('inheritance','Native discriminated projection')]
            if not d['requiredProbes']:d['requiredProbes']=['RELATION '+d['id'].split()[0]+' both UML ends']
            if uml['endLabels']:
                exact='RELATION '+d['id'].split()[0]+' both UML ends'
                if exact not in d['requiredProbes']:d['requiredProbes'].append(exact)
            d['blockedCause']='QA HAC-44: '+d['representation']+' requires both UML ends '+str(uml['endLabels'])+'; missing the exact current control(s), not inferred from the FK'
            d['owner']='HAC-44 / Jean Paul (measurement)'
    for d in config['methods']:
        d['owner']='HAC-44 / Jean Paul (mapping/fixture)'
        if d['id'] in NATIVE:
            path,term=NATIVE[d['id']];d['fuentes_candidatas_verificadas']=[citation(path,term)]
            d['nativeSymbol']=term;d['mappingStatus']='VERIFIED_EXPORTED_RULE'
            d['requiredProbes']=['NATIVE_METHOD '+d['id']]
            d['observable']='Call '+term+' with valid input and isolated frontier'
            d['representationLimit']='Native exported product rule; no independently writable UML object'
        elif d['id'] in EXISTING:
            path,term=EXISTING[d['id']];d['fuentes_candidatas_verificadas']=[citation(path,term)]
            d['nativeSymbol']=term;d['mappingStatus']='VERIFIED_NATIVE_RPC_GUARD'
            d['representationLimit']='Exact native RPC/control probes; aggregate sharing requires the selected isolated frontier'
        else:
            # Locate actual declarations in the domain sources; do not claim a
            # semantic mapping merely because a declaration is in the same file.
            sources=[]
            for old in d['fuentes_candidatas_verificadas']:
                path=old.rsplit(':',1)[0]
                if not (ROOT/path).exists():continue
                for n,line in enumerate((ROOT/path).read_text(encoding='utf-8-sig').splitlines(),1):
                    if n>1 and re.search(r'export (?:async )?function |export const |create (?:or replace )?function ',line,re.I):
                        sources.append(path+':'+str(n));break
            d['fuentes_candidatas_verificadas']=sources
            d['mappingStatus']='VERIFIED_DOMAIN_DECLARATIONS_SEMANTIC_MAPPING_PENDING'
            if not d['requiredProbes']:d['requiredProbes']=['METHOD '+d['id']+' isolated']
            d['blockedCause']='QA HAC-44: semantic mapping and isolated '+d['metodo_uml']+' input/frontier remain unexecuted; domain declaration candidates '+(', '.join(sources) or 'absent in the originally proposed paths')+' are not proof of this signature'
            d['representationLimit']='Exact per-signature mapping/fixture required; source proximity is not implementation absence'
    return config

def main():
    config=json.loads(Path(__file__).with_name('f02_descriptors.json').read_text(encoding='utf-8'))
    prepared=prepare(config)
    searches=[]
    for d in prepared['methods']:
        method=d['id'].split('.')[-1];pattern=r'\b'+re.escape(method)+r'\b'
        result=run('method-search-'+d['id'],['rg','-n','--glob','!*.test.*','--glob','!*.spec.*',pattern,'cargomesh/src','supabase-v2/supabase/migrations'])
        if result.returncode not in (0,1):raise RuntimeError('Exact method search failed')
        searches.append({'id':d['id'],'command':['rg','-n','--glob','!*.test.*','--glob','!*.spec.*',pattern,'cargomesh/src','supabase-v2/supabase/migrations'],'exit':result.returncode,'hits':result.stdout.splitlines(),'interpretation':'Literal name search only; SQL aliases/aggregate commands prevent an absence conclusion without semantic mapping'})
    evidence=[];manifest='supabase/scenarios/v2-road-baseline/manifest.json'
    data=json.loads((ROOT/manifest).read_text(encoding='utf-8'))
    for field in ('id','label','seed','networkVersion','clock','source','expectedOutcome'):
        # Scope is the manifest root, not nested condition ids or incidental text.
        pattern=r'^  "'+field+r'"\s*:'
        result=run('scenario-field-'+field,['rg','-n',pattern,manifest])
        assert result.returncode==1 and field not in data
        evidence.append({'sha':state()['head'],'probe':'SCENARIO_FIELD RouteSimulationScenario.'+field,'rowIds':['RouteSimulationScenario.'+field],
          'status':'DOCUMENTACION_DESACTUALIZADA_CANDIDATA','expected':{'umlField':field},
          'observed':{'manifestRootKeyPresent':False,'rgExit':1,'rgHits':0,'realRootKeys':list(data)},
          'citations':[citation(manifest,'"baseClock"'),citation(manifest,'"package"'),citation('supabase/scenarios/v2-road-baseline/seed.sql','pass psql -v local_only=1'),citation('supabase-v2/gate.py',"script('seed',V2,SCENARIO/'seed.sql')")],
          'searchScope':'Manifest root schema; loader executes SQL, not a RouteSimulationScenario CRUD DTO',
          'reason':'UML '+field+' has no root field/explicit adapter in the real manifest; baseClock/package and SQL loader are the observed representation. Requires model reconciliation, never PASS.',
          'owner':'HAC-40 / Cristhian','controlPositive':'Existing manifest root parsed; unchanged native gate seed/verify execution is separately logged'})
    write(OUT/'PROBES/CP1B_DESCRIPTORS.json',json.dumps(prepared,ensure_ascii=False,indent=2)+'\n')
    write(OUT/'PROBES/CP1B_SOURCE_AUDIT.json',json.dumps({'sha':state()['head'],'searches':searches,'evidence':evidence,'complete':True},ensure_ascii=False,indent=2)+'\n')
    print('PASS exact source audit; method searches never confer runtime coverage')

if __name__=='__main__':main()
