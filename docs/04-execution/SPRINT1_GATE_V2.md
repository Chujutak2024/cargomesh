# Gate 1 V2 — acta de integración y cierre condicionado

**Corte:** 25 de septiembre de 2026 (Lima). **Base recibida:** `codex/v2-amazon-contracts` @ `92b9735` con PR #87 y #88 ya mergeados. **Rama de gate:** `feat/cycle-1-integration` @ `495a894`, publicada en remoto. [PR #86](https://github.com/Chujutak2024/cargomesh/pull/86) fue cerrado sin merge; reabrirlo está pendiente por permisos de GitHub. **Responsable:** Cristhian, HAC-26. **Estado:** integración local verificada, no aceptada en la base V2.

## Regla de aceptación

El dueño entrega PR/evidencia; el integrador revisa DoD y pruebas; el Tech Lead aprueba; solo entonces se integra a `codex/v2-amazon-contracts`. Un PR ya mergeado no se mergea de nuevo. Hallazgos funcionales medios/altos vuelven al dueño; el gate puede corregir metadatos bajos con diff y prueba visibles. Ninguna aceptación de Sprint 1 autoriza `main`, producción, Alexa+ live ni Bedrock real. Véase [la escala V2](../v2-amazon/LINEAR_ISSUE_TEMPLATE.md#flujo-de-aceptación-y-escala-de-hallazgos).

## Matriz por issue

| Issue / dueño | PR o evidencia observada | Estado de gate al corte |
|---|---|---|
| HAC-21 · Cristhian | [PR #83](https://github.com/Chujutak2024/cargomesh/pull/83) mergeado; migración ROAD, RLS, pgTAP y [mapping](../v2-amazon/SPRINT1_DATA_MAPPING.md) | `Done` en Linear. No incluye capacidad/calendario, `mcp_account_links` ni tools comerciales V2. |
| HAC-22 · Axel | [PR #85](https://github.com/Chujutak2024/cargomesh/pull/85) mergeado; transporte MCP, service auth, perfiles V1/V2 y [estado Alexa/Bedrock](../v2-amazon/SPRINT1_ALEXA_SECURITY_AND_BEDROCK.md) | `In Review`. Gate-1 corrige la atribución errónea a HAC-21 sin activar tools comerciales; pendiente merge de esa corrección y CI. Sin Alexa+ ni Bedrock live. No repetir PR #85. |
| HAC-23 · Jean Paul | [PR #87](https://github.com/Chujutak2024/cargomesh/pull/87) mergeado; escenario ROAD V2, matriz QA, negativos y CI pgTAP | `Done`. La regresión WebMCP V1 queda separada del escenario V2. |
| HAC-24 · Luis | [PR #88](https://github.com/Chujutak2024/cargomesh/pull/88) mergeado; intake navegable, fixture V2 y pruebas | `Done`. No demuestra persistencia, cobertura ni capacidad. |
| HAC-25 · Juan Antonio | Prototipo externo Stitch/HTML y handoff, sin push/PR | `Done` por decisión del Tech Lead; mapa React operativo va en HAC-15/Sprint 2. |
| HAC-17 · Axel | Soporte AWS | `Done`; créditos/acceso no equivalen a permiso Bedrock. |
| HAC-18 · Jean Paul | Estructura de evidencia Drive/Kiro Crew | `Done`; no adjuntar sesiones que contienen tokens. |
| HAC-26 · Cristhian | Rama de integración actualizada; [PR #86](https://github.com/Chujutak2024/cargomesh/pull/86) cerrado sin merge | `In Progress`; necesita reapertura, CI y merge autorizado. |

PR #81 y #82 de gobernanza también están mergeados. HITO 0 conserva aceptación explícita pendiente. El porcentaje automático de Linear no sustituye el gate.

## Verificación del corte integrado

- `pnpm typecheck`: PASS.
- `pnpm check:architecture`: PASS en la base recibida (222 módulos, 25 entradas cliente).
- `pnpm test:mcp`: 75/75 PASS tras el merge de gate; incluye protocolo `2025-11-25`, Bearer inválido, aislamiento por organización, fail-closed y denegación de tools comerciales al principal de servicio.
- `pnpm test:release`: PASS tras el merge; incluye MCP, narración, Hono e intake.
- `pnpm build`: PASS tras el merge.
- pgTAP local **no se repitió en este host**: Docker Desktop no estaba activo y `supabase` CLI no está en PATH. PR #87 documenta 10 archivos/199 aserciones PASS en su entorno. El job `pgtap-gate` de `.github/workflows/v2-qa-gate.yml` debe pasar sobre el PR de gate antes de aceptarlo; no sustituirlo por el número histórico.
- Vercel preview falla por configuración externa del proyecto y no por el build local; véase [FL-01](./friction-logs/FL-01.md). No se alteraron `productionBranch`, `rootDirectory`, alias ni despliegue productivo.

## Decisiones abiertas antes del cierre

1. Reabrir PR #86 desde una cuenta autorizada: el conector respondió 403 y el host rechazó el intento alternativo. El usuario decidió dejarlo pendiente; no hacer push directo a la base para eludir la revisión. Esperar CI de aplicación y pgTAP, revisar el diff y obtener aprobación del Tech Lead.
2. Tras el merge, cerrar HAC-22 y HAC-26 individualmente en Linear con enlace a commit/checks. Hasta entonces permanecen `In Review` e `In Progress`, respectivamente; HITO 1 no se declara completo.
3. Sprint 2 posee `mcp_account_links`, servicios ROAD/API y consulta MCP V2 (HAC-11/12). Alexa+ live sigue `BLOCKED`; Bedrock real `BLOCKED` por permiso IAM. `get_cargomesh_capabilities` local no es una llamada Alexa+ real.
4. Las descripciones de los ciclos Sprint 1/2 en Linear aún conservan texto V1; el contenido de issues e hitos V2 tiene la planificación actual. No extender el ciclo para ocultar límites de acceso o pruebas.
