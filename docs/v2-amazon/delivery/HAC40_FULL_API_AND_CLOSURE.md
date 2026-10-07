# HAC-27 / HAC-40 — contrato integral y estado de ejecución

## Alcance vigente

La recuperación autorizada incorpora las **57 clases, 397 atributos y 93 relaciones** del UML 07. Las 21 clases que el corte ROAD difería forman parte de esta entrega. Una clase puede ser un agregado, subtipo, valor embebido, proyección o puerto; no se crea un CRUD genérico que permita alterar estados comerciales.

[Inventario completo extraído del UML](../models/FULL_MODEL_UML_INVENTORY.json) y [representaciones objetivo](../models/FULL_MODEL_TARGETS.json). El inventario conserva atributos, operaciones, IDs, relaciones y etiquetas originales. Se valida con `python scripts/check-v2-full-model.py`. Su PASS acredita integridad del inventario, **no implementación completa**.

El [DER físico integral](../models/FULL_MODEL_DER.md) fija un destino objetivo para cada atributo y un tratamiento explícito para cada relación, incluidas las divergencias de selección multi-oferta. `python scripts/build-v2-full-der.py --check` detecta cambios o huecos entre el UML y los artefactos publicados. Todos sus campos `migrationVerified` siguen siendo falsos: el diseño no acredita que la cadena SQL implemente esos destinos.

Principal: HAC-40, Cristhian. Habilitador: HAC-27 en esta misma entrega. Rama `codex/v2-full-backend`, desde `codex/v2-amazon-contracts`; target de entregas nuevas `codex/v2-amazon-contracts` por decisión del 4 oct. El PR #99 ya se integró en el ciclo anterior; ese corte se traslada una sola vez a la base y no se repite su merge. No se cambia la raíz `cargomesh/` ni se añade un servidor backend separado. Hono y MCP consumen los mismos servicios de aplicación.

## Contrato de transporte común

- Prefijo `/api/v2`; DTO `schemaVersion: "2.0"`. Entradas y salidas estrictas, diferentes de filas PostgreSQL.
- El actor y tenant proceden de la sesión/membresía o vínculo MCP verificado. Un ID de organización en el body es una aserción, nunca autorización.
- GET de listas usa `limit=25` por defecto, máximo 100, y `offset`. Orden estable por fecha e ID; respuestas incluyen `nextOffset`. No limitar el universo evaluado a la página visible.
- POST reintentable exige `Idempotency-Key` UUID. Recibo atómico ligado a actor, tenant, operación y SHA-256 del payload canónico. Una clave usada con otro comando produce `409 IDEMPOTENCY_CONFLICT`.
- Revisiones/transiciones exigen versión esperada. Reintento del mismo comando devuelve su recibo original; un comando nuevo con versión obsoleta produce `409 STALE_DRAFT`.
- `401` sesión inválida, `403` permisos/tenant inválido, `404` recurso no visible, `400` contrato inválido; errores internos no filtran SQL ni credenciales.
- Horarios: IANA, días ISO 1..7, intervalos locales sin solape; un intervalo que cruza medianoche debe dividirse. Una sede/horario no acredita cobertura, entrada para camión ni permiso.

## Endpoints implementados en esta rama

Estos necesitan la cadena V2 aplicada en el entorno elegido. La implementación local no acredita despliegue en Supabase/Vercel.

| Método | Ruta | Servicio / fuente |
|---|---|---|
| GET | `/intake/options` | intake existente, cinco grupos |
| GET | `/organizations/current` | OrganizationServiceV2.get, organización de la sesión |
| POST | `/organizations/current/revisions` | `{expectedVersion,value}`, solo OWNER; no altera identidad verificada |
| GET | `/facilities` | FacilityServiceV2.list, tenant y paginación |
| GET | `/facilities/:id` | FacilityServiceV2.get |
| POST | `/facilities` | creación completa, idempotencia, roles OWNER/SUPERVISOR |
| POST | `/facilities/:id/revisions` | `{expectedVersion,value}`, revisión completa atómica |
| GET | `/freight/requests` | listado paginado aislado por tenant |
| POST | `/freight/requests` | writer V2 nativo existente |
| GET | `/freight/requests/:id` | lectura nativa, admite estado posterior a DRAFT |
| POST | `/freight/requests/:id/revisions` | `{expectedDraftVersion,value}`, solo DRAFT |
| POST | `/freight/requests/:id/submissions` | `{expectedDraftVersion}`, DRAFT → PENDING |
| GET | `/freight/requests/:id/serviceability` | evaluador ROAD existente de solo lectura |

Rutas: `cargomesh/src/server/hono/routes/facilities.ts` y `routes/freight/requests.ts`; composición `hono/app.ts`. Persistencia: módulos `facilities` y `freight-requests`. `GET /health` es soporte técnico y no otro endpoint de negocio.

## Catalogo B1 implementado

[Contrato exacto de catalogo, atributos, permisos y limites](./HAC40_CATALOG_API.md): 36 operaciones nuevas sobre preferencias, perfiles, categorias, carriers, depots, servicios, areas, lanes y socios. Sumadas a las 13 anteriores son **49 endpoints de negocio**, sin contar health. Rutas en `hono/routes/catalog.ts`, servicio de aplicacion `modules/catalog`, migracion `20261004032151_hac40_catalog.sql`.

## Avance B2 — conductores, combinaciones y asignaciones

[Contrato de conductores y asignaciones](./HAC40_CREW_API.md): 16 operaciones nuevas, cuatro por familia (listado, detalle, creación y revisión). Acumulado vigente: **93 endpoints de negocio**. Persistencia nativa, autorización carrier, idempotencia, versión, licencia/disponibilidad y no-solape verificados localmente. CarrierOperator y TransportExecution tienen soporte estructural restringido; su provisión y ciclo público siguen pendientes. Confirmar una asignación de combinación exige el verificador de límites del plan todavía pendiente y se bloquea sin esa evidencia. Las reservas públicas, eventos de estado y cierre de ejecución siguen pendientes.

## Familias integrales pendientes

### Avance B2 — recursos de flota

[Contrato de flota y disponibilidad](./HAC40_FLEET_API.md): 28 operaciones nuevas de activos, cupos, calendarios, mantenimiento, reposicionamiento, definiciones de capacidad y sus asociaciones. Acumulado **77 endpoints de negocio**. Publicación/revisión segura y consumo por elegibilidad ROAD implementados; El corte posterior de conductores/asignaciones está documentado arriba; quedan auditoría de estados, reservas públicas, consolidación comercial LTL y planes multirrecurso. Las familias de la tabla siguiente describen el cierre integral todavía requerido; la existencia de operaciones de un agregado no certifica todo B2.

**Objetivo contractual, no anuncio de disponibilidad.** Todas estas familias permanecen en HAC-40 o en la principal dependiente indicada; frontend puede preparar mocks explícitos contra ellas, pero no sustituir errores del API por mocks.

| Bloque / clases | GET requeridos | POST requeridos / semántica | Permiso y responsable |
|---|---|---|---|
| OrganizationMember, CarrierOperator, McpAccountLink, ResponseIntegration | `/organizations/current/members`, `/identity/mcp/links` | invitación/revisión/revocación de miembros; consentimiento y revocación de links | HAC-41 Axel; no autoconceder roles/scopes |
| TransportAsset / RoadVehicle, VehicleCombination | `/carriers/:id/assets`, `/combinations` e individuales | alta/revisiones; acoplamiento/desacoplamiento de combinaciones | carrier; atributos completos y compatibilidad de miembros |
| Driver, DriverAssignment, VehicleAssignment, AssetStatusEvent | `/carriers/:id/drivers`, `/assignments`, `/assets/:assetId/events` | altas/revisiones/asignación/liberación y eventos válidos de estado | carrier; licencia, ventana y no-solape |
| AssetCargoCapability | `/carriers/:id/assets/:assetId/capabilities` | alta/revisión de capacidades con evidencia y vigencia | carrier; resolver multiplicidad UML sin asumir catálogo global |
| CapacityPool, CapacityCalendar / CapacitySource | `/carriers/:id/capacity-pools`, `/calendars` | alta/revisión cupos/calendarios y evidencia residual LTL | carrier; fuente portadora distinta de escolta |
| ScheduledMaintenance, RepositioningBlock | `/carriers/:id/maintenances`, `/repositioning-blocks` | alta/revisión/liberación de bloqueos | carrier; disponibilidad común con reservas/asignaciones |
| CapacityReservation | `/bookings/:id/reservations` y agenda carrier | `/capacity/holds`, `/holds/:id/confirmations`, `/holds/:id/releases` | compromiso atómico, concurrencia, expiración y autorización |
| FreightRequest + valores de carga/contactos | list/individual implementados; `/freight/requests/:id/validation` | revisiones/presentación implementadas; cancelación, plantillas/histórico y atributos restantes pendientes | tenant y estado esperado; plantilla no hereda precio/disponibilidad |
| LogisticsNode, RouteCorridor, RoutePlanningPolicy, RouteCondition | `/routing/nodes`, `/corridors`, `/policies`, `/conditions` | publicaciones/revisiones versionadas con fuente/vigencia | permisos por fuente/tenant; frontera no equivale a autorización |
| RoutePlan / RouteLeg / RouteWaypoint, RoutePlanner | `/freight/requests/:id/routes`, `/routes/:id` | `/freight/requests/:id/routes` calcula/materializa con restricciones | servicio compartido; preservar UNKNOWN y geometría ausente |
| TransportPlanCandidate / PlanResource / PlanLegAssignment / LoadAllocation | `/freight/requests/:id/plans`, `/plans/:id` | generación/materialización de planes y asignaciones | servidor evalúa todos los recursos/tramos; cliente no declara elegibilidad |
| CarrierOpportunity | `/freight/requests/:id/opportunities`, `/carrier/opportunities/:id` | crear invitaciones y registrar respuesta/rechazo/expiración | shipper invita; carrier solo responde a su oportunidad |
| CarrierOffer / OfferCostComponent | `/freight/requests/:id/offers`, `/offers/:id` | `/carrier/opportunities/:id/offers`, `/offers/:id/withdrawals`, nuevas versiones | emisor atribuible; precio y servicios/tramos coherentes |
| ScoringPolicy / RankedOption / CarrierMetric | `/scoring/policies`, `/freight/requests/:id/ranking`, `/carriers/:id/metrics` | políticas versionadas y registros derivados de evidencia | ranking determinístico; métrica sin muestra no obtiene score inventado |
| SelectionDecision | `/freight/requests/:id/decisions`, `/decisions/:id` | `/freight/requests/:id/decisions`, revocación auditada | autorización shipper y ofertas vigentes; cobertura exacta por tramo |
| Booking | `/bookings`, `/bookings/:id` | autorización por oferta, confirmación carrier, cancelación y compensación | shipper/carrier separados; estado técnico de adapter separado |
| TransportExecution | `/bookings/:id/execution`, `/executions/:id/events` | iniciar/actualizar/completar ejecución y publicar posición/eventos con fuente | responsable operativo; no inventar GPS live |
| OperationalIncident / IncidentUpdate | `/executions/:id/incidents`, `/incidents/:id/updates` | apertura, actualización y cierre auditado | operador responsable; historial append-only |
| RouteSimulationScenario | escenario local fuera de migraciones | selección/carga de escenario solo desarrollo explícito | fixture no disponible como capacidad live |

## Decisiones comerciales del alcance completo

### Solicitud ampliada — migración 20261004025720

POST/GET/listado/revisión conservan `acceptedModes` como conjunto no vacío y sin duplicados de ROAD/RAIL/SEA/AIR. Aceptar el modo como intención no declara su adaptador implementado: `serviceability` evalúa únicamente una solicitud exclusivamente ROAD; otras solicitudes responden `501 MODE_EVALUATION_NOT_IMPLEMENTED`, no reintentable. El `transport_mode` plano conserva el primer modo solo por compatibilidad; el dominio V2 debe leer el conjunto del snapshot.

`serviceType` admite FTL/LTL; omitirlo conserva el comportamiento FTL anterior sin cambiar el payload/huella de creación. La evaluación filtra la clase pedida: nunca sustituye un LTL por un FTL. LTL sin evidencia de capacidad residual/consolidación conserva UNKNOWN. Su agenda/holds residual y adaptadores de los demás modos siguen pendientes de implementación.

Se incorporan `preferredEquipment`, `selectionObjective`, `availableDocuments`, `unitsPerPackage` y company/addressDetail/handlingInstructions en ambos contactos. Preferencia no equivale a restricción dura. Peso/volumen por unidad corresponden al embalaje contabilizado; unitsPerPackage informa su contenido y no vuelve a multiplicar los totales. DocumentRef `{code,reference,issuedAt,validUntil}` es una referencia declarada, no certificación de cumplimiento. Se valida su forma y orden de fechas; el motor debe comprobar su aplicabilidad/vigencia antes de dar un requisito por resuelto.

Los equipos de intención incorporan ISO_CONTAINER, RAIL_WAGON y AIR_ULD junto a los cinco códigos ROAD. No se agregan al catálogo ROAD del intake ni se presentan como recursos disponibles sin datos.

- Se admite la cardinalidad UML de selección `1..*` ofertas. Cada oferta cubre asignaciones de su carrier y servicios. Todas las asignaciones del plan deben quedar cubiertas una vez, sin huecos ni dobles cargos.
- Una selección multicarrier produce compromisos/bookings separados por oferta. No se fabrica una oferta global ni se afirma atomicidad de llamadas a proveedores externos. El incremento de workflow persiste autorización/confirmación/cancelación y liberación local atómica. La compensación de llamadas reales a proveedores requiere el adaptador y su evidencia; no se afirma atomicidad distribuida.
- `price` es el total atribuible del emisor. Componentes QUOTED menos descuentos suman ese total; INCLUDED no vuelve a sumarse. ESTIMATED/EXCLUDED/UNKNOWN impiden comparar un costo final confirmado.
- El corte USD se mantiene: no convertir PEN ni aceptar una moneda contradictoria. Una ampliación de moneda requerirá contrato y fuente FX independiente.
- Scoring versionado con objetivos LOWEST_COST, FASTEST o WEIGHTED; pesos costo/tránsito/fiabilidad suman uno. EXCLUDE con razones para dimensiones requeridas sin dato; desempate estable por offerId. Métricas exigen período, muestra y vigencia.
- Estas reglas están implementadas como políticas puras y schemas en `shared/schemas/v2/commercial.ts` y `server/modules/commercial/domain/offer-policy.ts`. **Actualización:** el [workflow persistente](./HAC40_WORKFLOW_API.md) implementa repositorio, RPC, rutas, ranking de coberturas completas, booking y operación. Su prueba local no acredita tools ni integración live.

## Persistencia actual y cierre pendiente

Las migraciones nuevas completan atributos/comandos de Facility y Organization, revisiones de FreightRequest y el catalogo B1 descrito arriba. Organization exige OWNER y separa correo descriptivo de correo verificado; la revisión no concede roles ni identidad. Recibos de mutación privados, RLS y sin grants cliente; creación conserva su recibo original. Las funciones privilegiadas verifican identidad real, pertenencia y rol antes de leer/escribir. Las filas legacy de sede conservan sus grants anteriores; al entrar por el comando V2 quedan protegidas. Una edición legacy también incrementa versión para no ocultar carreras. Las sedes gestionadas no permiten actualizar directamente su estado ni retirar su marca.

La revisión de solicitud reutiliza la validación/canonización SQL existente mediante una fila transitoria creada/copied/eliminada dentro de una sola transacción. No hay commits intermedios ni salida de esa fila; se preservan el código y recibo de creación. La presentación valida el snapshot y cambia únicamente DRAFT → PENDING: no crea oferta/reserva/booking.

El manifest registra la migración HAC-11 previamente mergeada que faltaba en la base, sin modificar su SQL; el perfil ejecuta su pgTAP. No se cambió la lógica de account-linking de Axel.

**Estado actual:** catálogo, flota, crew y [workflow de planes/comercial/reservas/operación](./HAC40_WORKFLOW_API.md) están implementados y probados localmente; [204 GET/POST únicos](./HAC40_API_ENDPOINTS.md). **Para cerrar HAC-40 sigue faltando** certificar atributo por atributo y relación por relación todo el DER contra PostgreSQL, resolver faltantes/divergencias/puertos visibles del modelo, integrar identidad carrier/MCP, aplicar esquema/dataset autorizado alojado y comprobar consumo real de frontend/MCP. No se deben marcar esos huecos como futuros fuera del alcance ni cerrar la issue con los endpoints actuales.

Supabase alojado requiere autorización específica después del gate completo de esquema; esta rama no aplica DDL ni seeds remotos. La revisión de implementación, publicación/merge autorizado y QA integrado siguen siendo requisitos separados de los tests locales.


Actualización LTL del 4-oct: el workflow ahora coordina una operación física compartida con ventana/crew comunes, eventos correlacionados y cancelaciones aisladas. Véase [contrato](./HAC40_WORKFLOW_API.md). Esto no certifica todavía la matriz completa ni discovery/adaptadores live.
