# Gate 1 V2 — acta de integración y cierre condicionado

**Corte:** 25 de septiembre de 2026 (Lima). **Base recibida:** `codex/v2-amazon-contracts` @ `92b9735` con PR #87 y #88 ya mergeados. **Rama de gate:** `feat/cycle-1-integration` con el árbol integrado en el checkout local; el remoto aún está en `abdb2bc` hasta publicar el commit preparado. [PR #86](https://github.com/Chujutak2024/cargomesh/pull/86) fue cerrado sin merge; no se depende de reabrirlo. **Responsable:** Cristhian, HAC-26. **Estado:** integración local verificada, pendiente de publicar el PR/CI y del merge autorizado en la base V2.

## Regla de aceptación

El dueño culmina su issue y entrega PR/evidencia → el equipo valida DoD, pruebas y límites → el Tech Lead aprueba → el integrador autorizado mergea a `codex/v2-amazon-contracts`. Para hallazgos bajos no semánticos, el integrador puede corregir con diff y prueba visibles; medios/altos vuelven al dueño y se revalidan. Un PR que ya se mergeó se audita, no se mergea por segunda vez. Véase [la escala V2](./LINEAR_ISSUE_TEMPLATE.md#flujo-de-aceptación-y-escala-de-hallazgos).

## Matriz provisional issue → entrega → aceptación

| Issue / dueño | PR o evidencia observada | Estado de gate al corte |
|---|---|---|
| HAC-21 · Cristhian | [PR #83](https://github.com/Chujutak2024/cargomesh/pull/83) mergeado; migración ROAD, RLS, pgTAP y [mapping](./SPRINT1_DATA_MAPPING.md) | `Done` en Linear. No incluye capacidad/calendario, `mcp_account_links` ni tools comerciales V2. |
| HAC-22 · Axel | [PR #85](https://github.com/Chujutak2024/cargomesh/pull/85) mergeado; transporte MCP, service auth, perfiles V1/V2 y [estado Alexa/Bedrock](./SPRINT1_ALEXA_SECURITY_AND_BEDROCK.md) | `In Review`. Gate-1 corrige la atribución errónea a HAC-21 sin activar tools comerciales; requiere PR/CI y revisión final. Sin Alexa+ ni Bedrock live. No repetir PR #85. |
| HAC-23 · Jean Paul | [PR #87](https://github.com/Chujutak2024/cargomesh/pull/87) mergeado; escenario ROAD V2, matriz QA, negativos y CI pgTAP | `Done`. La regresión WebMCP V1 queda separada del escenario V2. |
| HAC-24 · Luis | [PR #88](https://github.com/Chujutak2024/cargomesh/pull/88) mergeado; intake navegable, fixture V2 y pruebas | `Done`. No demuestra persistencia, cobertura ni capacidad. |
| HAC-25 · Juan Antonio | Prototipo externo Stitch/HTML y handoff, sin push/PR | `Done` por decisión del Tech Lead; mapa React operativo va en HAC-15/Sprint 2. |
| HAC-17 · Axel | Soporte AWS | `Done`; créditos/acceso no equivalen a permiso Bedrock. |
| HAC-18 · Jean Paul | Estructura de evidencia Drive/Kiro Crew | `Done`; no adjuntar sesiones que contienen tokens. |
| HAC-26 · Cristhian | Commit local de integración combina la rama remota, la reorganización de `docs/` y el acta; [PR #86](https://github.com/Chujutak2024/cargomesh/pull/86) cerrado sin merge | `In Progress`; falta publicar el commit, abrir PR equivalente, CI y merge autorizado. |

PR #81 y #82 de gobernanza también están mergeados en la base. HITO 0 conserva aceptación explícita pendiente; no se marca completo por esas fusiones ni por casillas históricas.

Linear muestra HITO 1 al **25%** después de pasar HAC-22 y HAC-26 a `In Progress`. Es una métrica visual de estados, **no** 25% de entregas aprobadas; solo HAC-21 está `Done` en este corte.

## Verificación ejecutada sobre la base

- `pnpm typecheck`: PASS.
- `pnpm check:architecture`: PASS (222 módulos, 25 entradas cliente).
- `pnpm test:mcp`: 75/75 PASS tras el merge de gate.
- `pnpm test:release`: PASS.
- `pnpm build`: PASS.
- pgTAP local no se repitió en este host porque Docker Desktop no estaba activo y Supabase CLI no estaba en PATH; PR #87 documenta 10 archivos/199 aserciones PASS. El job `pgtap-gate` de `.github/workflows/v2-qa-gate.yml` debe pasar antes del merge.
- Vercel preview falla por configuración externa del proyecto; véase [FL-01](./friction-logs/FL-01.md). No se alteraron `productionBranch`, `rootDirectory`, alias ni despliegue productivo.

## Decisiones abiertas antes del cierre

1. Abrir un PR nuevo desde la rama declarada con esta integración; no hacer push directo a la base para eludir revisión. Axel revisa el ajuste de catálogo antes de aceptar HAC-22.
2. Ejecutar CI, incluido `pgtap-gate`, y revisar el diff. Los defectos medios/altos regresan a su dueño; no se reparte implementación funcional en el gate.
3. Tras merge autorizado, cerrar HAC-22 y HAC-26 individualmente en Linear con enlaces a commit/checks; hasta entonces HITO 1 no se declara completo.
4. Sprint 2 conserva `mcp_account_links`, servicios ROAD/API y consulta MCP V2 en HAC-11/12. Alexa+ live y Bedrock real siguen bloqueados por evidencia externa, no por este gate.

## Revisión UML/DER registrada el 24 sep — decisión pendiente, no ampliación del Gate-1

El equipo ratificó el [corte MVP ROAD/USD](../contracts/PRODUCT_SCOPE.md#corte-de-mvp): disponibilidad sí/no/desconocida, una oferta atribuible por decisión en el primer corte comercial, y multimodal/múltiples responsables/heurística de mapa solo como diseño o simulación rotulada hasta contar con evidencia. Se derivó un [DER lógico propuesto](../models/V2_LOGICAL_ERD.md) y se contrastó **con migraciones de Git**, no con el Supabase V2 remoto aún no consultado. Esto no afirma que HAC-23/24/25 o HITO 1 hayan implementado oferta, ranking, booking o capacidad por fecha.

Queda pendiente ratificar el XML manual de clases: 9 conectores con extremos sueltos, relaciones oferta–servicio y booking–reserva ausentes, y verbos «calcula»/«respalda cobertura» equívocos; véase [la revisión](../models/CLASS_DIAGRAM_DESIGN.md#verificación-pendiente-del-xml-manual). Registrar esta decisión/pendiente en HAC-26 para trazabilidad, **sin añadirlo al DoD del gate ni impedir la aceptación individual de entregas Sprint 1 por un diseño futuro**. Las migraciones de Hitos 2–4 requieren revisión separada.

## Actualización de verificación — 25 sep 2026 (Lima)

Este apartado sustituye el corte histórico anterior; no declara Gate-1 aprobado ni autoriza despliegue.

- La base remota `codex/v2-amazon-contracts` permanece en `92b9735`: [PR #87](https://github.com/Chujutak2024/cargomesh/pull/87) de HAC-23 y [PR #88](https://github.com/Chujutak2024/cargomesh/pull/88) de HAC-24 están mergeados; PR #83/#85 también permanecen mergeados y no se repiten.
- [PR #86](https://github.com/Chujutak2024/cargomesh/pull/86) sigue cerrado **sin merge**. El commit local de integración contiene su corrección fail-closed, la entrega aceptada de la rama `feat/cycle-1-integration` y la reorganización documental; el remoto aún no ha avanzado porque la publicación quedó bloqueada por la red/límite de aprobación de esta sesión. HAC-22 continúa `In Review` y HAC-26 `In Progress` hasta abrir el nuevo PR y completar el gate.
- Verificación local en el checkout integrado: `tsc --noEmit` PASS; arquitectura PASS (222 módulos, 25 entradas cliente); MCP 75/75 PASS; build Next PASS. La batería completa alcanzó 427/430: los tres fallos son pruebas de integración que requieren URL/anon key/contraseña de Supabase local, no fallos funcionales del árbol. No se ejecutó reset remoto ni pgTAP en este checkout.
- La reorganización deja V1 en `docs/v1-webmcp/` y V2 en `docs/v2-amazon/{contracts,models,delivery,references,en}`; QA/UI y evidencia se ubican bajo `delivery/`. La guardia de integración detectó **cero rutas de diagramas** en el diff; los diagramas nuevos solicitados para descartar no se incluyen.
- Vercel no se modifica ni se promueve a producción. La cadena de aceptación sigue siendo: publicar `b83af9e` en `feat/cycle-1-integration`, abrir PR contra `codex/v2-amazon-contracts`, ejecutar CI incluido `pgtap-gate`, revisar diff y solo después hacer merge autorizado. Entonces se cierran HAC-22/HAC-26 individualmente en Linear con enlaces a PR, commit y checks.
