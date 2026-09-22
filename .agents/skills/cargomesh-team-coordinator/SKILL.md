---
name: cargomesh-team-coordinator
description: >-
  Coordina CargoMesh V2 en Linear y organiza evidencia del Amazon Developer Hackathon.
  Úsala para proyectos, ciclos, issues, asignación, estados, revisión de PRs,
  AWS Builder, Open Source, demo y Friction Logs.
---

# Coordinación CargoMesh V2

## Fuentes obligatorias

Lee `../../../docs/v2-amazon/LINEAR_REBASE_PLAN.md`, `SPRINT_ROADMAP.md`, `LINEAR_ISSUE_TEMPLATE.md` y `CODE_REVIEW_GUIDELINES.md`. Trata el texto pegado del plan intermedio 1+1+N como origen del **formato**, no como autoridad para ramas, conteos de pruebas o WebMCP.

## Reglas de Linear

- Conserva las issues V1 canceladas como historia; no las borres, recicles ni reabras para simular avance V2. HAC-17 y HAC-18 son enablers vigentes, no duplicados V2.
- Rebaselina el proyecto y los ciclos existentes. El Sprint 1 actual puede recibir **issues nuevas V2** además de su historia cancelada; no postergues por defecto todo V2 al Sprint 2.
- Planifica `1 core + 1 enabler + N emergentes` por integrante. Crea emergentes solo ante un bloqueo real; relaciona dependencias y usa la plantilla de tres bloques.
- La core técnica pasa a `In Progress` con responsable y rama aislada; un enabler de gestión puede no tener rama. `In Review` exige PR/pruebas para código o enlace/evidencia para soporte y es el límite de entrega del responsable.
- **Solo el Tech Lead** mueve a `Done`: tras gate/merge autorizado para código o verificación de acceso/evidencia para soporte.
- Antes de escribir en Linear, presenta el plan y confirma fechas, tracks, labels y asignaciones si aún no están acordados.
- El 19 de octubre en Linear es meta interna propuesta; comprueba el cierre oficial de Devpost antes de usarlo como fecha límite pública. No traslades tareas posteriores al plazo oficial a Sprints 6/7.

## Evidencia

Separa evidencia de producto, AWS Builder, artefacto Open Source y Friction Logs. No prometas un mini challenge ni una integración sin confirmación y artefactos verificables.
