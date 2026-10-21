# Rollout de agenda y cotización delegada — 21 octubre 2026

## Entrega de código

Checkout inicial: `codex/unified-workspaces-demo-boundary`; otro chat cambió el mismo checkout a `main` durante el trabajo. El corte permanece sin commit/push para no publicar los cambios compartidos. Checkout `C:/Users/HP/.codex/worktrees/unified-workspaces/cargomesh`. Este corte no aplica DDL al alojado ni cambia la configuración o los alias de Vercel. Las seeds se acuerdan con Cristhian; no se crean como efecto de este rollout.

## Secuencia de activación

1. Revisar ledger y hashes del manifiesto V2, sin repetir migraciones aplicadas.
2. Aplicar en orden: `20261021150000_dispatch_preferences.sql`, `20261021151000_dispatch_quote_schedules.sql`, `20261021152000_delegated_booking_schedule.sql`, `20261021153000_dispatch_arrival_ranking.sql`. Requieren las dos migraciones Plan1 previamente entregadas. Son aditivas; no editar las históricas.
3. Desplegar este código web/backend después de las funciones. La nueva preparación llama una RPC que todavía no existe en instalaciones sin estas DDL.
4. Un ADMIN Carrier revisa su tarifa por servicio/lane, recursos máximos y precio por plan/recurso. Activa propuesta de horarios y define prioridades, antelación y tiempos operativos. `autoConfirm` y su aprobación se marcan expresamente solo si desea bookings vinculantes automáticos. Ninguna política se activa por defecto mediante migración.
5. Confirmar que los corredores/lane tienen tránsito y evidencia vigentes y que los calendarios cubren el intervalo operativo. Faltantes producen revisión; no rellenarlos con kilómetros o camiones inventados.
6. Publicar una ScoringPolicy FASTEST/ARRIVAL_TIME para recomendar llegadas urgentes. La publicación conserva pesos/versiones explícitos. LOWEST_COST existente sigue disponible para solicitudes sin urgencia. No existe un nuevo catálogo de scoring activado por esta DDL.
7. Cristhian prueba en la web: crear/revisar con Nova o texto, enviar, solicitar ofertas, comparar, seleccionar, autorizar y ver booking/agenda en Carrier. Contrastar los horarios de la oferta con las ventanas aceptadas; una confirmación debe dejar ejecución PLANNED, no IN_PROGRESS. La validación visual y el ensayo humano quedan a cargo del usuario.

## Límites de este corte

- ROAD/FTL directo inequívoco; no resuelve automáticamente múltiples destinos ni una red multimodal.
- Liviano/mediano/pesado no tiene bandas de tonelaje aprobadas. Las capacidades duras siguen siendo individuales.
- No añade seeds ni migración de los escenarios locales al alojado.
- No inicia viajes ni asigna un conductor ficticio por confirmar un booking.
- No añade jobs de expiración periódica ni cambia el cierre explícito existente.
- El despliegue AWS/voz corresponde a Axel. Las fechas alternativas se revisan en el borrador compartido; no se declara una ejecución comercial por una transcripción sin consentimiento.

## Desactivar

Desactivar `autoIssue` y/o `dispatch.autoConfirm` mediante una nueva versión aprobada por Carrier. Las ofertas/retenciones ya emitidas permanecen auditadas y deben cerrarse por los comandos nativos. No borrar tablas ni revertir migraciones con datos para simular una desactivación.
