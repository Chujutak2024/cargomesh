"""Map every historical UML signature to a native aggregate observable target.

An aggregate target is not proof that the standalone signature exists or that its
entire semantics have been measured. Exact paired evidence remains mandatory.
"""
import json
import re
from collections import deque
from common import ROOT, OUT, write, state

# Class-level execution targets are refined by the per-signature boundary below.
TARGETS={
 'Organization':'private.is_organization_member','Facility':'private.valid_v2_facility_details',
 'FreightRequest':'private.command_v2_freight_request','CargoSpecification':'private.validate_v2_freight_payload',
 'CargoUnit':'private.workflow_evaluate_plan','Carrier':'private.workflow_carrier','CarrierDepot':'private.catalog_record',
 'CarrierService':'private.workflow_evaluate_plan','ServiceLane':'private.workflow_evaluate_plan',
 'ResponseIntegration':'public.diagnose_v2_response_integration','CapacitySource':'private.workflow_evaluate_plan',
 'TransportAsset':'private.workflow_evaluate_plan','RoadVehicle':'private.command_v2_fleet',
 'CapacityPool':'private.workflow_evaluate_plan','CapacityCalendar':'private.workflow_evaluate_plan',
 'CapacityReservation':'private.workflow_reservation_sharing','ScheduledMaintenance':'private.guard_v2_crew_dependencies',
 'Driver':'private.guard_v2_crew','VehicleAssignment':'private.guard_v2_crew','AssetStatusEvent':'private.command_v2_workflow_before_ltl_operations',
 'RoutePlan':'private.workflow_route','RouteLeg':'private.workflow_route','RouteCondition':'private.workflow_route',
 'RouteWaypoint':'private.workflow_planner_snapshot','RoutePlanningPolicy':'private.workflow_route',
 'TransportPlanCandidate':'private.workflow_evaluate_plan','PlanResource':'private.workflow_evaluate_plan',
 'CarrierOpportunity':'private.workflow_offer','CarrierOffer':'private.workflow_offer_current',
 'RankedOption':'private.workflow_ranking','ScoringPolicy':'private.workflow_ranking',
 'Booking':'private.command_v2_workflow_before_ltl_operations','TransportExecution':'private.command_v2_workflow_before_ltl_operations',
 'OperationalIncident':'private.command_v2_workflow_before_ltl_operations','IncidentUpdate':'private.command_v2_workflow_before_ltl_operations',
 'LogisticsNode':'private.workflow_route','RouteCorridor':'private.workflow_route','CargoProfile':'private.catalog_record',
 'CargoCategory':'private.catalog_record','LoadAllocation':'private.workflow_evaluate_plan',
 'OrganizationMember':'private.workflow_member','McpAccountLink':'private.identity_link_active',
 'RepositioningBlock':'private.guard_v2_crew_dependencies','OrganizationPreferences':'private.catalog_record',
 'CarrierMetric':'private.workflow_ranking','VehicleCombination':'private.workflow_evaluate_plan',
 'ServiceArea':'private.workflow_area','FulfilmentPartner':'private.validate_leg_partner',
 'PlanLegAssignment':'private.workflow_evaluate_plan','OfferCostComponent':'private.workflow_offer',
 'ShipmentContact':'private.validate_v2_freight_payload','CarrierOperator':'private.identity_carrier_action',
 'AssetCargoCapability':'private.workflow_evaluate_plan','RouteSimulationScenario':None,
 'RoutePlanner':'public.command_v2_route_planner','SelectionDecision':'private.workflow_selection',
}
OVERRIDES={
 'Organization.maySubmit':'private.workflow_member',
 'Organization.owns':'private.assert_v2_facility_not_foreign','Facility.belongsTo':'private.assert_v2_facility_not_foreign',
 'FreightRequest.validateCompleteness':'private.validate_v2_freight_payload','CargoSpecification.fits':'private.workflow_evaluate_plan',
 'CargoSpecification.requiresPermit':'private.workflow_evaluate_plan','CargoSpecification.validate':None,'CargoUnit.totalWeightKg':None,'CargoUnit.totalVolumeM3':None,
 'CapacityCalendar.nextAvailable':'private.fleet_record','CapacityReservation.release':'private.command_v2_workflow_before_ltl_operations',
 'RoadVehicle.legalCapacityFor':'private.workflow_evaluate_plan','RoadVehicle.isRoadworthy':'private.workflow_evaluate_plan',
 'VehicleAssignment.release':'private.command_v2_crew','RoutePlan.orderedLegs':'private.project_workflow_record',
 'RoutePlan.compareWith':'private.workflow_planner_snapshot','CarrierOpportunity.invite':'private.command_v2_workflow_before_ltl_operations',
 'CarrierOffer.covers':'private.workflow_offer','CarrierOffer.validatesBreakdownCurrency':'private.workflow_offer',
 'CarrierOffer.validatesAttribution':'private.guard_offer_issuer','RankedOption.provenance':'private.workflow_ranking',
 'Booking.cancel':'private.workflow_release_booking','Booking.validateCapacityCommitment':'private.command_v2_workflow_before_ltl_operations',
 'TransportExecution.requestReplan':'public.command_v2_route_planner','IncidentUpdate.auditRecord':'private.read_v2_workflow',
 'RoutePlanner.explain':'private.read_v2_workflow','SelectionDecision.auditRecord':'private.read_v2_workflow',
}

# Every entry describes a concrete changed input. No literal-name search proves
# absence of an alias. Projection-only targets explicitly keep semantic limits.
BOUNDARIES='''
Organization.maySubmit|active own member|inactive or foreign member
Organization.owns|own organization facility|foreign organization facility
Facility.belongsTo|own organization facility|foreign organization facility
Facility.accessibleAt|persisted operating-hours window|outside operating hours; aggregate equivalence pending
Facility.canHandle|persisted accepted cargo/equipment details|unsupported cargo requirement; aggregate equivalence pending
FreightRequest.revise|coherent DRAFT cargo and current version|same payload on PENDING or stale version
FreightRequest.submit|complete DRAFT and current version|repeat with stale draft version
FreightRequest.validateCompleteness|full request and coherent totals|omit recipient contact or change total only
CargoSpecification.validate|coherent totals and native units|weight total differs from native unit sum
CargoSpecification.fits|eligible plan fully allocated to sufficient capacity|reduce native capacity below required weight
CargoSpecification.requiresPermit|valid corridor with confirmed restriction evidence|required permit evidence missing
CargoUnit.totalWeightKg|two units of 3 kg|same units with 5 kg each
CargoUnit.totalVolumeM3|two units of 4 cubic metres|same units with 5 cubic metres each
CargoUnit.validatesIndivisibility|one allocation of full indivisible unit|split indivisible unit across resources
Carrier.publishes|own carrier and service|service owned by another carrier
Carrier.isActiveAt|active carrier on eligible plan|inactive carrier on same plan input
Carrier.mayRespond|verified active own operator and open invitation|foreign operator or expired deadline
Carrier.issued|offer attributed to session operator and carrier|foreign operator attribution
CarrierDepot.supports|published depot supportedEquipmentTypes|remove requested equipment; persisted projection only
CarrierDepot.activeAt|published active depot|inactive depot; persisted projection only
CarrierService.accepts|eligible cargo category and equipment|unsupported cargo category
CarrierService.covers|directed valid pickup and delivery lane|reverse direction without matching lane
CarrierService.validAt|active service and current verified lane window|expired lane validity
CarrierService.supportsRequirements|verified required certifications and temperatures|missing required certification
ServiceLane.connects|directed PICKUP to DELIVERY of own service|reverse endpoint or foreign-service area
ServiceLane.validAt|verified lane valid for assignment window|expiry before assignment end
ResponseIntegration.canRespond|enabled verified configured adapter|disabled or unverified adapter
ResponseIntegration.validateContract|valid source configuration via command|invalid adapter mode or source shape
CapacitySource.availabilityFor|eligible native ASSET plan|overlapping maintenance or reservation
CapacitySource.effectiveCapacity|verified native route/manufacturer limits|lower route payload limit
TransportAsset.capacityOn|verified route payload limit and source asset|route limit below load
TransportAsset.canCarry|load-bearing compatible asset|ESCORT asset carrying cargo
TransportAsset.availabilityFor|eligible unreserved asset calendar|overlapping maintenance
TransportAsset.effectiveCapacity|verified route payload limit and source asset|lower gross limit minus tare
RoadVehicle.legalCapacityFor|verified road/manufacturer limits|route gross limit below tare plus load
RoadVehicle.isRoadworthy|AVAILABLE active road asset|OUT_OF_SERVICE native status event
RoadVehicle.recordOdometer|native asset revision with larger odometer|negative or decreasing odometer; exact semantics pending
CapacityPool.supports|native pool window contains assignment|assignment beyond pool end
CapacityPool.capacityFor|declared pool capacity on native plan|allocation exceeds declared capacity
CapacityPool.availabilityFor|pool native plan with verified calendar|incomplete calendar returns UNKNOWN
CapacityPool.effectiveCapacity|pool native plan and applicable route limits|missing route-limit evidence
CapacityCalendar.availableAt|complete calendar covers full window|availableWindows missing required coverage
CapacityCalendar.blocks|calendar free of overlapping occupancy|overlapping reservation or repositioning block
CapacityCalendar.nextAvailable|native calendar availableWindows read|occupied first window; next-window derivation pending
CapacityReservation.overlaps|native hold outside existing occupied window|overlapping confirmed hold
CapacityReservation.consumes|LTL shared reservation within capacity|aggregate weight or volume exceeds capacity
CapacityReservation.release|native hold current version and authorized actor|foreign actor or stale release version
ScheduledMaintenance.blocks|maintenance outside proposed assignment|overlapping SCHEDULED maintenance
ScheduledMaintenance.belongsTo|maintenance for own asset|foreign-carrier asset reference
Driver.qualifiedFor|licensed qualified driver via native assignment|missing qualification or expired licence
Driver.availableFor|driver assignment within duty and free window|overlapping assignment or missing coverage
VehicleAssignment.isAvailable|free compatible available asset and execution|overlapping vehicle assignment
VehicleAssignment.release|native own assignment current version|foreign actor or stale version
AssetStatusEvent.validateTransition|AVAILABLE to IN_SERVICE native event|same status or stale expectedVersion
AssetStatusEvent.isOperationalBlock|AVAILABLE to OUT_OF_SERVICE native event|active commitment prevents native blocking transition
RoutePlan.orderedLegs|native route GET ordered sequence|duplicate or missing sequence in native create input
RoutePlan.validatesContinuity|connected directed corridor IDs|disconnected corridor chain
RoutePlan.compareWith|native alternatives with versioned planner snapshot|change policy objective; independent comparator pending
RoutePlan.evaluateConditions|open valid native corridors|active CLOSURE in assignment window
RouteLeg.requiresPermit|restriction with valid permit evidence|required permit evidence absent
RouteLeg.connects|matching destination and next origin|disconnected next origin
RouteLeg.validatesBorderRequirements|same-country or verified border evidence|cross-border prohibition or review required
RouteCondition.affects|active condition on selected corridor and window|foreign corridor or expired condition
RouteCondition.requiresReplan|native replan with active CLOSURE|expired or unrelated condition
RouteWaypoint.isUsableAt|native waypoint provenance/window snapshot|unverified waypoint source; standalone decision pending
RouteWaypoint.addsDelay|native waypoint in persisted route snapshot|unknown duration remains null; delay derivation pending
RoutePlanningPolicy.evaluate|active policy on valid native route|inactive or stale policy version
RoutePlanningPolicy.explain|native planner explanation and fingerprint|foreign-tenant explanation request
TransportPlanCandidate.assessEligibility|fully allocated eligible multileg plan|uncovered leg or incomplete allocation
TransportPlanCandidate.require|native grouped assignment with one resource|resources empty
TransportPlanCandidate.isQuotable|eligible current plan in opportunity command|ineligible plan
PlanResource.contributesCargoCapacity|LOAD_BEARING resource with allocations|AUXILIARY or ESCORT with cargo allocation
PlanResource.coversEntireWindow|calendar contains full native leg window|calendar ends before leg end
PlanResource.validateWithCalendar|calendar matches actual asset or pool|calendar/source scope mismatch
CarrierOpportunity.invite|eligible plan and own assignment IDs|plan null or unrelated assignment ID
CarrierOpportunity.accepts|own open invitation and coherent offer|expired deadline or offer plan mismatch
CarrierOffer.isValidAt|current RECEIVED attributable offer and evidence|expired validity window
CarrierOffer.isComparableTo|quoted coherent same-currency offer|UNKNOWN or ESTIMATED cost component
CarrierOffer.covers|own-plan coveredAssignmentIds|empty or unrelated assignment IDs
CarrierOffer.validatesBreakdownCurrency|quoted components reconcile issuer total|component currency differs from price currency
CarrierOffer.bookableAt|current offer with enough reservable capacity|reservable capacity below covered load
CarrierOffer.validatesAttribution|verified active issuing carrier operator|foreign or inactive issuer
RankedOption.isComparable|complete disjoint attributable bundle|overlapping or incomplete assignment coverage
RankedOption.provenance|persisted policyVersion and offerIds|source mutated; ranking snapshot remains immutable
ScoringPolicy.rank|deterministic disjoint-cover native ranking|overlap or missing comparable dimension
ScoringPolicy.explain|persisted weights and dimension explanation|foreign-tenant ranking read
Booking.recordResponse|authorized own carrier booking response|foreign operator or stale version
Booking.cancel|authorized own shipper booking cancellation|foreign member
Booking.authorize|selected current attributed offer and decision|offer not selected by decision
Booking.validateCapacityCommitment|confirmed holds for every covered assignment|missing covered hold
TransportExecution.start|confirmed booking and valid crew commitment|unconfirmed booking
TransportExecution.complete|IN_PROGRESS execution and proof|PLANNED execution or stale version
TransportExecution.requestReplan|authorized native route replan|unrelated condition; execution-level adapter pending
OperationalIncident.classify|native kind/severity/evidence persisted|invalid severity; classifier beyond DTO pending
OperationalIncident.escalate|native incident update by authorized operator|foreign operator; escalation routing pending
OperationalIncident.resolve|OPEN incident with RESOLVE proof|RESOLVED incident or stale version
IncidentUpdate.isAuthorized|own operator and own execution incident|foreign operator or incident
IncidentUpdate.auditRecord|native incident update actor/time and audit GET|foreign audit read or missing note/evidence
LogisticsNode.supports|active node on native route of declared mode|mode/node mismatch; exact node rule pending
LogisticsNode.activeAt|active node with current evidence|inactive node or expired evidence
RouteCorridor.connects|published directed origin/destination nodes|same or disconnected nodes
RouteCorridor.usableAt|active corridor valid evidence/window|CLOSURE or expired source
CargoProfile.prefillRequest|native own cargo profile projection|foreign profile; prefill adapter pending
CargoProfile.requiresRevalidation|versioned own profile projection|source profile changed; revalidation adapter pending
CargoCategory.suggestRequirements|native category default requirements|different category version; suggestion adapter pending
CargoCategory.isCurrent|active native category projection|inactive category or expired validity
LoadAllocation.respectsIndivisibility|full indivisible unit allocation|split across resources
LoadAllocation.fits|allocation within effective resource weight/volume|allocation exceeds either bound
OrganizationMember.canSubmit|ACTIVE own member with shipper capability|revoked or foreign member
OrganizationMember.canAuthorizeBooking|ACTIVE own SHIPPER_ADMIN member|member lacking booking authorization
McpAccountLink.resolvesTo|verified link matches own active member|inactive or foreign organization member
McpAccountLink.validAt|verified active unrevoked unexpired link|historical nullable proof or expired link
McpAccountLink.hasScope|verified client/link includes required scope|required scope absent
RepositioningBlock.blocks|native block outside assignment window|overlapping PLANNED block
RepositioningBlock.freshnessAt|native evidence valid for window|expired or unknown source
OrganizationPreferences.suggestDefaults|native own preferences projection|changed preference version; suggestion adapter pending
OrganizationPreferences.validFor|own current preference projection|foreign organization or incompatible request; exact adapter pending
CarrierMetric.isRepresentative|current nonempty representative sample|zero sample or expired metric source
CarrierMetric.comparableTo|matching ROAD unscoped comparable metric|different mode or corridor-scoped metric
VehicleCombination.validateCompatibility|native coupled same-carrier assets|foreign member or incompatible route-limit evidence
VehicleCombination.effectiveCapacityOn|native combination manufacturer/route/tare limits|lower route gross limit changes capacity
ServiceArea.covers|verified INCLUDE area matches place|EXCLUDE or unmatched geography
ServiceArea.validAt|active area and evidence covering leg window|expired validity or future verification
FulfilmentPartner.supports|active verified partner linked to real resource/leg|outside agreement or foreign partner
FulfilmentPartner.isAuthorizedAt|ACTIVE agreement current at leg window|inactive or expired agreement
PlanLegAssignment.validateEligibility|fully covered valid native leg/resource|missing allocation or scope mismatch
PlanLegAssignment.carrierForLeg|native assignment service carrier projection|foreign service/resource carrier mismatch
PlanLegAssignment.isQuotable|eligible current native assignment and plan|ineligible parent plan
OfferCostComponent.contributesToQuotedTotal|QUOTED component counted in issuer total|UNKNOWN/EXCLUDED component or mismatched total
OfferCostComponent.isComparable|quoted same-currency verified component|ESTIMATED/UNKNOWN or expired evidence
ShipmentContact.canNotify|native required contact name and telephone|omit recipient or pickup phone
ShipmentContact.matches|native contacts.pickup/recipient container keys|omit required role container
CarrierOperator.mayIssueOffer|active verified operator of issuing carrier|inactive or foreign operator
CarrierOperator.mayUpdateCapacity|active verified authorized carrier operator|operator lacking carrier permission
AssetCargoCapability.supports|native active capability category/certification|unsupported certification or temperature
AssetCargoCapability.currentAt|verified capability valid through window|expired capability or future verifiedAt
RouteSimulationScenario.inject|native local scenario condition seed/verify|local_only omitted; source is harness scenario adapter
RouteSimulationScenario.replay|native local seed then verify_route_conditions|foreign target/local_only missing; source is scenario adapter
RoutePlanner.findAlternatives|native directed bounded paths from current request|maxLegs 9 or maxAlternatives 21
RoutePlanner.replan|native active CLOSURE re-evaluation|unrelated condition or stale request version
RoutePlanner.explain|native immutable planner snapshot explanation|foreign tenant read
SelectionDecision.validatesSelectedOffer|current own attributable complete offer cover|expired or unrelated selected offer
SelectionDecision.auditRecord|native decision actor/reason persisted and audit GET|foreign audit read
SelectionDecision.validatePlanAndOffers|eligible own plan and exact disjoint cover|overlap or incomplete assignment cover
'''

def definitions():
    """Read the active function definitions, including renamed wrapper bodies."""
    functions={}
    for p in sorted((ROOT/'supabase-v2/supabase/migrations').glob('*.sql')):
        text=p.read_text(encoding='utf-8-sig')
        for m in re.finditer(r'alter function ([\w.]+)\([^;]*?\) rename to (\w+);|create (?:or replace )?function ([\w.]+)\(',text,re.I):
            if m.group(1):
                old=m.group(1);new=old.rsplit('.',1)[0]+'.'+m.group(2)
                if old in functions:functions[new]=functions.pop(old)
            else:
                start=text.find('$$',m.end());end=text.find('$$;',start+2)
                if start>=0 and end>=0:
                    functions[m.group(3)]={'citation':str(p.relative_to(ROOT)).replace('\\','/')+':'+str(text[:m.start()].count('\n')+1),
                                         'body':text[start+2:end]}
    return functions

def mapping(config):
    from cp1c_sources import UNUSED, cite
    boundaries={r.split('|')[0]:r.split('|')[1:] for r in BOUNDARIES.strip().splitlines()}
    assert set(boundaries)=={d['id'] for d in config['methods']},'Every signature needs its own input boundary'
    funcs=definitions()
    entrypoints=[]
    for p in sorted((ROOT/'cargomesh/src/server').glob('modules/*/infrastructure/*repository*.ts')):
        for n,line in enumerate(p.read_text(encoding='utf-8-sig').splitlines(),1):
            for name in re.findall(r'\.rpc\("(\w+)"',line):
                entrypoints.append(('public.'+name,str(p.relative_to(ROOT)).replace('\\','/')+':'+str(n)))
    # Include native RLS and trigger registrations: execution does not require a
    # JavaScript import when PostgreSQL itself invokes the guard.
    native_hooks={}
    for p in sorted((ROOT/'supabase-v2/supabase/migrations').glob('*.sql')):
        for n,line in enumerate(p.read_text(encoding='utf-8-sig').splitlines(),1):
            if re.search(r'execute function|create policy|alter policy',line,re.I):
                for name in re.findall(r'(private\.\w+)\(',line):
                    native_hooks.setdefault(name,[]).append(str(p.relative_to(ROOT)).replace('\\','/')+':'+str(n))
    def chain(target):
        queue=deque((fn,[{'symbol':fn,'citation':ref}]) for fn,ref in entrypoints if fn in funcs)
        seen=set()
        while queue:
            fn,path=queue.popleft()
            if fn==target:return path+[{'symbol':fn,'citation':funcs[fn]['citation']}]
            if fn in seen:continue
            seen.add(fn)
            for called in sorted(set(re.findall(r'((?:private|public)\.\w+)\(',funcs[fn]['body']))):
                if called in funcs:queue.append((called,path+[{'symbol':called,'citation':funcs[called]['citation']}]))
        if target in native_hooks:return [{'symbol':'PostgreSQL native trigger/RLS','citations':native_hooks[target]},
                                         {'symbol':target,'citation':funcs[target]['citation']}]
        return []
    rows=[]
    for d in config['methods']:
        identifier=d['id'];positive,frontier=boundaries[identifier];target=OVERRIDES.get(identifier,TARGETS[d['clase']])
        if target is None:
            if d['clase'] in ('CargoUnit','CargoSpecification'):
                path='cargomesh/src/shared/schemas/v2/freight-request.ts'
                service='cargomesh/src/server/modules/freight-requests/application/draft-service.ts'
                target='cargoUnitTotalsV2' if d['clase']=='CargoUnit' else 'CargoSpecificationV2Schema'
                ref=cite(path,'export function cargoUnitTotalsV2' if d['clase']=='CargoUnit' else 'export const CargoSpecificationV2Schema')
                runtime=[{'symbol':'createV2Draft native input validation','citation':cite(service,'const input = CreateFreightRequestV2InputSchema.parse(rawInput)')},
                    {'symbol':'CreateFreightRequestV2InputSchema embeds the cargo schema','citation':cite(path,'cargoSpecification: CargoSpecificationV2Schema,')},
                    {'symbol':'Native cargo schema refinement invokes the calculator','citation':cite(path,'const totals = cargoUnitTotalsV2(cargo.units)')},
                    {'symbol':target,'citation':ref}]
            else:
                path='supabase-v2/gate.py';target='script';ref=cite(path,"script('seed',V2,SCENARIO/'seed.sql')")
                runtime=[{'symbol':'Native local scenario gate','citation':ref}]
        else:
            if target not in funcs:raise ValueError('Native target missing: '+identifier+' -> '+target)
            ref=funcs[target]['citation'];runtime=chain(target)
        d.update(nativeSymbol=target,fuentes_candidatas_verificadas=[ref],runtimeChain=runtime,
                 observable='Native aggregate '+target+' result corresponding to '+identifier,
                 controlPositive=positive,frontier=frontier,
                 mappingStatus='VERIFIED_RUNTIME_AGGREGATE_TARGET' if runtime else 'NATIVE_TARGET_CALL_CHAIN_PENDING',
                 mappingLimit='Runtime target and isolated contract boundary, not proof of a standalone UML method or unexecuted semantics',
                 representationLimit='Native aggregate or projection target; exact per-signature positive and frontier remain required',
                 blockedCause='HAC-44 missing paired execution for '+identifier+': positive '+positive+'; frontier '+frontier+'; target '+ref+
                     ('' if runtime else '; native call-chain proof unresolved'))
        if identifier in UNUSED:
            d['previousMeasurementRejected']='assignment-policy.ts has only test imports; native SQL/command boundary remains unmeasured for this exact signature'
            d['requiredProbes']=['RUNTIME_METHOD '+identifier]
            d['partialUntilRuntimeMeasured']=True
        rows.append({k:d[k] for k in ('id','metodo_uml','nativeSymbol','fuentes_candidatas_verificadas','runtimeChain','observable','controlPositive','frontier','mappingStatus','mappingLimit')})
    write(OUT/'PROBES/CP1C_MAPPING_144.json',json.dumps({'productSha':state()['head'],'methods':rows,'completeInventory':len(rows)==144},ensure_ascii=False,indent=2)+'\n')
    return config
