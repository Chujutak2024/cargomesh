# Mapa de documentación de CargoMesh

## Fuente activa y antecedentes

| Ubicación | Tratamiento |
|---|---|
| [v2-amazon/](./v2-amazon/README.md) | **Fuente activa de CargoMesh V2.** Contratos normativos, modelos en revisión, ejecución y material de entrega en inglés están separados. Comenzar aquí para el producto nuevo. |
| [v1-webmcp/](./v1-webmcp/README.md) | Historia y regresión del demo WebMCP V1; no gobierna carriers, scores, tools o flujos V2. |
| [v1-webmcp/00-master/](./v1-webmcp/00-master/CargoMesh_Planeacion_WebMCP_FINAL.md)–[04-execution/](./v1-webmcp/04-execution/CargoMesh_Team_Execution_Checklist.md) | Plan, requisitos, datos, capturas y evidencia **V1** ahora agrupados dentro de `v1-webmcp/`. No usarlos como especificación V2. |
| [v2-amazon/delivery/](./v2-amazon/delivery/README.md) | Gate-1 y friction logs **V2**, separados de la evidencia WebMCP. |
| [architecture-v2/](./architecture-v2/README.md) | Propuesta **transicional** de V2, no contrato vigente. Incluye un fixture JSON que todavía carga una prueba; mover la carpeta exige actualizar ese consumidor y validar la suite. |

**No se borró ni reescribió** la documentación V1: sigue siendo necesaria para auditoría, evidencia y regresión. Los enlaces locales del repositorio apuntan a la ubicación nueva; los enlaces históricos a commits de V1 se conservan porque identifican aquella evidencia. Las contradicciones se resuelven a favor de `AGENTS.md` y los [contratos V2](./v2-amazon/contracts/README.md).

## Plan de consolidación, sin perder trazabilidad

1. **Ahora:** conservar un índice por carpeta y reparar enlaces tras cada movimiento. Ya se fusionó la guía corta de revisión de PR en el [plan de calidad y validación](./v2-amazon/delivery/QUALITY_AND_VALIDATION_PLAN.md), sin perder sus controles. Mantener separado el contrato normativo, el modelo todavía en revisión y la evidencia fechada. No sustituir el UML mientras el equipo corrige el XML manual.
2. **Tras aprobar el UML:** reconciliar [modelo conceptual](./v2-amazon/models/DOMAIN_UML_MODEL.md), [diseño de clases](./v2-amazon/models/CLASS_DIAGRAM_DESIGN.md) y [paquete de revisión](./v2-amazon/models/MODEL_DIAGRAMS_REVIEW.md). Si sus decisiones ya coinciden, dejar un registro de decisiones vigente y mover las actas anteriores a un archivo fechado; no convertir automáticamente el dibujo en contrato o DER.
3. **Tras Gate-2:** comparar [roadmap semanal](./v2-amazon/delivery/SPRINT_ROADMAP.md) con [roadmap de hitos](./v2-amazon/delivery/cargomesh_v2_milestones_architecture_roadmap.md). Consolidar solo las reglas operativas repetidas y conservar por separado cronología y evidencia. Hacer lo mismo con [plan de Linear](./v2-amazon/delivery/LINEAR_REBASE_PLAN.md) y [fichas Sprint 1](./v2-amazon/delivery/linear_sprint1_v2_rebase_proposal.md): la primera es decisión de gobernanza; la segunda, fotografía histórica de issues.
4. **Antes del freeze de entrega:** revisar que [traducción inglesa](./v2-amazon/en/README.md), demo y documentación enlazada correspondan al commit presentado. Auditar `architecture-v2/` archivo por archivo, con enlaces y consumidores de código, antes de trasladarlo o archivarlo; contiene una muestra JSON usada por una prueba. El material V1 agrupado ya no se presenta como fuente V2.

Los cuatro enlaces rotos de `architecture-v2/` al inexistente `MASTER_BACKLOG.md` ahora remiten explícitamente al roadmap V2 vigente, con nota de que el archivo anunciado por aquel borrador nunca estuvo en el repositorio.
