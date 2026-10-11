# DER integral reconciliado — HAC-27 / HAC-40

Diseño físico trazable de las 57 clases, 397 atributos y 93 relaciones del UML 07. Los destinos observados corresponden al corte QA abba805 (5 oct, 17 migraciones). Se conservan el objetivo previo y sus diferencias: esta matriz no certifica el incremento actual ni Supabase alojado. No se elimina ninguna clase del alcance.

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

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `id` | UUID | `organizations.id` | `organizations.id` | PARCIAL |
| `code` | string | `organizations.code` | `organizations.code` | PARCIAL |
| `commercialName` | string | `organizations.name` | `organizations.name` | PARCIAL |
| `legalName?` | string | `organizations.legal_name` | `organizations.legal_name` | PARCIAL |
| `taxIdType?` | string | `organizations.business_identifier_type` | `organizations.business_identifier_type` | PARCIAL |
| `taxIdValue?` | string | `organizations.business_identifier_value` | `organizations.business_identifier_value` | PARCIAL |
| `countryCode?` | string | `organizations.country_code` | `organizations.country_code` | PARCIAL |
| `corporateEmail?` | string | `organizations.corporate_email` | `organizations.corporate_email` | PARCIAL |
| `defaultCurrency` | Currency | `organizations.default_currency` | `organizations.default_currency` | PARCIAL |
| `status` | OrganizationStatus | `organizations.status` | `organizations.status` | PARCIAL |
| `corporatePhone?` | string | `organizations.corporate_phone` | `organizations.corporate_phone` | PARCIAL |

### Facility — `facilities`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `id` | UUID | `facilities.id` | `facilities.id` | COMPLETO |
| `code` | string | `facilities.code` | `facilities.code` | COMPLETO |
| `name` | string | `facilities.name` | `facilities.name` | COMPLETO |
| `location` | GeoLocation | `facilities.country_code; facilities.region_code; facilities.city; facilities.address_line; facilities.latitude; facilities.longitude` | `facilities.{country_code,region_code,city,address_line,latitude,longitude}` | COMPLETO |
| `active` | boolean | `facilities.active` | `facilities.active` | COMPLETO |
| `accessRestrictions` | Rule[] | `facilities.access_restrictions` | `facilities.access_restrictions` | COMPLETO |
| `operatingHours?` | Schedule | `facilities.operating_hours` | `facilities.operating_hours` | COMPLETO |

### FreightRequest — `freight_requests`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `id` | UUID | `freight_requests.id` | `freight_requests.id` | COMPLETO |
| `origin` | GeoLocation | `freight_requests.v2_snapshot.origin` | `freight_requests.v2_snapshot.origin` | PARCIAL |
| `destination` | GeoLocation | `freight_requests.v2_snapshot.destination` | `freight_requests.v2_snapshot.destination` | PARCIAL |
| `pickupWindow` | TimeWindow | `freight_requests.v2_snapshot.pickupWindow` | `freight_requests.v2_snapshot.pickupWindow` | PARCIAL |
| `deliveryDeadline?` | Instant | `freight_requests.delivery_deadline` | `freight_requests.delivery_deadline` | COMPLETO |
| `acceptedModes` | TransportMode[] | `freight_requests.v2_snapshot.acceptedModes` | `freight_requests.v2_snapshot.acceptedModes` | PARCIAL |
| `budget?` | Money | `freight_requests.v2_snapshot.budget` | `freight_requests.v2_snapshot.budget` | COMPLETO |
| `status` | RequestStatus | `freight_requests.status` | `freight_requests.status` | COMPLETO |
| `draftVersion` | number | `freight_requests.draft_version` | `freight_requests.draft_version` | COMPLETO |
| `serviceType?` | ServiceClass | `freight_requests.service_type` | `freight_requests.service_type` | COMPLETO |
| `requiredEquipment?` | EquipmentType | `freight_requests.required_equipment_code` | `freight_requests.required_equipment_code` | COMPLETO |
| `preferredEquipment?` | EquipmentType | `freight_requests.preferred_equipment_code` | `freight_requests.preferred_equipment_code` | PARCIAL |
| `selectionObjective?` | RankingObjective | `freight_requests.selection_objective` | `freight_requests.selection_objective` | PARCIAL |

### CargoSpecification — `freight_requests.v2_snapshot.cargoSpecification`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `category` | CargoCategory | `freight_requests.v2_snapshot.cargoSpecification.categoryCode` | `freight_requests.v2_snapshot.cargoSpecification.categoryCode` | COMPLETO |
| `packaging` | PackageType | `freight_requests.v2_snapshot.cargoSpecification.packaging` | `freight_requests.v2_snapshot.cargoSpecification.packaging` | COMPLETO |
| `totalWeightKg` | number | `freight_requests.v2_snapshot.cargoSpecification.totalWeightKg` | `freight_requests.v2_snapshot.cargoSpecification.totalWeightKg` | COMPLETO |
| `totalVolumeM3?` | number | `freight_requests.v2_snapshot.cargoSpecification.totalVolumeM3` | `freight_requests.v2_snapshot.cargoSpecification.totalVolumeM3` | COMPLETO |
| `divisible` | boolean | `freight_requests.v2_snapshot.cargoSpecification.divisible` | `freight_requests.v2_snapshot.cargoSpecification.divisible` | COMPLETO |
| `requirements` | CargoRequirement[] | `freight_requests.v2_snapshot.cargoSpecification.requirements` | `freight_requests.v2_snapshot.cargoSpecification.requirements` | COMPLETO |
| `temperatureRange?` | TemperatureRange | `freight_requests.v2_snapshot.cargoSpecification.temperatureRange` | `freight_requests.v2_snapshot.cargoSpecification.temperatureRange` | COMPLETO |
| `description?` | string | `freight_requests.v2_snapshot.cargoSpecification.description` | `freight_requests.v2_snapshot.cargoSpecification.description` | COMPLETO |
| `availableDocuments` | DocumentRef[] | `freight_requests.v2_snapshot.cargoSpecification.availableDocuments` | `freight_requests.v2_snapshot.cargoSpecification.availableDocuments` | DIVERGENTE |

### CargoUnit — `freight_requests.v2_snapshot.cargoSpecification.units[]`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `packageType` | PackageType | `freight_requests.v2_snapshot.cargoSpecification.units[].packageType` | `freight_requests.v2_snapshot.cargoSpecification.units[].packageType` | COMPLETO |
| `quantity` | number | `freight_requests.v2_snapshot.cargoSpecification.units[].quantity` | `freight_requests.v2_snapshot.cargoSpecification.units[].quantity` | COMPLETO |
| `weightPerUnitKg` | number | `freight_requests.v2_snapshot.cargoSpecification.units[].weightPerUnitKg` | `freight_requests.v2_snapshot.cargoSpecification.units[].weightPerUnitKg` | COMPLETO |
| `volumePerUnitM3?` | number | `freight_requests.v2_snapshot.cargoSpecification.units[].volumePerUnitM3` | `freight_requests.v2_snapshot.cargoSpecification.units[].volumePerUnitM3` | COMPLETO |
| `dimensions` | Dimensions | `freight_requests.v2_snapshot.cargoSpecification.units[].dimensionsCm` | `freight_requests.v2_snapshot.cargoSpecification.units[].dimensionsCm` | COMPLETO |
| `indivisible` | boolean | `freight_requests.v2_snapshot.cargoSpecification.units[].indivisible` | `freight_requests.v2_snapshot.cargoSpecification.units[].indivisible` | COMPLETO |
| `stackable?` | boolean | `freight_requests.v2_snapshot.cargoSpecification.units[].stackable` | `freight_requests.v2_snapshot.cargoSpecification.units[].stackable` | COMPLETO |
| `unitsPerPackage?` | number | `freight_requests.v2_snapshot.cargoSpecification.units[].unitsPerPackage` | `freight_requests.v2_snapshot.cargoSpecification.units[].unitsPerPackage` | PARCIAL |

### Carrier — `carriers`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `id` | UUID | `carriers.id` | `carriers.id` | COMPLETO |
| `code` | string | `carriers.code` | `carriers.code` | COMPLETO |
| `commercialName` | string | `carriers.name` | `carriers.name` | COMPLETO |
| `legalName?` | string | `carriers.legal_name` | `carriers.legal_name` | COMPLETO |
| `businessIdType?` | string | `carriers.business_identifier_type` | `carriers.business_identifier_type` | COMPLETO |
| `businessIdValue?` | string | `carriers.business_identifier_value` | `carriers.business_identifier_value` | COMPLETO |
| `registeredCountry?` | string | `carriers.registered_country` | `carriers.registered_country` | COMPLETO |
| `verifiedContact?` | Contact | `carriers.verified_contact` | `carriers.verified_contact` | PARCIAL |
| `providerType` | ProviderType | `carriers.provider_type` | `carriers.provider_type` | COMPLETO |
| `status` | CarrierStatus | `carriers.status` | `carriers.status` | COMPLETO |
| `operationalPhone?` | E164Phone | `carriers.operational_phone` | `carriers.operational_phone` | COMPLETO |

### CarrierDepot — `carrier_depots`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `id` | UUID | `carrier_depots.id` | `carrier_depots.id` | COMPLETO |
| `code` | string | `carrier_depots.code` | `carrier_depots.code` | COMPLETO |
| `location` | GeoLocation | `carrier_depots.address_line; carrier_depots.country_code; carrier_depots.region_code; carrier_depots.city; carrier_depots.latitude; carrier_depots.longitude` | `carrier_depots.{address_line,country_code,region_code,city,latitude,longitude}` | COMPLETO |
| `active` | boolean | `carrier_depots.active` | `carrier_depots.active` | COMPLETO |
| `handling?` | HandlingCapability[] | `carrier_depots.handling` | `carrier_depots.handling` | COMPLETO |

### CarrierService — `carrier_services`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `id` | UUID | `carrier_services.id` | `carrier_services.id` | COMPLETO |
| `mode` | TransportMode | `carrier_services.transport_mode` | `carrier_services.transport_mode` | COMPLETO |
| `serviceClass` | ServiceClass | `carrier_services.service_type` | `carrier_services.service_type` | COMPLETO |
| `maxWeightKg?` | number | `carrier_services.max_capacity_kg` | `carrier_services.max_capacity_kg` | COMPLETO |
| `maxVolumeM3?` | number | `carrier_services.max_volume_m3` | `carrier_services.max_volume_m3` | COMPLETO |
| `responseChannels` | ResponseChannel[] | `carrier_services.response_channels` | `carrier_services.response_channels` | COMPLETO |
| `status` | ServiceStatus | `carrier_services.active` | `carrier_services.active; ACTIVE/INACTIVE projection` | COMPLETO |
| `admittedCargoTypes` | CargoCategory[] | `carrier_service_cargo_categories.cargo_category_id` | `carrier_services.carrier_service_cargo_categories.cargo_category_id` | COMPLETO |
| `temperatureRange?` | TemperatureRange | `carrier_services.temperature_min_c; carrier_services.temperature_max_c` | `carrier_services.{temperature_min_c,temperature_max_c}` | PARCIAL |
| `requiredCertifications` | Certification[] | `carrier_services.required_certifications` | `carrier_services.required_certifications` | COMPLETO |

### ServiceLane — `service_lanes`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `kind` | DIRECT / WITHIN_AREA | `service_lanes.lane_kind` | `service_lanes.lane_kind` | COMPLETO |
| `mode` | TransportMode | `service_lanes.transport_mode` | `service_lanes.transport_mode` | COMPLETO |
| `borderReviewRequired` | boolean | `service_lanes.cross_border_review_required` | `service_lanes.cross_border_review_required` | COMPLETO |
| `evidence?` | EvidenceRef | `service_lanes.evidence_reference` | `service_lanes.evidence_reference` | COMPLETO |
| `validUntil?` | Instant | `service_lanes.valid_until` | `service_lanes.valid_until` | COMPLETO |

### ResponseIntegration — `response_integrations`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `channel` | MANUAL / API / MCP | `response_integrations.channel` | `response_integrations.channel` | FALTANTE |
| `endpointRef?` | SecretRef | `response_integrations.endpoint_ref` | `response_integrations.endpoint_ref` | FALTANTE |
| `verifiedAt?` | Instant | `response_integrations.verified_at` | `response_integrations.verified_at` | FALTANTE |
| `status` | IntegrationStatus | `response_integrations.status` | `response_integrations.status` | FALTANTE |
| `evidence?` | EvidenceRef | `response_integrations.evidence` | `response_integrations.evidence` | FALTANTE |

### CapacitySource — `|capacity_source_projection`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `sourceId` | UUID | `/capacity_source_projection.sourceId` | `/capacity_source_projection.sourceId` | PARCIAL |
| `provenance` | FulfilmentSource | `/capacity_source_projection.provenance` | `/capacity_source_projection.provenance` | PARCIAL |

### TransportAsset — `transport_assets`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `id` | UUID | `transport_assets.id` | `transport_assets.id` | COMPLETO |
| `code` | string | `transport_assets.code` | `transport_assets.code` | COMPLETO |
| `equipmentType` | EquipmentType | `transport_assets.equipment_code` | `transport_assets.equipment_code` | COMPLETO |
| `usefulCapacityKg` | number | `transport_assets.max_weight_kg` | `transport_assets.max_weight_kg` | DIVERGENTE |
| `usableVolumeM3?` | number | `transport_assets.max_volume_m3` | `transport_assets.max_volume_m3` | COMPLETO |
| `operatingStatus` | AssetStatus | `transport_assets.operating_status` | `transport_assets.operating_status` | COMPLETO |
| `homeDepot?` | CarrierDepot | `transport_assets.home_depot_id` | `transport_assets.home_depot_id` | COMPLETO |

### RoadVehicle — `transport_assets`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `plate` | string | `transport_assets.plate` | `transport_assets.plate` | DIVERGENTE |
| `registrationCode?` | string | `transport_assets.registration_code` | `transport_assets.registration_code` | COMPLETO |
| `registeredAt?` | LocalDate | `transport_assets.registered_at` | `transport_assets.registered_at` | COMPLETO |
| `brand?` | string | `transport_assets.brand` | `transport_assets.brand` | COMPLETO |
| `model?` | string | `transport_assets.model` | `transport_assets.model` | COMPLETO |
| `variant?` | string | `transport_assets.variant` | `transport_assets.variant` | PARCIAL |
| `bodyType` | VehicleBodyType | `transport_assets.body_type` | `transport_assets.body_type` | DIVERGENTE |
| `usableDimensions?` | Dimensions | `transport_assets.usable_dimensions` | `transport_assets.usable_dimensions` | COMPLETO |
| `grossWeightLimitKg?` | number | `transport_assets.gross_weight_limit_kg` | `transport_assets.gross_weight_limit_kg` | COMPLETO |
| `odometerKm?` | number | `transport_assets.odometer_km` | `transport_assets.odometer_km` | COMPLETO |
| `conditionReason?` | AssetConditionReason | `transport_assets.condition_reason` | `transport_assets.condition_reason` | PARCIAL |

### CapacityPool — `capacity_pools`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `id` | UUID | `capacity_pools.id` | `capacity_pools.id` | COMPLETO |
| `mode` | TransportMode | `capacity_pools.mode` | `capacity_pools.mode` | DIVERGENTE |
| `serviceWindow` | TimeWindow | `capacity_pools.starts_at; capacity_pools.ends_at` | `capacity_pools.{starts_at,ends_at}` | DIVERGENTE |
| `declaredCapacity` | Capacity | `capacity_pools.max_weight_kg; capacity_pools.max_volume_m3` | `capacity_pools.{max_weight_kg,max_volume_m3}` | COMPLETO |
| `partner` | FulfilmentSource | `capacity_pools.fulfilment_source` | `capacity_pools.fulfilment_source` | DIVERGENTE |
| `evidence` | EvidenceRef | `capacity_pools.evidence` | `capacity_pools.evidence` | DIVERGENTE |

### CapacityCalendar — `capacity_calendars`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `timezone` | TimeZone | `capacity_calendars.timezone` | `capacity_calendars.timezone` | DIVERGENTE |
| `horizon` | TimeWindow | `capacity_calendars.horizon_starts_at; capacity_calendars.horizon_ends_at` | `capacity_calendars.{horizon_starts_at,horizon_ends_at}` | DIVERGENTE |
| `source` | DataSource | `capacity_calendars.source` | `capacity_calendars.source` | DIVERGENTE |
| `lastVerifiedAt?` | Instant | `capacity_calendars.last_verified_at` | `capacity_calendars.last_verified_at` | COMPLETO |
| `freshness` | EvidenceStatus | `capacity_calendars.freshness` | `capacity_calendars.freshness` | DIVERGENTE |

### CapacityReservation — `capacity_reservations`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `occupiedWindow` | TimeWindow | `capacity_reservations.starts_at; capacity_reservations.ends_at` | `capacity_reservations.{starts_at,ends_at}` | COMPLETO |
| `committedCapacity` | Capacity | `capacity_reservations.committed_capacity` | `capacity_reservations.committed_capacity` | PARCIAL |
| `status` | ReservationStatus | `capacity_reservations.status` | `capacity_reservations.status` | COMPLETO |
| `reference` | string | `capacity_reservations.reference` | `capacity_reservations.reference` | PARCIAL |
| `source` | DataSource | `capacity_reservations.source` | `capacity_reservations.source` | PARCIAL |
| `id` | UUID | `capacity_reservations.id` | `capacity_reservations.id` | COMPLETO |
| `planResourceId?` | UUID | `capacity_reservations.plan_assignment_id` | `capacity_reservations.plan_resource_id` | DIVERGENTE |

### ScheduledMaintenance — `scheduled_maintenances`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `blockedWindow` | TimeWindow | `scheduled_maintenances.starts_at; scheduled_maintenances.ends_at` | `scheduled_maintenances.{starts_at,ends_at}` | COMPLETO |
| `kind` | MaintenanceType | `scheduled_maintenances.kind` | `scheduled_maintenances.kind` | DIVERGENTE |
| `status` | MaintenanceStatus | `scheduled_maintenances.status` | `scheduled_maintenances.status` | COMPLETO |
| `source` | DataSource | `scheduled_maintenances.source` | `scheduled_maintenances.source` | DIVERGENTE |

### Driver — `drivers`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `id` | UUID | `drivers.id` | `drivers.id` | COMPLETO |
| `fullName` | string | `drivers.full_name` | `drivers.full_name` | COMPLETO |
| `portalAccount?` | CarrierOperator | `drivers.carrier_operator_id` | `drivers.carrier_operator_id` | PARCIAL |
| `licenseClass` | LicenseClass | `drivers.license_class` | `drivers.license_class` | COMPLETO |
| `licenseValidUntil` | LocalDate | `drivers.license_valid_until` | `drivers.license_valid_until` | COMPLETO |
| `qualifications` | Qualification[] | `drivers.qualifications` | `drivers.qualifications` | COMPLETO |
| `experienceYears?` | number | `drivers.experience_years` | `drivers.experience_years` | COMPLETO |
| `dutyStatus` | DutyStatus | `drivers.duty_status` | `drivers.duty_status` | COMPLETO |

### DriverAssignment — `driver_assignments`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `window` | TimeWindow | `driver_assignments.starts_at; driver_assignments.ends_at` | `driver_assignments.{starts_at,ends_at}` | COMPLETO |
| `role` | PRIMARY / RELIEF | `driver_assignments.role` | `driver_assignments.role` | COMPLETO |
| `status` | AssignmentStatus | `driver_assignments.status` | `driver_assignments.status` | COMPLETO |
| `evidence?` | EvidenceRef | `driver_assignments.evidence` | `driver_assignments.evidence` | COMPLETO |

### VehicleAssignment — `vehicle_assignments`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `window` | TimeWindow | `vehicle_assignments.starts_at; vehicle_assignments.ends_at` | `vehicle_assignments.{starts_at,ends_at}` | COMPLETO |
| `status` | AssignmentStatus | `vehicle_assignments.status` | `vehicle_assignments.status` | COMPLETO |
| `capacityCommitted` | Capacity | `vehicle_assignments.capacity_committed` | `vehicle_assignments.capacity_committed` | COMPLETO |
| `evidence?` | EvidenceRef | `vehicle_assignments.evidence` | `vehicle_assignments.evidence` | COMPLETO |

### AssetStatusEvent — `asset_status_events`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `at` | Instant | `asset_status_events.data.at` | `asset_status_events.at` | PARCIAL |
| `previous` | AssetStatus | `asset_status_events.data.previous` | `asset_status_events.previous` | PARCIAL |
| `next` | AssetStatus | `asset_status_events.data.next` | `asset_status_events.next` | PARCIAL |
| `reason` | AssetConditionReason | `asset_status_events.data.reason` | `asset_status_events.reason` | PARCIAL |
| `evidence?` | EvidenceRef | `asset_status_events.data.evidence` | `asset_status_events.evidence` | PARCIAL |

### RoutePlan — `route_plans`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `origin` | GeoLocation | `route_plans.data.origin` | `route_plans.origin` | COMPLETO |
| `destination` | GeoLocation | `route_plans.data.destination` | `route_plans.destination` | COMPLETO |
| `estimatedDistanceKm?` | number | `route_plans.data.estimatedDistanceKm` | `route_plans.estimated_distance_km` | COMPLETO |
| `estimatedDuration?` | Duration | `route_plans.data.estimatedDurationSeconds` | `route_plans.estimated_duration_seconds` | COMPLETO |
| `geographicSource` | DataSource | `route_plans.data.geographicSource` | `route_plans.geographic_source` | COMPLETO |
| `confidence` | EvidenceStatus | `route_plans.data.confidence` | `route_plans.confidence` | COMPLETO |
| `estimatedTolls?` | Money | `route_plans.data.estimatedTolls` | `route_plans.estimated_tolls` | PARCIAL |
| `borderCostEstimate?` | Money | `route_plans.data.borderCostEstimate` | `route_plans.border_cost_estimate` | PARCIAL |

### RouteLeg — `route_legs`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `sequence` | number | `route_legs.sequence` | `route_legs.sequence` | COMPLETO |
| `mode` | TransportMode | `route_legs.data.mode` | `route_legs.mode` | COMPLETO |
| `origin` | GeoLocation | `route_legs.data.origin` | `route_legs.origin` | COMPLETO |
| `destination` | GeoLocation | `route_legs.data.destination` | `route_legs.destination` | COMPLETO |
| `borderRequirements` | Rule[] | `route_legs.data.borderRequirements` | `route_legs.border_requirements` | PARCIAL |
| `estimatedDistanceKm?` | number | `route_legs.data.estimatedDistanceKm` | `route_legs.estimated_distance_km` | COMPLETO |
| `estimatedDuration?` | Duration | `route_legs.data.estimatedDurationSeconds` | `route_legs.estimated_duration_seconds` | COMPLETO |

### RouteCondition — `route_conditions`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `kind` | CLOSURE / DELAY / HAZARD / RESTRICTION | `route_conditions.kind` | `route_conditions.kind` | COMPLETO |
| `location` | GeoLocation | `route_conditions.data.location` | `route_conditions.location` | COMPLETO |
| `observedAt` | Instant | `route_conditions.data.observedAt` | `route_conditions.observed_at` | COMPLETO |
| `validUntil?` | Instant | `route_conditions.data.validUntil` | `route_conditions.valid_until` | COMPLETO |
| `source` | DataSource | `route_conditions.data.source` | `route_conditions.source` | COMPLETO |
| `confidence` | EvidenceStatus | `route_conditions.data.confidence` | `route_conditions.confidence` | COMPLETO |

### RouteWaypoint — `route_waypoints`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `kind` | FUEL / REST / BORDER / TRANSFER | `route_waypoints.data.kind` | `route_waypoints.kind` | COMPLETO |
| `location` | GeoLocation | `route_waypoints.data.location` | `route_waypoints.location` | COMPLETO |
| `sequence` | number | `route_waypoints.sequence` | `route_waypoints.sequence` | PARCIAL |
| `source` | DataSource | `route_waypoints.data.source` | `route_waypoints.source` | COMPLETO |
| `verifiedAt?` | Instant | `route_waypoints.data.verifiedAt` | `route_waypoints.verified_at` | COMPLETO |

### RoutePlanningPolicy — `route_planning_policies`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `version` | string | `route_planning_policies.data.version` | `route_planning_policies.version` | COMPLETO |
| `objective` | RouteObjective | `route_planning_policies.data.objective` | `route_planning_policies.objective` | COMPLETO |
| `constraints` | Rule[] | `route_planning_policies.data.constraints` | `route_planning_policies.constraints` | PARCIAL |
| `weights` | WeightSet | `route_planning_policies.data.weights` | `route_planning_policies.weights` | COMPLETO |
| `missingDataRule` | Rule | `route_planning_policies.data.missingDataRule` | `route_planning_policies.missing_data_rule` | COMPLETO |

### TransportPlanCandidate — `transport_plan_candidates`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `proposedWindow` | TimeWindow | `transport_plan_candidates.data.proposedWindow` | `transport_plan_candidates.{starts_at,ends_at}` | COMPLETO |
| `coverage` | EvidenceStatus | `transport_plan_candidates.data.coverage` | `transport_plan_candidates.coverage` | COMPLETO |
| `availability` | EvidenceStatus | `transport_plan_candidates.data.availability` | `transport_plan_candidates.availability` | COMPLETO |
| `pendingRequirements` | Rule[] | `transport_plan_candidates.data.pendingRequirements` | `transport_plan_candidates.pending_requirements` | PARCIAL |
| `exclusionReasons` | ReasonCode[] | `transport_plan_candidates.data.exclusionReasons` | `transport_plan_candidates.exclusion_reasons` | PARCIAL |
| `id` | UUID | `transport_plan_candidates.id` | `transport_plan_candidates.id` | COMPLETO |

### PlanResource — `plan_resources`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `role` | LOAD_BEARING / AUXILIARY | `plan_resources.data.role` | `plan_resources.role` | COMPLETO |
| `equipment` | EquipmentType | `plan_resources.data.equipment` | `plan_resources.equipment` | DIVERGENTE |
| `units` | number | `plan_resources.data.units` | `plan_resources.units` | COMPLETO |
| `window` | TimeWindow | `plan_resources.data.window` | `plan_resources.{starts_at,ends_at}` | COMPLETO |
| `availability` | EvidenceStatus | `plan_resources.data.availability` | `plan_resources.availability` | COMPLETO |
| `applicableCapacity?` | Capacity | `plan_resources.data.applicableCapacity` | `plan_resources.applicable_capacity` | COMPLETO |
| `verificationSource?` | EvidenceRef | `plan_resources.data.verificationSource` | `plan_resources.verification_source` | COMPLETO |
| `id` | UUID | `plan_resources.id` | `plan_resources.id` | COMPLETO |

### CarrierOpportunity — `carrier_opportunities`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `sentAt` | Instant | `carrier_opportunities.data.sentAt` | `carrier_opportunities.sent_at` | COMPLETO |
| `responseDeadline` | Instant | `carrier_opportunities.data.responseDeadline` | `carrier_opportunities.response_deadline` | COMPLETO |
| `responseChannel` | ResponseChannel | `carrier_opportunities.data.responseChannel` | `carrier_opportunities.response_channel` | COMPLETO |
| `status` | OpportunityStatus | `carrier_opportunities.status` | `carrier_opportunities.status` | COMPLETO |

### CarrierOffer — `v2_carrier_offers`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `carrierReference` | string | `v2_carrier_offers.data.carrierReference` | `v2_carrier_offers.carrier_reference` | COMPLETO |
| `price` | Money | `v2_carrier_offers.data.price` | `v2_carrier_offers.price` | COMPLETO |
| `breakdown` | OfferCostComponent[] | `v2_carrier_offers.data.breakdown` | `v2_carrier_offers.breakdown` | COMPLETO |
| `validity` | TimeWindow | `v2_carrier_offers.data.validity` | `v2_carrier_offers.{valid_from,valid_until}` | COMPLETO |
| `source` | OfferSource | `v2_carrier_offers.data.source` | `v2_carrier_offers.source` | COMPLETO |
| `status` | OfferStatus | `v2_carrier_offers.status` | `v2_carrier_offers.status` | COMPLETO |
| `id` | UUID | `v2_carrier_offers.id` | `v2_carrier_offers.id` | COMPLETO |
| `issuedAt` | Instant | `v2_carrier_offers.data.issuedAt` | `v2_carrier_offers.issued_at` | COMPLETO |
| `estimatedPickupAt?` | Instant | `v2_carrier_offers.data.estimatedPickupAt` | `v2_carrier_offers.estimated_pickup_at` | PARCIAL |
| `estimatedDeliveryAt?` | Instant | `v2_carrier_offers.data.estimatedDeliveryAt` | `v2_carrier_offers.estimated_delivery_at` | PARCIAL |
| `transitDuration?` | Duration | `v2_carrier_offers.data.transitDurationSeconds` | `v2_carrier_offers.transit_duration_seconds` | COMPLETO |
| `reservableCapacity?` | Capacity | `v2_carrier_offers.data.reservableCapacity` | `v2_carrier_offers.reservable_capacity` | COMPLETO |
| `commercialTerms` | Term[] | `v2_carrier_offers.data.commercialTerms` | `v2_carrier_offers.commercial_terms` | PARCIAL |
| `evidence` | EvidenceRef[] | `v2_carrier_offers.data.evidence` | `v2_carrier_offers.evidence` | COMPLETO |
| `offerVersion` | number | `v2_carrier_offers.data.offerVersion` | `v2_carrier_offers.offer_version` | COMPLETO |
| `supersedesOfferId?` | UUID | `v2_carrier_offers.supersedes_offer_id` | `v2_carrier_offers.supersedes_offer_id` | PARCIAL |
| `requestId` | UUID | `v2_carrier_offers.freight_request_id` | `v2_carrier_offers.request_id` | PARCIAL |
| `planCandidateId` | UUID | `v2_carrier_offers.plan_id` | `v2_carrier_offers.plan_candidate_id` | COMPLETO |
| `opportunityId` | UUID | `v2_carrier_offers.parent_id` | `v2_carrier_offers.opportunity_id` | PARCIAL |
| `carrierId` | UUID | `v2_carrier_offers.carrier_id` | `v2_carrier_offers.carrier_id` | PARCIAL |
| `coveredServiceIds` | UUID[] | `v2_carrier_offers.data.coveredServiceIds` | `v2_carrier_offers.v2_offer_services.service_id` | COMPLETO |
| `coveredAssignmentIds` | UUID[] | `v2_carrier_offers.data.coveredAssignmentIds` | `v2_carrier_offers.v2_offer_assignments.assignment_id` | COMPLETO |

### RankedOption — `ranked_options`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `position` | number | `ranked_options.position` | `ranked_options.position` | PARCIAL |
| `score?` | number | `ranked_options.score` | `ranked_options.score` | COMPLETO |
| `explanation` | Explanation | `ranked_options.data.explanation` | `ranked_options.explanation` | COMPLETO |
| `missingData` | MissingDatum[] | `ranked_options.data.missingData` | `ranked_options.missing_data` | PARCIAL |
| `policyVersion` | string | `ranked_options.data.policyVersion` | `ranked_options.policy_version` | COMPLETO |

### ScoringPolicy — `scoring_policies`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `version` | string | `scoring_policies.version` | `scoring_policies.version` | COMPLETO |
| `objective` | RankingObjective | `scoring_policies.data.policy.objective` | `scoring_policies.objective` | COMPLETO |
| `weights` | WeightSet | `scoring_policies.data.policy.weights` | `scoring_policies.weights` | COMPLETO |
| `missingDataRule` | Rule | `scoring_policies.data.policy.missingDataRule` | `scoring_policies.missing_data_rule` | COMPLETO |
| `tieBreaker` | TieBreaker | `scoring_policies.data.policy.tieBreaker` | `scoring_policies.tie_breaker` | COMPLETO |

### Booking — `v2_bookings`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `carrierReference?` | string | `v2_bookings.data.carrierReference` | `v2_bookings.carrier_reference` | PARCIAL |
| `confirmedAt?` | Instant | `v2_bookings.data.confirmedAt` | `v2_bookings.confirmed_at` | PARCIAL |
| `id` | UUID | `v2_bookings.id` | `v2_bookings.id` | COMPLETO |
| `selectionDecisionId` | UUID | `v2_bookings.decision_id` | `v2_bookings.selection_decision_id` | PARCIAL |
| `authorizedAt?` | Instant | `v2_bookings.data.authorizedAt` | `v2_bookings.authorized_at` | COMPLETO |
| `authorizationStatus` | AuthorizationStatus | `v2_bookings.data.authorizationStatus` | `v2_bookings.authorization_status` | COMPLETO |
| `carrierConfirmationStatus` | CarrierConfirmationStatus | `v2_bookings.data.carrierConfirmationStatus` | `v2_bookings.carrier_confirmation_status` | COMPLETO |
| `capacityEvidence` | EvidenceRef[] | `v2_bookings.data.capacityEvidence` | `v2_bookings.capacity_evidence` | PARCIAL |

### TransportExecution — `transport_executions`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `id` | UUID | `transport_executions.id` | `transport_executions.id` | COMPLETO |
| `status` | ExecutionStatus | `transport_executions.status` | `transport_executions.status` | COMPLETO |
| `plannedWindow` | TimeWindow | `transport_executions.planned_starts_at; transport_executions.planned_ends_at` | `transport_executions.{planned_starts_at,planned_ends_at}` | COMPLETO |
| `actualStartedAt?` | Instant | `transport_executions.actual_started_at` | `transport_executions.actual_started_at` | PARCIAL |
| `actualCompletedAt?` | Instant | `transport_executions.actual_completed_at` | `transport_executions.actual_completed_at` | PARCIAL |
| `lastKnownPosition?` | GeoLocation | `transport_executions.last_known_position` | `transport_executions.last_known_position` | PARCIAL |

### OperationalIncident — `operational_incidents`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `id` | UUID | `operational_incidents.id` | `operational_incidents.id` | COMPLETO |
| `kind` | IncidentKind | `operational_incidents.kind` | `operational_incidents.kind` | COMPLETO |
| `severity` | Severity | `operational_incidents.data.severity` | `operational_incidents.severity` | COMPLETO |
| `occurredAt` | Instant | `operational_incidents.data.occurredAt` | `operational_incidents.occurred_at` | COMPLETO |
| `location?` | GeoLocation | `operational_incidents.data.location` | `operational_incidents.location` | COMPLETO |
| `description` | string | `operational_incidents.data.description` | `operational_incidents.description` | COMPLETO |
| `status` | IncidentStatus | `operational_incidents.status` | `operational_incidents.status` | COMPLETO |
| `reportedBy` | ActorRef | `operational_incidents.data.reportedBy` | `operational_incidents.reported_by` | COMPLETO |
| `evidence` | EvidenceRef[] | `operational_incidents.data.evidence` | `operational_incidents.evidence` | COMPLETO |

### IncidentUpdate — `incident_updates`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `at` | Instant | `incident_updates.data.at` | `incident_updates.at` | PARCIAL |
| `actor` | ActorRef | `incident_updates.data.actorId` | `incident_updates.actor` | PARCIAL |
| `action` | IncidentAction | `incident_updates.data.action` | `incident_updates.action` | PARCIAL |
| `note` | string | `incident_updates.data.note` | `incident_updates.note` | PARCIAL |
| `evidence?` | EvidenceRef | `incident_updates.data.evidence` | `incident_updates.evidence` | PARCIAL |

### LogisticsNode — `logistics_nodes`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `id` | UUID | `logistics_nodes.id` | `logistics_nodes.id` | COMPLETO |
| `kind` | PORT / TERMINAL / BORDER / HUB | `logistics_nodes.kind` | `logistics_nodes.kind` | COMPLETO |
| `name` | string | `logistics_nodes.data.name` | `logistics_nodes.name` | COMPLETO |
| `location` | GeoLocation | `logistics_nodes.data.location` | `logistics_nodes.location` | COMPLETO |
| `jurisdiction?` | string | `logistics_nodes.data.jurisdiction` | `logistics_nodes.jurisdiction` | COMPLETO |
| `source` | DataSource | `logistics_nodes.data.source` | `logistics_nodes.source` | COMPLETO |
| `verifiedAt?` | Instant | `logistics_nodes.data.verifiedAt` | `logistics_nodes.verified_at` | COMPLETO |

### RouteCorridor — `route_corridors`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `id` | UUID | `route_corridors.id` | `route_corridors.id` | COMPLETO |
| `mode` | TransportMode | `route_corridors.data.mode` | `route_corridors.mode` | COMPLETO |
| `estimatedDistanceKm?` | number | `route_corridors.data.estimatedDistanceKm` | `route_corridors.estimated_distance_km` | COMPLETO |
| `estimatedDuration?` | Duration | `route_corridors.data.estimatedDurationSeconds` | `route_corridors.estimated_duration_seconds` | COMPLETO |
| `restrictions` | Rule[] | `route_corridors.data.restrictions` | `route_corridors.restrictions` | PARCIAL |
| `source` | DataSource | `route_corridors.data.source` | `route_corridors.source` | COMPLETO |
| `version` | string | `route_corridors.data.version` | `route_corridors.version` | COMPLETO |
| `validUntil?` | Instant | `route_corridors.data.validUntil` | `route_corridors.valid_until` | COMPLETO |

### CargoProfile — `organization_cargo_profiles`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `id` | UUID | `organization_cargo_profiles.id` | `organization_cargo_profiles.id` | COMPLETO |
| `name` | string | `organization_cargo_profiles.profile_name` | `organization_cargo_profiles.profile_name` | COMPLETO |
| `typicalUnits` | CargoUnitTemplate[] | `organization_cargo_profiles.typical_units` | `organization_cargo_profiles.typical_units` | COMPLETO |
| `requirements` | CargoRequirement[] | `organization_cargo_profiles.requirements` | `organization_cargo_profiles.requirements` | COMPLETO |
| `preferredEquipment?` | EquipmentType | `organization_cargo_profiles.preferred_equipment` | `organization_cargo_profiles.preferred_equipment` | COMPLETO |
| `updatedAt` | Instant | `organization_cargo_profiles.updated_at` | `organization_cargo_profiles.updated_at` | COMPLETO |

### CargoCategory — `cargo_categories`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `code` | string | `cargo_categories.code` | `cargo_categories.code` | COMPLETO |
| `name` | string | `cargo_categories.name` | `cargo_categories.name` | COMPLETO |
| `guidance` | IntakeGuidance | `cargo_categories.recommended_entry_methods; cargo_categories.intake_specification_schema; cargo_categories.suggested_requirements; cargo_categories.recommended_vehicle_classes` | `cargo_categories.{recommended_entry_methods,intake_specification_schema,suggested_requirements,recommended_vehicle_classes}` | COMPLETO |
| `suggestedEquipment?` | EquipmentType | `cargo_categories.suggested_equipment` | `cargo_categories.suggested_equipment` | COMPLETO |
| `version` | string | `cargo_categories.version` | `cargo_categories.version; integer command revision rendered as a string when required` | DIVERGENTE |

### LoadAllocation — `load_allocations`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `quantity` | number | `load_allocations.quantity` | `load_allocations.quantity` | COMPLETO |
| `assignedWeightKg` | number | `load_allocations.assigned_weight_kg` | `load_allocations.assigned_weight_kg` | COMPLETO |
| `assignedVolumeM3?` | number | `load_allocations.assigned_volume_m3` | `load_allocations.assigned_volume_m3` | COMPLETO |
| `handlingRequirements` | Rule[] | `load_allocations.data.handlingRequirements` | `load_allocations.handling_requirements` | PARCIAL |
| `verification` | EvidenceStatus | `load_allocations.data.verification` | `load_allocations.verification` | COMPLETO |

### OrganizationMember — `organization_members`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `id` | MemberId | `organization_members.id` | `organization_members.id` | PARCIAL |
| `role` | OrganizationRole | `organization_members.role` | `organization_members.role` | PARCIAL |
| `status` | MemberStatus | `organization_members.status` | `organization_members.status` | PARCIAL |
| `contactRef?` | ContactRef | `organization_members.corporate_email` | `organization_members.{corporate_email,contact_ref}` | PARCIAL |
| `verifiedAt?` | Instant | `organization_members.verified_at` | `organization_members.verified_at` | FALTANTE |

### McpAccountLink — `mcp_account_links`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `id` | UUID | `mcp_account_links.id` | `mcp_account_links.id` | PARCIAL |
| `authUserId` | UUID | `mcp_account_links.auth_user_id` | `mcp_account_links.auth_user_id` | PARCIAL |
| `oauthClientId` | string | `mcp_account_links.oauth_client_id` | `mcp_account_links.oauth_client_id` | PARCIAL |
| `organizationId` | UUID | `mcp_account_links.organization_id` | `mcp_account_links.organization_id` | PARCIAL |
| `scopes` | string[] | `mcp_account_links.scopes` | `mcp_account_links.scopes` | PARCIAL |
| `provider` | ALEXA_PLUS / OTHER | `mcp_account_links.provider` | `mcp_account_links.provider` | FALTANTE |
| `externalSubjectRef` | OpaqueId | `mcp_account_links.external_subject_ref` | `mcp_account_links.external_subject_ref` | FALTANTE |
| `status` | LinkStatus | `mcp_account_links.status` | `mcp_account_links.status` | PARCIAL |
| `verifiedAt` | Instant | `mcp_account_links.verified_at` | `mcp_account_links.verified_at` | FALTANTE |
| `revokedAt?` | Instant | `mcp_account_links.revoked_at` | `mcp_account_links.revoked_at` | PARCIAL |
| `expiresAt?` | Instant | `mcp_account_links.expires_at` | `mcp_account_links.expires_at` | PARCIAL |

### RepositioningBlock — `repositioning_blocks`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `occupiedWindow` | TimeWindow | `repositioning_blocks.starts_at; repositioning_blocks.ends_at` | `repositioning_blocks.{starts_at,ends_at}` | COMPLETO |
| `origin` | GeoLocation | `repositioning_blocks.origin` | `repositioning_blocks.origin` | DIVERGENTE |
| `nextPickup` | GeoLocation | `repositioning_blocks.next_pickup` | `repositioning_blocks.next_pickup` | DIVERGENTE |
| `estimatedTravel` | Duration | `repositioning_blocks.estimated_travel_seconds` | `repositioning_blocks.estimated_travel_seconds` | PARCIAL |
| `status` | BlockStatus | `repositioning_blocks.status` | `repositioning_blocks.status` | COMPLETO |
| `source` | DataSource | `repositioning_blocks.source` | `repositioning_blocks.source` | DIVERGENTE |

### OrganizationPreferences — `organization_preferences`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `objective?` | RankingObjective | `organization_preferences.objective` | `organization_preferences.objective` | COMPLETO |
| `maximumWait?` | Duration | `organization_preferences.maximum_wait_minutes` | `organization_preferences.maximum_wait_minutes; explicit minutes in API` | COMPLETO |
| `preferredMode?` | TransportMode | `organization_preferences.preferred_mode` | `organization_preferences.preferred_mode` | COMPLETO |
| `preferredEquipment?` | EquipmentType | `organization_preferences.preferred_equipment` | `organization_preferences.preferred_equipment` | COMPLETO |
| `usualBudget?` | Money | `organization_preferences.usual_budget` | `organization_preferences.usual_budget` | COMPLETO |
| `validUntil?` | Instant | `organization_preferences.valid_until` | `organization_preferences.valid_until` | PARCIAL |

### CarrierMetric — `v2_carrier_metrics`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `period` | TimeWindow | `v2_carrier_metrics.data.period` | `v2_carrier_metrics.{period_starts_at,period_ends_at}` | COMPLETO |
| `corridorRef?` | CorridorId | `v2_carrier_metrics.data.corridorId` | `v2_carrier_metrics.corridor_id` | COMPLETO |
| `mode?` | TransportMode | `v2_carrier_metrics.data.mode` | `v2_carrier_metrics.mode` | COMPLETO |
| `sampleSize` | number | `v2_carrier_metrics.data.sampleSize` | `v2_carrier_metrics.sample_size` | COMPLETO |
| `onTimeRate?` | number | `v2_carrier_metrics.data.onTimeRate` | `v2_carrier_metrics.on_time_rate` | COMPLETO |
| `successfulDeliveryRate?` | number | `v2_carrier_metrics.data.successfulDeliveryRate` | `v2_carrier_metrics.successful_delivery_rate` | COMPLETO |
| `source` | DataSource | `v2_carrier_metrics.data.source` | `v2_carrier_metrics.source` | COMPLETO |

### VehicleCombination — `vehicle_combinations`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `id` | UUID | `vehicle_combinations.id` | `vehicle_combinations.id` | COMPLETO |
| `kind` | CombinationType | `vehicle_combinations.kind` | `vehicle_combinations.kind` | COMPLETO |
| `configuration` | string | `vehicle_combinations.configuration` | `vehicle_combinations.configuration` | COMPLETO |
| `coupledWindow?` | TimeWindow | `vehicle_combinations.starts_at; vehicle_combinations.ends_at` | `vehicle_combinations.{starts_at,ends_at}` | COMPLETO |
| `evidence` | EvidenceRef[] | `vehicle_combinations.evidence` | `vehicle_combinations.evidence` | COMPLETO |
| `combinedTareKg?` | number | `vehicle_combinations.combined_tare_kg` | `vehicle_combinations.combined_tare_kg` | COMPLETO |
| `grossWeightLimitKg?` | number | `vehicle_combinations.gross_weight_limit_kg` | `vehicle_combinations.gross_weight_limit_kg` | COMPLETO |
| `status` | CombinationStatus | `vehicle_combinations.status` | `vehicle_combinations.status` | COMPLETO |

### ServiceArea — `service_areas`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `role` | PICKUP / DELIVERY | `service_areas.area_role` | `service_areas.area_role` | COMPLETO |
| `inclusion` | INCLUDE / EXCLUDE | `service_areas.coverage` | `service_areas.coverage` | COMPLETO |
| `geography` | Geography | `service_areas.granularity; service_areas.country_code; service_areas.region_code; service_areas.city; service_areas.postal_code; service_areas.geometry` | `service_areas.{granularity,country_code,region_code,city,postal_code,geometry}` | COMPLETO |
| `source` | CoverageSource | `service_areas.fulfilment_source; service_areas.fulfilment_partner_id` | `service_areas.{fulfilment_source,fulfilment_partner_id}` | COMPLETO |
| `evidence?` | EvidenceRef | `service_areas.evidence_reference` | `service_areas.evidence_reference` | COMPLETO |
| `validUntil?` | Instant | `service_areas.valid_until` | `service_areas.valid_until` | COMPLETO |
| `verifiedAt?` | Instant | `service_areas.verified_at` | `service_areas.verified_at` | COMPLETO |
| `validFrom?` | Instant | `service_areas.valid_from` | `service_areas.valid_from` | COMPLETO |

### FulfilmentPartner — `fulfilment_partners`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `id` | UUID | `fulfilment_partners.id` | `fulfilment_partners.id` | COMPLETO |
| `registeredName` | string | `fulfilment_partners.registered_name` | `fulfilment_partners.registered_name` | COMPLETO |
| `partnerCarrierRef?` | UUID | `fulfilment_partners.partner_carrier_ref` | `fulfilment_partners.partner_carrier_ref` | PARCIAL |
| `agreementValidFrom` | Instant | `fulfilment_partners.agreement_valid_from` | `fulfilment_partners.agreement_valid_from` | COMPLETO |
| `agreementValidUntil` | Instant | `fulfilment_partners.agreement_valid_until` | `fulfilment_partners.agreement_valid_until` | COMPLETO |
| `status` | PartnerStatus | `fulfilment_partners.status` | `fulfilment_partners.status` | COMPLETO |
| `coverageEvidence` | EvidenceRef | `fulfilment_partners.coverage_evidence` | `fulfilment_partners.coverage_evidence` | COMPLETO |

### PlanLegAssignment — `plan_leg_assignments`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `sequence` | number | `plan_leg_assignments.sequence` | `plan_leg_assignments.sequence` | COMPLETO |
| `window` | TimeWindow | `plan_leg_assignments.data.window` | `plan_leg_assignments.{starts_at,ends_at}` | COMPLETO |
| `responsibility` | Responsibility | `plan_leg_assignments.data.responsibility` | `plan_leg_assignments.responsibility` | COMPLETO |
| `coverage` | EvidenceStatus | `plan_leg_assignments.data.coverage` | `plan_leg_assignments.coverage` | COMPLETO |
| `availability` | EvidenceStatus | `plan_leg_assignments.data.availability` | `plan_leg_assignments.availability` | COMPLETO |
| `capacityNeeded` | Capacity | `plan_leg_assignments.data.capacityNeeded` | `plan_leg_assignments.capacity_needed` | COMPLETO |
| `evidence` | EvidenceRef[] | `plan_leg_assignments.data.evidence` | `plan_leg_assignments.evidence` | PARCIAL |
| `id` | UUID | `plan_leg_assignments.id` | `plan_leg_assignments.id` | COMPLETO |

### OfferCostComponent — `v2_carrier_offers.breakdown[]`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `kind` | CostKind | `v2_carrier_offers.data.breakdown[].kind` | `v2_carrier_offers.breakdown[].kind` | COMPLETO |
| `amount?` | Money | `v2_carrier_offers.data.breakdown[].amount` | `v2_carrier_offers.breakdown[].amount` | COMPLETO |
| `treatment` | INCLUDED / QUOTED / ESTIMATED / EXCLUDED / UNKNOWN | `v2_carrier_offers.data.breakdown[].treatment` | `v2_carrier_offers.breakdown[].treatment` | COMPLETO |
| `source` | DataSource | `v2_carrier_offers.data.breakdown[].source` | `v2_carrier_offers.breakdown[].source` | COMPLETO |
| `observedAt` | Instant | `v2_carrier_offers.data.breakdown[].observedAt` | `v2_carrier_offers.breakdown[].observedAt` | COMPLETO |
| `details?` | string | `v2_carrier_offers.data.breakdown[].details` | `v2_carrier_offers.breakdown[].details` | PARCIAL |

### ShipmentContact — `freight_requests.v2_snapshot.contacts`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `role` | PICKUP / RECIPIENT | `freight_requests.v2_snapshot.contacts.{pickup,recipient}` | `freight_requests.v2_snapshot.contacts.{pickup:PICKUP,recipient:RECIPIENT}` | PARCIAL |
| `name` | string | `freight_requests.v2_snapshot.contacts.pickup.name` | `freight_requests.v2_snapshot.contacts.name` | COMPLETO |
| `company?` | string | `freight_requests.v2_snapshot.contacts.pickup.company` | `freight_requests.v2_snapshot.contacts.company` | PARCIAL |
| `phone` | E164Phone | `freight_requests.v2_snapshot.contacts.pickup.phoneE164` | `freight_requests.v2_snapshot.contacts.phoneE164` | COMPLETO |
| `email?` | EmailAddress | `freight_requests.v2_snapshot.contacts.pickup.email` | `freight_requests.v2_snapshot.contacts.email` | COMPLETO |
| `addressDetail?` | string | `freight_requests.v2_snapshot.contacts.pickup.addressDetail` | `freight_requests.v2_snapshot.contacts.addressDetail` | PARCIAL |
| `handlingInstructions?` | string | `freight_requests.v2_snapshot.contacts.pickup.handlingInstructions` | `freight_requests.v2_snapshot.contacts.handlingInstructions` | PARCIAL |

### CarrierOperator — `carrier_operators`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `id` | UUID | `carrier_operators.id` | `carrier_operators.id` | PARCIAL |
| `displayName` | string | `carrier_operators.display_name` | `carrier_operators.display_name` | PARCIAL |
| `role` | CarrierRole | `carrier_operators.role` | `carrier_operators.role` | PARCIAL |
| `email?` | EmailAddress | `carrier_operators.email` | `carrier_operators.email` | PARCIAL |
| `phone?` | E164Phone | `carrier_operators.phone` | `carrier_operators.phone` | PARCIAL |
| `status` | MemberStatus | `carrier_operators.status` | `carrier_operators.status` | PARCIAL |
| `verifiedAt?` | Instant | `carrier_operators.verified_at` | `carrier_operators.verified_at` | PARCIAL |

### AssetCargoCapability — `cargo_capability_definitions`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `requirements` | CargoRequirement[] | `cargo_capability_definitions.requirements` | `cargo_capability_definitions.requirements` | PARCIAL |
| `maxWeightKg?` | number | `cargo_capability_definitions.max_weight_kg` | `cargo_capability_definitions.max_weight_kg` | COMPLETO |
| `temperatureRange?` | TemperatureRange | `cargo_capability_definitions.temperature_range` | `cargo_capability_definitions.temperature_range` | PARCIAL |
| `evidence?` | EvidenceRef | `cargo_capability_definitions.evidence` | `cargo_capability_definitions.evidence` | COMPLETO |
| `validUntil?` | Instant | `cargo_capability_definitions.valid_until` | `cargo_capability_definitions.valid_until` | COMPLETO |

### RouteSimulationScenario — `|scenario_files`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `id` | ScenarioId | `/scenario_files.id` | `/scenario_files.id` | PARCIAL |
| `label` | string | `/scenario_files.label` | `/scenario_files.label` | PARCIAL |
| `seed` | string | `/scenario_files.seed` | `/scenario_files.seed` | PARCIAL |
| `networkVersion` | string | `/scenario_files.networkVersion` | `/scenario_files.networkVersion` | PARCIAL |
| `clock` | Instant | `/scenario_files.clock` | `/scenario_files.clock` | PARCIAL |
| `source` | SYNTHETIC | `/scenario_files.source` | `/scenario_files.source` | PARCIAL |
| `expectedOutcome` | RouteDecision | `/scenario_files.expectedOutcome` | `/scenario_files.expectedOutcome` | PARCIAL |

### RoutePlanner — `|route_planner_port`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `algorithmVersion` | string | `/route_planner_port.algorithmVersion` | `/route_planner_port.algorithmVersion` | FALTANTE |
| `graphVersion` | string | `/route_planner_port.graphVersion` | `/route_planner_port.graphVersion` | FALTANTE |
| `source` | DataSource | `/route_planner_port.source` | `/route_planner_port.source` | FALTANTE |

### SelectionDecision — `selection_decisions`

| UML | Tipo | Destino observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|
| `id` | UUID | `selection_decisions.id` | `selection_decisions.id` | COMPLETO |
| `selectedAt` | Instant | `selection_decisions.data.selectedAt` | `selection_decisions.selected_at` | COMPLETO |
| `rationale` | Explanation | `selection_decisions.data.rationale` | `selection_decisions.rationale` | COMPLETO |
| `policyVersion?` | string | `selection_decisions.data.policyVersion` | `selection_decisions.policy_version` | COMPLETO |
| `consideredOptions` | OptionRef[] | `selection_decisions.data.consideredOfferIds` | `selection_decisions.considered_options` | COMPLETO |
| `status` | DecisionStatus | `selection_decisions.status` | `selection_decisions.status` | COMPLETO |
| `evidence` | EvidenceRef[] | `selection_decisions.data.evidence` | `selection_decisions.evidence` | COMPLETO |
| `selectedPlanId` | UUID | `selection_decisions.plan_id` | `selection_decisions.selected_plan_id` | COMPLETO |
| `selectedOfferIds` | UUID[] | `selection_decisions.data.selectedOfferIds` | `selection_decisions.selection_decision_offers.offer_id` | COMPLETO |

## Relaciones y restricciones

La observación QA y el objetivo previo son históricos. La reconciliación vigente de F-02 se muestra aparte sin sustituir estados independientes.

| Nº | UML | Cardinalidad original | Tratamiento observado QA | Objetivo previo | Estado QA |
|---|---|---|---|---|---|
| 0 | Organization → Facility (registra) | 1 / 0..* | facilities.organization_id -> organizations.id | facilities.organization_id -> organizations.id | COMPLETO |
| 1 | Organization → FreightRequest (presenta) | 1 / 0..* | freight_requests.organization_id -> organizations.id | freight_requests.organization_id -> organizations.id | PARCIAL |
| 2 | Facility → FreightRequest (origen) | 0..1 / 0..* | freight_requests.origin_facility_id -> facilities.id; nullable; same organization | freight_requests.origin_facility_id -> facilities.id; nullable; same organization | COMPLETO |
| 3 | Facility → FreightRequest (destino) | 0..1 / 0..* | freight_requests.destination_facility_id -> facilities.id; nullable; same organization | freight_requests.destination_facility_id -> facilities.id; nullable; same organization | COMPLETO |
| 4 | FreightRequest → CargoSpecification (describe) | 1 / 1 | freight_requests.v2_snapshot.cargoSpecification; exactly one validated object | freight_requests.v2_snapshot.cargoSpecification; exactly one validated object | PARCIAL |
| 5 | CargoSpecification → CargoUnit (contiene al enviar) | 1 / 1..* | cargoSpecification.units[]; stable unit index; nonempty at submission | cargoSpecification.units[]; stable unit index; nonempty at submission | PARCIAL |
| 6 | Carrier → CarrierDepot (opera) | 1 / 0..* | carrier_depots.carrier_id -> carriers.id | carrier_depots.carrier_id -> carriers.id | COMPLETO |
| 7 | Carrier → CarrierService (publica) | 1 / 0..* | carrier_services.carrier_id -> carriers.id | carrier_services.carrier_id -> carriers.id | COMPLETO |
| 8 | CarrierService → ServiceArea (declara) | 1 / 0..* | service_areas.carrier_service_id -> carrier_services.id | service_areas.carrier_service_id -> carrier_services.id | COMPLETO |
| 9 | CarrierService → ServiceLane (declara) | 1 / 0..* | service_lanes.carrier_service_id -> carrier_services.id | service_lanes.carrier_service_id -> carrier_services.id | COMPLETO |
| 10 | ServiceArea → ServiceLane (origen cubierto) | 1 PICKUP / 0..* | service_lanes.pickup_area_id -> service_areas.id; role PICKUP; same service | service_lanes.pickup_area_id -> service_areas.id; role PICKUP; same service | COMPLETO |
| 11 | ServiceArea → ServiceLane (destino cubierto) | 1 DELIVERY / 0..* | service_lanes.delivery_area_id -> service_areas.id; role DELIVERY; same service | service_lanes.delivery_area_id -> service_areas.id; role DELIVERY; same service | COMPLETO |
| 12 | CarrierService → ResponseIntegration (responde por) | 1 / 0..* | response_integrations.carrier_service_id -> carrier_services.id; secret reference only | response_integrations.carrier_service_id -> carrier_services.id; secret reference only | PARCIAL |
| 13 | Carrier → TransportAsset (gestiona) | 1 / 0..* | transport_assets.carrier_id -> carriers.id | transport_assets.carrier_id -> carriers.id | COMPLETO |
| 14 | CarrierDepot → TransportAsset (base física) | 0..1 / 0..* | transport_assets.home_depot_id -> carrier_depots.id; nullable; same carrier | transport_assets.home_depot_id -> carrier_depots.id; nullable; same carrier | COMPLETO |
| 15 | RoadVehicle → TransportAsset (especializa) | herencia/realización | single-table inheritance: mode ROAD; vehicle fields not attached to other modes | single-table inheritance: mode ROAD; vehicle fields not attached to other modes | PARCIAL |
| 16 | TransportAsset → CapacitySource (realiza) | herencia/realización | projection keyed ASSET/id; never independently writable | projection keyed ASSET/id; never independently writable | PARCIAL |
| 17 | CapacityPool → CapacitySource (realiza) | herencia/realización | projection keyed POOL/id; never independently writable | projection keyed POOL/id; never independently writable | PARCIAL |
| 18 | CarrierService → CapacityPool (usa cupo) | 1 / 0..* | capacity_pools.carrier_service_id -> carrier_services.id | capacity_pools.carrier_service_id -> carrier_services.id | COMPLETO |
| 19 | CapacitySource → CapacityCalendar (agenda) | 1 / 0..1 | capacity_calendars XOR transport_asset_id/capacity_pool_id; unique per source | capacity_calendars XOR transport_asset_id/capacity_pool_id; unique per source | PARCIAL |
| 20 | CapacityCalendar → CapacityReservation (registra) | 1 / 0..* | capacity_reservations.capacity_calendar_id -> capacity_calendars.id | capacity_reservations.capacity_calendar_id -> capacity_calendars.id | COMPLETO |
| 21 | TransportAsset → ScheduledMaintenance (bloquea) | 1 / 0..* | scheduled_maintenances.transport_asset_id -> transport_assets.id | scheduled_maintenances.transport_asset_id -> transport_assets.id | COMPLETO |
| 22 | TransportAsset → AssetStatusEvent (historial) | 1 / 0..* | asset_status_events.transport_asset_id -> transport_assets.id; append-only | asset_status_events.transport_asset_id -> transport_assets.id; append-only | PARCIAL |
| 23 | Carrier → Driver (habilita) | 1 / 0..* | drivers.carrier_id -> carriers.id | drivers.carrier_id -> carriers.id | PARCIAL |
| 24 | Driver → DriverAssignment (asignado) | 1 / 0..* | driver_assignments.driver_id -> drivers.id; nonoverlapping active windows | driver_assignments.driver_id -> drivers.id; nonoverlapping active windows | COMPLETO |
| 25 | RoadVehicle → VehicleAssignment (asignado) | 1 / 0..* | vehicle_assignments.transport_asset_id -> transport_assets.id; ROAD; nonoverlapping active windows | vehicle_assignments.transport_asset_id -> transport_assets.id; ROAD; nonoverlapping active windows | COMPLETO |
| 26 | FreightRequest → TransportPlanCandidate (genera) | 1 / 0..* | transport_plan_candidates.freight_request_id | transport_plan_candidates.request_id -> freight_requests.id | COMPLETO |
| 27 | TransportPlanCandidate → RoutePlan (propone) | 1 / 1 | transport_plan_candidates.route_plan_id -> route_plans.id; mandatory; same request | transport_plan_candidates.route_plan_id -> route_plans.id; mandatory; same request | DIVERGENTE |
| 28 | RoutePlan → RouteLeg (contiene) | 1 / 1..* | route_legs.route_plan_id -> route_plans.id; unique sequence; at least one on publication | route_legs.route_plan_id -> route_plans.id; unique sequence; at least one on publication | PARCIAL |
| 29 | RoutePlan → RouteWaypoint (incluye) | 1 / 0..* | route_waypoints.route_leg_id -> route_legs.id -> route_plans.id | route_waypoints.route_plan_id -> route_plans.id; unique sequence | COMPLETO |
| 30 | RouteLeg → RouteCondition (afectado por) | 0..* / 0..* | route_legs.data.conditions[] (snapshot; no route_leg_conditions bridge) | route_leg_conditions(leg_id,condition_id); composite primary key | PARCIAL |
| 31 | RoutePlanningPolicy → RoutePlan (evalúa) | 1 / 0..* | route_plans.policy_id -> route_planning_policies.id; immutable policy version | route_plans.policy_id -> route_planning_policies.id; immutable policy version | COMPLETO |
| 32 | TransportPlanCandidate → PlanResource (requiere) | 1 / 1..* | plan_resources.plan_id | plan_resources.plan_candidate_id -> transport_plan_candidates.id; nonempty validated at publication | PARCIAL |
| 33 | TransportPlanCandidate → CarrierService (/servicios por tramo (derivada de PlanLegAssignment)) | 0..* / 1..* | derived DISTINCT carrier_service_id from plan_leg_assignments; no duplicate editable relation | derived DISTINCT carrier_service_id from plan_leg_assignments; no duplicate editable relation | PARCIAL |
| 34 | PlanResource → RouteLeg (asignado a) | 0..* / 1 | plan_leg_assignments.resource_id -> plan_resources.id; plan_leg_assignments.route_leg_id -> route_legs.id | plan_resources.route_leg_id -> route_legs.id; same plan | PARCIAL |
| 35 | PlanResource → CapacitySource (usa fuente) | 0..* / 0..1 | plan_resources XOR nullable asset_id/pool_id; neither allowed only for UNKNOWN; not both | plan_resources XOR nullable asset_id/pool_id; neither allowed only for UNKNOWN; not both | PARCIAL |
| 36 | TransportPlanCandidate → CarrierOpportunity (propone) | 1 / 0..* | carrier_opportunities.plan_id | carrier_opportunities.plan_candidate_id -> transport_plan_candidates.id | PARCIAL |
| 37 | Carrier → CarrierOpportunity (invitado) | 1 / 0..* | carrier_opportunities.carrier_id -> carriers.id | carrier_opportunities.carrier_id -> carriers.id | COMPLETO |
| 38 | CarrierOpportunity → CarrierOffer (recibe) | 1 / 0..* | v2_carrier_offers.parent_id | v2_carrier_offers.opportunity_id -> carrier_opportunities.id; request/plan/carrier must match | COMPLETO |
| 39 | Carrier → CarrierOffer (emite) | 1 / 0..* | v2_carrier_offers.carrier_id -> carriers.id | v2_carrier_offers.carrier_id -> carriers.id | COMPLETO |
| 40 | CarrierOffer → RankedOption (evaluada como) | 1 / 0..* | ranked_options.offer_id -> v2_carrier_offers.id; immutable ranking snapshot | ranked_options.offer_id -> v2_carrier_offers.id; immutable ranking snapshot | COMPLETO |
| 41 | ScoringPolicy → RankedOption (calcula) | 1 / 0..* | ranked_options.ranking_id -> v2_rankings.data.policyId (JSON reference) | ranked_options.scoring_policy_id -> scoring_policies.id; immutable policy version | PARCIAL |
| 42 | CarrierOffer → Booking (fundamenta) | 1 / 0..1 | v2_bookings.offer_id -> v2_carrier_offers.id; UNIQUE offer_id | v2_bookings.offer_id -> v2_carrier_offers.id; UNIQUE offer_id | COMPLETO |
| 43 | Booking → TransportExecution (inicia) | 1 / 0..1 | transport_executions.booking_id -> v2_bookings.id; UNIQUE booking_id | transport_executions.booking_id -> v2_bookings.id; UNIQUE booking_id | COMPLETO |
| 44 | TransportExecution → DriverAssignment (tripulación) | 1 / 0..* | driver_assignments.execution_id -> transport_executions.id; same responsible carrier | driver_assignments.execution_id -> transport_executions.id; same responsible carrier | COMPLETO |
| 45 | TransportExecution → VehicleAssignment (equipo) | 1 / 0..* | vehicle_assignments.execution_id -> transport_executions.id; same responsible carrier | vehicle_assignments.execution_id -> transport_executions.id; same responsible carrier | COMPLETO |
| 46 | TransportExecution → OperationalIncident (registra) | 1 / 0..* | operational_incidents.parent_id | operational_incidents.execution_id -> transport_executions.id | COMPLETO |
| 47 | OperationalIncident → IncidentUpdate (bitácora) | 1 / 0..* | incident_updates.parent_id | incident_updates.incident_id -> operational_incidents.id; append-only | COMPLETO |
| 48 | OperationalIncident → RouteCondition (evidencia vial) | 0..* / 0..* | NO incident_route_conditions bridge or incident→condition API | incident_route_conditions(incident_id,condition_id); composite primary key; source retained | FALTANTE |
| 49 | LogisticsNode → RouteCorridor (inicio dirigido) | 1 origin / 0..* | route_corridors.origin_node_id -> logistics_nodes.id | route_corridors.origin_node_id -> logistics_nodes.id | COMPLETO |
| 50 | LogisticsNode → RouteCorridor (fin dirigido) | 1 destination / 0..* | route_corridors.destination_node_id -> logistics_nodes.id; direction preserved | route_corridors.destination_node_id -> logistics_nodes.id; direction preserved | COMPLETO |
| 51 | RouteCorridor → RouteLeg (tramo sobre corredor) | 0..1 / 0..* | route_legs.corridor_id | route_legs.corridor_id -> route_corridors.id; nullable; preserve corridor version snapshot | COMPLETO |
| 52 | CargoProfile → CargoCategory (clasifica) | 0..* / 1 | organization_cargo_profiles.cargo_category_id -> cargo_categories.id | organization_cargo_profiles.cargo_category_id -> cargo_categories.id | COMPLETO |
| 53 | Organization → CargoProfile (guarda) | 1 / 0..* | organization_cargo_profiles.organization_id -> organizations.id | organization_cargo_profiles.organization_id -> organizations.id | COMPLETO |
| 54 | CargoUnit → LoadAllocation (se distribuye en) | 1 / 0..* | load_allocations(request_id,cargo_unit_index) validated against immutable request cargo snapshot | load_allocations(request_id,cargo_unit_index) validated against immutable request cargo snapshot | PARCIAL |
| 55 | PlanResource → LoadAllocation (transporta) | 1 / 0..* | load_allocations.assignment_id -> plan_leg_assignments.resource_id -> plan_resources.id | load_allocations.plan_resource_id -> plan_resources.id; same request; totals bounded; indivisible not split | PARCIAL |
| 56 | OrganizationMember → Organization (miembros autorizados) | 1..* / 1 | organization_members.organization_id -> organizations.id; active membership checked at command time | organization_members.organization_id -> organizations.id; active membership checked at command time | PARCIAL |
| 57 | OrganizationMember → McpAccountLink (vincula cuenta) | 1 / 0..* | mcp_account_links.organization_member_id -> organization_members.id; existing HAC-11 actor checks retained | mcp_account_links.organization_member_id -> organization_members.id; existing HAC-11 actor checks retained | COMPLETO |
| 58 | CapacityCalendar → RepositioningBlock (bloquea por traslado) | 1 / 0..* | repositioning_blocks.capacity_calendar_id -> capacity_calendars.id | repositioning_blocks.capacity_calendar_id -> capacity_calendars.id | COMPLETO |
| 59 | Organization → OrganizationPreferences (configura) | 1 / 0..1 | organization_preferences.organization_id -> organizations.id; UNIQUE organization_id | organization_preferences.organization_id -> organizations.id; UNIQUE organization_id | COMPLETO |
| 60 | Carrier → CarrierMetric (métricas con muestra) | 1 / 0..* | v2_carrier_metrics.carrier_id -> carriers.id; sample and period mandatory | v2_carrier_metrics.carrier_id -> carriers.id; sample and period mandatory | COMPLETO |
| 61 | VehicleCombination → PlanResource (unidad combinada) | 0..1 / 0..* | plan_resources.combination_id | plan_resources.vehicle_combination_id -> vehicle_combinations.id; nullable; carrier/time compatibility | PARCIAL |
| 62 | VehicleCombination → TransportAsset (agrupa activos) | 0..* / 1..* | vehicle_combination_assets(combination_id,asset_id); nonempty; active coupling exclusion per asset | vehicle_combination_assets(combination_id,asset_id); nonempty; active coupling exclusion per asset | PARCIAL |
| 63 | FulfilmentPartner → ServiceArea (respalda cobertura) | 0..1 / 0..* | service_areas.fulfilment_partner_id -> fulfilment_partners.id; nullable; same carrier and valid agreement | service_areas.fulfilment_partner_id -> fulfilment_partners.id; nullable; same carrier and valid agreement | PARCIAL |
| 64 | FulfilmentPartner → CapacityPool (aporta cupo) | 0..1 / 0..* | capacity_pools.fulfilment_partner_id -> fulfilment_partners.id; nullable; no fabricated individual vehicle | capacity_pools.fulfilment_partner_id -> fulfilment_partners.id; nullable; no fabricated individual vehicle | PARCIAL |
| 65 | Carrier → FulfilmentPartner (registra socio) | 1 / 0..* | fulfilment_partners.carrier_id -> carriers.id | fulfilment_partners.carrier_id -> carriers.id | COMPLETO |
| 66 | FulfilmentPartner → PlanLegAssignment (ejecuta por acuerdo) | 0..1 / 0..* | NO plan_leg_assignments.fulfilment_partner_id; partner available only through source/carrier snapshots | plan_leg_assignments.fulfilment_partner_id -> fulfilment_partners.id; nullable; valid during assignment | FALTANTE |
| 67 | PlanLegAssignment → RouteLeg (usa tramo) | 0..* / 1 | plan_leg_assignments.route_leg_id -> route_legs.id; same route/plan | plan_leg_assignments.route_leg_id -> route_legs.id; same route/plan | COMPLETO |
| 68 | TransportPlanCandidate → PlanLegAssignment (desglosa por tramo) | 1 / 1..* | plan_leg_assignments.plan_id | plan_leg_assignments.plan_candidate_id -> transport_plan_candidates.id; nonempty when published | PARCIAL |
| 69 | PlanLegAssignment → PlanResource (recursos del tramo) | 1 / 1..* | plan_leg_assignments.resource_id -> plan_resources.id (one resource per assignment) | plan_resources.plan_leg_assignment_id -> plan_leg_assignments.id; same leg/plan; nonempty per assignment | DIVERGENTE |
| 70 | PlanLegAssignment → CarrierService (servicio responsable) | 0..* / 1 | plan_leg_assignments.carrier_service_id -> carrier_services.id | plan_leg_assignments.carrier_service_id -> carrier_services.id | COMPLETO |
| 71 | CarrierOffer → PlanLegAssignment (cotiza tramos atribuibles) | 0..* / 1..* | v2_carrier_offers.data.coveredAssignmentIds[] (validated command; no v2_offer_assignments bridge) | v2_offer_assignments(offer_id,assignment_id); nonempty; attributable carrier and plan | PARCIAL |
| 72 | CarrierOffer → OfferCostComponent (desglosa costos) | 1 / 1..* | v2_carrier_offers.breakdown[]; nonempty; quoted cents reconcile with issuer total | v2_carrier_offers.breakdown[]; nonempty; quoted cents reconcile with issuer total | PARCIAL |
| 73 | FreightRequest → ShipmentContact (receptor de entrega · RECIPIENT) | 1 / 0..1 | freight_requests.v2_snapshot.contacts.recipient; nullable; RECIPIENT role | freight_requests.v2_snapshot.contacts.recipient; nullable; RECIPIENT role | PARCIAL |
| 74 | CarrierOperator → CarrierOffer (emite manualmente) | 0..1 / 0..* | v2_carrier_offers.data.source.issuerId -> organization_members; no issuer_operator_id FK | v2_carrier_offers.issuer_operator_id -> carrier_operators.id; nullable for verified API/MCP issuer | DIVERGENTE |
| 75 | CarrierOperator → Carrier (pertenece a) | 0..* / 1 | carrier_operators.carrier_id -> carriers.id; actual auth user and carrier permission required | carrier_operators.carrier_id -> carriers.id; actual auth user and carrier permission required | COMPLETO |
| 76 | AssetCargoCapability → TransportAsset (capacidades de carga) | 1 / 0..* | asset_cargo_capabilities.definition_id + transport_asset_id; no transport_assets.cargo_capability_definition_id | transport_assets.cargo_capability_definition_id -> cargo_capability_definitions.id; legacy per-asset capabilities retained for migration compatibility | PARCIAL |
| 77 | CargoCategory → AssetCargoCapability (categoría compatible) | 1 / 0..* | cargo_capability_definitions.cargo_category_id -> cargo_categories.id | cargo_capability_definitions.cargo_category_id -> cargo_categories.id | COMPLETO |
| 78 | RouteSimulationScenario → RouteCorridor (red sintética versionada) | 0..* / 1..* | scenario file references versioned corridor fixtures; no scenario rows in production migrations | scenario file references versioned corridor fixtures; no scenario rows in production migrations | PARCIAL |
| 79 | RouteSimulationScenario → RouteCondition (inyecta eventos) | 0..1 / 1..* | scenario file owns synthetic condition fixtures; never substitutes live condition evidence | scenario file owns synthetic condition fixtures; never substitutes live condition evidence | PARCIAL |
| 80 | RoutePlanner → RoutePlan (genera alternativas) | 1 / 0..* | NO planner_algorithm_version/planner_graph_version/planner_source snapshot | route_plans planner_algorithm_version/planner_graph_version/planner_source snapshot; port not table | FALTANTE |
| 81 | RoutePlanner → RoutePlanningPolicy (consulta política versionada) | 0..* / 0..* | RoutePlanner receives immutable RoutePlanningPolicy; dependency, not an editable join table | RoutePlanner receives immutable RoutePlanningPolicy; dependency, not an editable join table | PARCIAL |
| 82 | RoutePlanner → RouteCorridor (evalúa red) | 0..* / 0..* | RoutePlanner reads versioned corridor graph; dependency, not ownership | RoutePlanner reads versioned corridor graph; dependency, not ownership | PARCIAL |
| 83 | SelectionDecision → Booking (autoriza reserva) | 1 / 0..1 | v2_bookings.decision_id | v2_bookings.selection_decision_id -> selection_decisions.id; approved recovery change 0..1 to 0..* bookings, one per selected offer | PARCIAL |
| 84 | OrganizationMember → SelectionDecision (decide) | 1 / 0..* | selection_decisions.selected_by | selection_decisions.organization_member_id -> organization_members.id; audit actor and organization | COMPLETO |
| 85 | CarrierOffer → SelectionDecision (oferta elegida) | 1 / 0..* | selection_offers.decision_id + offer_id | selection_decision_offers(decision_id,offer_id); approved recovery change single offer to 1..*; exact assignment coverage | PARCIAL |
| 86 | FreightRequest → SelectionDecision (decisión auditada) | 1 / 0..* | selection_decisions.freight_request_id | selection_decisions.request_id -> freight_requests.id | COMPLETO |
| 87 | TransportPlanCandidate → SelectionDecision (plan seleccionado) | 1 / 0..* | selection_decisions.plan_id | selection_decisions.selected_plan_id -> transport_plan_candidates.id; same request | COMPLETO |
| 88 | FreightRequest → CarrierOffer (referencia de lo cotizado) | 1 / 0..* | v2_carrier_offers.freight_request_id | v2_carrier_offers.request_id -> freight_requests.id; same opportunity/plan organization | COMPLETO |
| 89 | PlanResource → CapacityReservation (ocupa capacidad en ventana) | 0..1 / 0..* | capacity_reservations.plan_assignment_id -> plan_leg_assignments.resource_id -> plan_resources.id | capacity_reservations.plan_resource_id -> plan_resources.id; nullable for pre-plan hold; coherent source | DIVERGENTE |
| 90 | FreightRequest → ShipmentContact (contacto de recojo · PICKUP) | 1 / 0..1 | freight_requests.v2_snapshot.contacts.pickup; nullable; PICKUP role | freight_requests.v2_snapshot.contacts.pickup; nullable; PICKUP role | PARCIAL |
| 91 | CarrierOffer → CarrierService (cubre servicio) | 0..* / 1..* | v2_carrier_offers.data.coveredServiceIds[] (validated command; no v2_offer_services bridge) | v2_offer_services(offer_id,service_id); nonempty; equals DISTINCT services of covered assignments | PARCIAL |
| 92 | Booking → CapacityReservation (compromete capacidad) | 0..1 / 0..* | capacity_reservations.booking_id | capacity_reservations.v2_booking_id -> v2_bookings.id; nullable for hold; active commitment proof per carrying resource | PARCIAL |

## UML derivado vigente: cinco relaciones reconciliadas

Origen histórico SHA-256 `104b126cc17565b57064fca0c6a8efd5cf43a076c1cb041355e5174cbe68dc88`. Revisión derivada: `docs/v2-amazon/diagrams/review-2026-09-24/08-complete-classes-contract-reconciled-2026-10-09.drawio`; SHA-256 `d33b9c15f8c9617e2adf60a6a27b51a3a7523980589977c27e749126ad9995b2`. Se conservan las clases, atributos, operaciones, IDs y geometría; solo cambian cinco etiquetas de multiplicidad y el nombre de la página.

| Nº | Relación | Extremos históricos (origen / destino) | Extremos vigentes (origen / destino) |
|---|---|---|---|
| 35 | PlanResource → CapacitySource | 0..* / 0..1 | 0..* / 1 |
| 40 | CarrierOffer → RankedOption | 1 / 0..* | 1..* / 0..* |
| 73 | FreightRequest → ShipmentContact | 1 / 0..1 | 1 / 1 |
| 83 | SelectionDecision → Booking | 1 / 0..1 | 1 / 0..* |
| 90 | FreightRequest → ShipmentContact | 1 / 0..1 | 1 / 1 |

Las multiplicidades describen el contrato de comandos nativos V2. CapacitySource exige XOR ASSET/POOL; cada RankedOption reúne 1..* ofertas con cobertura completa y disjunta; los contactos PICKUP y RECIPIENT son valores obligatorios del agregado; una decisión admite 0..* bookings, uno por oferta seleccionada/emisor. La evidencia independiente de main @ 42a4fde informa diferencias documentales, sin defecto funcional nuevo confirmado. Esta derivación requiere relectura independiente y no promueve estados QA históricos ni cierra F-02.


## Reconciliación vigente: F-02 y asociaciones HAC-40

Corte documental HAC-40: `42a4fde4ac2e9242d8f0ed46029101a4e44d90ed`. Cada tratamiento declara su evidencia; los conteos históricos no describen la cadena HAC-41. El baseline anterior permanece intacto.

HAC-44 independent review of #106 @ e06d0c0: relations 34, 55 and 69 conform; relation 89 has a low documentary finding. Its FK and UML multiplicity conform. The statement below is corrected against the local catalog at fe12d41; relation 89 awaits independent documentary recheck. F-05 BD/HTTP 10/10 at #104 @ 1e241b3 is separate evidence, not full-model certification. HAC-44 independent review of main @ 42a4fde (9 Oct, comment 40b0d7b6-12f3-4ddd-a4c0-453463fd9d60): five documentary differences, no confirmed new functional backend defect. The derived diagram needs independent documentary recheck; F-02 remains partial.

| Nº | Tratamiento actual en el código | Consumo API | Estado documental | Evidencia |
|---|---|---|---|---|
| 34 | plan_resource_bindings.(resource_id, plan_id) -> plan_resources.(id, plan_id); plan_resource_bindings.route_leg_id -> route_legs.id; resource_binding_leg_fk and guard_leg_resource_binding enforce the canonical leg and plan | GET/POST plans: data.assignments[].resourceId, legAssignmentId and legAssignments[].resources | DOCUMENTED_PENDING_F02_REVIEW | `supabase-v2/supabase/migrations/20261004154048_hac40_workflow.sql`; `supabase-v2/supabase/migrations/20261005192012_hac40_uml_cardinalities.sql`; `supabase-v2/supabase/migrations/20261006161533_hac40_deferred_resource_guard.sql`; `cargomesh/src/shared/schemas/v2/workflow.ts`; `supabase/tests/32_v2_hac40_uml_cardinalities.test.sql` |
| 55 | load_allocations.assignment_id -> plan_resource_bindings.id -> plan_resources.id via resource_id; PostgreSQL preserves the FK target when the old assignment table is renamed; no load_allocations.plan_resource_id column | GET plans: data.assignments[].allocations; POST plans: assignments[].resources[].allocations | DOCUMENTED_PENDING_F02_REVIEW | `supabase-v2/supabase/migrations/20261004154048_hac40_workflow.sql`; `supabase-v2/supabase/migrations/20261005192012_hac40_uml_cardinalities.sql`; `supabase-v2/supabase/migrations/20261006161533_hac40_deferred_resource_guard.sql`; `cargomesh/src/shared/schemas/v2/workflow.ts`; `supabase/tests/32_v2_hac40_uml_cardinalities.test.sql` |
| 69 | plan_resource_bindings.(leg_assignment_id, plan_id) -> plan_leg_assignments.(id, plan_id); (resource_id, plan_id) -> plan_resources.(id, plan_id); UNIQUE(resource_id); deferred leg_requires_resources/binding_preserves_resources enforce 1..N | GET plans: data.legAssignments[].resources; POST plans: assignments[].resources (min 1) | DOCUMENTED_PENDING_F02_REVIEW | `supabase-v2/supabase/migrations/20261004154048_hac40_workflow.sql`; `supabase-v2/supabase/migrations/20261005192012_hac40_uml_cardinalities.sql`; `supabase-v2/supabase/migrations/20261006161533_hac40_deferred_resource_guard.sql`; `cargomesh/src/shared/schemas/v2/workflow.ts`; `supabase/tests/32_v2_hac40_uml_cardinalities.test.sql` |
| 89 | capacity_reservations.plan_resource_id -> plan_resources.id; plan_leg_assignment_id -> plan_leg_assignments.id; plan_assignment_id -> plan_resource_bindings.id retained for compatibility; a_reservation_resource rejects resource/leg IDs without a binding and derives or validates both IDs when a binding is present. All three IDs may be NULL regardless of reservation/booking state at the table level. Native workflow commands require the canonical assignment; the trigger does not enforce a pre-plan-only NULL rule | POST capacity/holds: assignmentId canonical header plus planResourceId for multiple resources; GET hold: data.planResourceId | DOCUMENTED_PENDING_F02_REVIEW | `supabase-v2/supabase/migrations/20261004154048_hac40_workflow.sql`; `supabase-v2/supabase/migrations/20261005192012_hac40_uml_cardinalities.sql`; `supabase-v2/supabase/migrations/20261006161533_hac40_deferred_resource_guard.sql`; `cargomesh/src/shared/schemas/v2/workflow.ts`; `supabase/tests/32_v2_hac40_uml_cardinalities.test.sql` |
| 48 | incident_route_conditions(incident_id,condition_id), composite PK and two indexed FKs; native command validates the execution service route, active condition and incident time; 0..N both directions preserved | POST /carriers/:carrierId/incidents/:id/conditions; GET /carriers/:carrierId/executions/:executionId/incidents/:id -> data.routeConditionIds | IMPLEMENTED_LOCAL_VERIFIED_PENDING_INDEPENDENT_QA | `supabase-v2/supabase/migrations/20261007083000_hac40_model_associations.sql`; `cargomesh/src/shared/schemas/v2/workflow.ts`; `supabase/tests/32_v2_hac40_uml_cardinalities.test.sql`; `cargomesh/scripts/hac40-model-closure-http-smoke.mjs` |
| 66 | plan_leg_assignments.fulfilment_partner_id nullable indexed FK; carrier/service match and agreement covers whole leg window; native commercial transitions revalidate the current agreement | POST /plans/:id/assignments/:assignmentId/partner; GET /plans/:id -> data.legAssignments[].fulfilmentPartnerId | IMPLEMENTED_LOCAL_VERIFIED_PENDING_INDEPENDENT_QA | `supabase-v2/supabase/migrations/20261007083000_hac40_model_associations.sql`; `cargomesh/src/shared/schemas/v2/workflow.ts`; `supabase/tests/32_v2_hac40_uml_cardinalities.test.sql`; `cargomesh/scripts/hac40-model-closure-http-smoke.mjs` |
| 74 | v2_carrier_offers.(issuer_operator_id,carrier_id) -> carrier_operators.(id,carrier_id); issuer_auth_user_id -> auth.users.id; immutable MANUAL issuer derived from verified operator/session. Legacy offers retain nullable proof and are excluded from new commitments until attributable; API/MCP emission requires a verified adapter | POST /api/v2/carriers/:carrierId/opportunities/:id/offers; GET offer -> data.data.source.issuerId; prepare/confirm_v2_commercial_action | IMPLEMENTED_LOCAL_VERIFIED_PENDING_INDEPENDENT_QA | `supabase-v2/supabase/migrations/20261008235540_hac41_carrier_workflow.sql`; `cargomesh/src/server/auth/carrier.ts`; `cargomesh/src/server/hono/routes/carrier-workflow.ts`; `supabase/tests/33_v2_hac41_identity_channels.test.sql`; `cargomesh/scripts/hac41-channels-http-smoke.mjs` |
| 35 | A persisted plan_resources row has exactly one source: asset_id XOR capacity_pool_id, enforced by CHECK; UNKNOWN availability does not permit both IDs NULL. CapacitySource is a discriminated ASSET/POOL projection, not another writable table. | POST plans: assignments[].resources[] requires exactly one assetId/capacityPoolId; GET plans exposes that binding | DOCUMENTED_DERIVED_UML_PENDING_INDEPENDENT_RECHECK | `supabase-v2/supabase/migrations/20261004154048_hac40_workflow.sql`; `cargomesh/src/shared/schemas/v2/workflow.ts`; `supabase/tests/22_v2_hac40_workflow.test.sql`; `docs/v2-amazon/contracts/PRODUCT_SCOPE.md` |
| 40 | ranked_options.offer_id retains the representative offer; data.offerIds contains 1..* attributable offers covering every plan assignment exactly once. DISJOINT_COVER_V1 ranks complete bundles within the persisted known universe; an offer may occur in multiple ranking snapshots. | POST ranking and GET rankings: data.options[].offerId plus offerIds; 1..* offers per option | DOCUMENTED_DERIVED_UML_PENDING_INDEPENDENT_RECHECK | `supabase-v2/supabase/migrations/20261004154048_hac40_workflow.sql`; `cargomesh/src/shared/schemas/v2/workflow.ts`; `supabase/tests/22_v2_hac40_workflow.test.sql`; `docs/v2-amazon/contracts/PRODUCT_SCOPE.md` |
| 73 | freight_requests.v2_snapshot.contacts.recipient is one mandatory validated RECIPIENT value per native V2 request. It is embedded in the aggregate; no independent contact CRUD or claim about legacy V1 rows. | POST/GET requests: contacts.recipient in input, data.contacts.recipient in read projection | DOCUMENTED_DERIVED_UML_PENDING_INDEPENDENT_RECHECK | `supabase-v2/supabase/migrations/20261004154048_hac40_workflow.sql`; `cargomesh/src/shared/schemas/v2/workflow.ts`; `supabase/tests/22_v2_hac40_workflow.test.sql`; `docs/v2-amazon/contracts/PRODUCT_SCOPE.md`; `cargomesh/src/shared/schemas/v2/freight-request.ts`; `supabase-v2/supabase/migrations/20261004025720_hac40_full_request_contract.sql` |
| 83 | A selection decision authorizes 1..* selected offers; v2_bookings.decision_id binds each booking to one decision, and UNIQUE(decision_id,offer_id) prevents duplicates within it. A decision can have 0..* bookings, one per selected offer/emitter. Authorization does not imply carrier confirmation or distributed atomicity. | POST bookings: decisionId and selected offerId; GET bookings: data.decisionId | DOCUMENTED_DERIVED_UML_PENDING_INDEPENDENT_RECHECK | `supabase-v2/supabase/migrations/20261004154048_hac40_workflow.sql`; `cargomesh/src/shared/schemas/v2/workflow.ts`; `supabase/tests/22_v2_hac40_workflow.test.sql`; `docs/v2-amazon/contracts/PRODUCT_SCOPE.md` |
| 90 | freight_requests.v2_snapshot.contacts.pickup is one mandatory validated PICKUP value per native V2 request, embedded in the aggregate. Legacy nullable snapshots are not rewritten by this documentary reconciliation. | POST/GET requests: contacts.pickup in input, data.contacts.pickup in read projection | DOCUMENTED_DERIVED_UML_PENDING_INDEPENDENT_RECHECK | `supabase-v2/supabase/migrations/20261004154048_hac40_workflow.sql`; `cargomesh/src/shared/schemas/v2/workflow.ts`; `supabase/tests/22_v2_hac40_workflow.test.sql`; `docs/v2-amazon/contracts/PRODUCT_SCOPE.md`; `cargomesh/src/shared/schemas/v2/freight-request.ts`; `supabase-v2/supabase/migrations/20261004025720_hac40_full_request_contract.sql` |

## Reconciliación vigente de atributos RoutePlanner

Los estados QA históricos de la tabla anterior se conservan. El código actual persiste los siguientes atributos en el snapshot de ruta; su prueba local no certifica los métodos UML del planner ni los otros atributos.

| Atributo | Persistencia actual | Lectura API | Semántica |
|---|---|---|---|
| algorithmVersion | `route_plans.data.planner.algorithmVersion` | `GET /api/v2/routes/:id -> data.data.planner.algorithmVersion` | PUBLISHED_ITINERARY_VALIDATOR_V1; planner.search.algorithmVersion=BOUNDED_SIMPLE_PATHS_V1 for automatic searches |
| graphVersion | `route_plans.data.planner.graphVersion` | `GET /api/v2/routes/:id -> data.data.planner.graphVersion` | SHA-256 of selected itinerary; planner.search.graphVersion hashes evaluated network/policy/condition revisions |
| source | `route_plans.data.planner.source` | `GET /api/v2/routes/:id -> data.data.planner.source` | PUBLISHED_CORRIDORS / SELECTED_ITINERARY_SNAPSHOT; planner.search additionally preserves evaluated corridor/node revisions and condition sources/versions |

Explicit itineraries retain PUBLISHED_ITINERARY_VALIDATOR_V1. Automatic search additionally persists planner.search: BOUNDED_SIMPLE_PATHS_V1, graph fingerprint, policy, corridor/node versions and condition sources/versions. findAlternatives/replan/explain are implemented and tested locally. Search is exhaustive only within maxLegs <= 8, active published accepted-mode network <= 64 edges and <= 1000 simple walks; overflow rejects instead of silently truncating. Alternatives require independent plan/resource/capacity verification and user selection. No hosted, carrier-live or full-UML QA certification.

## Reconciliación vigente de identidad HAC-41

Base: `1e9ff995ef9c8fa6789e473263e64873bcb13fba`; rama `codex/v2-full-identity-mcp`. Los estados QA históricos se conservan; HAC-44 debe reobservar F-03/F-06 sobre el SHA del PR.

| Clase.atributo | Persistencia actual | Operación/servicio/canal | Dueño y estado |
|---|---|---|---|
| ResponseIntegration.channel | `public.response_integrations.channel` | GET/POST /api/v2/carriers/:carrierId/integrations; GET :id/diagnostics | HAC-41 / Axel; authorized integrator implementation; IMPLEMENTED_LOCAL_VERIFIED_PENDING_INDEPENDENT_QA |
| ResponseIntegration.endpointRef | `public.response_integrations.endpoint_ref` | GET/POST /api/v2/carriers/:carrierId/integrations; GET :id/diagnostics | HAC-41 / Axel; authorized integrator implementation; IMPLEMENTED_LOCAL_VERIFIED_PENDING_INDEPENDENT_QA |
| ResponseIntegration.verifiedAt | `public.response_integrations.verified_at` | GET/POST /api/v2/carriers/:carrierId/integrations; GET :id/diagnostics | HAC-41 / Axel; authorized integrator implementation; IMPLEMENTED_LOCAL_VERIFIED_PENDING_INDEPENDENT_QA |
| ResponseIntegration.status | `public.response_integrations.status` | GET/POST /api/v2/carriers/:carrierId/integrations; GET :id/diagnostics | HAC-41 / Axel; authorized integrator implementation; IMPLEMENTED_LOCAL_VERIFIED_PENDING_INDEPENDENT_QA |
| ResponseIntegration.evidence | `public.response_integrations.evidence` | GET/POST /api/v2/carriers/:carrierId/integrations; GET :id/diagnostics | HAC-41 / Axel; authorized integrator implementation; IMPLEMENTED_LOCAL_VERIFIED_PENDING_INDEPENDENT_QA |
| OrganizationMember.id | `public.organization_members.id` | GET /api/v2/organizations/current/members; invitations/revisions/acceptance | HAC-41 / Axel; authorized integrator implementation; IMPLEMENTED_LOCAL_VERIFIED_PENDING_INDEPENDENT_QA |
| OrganizationMember.role | `public.organization_members.role` | GET /api/v2/organizations/current/members; invitations/revisions/acceptance | HAC-41 / Axel; authorized integrator implementation; IMPLEMENTED_LOCAL_VERIFIED_PENDING_INDEPENDENT_QA |
| OrganizationMember.status | `public.organization_members.status` | GET /api/v2/organizations/current/members; invitations/revisions/acceptance | HAC-41 / Axel; authorized integrator implementation; IMPLEMENTED_LOCAL_VERIFIED_PENDING_INDEPENDENT_QA |
| OrganizationMember.contactRef | `public.organization_members.corporate_email` | GET /api/v2/organizations/current/members; invitations/revisions/acceptance | HAC-41 / Axel; authorized integrator implementation; IMPLEMENTED_LOCAL_VERIFIED_PENDING_INDEPENDENT_QA |
| OrganizationMember.verifiedAt | `public.organization_members.verified_at` | GET /api/v2/organizations/current/members; invitations/revisions/acceptance | HAC-41 / Axel; authorized integrator implementation; IMPLEMENTED_LOCAL_VERIFIED_PENDING_INDEPENDENT_QA |
| McpAccountLink.id | `public.mcp_account_links.id` | GET/POST /api/v2/identity/mcp/links; POST :id/revocations; per-tool actor check | HAC-41 / Axel; authorized integrator implementation; IMPLEMENTED_LOCAL_VERIFIED_PENDING_INDEPENDENT_QA |
| McpAccountLink.authUserId | `public.mcp_account_links.auth_user_id` | GET/POST /api/v2/identity/mcp/links; POST :id/revocations; per-tool actor check | HAC-41 / Axel; authorized integrator implementation; IMPLEMENTED_LOCAL_VERIFIED_PENDING_INDEPENDENT_QA |
| McpAccountLink.oauthClientId | `public.mcp_account_links.oauth_client_id` | GET/POST /api/v2/identity/mcp/links; POST :id/revocations; per-tool actor check | HAC-41 / Axel; authorized integrator implementation; IMPLEMENTED_LOCAL_VERIFIED_PENDING_INDEPENDENT_QA |
| McpAccountLink.organizationId | `public.mcp_account_links.organization_id` | GET/POST /api/v2/identity/mcp/links; POST :id/revocations; per-tool actor check | HAC-41 / Axel; authorized integrator implementation; IMPLEMENTED_LOCAL_VERIFIED_PENDING_INDEPENDENT_QA |
| McpAccountLink.scopes | `public.mcp_account_links.scopes` | GET/POST /api/v2/identity/mcp/links; POST :id/revocations; per-tool actor check | HAC-41 / Axel; authorized integrator implementation; IMPLEMENTED_LOCAL_VERIFIED_PENDING_INDEPENDENT_QA |
| McpAccountLink.provider | `public.mcp_account_links.provider` | GET/POST /api/v2/identity/mcp/links; POST :id/revocations; per-tool actor check | HAC-41 / Axel; authorized integrator implementation; IMPLEMENTED_LOCAL_VERIFIED_PENDING_INDEPENDENT_QA |
| McpAccountLink.externalSubjectRef | `public.mcp_account_links.external_subject_ref` | GET/POST /api/v2/identity/mcp/links; POST :id/revocations; per-tool actor check | HAC-41 / Axel; authorized integrator implementation; IMPLEMENTED_LOCAL_VERIFIED_PENDING_INDEPENDENT_QA |
| McpAccountLink.status | `public.mcp_account_links.status` | GET/POST /api/v2/identity/mcp/links; POST :id/revocations; per-tool actor check | HAC-41 / Axel; authorized integrator implementation; IMPLEMENTED_LOCAL_VERIFIED_PENDING_INDEPENDENT_QA |
| McpAccountLink.verifiedAt | `public.mcp_account_links.verified_at` | GET/POST /api/v2/identity/mcp/links; POST :id/revocations; per-tool actor check | HAC-41 / Axel; authorized integrator implementation; IMPLEMENTED_LOCAL_VERIFIED_PENDING_INDEPENDENT_QA |
| McpAccountLink.revokedAt | `public.mcp_account_links.revoked_at` | GET/POST /api/v2/identity/mcp/links; POST :id/revocations; per-tool actor check | HAC-41 / Axel; authorized integrator implementation; IMPLEMENTED_LOCAL_VERIFIED_PENDING_INDEPENDENT_QA |
| McpAccountLink.expiresAt | `public.mcp_account_links.expires_at` | GET/POST /api/v2/identity/mcp/links; POST :id/revocations; per-tool actor check | HAC-41 / Axel; authorized integrator implementation; IMPLEMENTED_LOCAL_VERIFIED_PENDING_INDEPENDENT_QA |
| CarrierOperator.id | `public.carrier_operators.id` | GET /api/v2/carriers/:carrierId/operators; invitations/revisions/acceptance; carrier workflow; offer source.issuerId | HAC-41 / Axel; authorized integrator implementation; IMPLEMENTED_LOCAL_VERIFIED_PENDING_INDEPENDENT_QA |
| CarrierOperator.displayName | `public.carrier_operators.display_name` | GET /api/v2/carriers/:carrierId/operators; invitations/revisions/acceptance; carrier workflow; offer source.issuerId | HAC-41 / Axel; authorized integrator implementation; IMPLEMENTED_LOCAL_VERIFIED_PENDING_INDEPENDENT_QA |
| CarrierOperator.role | `public.carrier_operators.role` | GET /api/v2/carriers/:carrierId/operators; invitations/revisions/acceptance; carrier workflow; offer source.issuerId | HAC-41 / Axel; authorized integrator implementation; IMPLEMENTED_LOCAL_VERIFIED_PENDING_INDEPENDENT_QA |
| CarrierOperator.email | `public.carrier_operators.email` | GET /api/v2/carriers/:carrierId/operators; invitations/revisions/acceptance; carrier workflow; offer source.issuerId | HAC-41 / Axel; authorized integrator implementation; IMPLEMENTED_LOCAL_VERIFIED_PENDING_INDEPENDENT_QA |
| CarrierOperator.phone | `public.carrier_operators.phone` | GET /api/v2/carriers/:carrierId/operators; invitations/revisions/acceptance; carrier workflow; offer source.issuerId | HAC-41 / Axel; authorized integrator implementation; IMPLEMENTED_LOCAL_VERIFIED_PENDING_INDEPENDENT_QA |
| CarrierOperator.status | `public.carrier_operators.status` | GET /api/v2/carriers/:carrierId/operators; invitations/revisions/acceptance; carrier workflow; offer source.issuerId | HAC-41 / Axel; authorized integrator implementation; IMPLEMENTED_LOCAL_VERIFIED_PENDING_INDEPENDENT_QA |
| CarrierOperator.verifiedAt | `public.carrier_operators.verified_at` | GET /api/v2/carriers/:carrierId/operators; invitations/revisions/acceptance; carrier workflow; offer source.issuerId | HAC-41 / Axel; authorized integrator implementation; IMPLEMENTED_LOCAL_VERIFIED_PENDING_INDEPENDENT_QA |

Metadata and real local Auth proof; legacy member verification remains unknown until self acceptance. API/MCP integration evidence remains pending external verification. No hosted schema, live Alexa or full-model independent QA certification.

El enlace indirecto de LoadAllocation al recurso es deliberado y explícito; no se promete una columna directa inexistente. En reservas, el trigger garantiza coherencia cuando hay un binding, pero permite los tres IDs NULL sin comprobar fase o booking. La exigencia de asignación del comando nativo es una garantía distinta del catálogo físico. Esta sección no reobserva los 397 atributos ni certifica las 93 relaciones o Supabase alojado.

## Gate antes de aplicar el esquema

El inventario y este diseño deben coincidir exactamente con el UML. Después se comprobará cada destino contra pg_catalog, constraints, RLS y comandos reales; los 397 destinos y 93 tratamientos no pasan a IMPLEMENTADO por aparecer aquí. Para cerrar F-02 falta medir la evidencia pendiente por SHA y entorno. Los estados del baseline histórico no prueban defectos actuales ni justifican migraciones nuevas por sí solos. Optimización sobre datos incompletos, adaptadores externos y canales live conservan sus límites documentados.
