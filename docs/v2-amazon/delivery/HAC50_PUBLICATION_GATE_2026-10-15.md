# HAC-50 — gate de publicación de rama

15 de octubre de 2026, America/Lima. Autorización del usuario: hacer pull/push de esta parte y dejar definido el handoff de Three.js para Juan. Rama existente `codex/unified-workspaces-demo-boundary`; base publicada antes del incremento `cbb10ff1c23b6e44376378b9843cc5e602742e36`.

## Alcance publicado

Contexto Carrier conectado y separación demo/Cliente, vehículos, conductores, agenda/asignaciones/disponibilidad, políticas/citas de sede, oportunidad/respuesta/oferta, Orders/pipeline y agregador operativo de lectura. Incluye dos migraciones aditivas previamente probadas, pendientes de aplicación alojada. Plan y prompt de Juan bajo `docs/v2-amazon/delivery/HAC50_*`.

El manifiesto propone 10 carriers, 16 sedes, 80 vehículos y 80 conductores. No se generaron esos registros ni se implementó presencia compartida de visitantes o AIR. Juan recibe un alcance visual: 4–5 plantillas de sede y 15–20 variantes reutilizables de camiones; no se le delega crear seeds ni reglas de backend.

## Sincronización y preservación

- Fetch y pull `--ff-only` de la misma rama: Already up to date; sin merge/rebase/force-push.
- Cinco archivos CSS concurrentes excluidos del índice y conservados localmente: landing-preview.module.css, app-shell.module.css, fleet.module.css, local-request-directory.module.css y portal.module.css.
- No se incluyeron `.env.local`, claves, dumps, salidas privadas ni la copia aislada de validación. Scanner de candidatos a credenciales: PASS.
- No se modifica main, configuración de Vercel ni Supabase alojado; no se abre PR como parte de este encargo.

## Verificación sobre el índice propuesto

Se exportó el índice a una copia local aislada; no se usó la apariencia CSS no publicada para validar el commit y no se alteró `.next` del front activo. Dependencias existentes enlazadas, sin instalar o actualizar paquetes.

| Gate | Resultado |
| --- | --- |
| Pruebas Node pertinentes | 271/271 PASS, 9 suites, archivos únicos de logistics, sesión, navegación, operaciones, comercial, flota conectada y rutas |
| TypeScript sin emisión | PASS |
| Arquitectura | PASS, 393 módulos / 107 entradas cliente |
| Next build optimizado | PASS; compilación, lint/tipos y generación de páginas |
| Workflow SQL | 54/54 PASS |
| Sedes SQL | 43/43 PASS |
| Crew SQL | 69/69 PASS |
| Identidad Carrier SQL | 27/27 PASS |
| Concurrencia PostgreSQL | PASS: una confirmación y un conflicto por último cupo; una creación y un replay con misma clave/ID |
| Diff check | PASS |

193 aserciones SQL se ejecutaron en `hac50_depot_limits_20261015_v3`; fixtures con rollback. Las carreras crearon un banco nuevo de esquema/fixtures sintéticos, sin copiar filas de origen. No se ejecutaron escenarios ni DDL sobre Supabase alojado.

Evidencia local en `salida/carrier-publish-20261015/`: STAGE_MANIFEST.json, TEST_RESULTS.txt, SQL_RESULTS.json, CONCURRENCY_RESULTS.json y BUILD_RESULTS.txt. El snapshot contiene un archivo privado de entorno ignorado; esa carpeta no pertenece al commit.

## Límites que siguen abiertos

La conexión Supabase actual no accede al proyecto configurado `yhimeajpzicjbxpbzsyh`. La migración comercial tiene autorización específica previa, pero no está aplicada; la activación de sedes es distinta. La publicación de los archivos SQL no las ejecuta.

Las verificaciones de browser responsive/Cliente de incrementos anteriores permanecen pendientes; build y tests no las sustituyen. La aplicación de C1–C6 y su integración completa continúan coordinadas con Jean. La issue sigue In Progress: push no equivale a gate funcional completo ni Done.
