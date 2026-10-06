"""Materialize the full physical design, not a claim about migrated tables.

All field mappings come from the unchanged UML. Association treatments are
explicit in UML order: no inferred generic foreign keys or silent exclusions.
"""
from pathlib import Path
import json
import re
import importlib.util
import argparse
import sys

sys.dont_write_bytecode = True

spec = importlib.util.spec_from_file_location('uml_inventory', Path(__file__).with_name('check-v2-full-model.py'))
inventory = importlib.util.module_from_spec(spec)
spec.loader.exec_module(inventory)
extract = inventory.extract

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/v2-amazon/models'

# A dot identifies an embedded value; a pipe identifies a projection/port.
STORAGE = {
    'Organization': 'organizations', 'Facility': 'facilities',
    'FreightRequest': 'freight_requests',
    'CargoSpecification': 'freight_requests.v2_snapshot.cargoSpecification',
    'CargoUnit': 'freight_requests.v2_snapshot.cargoSpecification.units[]',
    'Carrier': 'carriers', 'CarrierDepot': 'carrier_depots',
    'CarrierService': 'carrier_services', 'ServiceLane': 'service_lanes',
    'ResponseIntegration': 'response_integrations',
    'CapacitySource': '|capacity_source_projection',
    'TransportAsset': 'transport_assets', 'RoadVehicle': 'transport_assets',
    'CapacityPool': 'capacity_pools', 'CapacityCalendar': 'capacity_calendars',
    'CapacityReservation': 'capacity_reservations',
    'ScheduledMaintenance': 'scheduled_maintenances', 'Driver': 'drivers',
    'DriverAssignment': 'driver_assignments', 'VehicleAssignment': 'vehicle_assignments',
    'AssetStatusEvent': 'asset_status_events', 'RoutePlan': 'route_plans',
    'RouteLeg': 'route_legs', 'RouteCondition': 'route_conditions',
    'RouteWaypoint': 'route_waypoints', 'RoutePlanningPolicy': 'route_planning_policies',
    'TransportPlanCandidate': 'transport_plan_candidates', 'PlanResource': 'plan_resources',
    'CarrierOpportunity': 'carrier_opportunities', 'CarrierOffer': 'v2_carrier_offers',
    'RankedOption': 'ranked_options', 'ScoringPolicy': 'scoring_policies',
    'Booking': 'v2_bookings', 'TransportExecution': 'transport_executions',
    'OperationalIncident': 'operational_incidents', 'IncidentUpdate': 'incident_updates',
    'LogisticsNode': 'logistics_nodes', 'RouteCorridor': 'route_corridors',
    'CargoProfile': 'organization_cargo_profiles', 'CargoCategory': 'cargo_categories',
    'LoadAllocation': 'load_allocations', 'OrganizationMember': 'organization_members',
    'McpAccountLink': 'mcp_account_links', 'RepositioningBlock': 'repositioning_blocks',
    'OrganizationPreferences': 'organization_preferences', 'CarrierMetric': 'v2_carrier_metrics',
    'VehicleCombination': 'vehicle_combinations', 'ServiceArea': 'service_areas',
    'FulfilmentPartner': 'fulfilment_partners', 'PlanLegAssignment': 'plan_leg_assignments',
    'OfferCostComponent': 'v2_carrier_offers.breakdown[]',
    'ShipmentContact': 'freight_requests.v2_snapshot.contacts',
    'CarrierOperator': 'carrier_operators', 'AssetCargoCapability': 'cargo_capability_definitions',
    'RouteSimulationScenario': '|scenario_files', 'RoutePlanner': '|route_planner_port',
    'SelectionDecision': 'selection_decisions',
}

# Explicit aliases and split values, including legacy columns that remain.
ALIASES = {
    'Organization': {'commercialName': 'name', 'taxIdType': 'business_identifier_type',
        'taxIdValue': 'business_identifier_value'},
    'Facility': {'location': '{country_code,region_code,city,address_line,latitude,longitude}'},
    'FreightRequest': {
        'origin': 'v2_snapshot.origin', 'destination': 'v2_snapshot.destination',
        'pickupWindow': 'v2_snapshot.pickupWindow', 'deliveryDeadline': 'delivery_deadline',
        'acceptedModes': 'v2_snapshot.acceptedModes', 'budget': 'v2_snapshot.budget',
        'requiredEquipment': 'required_equipment_code',
        'preferredEquipment': 'preferred_equipment_code',
    },
    'CargoSpecification': {'category': 'categoryCode'},
    'CargoUnit': {'dimensions': 'dimensionsCm'},
    'Carrier': {'commercialName': 'name', 'businessIdType': 'business_identifier_type',
        'businessIdValue': 'business_identifier_value'},
    'CarrierDepot': {'location': '{address_line,country_code,region_code,city,latitude,longitude}'},
    'CarrierService': {
        'mode': 'transport_mode', 'serviceClass': 'service_type',
        'maxWeightKg': 'max_capacity_kg', 'temperatureRange': '{temperature_min_c,temperature_max_c}',
        'admittedCargoTypes': 'carrier_service_cargo_categories.cargo_category_id',
        'status': 'active; ACTIVE/INACTIVE projection',
    },
    'ServiceArea': {'role': 'area_role', 'inclusion': 'coverage',
        'geography': '{granularity,country_code,region_code,city,postal_code,geometry}',
        'source': '{fulfilment_source,fulfilment_partner_id}', 'evidence': 'evidence_reference'},
    'ServiceLane': {'kind': 'lane_kind', 'mode': 'transport_mode',
        'borderReviewRequired': 'cross_border_review_required', 'evidence': 'evidence_reference'},
    'TransportAsset': {
        'equipmentType': 'equipment_code', 'usefulCapacityKg': 'max_weight_kg',
        'usableVolumeM3': 'max_volume_m3', 'homeDepot': 'home_depot_id',
    },
    'CapacityPool': {'serviceWindow': '{starts_at,ends_at}',
        'declaredCapacity': '{max_weight_kg,max_volume_m3}', 'partner': 'fulfilment_source'},
    'CapacityCalendar': {'horizon': '{horizon_starts_at,horizon_ends_at}'},
    'CapacityReservation': {'occupiedWindow': '{starts_at,ends_at}'},
    'ScheduledMaintenance': {'blockedWindow': '{starts_at,ends_at}'},
    'Driver': {'portalAccount': 'carrier_operator_id'},
    'DriverAssignment': {'window': '{starts_at,ends_at}'},
    'VehicleAssignment': {'window': '{starts_at,ends_at}'},
    'RoutePlan': {'estimatedDuration': 'estimated_duration_seconds'},
    'RouteLeg': {'estimatedDuration': 'estimated_duration_seconds'},
    'TransportPlanCandidate': {'proposedWindow': '{starts_at,ends_at}'},
    'PlanResource': {'window': '{starts_at,ends_at}'},
    'CarrierOffer': {'transitDuration': 'transit_duration_seconds',
        'validity': '{valid_from,valid_until}',
        'coveredServiceIds': 'v2_offer_services.service_id',
        'coveredAssignmentIds': 'v2_offer_assignments.assignment_id'},
    'TransportExecution': {'plannedWindow': '{planned_starts_at,planned_ends_at}'},
    'RouteCorridor': {'estimatedDuration': 'estimated_duration_seconds'},
    'CargoProfile': {'name': 'profile_name', 'typicalUnits': 'typical_units'},
    'CargoCategory': {'guidance': '{recommended_entry_methods,intake_specification_schema,suggested_requirements,recommended_vehicle_classes}',
        'version': 'version; integer command revision rendered as a string when required'},
    'ShipmentContact': {'phone': 'phoneE164', 'role': '{pickup:PICKUP,recipient:RECIPIENT}'},
    'OrganizationMember': {'contactRef': '{corporate_email,contact_ref}'},
    'RepositioningBlock': {'occupiedWindow': '{starts_at,ends_at}',
        'estimatedTravel': 'estimated_travel_seconds'},
    'OrganizationPreferences': {'maximumWait': 'maximum_wait_minutes; explicit minutes in API'},
    'CarrierMetric': {'period': '{period_starts_at,period_ends_at}', 'corridorRef': 'corridor_id'},
    'VehicleCombination': {'coupledWindow': '{starts_at,ends_at}'},
    'PlanLegAssignment': {'window': '{starts_at,ends_at}'},
    'SelectionDecision': {'selectedOfferIds': 'selection_decision_offers.offer_id'},
}

# FK means a tenant-consistent composite reference wherever both rows are scoped.
# DB rows contain technical IDs/version/timestamps as well as UML attributes.
RELATIONS = [
    'facilities.organization_id -> organizations.id',
    'freight_requests.organization_id -> organizations.id',
    'freight_requests.origin_facility_id -> facilities.id; nullable; same organization',
    'freight_requests.destination_facility_id -> facilities.id; nullable; same organization',
    'freight_requests.v2_snapshot.cargoSpecification; exactly one validated object',
    'cargoSpecification.units[]; stable unit index; nonempty at submission',
    'carrier_depots.carrier_id -> carriers.id',
    'carrier_services.carrier_id -> carriers.id',
    'service_areas.carrier_service_id -> carrier_services.id',
    'service_lanes.carrier_service_id -> carrier_services.id',
    'service_lanes.pickup_area_id -> service_areas.id; role PICKUP; same service',
    'service_lanes.delivery_area_id -> service_areas.id; role DELIVERY; same service',
    'response_integrations.carrier_service_id -> carrier_services.id; secret reference only',
    'transport_assets.carrier_id -> carriers.id',
    'transport_assets.home_depot_id -> carrier_depots.id; nullable; same carrier',
    'single-table inheritance: mode ROAD; vehicle fields not attached to other modes',
    'projection keyed ASSET/id; never independently writable',
    'projection keyed POOL/id; never independently writable',
    'capacity_pools.carrier_service_id -> carrier_services.id',
    'capacity_calendars XOR transport_asset_id/capacity_pool_id; unique per source',
    'capacity_reservations.capacity_calendar_id -> capacity_calendars.id',
    'scheduled_maintenances.transport_asset_id -> transport_assets.id',
    'asset_status_events.transport_asset_id -> transport_assets.id; append-only',
    'drivers.carrier_id -> carriers.id',
    'driver_assignments.driver_id -> drivers.id; nonoverlapping active windows',
    'vehicle_assignments.transport_asset_id -> transport_assets.id; ROAD; nonoverlapping active windows',
    'transport_plan_candidates.request_id -> freight_requests.id',
    'transport_plan_candidates.route_plan_id -> route_plans.id; mandatory; same request',
    'route_legs.route_plan_id -> route_plans.id; unique sequence; at least one on publication',
    'route_waypoints.route_plan_id -> route_plans.id; unique sequence',
    'route_leg_conditions(leg_id,condition_id); composite primary key',
    'route_plans.policy_id -> route_planning_policies.id; immutable policy version',
    'plan_resources.plan_candidate_id -> transport_plan_candidates.id; nonempty validated at publication',
    'derived DISTINCT carrier_service_id from plan_leg_assignments; no duplicate editable relation',
    'plan_resources.route_leg_id -> route_legs.id; same plan',
    'plan_resources XOR nullable asset_id/pool_id; neither allowed only for UNKNOWN; not both',
    'carrier_opportunities.plan_candidate_id -> transport_plan_candidates.id',
    'carrier_opportunities.carrier_id -> carriers.id',
    'v2_carrier_offers.opportunity_id -> carrier_opportunities.id; request/plan/carrier must match',
    'v2_carrier_offers.carrier_id -> carriers.id',
    'ranked_options.offer_id -> v2_carrier_offers.id; immutable ranking snapshot',
    'ranked_options.scoring_policy_id -> scoring_policies.id; immutable policy version',
    'v2_bookings.offer_id -> v2_carrier_offers.id; UNIQUE offer_id',
    'transport_executions.booking_id -> v2_bookings.id; UNIQUE booking_id',
    'driver_assignments.execution_id -> transport_executions.id; same responsible carrier',
    'vehicle_assignments.execution_id -> transport_executions.id; same responsible carrier',
    'operational_incidents.execution_id -> transport_executions.id',
    'incident_updates.incident_id -> operational_incidents.id; append-only',
    'incident_route_conditions(incident_id,condition_id); composite primary key; source retained',
    'route_corridors.origin_node_id -> logistics_nodes.id',
    'route_corridors.destination_node_id -> logistics_nodes.id; direction preserved',
    'route_legs.corridor_id -> route_corridors.id; nullable; preserve corridor version snapshot',
    'organization_cargo_profiles.cargo_category_id -> cargo_categories.id',
    'organization_cargo_profiles.organization_id -> organizations.id',
    'load_allocations(request_id,cargo_unit_index) validated against immutable request cargo snapshot',
    'load_allocations.plan_resource_id -> plan_resources.id; same request; totals bounded; indivisible not split',
    'organization_members.organization_id -> organizations.id; active membership checked at command time',
    'mcp_account_links.organization_member_id -> organization_members.id; existing HAC-11 actor checks retained',
    'repositioning_blocks.capacity_calendar_id -> capacity_calendars.id',
    'organization_preferences.organization_id -> organizations.id; UNIQUE organization_id',
    'v2_carrier_metrics.carrier_id -> carriers.id; sample and period mandatory',
    'plan_resources.vehicle_combination_id -> vehicle_combinations.id; nullable; carrier/time compatibility',
    'vehicle_combination_assets(combination_id,asset_id); nonempty; active coupling exclusion per asset',
    'service_areas.fulfilment_partner_id -> fulfilment_partners.id; nullable; same carrier and valid agreement',
    'capacity_pools.fulfilment_partner_id -> fulfilment_partners.id; nullable; no fabricated individual vehicle',
    'fulfilment_partners.carrier_id -> carriers.id',
    'plan_leg_assignments.fulfilment_partner_id -> fulfilment_partners.id; nullable; valid during assignment',
    'plan_leg_assignments.route_leg_id -> route_legs.id; same route/plan',
    'plan_leg_assignments.plan_candidate_id -> transport_plan_candidates.id; nonempty when published',
    'plan_resources.plan_leg_assignment_id -> plan_leg_assignments.id; same leg/plan; nonempty per assignment',
    'plan_leg_assignments.carrier_service_id -> carrier_services.id',
    'v2_offer_assignments(offer_id,assignment_id); nonempty; attributable carrier and plan',
    'v2_carrier_offers.breakdown[]; nonempty; quoted cents reconcile with issuer total',
    'freight_requests.v2_snapshot.contacts.recipient; nullable; RECIPIENT role',
    'v2_carrier_offers.issuer_operator_id -> carrier_operators.id; nullable for verified API/MCP issuer',
    'carrier_operators.carrier_id -> carriers.id; actual auth user and carrier permission required',
    'transport_assets.cargo_capability_definition_id -> cargo_capability_definitions.id; legacy per-asset capabilities retained for migration compatibility',
    'cargo_capability_definitions.cargo_category_id -> cargo_categories.id',
    'scenario file references versioned corridor fixtures; no scenario rows in production migrations',
    'scenario file owns synthetic condition fixtures; never substitutes live condition evidence',
    'route_plans planner_algorithm_version/planner_graph_version/planner_source snapshot; port not table',
    'RoutePlanner receives immutable RoutePlanningPolicy; dependency, not an editable join table',
    'RoutePlanner reads versioned corridor graph; dependency, not ownership',
    'v2_bookings.selection_decision_id -> selection_decisions.id; approved recovery change 0..1 to 0..* bookings, one per selected offer',
    'selection_decisions.organization_member_id -> organization_members.id; audit actor and organization',
    'selection_decision_offers(decision_id,offer_id); approved recovery change single offer to 1..*; exact assignment coverage',
    'selection_decisions.request_id -> freight_requests.id',
    'selection_decisions.selected_plan_id -> transport_plan_candidates.id; same request',
    'v2_carrier_offers.request_id -> freight_requests.id; same opportunity/plan organization',
    'capacity_reservations.plan_resource_id -> plan_resources.id; nullable for pre-plan hold; coherent source',
    'freight_requests.v2_snapshot.contacts.pickup; nullable; PICKUP role',
    'v2_offer_services(offer_id,service_id); nonempty; equals DISTINCT services of covered assignments',
    'capacity_reservations.v2_booking_id -> v2_bookings.id; nullable for hold; active commitment proof per carrying resource',
]

def snake(value):
    return re.sub(r'(?<!^)(?=[A-Z])', '_', value).lower()

def sql_type(attribute):
    kind = attribute['type']
    if kind in ('UUID', 'MemberId', 'CorridorId'):
        return 'uuid / FK when reference'
    if kind == 'Instant':
        return 'timestamptz'
    if kind == 'LocalDate':
        return 'date'
    if kind == 'boolean':
        return 'boolean'
    if kind == 'number':
        return 'numeric; domain bounds/units required'
    if kind == 'Duration':
        return 'numeric seconds >= 0'
    if kind.endswith('[]') or kind in ('GeoLocation', 'TimeWindow', 'Money', 'Dimensions',
        'Capacity', 'Rule', 'Schedule', 'TemperatureRange', 'EvidenceRef', 'DataSource',
        'Contact', 'IntakeGuidance', 'WeightSet', 'Explanation', 'Geography',
        'FulfilmentSource', 'OfferSource', 'ActorRef', 'ContactRef', 'RouteDecision'):
        return 'structured value; strict shape and referenced IDs validated'
    return 'text; closed vocabulary when UML type is enum'

def build():
    model = extract()
    baseline = json.loads((OUT / 'FULL_MODEL_QA_BASELINE.json').read_text(encoding='utf-8'))
    observed = {(a['clase'], a['atributo']): a for a in baseline['attributes']}
    assert len(observed) == model['counts']['attributes'] == 397
    assert len(baseline['relations']) == len(model['relations']) == 93
    for uml, actual in zip(model['relations'], baseline['relations']):
        assert (uml['umlId'], uml['source'], uml['target']) == (
            actual['uml_id'], actual['origen'], actual['destino'])
    assert set(STORAGE) == {c['name'] for c in model['classes']}
    assert len(RELATIONS) == len(model['relations']) == 93
    classes = []
    for item in model['classes']:
        name = item['name']
        storage = STORAGE[name]
        fields = []
        for attr in item['attributes']:
            # JSON value spelling remains the exact DTO spelling, not snake_case.
            field = ALIASES.get(name, {}).get(attr['name'],
                attr['name'] if '.' in storage or storage.startswith('|') else snake(attr['name']))
            actual = observed[(name, attr['name'])]
            fields.append({**attr, 'target': actual['representacion_real'],
                'designTarget': f'{storage}.{field}',
                'physicalType': actual['tipo_fisico'], 'designType': sql_type(attr),
                'observedNullable': actual['nullable_fisico'], 'qaStatus': actual['estado'],
                'migrationVerified': False})
        classes.append({'name': name, 'representation':
            'PORT_OR_PROJECTION' if storage.startswith('|') else
            'EMBEDDED_VALUE' if '.' in storage else 'TABLE_OR_SUBTYPE',
            'storage': storage, 'attributes': fields})
    relations = [{**{k: r[k] for k in ('umlId', 'source', 'target', 'label', 'endLabels')},
        'physicalTreatment': actual['equivalente_real'], 'designTreatment': treatment,
        'observedMultiplicity': actual['multiplicidad_fisica'], 'qaStatus': actual['estado'],
        'migrationVerified': False}
        for r, treatment, actual in zip(model['relations'], RELATIONS, baseline['relations'])]
    current = json.loads((OUT / 'FULL_MODEL_CURRENT_RELATIONS.json').read_text(encoding='utf-8'))
    seen = set()
    for update in current['relations']:
        index = update['number']
        assert index not in seen and 0 <= index < len(relations)
        seen.add(index)
        relation = relations[index]
        assert (relation['source'], relation['target']) == (update['source'], update['target'])
        for path in update['evidence']:
            assert (ROOT / path).is_file(), f'Missing relation evidence: {path}'
        relation['currentTreatment'] = update
    return {'schemaVersion': '2.0', 'sourceSha256': model['sourceSha256'],
        'currentRelationReconciliation': current,
        'status': 'QA_BASELINE_RECONCILED_NOT_CURRENT_MIGRATION_CERTIFICATION',
        'observedCommit': baseline['sourceCommit'],
        'counts': model['counts'], 'classes': classes, 'relations': relations}

def render(model):
    lines = ['# DER integral reconciliado — HAC-27 / HAC-40', '',
        'Diseño físico trazable de las 57 clases, 397 atributos y 93 relaciones del UML 07. '
        'Los destinos observados corresponden al corte QA abba805 (5 oct, 17 migraciones). Se conservan el objetivo previo y sus diferencias: esta matriz no certifica el incremento actual ni Supabase alojado. '
        'No se elimina ninguna clase del alcance.', '',
        '## Decisiones de persistencia', '',
        '- Reutilizar tablas nativas existentes para identidad, catálogo, sedes, solicitudes y capacidad mediante migraciones aditivas.',
        '- Comercial nuevo en `v2_carrier_offers`, `v2_bookings`, `selection_decisions` y `v2_carrier_metrics`: las tablas heredadas y sus RPC V1 no sirven como writer del dominio completo.',
        '- RoadVehicle conserva herencia en `transport_assets`; CapacitySource es una proyección discriminada ASSET/POOL.',
        '- Carga, unidades, contactos y desglose de oferta son valores estrictos de su agregado; IDs en JSON no sustituyen validación contra el tenant.',
        '- RoutePlanner es un puerto de dominio. RouteSimulationScenario vive en archivos de escenario, no en tablas de producción.',
        '- Campos técnicos adicionales: UUID interno para entidades sin ID UML, versión esperada, timestamps, claves/FK del agregado, organización/carrier responsables y recibos atómicos privados.',
        '- Toda FK entre agregados organizacionales es compuesta o tiene guarda SQL de coherencia del tenant. Todas las FK se indexan. RLS deniega escritura directa de estados comerciales.',
        '- Valores Money: moneda explícita USD en este contrato y decimal a centavos. Duration: segundos; TimeWindow: [inicio,fin), UTC y zona IANA de interpretación.',
        '- Versiones de políticas y oferta son inmutables. Revocar o sustituir agrega estado/evento auditado; no borra historia.', '',
        '## Diferencias explícitas con el UML', '',
        '- Relaciones 83 y 85: la recuperación autorizada admite 1..* ofertas por decisión y 0..* bookings, uno por oferta/emisor. Se conserva el diagrama original como evidencia, sin editarlo silenciosamente.',
        '- AssetCargoCapability: se diseña una definición reutilizable y una FK desde el activo para respetar la multiplicidad UML. La tabla existente por activo/categoría se mantiene como compatibilidad hasta una migración de transición comprobada.',
        '- LoadAllocation referencia unidad mediante request_id e índice estable del snapshot; una revisión invalida planes derivados. No se fabrica una entidad CargoUnit con CRUD independiente.',
        '- La ausencia de dato legado no se rellena con evidencia ficticia: el nuevo atributo permanece desconocido hasta actualizar el agregado por un comando validado.', '',
        '## Atributos', '']
    for cls in model['classes']:
        lines += [f"### {cls['name']} — `{cls['storage']}`", '',
            '| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |', '|---|---|---|---|---|']
        for attr in cls['attributes']:
            optional = '?' if attr['optional'] else ''
            lines.append(f"| `{attr['name']}{optional}` | {attr['type'].replace('|', '/')} | `{attr['target'].replace('|', '/')}` | `{attr['designTarget'].replace('|', '/')}` | {attr['qaStatus']} |")
        lines.append('')
    lines += ['## Relaciones y restricciones', '',
        'La observación QA y el objetivo previo son históricos. La reconciliación vigente de F-02 se muestra aparte sin sustituir estados independientes.', '',
        '| Nº | UML | Cardinalidad original | Tratamiento observado QA | Objetivo previo | Estado QA |', '|---|---|---|---|---|---|']
    for index, relation in enumerate(model['relations']):
        lines.append(f"| {index} | {relation['source']} → {relation['target']} ({relation['label']}) | "
            f"{' / '.join(relation['endLabels']) or 'herencia/realización'} | {relation['physicalTreatment'].replace('|', '/')} | {relation['designTreatment']} | {relation['qaStatus']} |")
    lines += ['', '## Reconciliación vigente F-02: relaciones 34, 55, 69 y 89', '',
        f"Base integrada: `{model['currentRelationReconciliation']['sourceCommit']}` (20 migraciones). El baseline anterior permanece intacto.", '',
        model['currentRelationReconciliation']['qaEvidence'], '',
        '| Nº | Tratamiento actual en el código | Consumo API | Estado documental | Evidencia |', '|---|---|---|---|---|']
    for update in model['currentRelationReconciliation']['relations']:
        evidence = '; '.join(f'`{path}`' for path in update['evidence'])
        lines.append(f"| {update['number']} | {update['treatment']} | {update['api']} | {update['status']} | {evidence} |")
    lines += ['', 'El enlace indirecto de LoadAllocation al recurso es deliberado y explícito; no se promete una columna directa inexistente. La nulabilidad pre-plan de reservas no permite un recurso incoherente. Esta sección no reobserva los 397 atributos ni certifica las 93 relaciones o Supabase alojado.', '', '## Gate antes de aplicar el esquema', '',
        'El inventario y este diseño deben coincidir exactamente con el UML. Después se comprobará cada destino contra pg_catalog, constraints, RLS y comandos reales; '
        'los 397 destinos y 93 tratamientos no pasan a IMPLEMENTADO por aparecer aquí. '
        'Faltan las migraciones y servicios restantes, pruebas de concurrencia y aislamiento, datos autorizados y consumo Web/MCP del flujo completo.', '']
    return '\n'.join(lines)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true', help='Verify committed artifacts without rewriting.')
    args = parser.parse_args()
    model = build()
    artifacts = {'FULL_MODEL_PHYSICAL_DESIGN.json': json.dumps(model, ensure_ascii=False, indent=2) + '\n',
        'FULL_MODEL_DER.md': render(model)}
    for name, contents in artifacts.items():
        path = OUT / name
        if args.check:
            if not path.is_file() or path.read_text(encoding='utf-8') != contents:
                raise ValueError(f'Physical design drift: {name}')
        else:
            OUT.mkdir(parents=True, exist_ok=True)
            path.write_text(contents, encoding='utf-8')
    print(json.dumps({'result': 'PASS', **model['counts'], 'migrationCertified': False}))
