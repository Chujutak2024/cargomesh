# HAC-50 — Sedes, conductores y agenda

15 de octubre de 2026. Implementación local en `codex/unified-workspaces-demo-boundary`, basada en HEAD publicado `cbb10ff1c23b6e44376378b9843cc5e602742e36`. No es un merge ni un despliegue. Los cambios visuales de otros chats se conservan.

## Resultado por bloque

| Bloque | Entrega | Estado real |
| --- | --- | --- |
| Sedes | Política versionada, servicios apoyados, horarios IANA, recursos compartidos por actividad, equipos admitidos, capacidad concurrente, bloqueos, evidencia y citas | Código, API, frontend y migración probados localmente. Activación en Supabase remoto pendiente |
| Conductores | Alta y revisión con licencia, zona de licencia, habilitaciones, experiencia opcional, jornada y ventanas | Conectado al backend existente; alta/revisión comprobadas en la UI con un conductor sintético |
| Agenda | Calendarios de vehículos, mantenimientos y asignaciones de vehículo/conductor | Formularios conectados a comandos existentes con idempotencia, versión y permisos |
| Disponibilidad | Consulta por recurso/servicio/período, descuentan asignaciones, reservas vigentes, mantenimiento y reposicionamiento | Endpoint y UI comprobados; desconocido no se presenta como disponible |

Entrada: <http://127.0.0.1:8080/v2-workspace#/fleet>. Pestañas `Drivers` y `Agenda & assignments`. Sedes: <http://127.0.0.1:8080/v2-workspace#/fleet/carriers>.

## Modelo y responsabilidades

Una sede física no concede cobertura geográfica. Los países, ciudades, exclusiones y lanes dirigidas proceden de los servicios existentes. `serviceIds` declara los servicios que la sede apoya; puede apoyar varios y el mismo servicio puede usar varias sedes.

Cada recurso de atención tiene un código, actividades y un límite de vehículos simultáneos. Si carga y descarga comparten un muelle, comparten su capacidad; no se suman cupos ficticios por actividad. Un recurso sin límite/equipos conocidos, horario o evidencia suficiente produce `unknown`. La capacidad se mide por vehículos simultáneos, no por toneladas/día ni por flota estacionada.

Las ventanas son intervalos semiabiertos `[inicio, fin)`. Se admite `24:00` exclusivamente como cierre; una noche se divide entre el día de inicio y el siguiente, sin hueco a medianoche. Una lista semanal vacía significa cerrado. Un horario `null` significa desconocido. Los bloqueos pueden afectar un recurso o toda la sede. Fuente `SIMULATED` permanece visible aunque el registro esté persistido.

Confirmar una cita bloquea la fila de sede y reevalúa política y ocupación máxima. No suma reservas secuenciales como si fueran simultáneas. Una revisión de política no puede invalidar citas futuras confirmadas. Cancelar conserva la cita y su historial y libera solo su ocupación. Una cita terminal no se resucita. Desactivar sede/servicio o cancelar/completar una ejecución con citas futuras confirmadas exige primero liberar esas citas mediante el comando auditado; no hay liberación automática silenciosa.

Conductores y vehículo conservan sus identidades. Los formularios seleccionan recursos, ejecución y reserva existentes dentro del Carrier. Registrar un conductor no crea credenciales ni una cuenta de portal. La confirmación de vehículo exige una reserva coherente; la de conductor exige licencia, habilitaciones, evidencia y jornada. `usedDutySeconds` más otras asignaciones del mismo período más la ventana consultada deben caber en el límite declarado. No se infiere una norma legal desde el país.

La consulta nueva es `RESOURCE_WINDOW_ONLY`: una lectura previa, no una reserva ni garantía de booking. La escritura nativa revalida conflictos atómicamente. Las lecturas parciales, evidencia vencida, ausencia de calendario, calendarios ambiguos o jornada desconocida conservan incertidumbre. Un conflicto conocido sí bloquea aunque falte calendario.

## Contrato técnico nuevo

Esquemas: `src/shared/schemas/v2/depot-operations.ts`.

- `DepotPolicyV2`: `schemaVersion`, `active`, `serviceIds`, `operatingHours|null`, `resources`, `blockedWindows`, `evidence|null`.
- Recurso: `code`, `name`, `activities` (`LOAD|UNLOAD|PARK|MAINTENANCE`), `equipmentTypes|null`, `maxConcurrentVehicles|null`.
- `DepotSlotV2`: `serviceId`, `resourceCode`, `activity`, `equipmentType`, `window`, `units`; máximo 14 días por consulta/cita.
- `DepotAppointmentV2`: slot más `executionId|null`, `status` (`PROPOSED|CONFIRMED|CANCELLED|COMPLETED`), `reason`.
- Registro: `id`, `carrierId`, `depotId`, `version`, `updatedAt`, `value`.
- Decisión: `status`, `reasons`, `provenanceStatus`, `policyVersion|null`.

Prefijo autenticado: `/api/v2/carrier-portal/carriers/:carrierId`.

| Método / ruta relativa | Operación |
| --- | --- |
| GET `/depots/:depotId/operations` | Leer política, `null` si no existe |
| POST `/depots/:depotId/operations` | Crear/revisar política |
| GET `/depots/:depotId/operations/appointments` | Leer citas; máximo 1000, `meta.partial` si se rebasa |
| POST `/depots/:depotId/operations/appointments` | Crear cita |
| POST `/depots/:depotId/operations/appointments/:id/revisions` | Revisar/cancelar cita |
| POST `/depots/:depotId/operations/availability` | Comprobar cupo adicional, sin reservar |
| POST `/availability` | `{serviceId, kind:asset|driver, resourceId, window}` |

Las mutaciones de sede reciben `{expectedVersion, value}` y `Idempotency-Key`. La creación usa versión 0 y la revisión la versión leída. Reintentar el mismo comando devuelve su recibo; cambiar payload con la misma clave produce `409 IDEMPOTENCY_CONFLICT`; versión obsoleta produce `409 STALE_DRAFT`. Las escrituras requieren ADMIN. El RPC comprueba nuevamente identidad/Carrier; no confía en IDs del navegador. Las tablas públicas tienen RLS y solo lectura autorizada; recibos/eventos son privados y no hay escritura directa para anon/authenticated/service_role.

Migración aditiva: `supabase-v2/supabase/migrations/20261015055541_hac50_depot_operations.sql`. Incluye dos tablas públicas y dos privadas, índices, restricciones, RLS, funciones, RPC y triggers. No contiene seeds. El adaptador distingue una migración ausente con `503 DEPOT_OPERATIONS_NOT_INSTALLED`; la pantalla muestra activación pendiente y permite reintentar.

## Verificaciones ejecutadas

- TypeScript sin emisión y architecture check: aprobados (385 módulos, 105 entradas cliente).
- Gate Node: 74/74 pruebas de dominio, servicio, contratos, catálogo, modo demo, navegación y sesión.
- SQL nuevo `35_v2_hac50_depot_operations.test.sql`: 43/43. Horarios, medianoche, cierres, ocupación, cancelación, deactivaciones, identidad, RLS, reintentos y versiones.
- Regresión nativa de crew `21_v2_hac40_crew.test.sql`: 69/69. Se cargó previamente el catálogo de referencia del repositorio, que no está incluido en un volcado de estructura.
- Identidad Carrier `34_v2_hac45_carrier_portal.test.sql`: 27/27 durante este incremento.
- Dos sesiones PostgreSQL reales: cupo final → una confirmación y un conflicto; misma clave concurrente → una creación y un replay del mismo ID. La migración final se aplicó desde cero en un segundo banco aislado antes de repetir esas carreras.
- HTTP con sesión privada en memoria: 9/9 verificaciones. Alta/revisión UI persistida, respuesta correlacionada, vehículo fuera de servicio, ventana inválida, otro Carrier, origen externo, anon y migración pendiente. `HTTP_RESULTS.json` no contiene secretos.
- Navegador: alta y revisión de `[SYNTHETIC] HAC50 UI driver revised` a versión 2; licencia QA_ONLY, jornada UNKNOWN, sin cuenta ni ventanas inventadas. Consulta visual devuelve `Availability requires confirmation`, fuente UNKNOWN. Se conservó la unidad de validación previa fuera de servicio. No se modificaron recursos reales.
- Recarga final del navegador se interrumpió por indisponibilidad del proceso local. Se reinició el mismo front en segundo plano. La revisión visual final de responsive queda pendiente; no se declara aprobada.

Los bancos locales contienen exclusivamente estructura y fixtures del repositorio. No se copiaron filas del proyecto remoto. Las pruebas pgTAP revierten sus transacciones; los bancos de carreras son descartables y contienen solo dos citas sintéticas cada uno. El script de carreras crea un nombre nuevo y nunca resetea la base de origen.

## Activación remota pendiente

La app configurada usa el proyecto `yhimeajpzicjbxpbzsyh`. El conector Supabase de esta sesión enumera otros proyectos; su proyecto llamado `cargomesh` no tiene las tablas V2 esperadas y no es el destino correcto. No se cambió la URL/clave de la app ni se aplicó DDL en otro proyecto.

AGENTS.md exige autorización específica para una migración remota. Se solicitó autorización para la migración exacta y conexión del proyecto correcto. Hasta recibirla y verificar prerequisitos, sedes permanece preparada y probada localmente. Conductores/agenda usan tablas existentes y ya funcionan en la app conectada. No se hicieron push, merge ni despliegue.

## Pendientes fuera de este incremento

- Activar y validar E2E la migración de sedes en el proyecto remoto correcto.
- Integrar checks de sede/recurso y sus versiones en el plan comercial, discovery, reserva y revalidación por ruta/duración. Hoy las citas se gestionan explícitamente; no se impone un muelle a un servicio que no lo usa.
- Restricciones específicas de carga, permisos fronterizos, tiempos de manipulación y capacidad por peso/volumen/día requieren datos/contratos adicionales. El límite actual es concurrencia de vehículos por recurso.
- UI de reposicionamiento, edición de combinaciones, selección de área de ubicación lista y cuentas de conductor son extensiones posteriores; el backend existente conserva sus registros y la consulta descuenta los bloqueos ya registrados.
- Next feasible date, replanificación, reemplazo entre carriers, diez carriers sintéticos, pipeline, Orders, Customers y tools Alexa nuevas siguen pendientes.
- Orquestación visual de varios camiones en Three.js, GPS y mapas no se implementaron ni se certifican por este trabajo.

## Reproducción y archivos

Desde `cargomesh/`: `pnpm test:carrier-operations`, `node node_modules/typescript/bin/tsc --noEmit --incremental false`, `node scripts/check-architecture.mjs`.

Para SQL usar una base local descartable con la cadena V2 aplicada, catálogo de referencia `20260927042811_v2_cargo_reference.sql` y el escenario `supabase/scenarios/v2-road-baseline/seed.sql` con `local_only=1`. Aplicar la nueva migración y ejecutar las pruebas 21, 34 y 35. Nunca ejecutar fixtures de prueba en Supabase alojado.

La fuente final está en el checkout activo. `implementation/` y los instaladores de esta carpeta son staging/historia y pueden diferir del código final; no volver a ejecutar los instaladores. `depot-operations-final.sql` es una copia de revisión de la migración, no otro destino de migraciones.
