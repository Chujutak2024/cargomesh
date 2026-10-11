# HAC-40 — flota y disponibilidad: recursos publicados

Registro histórico del primer corte B2 de `codex/v2-full-backend` / PR #99. Sus referencias de rama, conteos y pendientes describen ese corte; el [flujo de entrega vigente](./CURRENT_DELIVERY_STATE.md) identifica la base actual y la evidencia alojada posterior. Este documento no acredita por sí solo aplicación al Supabase alojado.

## API del primer corte B2

Prefijo `/api/v2`. Cada base ofrece GET listado, GET `/:id`, POST creación y POST `/:id/revisions`. Listas paginadas; escritura con `Idempotency-Key` UUID y revisión `{expectedVersion,value}`. Son **28 operaciones nuevas**, acumulado **77** con las 49 anteriores.

| Clase / operación | Base | Persistencia |
|---|---|---|
| TransportAsset y RoadVehicle | `/carriers/:carrierId/assets` | `transport_assets` con subtipo ROAD explícito |
| CapacityPool | `/carriers/:carrierId/capacity-pools` | `capacity_pools` |
| CapacityCalendar | `/carriers/:carrierId/calendars` | `capacity_calendars` |
| ScheduledMaintenance | `/carriers/:carrierId/maintenances` | `scheduled_maintenances` |
| RepositioningBlock | `/carriers/:carrierId/repositioning-blocks` | `repositioning_blocks` |
| AssetCargoCapability: definición reutilizable | `/carriers/:carrierId/capability-definitions` | `cargo_capability_definitions` |
| Asociación definición–activo | `/carriers/:carrierId/asset-capabilities` | `asset_cargo_capabilities.definition_id` |

Los DTO completos se encuentran en `cargomesh/src/shared/schemas/v2/fleet.ts`; fixtures explícitos en `supabase/scenarios/v2-road-baseline/fixtures/hac40-fleet.json`. El cuerpo declara `serviceId`; SQL comprueba que pertenece al carrier del path. Revisiones conservan carrier, servicio y la identidad de la fuente. No se permiten escrituras directas de cliente ni DELETE público.

## Permisos y estados

- Lecturas y escrituras operativas exigen membresía vigente y grant vigente `CARRIER_EDITOR` del carrier o `CATALOG_ADMIN` en `private.v2_catalog_grants`. Un shipper OWNER sin ese grant no administra ni consulta placas/mantenimiento. Los grants los provisiona identidad, no el cliente.
- Toda llamada y replay revalida autorización/revocación. Las lecturas limitadas del evaluador conservan los grants/RLS de discovery; no reciben placas ni razones administrativas.
- `operatingStatus`: AVAILABLE, IN_SERVICE, MAINTENANCE, OUT_OF_SERVICE. Solo AVAILABLE publica `active=true` para discovery. AUXILIARY proyecta ESCORT y exige peso/volumen null; no suma capacidad.
- Mantenimiento SCHEDULED/IN_PROGRESS y reposicionamiento PLANNED/IN_PROGRESS bloquean la ventana. COMPLETED/CANCELLED dejan de bloquear en el evaluador. Las revisiones requieren versión vigente.
- `409 FLEET_COMMITMENT_CONFLICT` impide alterar recursos/calendarios/capacidades con compromisos futuros y crear bloqueos solapados con reservas activas. Calendario y reserva se bloquean en la misma transacción; la carrera hold↔mantenimiento permite exactamente un commit.
- Los holds de calendarios/fuentes gestionados comprueban evidencia del calendario, ventana publicada, bloqueos, activo y ventana del cupo. Todavía no hay endpoints de booking/hold ni consolidación residual LTL completa.

## Correspondencia y evidencia

TransportAsset/RoadVehicle incorporan estado, depot, procedencia/socio, registro/fecha, marca/modelo/variante, carrocería, dimensiones, límite bruto, odómetro y motivo. Una placa identifica como máximo un activo ROAD del carrier. Capacidad útil nunca excede el límite bruto declarado; esto no certifica tara, límites del fabricante, vía ni autorización legal.

CapacityPool conserva modo, ventana, capacidad declarada, procedencia/socio y evidencia. Calendar incorpora timezone IANA, horizonte, fuente, última verificación y freshness; ventanas no pueden solaparse ni salir del horizonte. No se aceptan verificaciones futuras. Reposicionamiento conserva origen/destino y duración dentro de su ventana.

AssetCargoCapability vive como definición reutilizable con requirements, maxWeightKg, temperatura, evidencia y vigencia. Sus asociaciones referencian esa definición, conservan categoría y atributos coherentes, y permiten compartirla entre varios activos. Una revisión sincroniza las proyecciones de los vínculos y sus versiones; compromisos futuros impiden modificarla. La evaluación aplica su límite por categoría y vigencia; requirements aún sin verificador conservan UNKNOWN. Los vínculos históricos sin definición permanecen identificables por `definitionId:null`; no se inventan definiciones con seeds en migraciones.

Lecturas de filas anteriores muestran null en atributos adicionales desconocidos. Publicaciones/revisiones requieren el contrato completo de entrada. Ni una declaración ni un fixture SIMULATED acreditan disponibilidad live.

## Verificación y límites de cierre

Migración aditiva `20261004042259_hac40_fleet.sql`, perfil pgTAP `20_v2_hac40_fleet.test.sql`, pruebas de contratos/aplicación, elegibilidad y carreras reales `scripts/check-hac40-fleet-race.py`. La cadena se reconstruye desde cero mediante el gate V2; fixtures/grants de prueba se revierten o limpian en el contenedor dedicado.

**Pendientes de B2:** VehicleCombination, Driver/DriverAssignment/VehicleAssignment, AssetStatusEvent/auditoría operativa completa, reservas/holds públicos, consolidación LTL, disponibilidad conjunta y verificación de dimensiones/jurisdicción/permisos. B3–B6 (planes, comercial, booking y ejecución) continúan dentro de HAC-40. Identidad carrier/MCP/ResponseIntegration es dependencia HAC-41. El inventario/DER completo no se declara certificado por este avance.

**Actualización posterior:** conductores, combinaciones y asignaciones incorporaron persistencia y 16 operaciones adicionales; ver [contrato de APIs de crew](./HAC40_CREW_API.md). El acumulado de ese corte fue 93. La sección anterior registra los pendientes del primer corte de flota. El [workflow posterior](./HAC40_WORKFLOW_API.md) incorpora planes, reservas, ejecución y el verificador de combinaciones; sus reglas y límites no se deducen del prototipo de dominio descrito abajo.

### Políticas puras de asignación — prototipo de dominio

`cargomesh/src/server/modules/fleet/domain/assignment-policy.ts` contiene políticas puras con pruebas unitarias. En `main @ 57d18ea`, su único importador es `assignment-policy.test.ts`; ningún módulo de runtime Web/MCP lo importa. Sus pruebas describen el comportamiento aislado de las siguientes políticas y no certifican la ejecución de estas reglas mediante BD/API/MCP:

- Ventanas semiabiertas, cobertura continua de slots adyacentes, bloqueos activos y vigencia de evidencia. Agenda incompleta o vencida conserva UNKNOWN.
- Driver/DriverAssignment: carrier, clase de licencia y cualificaciones requeridas, licencia durante toda la ventana, estado de jornada y límite de horas con política/fuente explícitas. La fecha LocalDate se resuelve mediante un adaptador de jurisdicción; no se supone UTC ni se codifica una licencia o límite legal universal. El límite resolved debe corresponder a la fecha de la licencia evaluada.
- VehicleCombination: miembros únicos del mismo carrier y modo ROAD, estado operativo, acople durante toda la ventana, compatibilidad con evidencia y disponibilidad de todos los activos. Capacidad efectiva como mínimo entre fabricante, servicio y límites brutos de combinación/vía menos tara; no suma capacidades nominales de tracto y remolque. Límites o evidencia ausentes conservan capacidad desconocida.
- VehicleAssignment: scope carrier/servicio/ejecución/activo, disponibilidad, peso y volumen. AUXILIARY no porta carga. FTL excluye otra asignación simultánea; LTL solo consolida en la misma ejecución con evidencia. Se resta el pico simultáneo por dimensión; asignaciones secuenciales o de otra fecha no se suman.
- CONFIRMED exige una reserva confirmada, coherente con carrier/servicio/ejecución/activo, ventana y capacidad, más evidencia vigente. Un hold no basta para confirmar.

Las pruebas unitarias de estas políticas se incluyen en `test:hac40` y, por esa vía, en release/CI. Eso no demuestra una llamada desde los servicios de producción. Los vocabularios de licencia, jornada, acople y compatibilidad se reciben desde contratos/políticas con fuente; los valores de pruebas son explícitamente sintéticos.

**Límite de esta evidencia:** este módulo no agrega endpoints, tablas ni comandos persistentes y sus tests no prueban proyección SQL, RLS, carreras ni disponibilidad live. Los pendientes de repositorios/DTO, ejecución/reservas y el total de 77 operaciones correspondían al primer corte; las implementaciones posteriores se documentan en crew y workflow. Para certificar un método UML, QA debe mapear y medir el observable real del servicio/BD/API/MCP, incluidos bloqueos activos, doble conteo y exclusión del compromiso propio cuando correspondan. La ausencia de un importador de este prototipo no confirma por sí sola que falte esa regla en el runtime persistente.

## Friction log

El generador local de tipos SQL no infiere parámetros RPC nullable. Se conservaron las anotaciones API ya revisadas de las funciones existentes y se regeneraron tablas/relaciones desde PostgreSQL; typecheck valida su compatibilidad. No se resolvió mediante casts a `any` ni clientes con service_role.
