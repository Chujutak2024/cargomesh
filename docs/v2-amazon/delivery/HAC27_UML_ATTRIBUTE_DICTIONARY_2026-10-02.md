# HAC-27 — Diccionario UML → contrato → BD/API (corte 2 oct 2026)

Este anexo resuelve C-01 de la re-revisión HAC-12 como **trazabilidad de atributos**, no como declaración de implementación total. Extraído de UML `07`: **57 clases, 397 atributos declarados y 93 relaciones**. Se conserva el diseño original y cada ausencia queda visible. La aceptación independiente de C-01/C-02 y el merge por HAC-16 siguen pendientes.

## Fuentes y límites

- [UML 07 original](../diagrams/review-2026-09-24/07-complete-classes-sprint2-reviewed.drawio), SHA-256 `104b126cc17565b57064fca0c6a8efd5cf43a076c1cb041355e5174cbe68dc88`, sin modificar semántica ni rebajar atributos requeridos.
- [Contrato maestro HAC-27](./SPRINT2_HAC27_CLASS_DB_API_CONTRACT.md); [DTO de creación/lectura](../../../cargomesh/src/shared/schemas/v2/freight-request.ts) y [DTO de evaluación/mapa](../../../cargomesh/src/shared/schemas/v2/serviceability.ts).
- [Cadena física activa](../../../supabase-v2/supabase/migrations/): bootstrap HAC-29 + cuatro migraciones HAC-12 hasta `20261002073853`. Inventario contrastado localmente, no proyecto alojado.
- **21 clases persistentes → 20 tablas esperadas** (TransportAsset/RoadVehicle comparten transport_assets). **19 tablas de ese conjunto disponibles**; `mcp_account_links` falta y pertenece a HAC-11. Las tablas puente/legacy adicionales no cambian este conteo del conjunto UML.
- 7 clases embebidas, 6 derivadas, 2 fixtures y 21 diferidas. Existencia de tabla no demuestra campos, cardinalidades, CRUD, Alexa/MCP live ni esquema alojado. La evaluación actual es ROAD y no crea ofertas/bookings.
- `?` conserva opcionalidad UML. Cuando el DTO exige más (volumen/stackable/description), la diferencia se declara en la fila. Las filas PENDIENTE/FALTANTE y SUBCONJUNTO no se certifican como equivalencia total. Un atributo requerido UML sin representación continúa siendo hueco de producto.
- En columnas PERSISTIDO se conserva tipo/nulabilidad reales en la subsección física; las validaciones de API pueden ser más estrictas. Esas columnas no equivalen automáticamente a permisos de escritura del usuario.

## Ausencias que condicionan capacidades

1. **RouteCondition**: falta fixture S2. Jean lo entrega dentro de HAC-13; HAC-29 cerrada no se reabre. Fuente SIMULATED, vigencia y ubicación explícitas; no modificar elegibilidad ni ETA con incidentes decorativos. Si se necesita efecto funcional, publicar regla/reprueba antes de integrarlo.
2. **McpAccountLink**: falta tabla/identidad MCP HAC-11. Herramientas legacy no prueban Alexa+ live.
3. **RoadVehicle.bodyType/plate**: bodyType requerido UML sin representación y plate nullable. Equipo/peso/volumen S2 no acreditan carrocería legal ni cubicaje. Completar modelo antes de prometer esas restricciones.
4. **CapacityPool.partner/evidence, cupo residual**: agenda no prueba acuerdo de socio ni consolidación; LTL permanece UNKNOWN.
5. **Documentos/accesos/certificaciones**: legacy JSON y notas no acreditan permisos, frontera ni manipulación. Mantener las limitaciones visibles y completar contrato antes de activar.
6. **Reserva completa de fuente**: no-solape HELD/CONFIRMED garantizado por GiST sobre [inicio,fin); la capacidad comprometida parcial, planResourceId y booking quedan pendientes. Esta limitación no autoriza LTL elegible.

## Tratamientos por atributo

PERSISTIDO = columna concreta; PROYECCIÓN/EMBEBIDO = transformación o JSON concreto; DERIVADO = cálculo; PARCIAL/SUBCONJUNTO = representación incompleta; PENDIENTE/FALTANTE S2 = ausencia explícita; DIFERIDO = fuera del corte definido. Los conteos son de tratamiento, no porcentaje de producto terminado.


| Tratamiento | Atributos |
|---|---:|
| DERIVADO | 11 |
| DERIVADO PARCIAL | 17 |
| DIFERIDO | 149 |
| DTO PARCIAL | 15 |
| EMBEBIDO | 19 |
| FALTANTE S2 | 17 |
| FIXTURE PARCIAL | 7 |
| PARCIAL | 14 |
| PENDIENTE | 59 |
| PERSISTIDO | 60 |
| PROYECCIÓN | 21 |
| REGLA PARCIAL | 5 |
| SUBCONJUNTO | 3 |

## 1. Organization — tabla persistente

Dueño: Cristhian / HAC-12 + HAC-27. Identificador UML: `O3AsrRVXhiO8iDlZrkKS-1`.

Tabla `public.organizations`; RLS activada. Lectura sujeta a políticas/grants; esto no acredita principal de escritura carrier.

| Columna física | Tipo SQL | Nullable |
|---|---|---|
| `id` | `uuid` | no |
| `name` | `text` | no |
| `code` | `text` | no |
| `status` | `text` | no |
| `default_currency` | `text` | no |
| `created_at` | `timestamp with time zone` | no |
| `legal_name` | `text` | sí |
| `country_code` | `text` | sí |
| `business_identifier_type` | `text` | sí |
| `business_identifier_value` | `text` | sí |
| `verified_corporate_email` | `text` | sí |
| `corporate_phone` | `text` | sí |
| `updated_at` | `timestamp with time zone` | no |

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `id: UUID` | PERSISTIDO | public.organizations.id | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `code: string` | PERSISTIDO | public.organizations.code | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `commercialName: string` | PERSISTIDO | public.organizations.name | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `legalName?: string` | PERSISTIDO | public.organizations.legal_name | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `taxIdType?: string` | PERSISTIDO | public.organizations.business_identifier_type | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `taxIdValue?: string` | PERSISTIDO | public.organizations.business_identifier_value | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `countryCode?: string` | PERSISTIDO | public.organizations.country_code | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `corporateEmail?: string` | PERSISTIDO | public.organizations.verified_corporate_email | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `defaultCurrency: Currency` | PERSISTIDO | public.organizations.default_currency | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `status: OrganizationStatus` | PERSISTIDO | public.organizations.status | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `corporatePhone?: string` | PERSISTIDO | public.organizations.corporate_phone | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |

## 2. Facility — tabla persistente

Dueño: Cristhian / HAC-12 + HAC-27. Identificador UML: `O3AsrRVXhiO8iDlZrkKS-5`.

Tabla `public.facilities`; RLS activada. Lectura sujeta a políticas/grants; esto no acredita principal de escritura carrier.

| Columna física | Tipo SQL | Nullable |
|---|---|---|
| `id` | `uuid` | no |
| `organization_id` | `uuid` | no |
| `code` | `text` | no |
| `name` | `text` | no |
| `facility_type` | `text` | no |
| `country_code` | `text` | no |
| `region_code` | `text` | sí |
| `city` | `text` | no |
| `postal_code` | `text` | sí |
| `address_line` | `text` | no |
| `latitude` | `numeric(9,6)` | sí |
| `longitude` | `numeric(9,6)` | sí |
| `access_notes` | `text` | sí |
| `active` | `boolean` | no |
| `created_at` | `timestamp with time zone` | no |
| `updated_at` | `timestamp with time zone` | no |

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `id: UUID` | PERSISTIDO | public.facilities.id | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `code: string` | PERSISTIDO | public.facilities.code | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `name: string` | PERSISTIDO | public.facilities.name | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `location: GeoLocation` | PROYECCIÓN | public.facilities: country_code, region_code, city, postal_code, address_line, latitude, longitude | No tabla GeoLocation; coordenadas nullable. Una sede no concede cobertura. |
| `active: boolean` | PERSISTIDO | public.facilities.active | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `accessRestrictions: Rule[]` | PARCIAL | public.facilities.access_notes | Texto libre; no es Rule[]. Sin evaluador de reglas de acceso; no confirmar manipulación/acceso. |
| `operatingHours?: Schedule` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |

## 3. FreightRequest — tabla persistente

Dueño: Cristhian / HAC-12 + HAC-27. Identificador UML: `O3AsrRVXhiO8iDlZrkKS-9`.

Tabla `public.freight_requests`; RLS activada. Lectura sujeta a políticas/grants; esto no acredita principal de escritura carrier.

| Columna física | Tipo SQL | Nullable |
|---|---|---|
| `id` | `uuid` | no |
| `organization_id` | `uuid` | no |
| `cargo_category_id` | `uuid` | no |
| `code` | `text` | no |
| `origin_country` | `text` | no |
| `origin_city` | `text` | no |
| `destination_country` | `text` | no |
| `destination_city` | `text` | no |
| `cargo_weight_kg` | `numeric(14,2)` | no |
| `cargo_volume_m3` | `numeric(14,3)` | sí |
| `package_count` | `integer` | sí |
| `service_type` | `text` | no |
| `transport_mode` | `text` | no |
| `requires_refrigeration` | `boolean` | no |
| `temperature_min_c` | `numeric(6,2)` | sí |
| `temperature_max_c` | `numeric(6,2)` | sí |
| `is_hazardous` | `boolean` | no |
| `is_fragile` | `boolean` | no |
| `is_oversized` | `boolean` | no |
| `is_high_value` | `boolean` | no |
| `is_stackable` | `boolean` | no |
| `special_instructions` | `text` | sí |
| `required_pickup` | `timestamp with time zone` | no |
| `delivery_deadline` | `timestamp with time zone` | sí |
| `budget_max` | `numeric(14,2)` | sí |
| `optimization_strategy` | `text` | no |
| `status` | `text` | no |
| `created_at` | `timestamp with time zone` | no |
| `requested_by_member_id` | `uuid` | sí |
| `origin_address` | `text` | sí |
| `pickup_contact_name` | `text` | sí |
| `pickup_contact_phone` | `text` | sí |
| `destination_address` | `text` | sí |
| `receiver_name` | `text` | sí |
| `receiver_company` | `text` | sí |
| `receiver_phone` | `text` | sí |
| `cargo_description` | `text` | sí |
| `cargo_entry_method` | `text` | no |
| `pickup_mode` | `text` | no |
| `pickup_window_start` | `timestamp with time zone` | sí |
| `pickup_window_end` | `timestamp with time zone` | sí |
| `available_documents` | `jsonb` | no |
| `cross_border` | `boolean` | no |
| `confirmed_at` | `timestamp with time zone` | sí |
| `confirmed_by_member_id` | `uuid` | sí |
| `updated_at` | `timestamp with time zone` | no |
| `cargo_profile_id` | `uuid` | sí |
| `entry_quantity` | `numeric(12,2)` | sí |
| `entry_unit_weight_kg` | `numeric(12,2)` | sí |
| `units_per_entry` | `integer` | sí |
| `entry_length_cm` | `numeric(10,2)` | sí |
| `entry_width_cm` | `numeric(10,2)` | sí |
| `entry_height_cm` | `numeric(10,2)` | sí |
| `cargo_specifications` | `jsonb` | no |
| `draft_version` | `integer` | no |
| `origin_region` | `text` | sí |
| `destination_region` | `text` | sí |
| `creation_idempotency_key` | `uuid` | sí |
| `creation_payload_hash` | `text` | sí |
| `origin_facility_id` | `uuid` | sí |
| `destination_facility_id` | `uuid` | sí |
| `v2_snapshot` | `jsonb` | sí |
| `v2_creation_payload` | `jsonb` | sí |
| `v2_contract_version` | `text` | sí |
| `delivery_window_start` | `timestamp with time zone` | sí |
| `delivery_window_end` | `timestamp with time zone` | sí |
| `required_equipment_code` | `text` | sí |
| `budget_currency` | `text` | sí |
| `pickup_contact_email` | `text` | sí |
| `recipient_contact_email` | `text` | sí |

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `id: UUID` | PERSISTIDO | public.freight_requests.id | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `origin: GeoLocation` | PROYECCIÓN | freight_requests.v2_snapshot.origin + origin_facility_id / origin_country / origin_region / origin_city / origin_address | RPC resuelve sede propia activa; INSERT compara snapshot/columnas con sede. UPDATE V2 bloqueado. Coordenadas manuales no verificadas. |
| `destination: GeoLocation` | PROYECCIÓN | freight_requests.v2_snapshot.destination + destination_facility_id / destination_country / destination_region / destination_city / destination_address | RPC resuelve sede propia activa; INSERT compara snapshot/columnas con sede. UPDATE V2 bloqueado. Coordenadas manuales no verificadas. |
| `pickupWindow: TimeWindow` | PROYECCIÓN | freight_requests.pickup_window_start / pickup_window_end + v2_snapshot.pickupWindow | Instantes con offset; orden positivo. No disponibilidad concedida por una fecha. |
| `deliveryDeadline?: Instant` | PROYECCIÓN | freight_requests.delivery_deadline / delivery_window_end + v2_snapshot.deliveryWindow | DTO exige ventana completa; deadline aislado no es suficiente. |
| `acceptedModes: TransportMode[]` | SUBCONJUNTO | freight_requests.transport_mode + v2_snapshot.acceptedModes | DTO S2 acepta exactamente [ROAD]; no SEA/RAIL/AIR implementados. |
| `budget?: Money` | PROYECCIÓN | freight_requests.budget_max / budget_currency + v2_snapshot.budget | Opcional/null; importe positivo solo USD; no oferta ni precio de carrier. |
| `status: RequestStatus` | PERSISTIDO | public.freight_requests.status | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `draftVersion: number` | PERSISTIDO | public.freight_requests.draft_version | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `serviceType?: ServiceClass` | PENDIENTE | Sin selector en CreateFreightRequestV2Input | service_type físico=FTL por compatibilidad; la clase evaluada sale de carrier_services.service_type. No confundir el placeholder con una selección del shipper; selección comercial HITO 3. |
| `requiredEquipment?: EquipmentType` | PERSISTIDO | public.freight_requests.required_equipment_code | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `preferredEquipment?: EquipmentType` | DIFERIDO | Sin campo DTO/columna V2 | Preferencia blanda HITO 3; requiredEquipment ya es filtro duro. |
| `selectionObjective?: RankingObjective` | DIFERIDO | Sin campo DTO V2 | HITO 3 con ScoringPolicy versionada; optimization_strategy V1 no es ranking V2. |

## 4. CargoSpecification — valor embebido

Dueño: Cristhian / HAC-12 + HAC-27. Identificador UML: `O3AsrRVXhiO8iDlZrkKS-13`.

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `category: CargoCategory` | EMBEBIDO | freight_requests.v2_snapshot.cargoSpecification.categoryCode | JSONB del snapshot canónico y cargo_specifications; validación Zod y RPC completa. FK cargo_category_id; catálogo de ocho códigos. |
| `packaging: PackageType` | EMBEBIDO | freight_requests.v2_snapshot.cargoSpecification.packaging | JSONB del snapshot canónico y cargo_specifications; validación Zod y RPC completa. CAPTURE_ONLY: no verifica capacidad de manipulación. |
| `totalWeightKg: number` | EMBEBIDO | freight_requests.v2_snapshot.cargoSpecification.totalWeightKg | JSONB del snapshot canónico y cargo_specifications; validación Zod y RPC completa. cargo_weight_kg numeric(14,2); snapshot conserva precisión; total=SUM(quantity*weight) con tolerancia 1e-6. |
| `totalVolumeM3?: number` | EMBEBIDO | freight_requests.v2_snapshot.cargoSpecification.totalVolumeM3 | JSONB del snapshot canónico y cargo_specifications; validación Zod y RPC completa. REQUIRED positivo en DTO S2 frente a opcional UML; cargo_volume_m3 numeric(14,3); total=SUM(quantity*volume). |
| `divisible: boolean` | EMBEBIDO | freight_requests.v2_snapshot.cargoSpecification.divisible | JSONB del snapshot canónico y cargo_specifications; validación Zod y RPC completa. |
| `requirements: CargoRequirement[]` | EMBEBIDO | freight_requests.v2_snapshot.cargoSpecification.requirements | JSONB del snapshot canónico y cargo_specifications; validación Zod y RPC completa. TEMP_CONTROLLED/SECURITY_SEAL requieren evidencia del mismo portador; FRAGILE/HAZARDOUS permanecen UNKNOWN. |
| `temperatureRange?: TemperatureRange` | EMBEBIDO | freight_requests.v2_snapshot.cargoSpecification.temperatureRange | JSONB del snapshot canónico y cargo_specifications; validación Zod y RPC completa. |
| `description?: string` | EMBEBIDO | freight_requests.v2_snapshot.cargoSpecification.description | JSONB del snapshot canónico y cargo_specifications; validación Zod y RPC completa. REQUIRED no vacío en DTO S2 frente a opcional UML. |
| `availableDocuments: DocumentRef[]` | PENDIENTE | No presente en DTO V2; existe columna legacy freight_requests.available_documents | Sin ingestión/validación V2 de DocumentRef; cruces fronterizos siguen BORDER_DOCS_UNKNOWN. No heredar documentos históricos como vigentes. |

## 5. CargoUnit — valor embebido

Dueño: Cristhian / HAC-12 + HAC-27. Identificador UML: `O3AsrRVXhiO8iDlZrkKS-17`.

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `packageType: PackageType` | EMBEBIDO | freight_requests.v2_snapshot.cargoSpecification.units[].packageType | REQUIRED en DTO S2. quantity entero positivo; pesos/volúmenes/dimensiones positivos; indivisible/stackable booleanos. No implica cubicaje tridimensional ejecutado. |
| `quantity: number` | EMBEBIDO | freight_requests.v2_snapshot.cargoSpecification.units[].quantity | REQUIRED en DTO S2. quantity entero positivo; pesos/volúmenes/dimensiones positivos; indivisible/stackable booleanos. No implica cubicaje tridimensional ejecutado. |
| `weightPerUnitKg: number` | EMBEBIDO | freight_requests.v2_snapshot.cargoSpecification.units[].weightPerUnitKg | REQUIRED en DTO S2. quantity entero positivo; pesos/volúmenes/dimensiones positivos; indivisible/stackable booleanos. No implica cubicaje tridimensional ejecutado. |
| `volumePerUnitM3?: number` | EMBEBIDO | freight_requests.v2_snapshot.cargoSpecification.units[].volumePerUnitM3 | REQUIRED en DTO S2. quantity entero positivo; pesos/volúmenes/dimensiones positivos; indivisible/stackable booleanos. No implica cubicaje tridimensional ejecutado. |
| `dimensions: Dimensions` | EMBEBIDO | freight_requests.v2_snapshot.cargoSpecification.units[].dimensionsCm | REQUIRED en DTO S2. quantity entero positivo; pesos/volúmenes/dimensiones positivos; indivisible/stackable booleanos. No implica cubicaje tridimensional ejecutado. |
| `indivisible: boolean` | EMBEBIDO | freight_requests.v2_snapshot.cargoSpecification.units[].indivisible | REQUIRED en DTO S2. quantity entero positivo; pesos/volúmenes/dimensiones positivos; indivisible/stackable booleanos. No implica cubicaje tridimensional ejecutado. |
| `stackable?: boolean` | EMBEBIDO | freight_requests.v2_snapshot.cargoSpecification.units[].stackable | REQUIRED en DTO S2. quantity entero positivo; pesos/volúmenes/dimensiones positivos; indivisible/stackable booleanos. No implica cubicaje tridimensional ejecutado. |
| `unitsPerPackage?: number` | DIFERIDO | Sin atributo DTO V2 | Captura por grupos de paquetes S2; no inferir unidades interiores desde packageType. |

## 6. Carrier — tabla persistente

Dueño: Cristhian / HAC-12 + HAC-27. Identificador UML: `O3AsrRVXhiO8iDlZrkKS-21`.

Tabla `public.carriers`; RLS activada. Lectura sujeta a políticas/grants; esto no acredita principal de escritura carrier.

| Columna física | Tipo SQL | Nullable |
|---|---|---|
| `id` | `uuid` | no |
| `name` | `text` | no |
| `code` | `text` | no |
| `provider_type` | `text` | no |
| `status` | `text` | no |
| `created_at` | `timestamp with time zone` | no |
| `provider_url` | `text` | sí |
| `supports_webmcp` | `boolean` | no |
| `updated_at` | `timestamp with time zone` | no |

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `id: UUID` | PERSISTIDO | public.carriers.id | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `code: string` | PERSISTIDO | public.carriers.code | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `commercialName: string` | PERSISTIDO | public.carriers.name | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `legalName?: string` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |
| `businessIdType?: string` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |
| `businessIdValue?: string` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |
| `registeredCountry?: string` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |
| `verifiedContact?: Contact` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |
| `providerType: ProviderType` | PERSISTIDO | public.carriers.provider_type | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `status: CarrierStatus` | PERSISTIDO | public.carriers.status | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `operationalPhone?: E164Phone` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |

## 7. CarrierDepot — tabla persistente

Dueño: Cristhian / HAC-12 + HAC-27. Identificador UML: `O3AsrRVXhiO8iDlZrkKS-25`.

Tabla `public.carrier_depots`; RLS activada. Lectura sujeta a políticas/grants; esto no acredita principal de escritura carrier.

| Columna física | Tipo SQL | Nullable |
|---|---|---|
| `id` | `uuid` | no |
| `carrier_id` | `uuid` | no |
| `code` | `text` | no |
| `name` | `text` | no |
| `country_code` | `text` | no |
| `region_code` | `text` | sí |
| `city` | `text` | no |
| `postal_code` | `text` | sí |
| `address_line` | `text` | sí |
| `latitude` | `numeric(9,6)` | sí |
| `longitude` | `numeric(9,6)` | sí |
| `active` | `boolean` | no |
| `created_at` | `timestamp with time zone` | no |
| `updated_at` | `timestamp with time zone` | no |

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `id: UUID` | PERSISTIDO | public.carrier_depots.id | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `code: string` | PERSISTIDO | public.carrier_depots.code | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `location: GeoLocation` | PROYECCIÓN | public.carrier_depots: country_code, region_code, city, postal_code, address_line, latitude, longitude | No tabla GeoLocation; coordenadas nullable. Una sede no concede cobertura. |
| `active: boolean` | PERSISTIDO | public.carrier_depots.active | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `handling?: HandlingCapability[]` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |

## 8. CarrierService — tabla persistente

Dueño: Cristhian / HAC-12 + HAC-27. Identificador UML: `O3AsrRVXhiO8iDlZrkKS-29`.

Tabla `public.carrier_services`; RLS activada. Lectura sujeta a políticas/grants; esto no acredita principal de escritura carrier.

| Columna física | Tipo SQL | Nullable |
|---|---|---|
| `id` | `uuid` | no |
| `carrier_id` | `uuid` | no |
| `transport_mode` | `text` | no |
| `service_type` | `text` | no |
| `origin_country` | `text` | no |
| `origin_region` | `text` | sí |
| `destination_country` | `text` | no |
| `destination_region` | `text` | sí |
| `max_capacity_kg` | `numeric(14,2)` | no |
| `max_volume_m3` | `numeric(14,3)` | sí |
| `supports_refrigerated` | `boolean` | no |
| `temperature_min_c` | `numeric(6,2)` | sí |
| `temperature_max_c` | `numeric(6,2)` | sí |
| `supports_hazardous` | `boolean` | no |
| `supports_fragile` | `boolean` | no |
| `supports_oversized` | `boolean` | no |
| `active` | `boolean` | no |
| `created_at` | `timestamp with time zone` | no |
| `supports_cross_border` | `boolean` | no |
| `customs_coordination_included` | `boolean` | no |
| `provider_service_code` | `text` | sí |
| `updated_at` | `timestamp with time zone` | no |

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `id: UUID` | PERSISTIDO | public.carrier_services.id | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `mode: TransportMode` | PERSISTIDO | public.carrier_services.transport_mode | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `serviceClass: ServiceClass` | PERSISTIDO | public.carrier_services.service_type | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `maxWeightKg?: number` | PERSISTIDO | public.carrier_services.max_capacity_kg | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `maxVolumeM3?: number` | PERSISTIDO | public.carrier_services.max_volume_m3 | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `responseChannels: ResponseChannel[]` | PARCIAL | candidates[].service.responseChannels = [] | Ningún canal V2 de respuesta publicado en catálogo; ResponseIntegration HITO 3. No convertir supports_webmcp V1 en canal V2. |
| `status: ServiceStatus` | SUBCONJUNTO | public.carrier_services.active | Booleano activo/inactivo; no representa todos los ServiceStatus. |
| `admittedCargoTypes: CargoCategory[]` | PROYECCIÓN | public.carrier_service_cargo_categories (carrier_service_id,cargo_category_id) | Puente con FK; no lista fija de carriers. |
| `temperatureRange?: TemperatureRange` | PROYECCIÓN | public.carrier_services.temperature_min_c / temperature_max_c | Compatibilidad adicional exige capacidad térmica del mismo recurso portador, no solo servicio. |
| `requiredCertifications: Certification[]` | PENDIENTE | Sin colección persistida por servicio | No inferir permisos por supports_hazardous; códigos publicados del recurso se cotejan solo para requisitos implementados. |

## 9. ServiceLane — tabla persistente

Dueño: Cristhian / HAC-12 + HAC-27. Identificador UML: `O3AsrRVXhiO8iDlZrkKS-37`.

Tabla `public.service_lanes`; RLS activada. Lectura sujeta a políticas/grants; esto no acredita principal de escritura carrier.

| Columna física | Tipo SQL | Nullable |
|---|---|---|
| `id` | `uuid` | no |
| `carrier_service_id` | `uuid` | no |
| `pickup_area_id` | `uuid` | no |
| `delivery_area_id` | `uuid` | no |
| `lane_kind` | `text` | no |
| `transport_mode` | `text` | no |
| `evidence_reference` | `text` | no |
| `verified_at` | `timestamp with time zone` | no |
| `valid_from` | `timestamp with time zone` | no |
| `valid_until` | `timestamp with time zone` | sí |
| `cross_border_review_required` | `boolean` | no |
| `active` | `boolean` | no |
| `created_at` | `timestamp with time zone` | no |
| `updated_at` | `timestamp with time zone` | no |
| `planned_transit_minutes` | `integer` | sí |
| `transit_provenance_status` | `text` | no |
| `cross_border_prohibited` | `boolean` | no |
| `cross_border_prohibition_reference` | `text` | sí |

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `kind: DIRECT \| WITHIN_AREA` | PERSISTIDO | public.service_lanes.lane_kind | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `mode: TransportMode` | PERSISTIDO | public.service_lanes.transport_mode | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `borderReviewRequired: boolean` | PERSISTIDO | public.service_lanes.cross_border_review_required | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `evidence?: EvidenceRef` | PROYECCIÓN | public.service_lanes.evidence_reference / verified_at / valid_from / valid_until | Lane dirigida del mismo servicio; planned_transit_minutes + transit_provenance_status para tiempo. Autorización de frontera no se deduce de cross_border_review_required=false. |
| `validUntil?: Instant` | PERSISTIDO | public.service_lanes.valid_until | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |

## 10. ResponseIntegration — diferido

Dueño: HITO 3–4 / roadmap; asignación antes de activar. Identificador UML: `O3AsrRVXhiO8iDlZrkKS-41`.

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `channel: MANUAL \| API \| MCP` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `endpointRef?: SecretRef` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `verifiedAt?: Instant` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `status: IntegrationStatus` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `evidence?: EvidenceRef` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |

## 11. CapacitySource — derivado

Dueño: Cristhian / HAC-12 + HAC-27. Identificador UML: `O3AsrRVXhiO8iDlZrkKS-45`.

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `sourceId: UUID` | DERIVADO | checks.capacityWindow.sourceId / sourceType + XOR calendario | Discriminado TRANSPORT_ASSET/CAPACITY_POOL; no tabla CapacitySource. |
| `provenance: FulfilmentSource` | PARCIAL | checks.capacityWindow.provenance | DataSource/EvidenceStatus del calendario no equivalen a FulfilmentSource completo del UML. |

## 12. TransportAsset — tabla persistente

Dueño: Cristhian / HAC-12 + HAC-27. Identificador UML: `O3AsrRVXhiO8iDlZrkKS-49`.

Tabla `public.transport_assets`; RLS activada. Lectura sujeta a políticas/grants; esto no acredita principal de escritura carrier.

| Columna física | Tipo SQL | Nullable |
|---|---|---|
| `id` | `uuid` | no |
| `carrier_id` | `uuid` | no |
| `carrier_service_id` | `uuid` | no |
| `code` | `text` | no |
| `mode` | `text` | no |
| `equipment_code` | `text` | no |
| `asset_role` | `text` | no |
| `plate` | `text` | sí |
| `axle_config` | `text` | sí |
| `max_weight_kg` | `numeric(14,2)` | sí |
| `max_volume_m3` | `numeric(14,3)` | sí |
| `active` | `boolean` | no |
| `created_at` | `timestamp with time zone` | no |
| `updated_at` | `timestamp with time zone` | no |

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `id: UUID` | PERSISTIDO | public.transport_assets.id | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `code: string` | PERSISTIDO | public.transport_assets.code | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `equipmentType: EquipmentType` | PERSISTIDO | public.transport_assets.equipment_code | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `usefulCapacityKg: number` | PERSISTIDO | public.transport_assets.max_weight_kg | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `usableVolumeM3?: number` | PERSISTIDO | public.transport_assets.max_volume_m3 | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `operatingStatus: AssetStatus` | SUBCONJUNTO | public.transport_assets.active | No enum AssetStatus completo; reservas/mantenimiento/reposicionamiento se descuentan aparte. |
| `homeDepot?: CarrierDepot` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |

## 13. RoadVehicle — tabla persistente

Dueño: Cristhian / HAC-12 + HAC-27. Identificador UML: `O3AsrRVXhiO8iDlZrkKS-53`.

Tabla `public.transport_assets`; RLS activada. Lectura sujeta a políticas/grants; esto no acredita principal de escritura carrier.

| Columna física | Tipo SQL | Nullable |
|---|---|---|
| `id` | `uuid` | no |
| `carrier_id` | `uuid` | no |
| `carrier_service_id` | `uuid` | no |
| `code` | `text` | no |
| `mode` | `text` | no |
| `equipment_code` | `text` | no |
| `asset_role` | `text` | no |
| `plate` | `text` | sí |
| `axle_config` | `text` | sí |
| `max_weight_kg` | `numeric(14,2)` | sí |
| `max_volume_m3` | `numeric(14,3)` | sí |
| `active` | `boolean` | no |
| `created_at` | `timestamp with time zone` | no |
| `updated_at` | `timestamp with time zone` | no |

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `plate: string` | PARCIAL | public.transport_assets.plate | Nullable en BD frente a requerido UML. Activo compartido mode=ROAD; no registro legal de vehículo confirmado. |
| `registrationCode?: string` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |
| `registeredAt?: LocalDate` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |
| `brand?: string` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |
| `model?: string` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |
| `variant?: string` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |
| `bodyType: VehicleBodyType` | PENDIENTE | Sin columna VehicleBodyType | equipment_code no equivale a bodyType. La compatibilidad S2 usa equipo/peso/volumen y no verifica configuración de carrocería/cubicaje; completar antes de afirmar esa capacidad. |
| `usableDimensions?: Dimensions` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |
| `grossWeightLimitKg?: number` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |
| `odometerKm?: number` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |
| `conditionReason?: AssetConditionReason` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |

## 14. CapacityPool — tabla persistente

Dueño: Cristhian / HAC-12 + HAC-27. Identificador UML: `O3AsrRVXhiO8iDlZrkKS-57`.

Tabla `public.capacity_pools`; RLS activada. Lectura sujeta a políticas/grants; esto no acredita principal de escritura carrier.

| Columna física | Tipo SQL | Nullable |
|---|---|---|
| `id` | `uuid` | no |
| `carrier_id` | `uuid` | no |
| `carrier_service_id` | `uuid` | no |
| `code` | `text` | no |
| `equipment_code` | `text` | sí |
| `max_weight_kg` | `numeric(14,2)` | sí |
| `max_volume_m3` | `numeric(14,3)` | sí |
| `supported_cargo_category_ids` | `uuid[]` | no |
| `active` | `boolean` | no |
| `created_at` | `timestamp with time zone` | no |
| `updated_at` | `timestamp with time zone` | no |

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `id: UUID` | PERSISTIDO | public.capacity_pools.id | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `mode: TransportMode` | PROYECCIÓN | carrier_services.transport_mode vía capacity_pools.carrier_service_id | FK compuesta conserva carrier/servicio; evaluador ROAD únicamente. |
| `serviceWindow: TimeWindow` | PROYECCIÓN | capacity_calendars.available_windows vía capacity_pool_id | XOR y agenda única por pool; ventana con evidencia, no disponibilidad nominal del pool. |
| `declaredCapacity: Capacity` | PARCIAL | capacity_pools.max_weight_kg / max_volume_m3 | Límites nullable. Sin residual/consolidación LTL, resultado UNKNOWN incluso si nominal cabe. |
| `partner: FulfilmentSource` | PENDIENTE | Sin atributo propio en capacity_pools | La evidencia de agenda no demuestra acuerdo con FulfilmentPartner ni cupo residual; impedir LTL eligible sin consolidación/contrato. |
| `evidence: EvidenceRef` | PENDIENTE | Sin atributo propio en capacity_pools | La evidencia de agenda no demuestra acuerdo con FulfilmentPartner ni cupo residual; impedir LTL eligible sin consolidación/contrato. |

## 15. CapacityCalendar — tabla persistente

Dueño: Cristhian / HAC-12 + HAC-27. Identificador UML: `O3AsrRVXhiO8iDlZrkKS-61`.

Tabla `public.capacity_calendars`; RLS activada. Lectura sujeta a políticas/grants; esto no acredita principal de escritura carrier.

| Columna física | Tipo SQL | Nullable |
|---|---|---|
| `id` | `uuid` | no |
| `carrier_service_id` | `uuid` | no |
| `transport_asset_id` | `uuid` | sí |
| `capacity_pool_id` | `uuid` | sí |
| `complete` | `boolean` | no |
| `available_windows` | `jsonb` | no |
| `source_reference` | `text` | no |
| `provenance_status` | `text` | no |
| `observed_at` | `timestamp with time zone` | sí |
| `valid_until` | `timestamp with time zone` | sí |
| `version` | `integer` | no |
| `updated_at` | `timestamp with time zone` | no |
| `ready_pickup_area_id` | `uuid` | sí |

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `timezone: TimeZone` | DERIVADO | Política de instantes ISO con offset y PostgreSQL timestamptz | Normalización UTC para comparación; sin zona operativa IANA persistida ni Schedule local. |
| `horizon: TimeWindow` | PARCIAL | capacity_calendars.available_windows[] + complete + valid_until | Colección de intervalos válidos, no horizonte continuo entre min/max. [] permitido=incompleto; [{}] rechazado por CHECK. |
| `source: DataSource` | PERSISTIDO | public.capacity_calendars.source_reference | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `lastVerifiedAt?: Instant` | PERSISTIDO | public.capacity_calendars.observed_at | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `freshness: EvidenceStatus` | DERIVADO | provenance_status / observed_at / valid_until, evaluate-road.ts | Falta/expiración conserva UNKNOWN; SIMULATED no se presenta como live. No enum adicional persistido. |

## 16. CapacityReservation — tabla persistente

Dueño: Cristhian / HAC-12 + HAC-27. Identificador UML: `O3AsrRVXhiO8iDlZrkKS-65`.

Tabla `public.capacity_reservations`; RLS activada. Lectura sujeta a políticas/grants; esto no acredita principal de escritura carrier.

| Columna física | Tipo SQL | Nullable |
|---|---|---|
| `id` | `uuid` | no |
| `capacity_calendar_id` | `uuid` | no |
| `freight_request_id` | `uuid` | sí |
| `starts_at` | `timestamp with time zone` | no |
| `ends_at` | `timestamp with time zone` | no |
| `status` | `text` | no |
| `created_at` | `timestamp with time zone` | no |

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `occupiedWindow: TimeWindow` | PROYECCIÓN | capacity_reservations.starts_at / ends_at | [start,end), end>start. EXCLUDE GiST(calendar_id =, tstzrange &&) para HELD/CONFIRMED; RELEASED excluido. Adjacent allowed; arbitraje concurrente de BD. |
| `committedCapacity: Capacity` | PARCIAL | Ocupación de la fuente completa en evaluate-road.ts | No columnas de cupo reservado ni suma residual. Bloqueo completo S2; reservas parciales LTL/booking HITO 4. |
| `status: ReservationStatus` | PERSISTIDO | public.capacity_reservations.status | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `reference: string` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en HITO 3–4; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |
| `source: DataSource` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en HITO 3–4; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |
| `id: UUID` | PERSISTIDO | public.capacity_reservations.id | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `planResourceId?: UUID` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en HITO 3–4; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |

## 17. ScheduledMaintenance — tabla persistente

Dueño: Cristhian / HAC-12 + HAC-27. Identificador UML: `O3AsrRVXhiO8iDlZrkKS-69`.

Tabla `public.scheduled_maintenances`; RLS activada. Lectura sujeta a políticas/grants; esto no acredita principal de escritura carrier.

| Columna física | Tipo SQL | Nullable |
|---|---|---|
| `id` | `uuid` | no |
| `transport_asset_id` | `uuid` | no |
| `starts_at` | `timestamp with time zone` | no |
| `ends_at` | `timestamp with time zone` | no |
| `reason` | `text` | no |
| `created_at` | `timestamp with time zone` | no |

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `blockedWindow: TimeWindow` | PROYECCIÓN | scheduled_maintenances.starts_at / ends_at + transport_asset_id | Bloqueo explícito de fuente durante intervalo; reason no equivale a kind/status/source. |
| `kind: MaintenanceType` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |
| `status: MaintenanceStatus` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |
| `source: DataSource` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |

## 18. Driver — diferido

Dueño: HITO 3–4 / roadmap; asignación antes de activar. Identificador UML: `O3AsrRVXhiO8iDlZrkKS-73`.

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `id: UUID` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `fullName: string` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `portalAccount?: CarrierOperator` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `licenseClass: LicenseClass` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `licenseValidUntil: LocalDate` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `qualifications: Qualification[]` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `experienceYears?: number` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `dutyStatus: DutyStatus` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |

## 19. DriverAssignment — diferido

Dueño: HITO 3–4 / roadmap; asignación antes de activar. Identificador UML: `O3AsrRVXhiO8iDlZrkKS-77`.

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `window: TimeWindow` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `role: PRIMARY \| RELIEF` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `status: AssignmentStatus` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `evidence?: EvidenceRef` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |

## 20. VehicleAssignment — diferido

Dueño: HITO 3–4 / roadmap; asignación antes de activar. Identificador UML: `O3AsrRVXhiO8iDlZrkKS-81`.

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `window: TimeWindow` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `status: AssignmentStatus` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `capacityCommitted: Capacity` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `evidence?: EvidenceRef` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |

## 21. AssetStatusEvent — diferido

Dueño: HITO 3–4 / roadmap; asignación antes de activar. Identificador UML: `O3AsrRVXhiO8iDlZrkKS-85`.

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `at: Instant` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `previous: AssetStatus` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `next: AssetStatus` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `reason: AssetConditionReason` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `evidence?: EvidenceRef` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |

## 22. RoutePlan — valor embebido

Dueño: Cristhian / HAC-12 + HAC-27. Identificador UML: `O3AsrRVXhiO8iDlZrkKS-89`.

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `origin: GeoLocation` | DTO PARCIAL | FreightRequest.origin | Contrato de lectura del mapa; HAC-12 retorna routePreview:null. Sin adaptador de ruteo/plan persistido ni geometría real verificada. |
| `destination: GeoLocation` | DTO PARCIAL | FreightRequest.destination | Contrato de lectura del mapa; HAC-12 retorna routePreview:null. Sin adaptador de ruteo/plan persistido ni geometría real verificada. |
| `estimatedDistanceKm?: number` | DTO PARCIAL | routePreview.distanceKm | Contrato de lectura del mapa; HAC-12 retorna routePreview:null. Sin adaptador de ruteo/plan persistido ni geometría real verificada. |
| `estimatedDuration?: Duration` | DTO PARCIAL | routePreview.estimatedTransitHours | Contrato de lectura del mapa; HAC-12 retorna routePreview:null. Sin adaptador de ruteo/plan persistido ni geometría real verificada. |
| `geographicSource: DataSource` | DTO PARCIAL | routePreview.geometrySource | Contrato de lectura del mapa; HAC-12 retorna routePreview:null. Sin adaptador de ruteo/plan persistido ni geometría real verificada. |
| `confidence: EvidenceStatus` | DTO PARCIAL | routePreview.provenanceStatus | Contrato de lectura del mapa; HAC-12 retorna routePreview:null. Sin adaptador de ruteo/plan persistido ni geometría real verificada. |
| `estimatedTolls?: Money` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |
| `borderCostEstimate?: Money` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |

## 23. RouteLeg — valor embebido

Dueño: Cristhian / HAC-12 + HAC-27. Identificador UML: `O3AsrRVXhiO8iDlZrkKS-93`.

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `sequence: number` | DTO PARCIAL | routePreview.legs[].sequence | ROAD/labels; no GeoLocation completa por tramo. Backend devuelve null; geometría solo fixture declarado. |
| `mode: TransportMode` | DTO PARCIAL | routePreview.legs[].mode | ROAD/labels; no GeoLocation completa por tramo. Backend devuelve null; geometría solo fixture declarado. |
| `origin: GeoLocation` | DTO PARCIAL | routePreview.legs[].originLabel | ROAD/labels; no GeoLocation completa por tramo. Backend devuelve null; geometría solo fixture declarado. |
| `destination: GeoLocation` | DTO PARCIAL | routePreview.legs[].destinationLabel | ROAD/labels; no GeoLocation completa por tramo. Backend devuelve null; geometría solo fixture declarado. |
| `borderRequirements: Rule[]` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |
| `estimatedDistanceKm?: number` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |
| `estimatedDuration?: Duration` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |

## 24. RouteCondition — fixture

Dueño: Jean / HAC-13 (mapa: Juan / HAC-15). Identificador UML: `O3AsrRVXhiO8iDlZrkKS-97`.

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `kind: CLOSURE \| DELAY \| HAZARD \| RESTRICTION` | FALTANTE S2 | Fixture RouteCondition todavía no entregado | C-03: Jean/HAC-13 debe agregar caso SIMULATED con kind/location/observedAt/validUntil/source/confidence y controles antes/después; Juan/HAC-15 consume su proyección code/severity/description/provenanceStatus. No feed de tráfico live. |
| `location: GeoLocation` | FALTANTE S2 | Fixture RouteCondition todavía no entregado | C-03: Jean/HAC-13 debe agregar caso SIMULATED con kind/location/observedAt/validUntil/source/confidence y controles antes/después; Juan/HAC-15 consume su proyección code/severity/description/provenanceStatus. No feed de tráfico live. |
| `observedAt: Instant` | FALTANTE S2 | Fixture RouteCondition todavía no entregado | C-03: Jean/HAC-13 debe agregar caso SIMULATED con kind/location/observedAt/validUntil/source/confidence y controles antes/después; Juan/HAC-15 consume su proyección code/severity/description/provenanceStatus. No feed de tráfico live. |
| `validUntil?: Instant` | FALTANTE S2 | Fixture RouteCondition todavía no entregado | C-03: Jean/HAC-13 debe agregar caso SIMULATED con kind/location/observedAt/validUntil/source/confidence y controles antes/después; Juan/HAC-15 consume su proyección code/severity/description/provenanceStatus. No feed de tráfico live. |
| `source: DataSource` | FALTANTE S2 | Fixture RouteCondition todavía no entregado | C-03: Jean/HAC-13 debe agregar caso SIMULATED con kind/location/observedAt/validUntil/source/confidence y controles antes/después; Juan/HAC-15 consume su proyección code/severity/description/provenanceStatus. No feed de tráfico live. |
| `confidence: EvidenceStatus` | FALTANTE S2 | Fixture RouteCondition todavía no entregado | C-03: Jean/HAC-13 debe agregar caso SIMULATED con kind/location/observedAt/validUntil/source/confidence y controles antes/después; Juan/HAC-15 consume su proyección code/severity/description/provenanceStatus. No feed de tráfico live. |

## 25. RouteWaypoint — valor embebido

Dueño: Cristhian / HAC-12 + HAC-27. Identificador UML: `O3AsrRVXhiO8iDlZrkKS-101`.

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `kind: FUEL \| REST \| BORDER \| TRANSFER` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |
| `location: GeoLocation` | DTO PARCIAL | routePreview.legs[].waypoints[].lat / lng / label? | No rol FUEL/REST/BORDER/TRANSFER ni verificación individual. Ruta UNKNOWN no contiene línea. |
| `sequence: number` | DERIVADO | Orden del arreglo waypoints[] | No propiedad sequence explícita; solo orden de renderizado de geometría declarada. |
| `source: DataSource` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |
| `verifiedAt?: Instant` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |

## 26. RoutePlanningPolicy — diferido

Dueño: HITO 3–4 / roadmap; asignación antes de activar. Identificador UML: `O3AsrRVXhiO8iDlZrkKS-105`.

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `version: string` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `objective: RouteObjective` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `constraints: Rule[]` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `weights: WeightSet` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `missingDataRule: Rule` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |

## 27. TransportPlanCandidate — derivado

Dueño: Cristhian / HAC-12 + HAC-27. Identificador UML: `O3AsrRVXhiO8iDlZrkKS-109`.

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `proposedWindow: TimeWindow` | DERIVADO | candidates[].checks.capacityWindow.windowChecked | Proyección ROAD por servicio; candidateId="road:<serviceId>" no UUID persistido. Sin planes comerciales almacenados, no recursos múltiples optimizados. |
| `coverage: EvidenceStatus` | DERIVADO | candidates[].checks.coverage.status | Proyección ROAD por servicio; candidateId="road:<serviceId>" no UUID persistido. Sin planes comerciales almacenados, no recursos múltiples optimizados. |
| `availability: EvidenceStatus` | DERIVADO | candidates[].checks.capacityWindow.status | Proyección ROAD por servicio; candidateId="road:<serviceId>" no UUID persistido. Sin planes comerciales almacenados, no recursos múltiples optimizados. |
| `pendingRequirements: Rule[]` | DERIVADO | candidates[].checks.cargoAndEquipment + reasons[] | Proyección ROAD por servicio; candidateId="road:<serviceId>" no UUID persistido. Sin planes comerciales almacenados, no recursos múltiples optimizados. |
| `exclusionReasons: ReasonCode[]` | DERIVADO | candidates[].reasons[] | Proyección ROAD por servicio; candidateId="road:<serviceId>" no UUID persistido. Sin planes comerciales almacenados, no recursos múltiples optimizados. |
| `id: UUID` | DERIVADO | candidates[].candidateId | Proyección ROAD por servicio; candidateId="road:<serviceId>" no UUID persistido. Sin planes comerciales almacenados, no recursos múltiples optimizados. |

## 28. PlanResource — derivado

Dueño: Cristhian / HAC-12 + HAC-27. Identificador UML: `O3AsrRVXhiO8iDlZrkKS-113`.

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `role: LOAD_BEARING \| AUXILIARY` | DERIVADO PARCIAL | capacity source.asset_role | Inputs internos y checks, no PlanResource DTO/tabla completo. Escolta no aporta carga; UNKNOWN conserva capacidad null; no selección de conjuntos multimodales. |
| `equipment: EquipmentType` | DERIVADO PARCIAL | source.equipment_code / requiredEquipment | Inputs internos y checks, no PlanResource DTO/tabla completo. Escolta no aporta carga; UNKNOWN conserva capacidad null; no selección de conjuntos multimodales. |
| `units: number` | DERIVADO PARCIAL | un recurso portador compatible | Inputs internos y checks, no PlanResource DTO/tabla completo. Escolta no aporta carga; UNKNOWN conserva capacidad null; no selección de conjuntos multimodales. |
| `window: TimeWindow` | DERIVADO PARCIAL | capacityWindow.windowChecked | Inputs internos y checks, no PlanResource DTO/tabla completo. Escolta no aporta carga; UNKNOWN conserva capacidad null; no selección de conjuntos multimodales. |
| `availability: EvidenceStatus` | DERIVADO PARCIAL | capacityWindow.status | Inputs internos y checks, no PlanResource DTO/tabla completo. Escolta no aporta carga; UNKNOWN conserva capacidad null; no selección de conjuntos multimodales. |
| `applicableCapacity?: Capacity` | DERIVADO PARCIAL | availableWeightKg / availableVolumeM3 | Inputs internos y checks, no PlanResource DTO/tabla completo. Escolta no aporta carga; UNKNOWN conserva capacidad null; no selección de conjuntos multimodales. |
| `verificationSource?: EvidenceRef` | DERIVADO PARCIAL | capacityWindow.provenance | Inputs internos y checks, no PlanResource DTO/tabla completo. Escolta no aporta carga; UNKNOWN conserva capacidad null; no selección de conjuntos multimodales. |
| `id: UUID` | DERIVADO PARCIAL | capacityWindow.sourceId | Inputs internos y checks, no PlanResource DTO/tabla completo. Escolta no aporta carga; UNKNOWN conserva capacidad null; no selección de conjuntos multimodales. |

## 29. CarrierOpportunity — diferido

Dueño: HITO 3–4 / roadmap; asignación antes de activar. Identificador UML: `O3AsrRVXhiO8iDlZrkKS-117`.

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `sentAt: Instant` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `responseDeadline: Instant` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `responseChannel: ResponseChannel` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `status: OpportunityStatus` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |

## 30. CarrierOffer — diferido

Dueño: HITO 3–4 / roadmap; asignación antes de activar. Identificador UML: `O3AsrRVXhiO8iDlZrkKS-121`.

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `carrierReference: string` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `price: Money` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `breakdown: OfferCostComponent[]` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `validity: TimeWindow` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `source: OfferSource` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `status: OfferStatus` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `id: UUID` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `issuedAt: Instant` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `estimatedPickupAt?: Instant` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `estimatedDeliveryAt?: Instant` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `transitDuration?: Duration` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `reservableCapacity?: Capacity` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `commercialTerms: Term[]` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `evidence: EvidenceRef[]` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `offerVersion: number` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `supersedesOfferId?: UUID` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `requestId: UUID` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `planCandidateId: UUID` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `opportunityId: UUID` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `carrierId: UUID` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `coveredServiceIds: UUID[]` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `coveredAssignmentIds: UUID[]` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |

## 31. RankedOption — diferido

Dueño: HITO 3–4 / roadmap; asignación antes de activar. Identificador UML: `O3AsrRVXhiO8iDlZrkKS-125`.

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `position: number` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `score?: number` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `explanation: Explanation` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `missingData: MissingDatum[]` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `policyVersion: string` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |

## 32. ScoringPolicy — diferido

Dueño: HITO 3–4 / roadmap; asignación antes de activar. Identificador UML: `O3AsrRVXhiO8iDlZrkKS-129`.

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `version: string` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `objective: RankingObjective` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `weights: WeightSet` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `missingDataRule: Rule` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `tieBreaker: TieBreaker` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |

## 33. Booking — diferido

Dueño: HITO 3–4 / roadmap; asignación antes de activar. Identificador UML: `O3AsrRVXhiO8iDlZrkKS-133`.

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `carrierReference?: string` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `confirmedAt?: Instant` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `id: UUID` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `selectionDecisionId: UUID` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `authorizedAt?: Instant` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `authorizationStatus: AuthorizationStatus` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `carrierConfirmationStatus: CarrierConfirmationStatus` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `capacityEvidence: EvidenceRef[]` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |

## 34. TransportExecution — diferido

Dueño: HITO 3–4 / roadmap; asignación antes de activar. Identificador UML: `O3AsrRVXhiO8iDlZrkKS-137`.

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `id: UUID` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `status: ExecutionStatus` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `plannedWindow: TimeWindow` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `actualStartedAt?: Instant` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `actualCompletedAt?: Instant` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `lastKnownPosition?: GeoLocation` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |

## 35. OperationalIncident — diferido

Dueño: HITO 3–4 / roadmap; asignación antes de activar. Identificador UML: `O3AsrRVXhiO8iDlZrkKS-141`.

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `id: UUID` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `kind: IncidentKind` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `severity: Severity` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `occurredAt: Instant` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `location?: GeoLocation` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `description: string` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `status: IncidentStatus` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `reportedBy: ActorRef` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `evidence: EvidenceRef[]` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |

## 36. IncidentUpdate — diferido

Dueño: HITO 3–4 / roadmap; asignación antes de activar. Identificador UML: `O3AsrRVXhiO8iDlZrkKS-145`.

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `at: Instant` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `actor: ActorRef` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `action: IncidentAction` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `note: string` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `evidence?: EvidenceRef` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |

## 37. LogisticsNode — diferido

Dueño: HITO 3–4 / roadmap; asignación antes de activar. Identificador UML: `z1P_2RDf_z28FQ--q6sC-1`.

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `id: UUID` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `kind: PORT \| TERMINAL \| BORDER \| HUB` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `name: string` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `location: GeoLocation` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `jurisdiction?: string` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `source: DataSource` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `verifiedAt?: Instant` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |

## 38. RouteCorridor — valor embebido

Dueño: Cristhian / HAC-12 + HAC-27. Identificador UML: `z1P_2RDf_z28FQ--q6sC-5`.

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `id: UUID` | DTO PARCIAL | routePreview.corridorCode | Código/metadato de corredor, no entidad geográfica ni grafo; backend null. corridorCode no es UUID de entidad. |
| `mode: TransportMode` | DERIVADO | routePreview.legs[].mode / candidate.service.mode | ROAD únicamente; no combinación multimodal ejecutada. |
| `estimatedDistanceKm?: number` | DTO PARCIAL | routePreview.distanceKm | Código/metadato de corredor, no entidad geográfica ni grafo; backend null. corridorCode no es UUID de entidad. |
| `estimatedDuration?: Duration` | DTO PARCIAL | routePreview.estimatedTransitHours | Código/metadato de corredor, no entidad geográfica ni grafo; backend null. corridorCode no es UUID de entidad. |
| `restrictions: Rule[]` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |
| `source: DataSource` | DTO PARCIAL | routePreview.geometrySource | Código/metadato de corredor, no entidad geográfica ni grafo; backend null. corridorCode no es UUID de entidad. |
| `version: string` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |
| `validUntil?: Instant` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |

## 39. CargoProfile — tabla persistente

Dueño: Cristhian / HAC-12 + HAC-27. Identificador UML: `Btc221LeI3F3ZgxBBoag-1`.

Tabla `public.organization_cargo_profiles`; RLS activada. Lectura sujeta a políticas/grants; esto no acredita principal de escritura carrier.

| Columna física | Tipo SQL | Nullable |
|---|---|---|
| `id` | `uuid` | no |
| `organization_id` | `uuid` | no |
| `cargo_category_id` | `uuid` | no |
| `profile_name` | `text` | no |
| `default_entry_method` | `text` | no |
| `typical_entry_quantity` | `numeric(12,2)` | sí |
| `typical_unit_weight_kg` | `numeric(12,2)` | sí |
| `typical_units_per_entry` | `integer` | no |
| `typical_length_cm` | `numeric(10,2)` | sí |
| `typical_width_cm` | `numeric(10,2)` | sí |
| `typical_height_cm` | `numeric(10,2)` | sí |
| `default_requirements` | `jsonb` | no |
| `preferred_vehicle_classes` | `jsonb` | no |
| `priority` | `smallint` | no |
| `active` | `boolean` | no |
| `created_at` | `timestamp with time zone` | no |
| `updated_at` | `timestamp with time zone` | no |

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `id: UUID` | PERSISTIDO | public.organization_cargo_profiles.id | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `name: string` | PERSISTIDO | public.organization_cargo_profiles.profile_name | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `typicalUnits: CargoUnitTemplate[]` | PARCIAL | organization_cargo_profiles.typical_entry_quantity / typical_unit_weight_kg / typical_units_per_entry / typical_length_cm / typical_width_cm / typical_height_cm | Plantilla plana, no CargoUnitTemplate[]. Precarga no revalida capacidad ni cotización; colección completa pendiente. |
| `requirements: CargoRequirement[]` | PERSISTIDO | organization_cargo_profiles.default_requirements JSONB | Plantilla de captura; no constituye certificación de recurso. |
| `preferredEquipment?: EquipmentType` | PARCIAL | organization_cargo_profiles.preferred_vehicle_classes | Vocabulario histórico de recomendaciones; no convertir REFRIGERATED_TRUCK a REEFER_TRUCK sin mapeo explícito. |
| `updatedAt: Instant` | PERSISTIDO | public.organization_cargo_profiles.updated_at | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |

## 40. CargoCategory — tabla persistente

Dueño: Cristhian / HAC-12 + HAC-27. Identificador UML: `Btc221LeI3F3ZgxBBoag-5`.

Tabla `public.cargo_categories`; RLS activada. Lectura sujeta a políticas/grants; esto no acredita principal de escritura carrier.

| Columna física | Tipo SQL | Nullable |
|---|---|---|
| `id` | `uuid` | no |
| `code` | `text` | no |
| `name` | `text` | no |
| `description` | `text` | sí |
| `active` | `boolean` | no |
| `created_at` | `timestamp with time zone` | no |
| `recommended_entry_methods` | `jsonb` | no |
| `intake_specification_schema` | `jsonb` | no |
| `suggested_requirements` | `jsonb` | no |
| `recommended_vehicle_classes` | `jsonb` | no |
| `updated_at` | `timestamp with time zone` | no |

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `code: string` | PERSISTIDO | public.cargo_categories.code | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `name: string` | PERSISTIDO | public.cargo_categories.name | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `guidance: IntakeGuidance` | PROYECCIÓN | cargo_categories.recommended_entry_methods / intake_specification_schema / suggested_requirements / recommended_vehicle_classes | Guías publicadas en GET intake/options; no evidencia comercial. |
| `suggestedEquipment?: EquipmentType` | PARCIAL | cargo_categories.recommended_vehicle_classes | Recomendación histórica separada de equipmentOptions canónicos. |
| `version: string` | PENDIENTE | No versión por registro | schemaVersion/catalogVersion del API no acredita versionado de cada categoría; evolución de catálogo debe preservar versión antes de ranking/comercio. |

## 41. LoadAllocation — derivado

Dueño: Cristhian / HAC-12 + HAC-27. Identificador UML: `tSlgQZ-C8XsGwiNcLELr-1`.

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `quantity: number` | REGLA PARCIAL | CargoUnit + evaluate-road.ts / cargoAndEquipment.indivisibleUnitsFit | Verifica ajuste de unidad indivisible/peso/volumen; no distribución cargada entre recursos, cubicaje o LoadAllocation persistido. |
| `assignedWeightKg: number` | REGLA PARCIAL | CargoUnit + evaluate-road.ts / cargoAndEquipment.indivisibleUnitsFit | Verifica ajuste de unidad indivisible/peso/volumen; no distribución cargada entre recursos, cubicaje o LoadAllocation persistido. |
| `assignedVolumeM3?: number` | REGLA PARCIAL | CargoUnit + evaluate-road.ts / cargoAndEquipment.indivisibleUnitsFit | Verifica ajuste de unidad indivisible/peso/volumen; no distribución cargada entre recursos, cubicaje o LoadAllocation persistido. |
| `handlingRequirements: Rule[]` | REGLA PARCIAL | CargoUnit + evaluate-road.ts / cargoAndEquipment.indivisibleUnitsFit | Verifica ajuste de unidad indivisible/peso/volumen; no distribución cargada entre recursos, cubicaje o LoadAllocation persistido. |
| `verification: EvidenceStatus` | REGLA PARCIAL | CargoUnit + evaluate-road.ts / cargoAndEquipment.indivisibleUnitsFit | Verifica ajuste de unidad indivisible/peso/volumen; no distribución cargada entre recursos, cubicaje o LoadAllocation persistido. |

## 42. OrganizationMember — tabla persistente

Dueño: Cristhian / HAC-12 + HAC-27. Identificador UML: `QHG-sqxOf2_27DxS7uGC-1`.

Tabla `public.organization_members`; RLS activada. Lectura sujeta a políticas/grants; esto no acredita principal de escritura carrier.

| Columna física | Tipo SQL | Nullable |
|---|---|---|
| `id` | `uuid` | no |
| `organization_id` | `uuid` | no |
| `auth_user_id` | `uuid` | no |
| `display_name` | `text` | no |
| `corporate_email` | `text` | no |
| `role` | `text` | no |
| `status` | `text` | no |
| `created_at` | `timestamp with time zone` | no |
| `updated_at` | `timestamp with time zone` | no |

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `id: MemberId` | PERSISTIDO | public.organization_members.id | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `role: OrganizationRole` | PERSISTIDO | public.organization_members.role | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `status: MemberStatus` | PERSISTIDO | public.organization_members.status | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `contactRef?: ContactRef` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |
| `verifiedAt?: Instant` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |

## 43. McpAccountLink — tabla persistente

Dueño: Axel / HAC-11. Identificador UML: `2xsUHS_toCq_aFvuMJPX-1`.

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `id: UUID` | FALTANTE S2 | public.mcp_account_links: tabla ausente | D-01, entrega HAC-11: persistencia, scopes/tenant/revocación + pruebas; nombres físicos requieren contrato publicado por Axel. |
| `authUserId: UUID` | FALTANTE S2 | public.mcp_account_links: tabla ausente | D-01, entrega HAC-11: persistencia, scopes/tenant/revocación + pruebas; nombres físicos requieren contrato publicado por Axel. |
| `oauthClientId: string` | FALTANTE S2 | public.mcp_account_links: tabla ausente | D-01, entrega HAC-11: persistencia, scopes/tenant/revocación + pruebas; nombres físicos requieren contrato publicado por Axel. |
| `organizationId: UUID` | FALTANTE S2 | public.mcp_account_links: tabla ausente | D-01, entrega HAC-11: persistencia, scopes/tenant/revocación + pruebas; nombres físicos requieren contrato publicado por Axel. |
| `scopes: string[]` | FALTANTE S2 | public.mcp_account_links: tabla ausente | D-01, entrega HAC-11: persistencia, scopes/tenant/revocación + pruebas; nombres físicos requieren contrato publicado por Axel. |
| `provider: ALEXA_PLUS \| OTHER` | FALTANTE S2 | public.mcp_account_links: tabla ausente | D-01, entrega HAC-11: persistencia, scopes/tenant/revocación + pruebas; nombres físicos requieren contrato publicado por Axel. |
| `externalSubjectRef: OpaqueId` | FALTANTE S2 | public.mcp_account_links: tabla ausente | D-01, entrega HAC-11: persistencia, scopes/tenant/revocación + pruebas; nombres físicos requieren contrato publicado por Axel. |
| `status: LinkStatus` | FALTANTE S2 | public.mcp_account_links: tabla ausente | D-01, entrega HAC-11: persistencia, scopes/tenant/revocación + pruebas; nombres físicos requieren contrato publicado por Axel. |
| `verifiedAt: Instant` | FALTANTE S2 | public.mcp_account_links: tabla ausente | D-01, entrega HAC-11: persistencia, scopes/tenant/revocación + pruebas; nombres físicos requieren contrato publicado por Axel. |
| `revokedAt?: Instant` | FALTANTE S2 | public.mcp_account_links: tabla ausente | D-01, entrega HAC-11: persistencia, scopes/tenant/revocación + pruebas; nombres físicos requieren contrato publicado por Axel. |
| `expiresAt?: Instant` | FALTANTE S2 | public.mcp_account_links: tabla ausente | D-01, entrega HAC-11: persistencia, scopes/tenant/revocación + pruebas; nombres físicos requieren contrato publicado por Axel. |

## 44. RepositioningBlock — tabla persistente

Dueño: Cristhian / HAC-12 + HAC-27. Identificador UML: `2yUqBqAz-HDDDDVWFXLk-1`.

Tabla `public.repositioning_blocks`; RLS activada. Lectura sujeta a políticas/grants; esto no acredita principal de escritura carrier.

| Columna física | Tipo SQL | Nullable |
|---|---|---|
| `id` | `uuid` | no |
| `capacity_calendar_id` | `uuid` | no |
| `starts_at` | `timestamp with time zone` | no |
| `ends_at` | `timestamp with time zone` | no |
| `reason` | `text` | no |
| `created_at` | `timestamp with time zone` | no |

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `occupiedWindow: TimeWindow` | PROYECCIÓN | repositioning_blocks.starts_at / ends_at + capacity_calendar_id | Bloqueo explícito; no cálculo de viaje vacío por coordenadas. |
| `origin: GeoLocation` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |
| `nextPickup: GeoLocation` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |
| `estimatedTravel: Duration` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |
| `status: BlockStatus` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |
| `source: DataSource` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |

## 45. OrganizationPreferences — tabla persistente

Dueño: Cristhian / HAC-12 + HAC-27. Identificador UML: `kfH2hY4qMQB0W6QYCK-c-1`.

Tabla `public.organization_preferences`; RLS activada. Lectura sujeta a políticas/grants; esto no acredita principal de escritura carrier.

| Columna física | Tipo SQL | Nullable |
|---|---|---|
| `id` | `uuid` | no |
| `organization_id` | `uuid` | no |
| `default_strategy` | `text` | no |
| `max_pickup_wait_hours` | `numeric(8,2)` | no |
| `preferred_carrier_id` | `uuid` | sí |
| `preferred_vehicle_brand` | `text` | sí |
| `budget_default` | `numeric(14,2)` | sí |
| `allow_auto_booking` | `boolean` | no |
| `confidence_threshold` | `numeric(5,2)` | no |
| `created_at` | `timestamp with time zone` | no |
| `allow_auto_recovery` | `boolean` | no |
| `anomaly_threshold_pct` | `numeric(5,2)` | no |
| `billing_mode` | `text` | no |
| `selection_mode` | `text` | no |
| `updated_at` | `timestamp with time zone` | no |

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `objective?: RankingObjective` | PARCIAL | organization_preferences.default_strategy | Preferencia legacy; HITO 3 necesita ScoringPolicy. No ranking S2 ejecutado. |
| `maximumWait?: Duration` | PROYECCIÓN | organization_preferences.max_pickup_wait_hours | Unidad horas; lectura/precarga no impone por sí sola regla S2. |
| `preferredMode?: TransportMode` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en HITO 3–4; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |
| `preferredEquipment?: EquipmentType` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en HITO 3–4; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |
| `usualBudget?: Money` | PARCIAL | organization_preferences.budget_default | Importe legacy sin moneda propia; DTO V2 exige USD explícito, no conversión implícita. |
| `validUntil?: Instant` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en HITO 3–4; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |

## 46. CarrierMetric — diferido

Dueño: HITO 3–4 / roadmap; asignación antes de activar. Identificador UML: `0Y_tfA8dPl5QV5JYcC4k-1`.

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `period: TimeWindow` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `corridorRef?: CorridorId` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `mode?: TransportMode` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `sampleSize: number` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `onTimeRate?: number` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `successfulDeliveryRate?: number` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `source: DataSource` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |

## 47. VehicleCombination — diferido

Dueño: HITO 3–4 / roadmap; asignación antes de activar. Identificador UML: `O51x0XQe5X2G-se8lcug-5`.

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `id: UUID` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `kind: CombinationType` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `configuration: string` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `coupledWindow?: TimeWindow` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `evidence: EvidenceRef[]` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `combinedTareKg?: number` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `grossWeightLimitKg?: number` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `status: CombinationStatus` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |

## 48. ServiceArea — tabla persistente

Dueño: Cristhian / HAC-12 + HAC-27. Identificador UML: `O3AsrRVXhiO8iDlZrkKS-33`.

Tabla `public.service_areas`; RLS activada. Lectura sujeta a políticas/grants; esto no acredita principal de escritura carrier.

| Columna física | Tipo SQL | Nullable |
|---|---|---|
| `id` | `uuid` | no |
| `carrier_service_id` | `uuid` | no |
| `area_role` | `text` | no |
| `coverage` | `text` | no |
| `granularity` | `text` | no |
| `country_code` | `text` | no |
| `region_code` | `text` | sí |
| `city` | `text` | sí |
| `postal_code` | `text` | sí |
| `fulfilment_source` | `text` | no |
| `partner_reference` | `text` | sí |
| `evidence_reference` | `text` | no |
| `verified_at` | `timestamp with time zone` | no |
| `valid_from` | `timestamp with time zone` | no |
| `valid_until` | `timestamp with time zone` | sí |
| `active` | `boolean` | no |
| `created_at` | `timestamp with time zone` | no |
| `updated_at` | `timestamp with time zone` | no |

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `role: PICKUP \| DELIVERY` | PERSISTIDO | public.service_areas.area_role | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `inclusion: INCLUDE \| EXCLUDE` | PERSISTIDO | public.service_areas.coverage | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `geography: Geography` | PROYECCIÓN | service_areas.granularity / country_code / region_code / city / postal_code | Área declarada por rol, no polígono geocodificado ni cobertura por proximidad. |
| `source: CoverageSource` | PROYECCIÓN | service_areas.fulfilment_source / partner_reference | Partner_reference no verifica acuerdo de socio; excluir inferencias de cobertura. |
| `evidence?: EvidenceRef` | PROYECCIÓN | service_areas.evidence_reference + verified_at + valid_from / valid_until | Se verifica sobre la ventana pertinente de recojo/entrega. |
| `validUntil?: Instant` | PERSISTIDO | public.service_areas.valid_until | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `verifiedAt?: Instant` | PERSISTIDO | public.service_areas.verified_at | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |
| `validFrom?: Instant` | PERSISTIDO | public.service_areas.valid_from | Columna real; no acredita por sí sola flujo de edición, CRUD ni integración live. |

## 49. FulfilmentPartner — diferido

Dueño: HITO 3–4 / roadmap; asignación antes de activar. Identificador UML: `ew-K-2JuWHNgvpUnc-Aj-1`.

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `id: UUID` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `registeredName: string` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `partnerCarrierRef?: UUID` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `agreementValidFrom: Instant` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `agreementValidUntil: Instant` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `status: PartnerStatus` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |
| `coverageEvidence: EvidenceRef` | DIFERIDO | Sin implementación V2 activa | Roadmap; no prometer en Gate-2 |

## 50. PlanLegAssignment — derivado

Dueño: Cristhian / HAC-12 + HAC-27. Identificador UML: `bh65ahPy-3lvovsz0reF-1`.

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `sequence: number` | DERIVADO PARCIAL | candidato ROAD / servicio único + checks | Asignación implícita S2, sin objeto PlanLegAssignment/ID/Responsibility persistidos. Asignación explícita y múltiples tramos HITO 3. |
| `window: TimeWindow` | DERIVADO PARCIAL | candidato ROAD / servicio único + checks | Asignación implícita S2, sin objeto PlanLegAssignment/ID/Responsibility persistidos. Asignación explícita y múltiples tramos HITO 3. |
| `responsibility: Responsibility` | DERIVADO PARCIAL | candidato ROAD / servicio único + checks | Asignación implícita S2, sin objeto PlanLegAssignment/ID/Responsibility persistidos. Asignación explícita y múltiples tramos HITO 3. |
| `coverage: EvidenceStatus` | DERIVADO PARCIAL | candidato ROAD / servicio único + checks | Asignación implícita S2, sin objeto PlanLegAssignment/ID/Responsibility persistidos. Asignación explícita y múltiples tramos HITO 3. |
| `availability: EvidenceStatus` | DERIVADO PARCIAL | candidato ROAD / servicio único + checks | Asignación implícita S2, sin objeto PlanLegAssignment/ID/Responsibility persistidos. Asignación explícita y múltiples tramos HITO 3. |
| `capacityNeeded: Capacity` | DERIVADO PARCIAL | candidato ROAD / servicio único + checks | Asignación implícita S2, sin objeto PlanLegAssignment/ID/Responsibility persistidos. Asignación explícita y múltiples tramos HITO 3. |
| `evidence: EvidenceRef[]` | DERIVADO PARCIAL | candidato ROAD / servicio único + checks | Asignación implícita S2, sin objeto PlanLegAssignment/ID/Responsibility persistidos. Asignación explícita y múltiples tramos HITO 3. |
| `id: UUID` | DERIVADO PARCIAL | candidato ROAD / servicio único + checks | Asignación implícita S2, sin objeto PlanLegAssignment/ID/Responsibility persistidos. Asignación explícita y múltiples tramos HITO 3. |

## 51. OfferCostComponent — diferido

Dueño: HITO 3–4 / roadmap; asignación antes de activar. Identificador UML: `2Kmcv4Ad8FPmq66OwCHh-1`.

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `kind: CostKind` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `amount?: Money` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `treatment: INCLUDED \| QUOTED \| ESTIMATED \| EXCLUDED \| UNKNOWN` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `source: DataSource` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `observedAt: Instant` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `details?: string` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |

## 52. ShipmentContact — valor embebido

Dueño: Cristhian / HAC-12 + HAC-27. Identificador UML: `cK54gk-s0bDDQeAMSFYk-1`.

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `role: PICKUP \| RECIPIENT` | EMBEBIDO | claves contacts.pickup / contacts.recipient | Pickup y recipient requeridos; nombre/teléfono no vacíos; E164. Email opcional/null. Planos: pickup_contact_* y receiver_name/receiver_phone/recipient_contact_email. |
| `name: string` | EMBEBIDO | freight_requests.v2_snapshot.contacts.[pickup\|recipient].name | Pickup y recipient requeridos; nombre/teléfono no vacíos; E164. Email opcional/null. Planos: pickup_contact_* y receiver_name/receiver_phone/recipient_contact_email. |
| `company?: string` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |
| `phone: E164Phone` | EMBEBIDO | freight_requests.v2_snapshot.contacts.[pickup\|recipient].phoneE164 | Pickup y recipient requeridos; nombre/teléfono no vacíos; E164. Email opcional/null. Planos: pickup_contact_* y receiver_name/receiver_phone/recipient_contact_email. |
| `email?: EmailAddress` | EMBEBIDO | freight_requests.v2_snapshot.contacts.[pickup\|recipient].email | Pickup y recipient requeridos; nombre/teléfono no vacíos; E164. Email opcional/null. Planos: pickup_contact_* y receiver_name/receiver_phone/recipient_contact_email. |
| `addressDetail?: string` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |
| `handlingInstructions?: string` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |

## 53. CarrierOperator — diferido

Dueño: HITO 3–4 / roadmap; asignación antes de activar. Identificador UML: `mC9G5v3rfbQ6b9Yc-kdd-1`.

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `id: UUID` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `displayName: string` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `role: CarrierRole` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `email?: EmailAddress` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `phone?: E164Phone` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `status: MemberStatus` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `verifiedAt?: Instant` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |

## 54. AssetCargoCapability — tabla persistente

Dueño: Cristhian / HAC-12 + HAC-27. Identificador UML: `qge8m_vvFhvRPB6Z5rw--1`.

Tabla `public.asset_cargo_capabilities`; RLS activada. Lectura sujeta a políticas/grants; esto no acredita principal de escritura carrier.

| Columna física | Tipo SQL | Nullable |
|---|---|---|
| `transport_asset_id` | `uuid` | no |
| `cargo_category_id` | `uuid` | no |
| `temperature_min_c` | `numeric(6,2)` | sí |
| `temperature_max_c` | `numeric(6,2)` | sí |
| `certifications` | `jsonb` | no |

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `requirements: CargoRequirement[]` | PARCIAL | asset_cargo_capabilities.certifications JSONB | Códigos del mismo activo por categoría; no DocumentRef/autoridad emisora; requisitos de revisión no se confirman con una etiqueta. |
| `maxWeightKg?: number` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |
| `temperatureRange?: TemperatureRange` | PROYECCIÓN | asset_cargo_capabilities.temperature_min_c / temperature_max_c | Rango comparable contra carga en el mismo portador; no combinar activos distintos. |
| `evidence?: EvidenceRef` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |
| `validUntil?: Instant` | PENDIENTE | Sin representación implementada | Campo UML conservado. Implementación/decisión de alcance explícita pendiente en evolución de modelo/roadmap; no presentarlo como probado. Si es requisito duro del caso, mantener UNKNOWN/no activar esa capacidad. |

## 55. RouteSimulationScenario — fixture

Dueño: Jean / HAC-13 (mapa: Juan / HAC-15). Identificador UML: `jSKYVkFkDFWJeImlZA73-1`.

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `id: ScenarioId` | FIXTURE PARCIAL | supabase/scenarios/v2-road-baseline/{seed.sql,fixtures/*.json,verify.sql} + v2-hac12-road-capacity | Seed reproducible, UUID fijos, expected outcomes y reloj de casos; no entidad completa ScenarioId/networkVersion. Completitud del objeto pendiente QA, sin datos sintéticos en migraciones. |
| `label: string` | FIXTURE PARCIAL | supabase/scenarios/v2-road-baseline/{seed.sql,fixtures/*.json,verify.sql} + v2-hac12-road-capacity | Seed reproducible, UUID fijos, expected outcomes y reloj de casos; no entidad completa ScenarioId/networkVersion. Completitud del objeto pendiente QA, sin datos sintéticos en migraciones. |
| `seed: string` | FIXTURE PARCIAL | supabase/scenarios/v2-road-baseline/{seed.sql,fixtures/*.json,verify.sql} + v2-hac12-road-capacity | Seed reproducible, UUID fijos, expected outcomes y reloj de casos; no entidad completa ScenarioId/networkVersion. Completitud del objeto pendiente QA, sin datos sintéticos en migraciones. |
| `networkVersion: string` | FIXTURE PARCIAL | supabase/scenarios/v2-road-baseline/{seed.sql,fixtures/*.json,verify.sql} + v2-hac12-road-capacity | Seed reproducible, UUID fijos, expected outcomes y reloj de casos; no entidad completa ScenarioId/networkVersion. Completitud del objeto pendiente QA, sin datos sintéticos en migraciones. |
| `clock: Instant` | FIXTURE PARCIAL | supabase/scenarios/v2-road-baseline/{seed.sql,fixtures/*.json,verify.sql} + v2-hac12-road-capacity | Seed reproducible, UUID fijos, expected outcomes y reloj de casos; no entidad completa ScenarioId/networkVersion. Completitud del objeto pendiente QA, sin datos sintéticos en migraciones. |
| `source: SYNTHETIC` | FIXTURE PARCIAL | supabase/scenarios/v2-road-baseline/{seed.sql,fixtures/*.json,verify.sql} + v2-hac12-road-capacity | Seed reproducible, UUID fijos, expected outcomes y reloj de casos; no entidad completa ScenarioId/networkVersion. Completitud del objeto pendiente QA, sin datos sintéticos en migraciones. |
| `expectedOutcome: RouteDecision` | FIXTURE PARCIAL | supabase/scenarios/v2-road-baseline/{seed.sql,fixtures/*.json,verify.sql} + v2-hac12-road-capacity | Seed reproducible, UUID fijos, expected outcomes y reloj de casos; no entidad completa ScenarioId/networkVersion. Completitud del objeto pendiente QA, sin datos sintéticos en migraciones. |

## 56. RoutePlanner — derivado

Dueño: Cristhian / HAC-12 + HAC-27. Identificador UML: `KK_tjLDiXekPh69OoodI-1`.

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `algorithmVersion: string` | PARCIAL | evaluate-road.ts + commit Git de la entrega | Evaluador determinístico de servicio, no optimizador geográfico. No algorithmVersion en respuesta; versionado de algoritmo explícito pendiente. |
| `graphVersion: string` | PENDIENTE | Sin grafo de rutas ni versión de red cargada | No producir ruta live desde pins. Adoptar adaptador/fuente versionada con HAC-15/contrato de mapas antes de activar. |
| `source: DataSource` | DERIVADO PARCIAL | evaluate-v2-road.ts / evidencia de repositorio ROAD | Aplicación compartida, no servicio geográfico de proveedor; routePreview:null. |

## 57. SelectionDecision — diferido

Dueño: HITO 3–4 / roadmap; asignación antes de activar. Identificador UML: `3-0FiohA2Rbrks3vgz_X-1`.

| Atributo y tipo UML | Tratamiento | Representación real | Límite / criterio de activación |
|---|---|---|---|
| `id: UUID` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `selectedAt: Instant` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `rationale: Explanation` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `policyVersion?: string` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `consideredOptions: OptionRef[]` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `status: DecisionStatus` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `evidence: EvidenceRef[]` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `selectedPlanId: UUID` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |
| `selectedOfferIds: UUID[]` | DIFERIDO | Sin implementación V2 activa | HITO 3–4 |

## Relaciones: inventario de las 93 aristas

Se contrasta el vínculo físico cuando existe. Una FK acredita referencialidad, no todas las multiplicidades/acciones de dominio del UML. Las composiciones de DTO no se presentan como FK. Las cardinalidades dibujadas permanecen en el editable original y requieren controles particulares antes de activar extensiones del modelo.

| # | Origen → destino (UML) | Relación UML | Evidencia S2 / estado |
|---|---|---|---|
| 1 | `Organization` → `Facility` | registra | FK: facilities: FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE |
| 2 | `Organization` → `FreightRequest` | presenta | FK: freight_requests: FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE |
| 3 | `Facility` → `FreightRequest` | origen | FK: freight_requests: FOREIGN KEY (destination_facility_id, organization_id) REFERENCES facilities(id, organization_id); freight_requests: FOREIGN KEY (origin_facility_id, organization_id) REFERENCES facilities(id, organization_id) |
| 4 | `Facility` → `FreightRequest` | destino | FK: freight_requests: FOREIGN KEY (destination_facility_id, organization_id) REFERENCES facilities(id, organization_id); freight_requests: FOREIGN KEY (origin_facility_id, organization_id) REFERENCES facilities(id, organization_id) |
| 5 | `FreightRequest` → `CargoSpecification` | describe | DTO/JSON PARCIAL: consultar filas de atributos; ruta backend null, no todas las asociaciones del diseño implementadas. |
| 6 | `CargoSpecification` → `CargoUnit` | contiene al enviar | DTO/JSON PARCIAL: consultar filas de atributos; ruta backend null, no todas las asociaciones del diseño implementadas. |
| 7 | `Carrier` → `CarrierDepot` | opera | FK: carrier_depots: FOREIGN KEY (carrier_id) REFERENCES carriers(id) ON DELETE CASCADE |
| 8 | `Carrier` → `CarrierService` | publica | FK: carrier_services: FOREIGN KEY (carrier_id) REFERENCES carriers(id) ON DELETE CASCADE |
| 9 | `CarrierService` → `ServiceArea` | declara | FK: service_areas: FOREIGN KEY (carrier_service_id) REFERENCES carrier_services(id) ON DELETE CASCADE |
| 10 | `CarrierService` → `ServiceLane` | declara | FK: service_lanes: FOREIGN KEY (carrier_service_id) REFERENCES carrier_services(id) ON DELETE CASCADE |
| 11 | `ServiceArea` → `ServiceLane` | origen cubierto | FK: service_lanes: FOREIGN KEY (delivery_area_id, carrier_service_id) REFERENCES service_areas(id, carrier_service_id) ON DELETE CASCADE; service_lanes: FOREIGN KEY (pickup_area_id, carrier_service_id) REFERENCES service_areas(id, carrier_service_id) ON DELETE CASCADE |
| 12 | `ServiceArea` → `ServiceLane` | destino cubierto | FK: service_lanes: FOREIGN KEY (delivery_area_id, carrier_service_id) REFERENCES service_areas(id, carrier_service_id) ON DELETE CASCADE; service_lanes: FOREIGN KEY (pickup_area_id, carrier_service_id) REFERENCES service_areas(id, carrier_service_id) ON DELETE CASCADE |
| 13 | `CarrierService` → `ResponseIntegration` | responde por | DIFERIDO: sin flujo V2 operativo; conservar relación para su hito. |
| 14 | `Carrier` → `TransportAsset` | gestiona | FK: transport_assets: FOREIGN KEY (carrier_id) REFERENCES carriers(id) |
| 15 | `CarrierDepot` → `TransportAsset` | base física | PENDIENTE: sin FK directa entre esas tablas; no certificar multiplicidad/equivalencia UML. |
| 16 | `RoadVehicle` → `TransportAsset` | especializa | SUBTIPO: ambos en public.transport_assets, mode=ROAD; atributos RoadVehicle incompletos. |
| 17 | `TransportAsset` → `CapacitySource` | realiza | DERIVADO PARCIAL: evaluador ROAD compartido; sin entidad/FK/plan multimodal completo. |
| 18 | `CapacityPool` → `CapacitySource` | realiza | DERIVADO PARCIAL: evaluador ROAD compartido; sin entidad/FK/plan multimodal completo. |
| 19 | `CarrierService` → `CapacityPool` | usa cupo | FK: capacity_pools: FOREIGN KEY (carrier_service_id, carrier_id) REFERENCES carrier_services(id, carrier_id) |
| 20 | `CapacitySource` → `CapacityCalendar` | agenda | DERIVADO PARCIAL: evaluador ROAD compartido; sin entidad/FK/plan multimodal completo. |
| 21 | `CapacityCalendar` → `CapacityReservation` | registra | FK: capacity_reservations: FOREIGN KEY (capacity_calendar_id) REFERENCES capacity_calendars(id) ON DELETE CASCADE |
| 22 | `TransportAsset` → `ScheduledMaintenance` | bloquea | FK: scheduled_maintenances: FOREIGN KEY (transport_asset_id) REFERENCES transport_assets(id) ON DELETE CASCADE |
| 23 | `TransportAsset` → `AssetStatusEvent` | historial | DIFERIDO: sin flujo V2 operativo; conservar relación para su hito. |
| 24 | `Carrier` → `Driver` | habilita | DIFERIDO: sin flujo V2 operativo; conservar relación para su hito. |
| 25 | `Driver` → `DriverAssignment` | asignado | DIFERIDO: sin flujo V2 operativo; conservar relación para su hito. |
| 26 | `RoadVehicle` → `VehicleAssignment` | asignado | DIFERIDO: sin flujo V2 operativo; conservar relación para su hito. |
| 27 | `FreightRequest` → `TransportPlanCandidate` | genera | DERIVADO PARCIAL: evaluador ROAD compartido; sin entidad/FK/plan multimodal completo. |
| 28 | `TransportPlanCandidate` → `RoutePlan` | propone | DTO/JSON PARCIAL: consultar filas de atributos; ruta backend null, no todas las asociaciones del diseño implementadas. |
| 29 | `RoutePlan` → `RouteLeg` | contiene | DTO/JSON PARCIAL: consultar filas de atributos; ruta backend null, no todas las asociaciones del diseño implementadas. |
| 30 | `RoutePlan` → `RouteWaypoint` | incluye | DTO/JSON PARCIAL: consultar filas de atributos; ruta backend null, no todas las asociaciones del diseño implementadas. |
| 31 | `RouteLeg` → `RouteCondition` | afectado por | FALTANTE S2: fixture y proyección HAC-13/HAC-15; no feed live. |
| 32 | `RoutePlanningPolicy` → `RoutePlan` | evalúa | DIFERIDO: sin flujo V2 operativo; conservar relación para su hito. |
| 33 | `TransportPlanCandidate` → `PlanResource` | requiere | DERIVADO PARCIAL: evaluador ROAD compartido; sin entidad/FK/plan multimodal completo. |
| 34 | `TransportPlanCandidate` → `CarrierService` | /servicios por tramo (derivada de PlanLegAssignment) | DERIVADO PARCIAL: evaluador ROAD compartido; sin entidad/FK/plan multimodal completo. |
| 35 | `PlanResource` → `RouteLeg` | asignado a | DTO/JSON PARCIAL: consultar filas de atributos; ruta backend null, no todas las asociaciones del diseño implementadas. |
| 36 | `PlanResource` → `CapacitySource` | usa fuente | DERIVADO PARCIAL: evaluador ROAD compartido; sin entidad/FK/plan multimodal completo. |
| 37 | `TransportPlanCandidate` → `CarrierOpportunity` | propone | DIFERIDO: sin flujo V2 operativo; conservar relación para su hito. |
| 38 | `Carrier` → `CarrierOpportunity` | invitado | DIFERIDO: sin flujo V2 operativo; conservar relación para su hito. |
| 39 | `CarrierOpportunity` → `CarrierOffer` | recibe | DIFERIDO: sin flujo V2 operativo; conservar relación para su hito. |
| 40 | `Carrier` → `CarrierOffer` | emite | DIFERIDO: sin flujo V2 operativo; conservar relación para su hito. |
| 41 | `CarrierOffer` → `RankedOption` | evaluada como | DIFERIDO: sin flujo V2 operativo; conservar relación para su hito. |
| 42 | `ScoringPolicy` → `RankedOption` | calcula | DIFERIDO: sin flujo V2 operativo; conservar relación para su hito. |
| 43 | `CarrierOffer` → `Booking` | fundamenta | DIFERIDO: sin flujo V2 operativo; conservar relación para su hito. |
| 44 | `Booking` → `TransportExecution` | inicia | DIFERIDO: sin flujo V2 operativo; conservar relación para su hito. |
| 45 | `TransportExecution` → `DriverAssignment` | tripulación | DIFERIDO: sin flujo V2 operativo; conservar relación para su hito. |
| 46 | `TransportExecution` → `VehicleAssignment` | equipo | DIFERIDO: sin flujo V2 operativo; conservar relación para su hito. |
| 47 | `TransportExecution` → `OperationalIncident` | registra | DIFERIDO: sin flujo V2 operativo; conservar relación para su hito. |
| 48 | `OperationalIncident` → `IncidentUpdate` | bitácora | DIFERIDO: sin flujo V2 operativo; conservar relación para su hito. |
| 49 | `OperationalIncident` → `RouteCondition` | evidencia vial | DIFERIDO: sin flujo V2 operativo; conservar relación para su hito. |
| 50 | `LogisticsNode` → `RouteCorridor` | inicio dirigido | DIFERIDO: sin flujo V2 operativo; conservar relación para su hito. |
| 51 | `LogisticsNode` → `RouteCorridor` | fin dirigido | DIFERIDO: sin flujo V2 operativo; conservar relación para su hito. |
| 52 | `RouteCorridor` → `RouteLeg` | tramo sobre corredor | DTO/JSON PARCIAL: consultar filas de atributos; ruta backend null, no todas las asociaciones del diseño implementadas. |
| 53 | `CargoProfile` → `CargoCategory` | clasifica | FK: organization_cargo_profiles: FOREIGN KEY (cargo_category_id) REFERENCES cargo_categories(id) |
| 54 | `Organization` → `CargoProfile` | guarda | FK: organization_cargo_profiles: FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE |
| 55 | `CargoUnit` → `LoadAllocation` | se distribuye en | DTO/JSON PARCIAL: consultar filas de atributos; ruta backend null, no todas las asociaciones del diseño implementadas. |
| 56 | `PlanResource` → `LoadAllocation` | transporta | DERIVADO PARCIAL: evaluador ROAD compartido; sin entidad/FK/plan multimodal completo. |
| 57 | `OrganizationMember` → `Organization` | miembros autorizados | FK: organization_members: FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE |
| 58 | `OrganizationMember` → `McpAccountLink` | vincula cuenta | FALTANTE S2: migración/contrato HAC-11 pendiente. |
| 59 | `CapacityCalendar` → `RepositioningBlock` | bloquea por traslado | FK: repositioning_blocks: FOREIGN KEY (capacity_calendar_id) REFERENCES capacity_calendars(id) ON DELETE CASCADE |
| 60 | `Organization` → `OrganizationPreferences` | configura | FK: organization_preferences: FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE |
| 61 | `Carrier` → `CarrierMetric` | métricas con muestra | DIFERIDO: sin flujo V2 operativo; conservar relación para su hito. |
| 62 | `VehicleCombination` → `PlanResource` | unidad combinada | DIFERIDO: sin flujo V2 operativo; conservar relación para su hito. |
| 63 | `VehicleCombination` → `TransportAsset` | agrupa activos | DIFERIDO: sin flujo V2 operativo; conservar relación para su hito. |
| 64 | `FulfilmentPartner` → `ServiceArea` | respalda cobertura | DIFERIDO: sin flujo V2 operativo; conservar relación para su hito. |
| 65 | `FulfilmentPartner` → `CapacityPool` | aporta cupo | DIFERIDO: sin flujo V2 operativo; conservar relación para su hito. |
| 66 | `Carrier` → `FulfilmentPartner` | registra socio | DIFERIDO: sin flujo V2 operativo; conservar relación para su hito. |
| 67 | `FulfilmentPartner` → `PlanLegAssignment` | ejecuta por acuerdo | DIFERIDO: sin flujo V2 operativo; conservar relación para su hito. |
| 68 | `PlanLegAssignment` → `RouteLeg` | usa tramo | DTO/JSON PARCIAL: consultar filas de atributos; ruta backend null, no todas las asociaciones del diseño implementadas. |
| 69 | `TransportPlanCandidate` → `PlanLegAssignment` | desglosa por tramo | DERIVADO PARCIAL: evaluador ROAD compartido; sin entidad/FK/plan multimodal completo. |
| 70 | `PlanLegAssignment` → `PlanResource` | recursos del tramo | DERIVADO PARCIAL: evaluador ROAD compartido; sin entidad/FK/plan multimodal completo. |
| 71 | `PlanLegAssignment` → `CarrierService` | servicio responsable | DERIVADO PARCIAL: evaluador ROAD compartido; sin entidad/FK/plan multimodal completo. |
| 72 | `CarrierOffer` → `PlanLegAssignment` | cotiza tramos atribuibles | DIFERIDO: sin flujo V2 operativo; conservar relación para su hito. |
| 73 | `CarrierOffer` → `OfferCostComponent` | desglosa costos | DIFERIDO: sin flujo V2 operativo; conservar relación para su hito. |
| 74 | `FreightRequest` → `ShipmentContact` | receptor de entrega · RECIPIENT | DTO/JSON PARCIAL: consultar filas de atributos; ruta backend null, no todas las asociaciones del diseño implementadas. |
| 75 | `CarrierOperator` → `CarrierOffer` | emite manualmente | DIFERIDO: sin flujo V2 operativo; conservar relación para su hito. |
| 76 | `CarrierOperator` → `Carrier` | pertenece a | DIFERIDO: sin flujo V2 operativo; conservar relación para su hito. |
| 77 | `AssetCargoCapability` → `TransportAsset` | capacidades de carga | FK: asset_cargo_capabilities: FOREIGN KEY (transport_asset_id) REFERENCES transport_assets(id) ON DELETE CASCADE |
| 78 | `CargoCategory` → `AssetCargoCapability` | categoría compatible | FK: asset_cargo_capabilities: FOREIGN KEY (cargo_category_id) REFERENCES cargo_categories(id) |
| 79 | `RouteSimulationScenario` → `RouteCorridor` | red sintética versionada | FIXTURE PARCIAL: escenario aislado y resultado esperado; sin vínculo persistente completo. |
| 80 | `RouteSimulationScenario` → `RouteCondition` | inyecta eventos | FALTANTE S2: fixture y proyección HAC-13/HAC-15; no feed live. |
| 81 | `RoutePlanner` → `RoutePlan` | genera alternativas | DTO/JSON PARCIAL: consultar filas de atributos; ruta backend null, no todas las asociaciones del diseño implementadas. |
| 82 | `RoutePlanner` → `RoutePlanningPolicy` | consulta política versionada | DIFERIDO: sin flujo V2 operativo; conservar relación para su hito. |
| 83 | `RoutePlanner` → `RouteCorridor` | evalúa red | DTO/JSON PARCIAL: consultar filas de atributos; ruta backend null, no todas las asociaciones del diseño implementadas. |
| 84 | `SelectionDecision` → `Booking` | autoriza reserva | DIFERIDO: sin flujo V2 operativo; conservar relación para su hito. |
| 85 | `OrganizationMember` → `SelectionDecision` | decide | DIFERIDO: sin flujo V2 operativo; conservar relación para su hito. |
| 86 | `CarrierOffer` → `SelectionDecision` | oferta elegida | DIFERIDO: sin flujo V2 operativo; conservar relación para su hito. |
| 87 | `FreightRequest` → `SelectionDecision` | decisión auditada | DIFERIDO: sin flujo V2 operativo; conservar relación para su hito. |
| 88 | `TransportPlanCandidate` → `SelectionDecision` | plan seleccionado | DIFERIDO: sin flujo V2 operativo; conservar relación para su hito. |
| 89 | `FreightRequest` → `CarrierOffer` | referencia de lo cotizado | DIFERIDO: sin flujo V2 operativo; conservar relación para su hito. |
| 90 | `PlanResource` → `CapacityReservation` | ocupa capacidad en ventana | DERIVADO PARCIAL: evaluador ROAD compartido; sin entidad/FK/plan multimodal completo. |
| 91 | `FreightRequest` → `ShipmentContact` | contacto de recojo · PICKUP | DTO/JSON PARCIAL: consultar filas de atributos; ruta backend null, no todas las asociaciones del diseño implementadas. |
| 92 | `CarrierOffer` → `CarrierService` | cubre servicio | DIFERIDO: sin flujo V2 operativo; conservar relación para su hito. |
| 93 | `Booking` → `CapacityReservation` | compromete capacidad | DIFERIDO: sin flujo V2 operativo; conservar relación para su hito. |

## Criterio de aceptación documental

Revisor verifica 57 encabezados de clase, 397 filas de atributo y 93 aristas contra el UML original; comprueba nombres físicos/enums con migraciones y casos de DTO. C-01/C-02 pueden cerrarse como documentación publicada y revisada sin convertir filas pendientes en implementación completa. HAC-12/HAC-11/HAC-13 y el gate conservan sus criterios funcionales. La migración alojada requiere aprobación/preflight aparte.
