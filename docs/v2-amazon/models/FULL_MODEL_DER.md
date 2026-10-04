# DER integral objetivo — HAC-27 / HAC-40

Diseño físico trazable de las 57 clases, 397 atributos y 93 relaciones del UML 07. Los destinos nuevos son objetivos de implementación: esta matriz no certifica migraciones ni endpoints. No se elimina ninguna clase del alcance.

## Decisiones de persistencia

- Reutilizar tablas nativas existentes para identidad, catálogo, sedes, solicitudes y capacidad mediante migraciones aditivas.
- Comercial nuevo en `v2_carrier_offers`, `v2_bookings`, `selection_decisions` y `v2_carrier_metrics`: las tablas heredadas y sus RPC V1 no sirven como writer del dominio completo.
- RoadVehicle conserva herencia en `transport_assets`; CapacitySource es una proyección discriminada ASSET/POOL.
- Carga, unidades, contactos y desglose de oferta son valores estrictos de su agregado; IDs en JSON no sustituyen validación contra el tenant.
- RoutePlanner es un puerto de dominio. RouteSimulationScenario vive en archivos de escenario, no en tablas de producción.
- Campos técnicos adicionales: UUID interno para entidades sin ID UML, versión esperada, timestamps, claves/FK del agregado, organización/carrier responsables y recibos atómicos privados.
- Toda FK entre agregados organizacionales es compuesta o tiene guarda SQL de coherencia del tenant. Todas las FK se indexan. RLS deniega escritura directa de estados comerciales.
- Valores Money: moneda explícita USD en este contrato y decimal a centavos. Duration: segundos; TimeWindow: [inicio,fin), UTC y zona IANA de interpretación.
- Versiones de políticas y oferta son inmutables. Revocar o sustituir agrega estado/evento auditado; no borra historia.

## Diferencias explícitas con el UML

- Relaciones 83 y 85: la recuperación autorizada admite 1..* ofertas por decisión y 0..* bookings, uno por oferta/emisor. Se conserva el diagrama original como evidencia, sin editarlo silenciosamente.
- AssetCargoCapability: se diseña una definición reutilizable y una FK desde el activo para respetar la multiplicidad UML. La tabla existente por activo/categoría se mantiene como compatibilidad hasta una migración de transición comprobada.
- LoadAllocation referencia unidad mediante request_id e índice estable del snapshot; una revisión invalida planes derivados. No se fabrica una entidad CargoUnit con CRUD independiente.
- La ausencia de dato legado no se rellena con evidencia ficticia: el nuevo atributo permanece desconocido hasta actualizar el agregado por un comando validado.

## Atributos

### Organization — `organizations`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `id` | UUID | `organizations.id` |
| `code` | string | `organizations.code` |
| `commercialName` | string | `organizations.name` |
| `legalName?` | string | `organizations.legal_name` |
| `taxIdType?` | string | `organizations.business_identifier_type` |
| `taxIdValue?` | string | `organizations.business_identifier_value` |
| `countryCode?` | string | `organizations.country_code` |
| `corporateEmail?` | string | `organizations.corporate_email` |
| `defaultCurrency` | Currency | `organizations.default_currency` |
| `status` | OrganizationStatus | `organizations.status` |
| `corporatePhone?` | string | `organizations.corporate_phone` |

### Facility — `facilities`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `id` | UUID | `facilities.id` |
| `code` | string | `facilities.code` |
| `name` | string | `facilities.name` |
| `location` | GeoLocation | `facilities.{country_code,region_code,city,address_line,latitude,longitude}` |
| `active` | boolean | `facilities.active` |
| `accessRestrictions` | Rule[] | `facilities.access_restrictions` |
| `operatingHours?` | Schedule | `facilities.operating_hours` |

### FreightRequest — `freight_requests`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `id` | UUID | `freight_requests.id` |
| `origin` | GeoLocation | `freight_requests.v2_snapshot.origin` |
| `destination` | GeoLocation | `freight_requests.v2_snapshot.destination` |
| `pickupWindow` | TimeWindow | `freight_requests.v2_snapshot.pickupWindow` |
| `deliveryDeadline?` | Instant | `freight_requests.delivery_deadline` |
| `acceptedModes` | TransportMode[] | `freight_requests.v2_snapshot.acceptedModes` |
| `budget?` | Money | `freight_requests.v2_snapshot.budget` |
| `status` | RequestStatus | `freight_requests.status` |
| `draftVersion` | number | `freight_requests.draft_version` |
| `serviceType?` | ServiceClass | `freight_requests.service_type` |
| `requiredEquipment?` | EquipmentType | `freight_requests.required_equipment_code` |
| `preferredEquipment?` | EquipmentType | `freight_requests.preferred_equipment_code` |
| `selectionObjective?` | RankingObjective | `freight_requests.selection_objective` |

### CargoSpecification — `freight_requests.v2_snapshot.cargoSpecification`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `category` | CargoCategory | `freight_requests.v2_snapshot.cargoSpecification.categoryCode` |
| `packaging` | PackageType | `freight_requests.v2_snapshot.cargoSpecification.packaging` |
| `totalWeightKg` | number | `freight_requests.v2_snapshot.cargoSpecification.totalWeightKg` |
| `totalVolumeM3?` | number | `freight_requests.v2_snapshot.cargoSpecification.totalVolumeM3` |
| `divisible` | boolean | `freight_requests.v2_snapshot.cargoSpecification.divisible` |
| `requirements` | CargoRequirement[] | `freight_requests.v2_snapshot.cargoSpecification.requirements` |
| `temperatureRange?` | TemperatureRange | `freight_requests.v2_snapshot.cargoSpecification.temperatureRange` |
| `description?` | string | `freight_requests.v2_snapshot.cargoSpecification.description` |
| `availableDocuments` | DocumentRef[] | `freight_requests.v2_snapshot.cargoSpecification.availableDocuments` |

### CargoUnit — `freight_requests.v2_snapshot.cargoSpecification.units[]`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `packageType` | PackageType | `freight_requests.v2_snapshot.cargoSpecification.units[].packageType` |
| `quantity` | number | `freight_requests.v2_snapshot.cargoSpecification.units[].quantity` |
| `weightPerUnitKg` | number | `freight_requests.v2_snapshot.cargoSpecification.units[].weightPerUnitKg` |
| `volumePerUnitM3?` | number | `freight_requests.v2_snapshot.cargoSpecification.units[].volumePerUnitM3` |
| `dimensions` | Dimensions | `freight_requests.v2_snapshot.cargoSpecification.units[].dimensionsCm` |
| `indivisible` | boolean | `freight_requests.v2_snapshot.cargoSpecification.units[].indivisible` |
| `stackable?` | boolean | `freight_requests.v2_snapshot.cargoSpecification.units[].stackable` |
| `unitsPerPackage?` | number | `freight_requests.v2_snapshot.cargoSpecification.units[].unitsPerPackage` |

### Carrier — `carriers`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `id` | UUID | `carriers.id` |
| `code` | string | `carriers.code` |
| `commercialName` | string | `carriers.name` |
| `legalName?` | string | `carriers.legal_name` |
| `businessIdType?` | string | `carriers.business_identifier_type` |
| `businessIdValue?` | string | `carriers.business_identifier_value` |
| `registeredCountry?` | string | `carriers.registered_country` |
| `verifiedContact?` | Contact | `carriers.verified_contact` |
| `providerType` | ProviderType | `carriers.provider_type` |
| `status` | CarrierStatus | `carriers.status` |
| `operationalPhone?` | E164Phone | `carriers.operational_phone` |

### CarrierDepot — `carrier_depots`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `id` | UUID | `carrier_depots.id` |
| `code` | string | `carrier_depots.code` |
| `location` | GeoLocation | `carrier_depots.{address_line,country_code,region_code,city,latitude,longitude}` |
| `active` | boolean | `carrier_depots.active` |
| `handling?` | HandlingCapability[] | `carrier_depots.handling` |

### CarrierService — `carrier_services`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `id` | UUID | `carrier_services.id` |
| `mode` | TransportMode | `carrier_services.transport_mode` |
| `serviceClass` | ServiceClass | `carrier_services.service_type` |
| `maxWeightKg?` | number | `carrier_services.max_capacity_kg` |
| `maxVolumeM3?` | number | `carrier_services.max_volume_m3` |
| `responseChannels` | ResponseChannel[] | `carrier_services.response_channels` |
| `status` | ServiceStatus | `carrier_services.active; ACTIVE/INACTIVE projection` |
| `admittedCargoTypes` | CargoCategory[] | `carrier_services.carrier_service_cargo_categories.cargo_category_id` |
| `temperatureRange?` | TemperatureRange | `carrier_services.{temperature_min_c,temperature_max_c}` |
| `requiredCertifications` | Certification[] | `carrier_services.required_certifications` |

### ServiceLane — `service_lanes`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `kind` | DIRECT / WITHIN_AREA | `service_lanes.lane_kind` |
| `mode` | TransportMode | `service_lanes.transport_mode` |
| `borderReviewRequired` | boolean | `service_lanes.cross_border_review_required` |
| `evidence?` | EvidenceRef | `service_lanes.evidence_reference` |
| `validUntil?` | Instant | `service_lanes.valid_until` |

### ResponseIntegration — `response_integrations`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `channel` | MANUAL / API / MCP | `response_integrations.channel` |
| `endpointRef?` | SecretRef | `response_integrations.endpoint_ref` |
| `verifiedAt?` | Instant | `response_integrations.verified_at` |
| `status` | IntegrationStatus | `response_integrations.status` |
| `evidence?` | EvidenceRef | `response_integrations.evidence` |

### CapacitySource — `|capacity_source_projection`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `sourceId` | UUID | `|capacity_source_projection.sourceId` |
| `provenance` | FulfilmentSource | `|capacity_source_projection.provenance` |

### TransportAsset — `transport_assets`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `id` | UUID | `transport_assets.id` |
| `code` | string | `transport_assets.code` |
| `equipmentType` | EquipmentType | `transport_assets.equipment_code` |
| `usefulCapacityKg` | number | `transport_assets.max_weight_kg` |
| `usableVolumeM3?` | number | `transport_assets.max_volume_m3` |
| `operatingStatus` | AssetStatus | `transport_assets.operating_status` |
| `homeDepot?` | CarrierDepot | `transport_assets.home_depot_id` |

### RoadVehicle — `transport_assets`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `plate` | string | `transport_assets.plate` |
| `registrationCode?` | string | `transport_assets.registration_code` |
| `registeredAt?` | LocalDate | `transport_assets.registered_at` |
| `brand?` | string | `transport_assets.brand` |
| `model?` | string | `transport_assets.model` |
| `variant?` | string | `transport_assets.variant` |
| `bodyType` | VehicleBodyType | `transport_assets.body_type` |
| `usableDimensions?` | Dimensions | `transport_assets.usable_dimensions` |
| `grossWeightLimitKg?` | number | `transport_assets.gross_weight_limit_kg` |
| `odometerKm?` | number | `transport_assets.odometer_km` |
| `conditionReason?` | AssetConditionReason | `transport_assets.condition_reason` |

### CapacityPool — `capacity_pools`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `id` | UUID | `capacity_pools.id` |
| `mode` | TransportMode | `capacity_pools.mode` |
| `serviceWindow` | TimeWindow | `capacity_pools.{starts_at,ends_at}` |
| `declaredCapacity` | Capacity | `capacity_pools.{max_weight_kg,max_volume_m3}` |
| `partner` | FulfilmentSource | `capacity_pools.fulfilment_source` |
| `evidence` | EvidenceRef | `capacity_pools.evidence` |

### CapacityCalendar — `capacity_calendars`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `timezone` | TimeZone | `capacity_calendars.timezone` |
| `horizon` | TimeWindow | `capacity_calendars.{horizon_starts_at,horizon_ends_at}` |
| `source` | DataSource | `capacity_calendars.source` |
| `lastVerifiedAt?` | Instant | `capacity_calendars.last_verified_at` |
| `freshness` | EvidenceStatus | `capacity_calendars.freshness` |

### CapacityReservation — `capacity_reservations`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `occupiedWindow` | TimeWindow | `capacity_reservations.{starts_at,ends_at}` |
| `committedCapacity` | Capacity | `capacity_reservations.committed_capacity` |
| `status` | ReservationStatus | `capacity_reservations.status` |
| `reference` | string | `capacity_reservations.reference` |
| `source` | DataSource | `capacity_reservations.source` |
| `id` | UUID | `capacity_reservations.id` |
| `planResourceId?` | UUID | `capacity_reservations.plan_resource_id` |

### ScheduledMaintenance — `scheduled_maintenances`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `blockedWindow` | TimeWindow | `scheduled_maintenances.{starts_at,ends_at}` |
| `kind` | MaintenanceType | `scheduled_maintenances.kind` |
| `status` | MaintenanceStatus | `scheduled_maintenances.status` |
| `source` | DataSource | `scheduled_maintenances.source` |

### Driver — `drivers`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `id` | UUID | `drivers.id` |
| `fullName` | string | `drivers.full_name` |
| `portalAccount?` | CarrierOperator | `drivers.carrier_operator_id` |
| `licenseClass` | LicenseClass | `drivers.license_class` |
| `licenseValidUntil` | LocalDate | `drivers.license_valid_until` |
| `qualifications` | Qualification[] | `drivers.qualifications` |
| `experienceYears?` | number | `drivers.experience_years` |
| `dutyStatus` | DutyStatus | `drivers.duty_status` |

### DriverAssignment — `driver_assignments`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `window` | TimeWindow | `driver_assignments.{starts_at,ends_at}` |
| `role` | PRIMARY / RELIEF | `driver_assignments.role` |
| `status` | AssignmentStatus | `driver_assignments.status` |
| `evidence?` | EvidenceRef | `driver_assignments.evidence` |

### VehicleAssignment — `vehicle_assignments`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `window` | TimeWindow | `vehicle_assignments.{starts_at,ends_at}` |
| `status` | AssignmentStatus | `vehicle_assignments.status` |
| `capacityCommitted` | Capacity | `vehicle_assignments.capacity_committed` |
| `evidence?` | EvidenceRef | `vehicle_assignments.evidence` |

### AssetStatusEvent — `asset_status_events`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `at` | Instant | `asset_status_events.at` |
| `previous` | AssetStatus | `asset_status_events.previous` |
| `next` | AssetStatus | `asset_status_events.next` |
| `reason` | AssetConditionReason | `asset_status_events.reason` |
| `evidence?` | EvidenceRef | `asset_status_events.evidence` |

### RoutePlan — `route_plans`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `origin` | GeoLocation | `route_plans.origin` |
| `destination` | GeoLocation | `route_plans.destination` |
| `estimatedDistanceKm?` | number | `route_plans.estimated_distance_km` |
| `estimatedDuration?` | Duration | `route_plans.estimated_duration_seconds` |
| `geographicSource` | DataSource | `route_plans.geographic_source` |
| `confidence` | EvidenceStatus | `route_plans.confidence` |
| `estimatedTolls?` | Money | `route_plans.estimated_tolls` |
| `borderCostEstimate?` | Money | `route_plans.border_cost_estimate` |

### RouteLeg — `route_legs`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `sequence` | number | `route_legs.sequence` |
| `mode` | TransportMode | `route_legs.mode` |
| `origin` | GeoLocation | `route_legs.origin` |
| `destination` | GeoLocation | `route_legs.destination` |
| `borderRequirements` | Rule[] | `route_legs.border_requirements` |
| `estimatedDistanceKm?` | number | `route_legs.estimated_distance_km` |
| `estimatedDuration?` | Duration | `route_legs.estimated_duration_seconds` |

### RouteCondition — `route_conditions`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `kind` | CLOSURE / DELAY / HAZARD / RESTRICTION | `route_conditions.kind` |
| `location` | GeoLocation | `route_conditions.location` |
| `observedAt` | Instant | `route_conditions.observed_at` |
| `validUntil?` | Instant | `route_conditions.valid_until` |
| `source` | DataSource | `route_conditions.source` |
| `confidence` | EvidenceStatus | `route_conditions.confidence` |

### RouteWaypoint — `route_waypoints`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `kind` | FUEL / REST / BORDER / TRANSFER | `route_waypoints.kind` |
| `location` | GeoLocation | `route_waypoints.location` |
| `sequence` | number | `route_waypoints.sequence` |
| `source` | DataSource | `route_waypoints.source` |
| `verifiedAt?` | Instant | `route_waypoints.verified_at` |

### RoutePlanningPolicy — `route_planning_policies`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `version` | string | `route_planning_policies.version` |
| `objective` | RouteObjective | `route_planning_policies.objective` |
| `constraints` | Rule[] | `route_planning_policies.constraints` |
| `weights` | WeightSet | `route_planning_policies.weights` |
| `missingDataRule` | Rule | `route_planning_policies.missing_data_rule` |

### TransportPlanCandidate — `transport_plan_candidates`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `proposedWindow` | TimeWindow | `transport_plan_candidates.{starts_at,ends_at}` |
| `coverage` | EvidenceStatus | `transport_plan_candidates.coverage` |
| `availability` | EvidenceStatus | `transport_plan_candidates.availability` |
| `pendingRequirements` | Rule[] | `transport_plan_candidates.pending_requirements` |
| `exclusionReasons` | ReasonCode[] | `transport_plan_candidates.exclusion_reasons` |
| `id` | UUID | `transport_plan_candidates.id` |

### PlanResource — `plan_resources`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `role` | LOAD_BEARING / AUXILIARY | `plan_resources.role` |
| `equipment` | EquipmentType | `plan_resources.equipment` |
| `units` | number | `plan_resources.units` |
| `window` | TimeWindow | `plan_resources.{starts_at,ends_at}` |
| `availability` | EvidenceStatus | `plan_resources.availability` |
| `applicableCapacity?` | Capacity | `plan_resources.applicable_capacity` |
| `verificationSource?` | EvidenceRef | `plan_resources.verification_source` |
| `id` | UUID | `plan_resources.id` |

### CarrierOpportunity — `carrier_opportunities`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `sentAt` | Instant | `carrier_opportunities.sent_at` |
| `responseDeadline` | Instant | `carrier_opportunities.response_deadline` |
| `responseChannel` | ResponseChannel | `carrier_opportunities.response_channel` |
| `status` | OpportunityStatus | `carrier_opportunities.status` |

### CarrierOffer — `v2_carrier_offers`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `carrierReference` | string | `v2_carrier_offers.carrier_reference` |
| `price` | Money | `v2_carrier_offers.price` |
| `breakdown` | OfferCostComponent[] | `v2_carrier_offers.breakdown` |
| `validity` | TimeWindow | `v2_carrier_offers.{valid_from,valid_until}` |
| `source` | OfferSource | `v2_carrier_offers.source` |
| `status` | OfferStatus | `v2_carrier_offers.status` |
| `id` | UUID | `v2_carrier_offers.id` |
| `issuedAt` | Instant | `v2_carrier_offers.issued_at` |
| `estimatedPickupAt?` | Instant | `v2_carrier_offers.estimated_pickup_at` |
| `estimatedDeliveryAt?` | Instant | `v2_carrier_offers.estimated_delivery_at` |
| `transitDuration?` | Duration | `v2_carrier_offers.transit_duration_seconds` |
| `reservableCapacity?` | Capacity | `v2_carrier_offers.reservable_capacity` |
| `commercialTerms` | Term[] | `v2_carrier_offers.commercial_terms` |
| `evidence` | EvidenceRef[] | `v2_carrier_offers.evidence` |
| `offerVersion` | number | `v2_carrier_offers.offer_version` |
| `supersedesOfferId?` | UUID | `v2_carrier_offers.supersedes_offer_id` |
| `requestId` | UUID | `v2_carrier_offers.request_id` |
| `planCandidateId` | UUID | `v2_carrier_offers.plan_candidate_id` |
| `opportunityId` | UUID | `v2_carrier_offers.opportunity_id` |
| `carrierId` | UUID | `v2_carrier_offers.carrier_id` |
| `coveredServiceIds` | UUID[] | `v2_carrier_offers.v2_offer_services.service_id` |
| `coveredAssignmentIds` | UUID[] | `v2_carrier_offers.v2_offer_assignments.assignment_id` |

### RankedOption — `ranked_options`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `position` | number | `ranked_options.position` |
| `score?` | number | `ranked_options.score` |
| `explanation` | Explanation | `ranked_options.explanation` |
| `missingData` | MissingDatum[] | `ranked_options.missing_data` |
| `policyVersion` | string | `ranked_options.policy_version` |

### ScoringPolicy — `scoring_policies`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `version` | string | `scoring_policies.version` |
| `objective` | RankingObjective | `scoring_policies.objective` |
| `weights` | WeightSet | `scoring_policies.weights` |
| `missingDataRule` | Rule | `scoring_policies.missing_data_rule` |
| `tieBreaker` | TieBreaker | `scoring_policies.tie_breaker` |

### Booking — `v2_bookings`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `carrierReference?` | string | `v2_bookings.carrier_reference` |
| `confirmedAt?` | Instant | `v2_bookings.confirmed_at` |
| `id` | UUID | `v2_bookings.id` |
| `selectionDecisionId` | UUID | `v2_bookings.selection_decision_id` |
| `authorizedAt?` | Instant | `v2_bookings.authorized_at` |
| `authorizationStatus` | AuthorizationStatus | `v2_bookings.authorization_status` |
| `carrierConfirmationStatus` | CarrierConfirmationStatus | `v2_bookings.carrier_confirmation_status` |
| `capacityEvidence` | EvidenceRef[] | `v2_bookings.capacity_evidence` |

### TransportExecution — `transport_executions`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `id` | UUID | `transport_executions.id` |
| `status` | ExecutionStatus | `transport_executions.status` |
| `plannedWindow` | TimeWindow | `transport_executions.{planned_starts_at,planned_ends_at}` |
| `actualStartedAt?` | Instant | `transport_executions.actual_started_at` |
| `actualCompletedAt?` | Instant | `transport_executions.actual_completed_at` |
| `lastKnownPosition?` | GeoLocation | `transport_executions.last_known_position` |

### OperationalIncident — `operational_incidents`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `id` | UUID | `operational_incidents.id` |
| `kind` | IncidentKind | `operational_incidents.kind` |
| `severity` | Severity | `operational_incidents.severity` |
| `occurredAt` | Instant | `operational_incidents.occurred_at` |
| `location?` | GeoLocation | `operational_incidents.location` |
| `description` | string | `operational_incidents.description` |
| `status` | IncidentStatus | `operational_incidents.status` |
| `reportedBy` | ActorRef | `operational_incidents.reported_by` |
| `evidence` | EvidenceRef[] | `operational_incidents.evidence` |

### IncidentUpdate — `incident_updates`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `at` | Instant | `incident_updates.at` |
| `actor` | ActorRef | `incident_updates.actor` |
| `action` | IncidentAction | `incident_updates.action` |
| `note` | string | `incident_updates.note` |
| `evidence?` | EvidenceRef | `incident_updates.evidence` |

### LogisticsNode — `logistics_nodes`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `id` | UUID | `logistics_nodes.id` |
| `kind` | PORT / TERMINAL / BORDER / HUB | `logistics_nodes.kind` |
| `name` | string | `logistics_nodes.name` |
| `location` | GeoLocation | `logistics_nodes.location` |
| `jurisdiction?` | string | `logistics_nodes.jurisdiction` |
| `source` | DataSource | `logistics_nodes.source` |
| `verifiedAt?` | Instant | `logistics_nodes.verified_at` |

### RouteCorridor — `route_corridors`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `id` | UUID | `route_corridors.id` |
| `mode` | TransportMode | `route_corridors.mode` |
| `estimatedDistanceKm?` | number | `route_corridors.estimated_distance_km` |
| `estimatedDuration?` | Duration | `route_corridors.estimated_duration_seconds` |
| `restrictions` | Rule[] | `route_corridors.restrictions` |
| `source` | DataSource | `route_corridors.source` |
| `version` | string | `route_corridors.version` |
| `validUntil?` | Instant | `route_corridors.valid_until` |

### CargoProfile — `organization_cargo_profiles`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `id` | UUID | `organization_cargo_profiles.id` |
| `name` | string | `organization_cargo_profiles.profile_name` |
| `typicalUnits` | CargoUnitTemplate[] | `organization_cargo_profiles.typical_units` |
| `requirements` | CargoRequirement[] | `organization_cargo_profiles.requirements` |
| `preferredEquipment?` | EquipmentType | `organization_cargo_profiles.preferred_equipment` |
| `updatedAt` | Instant | `organization_cargo_profiles.updated_at` |

### CargoCategory — `cargo_categories`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `code` | string | `cargo_categories.code` |
| `name` | string | `cargo_categories.name` |
| `guidance` | IntakeGuidance | `cargo_categories.{recommended_entry_methods,intake_specification_schema,suggested_requirements,recommended_vehicle_classes}` |
| `suggestedEquipment?` | EquipmentType | `cargo_categories.suggested_equipment` |
| `version` | string | `cargo_categories.version; integer command revision rendered as a string when required` |

### LoadAllocation — `load_allocations`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `quantity` | number | `load_allocations.quantity` |
| `assignedWeightKg` | number | `load_allocations.assigned_weight_kg` |
| `assignedVolumeM3?` | number | `load_allocations.assigned_volume_m3` |
| `handlingRequirements` | Rule[] | `load_allocations.handling_requirements` |
| `verification` | EvidenceStatus | `load_allocations.verification` |

### OrganizationMember — `organization_members`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `id` | MemberId | `organization_members.id` |
| `role` | OrganizationRole | `organization_members.role` |
| `status` | MemberStatus | `organization_members.status` |
| `contactRef?` | ContactRef | `organization_members.{corporate_email,contact_ref}` |
| `verifiedAt?` | Instant | `organization_members.verified_at` |

### McpAccountLink — `mcp_account_links`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `id` | UUID | `mcp_account_links.id` |
| `authUserId` | UUID | `mcp_account_links.auth_user_id` |
| `oauthClientId` | string | `mcp_account_links.oauth_client_id` |
| `organizationId` | UUID | `mcp_account_links.organization_id` |
| `scopes` | string[] | `mcp_account_links.scopes` |
| `provider` | ALEXA_PLUS / OTHER | `mcp_account_links.provider` |
| `externalSubjectRef` | OpaqueId | `mcp_account_links.external_subject_ref` |
| `status` | LinkStatus | `mcp_account_links.status` |
| `verifiedAt` | Instant | `mcp_account_links.verified_at` |
| `revokedAt?` | Instant | `mcp_account_links.revoked_at` |
| `expiresAt?` | Instant | `mcp_account_links.expires_at` |

### RepositioningBlock — `repositioning_blocks`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `occupiedWindow` | TimeWindow | `repositioning_blocks.{starts_at,ends_at}` |
| `origin` | GeoLocation | `repositioning_blocks.origin` |
| `nextPickup` | GeoLocation | `repositioning_blocks.next_pickup` |
| `estimatedTravel` | Duration | `repositioning_blocks.estimated_travel_seconds` |
| `status` | BlockStatus | `repositioning_blocks.status` |
| `source` | DataSource | `repositioning_blocks.source` |

### OrganizationPreferences — `organization_preferences`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `objective?` | RankingObjective | `organization_preferences.objective` |
| `maximumWait?` | Duration | `organization_preferences.maximum_wait_minutes; explicit minutes in API` |
| `preferredMode?` | TransportMode | `organization_preferences.preferred_mode` |
| `preferredEquipment?` | EquipmentType | `organization_preferences.preferred_equipment` |
| `usualBudget?` | Money | `organization_preferences.usual_budget` |
| `validUntil?` | Instant | `organization_preferences.valid_until` |

### CarrierMetric — `v2_carrier_metrics`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `period` | TimeWindow | `v2_carrier_metrics.{period_starts_at,period_ends_at}` |
| `corridorRef?` | CorridorId | `v2_carrier_metrics.corridor_id` |
| `mode?` | TransportMode | `v2_carrier_metrics.mode` |
| `sampleSize` | number | `v2_carrier_metrics.sample_size` |
| `onTimeRate?` | number | `v2_carrier_metrics.on_time_rate` |
| `successfulDeliveryRate?` | number | `v2_carrier_metrics.successful_delivery_rate` |
| `source` | DataSource | `v2_carrier_metrics.source` |

### VehicleCombination — `vehicle_combinations`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `id` | UUID | `vehicle_combinations.id` |
| `kind` | CombinationType | `vehicle_combinations.kind` |
| `configuration` | string | `vehicle_combinations.configuration` |
| `coupledWindow?` | TimeWindow | `vehicle_combinations.{starts_at,ends_at}` |
| `evidence` | EvidenceRef[] | `vehicle_combinations.evidence` |
| `combinedTareKg?` | number | `vehicle_combinations.combined_tare_kg` |
| `grossWeightLimitKg?` | number | `vehicle_combinations.gross_weight_limit_kg` |
| `status` | CombinationStatus | `vehicle_combinations.status` |

### ServiceArea — `service_areas`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `role` | PICKUP / DELIVERY | `service_areas.area_role` |
| `inclusion` | INCLUDE / EXCLUDE | `service_areas.coverage` |
| `geography` | Geography | `service_areas.{granularity,country_code,region_code,city,postal_code,geometry}` |
| `source` | CoverageSource | `service_areas.{fulfilment_source,fulfilment_partner_id}` |
| `evidence?` | EvidenceRef | `service_areas.evidence_reference` |
| `validUntil?` | Instant | `service_areas.valid_until` |
| `verifiedAt?` | Instant | `service_areas.verified_at` |
| `validFrom?` | Instant | `service_areas.valid_from` |

### FulfilmentPartner — `fulfilment_partners`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `id` | UUID | `fulfilment_partners.id` |
| `registeredName` | string | `fulfilment_partners.registered_name` |
| `partnerCarrierRef?` | UUID | `fulfilment_partners.partner_carrier_ref` |
| `agreementValidFrom` | Instant | `fulfilment_partners.agreement_valid_from` |
| `agreementValidUntil` | Instant | `fulfilment_partners.agreement_valid_until` |
| `status` | PartnerStatus | `fulfilment_partners.status` |
| `coverageEvidence` | EvidenceRef | `fulfilment_partners.coverage_evidence` |

### PlanLegAssignment — `plan_leg_assignments`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `sequence` | number | `plan_leg_assignments.sequence` |
| `window` | TimeWindow | `plan_leg_assignments.{starts_at,ends_at}` |
| `responsibility` | Responsibility | `plan_leg_assignments.responsibility` |
| `coverage` | EvidenceStatus | `plan_leg_assignments.coverage` |
| `availability` | EvidenceStatus | `plan_leg_assignments.availability` |
| `capacityNeeded` | Capacity | `plan_leg_assignments.capacity_needed` |
| `evidence` | EvidenceRef[] | `plan_leg_assignments.evidence` |
| `id` | UUID | `plan_leg_assignments.id` |

### OfferCostComponent — `v2_carrier_offers.breakdown[]`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `kind` | CostKind | `v2_carrier_offers.breakdown[].kind` |
| `amount?` | Money | `v2_carrier_offers.breakdown[].amount` |
| `treatment` | INCLUDED / QUOTED / ESTIMATED / EXCLUDED / UNKNOWN | `v2_carrier_offers.breakdown[].treatment` |
| `source` | DataSource | `v2_carrier_offers.breakdown[].source` |
| `observedAt` | Instant | `v2_carrier_offers.breakdown[].observedAt` |
| `details?` | string | `v2_carrier_offers.breakdown[].details` |

### ShipmentContact — `freight_requests.v2_snapshot.contacts`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `role` | PICKUP / RECIPIENT | `freight_requests.v2_snapshot.contacts.{pickup:PICKUP,recipient:RECIPIENT}` |
| `name` | string | `freight_requests.v2_snapshot.contacts.name` |
| `company?` | string | `freight_requests.v2_snapshot.contacts.company` |
| `phone` | E164Phone | `freight_requests.v2_snapshot.contacts.phoneE164` |
| `email?` | EmailAddress | `freight_requests.v2_snapshot.contacts.email` |
| `addressDetail?` | string | `freight_requests.v2_snapshot.contacts.addressDetail` |
| `handlingInstructions?` | string | `freight_requests.v2_snapshot.contacts.handlingInstructions` |

### CarrierOperator — `carrier_operators`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `id` | UUID | `carrier_operators.id` |
| `displayName` | string | `carrier_operators.display_name` |
| `role` | CarrierRole | `carrier_operators.role` |
| `email?` | EmailAddress | `carrier_operators.email` |
| `phone?` | E164Phone | `carrier_operators.phone` |
| `status` | MemberStatus | `carrier_operators.status` |
| `verifiedAt?` | Instant | `carrier_operators.verified_at` |

### AssetCargoCapability — `cargo_capability_definitions`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `requirements` | CargoRequirement[] | `cargo_capability_definitions.requirements` |
| `maxWeightKg?` | number | `cargo_capability_definitions.max_weight_kg` |
| `temperatureRange?` | TemperatureRange | `cargo_capability_definitions.temperature_range` |
| `evidence?` | EvidenceRef | `cargo_capability_definitions.evidence` |
| `validUntil?` | Instant | `cargo_capability_definitions.valid_until` |

### RouteSimulationScenario — `|scenario_files`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `id` | ScenarioId | `|scenario_files.id` |
| `label` | string | `|scenario_files.label` |
| `seed` | string | `|scenario_files.seed` |
| `networkVersion` | string | `|scenario_files.networkVersion` |
| `clock` | Instant | `|scenario_files.clock` |
| `source` | SYNTHETIC | `|scenario_files.source` |
| `expectedOutcome` | RouteDecision | `|scenario_files.expectedOutcome` |

### RoutePlanner — `|route_planner_port`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `algorithmVersion` | string | `|route_planner_port.algorithmVersion` |
| `graphVersion` | string | `|route_planner_port.graphVersion` |
| `source` | DataSource | `|route_planner_port.source` |

### SelectionDecision — `selection_decisions`

| UML | Tipo | Destino físico objetivo |
|---|---|---|
| `id` | UUID | `selection_decisions.id` |
| `selectedAt` | Instant | `selection_decisions.selected_at` |
| `rationale` | Explanation | `selection_decisions.rationale` |
| `policyVersion?` | string | `selection_decisions.policy_version` |
| `consideredOptions` | OptionRef[] | `selection_decisions.considered_options` |
| `status` | DecisionStatus | `selection_decisions.status` |
| `evidence` | EvidenceRef[] | `selection_decisions.evidence` |
| `selectedPlanId` | UUID | `selection_decisions.selected_plan_id` |
| `selectedOfferIds` | UUID[] | `selection_decisions.selection_decision_offers.offer_id` |

## Relaciones y restricciones

| Nº | UML | Cardinalidad original | Tratamiento físico objetivo |
|---|---|---|---|
| 0 | Organization → Facility (registra) | 1 / 0..* | facilities.organization_id -> organizations.id |
| 1 | Organization → FreightRequest (presenta) | 1 / 0..* | freight_requests.organization_id -> organizations.id |
| 2 | Facility → FreightRequest (origen) | 0..1 / 0..* | freight_requests.origin_facility_id -> facilities.id; nullable; same organization |
| 3 | Facility → FreightRequest (destino) | 0..1 / 0..* | freight_requests.destination_facility_id -> facilities.id; nullable; same organization |
| 4 | FreightRequest → CargoSpecification (describe) | 1 / 1 | freight_requests.v2_snapshot.cargoSpecification; exactly one validated object |
| 5 | CargoSpecification → CargoUnit (contiene al enviar) | 1 / 1..* | cargoSpecification.units[]; stable unit index; nonempty at submission |
| 6 | Carrier → CarrierDepot (opera) | 1 / 0..* | carrier_depots.carrier_id -> carriers.id |
| 7 | Carrier → CarrierService (publica) | 1 / 0..* | carrier_services.carrier_id -> carriers.id |
| 8 | CarrierService → ServiceArea (declara) | 1 / 0..* | service_areas.carrier_service_id -> carrier_services.id |
| 9 | CarrierService → ServiceLane (declara) | 1 / 0..* | service_lanes.carrier_service_id -> carrier_services.id |
| 10 | ServiceArea → ServiceLane (origen cubierto) | 1 PICKUP / 0..* | service_lanes.pickup_area_id -> service_areas.id; role PICKUP; same service |
| 11 | ServiceArea → ServiceLane (destino cubierto) | 1 DELIVERY / 0..* | service_lanes.delivery_area_id -> service_areas.id; role DELIVERY; same service |
| 12 | CarrierService → ResponseIntegration (responde por) | 1 / 0..* | response_integrations.carrier_service_id -> carrier_services.id; secret reference only |
| 13 | Carrier → TransportAsset (gestiona) | 1 / 0..* | transport_assets.carrier_id -> carriers.id |
| 14 | CarrierDepot → TransportAsset (base física) | 0..1 / 0..* | transport_assets.home_depot_id -> carrier_depots.id; nullable; same carrier |
| 15 | RoadVehicle → TransportAsset (especializa) | herencia/realización | single-table inheritance: mode ROAD; vehicle fields not attached to other modes |
| 16 | TransportAsset → CapacitySource (realiza) | herencia/realización | projection keyed ASSET/id; never independently writable |
| 17 | CapacityPool → CapacitySource (realiza) | herencia/realización | projection keyed POOL/id; never independently writable |
| 18 | CarrierService → CapacityPool (usa cupo) | 1 / 0..* | capacity_pools.carrier_service_id -> carrier_services.id |
| 19 | CapacitySource → CapacityCalendar (agenda) | 1 / 0..1 | capacity_calendars XOR transport_asset_id/capacity_pool_id; unique per source |
| 20 | CapacityCalendar → CapacityReservation (registra) | 1 / 0..* | capacity_reservations.capacity_calendar_id -> capacity_calendars.id |
| 21 | TransportAsset → ScheduledMaintenance (bloquea) | 1 / 0..* | scheduled_maintenances.transport_asset_id -> transport_assets.id |
| 22 | TransportAsset → AssetStatusEvent (historial) | 1 / 0..* | asset_status_events.transport_asset_id -> transport_assets.id; append-only |
| 23 | Carrier → Driver (habilita) | 1 / 0..* | drivers.carrier_id -> carriers.id |
| 24 | Driver → DriverAssignment (asignado) | 1 / 0..* | driver_assignments.driver_id -> drivers.id; nonoverlapping active windows |
| 25 | RoadVehicle → VehicleAssignment (asignado) | 1 / 0..* | vehicle_assignments.transport_asset_id -> transport_assets.id; ROAD; nonoverlapping active windows |
| 26 | FreightRequest → TransportPlanCandidate (genera) | 1 / 0..* | transport_plan_candidates.request_id -> freight_requests.id |
| 27 | TransportPlanCandidate → RoutePlan (propone) | 1 / 1 | transport_plan_candidates.route_plan_id -> route_plans.id; mandatory; same request |
| 28 | RoutePlan → RouteLeg (contiene) | 1 / 1..* | route_legs.route_plan_id -> route_plans.id; unique sequence; at least one on publication |
| 29 | RoutePlan → RouteWaypoint (incluye) | 1 / 0..* | route_waypoints.route_plan_id -> route_plans.id; unique sequence |
| 30 | RouteLeg → RouteCondition (afectado por) | 0..* / 0..* | route_leg_conditions(leg_id,condition_id); composite primary key |
| 31 | RoutePlanningPolicy → RoutePlan (evalúa) | 1 / 0..* | route_plans.policy_id -> route_planning_policies.id; immutable policy version |
| 32 | TransportPlanCandidate → PlanResource (requiere) | 1 / 1..* | plan_resources.plan_candidate_id -> transport_plan_candidates.id; nonempty validated at publication |
| 33 | TransportPlanCandidate → CarrierService (/servicios por tramo (derivada de PlanLegAssignment)) | 0..* / 1..* | derived DISTINCT carrier_service_id from plan_leg_assignments; no duplicate editable relation |
| 34 | PlanResource → RouteLeg (asignado a) | 0..* / 1 | plan_resources.route_leg_id -> route_legs.id; same plan |
| 35 | PlanResource → CapacitySource (usa fuente) | 0..* / 0..1 | plan_resources XOR nullable asset_id/pool_id; neither allowed only for UNKNOWN; not both |
| 36 | TransportPlanCandidate → CarrierOpportunity (propone) | 1 / 0..* | carrier_opportunities.plan_candidate_id -> transport_plan_candidates.id |
| 37 | Carrier → CarrierOpportunity (invitado) | 1 / 0..* | carrier_opportunities.carrier_id -> carriers.id |
| 38 | CarrierOpportunity → CarrierOffer (recibe) | 1 / 0..* | v2_carrier_offers.opportunity_id -> carrier_opportunities.id; request/plan/carrier must match |
| 39 | Carrier → CarrierOffer (emite) | 1 / 0..* | v2_carrier_offers.carrier_id -> carriers.id |
| 40 | CarrierOffer → RankedOption (evaluada como) | 1 / 0..* | ranked_options.offer_id -> v2_carrier_offers.id; immutable ranking snapshot |
| 41 | ScoringPolicy → RankedOption (calcula) | 1 / 0..* | ranked_options.scoring_policy_id -> scoring_policies.id; immutable policy version |
| 42 | CarrierOffer → Booking (fundamenta) | 1 / 0..1 | v2_bookings.offer_id -> v2_carrier_offers.id; UNIQUE offer_id |
| 43 | Booking → TransportExecution (inicia) | 1 / 0..1 | transport_executions.booking_id -> v2_bookings.id; UNIQUE booking_id |
| 44 | TransportExecution → DriverAssignment (tripulación) | 1 / 0..* | driver_assignments.execution_id -> transport_executions.id; same responsible carrier |
| 45 | TransportExecution → VehicleAssignment (equipo) | 1 / 0..* | vehicle_assignments.execution_id -> transport_executions.id; same responsible carrier |
| 46 | TransportExecution → OperationalIncident (registra) | 1 / 0..* | operational_incidents.execution_id -> transport_executions.id |
| 47 | OperationalIncident → IncidentUpdate (bitácora) | 1 / 0..* | incident_updates.incident_id -> operational_incidents.id; append-only |
| 48 | OperationalIncident → RouteCondition (evidencia vial) | 0..* / 0..* | incident_route_conditions(incident_id,condition_id); composite primary key; source retained |
| 49 | LogisticsNode → RouteCorridor (inicio dirigido) | 1 origin / 0..* | route_corridors.origin_node_id -> logistics_nodes.id |
| 50 | LogisticsNode → RouteCorridor (fin dirigido) | 1 destination / 0..* | route_corridors.destination_node_id -> logistics_nodes.id; direction preserved |
| 51 | RouteCorridor → RouteLeg (tramo sobre corredor) | 0..1 / 0..* | route_legs.corridor_id -> route_corridors.id; nullable; preserve corridor version snapshot |
| 52 | CargoProfile → CargoCategory (clasifica) | 0..* / 1 | organization_cargo_profiles.cargo_category_id -> cargo_categories.id |
| 53 | Organization → CargoProfile (guarda) | 1 / 0..* | organization_cargo_profiles.organization_id -> organizations.id |
| 54 | CargoUnit → LoadAllocation (se distribuye en) | 1 / 0..* | load_allocations(request_id,cargo_unit_index) validated against immutable request cargo snapshot |
| 55 | PlanResource → LoadAllocation (transporta) | 1 / 0..* | load_allocations.plan_resource_id -> plan_resources.id; same request; totals bounded; indivisible not split |
| 56 | OrganizationMember → Organization (miembros autorizados) | 1..* / 1 | organization_members.organization_id -> organizations.id; active membership checked at command time |
| 57 | OrganizationMember → McpAccountLink (vincula cuenta) | 1 / 0..* | mcp_account_links.organization_member_id -> organization_members.id; existing HAC-11 actor checks retained |
| 58 | CapacityCalendar → RepositioningBlock (bloquea por traslado) | 1 / 0..* | repositioning_blocks.capacity_calendar_id -> capacity_calendars.id |
| 59 | Organization → OrganizationPreferences (configura) | 1 / 0..1 | organization_preferences.organization_id -> organizations.id; UNIQUE organization_id |
| 60 | Carrier → CarrierMetric (métricas con muestra) | 1 / 0..* | v2_carrier_metrics.carrier_id -> carriers.id; sample and period mandatory |
| 61 | VehicleCombination → PlanResource (unidad combinada) | 0..1 / 0..* | plan_resources.vehicle_combination_id -> vehicle_combinations.id; nullable; carrier/time compatibility |
| 62 | VehicleCombination → TransportAsset (agrupa activos) | 0..* / 1..* | vehicle_combination_assets(combination_id,asset_id); nonempty; active coupling exclusion per asset |
| 63 | FulfilmentPartner → ServiceArea (respalda cobertura) | 0..1 / 0..* | service_areas.fulfilment_partner_id -> fulfilment_partners.id; nullable; same carrier and valid agreement |
| 64 | FulfilmentPartner → CapacityPool (aporta cupo) | 0..1 / 0..* | capacity_pools.fulfilment_partner_id -> fulfilment_partners.id; nullable; no fabricated individual vehicle |
| 65 | Carrier → FulfilmentPartner (registra socio) | 1 / 0..* | fulfilment_partners.carrier_id -> carriers.id |
| 66 | FulfilmentPartner → PlanLegAssignment (ejecuta por acuerdo) | 0..1 / 0..* | plan_leg_assignments.fulfilment_partner_id -> fulfilment_partners.id; nullable; valid during assignment |
| 67 | PlanLegAssignment → RouteLeg (usa tramo) | 0..* / 1 | plan_leg_assignments.route_leg_id -> route_legs.id; same route/plan |
| 68 | TransportPlanCandidate → PlanLegAssignment (desglosa por tramo) | 1 / 1..* | plan_leg_assignments.plan_candidate_id -> transport_plan_candidates.id; nonempty when published |
| 69 | PlanLegAssignment → PlanResource (recursos del tramo) | 1 / 1..* | plan_resources.plan_leg_assignment_id -> plan_leg_assignments.id; same leg/plan; nonempty per assignment |
| 70 | PlanLegAssignment → CarrierService (servicio responsable) | 0..* / 1 | plan_leg_assignments.carrier_service_id -> carrier_services.id |
| 71 | CarrierOffer → PlanLegAssignment (cotiza tramos atribuibles) | 0..* / 1..* | v2_offer_assignments(offer_id,assignment_id); nonempty; attributable carrier and plan |
| 72 | CarrierOffer → OfferCostComponent (desglosa costos) | 1 / 1..* | v2_carrier_offers.breakdown[]; nonempty; quoted cents reconcile with issuer total |
| 73 | FreightRequest → ShipmentContact (receptor de entrega · RECIPIENT) | 1 / 0..1 | freight_requests.v2_snapshot.contacts.recipient; nullable; RECIPIENT role |
| 74 | CarrierOperator → CarrierOffer (emite manualmente) | 0..1 / 0..* | v2_carrier_offers.issuer_operator_id -> carrier_operators.id; nullable for verified API/MCP issuer |
| 75 | CarrierOperator → Carrier (pertenece a) | 0..* / 1 | carrier_operators.carrier_id -> carriers.id; actual auth user and carrier permission required |
| 76 | AssetCargoCapability → TransportAsset (capacidades de carga) | 1 / 0..* | transport_assets.cargo_capability_definition_id -> cargo_capability_definitions.id; legacy per-asset capabilities retained for migration compatibility |
| 77 | CargoCategory → AssetCargoCapability (categoría compatible) | 1 / 0..* | cargo_capability_definitions.cargo_category_id -> cargo_categories.id |
| 78 | RouteSimulationScenario → RouteCorridor (red sintética versionada) | 0..* / 1..* | scenario file references versioned corridor fixtures; no scenario rows in production migrations |
| 79 | RouteSimulationScenario → RouteCondition (inyecta eventos) | 0..1 / 1..* | scenario file owns synthetic condition fixtures; never substitutes live condition evidence |
| 80 | RoutePlanner → RoutePlan (genera alternativas) | 1 / 0..* | route_plans planner_algorithm_version/planner_graph_version/planner_source snapshot; port not table |
| 81 | RoutePlanner → RoutePlanningPolicy (consulta política versionada) | 0..* / 0..* | RoutePlanner receives immutable RoutePlanningPolicy; dependency, not an editable join table |
| 82 | RoutePlanner → RouteCorridor (evalúa red) | 0..* / 0..* | RoutePlanner reads versioned corridor graph; dependency, not ownership |
| 83 | SelectionDecision → Booking (autoriza reserva) | 1 / 0..1 | v2_bookings.selection_decision_id -> selection_decisions.id; approved recovery change 0..1 to 0..* bookings, one per selected offer |
| 84 | OrganizationMember → SelectionDecision (decide) | 1 / 0..* | selection_decisions.organization_member_id -> organization_members.id; audit actor and organization |
| 85 | CarrierOffer → SelectionDecision (oferta elegida) | 1 / 0..* | selection_decision_offers(decision_id,offer_id); approved recovery change single offer to 1..*; exact assignment coverage |
| 86 | FreightRequest → SelectionDecision (decisión auditada) | 1 / 0..* | selection_decisions.request_id -> freight_requests.id |
| 87 | TransportPlanCandidate → SelectionDecision (plan seleccionado) | 1 / 0..* | selection_decisions.selected_plan_id -> transport_plan_candidates.id; same request |
| 88 | FreightRequest → CarrierOffer (referencia de lo cotizado) | 1 / 0..* | v2_carrier_offers.request_id -> freight_requests.id; same opportunity/plan organization |
| 89 | PlanResource → CapacityReservation (ocupa capacidad en ventana) | 0..1 / 0..* | capacity_reservations.plan_resource_id -> plan_resources.id; nullable for pre-plan hold; coherent source |
| 90 | FreightRequest → ShipmentContact (contacto de recojo · PICKUP) | 1 / 0..1 | freight_requests.v2_snapshot.contacts.pickup; nullable; PICKUP role |
| 91 | CarrierOffer → CarrierService (cubre servicio) | 0..* / 1..* | v2_offer_services(offer_id,service_id); nonempty; equals DISTINCT services of covered assignments |
| 92 | Booking → CapacityReservation (compromete capacidad) | 0..1 / 0..* | capacity_reservations.v2_booking_id -> v2_bookings.id; nullable for hold; active commitment proof per carrying resource |

## Gate antes de aplicar el esquema

El inventario y este diseño deben coincidir exactamente con el UML. Después se comprobará cada destino contra pg_catalog, constraints, RLS y comandos reales; los 397 destinos y 93 tratamientos no pasan a IMPLEMENTADO por aparecer aquí. Faltan las migraciones y servicios restantes, pruebas de concurrencia y aislamiento, datos autorizados y consumo Web/MCP del flujo completo.
