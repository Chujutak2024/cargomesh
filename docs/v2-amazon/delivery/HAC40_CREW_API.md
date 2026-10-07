# HAC-40 — Conductores, combinaciones y asignaciones persistentes

## Corte y consumo

Rama `codex/v2-full-backend`, Draft #99 hacia `feat/cycle-3-integration`. Migración nativa aditiva `20261004080506_hac40_crew_assignments.sql`. Aplicación alojada pendiente de QA y autorización específica.

Prefijo `/api/v2`. Se añaden **16 operaciones**, total acumulado **93** de negocio (health excluido):

| Clase | Base | Tabla |
|---|---|---|
| Driver | `/carriers/:carrierId/drivers` | `drivers` |
| VehicleCombination | `/carriers/:carrierId/vehicle-combinations` | `vehicle_combinations` + `vehicle_combination_assets` |
| DriverAssignment | `/carriers/:carrierId/driver-assignments` | `driver_assignments` |
| VehicleAssignment | `/carriers/:carrierId/vehicle-assignments` | `vehicle_assignments` |

Cada base implementa GET listado, GET `/:id`, POST creación y POST `/:id/revisions`. Listado con `limit` (1–100, predeterminado 25) y `offset`. POST recibe DTO completo y header UUID `Idempotency-Key`; revisión recibe `{expectedVersion,value}`. Respuestas usan el mismo sobre `schemaVersion/data/meta` del catálogo. Creación nueva responde 201; replay/revisión 200. No hay DELETE público.

Los DTO están en `cargomesh/src/shared/schemas/v2/crew.ts`. Los cuatro recursos utilizan la ruta, servicio y repositorio compartidos de catálogo y el comando SQL privado `command_v2_crew`. El vocabulario de recursos/tablas es cerrado.

## Identidad y relaciones

Cada lectura/escritura/replay comprueba `OrganizationMember` activo, organización activa y grant carrier `CARRIER_EDITOR` o `CATALOG_ADMIN` vigente. Un shipper OWNER no obtiene acceso por su rol. La revocación se consulta en cada llamada; no se decide desde user_metadata. Las tablas tienen RLS habilitada, grants directos revocados y escritura mediante comandos autorizados. No se conceden derechos por suministrar un `portalAccountId`.

- Driver pertenece al carrier y servicio ROAD. `portalAccountId` es nullable y FK hacia `carrier_operators` del mismo carrier; si se proporciona, debe estar activo.
- Assignment referencia una `transport_executions` existente del mismo carrier/servicio y su ventana debe caber en la ejecución. IDs de conductor, activo, combinación y ejecución no se pueden reasignar en una revisión.
- La ejecución tiene FK a solicitud/organización/carrier/servicio y valida que la solicitud sea V2 y del tenant declarado.
- La combinación mantiene 1..N miembros únicos ROAD del mismo carrier/servicio. Un activo no puede estar acoplado simultáneamente a dos combinaciones. Los controles de cardinalidad diferidos se ejecutan también al commit bajo authenticated.
- Una asignación puede vincular una reserva por primera vez al revisar; una reserva ya vinculada no se sustituye ni borra silenciosamente.

Se incorpora la **estructura de soporte** `carrier_operators` (atributos UML, relación carrier/Auth) y `transport_executions` (atributos UML, ventana y relaciones anteriores). No se exponen comandos de aprovisionamiento de identidad ni creación de ejecución en este corte. Sus políticas de administración y el vínculo ejecución↔booking siguen pendientes en HAC-41/B5/B6; estas tablas no certifican esas clases completas. Para pruebas, sus filas son fixtures privilegiados locales, no endpoints inventados.

## Campos y estados

Driver persiste fullName, portalAccount, licenseClass, licenseValidUntil como LocalDate, qualifications, experienceYears y dutyStatus. Añade timezone de licencia, evidencia/vigencia, ventanas disponibles y política de jornada (`dutyWindow`, `maximumDutySeconds`, `usedDutySeconds`). El límite lo suministra el carrier con fuente; no se codifica un máximo legal universal ni equivalencias de licencia entre países.

VehicleCombination persiste kind/configuration/coupledWindow/evidence/combinedTareKg/grossWeightLimitKg/status, miembros y evidencia de compatibilidad. PROPOSED conserva datos incompletos; COUPLED exige ventana, evidencia vigente de compatibilidad y miembros disponibles. Acople físico no declara por sí solo ruta, tarifa ni capacidad legal operativa.

DriverAssignment persiste window/role (PRIMARY/RELIEF)/status/evidence y referencias, junto con clases de licencia aceptadas, cualificaciones requeridas y fuente de política. VehicleAssignment persiste window/status/capacityCommitted/evidence y referencias a activo, combinación y reserva.

Estados de asignación: PROPOSED, CONFIRMED, RELEASED, CANCELLED. No se puede resucitar una asignación terminal ni volver de CONFIRMED a PROPOSED. Liberar una asignación no libera automáticamente la reserva compartida ni cancela el booking; su coordinación transaccional corresponde a B5.

## Confirmación y concurrencia

- Driver CONFIRMED exige evidencia vigente del conductor, asignación y política; licencia durante toda la ventana (final del día en su timezone), clase/cualificaciones compatibles, jornada con límite y cobertura de disponibilidad. Reservas de horas/asignaciones activas del periodo se contabilizan. Solapes del mismo conductor se excluyen físicamente por rango semiabierto; ventanas adyacentes no colisionan.
- Vehicle CONFIRMED exige una reserva CONFIRMED coherente con ejecución/solicitud/calendario/activo/carrier/servicio, ventana y capacidad, y evidencia vigente. HELD no basta. No se permite liberar o alterar el compromiso de una reserva mientras respalde asignaciones confirmadas.
- AUXILIARY/ESCORT no porta peso ni volumen. FTL excluye otra asignación simultánea; LTL admite asignaciones de la misma ejecución, respetando límites del activo/servicio y de la reserva. La capacidad residual utiliza el pico simultáneo; no suma asignaciones consecutivas o de otra fecha.
- Una combinación usa una asignación portadora para impedir doble conteo de tractor y remolque. La migración de workflow agrega el verificador de límites fabricante/vía/plan: permite confirmar con compromiso vigente y reserva de todos los miembros físicos. Sin esas fuentes permanece `FLEET_EVIDENCE_REQUIRED`; no se inventa capacidad desde bruto/tara nominales.
- Cambios de conductor/activo/calendario/combinación o de política del servicio no pueden invalidar compromisos activos. Mantenimiento, reposicionamiento y nuevas reservas respetan las asignaciones, y viceversa.
- Los comandos toman lock del servicio antes de sus referencias y usan hash SHA-256 canónico, versión esperada y receipt propio de actor/organización. Las carreras reales cubren revisión del conductor, doble asignación y asignación↔mantenimiento.

Errores estables: 400 VALIDATION_ERROR/INVALID_CATALOG_REFERENCE; 403 FORBIDDEN_CATALOG; 404 CATALOG_NOT_FOUND (incluye referencias fuera del scope); 409 STALE_DRAFT, IDEMPOTENCY_CONFLICT, FLEET_COMMITMENT_CONFLICT o FLEET_EVIDENCE_REQUIRED. Evidencia ausente no convierte PROPOSED en CONFIRMED.

## Evidencia y límites

- `supabase/tests/21_v2_hac40_crew.test.sql`: escenarios revertidos, contrato nativo, positivos/negativos, permisos/revocación, reservas, estados, FTL/LTL y commit de cardinalidad bajo authenticated.
- `scripts/check-hac40-crew-race.py`: carreras reales de dos sesiones, incluido en gate V2; limpieza solo de sus identificadores locales.
- `cargomesh/scripts/hac40-crew-http-smoke.mjs`: POST/listado/detalle/revisión/replay/stale y auth estricta mediante Bearer real contra Next/Hono y Supabase local.
- Fixtures explícitos en `supabase/scenarios/v2-road-baseline/fixtures/hac40-crew.json`, fuera de migraciones.

SIMULATED se conserva en los objetos de evidencia incluso si un escenario alcanza CONFIRMED. Eso acredita la prueba local del estado, no operación live, verificación gubernamental ni Alexa live. El [incremento de workflow](./HAC40_WORKFLOW_API.md) agrega planes/límites con fuente, combinación multicalendario, consolidación LTL evidenciada, booking/reservas, ejecución, posiciones, eventos e incidentes. La verificación legal/dimensional requiere evidencia actual; las pruebas sintéticas no certifican autoridades ni un piloto de camión. El inventario completo de 57 clases sigue sin certificarse por este corte.
