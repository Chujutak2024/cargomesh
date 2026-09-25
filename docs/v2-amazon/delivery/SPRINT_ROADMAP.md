# Ruta por sprint — CargoMesh V2

El [roadmap de hitos](./cargomesh_v2_milestones_architecture_roadmap.md) separa resultados y fechas; la [ficha de Sprint 1](./linear_sprint1_v2_rebase_proposal.md) documenta cada issue. Las seis issues nuevas HAC-21…26 se cargaron en Linear el 22 sep, junto con la corrección del HITO 1. HAC-17/18 permanecen como soportes existentes.

La [guía de calidad y validación](./QUALITY_AND_VALIDATION_PLAN.md) añade trazabilidad de pruebas, estimación ligera y validaciones humanas selectivas en cada gate. Es una mejora de planificación documental: no cambia automáticamente las fichas ya cargadas ni acredita pruebas aún no ejecutadas.

## Regla operativa y ramas

Cinco personas, **una issue principal sustancial por persona**. Los apoyos se agregan solo con resultado separable y capacidad: HAC-17 de Axel, HAC-18 de Jean Paul y Gate-1 de Cristhian ya cubren tres necesidades. No se fuerza una secundaria a Luis o Juan. Cada dueño implementa y prueba; luego culmina → validamos → aprobamos → mergeamos a `codex/v2-amazon-contracts`. Hallazgos bajos no semánticos puede resolverlos el integrador con evidencia; medios/altos regresan al dueño. Solo el Tech Lead autorizado acepta `Done`; el detalle está en [la plantilla](./LINEAR_ISSUE_TEMPLATE.md#flujo-de-aceptación-y-escala-de-hallazgos).

Antes de abrir una rama, registrar issue, dueño, fecha, labels, DoD y rama exacta en el manifiesto. Sprint 1 declara cinco ramas principales y `feat/cycle-1-integration`, que se abre solo al existir PRs revisables. Todas parten de y hacen PR a `codex/v2-amazon-contracts`. Soporte HAC-17/18 no necesita rama. No reutilizar V1, improvisar ramas, pushear a `main` ni alterar Vercel producción para arreglar el preview.

**Corte 22 sep:** HAC-21 está `Done` con PR #83 mergeado; PR #85 de Axel también está mergeado, pero HAC-22 sigue `In Progress` hasta corregir/trazar su entrega y no equivale a Alexa+ live. HAC-23…25 siguen `Pendiente`; HAC-26 está `In Progress` como gate no aprobado. Linear muestra HITO 1 al 25% tras esos cambios de estado: su porcentaje automático no equivale a porcentaje de entregas aceptadas ni se ajusta manualmente por commits o capturas.

## Secuencia de resultados

| Ciclo en Linear | Hito | Resultado/gate y documentación mínima |
|---|---|---|
| Sprint 1 · 19–25 sep (Lima) | HITO 1 corregido | HAC-21 mapping/esquema V2 ROAD con RLS; HAC-22 MCP seguro Alexa+ y Bedrock condicionado; HAC-23 escenario/matriz QA; HAC-24 sistema visual/prototipo; HAC-25 decisión Google Maps/alternativa y mapa piloto; HAC-26 gate. HAC-17/18 son soportes. No prometer Alexa live ni Bedrock sin invocación real. |
| Sprint 2 · 26 sep–2 oct | HITO 2 | HAC-11…16 se reescribieron **en sus mismos IDs antes de iniciar trabajo**: elegibilidad ROAD y capacidad por fecha (Cristhian), account linking y consulta MCP V2 (Axel), QA (Jean Paul), preview Web (Luis), mapa con procedencia (Juan) y Gate-2 (Cristhian). HAC-27 analiza QA de Sprint 1. HAC-28, emergente de Jean Paul, retira WebMCP del runtime/catálogo activo tras HAC-12/HAC-11 y bloquea el cierre de HAC-16. Alexa+ live solo con acceso/invocación verificables; Bedrock sigue opcional. |
| Sprint 3 · 3–9 oct | HITO 3 | Stepper conectado, discovery ROAD, oportunidad y oferta atribuible, ranking versionado y mapa con procedencia. |
| Sprint 4 · 10–16 oct | HITO 4 | E2E Web/Alexa real o simulación rotulada, autorización humana y auditoría; benchmark con baseline y p50/p95. |
| Sprint 5 · 17–23 oct | HITO 5 | Freeze interno propuesto el 19, regresión, guía de jueces, video <3 min, feedback y envío antes del [cierre oficial del 23 oct 12:00 PDT](https://amazonappdev2026.devpost.com/rules). |

**Kiro Crew:** comenzar a usar y documentar en Sprint 1, asociado a tareas reales; Jean Paul custodia evidencia y el Gate-1 comprueba qué puede declararse para AWS Builder. El reglamento permite Kiro Crew como herramienta de desarrollo por sí sola. Bedrock es una decisión técnica opcional, no dependencia del track ni condición artificial para cerrar todo Sprint 1. Los Hitos 3–5 orientan, pero no preasignan ramas ni issues. Sprints 6/7 quedan fuera del plazo oficial.

## Rebase de Sprint 2 en Linear

Las seis issues HAC-11…16 estaban `Pendiente`, sin PRs ni trabajo iniciado; por decisión del equipo se conservaron sus IDs, ciclo, HITO 2 y fechas, y se sustituyeron los contratos WebMCP/BALANCED/Andes-Inca-Pacific por DoD V2. HAC-15 pasó a Juan; HAC-13 pasó de puente WebMCP a QA. HAC-27, ya existente, permanece como enabler de análisis bloqueado por HAC-23. No se crearon issues adicionales por simetría ni por el plan Free.

El [plan detallado de Sprint 2](./SPRINT2_EXECUTION_PLAN.md) propone criterios verificables y un orden de entrega para cada issue. No constituye edición automática de Linear; conservar las fechas, dueños, labels y ramas registrados hasta confirmar capacidad y el manifiesto con el equipo.

**Emergente creada el 23 sep:** [HAC-28 · retiro WebMCP del runtime V2](./SPRINT2_WEBMCP_RETIREMENT_ISSUE.md), con Jean Paul como dueño adicional a HAC-13. Estado `Pendiente`; inventario inmediato; implementación bloqueada por HAC-12/HAC-11; fecha límite 2 oct y rama propia declarada en HAC-16, pendiente de aprobación del manifiesto antes de abrirse. Cristhian valida el PR de forma independiente en Gate-2.

| Issue | Dueño y resultado V2 | Bloqueo duro en Linear |
|---|---|---|
| HAC-12 | Cristhian: servicio/API ROAD, capacidad por ventana, `eligible/ineligible/unknown` | Ninguno: HAC-21 ya está `Done`; publica contrato temprano. |
| HAC-11 | Axel: `mcp_account_links` y consulta MCP V2 del servicio compartido | HAC-22, límite de seguridad/identidad. |
| HAC-13 | Jean Paul: escenario, pruebas negativas y matriz Web/MCP | HAC-23, baseline QA. |
| HAC-14 | Luis: preview de elegibilidad en el intake | HAC-24, prototipo y componentes. |
| HAC-15 | Juan: mapa ROAD con fuente/estado | HAC-25, ADR/proveedor y piloto. |
| HAC-28 | Jean Paul: retirar WebMCP V1 del runtime/catálogo activo y auditar limpieza | HAC-12 y HAC-11 para implementar; inventario puede comenzar antes. |
| HAC-16 | Cristhian: Gate-2 y acta por issue | HAC-26, HAC-11…15 y HAC-28 para **aceptación final**; preparación del manifiesto puede comenzar antes. |

HAC-12 entrega su contrato a los demás desde el inicio sin forzar un bloqueo total; ninguna UI/tool queda `Done` si su integración final usa mocks. Las cinco core vencen el 30 de septiembre y Gate-2 el 2 de octubre; no se movieron fechas. HAC-16 registra seis nombres exactos de rama **propuestos**, aún sujetos a aprobación del manifiesto por el equipo; no abrir ramas ni tocar `main`/producción antes de esa decisión.

### Ajuste de DoD propuesto para HAC-13 — separación V1/V2

Añadir **en la descripción de HAC-13 de Linear** antes de comenzar Sprint 2, sin crear otra issue ni trasladar la implementación de HAC-11 a QA:

> [ ] Verificar que `local-integration.test.ts` (Lima→Valparaíso y expectativa de tres carriers) quede identificado y ejecutado como regresión **V1**, sin añadir carriers/ofertas artificiales al catálogo V2 para satisfacerlo. Registrar comando, fixture, resultado y defecto si falla.
> [ ] Verificar una prueba de integración **V2 independiente** sobre `v2-road-baseline` o su sucesor aprobado: Piura sin cobertura y lane inversa B→A deben producir cero candidatos/estado correspondiente, sin fabricar ofertas. Registrar comando, datos, resultado esperado/real y evidencia; probar también autorización entre tenants cuando el camino MCP de HAC-11 esté disponible.
> [ ] Confirmar que el reporte y el gate distingan `regresión V1`, `escenario V2`, `bloqueado` y `aprobado`; un fallo conocido de `test:mcp:local` no se oculta ni se cuenta como suite verde. Si Axel modifica el test o la tool dentro de HAC-11, Jean Paul valida y reprueba el resultado; no corrige código ajeno como requisito de HAC-13.

Reutilizar el escenario QA evita duplicar fixtures **si** el PR de HAC-23 lo entrega y Axel comprueba que su contrato y aislamiento le sirven; no elevar el escenario a catálogo productivo. En el corte local actual, `user-token.ts` ya comenta que los account links quedan bloqueados hasta tener implementación persistente aprobada, sin atribuirlos a HAC-21. HAC-11 sigue siendo dueño de `mcp_account_links` y su RLS/tests. Este ajuste documental no afirma que Linear, PR #87 ni la suite local ya estén corregidos.
