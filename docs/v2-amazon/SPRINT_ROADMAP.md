# Ruta por sprint — CargoMesh V2

El [roadmap de hitos cargados](./cargomesh_v2_milestones_architecture_roadmap.md) distingue resultados, fechas y capacidades aún no implementadas. La [propuesta de issues de Sprint 1](./linear_sprint1_v2_rebase_proposal.md) es la especificación detallada de dueños, ramas, dependencias, DoD y documentos para **esta semana**. No se han creado esas issues en Linear.

## Regla operativa

Cinco personas, cada una con **una core y una enabler**. HAC-17/HAC-18 ya ocupan las enablers de Axel/Jean Paul; el Gate-1 es la enabler de Cristhian. Las emergentes se justifican al aparecer, no se precargan. Cada issue tiene un solo dueño que implementa, prueba y corrige; otros entregan contratos dependientes o revisan el PR cuando está listo. El responsable entrega en `In Review`; solo el Tech Lead valida y mueve a `Done`.

Las ramas se declaran **antes de crearlas** en la issue y el manifiesto de ciclo. Sprint 1 permite cinco ramas core + `feat/cycle-1-integration` para el gate; soporte sin código no abre rama. No abrir ramas improvisadas como las excepciones históricas PR #81/#82. La base es `codex/v2-amazon-contracts` y `main` queda fuera del flujo V2.

## Secuencia de resultados

| Ciclo en Linear | Hito | Resultado/gate y documentación mínima |
|---|---|---|
| Sprint 1 · 19–25 sep (Lima) | HITO 1 | Red ROAD mínima, RLS, escenario/pruebas, baseline MCP local, componentes/prototipo y catálogo de fuentes. Acta Gate-1 con manifiesto de ramas, PRs, comandos y decisiones. HAC-17/18 con comprobantes. |
| Sprint 2 · 26 sep–2 oct | HITO 2 | Elegibilidad/capacidad y seguridad MCP remota, según issues **por definir**. HAC-11…16 viejas no son compromisos V2; no se modifican en esta replanificación. |
| Sprint 3 · 3–9 oct | HITO 3 | Intake Web, discovery ROAD, oferta atribuible, ranking versionado y mapa con procedencia; cada integración requiere datos/pruebas propios. |
| Sprint 4 · 10–16 oct | HITO 4 | E2E Web/Alexa real o simulación rotulada, autorización humana y auditoría; benchmark con baseline y p50/p95. |
| Sprint 5 · 17–23 oct | HITO 5 | Freeze interno propuesto el 19, regresión, guía para jueces, video <3 min, feedback y envío antes del [cierre oficial del 23 de octubre, 12:00 PDT](https://amazonappdev2026.devpost.com/rules). |

Sprints 6/7 ocurren después del cierre oficial y no contienen entregables de la postulación. Los resultados de Sprints 2–5 son orientación de hitos ya cargados, no ramas ni issues aprobadas. La capacidad ROAD demostrada no permite anunciar flota multimodal, cotizaciones live, Alexa remota o Bedrock sin evidencia ejecutable.
