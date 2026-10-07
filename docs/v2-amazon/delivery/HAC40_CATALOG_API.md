# HAC-40 — Catálogo B1 implementado

Rama: `codex/v2-full-backend`. Migración aditiva: `20261004032151_hac40_catalog.sql`.
Este contrato describe código y PostgreSQL **local** verificados. No acredita migración alojada, frontend conectado ni integración Alexa live.

## Rutas exactas

Prefijo `/api/v2`. Cada base de la tabla instala cuatro operaciones:

- `GET {base}`: lista paginada.
- `GET {base}/:id`: lectura individual.
- `POST {base}`: alta, body con el valor completo y `schemaVersion: "2.0"`.
- `POST {base}/:id/revisions`: body `{expectedVersion,value}`.

| Clase | Base exacta | Tabla nativa | Escritura |
|---|---|---|---|
| OrganizationPreferences | `/organizations/current/preferences` | `organization_preferences` | OWNER de la organización |
| CargoProfile | `/cargo-profiles` | `organization_cargo_profiles` | OWNER/SUPERVISOR de la organización |
| CargoCategory | `/cargo-categories` | `cargo_categories` | CATALOG_ADMIN |
| Carrier | `/carriers` | `carriers` | alta CATALOG_ADMIN; revisión admin/editor de ese carrier |
| CarrierDepot | `/carriers/:carrierId/depots` | `carrier_depots` | admin/editor de ese carrier |
| CarrierService | `/carriers/:carrierId/services` | `carrier_services` + junction categorías | admin/editor de ese carrier |
| ServiceArea | `/carriers/:carrierId/services/:serviceId/areas` | `service_areas` | admin/editor de ese carrier; servicio del mismo carrier |
| ServiceLane | `/carriers/:carrierId/services/:serviceId/lanes` | `service_lanes` | igual; endpoints del mismo servicio y roles PICKUP/DELIVERY |
| FulfilmentPartner | `/carriers/:carrierId/partners` | `fulfilment_partners` | admin/editor de ese carrier |

Son **36 operaciones nuevas**, además de las 13 de organización, sedes y solicitudes anteriores: 49 endpoints de negocio implementados en la rama. Health no entra en el conteo. No hay DELETE de negocio; la baja se expresa como revisión `active:false` o `status:INACTIVE`.

Las preferencias tienen una fila como máximo por organización. GET de base devuelve `data:[]` si no existe; POST inicial la crea. El frontend obtiene el id/version de esa respuesta para la revisión. No se fabrican preferencias por defecto ni autorizaciones automáticas de booking.

## Transporte y atributos

Sesión cookie o Bearer real. `Idempotency-Key` UUID en ambos POST. Alta 201, replay 200, revisión 200. Listas `limit` 1..100 (25 por defecto), `offset` 0..100000, orden createdAt/id y `nextOffset`. Las rutas no aceptan un tenant editable en el body.

Registro: `{id,organizationId,carrierId,serviceId,version,createdAt,updatedAt,value}`. `version` es entero positivo para concurrencia; la versión UML textual de categoría es su representación decimal. Carrier añade `verifiedContact`, nullable y **solo lectura**. `value` tiene `schemaVersion` y los campos siguientes; campos desconocidos se rechazan tanto en Zod como en la RPC SQL.

| Agregado | Campos de value |
|---|---|
| Preferencias | objective (LOWEST_COST/FASTEST/WEIGHTED), maximumWaitMinutes, preferredMode, preferredEquipment, usualBudget `{amount,currency:USD}`, validUntil; todos nullable |
| Perfil | name, categoryId, typicalUnits[], requirements[] (códigos), preferredEquipment nullable, active |
| CargoUnitTemplate embebido | packageType, quantity, weightPerUnitKg, volumePerUnitM3, dimensionsCm `{length,width,height}`, indivisible, stackable, unitsPerPackage |
| Categoría | code, name, guidance `{recommendedEntryMethods,intakeSpecificationSchema,suggestedRequirements,recommendedVehicleClasses}`, suggestedEquipment nullable, active |
| Carrier | code, commercialName, legalName nullable, businessIdType/Value pareados nullable, registeredCountry nullable, providerType, status, operationalPhone nullable |
| Depot | code, name, location `{label,countryCode,region,city,lat,lng}`, active, handling[] (códigos) |
| Servicio | mode (ROAD/RAIL/SEA/AIR), serviceClass (FTL/LTL), maxWeightKg/maxVolumeM3 nullable, responseChannels[], status, admittedCargoTypes[] (UUID de categoría), temperatureRange nullable, requiredCertifications[] (códigos), supportsHazardous/Fragile/Oversized |
| Área | role, inclusion, geography, source (OWN/PARTNER), partnerId nullable, evidence/verifiedAt/validFrom/validUntil nullable, active |
| Lane | pickupAreaId, deliveryAreaId, kind (DIRECT/WITHIN_AREA), mode, borderReviewRequired, evidence/verifiedAt/validFrom/validUntil nullable, active, plannedTransitMinutes nullable, transitProvenanceStatus, crossBorderProhibited, crossBorderProhibitionReference nullable |
| Socio | registeredName, partnerCarrierRef nullable, agreementValidFrom/Until, status, coverageEvidence |

Los códigos de categoría son extensibles (`^[A-Z][A-Z0-9_]{0,99}$`). Intake/solicitud consultan las categorías activas reales y no exigen las ocho iniciales. Un código publicado es inmutable; se crea otra categoría para cambiar su identidad. Desactivación no borra referencias históricas. Requisitos/certificaciones/handling son declaraciones con código; su captura no demuestra cumplimiento operativo.

Geography: `{granularity,countryCode,region,city,postalCode,geometry?}`. COUNTRY/REGION/CITY/POSTAL_CODE conservan la forma previa. POLYGON/POINTS requieren geometry GeoJSON Polygon/MultiPoint, coordenadas `[longitude,latitude]` dentro de rangos y anillos cerrados. En esas formas region/city/postalCode son null. Se valida estructura, tamaño y cierre; **no se certifica topología, delimitación legal ni cobertura camionera**. El evaluador actual devuelve `GEOGRAPHY_EVALUATION_NOT_IMPLEMENTED`/UNKNOWN ante geometría avanzada relevante; falta el predicado espacial con evidencia del proveedor. No convierte el polígono en cobertura provincial confirmada.

Áreas referenciadas por lanes conservan geografía/rol/inclusión/servicio inmutables. WITHIN_AREA exige la misma geografía en ambas áreas. No se deriva una lane inversa. La revisión de modo del servicio se bloquea si contradice lanes existentes; fila de servicio bloqueada durante comandos de áreas/lanes. Fuente PARTNER requiere socio registrado del carrier publicador; la evaluación comprueba estado/vigencia del acuerdo durante la ventana. Socio ausente/vencido o evidencia ausente produce UNKNOWN. Un límite confirmado del servicio prevalece aunque el recurso tenga más capacidad.

## Identidad y HAC-41

La sesión actual requiere OrganizationMember activo y organización activa. OWNER de un shipper **no** obtiene permiso de escritura sobre carriers. La frontera de autorización persistente es `private.v2_catalog_grants`:

- CATALOG_ADMIN: auth_user_id real, carrier_id null, catálogo global/altas de carriers.
- CARRIER_EDITOR: auth_user_id real y carrier_id concreto.
- expires_at/revoked_at: verificados en cada comando, también antes del replay.

Sin grants de lectura/escritura para anon/authenticated/service_role; RLS activa. **No existe endpoint para autoconcederlos.** La migración no provisiona ningún grant. Axel/HAC-41 debe enlazar su CarrierOperator verificado, políticas/roles y revocación con esta frontera, y resolver el acceso del operador sin membresía shipper. Los grants de las pruebas se crean únicamente en transacciones locales o setup local con cleanup.

Carrier.verifiedContact es un Contact `{name,email,phoneE164}` nullable publicado solo después de verificación de identidad de HAC-41; el comando de catálogo no lo acepta. ResponseIntegration, configuración/diagnóstico de adaptadores, secretos/consentimiento y activación API/MCP siguen siendo entrega de **Axel/HAC-41**, según la matriz original. responseChannels del servicio expresa configuración declarada; no prueba un adapter live y no se publican canales operativos por ese campo.

## Persistencia y seguridad

Repositorios de sesión, sin cliente service_role en rutas. SQL comprueba identidad/roles/alcance antes de buscar recursos. Recibos privados con SHA-256 canónico calculado en servidor, bloqueo por clave y bloqueo de fila por versión; el replay precede a las comprobaciones de referencias mutables. Versiones obsoletas producen `409 STALE_DRAFT`; payload distinto con misma clave `409 IDEMPOTENCY_CONFLICT`; unicidad produce CATALOG_CONFLICT. Identificadores externos inválidos no consumen clave. Restricciones/checks/FKs, índices y RLS conservados o añadidos.

Triggers bloquean INSERT/UPDATE/DELETE directos de agregados y asociación servicio/categoría para sesiones y service_role. Los comandos privilegiados autorizados ejecutan bajo postgres con search_path vacío. No hay flag/GUC de cliente para saltar permisos. Los campos legacy default_requirements (objeto) y ubicaciones antiguas de servicio no se reinterpretan como array UML o cobertura V2; typical_units/requirements y las áreas son sus fuentes nativas.

## Evidencia y límites de cierre

- Gate local: 13 migraciones, 13 archivos pgTAP, 371/371; ausencia V1 con controles positivos 9/9; RouteCondition 12/12.
- HTTP con Bearer real: nueve agregados alta/GET/revisión/replay/stale, tenant ajeno 404, categoría nueva → intake → POST/GET de solicitud → serviceability sin inventar capacidad.
- Carrera real: un commit y un STALE_DRAFT, clave fallida reutilizable en versión vigente.
- Suite de release, typecheck, arquitectura y build verificadas; comandos/evidencia exactos en el handoff de HAC-40.

HAC-40 sigue In Progress. Faltan paquetes de flota, agenda/reservas/LTL, ruteo/planes, comercial/booking y operación, el predicado espacial y dependencias de identidad/canales. También faltan autorización y aplicación del esquema/dataset alojados, integración frontend/MCP, QA completa y merge autorizado del gate. Este catálogo no cierra el backend integral.

### Friction log — smoke local y Auth, 3 oct 2026

Responsable: Cristhian/HAC-40. La limpieza protegida rechazó borrar usuarios sintéticos porque el login HTTP dejó filas en auth.sessions/refresh_tokens. Se preservó la transacción y se identificaron como sesiones creadas por este smoke, en el contenedor dedicado. Se retiraron únicamente esas sesiones y la limpieza terminó con cero usuarios/organizaciones/carriers de escenario y ocho categorías de referencia conservadas. El smoke ahora revoca ambas sesiones con signOut global: la reprueba HTTP y la limpieza posterior pasaron sin retirada manual de sesiones. No se cambió la protección para ignorar hijos externos ni se tocó un entorno alojado.
