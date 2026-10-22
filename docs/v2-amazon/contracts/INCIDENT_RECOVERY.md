# Recuperación por incidencia del Carrier

## Regla aceptada

Un accidente o incumplimiento del Carrier puede impedir cumplir parte o toda una orden. La recuperación tiene prioridad `URGENT` y **recargo por urgencia/pedido inmediato de USD 0**. La tarifa normal del nuevo Carrier se calcula con su política aprobada y puede ser diferente de la anterior. El Cliente compara y autoriza expresamente el nuevo contrato. No se acuerdan subsidios, tope de precio anterior, penalidades, reembolsos ni cargos automáticos al Carrier que falló.

Esta capacidad reutiliza V2 ROAD, USD, descubrimiento, cotización aprobada, ranking y booking. No incorpora V1 ni un adaptador comercial en el prompt de Nova.

## Flujo implementado

1. El Carrier registra la incidencia sobre una ejecución `PLANNED` o `IN_PROGRESS` mediante el comando nativo existente.
2. En la ficha del pedido, un Cliente OWNER/SUPERVISOR selecciona las reservas afectadas, identifica accidente/incumplimiento y confirma el punto real y las nuevas ventanas de recojo/entrega.
3. Para una ejecución en curso también confirma cuántos bultos quedan pendientes de entrega. No se presume que la carga sigue en el origen original. Se mantienen dimensiones, peso por unidad y requisitos originales; no se fracciona un bulto indivisible.
4. Una transacción crea y envía una solicitud vinculada al pedido original con solo esa carga. Guarda consentimiento, causa y asignaciones originales; elimina el presupuesto heredado para no convertirlo en un tope no autorizado.
5. El servicio solicita cotizaciones automáticamente con clave estable. Excluye al Carrier que falló **antes** de evaluar y clasificar; conserva los filtros de cobertura, ruta, equipo, capacidad y fecha. La prioridad urgente usa el ranking de llegada temprana existente. Se presentan hasta tres alternativas conocidas.
6. Solo se admiten ofertas automáticas de una política vigente y autorizada por su Carrier. La oferta incluye una línea `OTHER / INCLUDED / USD 0` y el término `INCIDENT_RECOVERY_NO_URGENCY_SURCHARGE`; su tarifa normal y fuente no se reescriben.
7. El Cliente compara y autoriza desde la ficha vinculada. Siguen vigentes las confirmaciones del nuevo Carrier o su mandato previo de autoConfirm; la recuperación no habilita ese mandato por sí misma.
8. **Solo al confirmar el booking de reemplazo**, una transacción libera las reservas y asignaciones de vehículo afectadas, resuelve la incidencia y registra el vínculo al nuevo booking. Si aún queda carga no afectada, conserva su booking, reservas y ejecución. Si ya no queda capacidad activa de esa ejecución, libera sus conductores y cancela la ejecución; cancela el booking original únicamente cuando no le quedan ejecuciones activas.

No se inicia transporte ni se declara entrega física al confirmar un reemplazo. La ficha distingue `NEEDS_ATTENTION`, `AWAITING_CLIENT`, `AWAITING_CARRIER` y `REPLACED`, calculados a partir de ofertas y bookings persistidos.

## Datos y API

- `incident_recoveries`: organización, incidencia, pedido/booking/ejecución originales, Carrier que falló, solicitud y booking de reemplazo, consentimiento, causa, versión, fechas y recargo fijo cero.
- `incident_recovery_reservations`: relación única con cada reserva afectada y copia de sus asignaciones de bultos. Una misma reserva no admite recuperaciones duplicadas.
- Recibos privados con clave UUID y SHA-256 canónico. Reintentos iguales devuelven el mismo caso; cambiar el payload con la misma clave produce `IDEMPOTENCY_CONFLICT`. Versión de incidencia obsoleta: `STALE_DRAFT`.
- Las tablas tienen RLS y acceso directo revocado. Las RPC validan identidad y organización; no utilizan service role del navegador ni suplantan al operador del Carrier anterior.
- `GET /api/v2/freight/requests/:requestId/recoveries`: incidencias recuperables y casos relacionados, solo para la organización autorizada.
- `POST /api/v2/incidents/:incidentId/recoveries`: requiere `Idempotency-Key`, contrato `CreateIncidentRecoverySchema` y consentimiento `AUTHORIZE_RECOVERY_SEARCH`. La búsqueda remota posterior puede fallar sin perder ni duplicar el caso ya persistido.
- RPC nativas: `read_v2_incident_recovery`, `create_v2_incident_recovery`, `read_v2_recovery_quote_context`, `read_v2_recovery_blocked_calendars`.

## Guardas operativas

- Una incidencia en recuperación no se puede resolver manualmente antes de confirmar el reemplazo.
- Una ejecución afectada no puede comenzar/completarse mientras su recuperación está pendiente. El inicio nativo, después de una recuperación parcial, cuenta solo los recursos retenidos y conserva sus controles de evidencia, ventana, plan vigente y tripulación.
- Un accidente bloquea nuevas cotizaciones del calendario afectado hasta disponer de una declaración de disponibilidad completa y verificada/simulada posterior a la incidencia. Liberar capacidad no repara el camión.
- No existe asociación individual conductor→camión en el contrato actual. En recuperación parcial se retienen las asignaciones de conductor; el Dispatcher revisa y libera/reasigna explícitamente las que correspondan. No se adivina qué conductor viajaba en el vehículo afectado.
- Si falta capacidad, mandato tarifario, ubicación válida o evidencia, no se fabrica una oferta. El caso conserva el estado pendiente de atención y permite revisar la solicitud vinculada. No hay daemon de búsqueda continua ni cancelación periódica nuevos.
- Una recuperación multitramos no deduce un itinerario restante: devuelve `RECOVERY_ITINERARY_REVIEW_REQUIRED` cuando las reservas elegidas abarcan más de un tramo. Este corte ejecutable cubre un tramo ROAD, incluso con varios camiones.
- En una ejecución en curso solo se solicitan los bultos pendientes confirmados. La liberación de su reserva original no afirma qué mercancía ya fue entregada ni liquida importes del contrato anterior.

## Entrega y rollout

Migración aditiva: `20261022090000_incident_recovery.sql`; sin seeds ni pedidos. Las cuentas, C01 y tarifas alojadas permanecen intactos durante la implementación local.

La publicación requiere aprobación de este corte para main/Vercel y autorización separada de la DDL alojada por la congelación de `AGENTS.md`. Aplicar la DDL antes de activar el código: el nuevo servicio de búsqueda utiliza sus RPC también para excluir calendarios accidentados. Nova no necesita un despliegue AWS para estas acciones web; no se declara una herramienta de recuperación por voz disponible.

Prueba focal reproducible y resultado: [guía del escenario local](../../../supabase/scenarios/v2-incident-recovery/README.md). La validación visual corresponde al usuario; no se realizaron revisiones visuales del front.
