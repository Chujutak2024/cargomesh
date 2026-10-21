# Entrega Plan1: carga y operación

## Corte local

Rama existente: `codex/unified-workspaces-demo-boundary`, base `b96a3b7`. Usuario asignó Plan1 y pidió no publicar tareas en Linear. Se implementan A–D del plan; E (categorías/requisitos independientes por línea, múltiples destinos y recepción parcial) sigue posterior.

- Grupos de cajas/pallets editables con totales derivados y conservación de metadatos al revisar.
- Corrección de límite vial preliminar para dos piezas de 6 t en una vía limitada a 10 t por vehículo.
- Búsqueda determinística acotada de recursos portadores y asignaciones enteras; no crea capacidad ni divide piezas.
- Vista previa multicamión pendiente de validación SQL; el plan nativo decide la elegibilidad final.
- Tarifa multicamión requiere nueva aprobación ADMIN y alcance explícito por plan o recurso; la política anterior conserva un máximo de un recurso.
- Reparto visible en oferta Cliente y ficha Carrier, con resumen autorizado que mantiene ocultos contactos y direcciones exactas.
- Se reutilizan decisiones, bookings, holds, ejecuciones y comprobaciones de tripulación. Dos camiones pueden pertenecer a una oferta y un booking.

Contrato: [Grupos y recursos](../contracts/PLAN1_CARGO_AND_MULTI_RESOURCE.md).

## Evidencia crítica

- TypeScript: exit 0.
- Arquitectura: exit 0.
- Manifiesto de migraciones: exit 0.
- Pruebas focalizadas de grupos, conversación existente, planificación, tarifa, preparación y proyección: 72 PASS.
- PostgreSQL nativo aislado: caso40 40 PASS; caso42 16 PASS; caso43 26 PASS. Incluye idempotencia, dos holds, rechazo de confirmación parcial, privacidad y carga no repartible. Rollback y eliminación de la base temporal confirmados.
- No se ejecutó revisión visual, build general ni conversación humana; la validación visual y la integración con Nova corresponden a las próximas etapas.

Comandos reproducibles desde `cargomesh/`: ejecutar `node node_modules/typescript/bin/tsc --noEmit`, `node scripts/check-architecture.mjs` y los archivos registrados en `test:release`/`test:v2-intake`. Los scripts pnpm intentan sincronizar un runtime compartido y pueden fallar antes de ejecutar el comando; véase el friction log de dependencias compartidas. Los casos SQL requieren un perfil V2 local con referencia/scenario sintéticos y se ejecutan dentro de transacciones con rollback. No ejecutar el seed base sobre un proyecto alojado como comprobación.

## Orden para integrar y activar

1. Integrar el corte autorizado y pasar el gate de publicación. No hay nuevo PR, push ni merge a main como parte de esta entrega local.
2. Aplicar en orden `20261021034000_plan1_resource_route_payload.sql` y `20261021035000_plan1_multi_resource_quotes.sql`, cotejando primero el ledger y hashes reales. Este paquete no se ha aplicado al alojado.
3. Desplegar el frontend/API compatible después del SQL. Sin esas migraciones el guardado del nuevo alcance tarifario no es compatible con el RPC anterior.
4. Cristhian y este chat definen juntos el paquete de seeds: empresa, sedes, rutas, vehículos, ventanas y pedidos. La propuesta de8perfiles/22casos es un borrador para seleccionar y ajustar, no una activación ni una delegación automática a Plan3. No activar las nueve recetas anteriores a ciegas: el caso de limitación12t describe el baseline anterior y debe ajustar su expectativa al nuevo corte.
5. Un ADMIN del Carrier revisa y autoriza `maxResources` y `resourcePricing`, indicando si el precio cubre todo el plan o cada recurso. No se cambia automáticamente la tarifa demo USD500.
6. Plan2 conecta su adaptador al borrador compartido y su confirmación explícita; el soporte de varios grupos en formulario no acredita captura multigrupo por Nova.

## Recorrido manual disponible tras activación

Cliente crea un pedido con varios grupos y confirma la revisión → solicita ofertas → el backend verifica recursos y crea el plan/oportunidad → la política aprobada emite la oferta o espera cotización manual de Carrier → Cliente compara el reparto, selecciona y autoriza → se preparan una ejecución y los holds → Carrier confirma ambos recursos y el booking → asigna toda la tripulación antes de iniciar. Cotizar no crea una reserva ni indica que el vehículo esté en camino.

Para el ejemplo12t, usar dos piezas enteras6t y dos vehículos compatibles en la misma ventana, con límites y evidencia reales del escenario. Cambiar un vehículo a mantenimiento debe impedir una propuesta completa. Una pieza12t o un pedido que debe viajar junto no se divide para hacer pasar el caso.

## Límites conservados

El adaptador automático cubre ROAD/FTL con un origen/destino y servicio por plan, hasta8 recursos. Los recursos desconocidos, cupos/combinaciones sin adaptador automático y límites de búsqueda requieren revisión. No hay optimización3D ni promesa de óptimo global. La aprobación de tarifa y la activación de datos/migraciones alojadas son pasos externos a esta implementación. Vercel mantiene el corte previamente publicado.
