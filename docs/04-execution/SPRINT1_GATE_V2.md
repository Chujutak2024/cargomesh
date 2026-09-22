# Gate 1 V2 — acta de avance (no cierre)

**Corte:** 22 de septiembre de 2026 (Lima). **Base inspeccionada:** `codex/v2-amazon-contracts` @ `0d3a0d2`. **Responsable:** Cristhian, HAC-26. **Estado:** en progreso; HITO 1 no está aprobado.

## Regla de aceptación

El dueño culmina su issue y entrega PR/evidencia → el equipo valida DoD, pruebas y límites → el Tech Lead aprueba → el integrador autorizado mergea a `codex/v2-amazon-contracts`. Para hallazgos bajos no semánticos, el integrador puede corregir con diff y prueba visibles; medios/altos vuelven al dueño y se revalidan. Un PR que ya se mergeó se audita, no se mergea por segunda vez. Véase [la escala V2](../v2-amazon/LINEAR_ISSUE_TEMPLATE.md#flujo-de-aceptación-y-escala-de-hallazgos).

## Matriz provisional issue → entrega → aceptación

| Issue / dueño | PR o evidencia observada | Estado de gate al corte |
|---|---|---|
| HAC-21 · Cristhian | [PR #83](https://github.com/Chujutak2024/cargomesh/pull/83) mergeado; migración ROAD, RLS, pgTAP y [mapping](../v2-amazon/SPRINT1_DATA_MAPPING.md) | `Done` en Linear. No incluye capacidad/calendario, `mcp_account_links` ni tools comerciales V2. |
| HAC-22 · Axel | [PR #85](https://github.com/Chujutak2024/cargomesh/pull/85) mergeado; transporte MCP, service auth, perfiles V1/V2 y [estado Alexa/Bedrock](../v2-amazon/SPRINT1_ALEXA_SECURITY_AND_BEDROCK.md) | `In Progress` en Linear: Gate-1 preparó corrección de la atribución `BLOCKED_BY_HAC21` sin habilitar negocio; falta revisión del dueño/PR de Gate-1 y aceptación individual. Sin Alexa+ ni Bedrock live. No repetir PR #85. |
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
2. Recibir y evaluar HAC-23/24/25 y evidencias HAC-17/18 según su DoD. Cada defecto medio/alto vuelve a su dueño; no se reparte la implementación funcional en el gate.
3. Ejecutar la suite integrada pertinente, verificar preview/alternativa aprobada y registrar resultado final por issue. No cerrar HITO 1 ni HAC-26 antes de ello.
