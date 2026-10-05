"""Physical FK pairs: optional metadata is filled only inside rollback.
Domain guards are suspended; FK/CHECK triggers stay active. The orphan must
fail with the intended constraint name. This does not certify business rules.
"""
from local import *
import collections
def lit(s):return "'"+str(s).replace("'","''")+"'"
def where(row,pk):return ' and '.join('"'+k+'" is not distinct from '+lit(row[k]) for k in pk)
def main():
 cat=json.loads((LOGS/'catalog.json').read_text(encoding='utf-8'));design=json.loads((OUT/'repro/sources/FULL_MODEL_PHYSICAL_DESIGN.json').read_text(encoding='utf-8'))
 wanted={c['storage'].split('.')[0] for c in design['classes']}|{'selection_offers','route_resource_limits','vehicle_combination_assets','carrier_service_cargo_categories'}
 keys={k['schema']+'.'+k['relation']:k['columns'] for k in cat['keys']};constraints=[]
 for c in cat['constraints']:
  tab=c['relation'] if '.' in c['relation'] else 'public.'+c['relation']
  if c['contype']=='f' and tab.split('.')[-1] in wanted and tab in keys:
   m=re.search(r'FOREIGN KEY \(([^)]+)\) REFERENCES ([\w.]+)\(([^)]+)\)',c['definition']);assert m,c
   constraints.append((c,tab,m[1].split(', '),m[2] if '.' in m[2] else 'public.'+m[2],m[3].split(', ')))
 tables={t for _,t,_,_,_ in constraints}|{p for _,_,_,p,_ in constraints}
 query='select hac44_qa.capture_ids();select jsonb_object_agg(name,rows) from ('+' union all '.join("select "+lit(t)+" name,coalesce(jsonb_agg("+('jsonb_build_object(\'id\',id)' if t=='auth.users' else 'to_jsonb(t)')+"),'[]') rows from "+t+" t" for t in sorted(tables))+') x;'
 p=sql('fk-source-fixtures',query,persist=False);assert p.returncode==0;data=json.loads(next(line for line in p.stdout.splitlines() if line.startswith('{')))
 cases=[];q="begin;create extension if not exists pgtap with schema extensions;set local search_path=extensions,public;select no_plan();\n"
 q+="""create function pg_temp.fk_case(prelude text,good text,bad text,expected text,deferred text) returns table(positive boolean,negative boolean) language plpgsql as $$declare actual text;begin positive:=false;negative:=false;begin execute prelude;begin execute good;positive:=true;exception when others then positive:=false;end;if positive then execute deferred;begin execute bad;exception when foreign_key_violation then get stacked diagnostics actual=constraint_name;negative:=actual=expected;when others then negative:=false;end;end if;raise exception 'HAC44_CASE_ROLLBACK' using errcode='ZX001';exception when sqlstate 'ZX001' then null;end;return next;end$$;\n"""
 for c,tab,cols,parent,targets in constraints:
  children=data[tab];parents=[x for x in data[parent] if all(x.get(k) is not None for k in targets)]
  if not parents and parent=='public.cargo_profiles':parents=data[parent]
  row=next((x.copy() for x in children if any(all(x.get(a)==y.get(b) and x.get(a) is not None for a,b in zip(cols,targets)) for y in parents)),None);fallback=row is None;setup=[]
  if fallback and children and parents:
   # A pool fixture must use a calendar from the same service. Heap row order
   # after cleanup/reseed is not stable, and may otherwise pick the LTL service.
   cohort=('organization_id','carrier_id','carrier_service_id')
   pairs=[(x,y) for x in children for y in parents if all(x.get(k) is None or y.get(k) is None or x[k]==y[k] for k in cohort)]
   selected=(pairs or [(children[0],parents[0])])[0];row=selected[0].copy()
   compatible=[y for y in parents if all(row.get(k) is None or y.get(k) is None or row[k]==y[k] for k in cohort)]
   if parent==tab:compatible=[y for y in (compatible or parents) if y.get('id')!=row.get('id')]
   if tab=='public.fulfilment_partners' and 'partner_carrier_ref' in cols:compatible=[y for y in parents if y['id']!=row['carrier_id']]
   chosen=(compatible or parents)[0]
   if parent=='public.cargo_profiles' and 'organization_id' in targets and chosen.get('organization_id')!=row.get('organization_id'):
    chosen=chosen.copy();chosen['organization_id']=row['organization_id'];setup.append('update public.cargo_profiles set organization_id='+lit(row['organization_id'])+' where id='+lit(chosen['id']))
   for a,b in zip(cols,targets):row[a]=chosen[b]
   if tab=='public.capacity_calendars' and 'capacity_pool_id' in cols:row['transport_asset_id']=None
   if tab=='public.plan_resources' and 'capacity_pool_id' in cols:row['asset_id']=None
   if tab=='public.route_resource_limits' and 'combination_id' in cols:row['asset_id']=None
   if tab=='public.mcp_account_links' and 'revoked_by_user_id' in cols:row.update(status='REVOKED',revoked_at=row['expires_at'])
  case={'constraint':c['conname'],'table':tab,'definition':c['definition'],'positiveRow':{k:row[k] for k in keys[tab]} if row else None,'status':'PENDING' if row else 'BLOQUEADO','fixture':'rollback-only optional metadata' if fallback else 'native persisted reference','reason':'' if row else 'No child/parent fixture'};cases.append(case)
  if not row:continue
  prelude='';changed={tab}|({'public.cargo_profiles'} if setup else set())
  for t in cat['triggers']:
   if t['schema']+'.'+t['relation'] in changed and not t['tgisinternal']:prelude+='alter table '+t['schema']+'.'+t['relation']+' disable trigger "'+t['tgname']+'";\n'
  prelude+=';\n'.join(setup)+(';\n' if setup else '');controlcols=list(cols)
  if fallback:
   for k in ('transport_asset_id','asset_id'):
    if k in row and row[k] is None and k not in cols:controlcols.append(k)
   if tab=='public.mcp_account_links' and 'revoked_by_user_id' in cols:controlcols+=['status','revoked_at']
  original=next(x for x in children if all(x[k]==row[k] for k in keys[tab]))
  same='update '+tab+' set '+','.join('"'+k+'"='+('null' if row[k] is None else lit(row[k])) for k in controlcols)+' where '+where(original,keys[tab])
  bad='update '+tab+' set "'+cols[-1]+'"='+lit('d44fffff-ffff-4fff-8fff-ffffffffffff')+' where '+where(original,keys[tab])
  deferred=''
  # Overlapping FKs otherwise mask the constraint being tested. Defer only the
  # other FK checks during the orphan probe; the positive ran with all immediate.
  # Every schema/state change is undone by the per-case SAVEPOINT and final rollback.
  for other in cat['constraints']:
   if other['contype']=='f' and (other['relation'],other['conname'])!=(c['relation'],c['conname']):deferred+='alter table '+other['relation']+' alter constraint "'+other['conname']+'" deferrable initially deferred;\n'
  q+='select unnest(array[ok(p.positive,'+lit(c['conname']+' positive existing reference')+'),ok(p.negative,'+lit(c['conname']+' rejects exact FK orphan')+')]) from pg_temp.fk_case('+','.join(lit(x) for x in (prelude,same,bad,c['conname'],deferred))+') p;\n'
 q+='select * from finish();rollback;';p=sql('independent-fk-pairs',q);tap=[line for line in p.stdout.splitlines() if re.match(r'^(?:not )?ok \d+',line)];i=0
 for case in cases:
  if case['status']=='PENDING':
   pair=tap[i:i+2];i+=2;case['tap']=pair;case['status']='PASS' if len(pair)==2 and all(x.startswith('ok ') for x in pair) else 'BLOQUEADO' if pair and pair[0].startswith('not ok') else 'FAIL'
 passed=p.returncode==0 and all(x['status']=='PASS' for x in cases)
 save('independent-fk-pairs.json',{'status':'PASS' if passed else 'FAIL','scope':'postgres; rollback-only domain guard suspension; FK/CHECK active; exact constraint checked; no business/cardinality assertion','tests':len(tap),'cases':cases});print(json.dumps(collections.Counter(x['status'] for x in cases)));sys.exit(0 if passed else 1)
if __name__=='__main__':main()
