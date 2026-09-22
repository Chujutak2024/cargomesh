# Rebase de Linear para CargoMesh V2

Este documento registra la auditoría y el orden de carga. **La carga de Sprint 1 se aplicó en Linear el 22 de septiembre de 2026**: HITO 1 corregido, HAC-21…26 creadas y HAC-17/18 ajustadas sin cambio de estado. Las [ocho fichas](./linear_sprint1_v2_rebase_proposal.md) aplican la [plantilla A/B/C](./LINEAR_ISSUE_TEMPLATE.md); el [roadmap](./cargomesh_v2_milestones_architecture_roadmap.md) audita Hitos 0–5. El corte posterior integra PR #81/#82 de gobernanza, PR #83 de HAC-21 y PR #85 de HAC-22 en la base V2; ningún merge debe repetirse.

## Estado histórico verificado el 21 de septiembre de 2026

- Proyecto `P-HAC-1` con cinco miembros y Hitos 0–5 ya creados. Mantenerlos y corregir descripciones, no duplicarlos.
- Sprint 1 (19–25 sep Lima): HAC-17 (créditos AWS) y HAC-18 (Drive) en `In Review`; HAC-5…10, HAC-19 y HAC-20 en `Canceled`. No existen nuevas issues V2 de Sprint 1.
- HAC-18 tenía due date **21 sep**: desde 22 sep está vencida si no se validó; verificar estado antes de editarla. HAC-17 vence 25 sep.
- Sprint 2 tiene HAC-11…16 `Pendiente`, con premisas intermedias; por instrucción del equipo se ignoran por ahora.
- PR #80 ya había entrado a `codex/v2-amazon-contracts`, pero MCP local no probaba Alexa+ remota ni discovery V2. PR #81/#82 aún estaban sujetos al gate en este corte histórico; ambos se mergearon el 22 sep. El fallo de Vercel preview por rootDirectory no autoriza cambiar producción.
- HITO 1 cargado omite a Axel, Alexa segura/Bedrock exploratorio y mapa piloto. Además fija número de tests y un color «del jurado» sin soporte. Debe corregirse **antes** de asociar issues nuevas; conservar target 25 sep y registrar qué queda diferido a HITO 2.
- HITO 0 tiene casillas completas con progreso 0; HITO 2 exige ASK/latencia no probadas; HITO 4 incluye cotización/autoaprobación ficticias; HITO 5 auto-merge a `main`. El roadmap señala cambios, no los ejecuta.
- [Reglas oficiales](https://amazonappdev2026.devpost.com/rules): cierre **23 oct 2026 12:00 PDT**, no 19 oct (freeze interno). Bedrock no es requisito Alexa+; Kiro Crew usado/documentado puede calificar para AWS Builder.

## Decisión de estructura

Una **principal sustancial** por integrante, sin dividir un resultado indivisible en tareas triviales: C1 Cristhian datos/flujo; C2 Axel Alexa MCP seguro y Bedrock condicionado; C3 Jean Paul QA transversal; C4 Luis diseño/estandarización/prototipo; C5 Juan mapa/investigación/validación FE. Soportes solo necesarios: E1 Gate de Cristhian, HAC-17 de Axel y HAC-18 de Jean Paul. Son **seis issues nuevas** más dos existentes; los IDs reales los asigna Linear. Las viejas canceladas son antecedentes, no avance.

Cada issue exige dueño, ciclo/hito, prioridad, labels **existentes**, fecha, rama o `No aplica`, objetivo, alcance/fuera de alcance, dependencias, antecedente V1, DoD con evidencia y bloque de cierre. Una issue puede terminar `In Review` aun si el hito no está completo. Su dueño implementa, prueba y corrige; QA devuelve defectos al dueño y revisores entran al final. Solo Tech Lead mueve `Done` tras gate.

## Gobernanza por ciclo

1. Confirmar fechas/capacidad con los cinco y aprobar manifiesto de **cinco ramas principales + una rama de integración condicional** dentro de las issues antes de crear ramas. Todas parten de y hacen PR a `codex/v2-amazon-contracts`.
2. Soportes HAC-17/18 no abren rama. La rama `feat/cycle-1-integration` se crea solo con PRs revisables. Una emergente con código requiere issue y rama aprobadas **antes** de empezar; no usar ramas de conveniencia.
3. Integrador resuelve solapamientos en la rama del ciclo, ejecuta suites descubiertas y publica acta. No push, PR ni merge a `main`; no arreglo lateral de Vercel producción. Evitar `Closes HAC-X` si automatiza `Done` antes del gate.
4. En `Backlog` no afirmar trabajo; `In Progress` con actividad; `In Review` solo con PR/evidencia y pruebas; `Done` solo tras aceptación por issue. No usar conteos de tests fijos ni datos V1 como DoD V2.
5. Flujo vigente: el dueño culmina → se valida DoD/evidencia → el Tech Lead aprueba → el integrador autorizado mergea a la base V2. Defectos bajos no semánticos puede corregirlos el integrador con diff visible; los medios/altos vuelven al dueño. Si el PR ya fue mergeado, se audita y registra la aceptación o el pendiente sin otro merge. Véase [la escala](./LINEAR_ISSUE_TEMPLATE.md#flujo-de-aceptación-y-escala-de-hallazgos).

## Orden aplicado tras aprobación del equipo

1. HITO 1 y descripción del proyecto corregidos: 19 oct es freeze interno, 23 oct cierre oficial. Sprint 2 no se tocó.
2. C1…C5 y E1 se crearon como HAC-21…26 en `Pendiente`, con responsable, fecha, labels existentes, ramas declaradas, bloques A/B/C y relaciones. HAC-17/18 se corrigieron sin duplicarlas; las V1 canceladas permanecen históricas.
3. La [documentación Alexa+](https://developer.amazon.com/docs/alexaplus/add-ons/home.html) indica acceso selecto; HAC-22 decide conexión real vs simulación rotulada según evidencia. HAC-17 no tiene acuse visible en comentarios. HAC-18 sí tiene comentario con enlace/estructura de Drive, todavía `In Review` hasta validación.
4. Kiro Crew se documenta desde Sprint 1 con uso real por integrante y custodia de Jean Paul. Gate-1 integra solo PRs que cumplan DoD y cierra issues individualmente.
5. La descripción antigua del objeto `Sprint 1` en Linear aún menciona DRAFT/PENDING; el conector disponible lista ciclos pero no permite editar esa descripción. HITO 1 e issues nuevas contienen el objetivo aprobado. No crear nuevas labels `v2`/`core`/`enabler` sin aprobación.
