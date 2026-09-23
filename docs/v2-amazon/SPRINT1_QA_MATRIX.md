# Sprint 1 QA Matrix — CargoMesh V2

Esta matriz registra cobertura y evidencia ejecutada para el corte V2. Los números que aparecen
en cada ejecución son resultados observados; no son mínimos ni criterios fijos de aceptación.
Cada fila de cobertura debe identificar contrato y sección, caso, comando, resultado y dueño de
cualquier defecto.

## CP-0 — línea base previa a cambios (2026-09-22)

Rama: `feat/be3-v2-qa-foundation`, creada desde `origin/codex/v2-amazon-contracts` en
`0d3a0d2667be1b125582e5b2f006c8a782026a4b`. La línea base se ejecutó antes de editar archivos
versionados de la rama.

| Verificación | Comando | Resultado observado |
|---|---|---|
| Dependencias congeladas | `pnpm install --frozen-lockfile` (desde `cargomesh/`) | PASS — lockfile vigente; pnpm 11.19.0; instalación finalizada. |
| Reset local de Supabase | `npx supabase db reset` | PASS — reset limpio; aplicó `20260922053512_v2_road_facilities_services.sql` y las migraciones anteriores; seed local aplicado. |
| pgTAP local | `npx supabase test db` | PASS — `Files=9, Tests=183`; los archivos `01` a `09`, incluido `09_v2_road_network.test.sql`, reportaron `ok`. Conteo informativo de esta ejecución, no un umbral. |

La base todavía no contiene aquí la matriz incremental ni los casos QA propios de HAC-23. Sus
resultados se añadirán con comando y salida real durante los siguientes checkpoints. No se usaron
fixtures de FR-1042 como prueba de capacidades V2.

El reset y pgTAP de la base V2 llegaron al sprint en verde. Un fallo posterior en esos mismos
gates es nuevo respecto de este corte y debe investigarse como regresión; esta afirmación no
abarca suites que todavía no se habían ejecutado.

## Observación de infraestructura previa a CP-1

| Área | Evidencia | Estado observado | Dueño |
|---|---|---|---|
| Preview Vercel del [PR #87](https://github.com/Chujutak2024/cargomesh/pull/87) | [Deployment inicial fallido](https://vercel.com/anjuje/cargomesh/5z9YVpRd4jbV6gvf1UALeu9iApK5), check iniciado el 2026-09-22 23:22:56 UTC; [deployment tras CP-1 fallido](https://vercel.com/anjuje/cargomesh/7FKK9w6H1ogYd5y2oXwGXyeaFTzW), check iniciado el 2026-09-22 23:35:49 UTC. | `FAILURE` antes y después de portar el workflow. Incidencia de configuración del proyecto Vercel; QA no cambia esa configuración. | Cristhian — integración [HAC-26](https://linear.app/hackatonteamcargomesh/issue/HAC-26/gate-1-integrar-y-aceptar-el-cimiento-v2-del-sprint-1). |

## CP-1 — gate local de aplicación (2026-09-22)

Los dos tests Hono existentes (`requests.test.ts` y `freight-request-adapter.test.ts`)
quedaron expuestos por `test:hono`, añadido al final de `test:release`. El workflow
`.github/workflows/v2-qa-gate.yml` ejecuta typecheck, `test:release`, build y pgTAP en PRs
hacia `codex/v2-amazon-contracts`.

| Comando desde `cargomesh/` | Resultado observado |
|---|---|
| `pnpm test:hono` | PASS — `tests 42`, `pass 42`, `fail 0`, exit code 0. Conteo informativo. |
| `pnpm typecheck` | PASS — `tsc --noEmit` sin diagnósticos, exit code 0. |
| `pnpm test:release` | PASS — cadena completa, incluido `test:hono`; exit code 0. |
| `pnpm build` | PASS — Next.js 15.5.24 compiló y generó las páginas; exit code 0. |

Primer run alojado: [V2 QA Gate #35798171198](https://github.com/Chujutak2024/cargomesh/actions/runs/35798171198)
sobre `530a6b6cbf363065af359e28c76a0970a56dc2a6`, completado el 2026-09-22 23:37 UTC.
Resultado global `success`:

| Job | Comandos del gate | Resultado observado |
|---|---|---|
| [Aplicación](https://github.com/Chujutak2024/cargomesh/actions/runs/35798171198/job/106982202308) | `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test:release`, `pnpm build` | PASS — los cuatro pasos y el job concluyeron `success`. |
| [pgTAP](https://github.com/Chujutak2024/cargomesh/actions/runs/35798171198/job/106982202536) | `supabase db start`, `supabase test db` | PASS — ambos pasos y el job concluyeron `success`. |

El check `Vercel` del mismo PR permanece en `FAILURE` y se gestiona como la observación de
infraestructura anterior, fuera del gate QA.

### Riesgo de integración antes de Gate-1

`v2-qa-gate.yml` solo existe por ahora en `feat/be3-v2-qa-foundation`. Hasta que el
[PR #87](https://github.com/Chujutak2024/cargomesh/pull/87) se fusione en Gate-1,
los demás PRs contra `codex/v2-amazon-contracts` no ejecutan este CI; solo tienen
el check de Vercel. Esto limita la evidencia de integración cruzada, aunque los dos
runs del propio PR #87 estén verdes. **Mitigación y dueño:** QA (Jean Paul) debe
re-ejecutar el gate completo sobre la base V2 integrada después de los merges de
Gate-1. No se declara verde la base integrada antes de esa ejecución.

## CP-2 — escenario ROAD y aislamiento (2026-09-22)

Paquete: `supabase/scenarios/v2-road-baseline/` (`manifest.json`, `seed.sql`,
`verify.sql`, `cleanup.sql`, `counts.sql`, `README.md`), procedencia
`SYNTHETIC_DEMO_ONLY`, UUIDs propios `c230`–`c238`. Sus dos tenants, dos
identidades Auth locales y membresías ACTIVE sostienen negativos de identidad
MCP/RLS; cuatro facilities, un depot sin cobertura, cuatro service areas y una
única lane ROAD Lima A→Arequipa B sostienen los negativos de sede sin cobertura
y lane inversa. No se siembran vínculos OAuth, solicitudes, ofertas ni reservas.

| Contrato y caso | Comando/evidencia | Resultado observado |
|---|---|---|
| [Mapping HAC-21](./SPRINT1_DATA_MAPPING.md): áreas y lane explícitas; Piura sin cobertura, B→A sin lane | `npx supabase db reset --local`; `seed.sql` y `verify.sql` vía `docker exec -i supabase_db_cargomesh psql -X -U postgres -d postgres` | PASS — reset aplicó la migración V2; verify encontró 4 áreas, 1 lane A→B, 0 lanes B→A y 0 áreas Piura. |
| [HAC-22](./SPRINT1_ALEXA_SECURITY_AND_BEDROCK.md): identidad de dos tenants, no account link inventado | `verify.sql` | PASS — 2 identidades Auth locales y 2 membresías ACTIVE exactas; no hay `mcp_account_links` sembrados. Esto prepara CP-3, no prueba aún autenticación MCP end-to-end. |
| Convivencia con `d1` y cleanup limitado | `d1/seed.sql` → V2 `seed.sql`/`verify.sql` → V2 `cleanup.sql`/`counts.sql` → `d1/verify.sql` | PASS — conteos posteriores iguales a foto con `d1`; `d1_verification.verified=true`, Golden Flow 3 candidatos. |

Fotos de **todas** las relaciones escritas por el escenario, tomadas con
`v2-road-baseline/counts.sql` después del reset, después de cargar `d1`, con
ambos escenarios y después de limpiar solo V2:

| Relación | Previa (reset) | Con `d1` | `d1` + V2 | Tras cleanup V2 | Delta V2 |
|---|---:|---:|---:|---:|---:|
| `auth.identities` | 1 | 1 | 3 | 1 | 2 |
| `auth.users` | 1 | 1 | 3 | 1 | 2 |
| `public.carrier_depots` | 0 | 0 | 1 | 0 | 1 |
| `public.carrier_services` | 3 | 5 | 6 | 5 | 1 |
| `public.carriers` | 3 | 4 | 5 | 4 | 1 |
| `public.facilities` | 0 | 0 | 4 | 0 | 4 |
| `public.organization_members` | 1 | 1 | 3 | 1 | 2 |
| `public.organizations` | 1 | 1 | 3 | 1 | 2 |
| `public.service_areas` | 0 | 0 | 4 | 0 | 4 |
| `public.service_lanes` | 0 | 0 | 1 | 0 | 1 |

La comparación pertinente para aislamiento es **con `d1` vs tras cleanup V2**:
las diez relaciones coinciden. Dos ciclos adicionales completos
`seed → verify → cleanup` pasaron con los mismos conteos posteriores y
`d1/verify.sql` volvió a pasar. Una prueba adicional `seed → seed → verify →
cleanup` también pasó: el segundo seed reportó `INSERT 0 0` en sus diez
instrucciones, sin duplicados ni errores. Los conteos finales siguieron iguales
a la columna «Con `d1`». Ninguna migración se agregó o modificó en CP-2.

## CP-3 — negativos con controles positivos (2026-09-22)

Estados de esta tabla: `PASS` exige que el control positivo **y** su negativo
pasen; `FAIL` conserva el fallo observado; `BLOQUEADO` significa que la
interfaz/contrato necesario no existe o el control positivo no puede ejecutarse.
Todos los comandos son desde la raíz del repo salvo donde se indica
`cargomesh/`. Los tests SQL se ejecutaron con `SET LOCAL ROLE authenticated`
y claims `request.jwt.claims` de cada usuario; consultar como `postgres`
saltaría RLS y no sería evidencia de aislamiento.

Preparación local para pgTAP (sin cargar `d1`):

```powershell
npx supabase db reset --local
Get-Content -Raw supabase/scenarios/v2-road-baseline/seed.sql |
  docker exec -i supabase_db_cargomesh psql -X -v local_only=1 -U postgres -d postgres
Get-Content -Raw supabase/scenarios/v2-road-baseline/verify.sql |
  docker exec -i supabase_db_cargomesh psql -X -U postgres -d postgres
npx supabase test db
```

| Contrato y sección → caso | Comando exacto tras preparación | Resultado observado y control positivo | Dueño del defecto |
|---|---|---|---|
| [HAC-21 mapping § Acceso y persistencia](./SPRINT1_DATA_MAPPING.md): RLS de sede entre tenants | `npx supabase test db supabase/tests/10_v2_qa_negative_cases.test.sql` | `PASS` — con rol `authenticated` y claims A, A ve y actualiza su sede; con claims B, B ve su propia sede, pero no ve ni actualiza la de A aunque ambas estén en Lima. La escritura de A conserva su valor tras el intento de B. | — |
| [Cobertura § Regla de elegibilidad](./CARRIER_COVERAGE_AND_SERVICEABILITY.md): sede con área/lane declarada vs Piura sin cobertura | `npx supabase test db supabase/tests/10_v2_qa_negative_cases.test.sql` | `PASS` para **cobertura declarada**: Lima A→Arequipa B devuelve 1; Piura→B devuelve 0 pese a la sede y depot de Piura. No se afirma elegibilidad comercial plena ni capacidad disponible. | — |
| [HAC-21 mapping § Entidad → tabla → relación](./SPRINT1_DATA_MAPPING.md): lane dirigida | `npx supabase test db supabase/tests/10_v2_qa_negative_cases.test.sql` | `PASS` — A→B devuelve 1 antes de probar B→A, que devuelve 0 aun existiendo áreas de pickup/delivery para el sentido inverso. | — |
| [HAC-22 § 7](./SPRINT1_ALEXA_SECURITY_AND_BEDROCK.md): sin Bearer/sesión vs usuario válido | `pnpm exec tsx --test --test-name-pattern "real /mcp creates" src/server/mcp/local-integration.test.ts` desde `cargomesh/` | `PASS` — el subtest local observa `401` sin credencial y luego crea/lee un DRAFT con la cookie válida de ACME. Este subtest aislado pasó 1/1. | — |
| [HAC-22 § 8 y § 15](./SPRINT1_ALEXA_SECURITY_AND_BEDROCK.md): Bearer inválido con cookie válida | `pnpm exec tsx --test --test-name-pattern "invalid Bearer with a valid cookie" src/server/mcp/http.test.ts` desde `cargomesh/` | `PASS` — la misma cookie primero ejecuta `get_freight_options`; al añadir `Authorization: Bearer invalid`, `/mcp` responde `401`, no lee la cookie y no despacha la tool. | — |
| [HAC-22 § 7](./SPRINT1_ALEXA_SECURITY_AND_BEDROCK.md): service token intenta negocio | `pnpm exec tsx --test --test-name-pattern "signed service bearer" src/server/mcp/http.test.ts` desde `cargomesh/` | `PASS` — token firmado inicializa y lista tools; la llamada business recibe `FORBIDDEN` y no llega al servicio. | — |
| [HAC-22 § 8–9](./SPRINT1_ALEXA_SECURITY_AND_BEDROCK.md): token/sesión de tenant B sobre solicitud A | `pnpm exec tsx --test --test-name-pattern "V2 QA tenants" src/server/mcp/local-integration.test.ts` desde `cargomesh/`, con entorno local indicado en `cargomesh/src/server/mcp/README.md` | `PASS` 1/1 — A inicia sesión, lista tools, crea, lee y envía su DRAFT; el Bearer Supabase válido de B no lee la solicitud mediante PostgREST/RLS y la sesión MCP válida de B recibe `NOT_FOUND` al intentar enviarla. La solicitud se limpia por ID exacto. No equivale a una prueba de Bearer OAuth de usuario dentro de MCP. | — |
| [HAC-22 § 6 y § 9](./SPRINT1_ALEXA_SECURITY_AND_BEDROCK.md): vínculo OAuth exacto `(auth_user_id, oauth_client_id)` | `rg -n "mcp_account_links" supabase/migrations cargomesh/src`; `rg -n "blockedAccountLinks" cargomesh/src/server/mcp/auth/user-token.ts`; `pnpm exec tsx --test --test-name-pattern "account linking fails closed" src/server/mcp/auth/user-token.test.ts` desde `cargomesh/` | `BLOQUEADO` — no existe tabla ni repositorio persistente. El repositorio por defecto `blockedAccountLinks` lanza `FORBIDDEN` (no es una tabla en memoria que conceda acceso); el test con dependencias inyectadas comprueba rechazo de vínculo ausente/revocado/cliente erróneo. Un token Supabase local válido de A recibió `401` en `/mcp` porque el bearer de usuario no está habilitado/configurado; no alcanzó la búsqueda del vínculo. No se reclama OAuth user end-to-end. | Axel (HAC-22) y Cristhian (integración/HAC-21). |
| [HAC-21 mapping § Acceso y persistencia](./SPRINT1_DATA_MAPPING.md): idempotencia DRAFT→PENDING | `npx supabase test db` | `PASS` — el archivo `08_draft_creation_idempotency.test.sql` pasó dentro de los 10 archivos; gate completo `Files=10, Tests=199`, sin cantidades fijas como umbral. | — |
| [Cobertura § Resultado compartido](./CARRIER_COVERAGE_AND_SERVICEABILITY.md): `unknown` ante evidencia/capacidad faltante | `rg -n "v2CoverageDecisionSchema" cargomesh/src/types/v2-road-network.ts`; `rg --files cargomesh/src/server/services` | `BLOQUEADO` — existe el esquema de decisión, pero no un motor V2 de elegibilidad/capacidad que pueda producir un resultado real `unknown` frente a `eligible`. El control positivo operacional no está disponible; el test SQL solo comprueba área+lane declaradas. | Cristhian (integración/HAC-21 y planificación Sprint 2). |
| [HAC-24 § S1-C4](./linear_sprint1_v2_rebase_proposal.md): prototipo UI navegable y estado `unknown` | `Test-Path docs/v2-amazon/SPRINT1_UI_PROTOTYPE.md` | `BLOQUEADO` — `False`; interfaz/artefacto V2 no entregado a la base al 2026-09-22. No se atribuyen las pantallas V1 como prueba V2. | Luis (HAC-24). |
| [HAC-25 § S1-C5](./linear_sprint1_v2_rebase_proposal.md): mapa piloto y fuente/estado de ruta | `Test-Path docs/v2-amazon/SPRINT1_MAP_PROVIDER_DECISION.md` | `BLOQUEADO` — `False`; contrato/adaptador y artefacto del mapa piloto V2 no entregados a la base al 2026-09-22. El mapa V1 no sustituye esta evidencia. | Juan Antonio (HAC-25). |

### Fallo reproducido fuera del gate CI y límites de la evidencia

`pnpm test:mcp:local` se re-ejecutó contra Next en `localhost:3100` y Supabase
local, con el seed `mcp-local` y el escenario V2. Resultado **FAIL: 2/3 subtests
PASS, 1/3 FAIL**. El primer subtest de creación y el nuevo control cruzado A/B
pasaron; el subtest heredado «real MCP flow reaches provider WebMCP through the
autonomous browser worker» falla en `local-integration.test.ts:295` porque
`started.candidates.length` es `0`. Se repitió el mismo fallo **después de
quitar el escenario V2**, por lo que no depende de nuestro fixture. La entrada
de ese test usa Lima→Valparaíso, mientras los tres servicios base anuncian
Callao→Santiago; `candidate-matcher.ts` exige igualdad de esas regiones/ciudades.
Esto impide dar por revalidada la afirmación completa de HAC-22 § 9 sobre
`test:mcp:local`. **Defecto del test/fixture o del contrato de discovery V1,
sin arreglo en HAC-23:** Axel (HAC-22), con Cristhian en integración/HAC-26.
Comando de reproducción: `pnpm test:mcp:local` desde `cargomesh/` con la
preparación local del [README MCP](../../cargomesh/src/server/mcp/README.md).

Una primera corrida de `npx supabase test db` con `d1` aún cargado desde CP-2
falló 2 assertions históricas del archivo `01` porque agregó antecedentes y
perfiles de ACME. QA (Jean Paul) repitió desde `npx supabase db reset --local`
sin `d1`, cargó solo V2 y obtuvo `Files=10, Tests=199`, `Result: PASS`. No se
cambió ningún assertion para lograrlo. `pnpm test:mcp` pasó 75/75 y
`pnpm typecheck` pasó sin errores. El gate CI no ejecuta el test local que
necesita Next, Chrome y Supabase local; ese límite se mantiene visible.
