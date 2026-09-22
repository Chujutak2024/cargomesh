# Plan propuesto para reconstruir Linear

Este documento es una propuesta. No autoriza cambios automáticos en Linear.

## Estado auditado el 21 de septiembre de 2026

- Workspace conectado: `HackatonTeamCargoMesh`.
- Proyecto actual: `P-HAC-1 — CargoMesh V2 — Alexa Hackathon`, con los cinco miembros y fecha objetivo 19 de octubre de 2026.
- Ciclo actual: `Sprint 1`, del 19 al 26 de septiembre.
- Las diez issues HAC-5 a HAC-10 y HAC-17 a HAC-20 están en `Canceled`.
- Estados disponibles: `Backlog`, `Pendiente`, `In Progress`, `In Review`, `Done`, `Canceled` y `Duplicate`.
- No existen todavía labels específicas para V1/V2, MCP, AWS Builder u Open Source.

## 1. Preservar la historia V1

- Mantener como historial las ocho issues de implementación V1 canceladas, sin borrarlas ni reciclar sus identificadores para alcance V2.
- Revisar y reactivar **HAC-17 (créditos AWS)** y **HAC-18 (Drive/evidencias)**: son trabajo de soporte válido para el concurso actual, no funcionalidades V1 trasladadas a V2. Ajustar sus criterios de aceptación antes de cambiar estados.
- Agregar posteriormente, si el equipo lo aprueba, la etiqueta `v1-legacy` o `superseded` y un comentario que enlace el nuevo proyecto.
- Revisar cada PR anterior y decidir explícitamente: cerrar, reutilizar por cherry-pick o reformular en una issue V2.

## 2. Rebaselinar el contenedor V2

- Renombrar el proyecto existente a `CargoMesh V2 — Amazon Developer Hackathon`; no crear un proyecto duplicado.
- Actualizar su resumen y descripción para declarar que V2 es una nueva línea de producto.
- Milestone 0: baseline de producto, dominio y arquitectura.
- Conservar `Sprint 1` como ciclo de transición histórico: ocho issues de implementación canceladas y dos de soporte por revalidar. Preparar el nuevo backlog ahora y comprometerlo al siguiente ciclo después de confirmar fechas.
- Primer ciclo V2: validación de la propuesta, contratos y riesgos.
- Siguientes ciclos: cortes verticales demostrables, no capas aisladas sin integración.

Antes de aplicarlo se deben confirmar las fechas oficiales, el track principal y los mini challenges elegidos. Los miembros y estados ya fueron validados mediante la conexión de Linear.

Labels nuevas sugeridas: `v1-legacy`, `v2`, `domain`, `carrier-discovery`, `alexa-mcp`, `aws-builder`, `open-source` y `evidence`. Las labels actuales `frontend`, `backend`, `integration-gate` y `must-have` pueden conservarse.

## 3. Backlog inicial sugerido

1. Baseline V2 y ADRs de alcance.
2. Esquema de sedes, áreas de recojo/entrega, lanes dirigidas, activos, agendas, oportunidades, ofertas y políticas de scoring.
3. Escenarios V2 reproducibles separados de V1.
4. Resolución de rutas, elegibilidad territorial y capacidad por fecha sin preselección heurística opaca.
5. Adaptadores para disponibilidad y ofertas de carriers.
6. Ranking versionado, determinístico y explicable.
7. Superficie MCP y experiencia Alexa+.
8. Intake empresarial: perfiles, preferencias, sedes y taxonomía de carga.
9. Mapa de corredores, candidatos y alternativas multimodales.
10. Benchmark de tokens/latencia y evidencia AWS Builder.
11. Artefacto Open Source, solo si el equipo confirma ese mini challenge.
12. Gate E2E web/voz, observabilidad y paquete de demo.

Cada elemento debe convertirse en una issue con la plantilla V2; esta lista no fija aún prioridades ni fechas.

## 4. Propiedad inicial sugerida

- Tech Lead / BE-2: dominio, persistencia e integración.
- Alexa & Cloud Lead / BE-1: Alexa+, AWS y benchmark de tokens/latencia.
- CI & QA Lead / BE-3: escenarios, observabilidad y evidencias.
- Shipper UI Lead / FE-1: intake, perfiles, sedes y experiencia shipper.
- Carrier Surface Lead / FE-2: mapa, adaptadores y descubrimiento.

La asignación final debe confirmarse con el equipo y equilibrarse por dependencias, no por copiar las issues V1.

## 5. Reglas de estado

- `Backlog`: alcance escrito, todavía no comprometido.
- `Pendiente`: criterios y dependencias listos.
- `In Progress`: rama vinculada y responsable activo.
- `In Review`: PR y evidencia disponibles.
- `Done`: merge autorizado, pruebas y documentación verificadas.
- `Canceled`: alcance abandonado, con motivo y reemplazo enlazado cuando exista.

## 6. Orden de aplicación

1. Confirmar decisiones del hackathon y taxonomía.
2. Renombrar/rebaselinar el proyecto y crear milestone, siguiente ciclo y labels V2.
3. Crear las issues baseline con dependencias.
4. Enlazar la historia V1 sin modificar sus resultados.
5. Asociar ramas nuevas y PRs únicamente a issues V2.
6. Ejecutar una revisión semanal de alcance, riesgos y evidencia.
