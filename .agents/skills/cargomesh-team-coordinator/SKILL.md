---
name: cargomesh-team-coordinator
description: >-
  Coordina CargoMesh V2 en Linear y organiza evidencia del Amazon Developer Hackathon.
  Úsala para proyectos, ciclos, issues, asignación, estados, revisión de PRs,
  AWS Builder, Open Source, demo y Friction Logs.
---

# Coordinación CargoMesh V2

## Fuentes obligatorias

Lee `../../../docs/v2-amazon/LINEAR_REBASE_PLAN.md`, `SPRINT_ROADMAP.md`, `linear_sprint1_v2_rebase_proposal.md`, `cargomesh_v2_milestones_architecture_roadmap.md`, `LINEAR_ISSUE_TEMPLATE.md` y `CODE_REVIEW_GUIDELINES.md`. Los dos archivos de propuesta revisan los hitos ya cargados; no son autorización para modificar Linear. Trata la guía intermedia 1+1+N como origen del **formato**, no como autoridad para ramas, conteos de pruebas o WebMCP.

## Reglas de Linear

- Conserva las issues V1 canceladas como historia; no las borres, recicles ni reabras para simular avance V2. HAC-17 y HAC-18 son enablers vigentes, no duplicados V2.
- Rebaselina el proyecto y los ciclos existentes. El Sprint 1 actual puede recibir **issues nuevas V2** además de su historia cancelada; no postergues por defecto todo V2 al Sprint 2.
- Planifica `1 core + 1 enabler + N emergentes` por integrante. Crea emergentes solo ante un bloqueo real; relaciona dependencias y usa la plantilla de tres bloques.
- Asigna un único dueño por issue, responsable de implementar, probar y corregir defectos funcionales. El flujo es culminar → validar → aprobar → mergear a la base V2; un merge ya ocurrido se audita y registra, no se repite. Un hallazgo bajo y no semántico puede corregirlo el integrador con evidencia; uno medio/alto vuelve al dueño para corrección y nueva revisión. Usa la escala de `LINEAR_ISSUE_TEMPLATE.md`. Antes de crear ramas, aprueba con el equipo el manifiesto de nombres por ciclo y escríbelos en las issues; no inventes IDs HAC ni branches auxiliares.
- La core técnica pasa a `In Progress` con responsable y rama aislada; un enabler de gestión puede no tener rama. `In Review` exige PR/pruebas para código o enlace/evidencia para soporte y es el límite de entrega del responsable.
- **Solo el Tech Lead** mueve a `Done`: tras gate/merge autorizado para código o verificación de acceso/evidencia para soporte.
- Antes de escribir en Linear, presenta el plan y confirma fechas, tracks, labels y asignaciones si aún no están acordados.
- El 19 de octubre en Linear es meta interna propuesta; comprueba el cierre oficial de Devpost antes de usarlo como fecha límite pública. No traslades tareas posteriores al plazo oficial a Sprints 6/7.

## Evidencia

Separa evidencia de producto, AWS Builder, artefacto Open Source y Friction Logs. No prometas un mini challenge ni una integración sin confirmación y artefactos verificables.
