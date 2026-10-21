# Prioridad, fechas flexibles y programación delegada

Implementación: 21 de octubre de 2026. Alcance: adaptador automático ROAD/FTL directo con corredor publicado inequívoco. No acredita otros modos, reparto urbano ni entregas a múltiples destinos.

## Cliente y borrador canónico

`planningPreferences` es opcional en el contrato V2 para conservar las huellas y los recibos históricos. Si existe contiene:

- `urgency`: `URGENT` o `SCHEDULED`. No desplaza reservas confirmadas.
- `loadSize`: `LIGHT`, `MEDIUM`, `HEAVY` o null. Es una etiqueta comercial, sin umbrales de tonelaje implícitos. El encaje depende de peso, volumen, dimensiones, unidades indivisibles y capacidades verificadas.
- `timeZone`: zona IANA informativa de la captura. Los instantes guardados llevan offset. El formulario convierte las fechas a la zona del navegador al recuperarlas en otra computadora.
- `pickupWindows`, `deliveryWindows`: de 1 a 14 intervalos, sin solapamientos. Admiten días distintos; el espacio entre intervalos no es disponibilidad.

Los campos canónicos `pickupWindow` y `deliveryWindow` son las envolventes exactas de estas listas. No deben reservarse esas envolventes completas. La captura, la interpretación escrita y el contexto provisional de voz comparten prioridad/tamaño con el mismo borrador; la revisión conserva las ventanas alternativas. Las ambigüedades de fechas requieren aclaración y la creación exige confirmación explícita. La etiqueta de tamaño no elige un vehículo ni clasifica una mercancía peligrosa.

## Horario y precio

1. Cliente revisa y envía la solicitud; autoriza buscar ofertas con una fecha límite de respuesta.
2. Se recorre el universo de servicios leído por el evaluador, sin limitarlo a tres candidatos. Para solicitudes con preferencias, se consultan políticas Carrier vigentes y corredores dirigidos publicados.
3. `proposeDispatch` recorre límites de ventanas y cambios de calendario. Usa el mayor tránsito conocido entre corredor y lane; suma carga y descarga según la política. Revisa cobertura, equipo, producto, reservas, mantenimiento, reposicionamiento y reparto de bultos enteros. Todos los camiones comparten el mismo intervalo operativo. Se propone la llegada más temprana dentro de las alternativas verificadas.
4. La búsqueda de eventos está acotada (256 eventos/intentos; límites de trabajo del planificador multicamión). Si alcanza el límite devuelve revisión, sin afirmar inexistencia de solución ni un óptimo global. Se deja un margen técnico de cinco segundos al proponer una salida calculada desde el momento actual; la base revalida la antelación con su propio reloj. El máximo de 1000 servicios por intención y 2 MiB persistidos es un límite explícito de esta implementación; superarlo exige revisión.
5. La intención guarda las propuestas una vez bajo actor, clave y SHA-256 canónico del pedido/versión/deadline. Los reintentos reutilizan esas propuestas, no recalculan nuevos horarios y nuevas ofertas. Cambiar la intención requiere otra clave. Cada comando de cotización mantiene además su propia idempotencia y revalida el dominio.
6. La RPC nativa comprueba versión de política, prioridad, antelación, tránsito, corredor, intervalos aceptados y capacidad. La oferta usa tarifa y evidencia aprobadas por Carrier. No reserva capacidad por cotizar. La oferta expone el recojo y la llegada propuestos y el cliente puede comparar hasta tres opciones en pantalla.

Rutas, documentación o capacidad desconocidas requieren revisión. Varias rutas directas ambiguas siguen fuera del adaptador automático actual. Los tiempos publicados como SIMULATED permanecen simulados; no se convierten en medición Google ni promesa live. La comprobación preliminar del formulario usa la envolvente; la propuesta concreta de fechas alternativas se resuelve al cotizar.

## Dos autorizaciones diferentes

La política existente conserva `active`, `autoIssue`, tarifa USD, validez, recursos máximos y precio por plan/recurso. El nuevo bloque `dispatch` define prioridades aceptadas, antelación mínima, minutos de carga/descarga, `autoConfirm`, importe máximo de booking (puede omitirse como null si no se delega confirmación) y `acknowledgeSchedulingAuthority`.

`autoIssue` autoriza emitir ofertas; no autoriza por sí mismo confirmar bookings. Para autoconfirmar se exige `dispatch.autoConfirm=true`, consentimiento explícito del administrador, máximo comercial y la misma política/versión que emitió la oferta. Se revalida que el operador ADMIN siga activo/verificado y conserve su grant. Una política revocada, cambiada o fuera de límites deja la confirmación manual; no eleva al Cliente a operador Carrier.

## Aceptación y cola

El Cliente selecciona y autoriza la oferta mediante acciones auditadas separadas. `prepare_v2_delegated_booking` realiza en una transacción:

- verificar identidad, organización, versión, autorización, oferta, plan y vigencia;
- preparar ejecuciones PLANNED y una retención por recurso mediante comandos nativos;
- comprobar todos los recursos y confirmar sus retenciones;
- confirmar el booking y guardar auditoría de la política Carrier, operador aprobador y Cliente;
- guardar el recibo recuperable incluso si la respuesta se pierde después del commit.

Un fallo del segundo camión revierte el primero y la ejecución creada. Los bloqueos y restricciones nativas conservan el control de concurrencia. No se instala una vía genérica para ejecutar comandos Carrier desde una identidad Cliente. Los bookings sin delegación conservan la preparación previa y esperan confirmación manual.

`SCHEDULED` describe el resultado de preparación: booking CONFIRMED, retenciones CONFIRMED y ejecución PLANNED. No significa En camino. El inicio real mantiene los requisitos existentes de fecha, vehículos y conductores confirmados. La agenda y la cola se leen desde esas ejecuciones y sus intervalos persistidos.

## Ranking y Nova

Las nuevas solicitudes urgentes usan objetivo FASTEST; las programadas LOWEST_COST. Una `ScoringPolicy` publicada puede declarar `transitMetric=ARRIVAL_TIME`: compara la llegada incluyendo espera, con agregación LATEST_OFFER_ARRIVAL para un plan de ofertas complementarias. La ausencia del nuevo campo conserva TRAVEL_DURATION/SUM_ISSUER_DURATIONS. Una urgencia requiere política FASTEST con ARRIVAL_TIME; si falta, se reciben ofertas pero no se inventa una recomendación.

Nova interpreta y explica datos; la política y los servicios nativos deciden la factibilidad y la oferta. La elección/autorización comercial sigue siendo explícita del Cliente. Este corte no despliega AWS ni acredita un nuevo ensayo de audio/Alexa+; el gateway lo despliega Axel.

## Evidencia y activación

Pruebas de dominio: `dispatch-planner.test.ts`, conservación de preferencias en `prototype-model.test.ts`, ranking en `offer-policy.test.ts` y reintento conversacional en `chat-commercial-action.test.ts`. SQL: `44_v2_dispatch_schedule.test.sql`, más regresión multicamión `43_v2_plan1_multi_quotes.test.sql`.

La activación alojada requiere las cuatro migraciones 20261021150000, 151000, 152000 y 153000, en ese orden, y desplegar el código después. El detalle está en `../delivery/DISPATCH_DELEGATION_ROLLOUT.md`. No contienen seeds, tarifas ficticias ni pedidos.
