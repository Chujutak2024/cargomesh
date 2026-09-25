# Revisión previa del modelo de datos V2 — inventario, no paquete visual vigente

**Sustituido para la revisión del jueves por [MODEL_DIAGRAMS_REVIEW.md](./MODEL_DIAGRAMS_REVIEW.md).** Los `.drawio` enlazados abajo fueron exploratorios y no deben presentarse como diagramas de clases, estados o DER V2 aprobado. La comparación remota de esta página fue una **fotografía del 22 sep**, ya superada por la aplicación de migraciones del 23 sep; para el estado vigente, ver [DOMAIN_UML_MODEL.md](./DOMAIN_UML_MODEL.md) y [FL-02](../04-execution/friction-logs/FL-02.md).

**Paquete editable para diagrams.net/draw.io:**

- [DER / modelo de datos](./diagrams/CARGOMESH_V2_DATA_MODEL.drawio): tres páginas: (1) SQL integrado en Git por HAC-21, (2) decisiones Sprint 2, (3) dominio objetivo posterior.
- [Diagrama de clases](./diagrams/CARGOMESH_V2_DOMAIN_CLASSES.drawio): solicitud/cobertura y capacidad/mercado.
- [Diagramas de estado](./diagrams/CARGOMESH_V2_STATE_MODELS.drawio): solicitud, oportunidad/oferta, booking/vínculo MCP y capacidad por ventana.

**Estado:** borrador de revisión histórica; los dibujos no aprueban tablas, estados ni integraciones. La primera página del DER se cotejó con la migración del repo antes de su aplicación remota; el despliegue posterior no convierte este DER exploratorio en aprobado. Los conceptos amarillos son hipótesis explícitas.

## Fuentes y convención

- Verde = tablas definidas por [HAC-21](./SPRINT1_DATA_MAPPING.md) y su [migración en Git](../../supabase/migrations/20260922053512_v2_road_facilities_services.sql). La etiqueta original «no desplegadas al 22/9» pertenece a la fotografía histórica; las tablas existen en el remoto desde el 23/9, sin datos de catálogo V2.
- Gris = tablas que ya existían en la base anterior; su existencia no prueba comportamiento V2.
- Amarillo discontinuo = concepto propuesto, sin migración/DoD aceptado. Azul = resultado de servicio que **no es tabla**.
- La autoridad para reglas comerciales es [DOMAIN_CONTRACTS](./DOMAIN_CONTRACTS.md), [cobertura](./CARRIER_COVERAGE_AND_SERVICEABILITY.md), [flota/planes](./TRANSPORT_PLANS_AND_FLEET.md) y [ranking](./CARRIER_DISCOVERY_AND_RANKING.md). `docs/architecture-v2/` es propuesta transicional, no fuente normativa: sus referencias a WebMCP y BALANCED no se copian al modelo activo.

## Contraste histórico con Supabase (lectura remota, 22 sep 2026)

Proyecto conectado: `cargomesh` (`tokvzfrefwqobzqgbfoj`), mismo ref que `supabase/.temp/project-ref`. Se consultaron solo catálogo de tablas, RLS y lista de migraciones; **no se ejecutó DDL ni se alteraron datos**.

**Actualización 23 sep:** las dos migraciones pendientes se aplicaron a ese proyecto. Ahora constan en el historial remoto; `facilities`, `carrier_depots`, `service_areas` y `service_lanes` existen con RLS y políticas y tienen cero filas. La tabla siguiente explica el **desfase detectado el día 22**, no el estado actual. No inferir discovery ni capacidad live a partir del despliegue del esquema.

| Corte | En Git | En Supabase remoto | Implicación |
|---|---|---|---|
| Baseline V1/transicional | `organizations`, `organization_members`, `freight_requests`, `carriers`, `carrier_services`, `vehicles`, `carrier_offers`, `bookings`, `booking_authorizations` | Presentes; RLS activado en las nueve | Reutilizar identidad, tenant, intake e infraestructura con revisión de semántica; su presencia no valida cobertura, disponibilidad, ofertas ni booking V2. |
| Idempotencia de creación del draft | Migración `20260918120000_c_draft_creation_idempotency.sql` | **No figura** en historial remoto | No afirmar que la garantía de esa migración opera en remoto. Verificar dependencias y prueba tras despliegue autorizado. |
| Sedes y cobertura ROAD HAC-21 | Migración `20260922053512_v2_road_facilities_services.sql`: `facilities`, `carrier_depots`, `service_areas`, `service_lanes`, FKs de sedes en `freight_requests`, índices/RLS | **No figura** en historial; ninguna de las cuatro tablas existe | El modelo físico está integrado en Git, no disponible en remoto. Su aplicación necesita gate de migraciones, comprobación de dependencias y smoke/pgTAP en destino. |
| Identidad Alexa HAC-11 | `mcp_account_links` previsto | No existe | El rechazo cerrado actual es correcto; no declarar acceso Alexa+ de usuario como operativo. |
| Capacidad, rutas, mercado V2 | Activos/cupos, calendario/reservas, route plans, opportunities, scoring policy son contratos/diseño | No existen como tablas V2 | Definir granularidad, ownership, FKs, RLS, índices, concurrencia y pruebas por issue antes de migrar. `vehicles`, `carrier_offers` y `bookings` actuales no sustituyen esos contratos. |

**Seguimiento del desfase:** se cerró la diferencia de historial/esquema indicada arriba. Faltan datos V2, casos de servicio y pruebas de flujo en el destino. No usar este DER exploratorio como autorización de nuevos despliegues.

## Revisión de clases y estados

- **Clases:** confirmar identidad de `Facility` frente a `CarrierDepot`, multiplicidades, separación servicio/área/lane, especificación de carga como value object/JSONB, activo frente a cupo contratado, combinación de recursos, procedencia de oferta y política versionada.
- **Estados:** solo `DRAFT → PENDING` es un paso de solicitud comprobado para V2; `STALE_DRAFT` y replay idempotente son resultados técnicos, no estados. Los demás nodos amarillos son propuestas; revisar eventos, actor, guard, timeout, cancelación, reversión y auditoría antes de codificarlos. `eligible/ineligible/unknown` es resultado de evaluación, no estado persistente de `FreightRequest`.
- **Transiciones comerciales:** una oportunidad no equivale a oferta; una oferta válida no autoriza booking. El link MCP debe estar activo, con membresía/tenant/scopes vigentes. Sin ello, acceso denegado.

## Qué debe decidir el equipo el jueves

| Pregunta | Decisión/evidencia esperada | Dueño propuesto |
|---|---|---|
| ¿Las cardinalidades y FKs del corte ROAD son correctas? | Confrontar `organizations → facilities`, `carriers → carrier_services/depots`, `service_areas → service_lanes` y las dos FKs compuestas de `freight_requests`. La sede nunca otorga cobertura por sí sola. | Cristhian · HAC-21/Gate-1 |
| ¿Qué vínculo persistirá para un usuario Alexa/MCP? | HAC-11 especifica clave única usuario+cliente, organización, scopes, estado/revocación, RLS y selección explícita de organización; no habilitar por primera membresía. | Axel · HAC-11 |
| ¿Cómo representar capacidad ROAD sin mentir? | HAC-12 elige activo individual, cupo contratado o ambos; ventana, reserva, mantenimiento y reposicionamiento; define qué dato faltante produce `unknown`. Evitar usar `vehicles` V1 como disponibilidad confirmada. | Cristhian · HAC-12 |
| ¿Dónde termina el Sprint 2? | Confirmar servicio de elegibilidad compartido y salida `eligible/ineligible/unknown` con fuente/fecha, consumida por Web y MCP. No exigir oferta, ranking o booking para este gate. | Cristhian/Axel/Luis/Juan · HAC-11…16 |
| ¿Qué queda en Hitos 3–4? | RoutePlan, TransportPlan, Opportunity, CarrierOffer, ScoringPolicy y Booking V2 se mantienen conceptuales hasta asignar migraciones, pruebas y owner. No elevar tablas legacy a contrato V2. | Equipo · planificación posterior |

## Criterios de aceptación del diagrama

1. Cada caja indica `en Git HAC-21`, `existente remoto legacy` o `propuesto`; ninguna propuesta ni migración solo en Git se interpreta como tabla desplegada.
2. Las relaciones del corte HAC-21 coinciden con las FKs de la migración, incluida la dirección A→B y los extremos `PICKUP`/`DELIVERY` del mismo servicio.
3. Toda nueva relación Sprint 2 tiene owner e issue; si el equipo la rechaza o difiere, se anota la decisión y se actualiza el dibujo antes del gate.
4. Un revisor de QA puede derivar casos: sede sin cobertura, lane inversa, otro tenant, link MCP revocado y ventana ocupada/desconocida. Los dos últimos son casos objetivo hasta que HAC-11/12 implementen sus tablas/servicios.
5. Los tres `.drawio` editables y una captura/exportación de cada página aprobada se enlazan a HAC-26 o HAC-16 según el corte decidido. La captura no reemplaza los archivos fuente.
6. La revisión deja una matriz por diagrama: entidad/estado, decisión, dueño, issue, prueba y si implica cambio de BD. Los nombres conceptuales rechazados se retiran, no se vuelven SQL por inercia.

## Acta de revisión (completar el jueves)

| Fecha/revisores | Decisión aprobada | Cambio requerido | Owner / issue | Evidencia |
|---|---|---|---|---|
| Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |

No modificar migraciones ni crear ramas solo para adecuarlas al dibujo. La secuencia correcta es **contrato aprobado → issue/owner → migración y pruebas → actualizar página implementada**.
