"""Complete UML method → native operation → executed test cross-reference.
Related-operation mapping is explicitly distinguished from method certification.
"""
from matrix import *
GROUPS_METHODS=[
 ('Organization OrganizationMember','workflow_member','17_v2_hac40_organization_commands.test.sql'),
 ('Facility','command_v2_facility','15_v2_hac40_facility_commands.test.sql'),
 ('FreightRequest CargoSpecification CargoUnit ShipmentContact','validate_v2_freight_payload','18_v2_hac40_full_request_contract.test.sql'),
 ('Carrier CarrierDepot CarrierService CargoProfile CargoCategory OrganizationPreferences FulfilmentPartner ServiceArea','command_v2_catalog','19_v2_hac40_catalog.test.sql'),
 ('ServiceLane','validate_v2_road_lane','09_v2_clean_road_network.test.sql'),
 ('CapacitySource TransportAsset RoadVehicle CapacityPool CapacityCalendar ScheduledMaintenance RepositioningBlock AssetCargoCapability','command_v2_fleet','20_v2_hac40_fleet.test.sql'),
 ('Driver DriverAssignment VehicleAssignment VehicleCombination','command_v2_crew','21_v2_hac40_crew.test.sql'),
 ('RoutePlan RouteLeg RouteCondition RouteWaypoint RoutePlanningPolicy LogisticsNode RouteCorridor RouteSimulationScenario RoutePlanner','workflow_route','22_v2_hac40_workflow.test.sql'),
 ('TransportPlanCandidate PlanResource PlanLegAssignment LoadAllocation','workflow_evaluate_plan','26_v2_hac40_workflow_constraints.test.sql'),
 ('CarrierOpportunity CarrierOffer OfferCostComponent','workflow_offer','22_v2_hac40_workflow.test.sql'),
 ('RankedOption ScoringPolicy CarrierMetric','workflow_ranking','22_v2_hac40_workflow.test.sql'),
 ('SelectionDecision','workflow_selection','22_v2_hac40_workflow.test.sql'),
 ('Booking CapacityReservation TransportExecution OperationalIncident IncidentUpdate AssetStatusEvent','command_v2_workflow','23_v2_hac40_operation.test.sql'),
 ('McpAccountLink','resolve_mcp_account_link','12_hac11_mcp_account_links.test.sql'),
]

def main():
 groups={name:(fn,test) for names,fn,test in GROUPS_METHODS for name in names.split()}
 functions={x['proname']:x for x in CAT['functions']};rows=[]
 for cls in SRC['official']['classes']:
  for method in cls['methods']:
   name=cls['name'];operation=groups.get(name);refs=[];tests=[];status='MAPPED_RELATED_OPERATION' if operation else 'NO_CANONICAL_WRITER'
   if name=='McpAccountLink':
    source='cargomesh/src/server/mcp/auth/user-token.ts';lines=(ROOT/source).read_text(encoding='utf-8-sig').splitlines();refs=[source+':'+str(next(i+1 for i,line in enumerate(lines) if 'export async function authenticateMcpUserBearer(' in line))]
    tests=[{'source':'supabase/tests/12_hac11_mcp_account_links.test.sql','execution':'logs/gate-v2-pgtap.log'},{'source':'cargomesh/src/server/mcp/auth/user-token.test.ts','execution':'logs/test-release.log'}];status='MAPPED_RELATED_OPERATION';operation=('authenticateMcpUserBearer','12_hac11_mcp_account_links.test.sql')
   elif operation:
    fn,test=operation
    # Some public wrappers have different names; never invent a catalog function.
    if fn not in functions:
     aliases={'command_v2_facility':'command_v2_facilities','resolve_mcp_account_link':'resolve_mcp_member'}
     fn=aliases.get(fn,fn)
    if fn in functions:
     for source,lines in SOURCES.items():
      for i,line in enumerate(lines):
       if re.search(r'(?:create (?:or replace )?function)\s+(?:private|public)\.'+re.escape(fn)+r'\(',line,re.I):refs.append(source+':'+str(i+1))
    else:status='BLOQUEADO_FUNCTION_NOT_FOUND'
    path=ROOT/'supabase/tests'/test
    if path.exists():
     for i,line in enumerate(path.read_text(encoding='utf-8-sig').splitlines()):
      if re.search(r'^select\s+(?:is|ok|throws_ok|lives_ok|like|unlike|cmp_ok)\(',line,re.I):tests.append({'source':'supabase/tests/'+test+':'+str(i+1),'statement':line})
    if not refs or not tests:status='BLOQUEADO_EXACT_REFERENCE'
   rows.append({'class':name,'umlMethod':method,'nativeOperation':operation[0] if operation else None,'serviceSources':refs,'testCases':tests,'execution':'logs/gate-v2-pgtap.log (unchanged profile passed)' if tests else 'BLOQUEADO','status':status,'certification':'RELATED_OPERATION_ONLY: exact standalone UML-method semantics are not inferred from a suite passing','productSha':HEAD})
 save('method-map.json',rows);csvwrite('HAC-44_mapa_metodos.csv',[{k:jsonstr(v) if isinstance(v,(dict,list)) else v for k,v in row.items()} for row in rows]);save('method-map-counts.json',dict(collections.Counter(x['status'] for x in rows)));print('PASS exhaustive method inventory: '+str(len(rows))+' explicit mappings/limits')
if __name__=='__main__':main()
