# HAC-40 — reconciliación F-02 y faltantes del modelo

Corte previo de reconciliación documental (los resultados 35/35 de esta sección son anteriores al incremento de implementación).

Base de trabajo: `fe12d41e474c2c12d9dcd8e77047a0f2b7f0bd66`. Solo banco Docker local `supabase_db_cargomesh-v2-local`; 20 migraciones existentes. Este pase no reconstruye el banco, no modifica migraciones, no aplica DDL alojado y no certifica el modelo completo.

## F-02: corrección del hallazgo documental

QA revisó #106 en `e06d0c0`: relaciones DER 34, 55 y 69 conformes; 89 pendiente por la frase «NULL is allowed only for a pre-plan hold».

La frase se reemplaza por la garantía real de `private.guard_reservation_plan_resource()`:

- Sin binding, resourceId y legAssignmentId deben ser NULL.
- Con binding, ambos IDs se derivan o contrastan contra ese binding.
- Los tres IDs NULL están permitidos por el catálogo sin comprobar fase de reserva o booking.
- El comando nativo exige la asignación. Esta es una garantía de aplicación distinta; una prueba como postgres no demuestra bypass de authenticated.

Se regeneraron DER y diseño físico desde la fuente JSON. No se impuso una nueva restricción de negocio ni se alteró el UML. La relación 89 requiere reprueba documental independiente antes de declarar F-02 cerrado.

## RoutePlanner: atributos presentes y operaciones pendientes

El baseline `abba805` marcaba tres atributos ausentes. En la base actual existen en `route_plans.data.planner`, escritos por `private.workflow_route` y devueltos por `read_v2_workflow` y el DTO estricto de rutas:

| UML | Implementación actual | Límite |
|---|---|---|
| algorithmVersion | PUBLISHED_ITINERARY_VALIDATOR_V1 | Valida itinerario explícito publicado |
| graphVersion | SHA-256 de corredores/versión de política/versiones de corredores y nodos seleccionados | No es versión del grafo global |
| source | PUBLISHED_CORRIDORS, SELECTED_ITINERARY_SNAPSHOT, referencias | No acredita proveedor live |

La reconciliación vigente de estos campos se incorpora al generador del DER, conservando el baseline histórico y sus estados QA. No se marca automáticamente RoutePlanner como COMPLETO.

**Faltante real de HAC-40:** el UML pide `findAlternatives`, `replan` y `explain`. El comando de ruta actual recibe corridorIds; validar ese itinerario no acredita búsqueda automática completa, replanning ante condiciones ni las tres operaciones semánticas. Hace falta implementar y probar estas operaciones con restricciones, fuentes/versiones, UNKNOWN, determinismo y consumo autenticado. No se reemplaza el alcance por CRUD de un puerto.

## Otras relaciones faltantes que requieren implementación

La matriz independiente histórica identifica dos asociaciones adicionales de HAC-40 sin representación canónica acreditada. La búsqueda de la cadena actual no encuentra el puente o FK declarados:

| Relación UML | Falta | Criterio de cierre |
|---|---|---|
| OperationalIncident ↔ RouteCondition, 0..* / 0..* | Puente persistente y comando/API para correlacionar incidentes con condiciones | Positivo sobre la ruta de la ejecución, rechazo de referencias ajenas, replay/conflicto, RLS y lectura consistente |
| FulfilmentPartner → PlanLegAssignment, 0..1 / 0..* | Referencia canónica de socio en asignación; snapshots de carrier/recurso no certifican esta relación | Socio del carrier/servicio correcto, vigencia y responsabilidad verificadas; lectura y rechazo de socio ajeno; mantener optionalidad UML |

No se cierran estas asociaciones mediante documentación o una FK sin comando/validación. Identidad/MCP, ResponseIntegration y los faltantes atribuidos a HAC-41 mantienen a Axel como dueño.

Los restantes PARCIAL de la matriz necesitan evidencia por campo, relación y operación. PARCIAL no significa automáticamente defecto ni implementación completa. Los conteos de la matriz de #105 pertenecen a su SHA; no se presentan como resultado nuevo de esta corrección.

## Pruebas ejecutadas en este pase

- `supabase/tests/32_v2_hac40_uml_cardinalities.test.sql`: **35/35 PASS**, transacción completa revertida.
- Creación/GET nativos de metadata RoutePlanner bajo authenticated, con identidad real del escenario sintético.
- Fingerprint cambia al cambiar versión de política o corredor; controles ejecutados como postgres.
- F-05 conserva verificación diferida bajo authenticated antes de reset role.
- Positivo/negativo de nulabilidad de reservas confirmadas bajo postgres: demuestra exactamente la garantía física documentada.
- Generación y `--check` del DER PASS: 57 clases / 397 atributos / 93 relaciones.
- Inventario UML PASS; hash original `104b126cc17565b57064fca0c6a8efd5cf43a076c1cb041355e5174cbe68dc88` intacto.

Salida local: `tmp/f02-cardinalities-local.log`. Las consultas de catálogo confirmaron las definiciones de las dos funciones citadas. No se ejecutó una nueva reprueba HTTP en este pase ni se modificó el harness de HAC-44.

## Entrega para reprueba y cierre

QA debe contrastar la frase corregida de la relación 89 con trigger/catálogo y los controles pareados, y revisar los tres atributos de RoutePlanner sin importar estados del baseline. El cierre de F-02 es independiente de los métodos/relaciones todavía faltantes. HAC-40 y el modelo completo conservan esos pendientes; el estado Done de Linear no reemplaza la evidencia.

## Incremento posterior: los tres huecos implementados

Las asociaciones 48/66 y findAlternatives/replan/explain ahora tienen migraciones, comandos, API, permisos y pruebas. El [contrato del incremento](./HAC40_MODEL_CLOSURE_API.md) define la semántica y sus límites; la [evidencia final](./evidence/hac-40/MODEL_CLOSURE_LOCAL_2026-10-07.md) reemplaza los conteos anteriores para este nuevo corte. Los apartados de faltantes anteriores describen el diagnóstico previo, no el estado local final. QA independiente y Supabase alojado siguen sin certificarse.
