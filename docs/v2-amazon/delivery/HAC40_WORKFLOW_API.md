# HAC-40 — planes, comercial, compromisos y operación persistentes

Rama `codex/v2-full-backend`; Draft [#99](https://github.com/Chujutak2024/cargomesh/pull/99) hacia `feat/cycle-3-integration`. Migración nativa aditiva `20261004154048_hac40_workflow.sql`. No aplicada a Supabase alojado.

## Contrato de consumo

Prefijo `/api/v2`. Autenticación real Bearer/cookie; actor y organización se resuelven en servidor. Toda creación/mutación usa `Idempotency-Key: UUID`. El mismo actor, clave y payload canónico reproducen el resultado; otro payload da `409 IDEMPOTENCY_CONFLICT`. Revisiones/acciones usan `expectedVersion`; versión antigua da `409 STALE_DRAFT`.

Entrada estricta `schemaVersion: "2.0"`; salida `{schemaVersion,data,meta}`. `data` contiene `id`, `kind`, `status`, `version`, scope, fechas y datos tipados del agregado. Listados aceptan `limit` (1–100) y `offset`, con `nextOffset`. GET devuelve el snapshot evaluado en `evaluatedAt`; cada compromiso revalida contra fuentes actuales. Una fila histórica elegible no garantiza disponibilidad futura.

Las publicaciones iniciales usan el DTO de `shared/schemas/v2/workflow.ts`; revisión: `{expectedVersion,value}`. Acciones usan `{schemaVersion,expectedVersion,note,evidence,...camposDeAcción}`. Las rutas completas se enumeran en [inventario ejecutable publicado](./HAC40_API_ENDPOINTS.md).

| Familia | GET/listado/detalle | POST |
|---|---|---|
| Nodos/corredores/políticas/condiciones | `/routing/nodes`, `/routing/corridors`, `/routing/policies`, `/routing/conditions` | publicación y `/:id/revisions`, administrador de catálogo |
| Límites efectivos | `/carriers/:carrierId/route-limits` | publicación/revisión con evidencia fabricante/vía/compatibilidad, editor autorizado |
| Ruta | `/freight/requests/:requestId/routes`, `/routes/:id` | itinerario dirigido explícito de corredores publicados |
| Plan | `/freight/requests/:requestId/plans`, `/plans/:id` | recursos/ventanas por tramo y cantidades enteras por unidad |
| Oportunidad | solicitud y `/carriers/:carrierId/opportunities` | solicitud invita; carrier responde en `/:id/responses` |
| Oferta | solicitud y `/carriers/:carrierId/offers`, `/offers/:id` | carrier emite desde `/opportunities/:parentId/offers`; `/:id/withdrawals` |
| Scoring/métricas | `/scoring/policies`, `/carriers/:carrierId/metrics` | publicación/revisión versionada |
| Ranking/decisión | `/freight/requests/:requestId/ranking`, `/decisions` | materializar ranking, seleccionar; decisión `/:id/revocations` |
| Booking | `/bookings`, `/bookings/:id`, vista carrier | autorización del shipper; confirmación/rechazo carrier; cancelación |
| Hold/reserva | `/capacity/holds`, `/bookings/:parentId/reservations`, vista carrier | crear, confirmar carrier, liberar; versión esperada |
| Consolidación | `/carriers/:carrierId/consolidations` | crear viaje LTL con categorías/requisitos compatibles evidenciados; `/:id/closures` |
| Ejecución | `/executions`, `/bookings/:parentId/execution`, vista carrier | creación desde booking; carrier inicia/completa/cancela/publica posición |
| Eventos/incidentes | eventos e incidentes por ejecución; actualizaciones por incidente | carrier abre incidente, añade nota, resuelve/reabre; historial retenido |
| Estado de activo | `/carriers/:carrierId/assets/:parentId/events` | cambio de estado con versión/evidencia; respeta compromisos |

## Reglas implementadas

- Ruta dirigida y continua; origen/destino canónicos y modos aceptados; evidencia, vigencia, condiciones, duración y documentos requeridos. Conector de coordenadas sin fuente, frontera sin reglas y adaptador modal no verificado conservan `UNKNOWN`. No se deduce cobertura por cercanía ni se inventa geometría/peaje.
- Plan carga cada unidad completa por tramo, calcula peso/volumen desde el snapshot y verifica categoría, servicio, lane, áreas, equipo, capacidades, dimensiones, temperatura/requisitos, ventanas, mantenimiento y reposicionamiento. Cambios de solicitud/nodo/corredor/política invalidan confirmaciones. Devuelve límite efectivo y referencias/versiones utilizadas.
- Combinación: tara/bruto, compatibilidad y límites de fabricante/vía deben tener fuente. Una unidad portadora evita sumar capacidades nominales de tractor/remolque; el hold ocupa todos sus calendarios. La confirmación de VehicleAssignment deja de estar bloqueada cuando existe ese compromiso de plan verificado.
- FTL excluye ocupación simultánea. LTL comparte un viaje explicitamente evidenciado, itinerario compatible, categorías y requisitos permitidos. Se controla el pico simultáneo de peso/volumen, sin sumar ventanas consecutivas. La exclusividad entre viajes diferentes permanece. Cada tenant conserva booking/ejecución/reservas propios. La prueba de reserva compartida no certifica todavía la operación física conjunta entre tenants: la coordinación de conductor/viaje común sigue pendiente.
- Oferta atribuida al carrier y actor real, no al shipper; versión/sustitución auditadas. USD a centavos, desglose consistente, vigencia/fuente/capacidad reservable. Datos estimados/excluidos/desconocidos no se comparan como precio final.
- Ranking `DISJOINT_COVER_V1`: enumera conjuntos de ofertas vigentes que cubren exactamente todas las asignaciones de cada plan, sin doble cobertura. Costo suma centavos; tránsito suma duraciones declaradas por los emisores; fiabilidad usa mínimo de tasas carrier con muestra/período/fuente. Esas agregaciones son dimensiones del scoring, no ETA confirmada. Pesos/versiones y explicaciones persisten; empates por lista ordenada de UUIDs de oferta. Si el universo excede 65 536 estados por plan, la operación falla con `RANKING_COMPLEXITY_LIMIT`: no presenta una búsqueda truncada como óptima.
- Decisión: solicitud presentada, plan vigente y cobertura completa una sola vez. Booking diferencia autorización shipper y confirmación carrier. Confirmar exige reservas confirmadas de todas las asignaciones cubiertas. Los bookings de distintas ofertas son independientes; no se afirma atomicidad de proveedores externos.
- Holds caducados se liberan bajo lock al ejecutar comandos; GET expone `active` y caducidad. No se libera un hold de booking confirmado sin cancelar coordinadamente. Cancelar libera reservas/asignaciones/ejecuciones en la misma transacción. Los cambios toman locks de servicios en orden estable; el lock amplio es un límite de rendimiento pendiente de medición.
- Inicio exige booking confirmado, disponibilidad actual, vehículos y conductores confirmados. Completar libera compromisos y solo completa el booking cuando todos sus servicios han terminado. Cancelar una ejecución cancela coordinadamente su booking y libera todos sus compromisos. Después de movimiento, el calendario queda UNKNOWN hasta reconfirmación de posición/disponibilidad; un tramo siguiente puede usar la continuidad evidenciada del mismo plan. Posición exige fuente, correlación, observación válida y orden temporal; no se inventa GPS. Incidentes y eventos retienen actor/fecha/evidencia.

## Persistencia y seguridad

26 tablas físicas nuevas para agregados/relaciones y receipt privado. `transport_executions` y `capacity_reservations` se amplían aditivamente. Cada tabla nueva tiene RLS y acceso directo de clientes revocado; escritura mediante vocabulario cerrado y funciones privadas sin EXECUTE público. Public wrappers validan auth.uid, miembro activo, rol y grants carrier actuales, incluso antes de un replay. FKs y sus índices conservan relaciones físicas; las referencias de tenant/carrier se validan en comandos. El catálogo global de routing es legible por miembros; edición exige administrador.

`capacity_reservations` expone únicamente ID/calendario/ventana/estado al discovery general. El detalle de compromiso/evidencia/booking queda en GET autorizado por tenant/carrier. La exclusión de reservas sin consolidación conserva `23P01`, traducido a conflicto estable en API.

## Verificación y límites de cierre

- pgTAP `22`–`28`: flujo comercial/booking, operación real de comandos, LTL entre tenants, combinación con dos calendarios, restricciones físicas/fuentes y multi-tramo/multi-oferta. Fixtures transaccionales revertidos; ningún dato sintético dentro de la migración.
- `scripts/check-hac40-workflow-race.py`: carreras reales de dos conexiones; fixture y limpieza restringidos al contenedor local dedicado.
- `test:hac40:workflow-http`: 14 colecciones/detalles, DTO de salida real, aislamiento y POST/replay/revisión/stale, hold → confirmación → booking → cancelación atómica mediante Next/Hono y Supabase local. La preparación es un escenario sintético explícito.
- `test:hac40`/release contienen pruebas de frontera de aplicación; typecheck, arquitectura, build y gate nativo se registran en la evidencia del PR.

Este incremento implementa las familias pendientes B3–B6; no certifica automáticamente las 57 clases/397 atributos/93 relaciones. La matriz atributo por atributo sigue requiriendo contraste del esquema real, incluyendo adaptadores/configuración y divergencias declaradas. RoutePlanner valida itinerarios publicados suministrados explícitamente; no se ha acreditado búsqueda automática completa de red/asignaciones. La capacidad contratada sin límites/capabilities comprobables permanece desconocida. Modos sin adaptador, polígonos/partners sin resolución espacial, pilotaje de camión/MTC y llamadas a carriers externos no quedan verificados por los positivos ROAD locales.

HAC-41 integra permisos/MCP con estos servicios; HAC-42/43 conectan UI completa; HAC-44 contrasta/aplica el corte aprobado a Supabase V2 y valida round-trip alojado. Ninguna de esas dependencias autoriza cerrar HAC-40 ni retirar faltantes del alcance. No hubo merge, cambio de Vercel, seed/DDL alojado ni afirmación de Alexa live.
