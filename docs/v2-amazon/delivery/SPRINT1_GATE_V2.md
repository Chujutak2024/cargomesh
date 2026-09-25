# Gate 1 V2 — acta de avance (no cierre)

**Corte:** 22 de septiembre de 2026 (Lima). **Base inspeccionada:** `codex/v2-amazon-contracts` @ `0d3a0d2`. **Rama de gate:** `feat/cycle-1-integration`, [PR #86](https://github.com/Chujutak2024/cargomesh/pull/86) en borrador. **Responsable:** Cristhian, HAC-26. **Estado:** en progreso; HITO 1 no está aprobado.

## Regla de aceptación

El dueño culmina su issue y entrega PR/evidencia → el equipo valida DoD, pruebas y límites → el Tech Lead aprueba → el integrador autorizado mergea a `codex/v2-amazon-contracts`. Para hallazgos bajos no semánticos, el integrador puede corregir con diff y prueba visibles; medios/altos vuelven al dueño y se revalidan. Un PR que ya se mergeó se audita, no se mergea por segunda vez. Véase [la escala V2](./LINEAR_ISSUE_TEMPLATE.md#flujo-de-aceptación-y-escala-de-hallazgos).

## Matriz provisional issue → entrega → aceptación

| Issue / dueño | PR o evidencia observada | Estado de gate al corte |
|---|---|---|
| HAC-21 · Cristhian | [PR #83](https://github.com/Chujutak2024/cargomesh/pull/83) mergeado; migración ROAD, RLS, pgTAP y [mapping](./SPRINT1_DATA_MAPPING.md) | `Done` en Linear. No incluye capacidad/calendario, `mcp_account_links` ni tools comerciales V2. |
| HAC-22 · Axel | [PR #85](https://github.com/Chujutak2024/cargomesh/pull/85) mergeado; transporte MCP, service auth, perfiles V1/V2 y [estado Alexa/Bedrock](./SPRINT1_ALEXA_SECURITY_AND_BEDROCK.md) | `In Progress` en Linear: Gate-1 preparó corrección de la atribución `BLOCKED_BY_HAC21` sin habilitar negocio; falta revisión del dueño/PR de Gate-1 y aceptación individual. Sin Alexa+ ni Bedrock live. No repetir PR #85. |
| HAC-23 · Jean Paul | Sin PR/evidencia aceptada en este corte | Pendiente de QA, escenario V2, matriz y pruebas. |
| HAC-24 · Luis | Sin PR/evidencia aceptada en este corte | Pendiente de sistema visual y prototipo navegable. |
| HAC-25 · Juan Antonio | Sin PR/evidencia aceptada en este corte | Pendiente de ADR cartográfica, mapa piloto y validación. |
| HAC-17 · Axel | `In Review` en Linear | Verificar acuse de solicitud AWS y separar créditos de cuota/permiso Bedrock. |
| HAC-18 · Jean Paul | `In Review` en Linear | Verificar acceso y muestra auténtica de evidencia Drive/Kiro Crew; fecha registrada 21 sep. |
| HAC-26 · Cristhian | Esta acta provisional | Gate en progreso; falta revisión de los otros frentes, suite integrada y decisión final por issue. |

PR #81 y #82 de gobernanza también están mergeados en la base. HITO 0 conserva aceptación explícita pendiente; no se marca completo por esas fusiones ni por casillas históricas.

Linear muestra HITO 1 al **25%** después de pasar HAC-22 y HAC-26 a `In Progress`. Es una métrica visual de estados, **no** 25% de entregas aprobadas; solo HAC-21 está `Done` en este corte.

## Verificación ejecutada sobre la base

- `pnpm typecheck` en `cargomesh/`: PASS.
- `pnpm test:mcp`: 74/74 PASS.
- `pnpm test:narration`: 4/4 PASS.
- HAC-21 documentó reset local en su rama. Gate-1 no repitió ese reset para preservar la instancia local; sí repitió pgTAP.
- Nueva ejecución Gate-1 de `pnpm dlx supabase test db --local`: 9 archivos, 183 aserciones PASS contra la instancia local CargoMesh; no se ejecutó `db reset`.
- En la rama de integración, `pnpm typecheck`, `pnpm test:release` y `pnpm build`: PASS tras la corrección de metadatos MCP. Esta verificación no sustituye una prueba Alexa+ real ni un preview HTTPS.
- GitHub registra `Vercel: failure` para `0d3a0d2`. PR #83 atribuyó un fallo previo al `rootDirectory=frontend`; falta verificar el log de este deployment antes de confirmar la causa actual. No cambiar producción como arreglo lateral; véase [FL-01](./friction-logs/FL-01.md).

## Decisiones abiertas antes del cierre

1. Gate-1 prepara catálogo/test/docs que ya no imputan a HAC-21 el account linking y los servicios FreightRequest V2. Axel debe revisar el cambio en PR antes de aceptación de HAC-22; el bloqueo conserva comportamiento fail-closed. El alcance posterior necesita issue/dueño aprobado, sin reabrir HAC-21 por conveniencia.
2. HAC-23 ya cubre QA transversal: Jean Paul valida los casos MCP y el escenario V2, sin abrir una issue de tester duplicada. Recibir y evaluar también HAC-24/25 y evidencias HAC-17/18 según su DoD. Cada defecto medio/alto vuelve a su dueño; no se reparte la implementación funcional en el gate.
3. Ejecutar la suite integrada pertinente, verificar preview/alternativa aprobada y registrar resultado final por issue. No cerrar HITO 1 ni HAC-26 antes de ello.
4. Si HAC-24/25 entregan un flujo consumible, solicitar la caminata humana corta y registrar pasos, expectativas, resultado y reprueba según el [plan de calidad V2](./QUALITY_AND_VALIDATION_PLAN.md). Si solo hay prototipo, etiquetarlo como tal; no añadir una prueba manual ficticia ni cambiar retroactivamente el DoD de las issues sin acordarlo con sus dueños.

## Revisión UML/DER registrada el 24 sep — decisión pendiente, no ampliación del Gate-1

El equipo ratificó el [corte MVP ROAD/USD](../contracts/PRODUCT_SCOPE.md#corte-de-mvp): disponibilidad sí/no/desconocida, una oferta atribuible por decisión en el primer corte comercial, y multimodal/múltiples responsables/heurística de mapa solo como diseño o simulación rotulada hasta contar con evidencia. Se derivó un [DER lógico propuesto](../models/V2_LOGICAL_ERD.md) y se contrastó **con migraciones de Git**, no con el Supabase V2 remoto aún no consultado. Esto no afirma que HAC-23/24/25 o HITO 1 hayan implementado oferta, ranking, booking o capacidad por fecha.

Queda pendiente ratificar el XML manual de clases: 9 conectores con extremos sueltos, relaciones oferta–servicio y booking–reserva ausentes, y verbos «calcula»/«respalda cobertura» equívocos; véase [la revisión](../models/CLASS_DIAGRAM_DESIGN.md#verificación-pendiente-del-xml-manual). Registrar esta decisión/pendiente en HAC-26 para trazabilidad, **sin añadirlo al DoD del gate ni impedir la aceptación individual de entregas Sprint 1 por un diseño futuro**. Las migraciones de Hitos 2–4 requieren revisión separada.

## Actualización de verificación — 25 sep 2026 (Lima)

Este apartado actualiza el corte histórico anterior; no declara Gate-1 aprobado ni autoriza despliegue.

- La base remota `codex/v2-amazon-contracts` está en `92b9735`: [PR #87](https://github.com/Chujutak2024/cargomesh/pull/87) de HAC-23 se mergeó como `a22e6e3` y [PR #88](https://github.com/Chujutak2024/cargomesh/pull/88) de HAC-24 como `92b9735`. Ambas issues figuran `Done` en Linear. PR #83/#85 permanecen mergeados y no se repiten.
- [PR #86](https://github.com/Chujutak2024/cargomesh/pull/86) se cerró **sin merge**. Por tanto, la base aún devuelve `blockedBy: "HAC-21"` en el catálogo MCP y su repositorio de account links todavía atribuye a HAC-21 un entregable que no estaba en su alcance. La rama de integración contiene la corrección fail-closed, y `pnpm typecheck` y `pnpm test:mcp` (74/74) pasaron localmente, pero esa corrección no está publicada en la base. HAC-22 sigue `In Progress`; no requiere producción, Alexa+ live ni Bedrock live para el corte local, sí cerrar la atribución errónea y la aceptación trazable.
- Verificación nueva sobre un checkout **aislado y limpio** de `92b9735`: `pnpm install --frozen-lockfile --offline`, `pnpm typecheck`, `pnpm test:release` y `pnpm build` pasaron. No se ejecutó un reset Supabase ni pgTAP en este checkout; PR #87 registró su check `Local Supabase pgTAP` exitoso. El contexto Vercel del merge `92b9735` sigue en `failure`; no se infiere la causa del log ni se cambia producción para resolverlo.
- HAC-25 y HAC-26 continúan `In Progress`. La rama local `feat/cycle-1-integration` no incluye aún los merges #87/#88 y conserva reorganización documental sin consolidar. Un merge simulado detectó conflictos en `docs/04-execution/friction-logs/FL-01.md` y `docs/v2-amazon/README.md`; además, los documentos nuevos `SPRINT1_QA_MATRIX.md` y `SPRINT1_UI_PROTOTYPE.md` de la base no están todavía ubicados en `delivery/`. No publicar el árbol local tal cual ni sobrescribir la base.

**Siguiente control:** integrar los merges aceptados en la rama declarada preservando el trabajo local, resolver conflictos y rutas/documentos, ejecutar el gate sobre el árbol resultante y registrar por separado la decisión de HAC-22. Cerrar HAC-26/HITO 1 solo tras recibir o declarar explícitamente el corte de HAC-25 y completar el acta.
