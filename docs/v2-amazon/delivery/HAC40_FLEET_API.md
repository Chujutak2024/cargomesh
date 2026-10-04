# HAC-40 — flota y disponibilidad: recursos publicados

Rama `codex/v2-full-backend`, PR Draft #99 hacia `feat/cycle-3-integration`. Este avance pertenece a B2 de la misma entrega integral; HAC-40 sigue abierta. No aplica cambios al Supabase alojado.

## API disponible en esta rama

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

**Actualización posterior:** conductores, combinaciones y asignaciones ya tienen persistencia y 16 operaciones adicionales; ver [contrato de APIs de crew](./HAC40_CREW_API.md). El acumulado actual es 93. La sección anterior registra el límite del primer corte de flota; las reglas y límites vigentes de este incremento se detallan en el nuevo contrato, incluida la confirmación de combinaciones aún bloqueada por el verificador del plan.

### Reglas compartidas de asignación — avance de dominio

`cargomesh/src/server/modules/fleet/domain/assignment-policy.ts` implementa reglas puras para los servicios Web/MCP:

- Ventanas semiabiertas, cobertura continua de slots adyacentes, bloqueos activos y vigencia de evidencia. Agenda incompleta o vencida conserva UNKNOWN.
- Driver/DriverAssignment: carrier, clase de licencia y cualificaciones requeridas, licencia durante toda la ventana, estado de jornada y límite de horas con política/fuente explícitas. La fecha LocalDate se resuelve mediante un adaptador de jurisdicción; no se supone UTC ni se codifica una licencia o límite legal universal. El límite resolved debe corresponder a la fecha de la licencia evaluada.
- VehicleCombination: miembros únicos del mismo carrier y modo ROAD, estado operativo, acople durante toda la ventana, compatibilidad con evidencia y disponibilidad de todos los activos. Capacidad efectiva como mínimo entre fabricante, servicio y límites brutos de combinación/vía menos tara; no suma capacidades nominales de tracto y remolque. Límites o evidencia ausentes conservan capacidad desconocida.
- VehicleAssignment: scope carrier/servicio/ejecución/activo, disponibilidad, peso y volumen. AUXILIARY no porta carga. FTL excluye otra asignación simultánea; LTL solo consolida en la misma ejecución con evidencia. Se resta el pico simultáneo por dimensión; asignaciones secuenciales o de otra fecha no se suman.
- CONFIRMED exige una reserva confirmada, coherente con carrier/servicio/ejecución/activo, ventana y capacidad, más evidencia vigente. Un hold no basta para confirmar.

Estas políticas se incluyen en `test:hac40` y, por esa vía, en release/CI. Los vocabularios de licencia, jornada, acople y compatibilidad se reciben desde contratos/políticas con fuente; los valores de pruebas son explícitamente sintéticos.

**Límite actual:** no son nuevos endpoints, tablas ni comandos persistentes. Faltan los repositorios, DTO HTTP definitivos y validación transaccional de estas asignaciones/combinaciones, junto con ejecución y reservas. Los adaptadores deberán proyectar solo bloqueos activos, evitar contar dos veces una asignación y su reserva, y excluir únicamente el compromiso propio validado al revisar su asignación. El contexto de prueba no certifica esa proyección SQL, RLS, carreras ni disponibilidad live. El total de API continúa siendo 77 y estas clases siguen pendientes de implementación integral.

## Friction log

El generador local de tipos SQL no infiere parámetros RPC nullable. Se conservaron las anotaciones API ya revisadas de las funciones existentes y se regeneraron tablas/relaciones desde PostgreSQL; typecheck valida su compatibilidad. No se resolvió mediante casts a `any` ni clientes con service_role.
