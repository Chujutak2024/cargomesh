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
