# Rebaselinar Linear para CargoMesh V2

Propuesta operativa; este documento no ejecuta cambios en Linear. La ruta semanal y las diez asignaciones propuestas para la semana actual están en [SPRINT_ROADMAP.md](./SPRINT_ROADMAP.md). Toda issue nueva usa [LINEAR_ISSUE_TEMPLATE.md](./LINEAR_ISSUE_TEMPLATE.md).

## Estado verificado el 21 de septiembre de 2026

- Workspace `HackatonTeamCargoMesh`, proyecto `P-HAC-1 — CargoMesh V2 — Alexa Hackathon`, cinco miembros y fecha objetivo **19 de octubre** en Linear.
- `Sprint 1` corre del 19 al 25 de septiembre en horario de Lima (el ciclo termina el 26 a las 00:00). Las ocho issues de implementación HAC-5 a HAC-10, HAC-19 y HAC-20 siguen `Canceled`. HAC-17 (créditos AWS) y HAC-18 (Drive) ya están `In Review`; no volver a cancelarlas ni duplicarlas.
- `Sprint 2` contiene HAC-11 a HAC-16 aún `Pendiente`, con WebMCP runner, ranking BALANCED y otras premisas previas al contrato V2. No arrastrarlas como avance V2 ni iniciarlas sin replanificar.
- PR #80 fue mergeado a la base V2 el 21 de septiembre (Lima). Incluyó código MCP/Hono local, traslado de `frontend/` a `cargomesh/` y un bloque V1 contradictorio en `AGENTS.md`. El hotfix está propuesto en PR #81; no confundir código mergeado con capacidad Alexa+ o discovery V2 terminados. El preview de Vercel falla porque el proyecto aún apunta a `frontend/`, mientras producción sigue en `main`.
- Los milestones actuales describen el plan intermedio: uno exige conteos fijos de pruebas y otro sitúa Bedrock como obligatorio. El milestone de entrega tiene fecha 20 de octubre, posterior a la meta interna del proyecto.
- [Devpost fija el cierre oficial el 23 de octubre de 2026 a las 12:00 PDT](https://amazonappdev2026.devpost.com/rules). El **19 de octubre es un freeze interno propuesto**, no la fecha oficial. Las reglas también fijan el límite de solicitud de créditos AWS el 21 de octubre a las 12:00 PT. El enlace que figura en HAC-17 (`https://forms.gle/GaHFxSbBQNG9Kti6A`) no coincide con el [formulario enlazado en las reglas](https://forms.gle/5hyhr1u6x3fuV2aW7): Axel debe confirmar cuál es válido y conservar comprobante antes de que el Tech Lead marque `Done`.

## Decisiones de estructura

1. Conservar el proyecto `P-HAC-1` y actualizar su nombre/resumen a `CargoMesh V2 — Amazon Developer Hackathon`; V2 es una nueva línea, no un parche WebMCP.
2. Mantener los ciclos semanales existentes para no perder trazabilidad. Reescribir sus descripciones y compromisos; `Sprint 1` **sí** recibe issues V2 nuevas para esta semana, junto a las ocho canceladas como historial y HAC-17/HAC-18 como soporte vigente. No reciclar identificadores.
3. Usar `1 core + 1 enabler + N emergentes` por integrante como límite de foco, no como excusa para crear trabajo ficticio. La tarea core técnica requiere rama/PR; el enabler operativo puede requerir solo evidencia. Los emergentes se crean al aparecer un bloqueo real y se relacionan con su issue madre.
4. Mantener Alexa+ como track principal de planificación. AWS Builder y Open Source son oportunidades condicionadas a integración y evidencia; Bedrock no es requisito del track Alexa+. No prometer ningún mini challenge sin decisión de equipo y artefacto verificable.
5. Milestones sugeridos: **M0 Contratos y riesgos V2**, **M1 Intake y MCP verificables**, **M2 Discovery ROAD, capacidad y ofertas**, **M3 Experiencia Web/Alexa integrada**, **M4 Freeze, evidencia y entrega**. Reutilizar/renombrar milestones existentes donde sea posible, sin borrar su historia.
6. Sprints 6 y 7 caen después del cierre oficial y no son contenedores de alcance de postulación.

## Migración de issues y PRs

| Origen | Tratamiento |
|---|---|
| HAC-5/6/7/8/9/10/19/20 | Mantener `Canceled`; enlazar desde issues V2 nuevas si se reutiliza una técnica o componente. No trasladar sus DoD, scores o seeds como completados. |
| HAC-17 | Mantener como enabler de Axel en Sprint 1; separar **solicitar créditos** de **usar Bedrock**. Verificar formulario y evidencia antes del cierre por Tech Lead. |
| HAC-18 | Mantener como enabler de Jean Paul en Sprint 1; verificar carpeta, permisos y vínculo de Linear antes del cierre por Tech Lead. |
| HAC-11 a HAC-16 | Dejar `Pendiente` solo hasta revisión del equipo; después cancelar como plan sustituido o redefinir mediante **issues nuevas**, nunca ponerlas en marcha tal como están. |
| PR #80 `feature/alexa/v1,0` | **Ya mergeado**, no tratarlo como propuesta pendiente ni revertirlo a ciegas. Inventariar transporte MCP/Hono e idempotencia reutilizables; integrar PR #81 de gobernanza tras revisión, aislar WebMCP V1 y resolver preview sin cambiar producción. |

## Estados y autoridad

| Estado | Tarea técnica | Enabler sin código |
|---|---|---|
| `Backlog` / `Pendiente` | Alcance, dueño y dependencias definidos; sin trabajo iniciado. | Gestión asignada y criterio de evidencia definido. |
| `In Progress` | Rama aislada y trabajo iniciado; Draft PR si aporta visibilidad. | Gestión externa iniciada. |
| `In Review` | PR listo, pruebas pertinentes y resumen/evidencia en issue. Es el límite de entrega del desarrollador. | Enlace/captura verificable en issue. Es el límite de entrega del responsable. |
| `Done` | Solo Tech Lead tras gate, merge autorizado y DoD verificado. | Solo Tech Lead tras verificar acceso/evidencia. |

`Canceled` preserva motivo y enlace a reemplazo; `Duplicate` solo para duplicados reales. Los conteos de pruebas se descubren al ejecutar la suite, nunca se fijan como verdad histórica.

## Orden de aplicación cuando se apruebe

1. Confirmar meta interna del 19, track Alexa+, mini challenges, labels y responsables. No cambiar Vercel ni `main` como parte de esta operación.
2. Actualizar proyecto, milestone M0 y descripciones de los ciclos 1–5. Si el conector no permite editar ciclos, usar la UI autenticada y verificar el resultado.
3. Crear las **ocho issues V2 nuevas** de Sprint 1 descritas en el roadmap: cinco core y tres enablers; HAC-17 y HAC-18 completan las dos plazas de soporte restantes. Asignar inicialmente `Backlog`/`Pendiente`, no fingir progreso.
4. Etiquetar V2, vincular dependencias y antecedentes cancelados. Labels sugeridas: `v1-legacy`, `v2`, `core`, `enabler`, `domain`, `carrier-discovery`, `alexa-mcp`, `aws-builder`, `open-source`, `evidence`; conservar las genéricas útiles.
5. Revisar HAC-11 a HAC-16 y milestones viejos con el equipo. Registrar decisión y reemplazo sin borrar historial.
6. Ejecutar gate semanal: el Tech Lead compara cada issue con PR, pruebas, evidencia y contrato antes de moverla a `Done`.
