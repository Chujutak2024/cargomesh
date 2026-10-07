# HAC-15 — Revisión del contrato y handoff a Luis

2 octubre 2026 · Juan · [PR #92](https://github.com/Chujutak2024/cargomesh/pull/92) · **IN REVIEW — DO NOT MERGE**.

## Snapshot comprobado

| Fuente | SHA / referencia |
| --- | --- |
| Juan, antes de esta corrección | `feat/fe2-v2-route-map` @ `6654c7353b78a11745edee6711f3e63a569c5ab0` |
| Target del PR | `feat/cycle-2-integration` @ `f2a8e3eb441e7bdd35718e7c69192256c6aaf553` |
| Base contractual | `codex/v2-amazon-contracts` @ `66a195207379f6f6be3eafd7ace02d254e7cf1c8` |
| API / schemas HAC-12, inspección solamente | `feat/be2-v2-road-serviceability` @ `605435b3e6299b86486c21de610806830f381bb8` |
| Luis / mapper HAC-14, inspección solamente | `feat/fe1-v2-intake-eligibility` @ `226624e3bcf4c7856c7aa21fcbeed9eaaf93ab18` |
| Contrato documental | [HAC-27 §6.1 y decisiones CP-1](https://linear.app/hackatonteamcargomesh/document/hac-27-mapeo-57-clases-v2-a-bdapi-patrones-atomicidad-y-contratos-v20-d2a9ef6d0876) |

Se leyeron AGENTS.md y la entrada V2. Se actualizaron referencias con `git fetch`; no hubo pull, merge ni incorporación de código ajeno. No había hallazgos humanos nuevos en la discusión de #92: esta revisión responde a la instrucción recibida. El SHA de entrega se publica en el comentario de #92/HAC-15 para no crear una referencia circular al commit del documento.

## Correcciones propias

1. **Fixture de cero candidatos:** ahora Piura → Arequipa, `overallStatus: "ineligible"`, `candidates: []`, selección `null`. El schema real calcula ineligible cuando no hay candidatos elegibles ni desconocidos. El antiguo fixture `unknown` falla su validación. No sustituir indiscriminadamente el `unknown` del workspace local sin evaluación por una exclusión del API.
2. **Coordenadas nulas:** los fixtures canónicos usan ambos valores `lat/lng: null` por extremo ausente. La prueba defensiva de coordenada parcialmente ausente sigue cubierta en el modelo.
3. **Severidad de condiciones:** HAC-12 usa `z.string().min(1)`; el tipo del mapa ahora acepta `string` y no rechaza una respuesta válida del proveedor. HAC-27/Luis enumeran INFO/WARNING/CRITICAL: el contrato más amplio del API se documenta para que Cristhian/Luis alineen sus tipos al integrar. No se modificaron sus archivos.
4. Los fixtures de la página QA se extrajeron a `road-map-qa-fixtures.ts` para que la prueba valide **los mismos datos** que usa el navegador, evitando un fixture de test distinto y verde.

## Props contra el contrato real

`cargomesh/src/features/v2-road-map/road-candidate-map-view.tsx` exporta el componente. Las seis props siguen siendo:

| Prop | Tipo / procedencia | Verificación |
| --- | --- | --- |
| `origin`, `destination` | Ubicaciones canónicas de GET; facilityId/region opcionales o nulos, lat/lng nulos admitidos | Tipo inferido de HAC-12 asignable al del mapa; fixtures nulos aceptados por Zod. |
| `overallStatus` | eligible / ineligible / unknown de evaluación | No se recalcula en el componente. Cero candidatos evaluados = ineligible en el API actual. |
| `candidates` | ID, status, carrier, service ROAD, aliases y preview nullable | Props reales de Luis asignables sin casts; alias provistos por su mapper. No inferir elegibilidad por el mapa. |
| `selectedCandidateId` | string / null del padre | Null/ID eliminado nunca selecciona el primer candidato ni toma su geometría. |
| `onSelectCandidate` | Callback del padre | Se conserva su identidad en el mapper real; Enter/Space sincronizan la selección del padre de QA. |

**Montaje exacto para Luis:** en su SHA inspeccionado, `v2-intake-prototype.tsx:346` monta `RoadCandidateMapBoundary`, inmediatamente después de `CandidateResults` en `integrationArea`. Sustituir el interior de `components/road-candidate-map-boundary.tsx` por `<RoadCandidateMapView {...props} />`. Conservar la firma del caller, LocaleProvider y el mapper de cuatro argumentos:

```tsx
mapServiceabilityToMapViewProps(
  request, evaluation, selectedCandidateId, setSelectedCandidateId,
);
```

Las tarjetas y el mapa usan **el mismo** estado/callback. No dar al mapa una `key` por candidato, otro draft, un segundo controller ni una selección interna. [Handoff completo, incluyendo migración de /v2-workspace](./HAC15_HAC14_INTEGRATION_HANDOFF.md).

## Qué está simulado y qué está disponible

| Superficie | Geometría | Condiciones | Límite |
| --- | --- | --- | --- |
| `/hac15-preview`, candidato A | Tres puntos y 1 015 km / 18,5 h de fixture; `SCENARIO_SYNTHETIC_GEOMETRY / SIMULATED` | `conditions: []`; **no** se simulan tráfico, clima, bloqueo o permisos | Nombres, eligibility y ubicaciones de escenario, no carriers/instalaciones live. Google es únicamente el basemap. |
| Fixture B / cero candidatos / coordenadas nulas / legs vacíos | Ninguna línea; geometría efectiva UNKNOWN | Sin condiciones disponibles | No fabricar puntos ni métricas. |
| Fixture `UNKNOWN con puntos` | Payload deliberadamente inválido: el schema real lo rechaza; el mapa defensivamente suprime sus puntos | Vacías | Es una prueba negativa de entrada inválida, no un envelope API válido. |
| HAC-12 @ `605435b` | `evaluate-v2-road.ts` entrega **routePreview:null**; aún sin proveedor de ruteo o geometría sintética aprobada | No hay preview ni condiciones de ruta entregadas | En integración, sólo pines canónicos. No reemplazar null con Google local ni con fixture A. Esta es evidencia de código, no ejecución HTTP/DB aquí. |
| `/v2-workspace`, adaptador local opcional | Google Routes cuando responde: `GOOGLE_ROUTES_API / ESTIMATED`; ausencia/fallo = null | `DRIVING_ROUTE_NOT_TRUCK_VALIDATED`, WARNING/ESTIMATED: advertencia generada por CargoMesh, **no observación de la carretera** | Consultas y capturas previas documentadas; no reconsultadas en esta revisión. DRIVE no certifica aptitud/restricciones de camión. |

El componente no representa por ahora una capa de condiciones. No declarar que se validaron condiciones de tráfico/clima ni disponibilidad. La futura UI conserva la procedencia por condición; no hereda VERIFIED del basemap ni completa fechas con el reloj del navegador. `evaluatedAt`, `draftVersion`, `serviceClass` y checks comerciales quedan en las tarjetas/resumen del controller de Luis; no están en las seis props.

## Evidencia fresca

Desde `cargomesh/`:

```powershell
pnpm exec tsx scripts/verify-hac15-contract.ts
pnpm exec tsx --test src/features/v2-road-map/road-map-model.test.ts src/features/v2-workspace/workspace-model.test.ts src/features/v2-workspace/road-locations.test.ts src/server/maps/local-road-preview.test.ts
pnpm typecheck
pnpm check:architecture
pnpm build
```

| Verificación | Resultado | Evidencia / límite |
| --- | --- | --- |
| Contratos reales | PASS, 6 comprobaciones | [Registro de schemas y mapper](./evidence/hac15-handoff/review-2026-10-02-contract.json). Lee refs Git y ejecuta snapshots temporales en caché de dependencias, luego los elimina; no copia código ajeno al producto, no llama al API/DB. Requiere refs fetchadas. |
| Tests dirigidos | PASS 33/33 | Mapa 10, workspace 7, catálogo 3, adaptador 13. No se reejecutó release completa/pgTAP. |
| Typecheck / arquitectura / build | PASS | 238 módulos / 30 client entry points; Next 15.5.24. |
| Interacción local | PASS 12/12 | [Registro DOM/consola](./evidence/hac15-handoff/review-2026-10-02-interaction.json): padre QA ↔ mapa, Enter/Space, limpiar selección, salida con Tab, nulos y UNKNOWN. No tarjetas/controller reales de Luis. |
| Móvil | PASS | 390×844 EN y 320×740 ES, sin overflow horizontal. Emulación de viewport, no dispositivo físico. |
| Google basemap | PASS | Ocho capturas 23–30, atribución/pines/nota de proveedor visibles. Geometría sintética rotulada o ausencia de línea. |
| Consola | 0 errores durante smoke | Aviso de deprecación de Marker; [registro sanitizado](./evidence/hac15-handoff/review-2026-10-02-interaction.json). |
| Fallo/fallback de proveedor | Pruebas del modelo PASS; browser histórico | La captura 05/3093 documenta fallo real anterior. **No se indujo ni se revalidó un fallo de proveedor en el navegador de esta revisión.** Sin cambios de credenciales/restricciones. |

La superficie `/hac15-preview` se habilita sólo con `next dev`, no en `next start`/producción. Para reproducir usar puerto/origen autorizado localmente. El servidor HTML que ocupaba 8080 fue detenido para ejecutar esta app React, sin modificar sus archivos.

## Smoke conjunto pendiente — Luis / Juan / QA

1. Montar el boundary real y compilar el snapshot integrado; usar tipos canónicos una vez integrados, sin casts.
2. POST → GET → serviceability del mismo request/draftVersion; canonical endpoints y checks reales. No atribuir las pruebas de fixtures a persistencia.
3. Tarjeta ↔ mapa, selección eliminada, cambios rápidos, reset, navegación/restauración y respuestas obsoletas. Un solo draft/controller por encima de todas las vistas conectadas.
4. Repetir Piura → Arequipa con envelope real ineligible/counts cero y casos null/legs vacíos/coordenadas ausentes. **No fabricar geometría para suplir el null actual de HAC-12.**
5. Repetir fallo de proveedor, teclado y móvil en integración; conservar fuente, versión, fecha y FTL/LTL/UNKNOWN reales. QA-13-20 y aceptación humana pendientes.

**Entrega corregida disponible para revisión. Integración/API/DB y aceptación QA pendientes.** Sin merge, despliegue ni cambios de Vercel, Supabase remoto o Google Cloud.
