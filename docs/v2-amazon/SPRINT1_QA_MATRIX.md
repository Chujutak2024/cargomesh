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
