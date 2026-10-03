# Evidencia Kiro Crew: revisión independiente de HAC-11

Fecha: 2026-10-03 (America/Lima). Issue de evidencia: HAC-30. Alcance revisado: HAC-11, rama `feat/be1-v2-mcp-account-linking`. Este expediente distingue el trabajo de Kiro Crew, el trabajo posterior de Codex y las verificaciones efectuadas en entornos locales distintos. No constituye aceptación del DoD ni demuestra una integración Alexa+ o Bedrock de CargoMesh.

## Artefactos de esta sesión

| Artefacto | Qué acredita | Límite |
|---|---|---|
| [Captura 1: sesión Kiro y contribución anterior](https://drive.google.com/file/d/1yseM6Xd7EenIOXU4CVSMI4ECnaeNhohl/view) | Interfaz Kiro Crew, tarea HAC-11 y referencia al commit `c212c62`. | También muestra mensajes de error del backend de Kiro; no son una invocación Bedrock de CargoMesh. El prompt de la nueva revisión aún aparece en el compositor. |
| [Captura 2: revisión del 3 de octubre](https://drive.google.com/file/d/14-Nk-uYi3X3tX372KP_bOsFSbDMJ9Zny/view) | Informe mostrado por Kiro, rama, HEAD `0367fc3` y árbol limpio reportados. | Captura del informe, no log íntegro de comandos. |
| [Captura 3: resultados y bloqueo local](https://drive.google.com/file/d/1HlFcHpVcCd5LTka4iANx-eyoQfJbOYdQ/view) | Kiro reporta `pnpm typecheck` PASS y `pnpm test:mcp` 76/76; pgTAP test 12 no verificado en su instancia local. | Los resultados de Kiro son autorreportados en su interfaz. La captura no prueba una ejecución exitosa de pgTAP. |
| [Contribución Kiro del 2 de octubre](https://drive.google.com/file/d/1H4HXTiMyw1W2olxpaunnpDEV0RPi1hzS/view) | Expediente anterior sobre la ampliación pgTAP T10-T14 en `c212c62`. | Corresponde a otra sesión. |
| [Verificación local independiente de HAC-11](https://drive.google.com/file/d/16edQeFFEhAH2W8dQZwkYS_G1rETlwUvB/view) | Registra ejecución posterior de pgTAP 14/14 en base V2 aislada con migración y escenario apropiados. | La ejecutó Codex, no Kiro Crew. |

Las capturas fueron aportadas por Axel y conservan la ruta local del workspace y un identificador de error de la interfaz Kiro. No se observa en ellas una credencial, JWT ni Account ID de AWS. Antes de distribuirlas fuera del equipo conviene revisar la visibilidad de la carpeta de Drive y las rutas de usuario visibles.

## Autoría y alcance comprobable

- **Kiro Crew, `c212c62` (2026-10-02):** amplió `supabase/tests/12_hac11_mcp_account_links.test.sql` con cinco bloques de aserciones T10-T14. La evidencia de esta contribución está en el expediente anterior enlazado arriba. El autor Git figuraba como Axel; la interfaz y el reporte de esa sesión identifican la ejecución de Kiro Crew.
- **Codex por encargo de Axel, `81e0097`:** corrigió posteriormente el fixture T9 y ejecutó la verificación local 14/14. El informe nuevo de Kiro atribuye ese commit a “Axel (humano)”; esa atribución no es precisa. Los metadatos de autor de Git no prueban que Axel haya redactado el cambio manualmente.
- **Kiro Crew, revisión 2026-10-03:** revisó el código de HAC-11 y reportó `pnpm typecheck` PASS y `pnpm test:mcp` 76/76. No se identifica un cambio de código ni un commit nuevo producido por esta revisión. El HEAD reportado fue `0367fc3d7024db3f16d70fd738ae6931696ce1ec`, con `git status` limpio.

## Resultado de pruebas y discrepancias

| Comprobación | Resultado atribuible a Kiro | Interpretación para el expediente |
|---|---|---|
| `pnpm typecheck` | PASS, 0 errores reportados | Verificación de esta sesión según la captura. |
| `pnpm test:mcp` | PASS, 76/76 reportados | Verificación de esta sesión según la captura. |
| `supabase test db`, test 12 pgTAP | No verificado en la instancia usada por Kiro; el runner indicó plan de 14 y 0 ejecutadas. | Esa instancia local no tenía aplicada la migración HAC-11 ni sembrado el escenario V2 requerido. Además `psql` no estaba en PATH. No registrar esto como fallo funcional de las 14 aserciones. |
| pgTAP test 12 en base V2 aislada | 14/14 PASS en el expediente independiente de HAC-11 | Resultado de Codex en otro entorno local; no atribuirlo a Kiro. |

El informe pegado de Kiro afirma además que `requireSupabaseOAuthClaims` no está integrado en `verifySupabaseIdentity`. Esta conclusión contradice el código de `cargomesh/src/server/mcp/auth/user-token.ts`, donde `verifySupabaseIdentity` sí llama a `requireSupabaseOAuthClaims`; no se adopta como hallazgo. El bloqueo de su entorno pgTAP y esta afirmación requieren distinguirse de la revisión positiva de los tests MCP.

## Límite de las afirmaciones AWS Builder

Estas capturas apoyan el uso auténtico de **Kiro Crew** para una contribución real de tests HAC-11 y para una revisión posterior. Los banners de “Bedrock is throttling requests” pertenecen al backend de Kiro y no prueban que el adaptador CargoMesh `CARGOMESH_BEDROCK_NARRATION_ENABLED` exista ni que CargoMesh haya llamado a `InvokeModel`. La verificación IAM independiente disponible en [BEDROCK_IAM_CHECK_2026-10-03.md](https://drive.google.com/file/d/1ju6exIBqUcZ9O5UDZBSOuI6woUQ1cDKo/view) registra `ListFoundationModels` denegado; los créditos promocionales reclamados no equivalen a permiso, adaptador ni invocación efectiva.

## Pendientes de cierre

1. Revisión humana del diff de `c212c62`, del informe de Kiro y de esta distinción de autoría.
2. Incorporar los enlaces al índice HAC-18 por su responsable; esta subida a la carpeta de Axel no certifica que el índice HAC-18 esté actualizado.
3. Mantener el estado de HAC-11/HAC-30 sujeto al gate y a la aceptación del Tech Lead. Una captura de pruebas o un commit no mueve por sí solo una issue a `Done`.

No se adjuntan secretos ni transcripciones completas sin redacción. No se modificaron servicios remotos de Supabase, AWS o producción para preparar esta evidencia.
