"""Explicit synthetic workflow fixture on the dedicated LOCAL V2 container only."""
from pathlib import Path
import json, subprocess

ROOT=Path(__file__).resolve().parents[1]
CONTAINER='supabase_db_cargomesh-v2-local'
USER='c2310000-0000-4000-8000-000000000001'
ORG='c2300000-0000-4000-8000-000000000001'
MEMBER='c2320000-0000-4000-8000-000000000001'
CARRIER='c2340000-0000-4000-8000-000000000001'
SERVICE='c2360000-0000-4000-8000-000000000001'

def sql(query):
 return subprocess.run(['docker','exec','-i',CONTAINER,'psql','-X','-A','-t','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose'],input=query,text=True,capture_output=True)

def literal(value):return "'"+value.replace("'","''")+"'"

def prepare():
 check=sql(f"select count(*) from private.v2_catalog_grants where auth_user_id='{USER}' and permission='CATALOG_ADMIN';select count(*) from public.transport_assets where code='WORKFLOW_QA';")
 assert check.returncode==0 and check.stdout.split()==['0','0'],'Fixture collision; refusing overwrite.'
 previous={}
 for table in ['service_areas','service_lanes']:
  result=sql(f"select coalesce(jsonb_agg(jsonb_build_object('id',id,'validFrom',valid_from,'validUntil',valid_until,'verifiedAt',verified_at)),'[]') from public.{table} where carrier_service_id='{SERVICE}';")
  assert result.returncode==0,result.stderr;previous[table]=json.loads(result.stdout)
 link=sql(f"select count(*) from public.carrier_service_cargo_categories where carrier_service_id='{SERVICE}' and cargo_category_id='c0000000-0000-0000-0000-000000000001';")
 previous['categoryLink']=link.stdout.strip()=='1'
 source=(ROOT/'supabase/tests/22_v2_hac40_workflow.test.sql').read_text()
 source=source[:source.index("select pg_temp.save('hold'")]
 source='\n'.join(line for line in source.splitlines() if not line.startswith(('select ok(','select is(','select no_plan(')))
 source+="\nreset role;select 'HAC40_FIXTURE:'||jsonb_object_agg(name,value)::text from refs;commit;"
 result=sql(source);assert result.returncode==0,result.stderr
 refs=json.loads(next(line.split('HAC40_FIXTURE:',1)[1] for line in result.stdout.splitlines() if line.startswith('HAC40_FIXTURE:')))
 return {'refs':refs,'previous':previous}

def cleanup(state):
 refs=state['refs'];q=refs['request']['id'];ids=','.join(literal(v['id']) for v in refs.values())
 workflow=['execution_events','incident_updates','operational_incidents','v2_bookings','selection_decisions','v2_rankings','v2_carrier_offers','carrier_opportunities','transport_plan_candidates','route_plans','route_resource_limits','route_corridors','logistics_nodes','route_planning_policies','scoring_policies']
 statements=['begin;']
 for table in workflow:statements.append(f'alter table public.{table} disable trigger workflow_guard;')
 for table in ['driver_assignments','vehicle_assignments','drivers']:statements.append(f'alter table public.{table} disable trigger crew_command_guard;')
 statements.extend([f"delete from public.driver_assignments where execution_id in(select id from public.transport_executions where freight_request_id='{q}');",
 f"delete from public.vehicle_assignments where execution_id in(select id from public.transport_executions where freight_request_id='{q}');",
 f"delete from public.capacity_reservations where freight_request_id='{q}';",
 f"delete from public.execution_events where freight_request_id='{q}';",
 f"delete from public.incident_updates where freight_request_id='{q}';",
 f"delete from public.operational_incidents where freight_request_id='{q}';",
 f"delete from public.transport_executions where freight_request_id='{q}';",
 f"delete from public.v2_bookings where freight_request_id='{q}';",
 f"delete from public.selection_offers where decision_id in(select id from public.selection_decisions where freight_request_id='{q}');",
 f"delete from public.selection_decisions where freight_request_id='{q}';",
 f"delete from public.ranked_options where ranking_id in(select id from public.v2_rankings where freight_request_id='{q}');",
 f"delete from public.v2_rankings where freight_request_id='{q}';",
 f"delete from public.v2_carrier_offers where freight_request_id='{q}';",
 f"delete from public.carrier_opportunities where freight_request_id='{q}';",
 f"delete from public.load_allocations where assignment_id in(select id from public.plan_leg_assignments where plan_id='{refs['plan']['id']}');",
 f"delete from public.plan_leg_assignments where plan_id='{refs['plan']['id']}';",
 f"delete from public.plan_resources where plan_id='{refs['plan']['id']}';",
 f"delete from public.transport_plan_candidates where freight_request_id='{q}';",
 f"delete from public.route_waypoints where route_leg_id in(select id from public.route_legs where route_plan_id='{refs['route']['id']}');",
 f"delete from public.route_legs where route_plan_id='{refs['route']['id']}';",
 f"delete from public.route_plans where freight_request_id='{q}';"])
 for table in ['route_resource_limits','route_corridors','logistics_nodes','route_planning_policies','scoring_policies']:statements.append(f'delete from public.{table} where id in({ids});')
 for table in workflow:statements.append(f'alter table public.{table} enable trigger workflow_guard;')
 for table in ['driver_assignments','vehicle_assignments','drivers']:statements.append(f'alter table public.{table} enable trigger crew_command_guard;')
 for table in ['capacity_calendars','asset_cargo_capabilities','transport_assets','cargo_capability_definitions']:statements.append(f'delete from public.{table} where id in({ids});')
 statements.extend([f"delete from private.v2_request_command_receipts where request_id='{q}';",f"delete from public.freight_requests where id='{q}';",
 f"delete from private.v2_catalog_receipts where result->>'id' in({ids});",
 f"delete from private.v2_workflow_receipts where (result->>'requestId'='{q}' or result->>'id' in({ids})) and organization_id='{ORG}' and member_id='{MEMBER}';",
 f"delete from private.v2_catalog_grants where auth_user_id='{USER}' and permission='CATALOG_ADMIN';"])
 for table,rows in state['previous'].items():
  if table=='categoryLink':continue
  for row in rows:
   value=lambda key:literal(row[key]) if row[key] is not None else 'null'
   statements.append(f"update public.{table} set valid_from={value('validFrom')},valid_until={value('validUntil')},verified_at={value('verifiedAt')} where id={literal(row['id'])};")
 if not state['previous']['categoryLink']:statements.append(f"delete from public.carrier_service_cargo_categories where carrier_service_id='{SERVICE}' and cargo_category_id='c0000000-0000-0000-0000-000000000001';")
 statements.append('commit;');result=sql('\n'.join(statements));assert result.returncode==0,result.stderr

if __name__=='__main__':
 import argparse
 parser=argparse.ArgumentParser();parser.add_argument('action',choices=['prepare','cleanup']);parser.add_argument('--state',type=Path,required=True);args=parser.parse_args()
 if args.action=='prepare':
  assert not args.state.exists(),'State exists; refusing overwrite.'
  args.state.write_text(json.dumps(prepare(),indent=2),encoding='utf-8')
 else:cleanup(json.loads(args.state.read_text()))
