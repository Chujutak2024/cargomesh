"""Measure association ends; physical integrity cannot stand in for child minima."""
import json
import re
from pathlib import Path
from common import ROOT, OUT, LOGS, write, state
from local import sql
from catalog import QUERY
from fk_inventory import validate_inventory
from fk_strict import build_case, probe_sql, merge_results, lit, table_ident
from f02_rules import paired

NULLABLE_NATIVE_GUARDS={
 'O3AsrRVXhiO8iDlZrkKS-209':'CP1C nullable asset_status_events.parent_id',
 'O3AsrRVXhiO8iDlZrkKS-251':'CP1C nullable carrier_opportunities.plan_id',
 'O3AsrRVXhiO8iDlZrkKS-260':'CP1C nullable v2_carrier_offers.carrier_id',
}

def mandatory_nullable_obligation(ends, nullable, guard):
    if '1' not in ends or not any(not n['notNull'] for n in nullable):return None
    if guard and paired(guard)=='PASS' and guard.get('observed',{}).get('negative',{}).get('accepted') is False:return None
    return 'Mandatory UML end has nullable physical columns: '+str(nullable)+'; isolated native parent guard is missing or did not pass'

# Explicit F-02 associations, never a wider replacement of the baseline gate.
PHYSICAL={
 'O3AsrRVXhiO8iDlZrkKS-152':('public.freight_requests','public.organizations'),
 'O3AsrRVXhiO8iDlZrkKS-176':('public.service_lanes','public.carrier_services'),
 'O3AsrRVXhiO8iDlZrkKS-188':('public.transport_assets','public.carriers'),
 'O3AsrRVXhiO8iDlZrkKS-197':('public.capacity_pools','public.carrier_services'),
 'O3AsrRVXhiO8iDlZrkKS-209':('public.asset_status_events','public.transport_assets'),
 'O3AsrRVXhiO8iDlZrkKS-212':('public.drivers','public.carriers'),
 'O3AsrRVXhiO8iDlZrkKS-251':('public.carrier_opportunities','public.transport_plan_candidates'),
 'O3AsrRVXhiO8iDlZrkKS-260':('public.v2_carrier_offers','public.carriers'),
 'g8S2DPwqzsmnHs3VKEzF-1':('public.organization_members','public.organizations'),
 'bR8ZHdLwjZc_sJT4jZ76-1':('public.vehicle_combination_assets','public.transport_assets'),
 'zAdGsDxVq7Eb_sLkxGRV-1':('public.v2_carrier_offers','public.carrier_operators'),
 '6Ioss1hAN_-tinRlzXcZ-1':('public.asset_cargo_capabilities','public.transport_assets'),
 'Ftk5fUhrMQUH-lgMXdC8-1':('public.selection_offers','public.v2_carrier_offers'),
}

def read(label,query,persist=True):
    r=sql(label,query,persist=persist)
    if r.returncode:raise RuntimeError(label+' failed; no inferred result')
    return json.loads(next(l for l in r.stdout.splitlines() if l.startswith(('{','['))))

def main():
    config=json.loads((OUT/'PROBES/CP1B_DESCRIPTORS.json').read_text(encoding='utf-8'))
    catalog=read('f02-association-catalog',QUERY)
    selected=[r for r in validate_inventory(catalog) if (r['table'],r['referenceTable']) in PHYSICAL.values()]
    tables={r['table'] for r in selected}|{r['referenceTable'] for r in selected}|{'public.organizations','public.organization_members','public.carrier_operators','public.carrier_services','public.facilities','public.freight_requests','public.carriers','auth.users'}
    source='select jsonb_object_agg(name,rows) from ('+' union all '.join("select "+lit(t)+" name,coalesce(jsonb_agg("+("jsonb_build_object('id',id)" if t=='auth.users' else 'to_jsonb(t)')+"),'[]') rows from "+table_ident(t)+' t' for t in sorted(tables))+') x;'
    data=read('f02-association-fixtures',source,persist=False)
    cases=[build_case(r,catalog,data,association=True) for r in selected]
    measured=sql('f02-association-authenticated-fk',probe_sql(cases));merge_results(cases,measured.stdout,measured.returncode)
    # Each count query runs under issuer claims and rolls back with full counts.
    claims='set local "request.jwt.claims"=\'{"sub":"d4410000-0000-4000-8000-000000000001","role":"authenticated"}\';'
    evidence=[]
    native=json.loads((OUT/'PROBES/CP2_RESULTADOS.json').read_text(encoding='utf-8'))['evidence']
    for d in config['rows']:
        key=d['id'].split()[0]
        if d['tipo']!='relacion' or key not in PHYSICAL:continue
        child,parent=PHYSICAL[key];refs=[r for r in selected if r['table']==child and r['referenceTable']==parent]
        exact=[c for c in cases if c['table']==child and c['constraint'] in {r['constraint'] for r in refs}]
        obligations=[];counts=[];nullable=[]
        native_many=next((r for r in native if r['probe']=='RELATION '+key+' native 0 and 2 belonging' and r['status']=='PASS'),None)
        native_parent=next((r for r in native if r['probe']==NULLABLE_NATIVE_GUARDS.get(key)),None)
        for fk in refs:
            schema,table=child.split('.')
            nulls=[c for c in catalog['columns'] if c['table_schema']==schema and c['table_name']==table and c['column_name'] in fk['childColumns']]
            nullable.extend({'column':c['column_name'],'notNull':c['is_nullable']=='NO'} for c in nulls)
            if len(fk['childColumns'])==1 and fk['referenceColumns']==['id']:
                col=fk['childColumns'][0]
                # Counts are inventory, not an RLS or native-command proof. A
                # transaction-local read helper replaces the denied direct read;
                # the invoker and deferred FK cases still use real authenticated.
                query=f"begin;create function pg_temp.association_counts() returns jsonb language sql security definer set search_path='' as $$select coalesce(jsonb_agg(x),'[]'::jsonb) from (select p.id,count(c.{col}) children from {parent} p left join {child} c on c.{col}=p.id group by p.id) x;$$;grant execute on function pg_temp.association_counts() to authenticated;set local role authenticated;{claims}select jsonb_build_object('role',current_user,'actualSession',current_setting('request.jwt.claims')::jsonb ? 'session_id','parents',pg_temp.association_counts(),'countReadMode','PHYSICAL_INVENTORY_ONLY_NOT_RLS');set constraints all immediate;rollback;"
                result=sql('f02-association-count-'+key,query)
                if result.returncode:
                    counts.append({'constraint':fk['constraint'],'parents':[],'readStatus':'BLOQUEADO','reason':'Authenticated direct count not exposed by native table permissions; native HTTP child collection is used where measured','exit':result.returncode})
                else:
                    observed=json.loads(next(l for l in result.stdout.splitlines() if l.startswith('{')))
                    counts.append({'constraint':fk['constraint'],**observed})
        if not exact or any(c['status']!='PASS' for c in exact):obligations.append('Exact authenticated FK pair unresolved: '+', '.join(c['constraint']+'='+c['status']+' '+c.get('reason','') for c in exact or [{'constraint':'no matching physical FK','status':'BLOQUEADO'}]))
        ends=d['umlEnds']['labels']
        nullable_obligation=mandatory_nullable_obligation(ends,nullable,native_parent)
        if nullable_obligation:obligations.append(nullable_obligation)
        if '0..*' in ends:
            population=[p['children'] for c in counts for p in c['parents']]
            if 0 not in population and not native_many:obligations.append('No visible valid zero-child parent in this fresh native cohort')
            if not any(n>=2 for n in population) and not native_many:obligations.append('No visible native parent with >=2 children; existing FK is insufficient')
        if '1..*' in ends:obligations.append('Deferred empty-child guard at ALL IMMEDIATE vs valid one-child command not isolated for this association')
        if not native_many:obligations.append('Same-tenant/foreign-tenant native write pair for this exact association remains unexecuted; Auth and physical FK alone do not certify belonging')
        evidence.append({'sha':state()['head'],'probe':'RELATION '+key+' both UML ends','rowIds':[d['id']],
          'status':'PASS' if not obligations else 'PARCIAL' if any(c['status']=='PASS' for c in exact) else 'BLOQUEADO',
          'observed':{'umlEnds':d['umlEnds'],'counts':counts,'notNull':nullable,'exactFkPairs':exact,'nativeZeroMany':native_many,'nativeParentGuard':native_parent,'unresolved':obligations},
          'controlPositive':'Fresh native child/parent fixtures; each physical negative is paired at authenticated ALL IMMEDIATE',
          'reason':'; '.join(obligations),'umlCitation':d['umlCitation'],'drawingCitation':d['drawingCitation']})
        write(OUT/'PROBES/CP1B_RELATIONS.json',json.dumps({'sha':state()['head'],'evidence':evidence,'complete':False},ensure_ascii=False,indent=2)+'\n')
    write(OUT/'PROBES/CP1B_RELATIONS.json',json.dumps({'sha':state()['head'],'evidence':evidence,'complete':True},ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'associations':len(evidence),'exactPhysicalPairs':len(cases),'states':{s:sum(c['status']==s for c in cases) for s in ('PASS','FAIL','BLOQUEADO')},'businessMultiplicityNeverInferred':True}))

if __name__=='__main__':main()
