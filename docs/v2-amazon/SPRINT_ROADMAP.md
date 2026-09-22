# Ruta por sprint — CargoMesh V2

El [roadmap de hitos](./cargomesh_v2_milestones_architecture_roadmap.md) separa resultados y fechas; la [propuesta de Sprint 1](./linear_sprint1_v2_rebase_proposal.md) es la ficha completa de cada issue. A 21 sep no se han creado esas seis issues nuevas en Linear.

## Regla operativa y ramas

Cinco personas, **una issue principal sustancial por persona**. Los apoyos se agregan solo con resultado separable y capacidad: HAC-17 de Axel, HAC-18 de Jean Paul y Gate-1 de Cristhian ya cubren tres necesidades. No se fuerza una secundaria a Luis o Juan. Cada dueño implementa, prueba y corrige su PR; las revisiones empiezan cuando entrega `In Review`. Solo el Tech Lead autorizado acepta `Done`.

Antes de abrir una rama, registrar issue, dueño, fecha, labels, DoD y rama exacta en el manifiesto. Sprint 1 declara cinco ramas principales y `feat/cycle-1-integration`, que se abre solo al existir PRs revisables. Todas parten de y hacen PR a `codex/v2-amazon-contracts`. Soporte HAC-17/18 no necesita rama. No reutilizar V1, improvisar ramas, pushear a `main` ni alterar Vercel producción para arreglar el preview.

## Secuencia de resultados

| Ciclo en Linear | Hito | Resultado/gate y documentación mínima |
|---|---|---|
| Sprint 1 · 19–25 sep (Lima) | HITO 1 **a corregir** | Mapping y esquema V2 ROAD con RLS; límite MCP seguro para Alexa+ y experimento Bedrock condicionado a acceso; sistema visual y prototipo V2; decisión Google Maps/alternativa con mapa piloto; escenario QA V2 y gate integrado. Docs de datos, Alexa/Bedrock, UI, mapa, QA, acta Gate-1. HAC-17/18 con comprobantes. No prometer Alexa live ni Bedrock sin invocación real. |
| Sprint 2 · 26 sep–2 oct | HITO 2 | Sobre cimientos aceptados: elegibilidad física/capacidad por fecha, servicios compartidos Web/MCP, conexión Alexa+ si se obtiene acceso o demo simulada rotulada, continuación Bedrock solo si aporta valor. Issues **por rediseñar**; HAC-11…16 anteriores no se tratan como compromiso V2. |
| Sprint 3 · 3–9 oct | HITO 3 | Stepper conectado, discovery ROAD, oportunidad y oferta atribuible, ranking versionado y mapa con procedencia. |
| Sprint 4 · 10–16 oct | HITO 4 | E2E Web/Alexa real o simulación rotulada, autorización humana y auditoría; benchmark con baseline y p50/p95. |
| Sprint 5 · 17–23 oct | HITO 5 | Freeze interno propuesto el 19, regresión, guía de jueces, video <3 min, feedback y envío antes del [cierre oficial del 23 oct 12:00 PDT](https://amazonappdev2026.devpost.com/rules). |

**Kiro Crew:** comenzar a usar y documentar en Sprint 1, asociado a tareas reales; Jean Paul custodia evidencia y el Gate-1 comprueba qué puede declararse para AWS Builder. El reglamento permite Kiro Crew como herramienta de desarrollo por sí sola. Bedrock es una decisión técnica opcional, no dependencia del track ni condición artificial para cerrar todo Sprint 1. Hitos 2–5 orientan, pero no preasignan ramas ni issues. Sprints 6/7 quedan fuera del plazo oficial.
