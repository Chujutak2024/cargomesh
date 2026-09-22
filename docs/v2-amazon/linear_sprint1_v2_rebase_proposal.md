# Propuesta corregida de rebase de Linear — Sprint 1 CargoMesh V2

**Estado:** propuesta para revisión; no crea ni modifica issues en Linear.
**Proyecto:** `P-HAC-1 — CargoMesh V2 — Alexa Hackathon`.
**Ciclo actual:** 19–25 de septiembre de 2026 en Lima (cierra el 26 a las 00:00).
**Hito asociado:** HITO 1, ya cargado en Linear.
**Base Git:** `codex/v2-amazon-contracts`; `main` fuera de alcance.

## 1. Estado comprobado y correcciones

En Linear, Sprint 1 contiene **HAC-17 y HAC-18 en `In Review`** y ocho issues de implementación **`Canceled`**: HAC-5 a HAC-10, HAC-19 y HAC-20. No hay todavía nuevas issues V2 del sprint. Conservar las canceladas como historia, sin reabrirlas ni contar sus seeds, tres carriers o resultados como avance V2. HAC-17/HAC-18 siguen como habilitadoras, sujetas a evidencia y cierre del Tech Lead.

Este texto sustituye las asignaciones anticipadas `HAC-21…HAC-28` del borrador: Linear asignará los identificadores al crear las issues. No se presupone que esos IDs sigan libres. La conexión MCP local y Hono del PR #80 ya están mergeadas en la base V2; no se vuelve a pedir «implementar el servidor desde cero» ni se declara Alexa+ remota por ese hecho. El HITO 1 habla de cimientos y prototipo: no obliga a entregar esta semana stepper completo, mapa multimodal, cotizaciones, booking o latencia p95 <700 ms. Los conteos 147/160/366 de pruebas son históricos; el gate descubre la suite vigente.

El [plazo oficial de Devpost](https://amazonappdev2026.devpost.com/rules) es el **23 de octubre de 2026 a las 12:00 PDT**. El 19 de octubre en Linear es una meta o freeze **interno propuesto**, no el cierre del concurso. Bedrock no es requisito del track Alexa+; los créditos AWS y su uso son decisiones separadas.

## 2. Relación Hito ↔ Sprint ↔ issue

- **HITO 0:** contratos base y delimitación V1/V2. No se marca terminado por checkboxes escritos si los PR de gobernanza o la revisión siguen abiertos.
- **HITO 1 ↔ Sprint 1:** red de datos mínima ROAD, escenarios/pruebas, baseline MCP local inventariado, componentes y prototipo, catálogo de datos carrier y soporte AWS/Drive. Es el único hito al que se asignan las issues nuevas de este documento.
- **Hitos 2–5:** definen resultados posteriores, no aceptan como entregada una capacidad solo porque exista en un milestone. Las seis issues antiguas de Sprint 2 no se reutilizan aquí; el equipo las replanteará después.
- **Regla de cierre:** la issue se valida contra su propio DoD y evidencia. El hito resume el conjunto, no reemplaza el gate por issue.

Aplicar el modelo **1 core + 1 enabler + N emergentes** por integrante: cinco core nuevas, tres enablers nuevas, más HAC-17/HAC-18 como enablers existentes. `N` no se precarga; una emergente requiere un bloqueo real, relación con su issue madre y DoD independiente. El gate de Cristhian es **su enabler**, no una undécima tarea adicional.

**Propiedad individual:** cada issue tiene un solo responsable, que implementa, prueba y corrige sus propios defectos. La dependencia de un contrato ajeno no convierte al proveedor del contrato en co-desarrollador de la issue consumidora. Si falta un contrato, se marca bloqueada y se coordina su entrega; los compañeros solo revisan el PR al terminar. No crear una issue «colaborativa» sin dueño para repartir la reparación de problemas.

## 3. Manifiesto cerrado de ramas del ciclo

Las ramas se **declaran en la issue antes de crearlas**. Para Sprint 1 se proponen solo estas seis; no abrir ramas de conveniencia para auditorías o documentación sin issue y sin actualizar este manifiesto.

| Referencia | Dueño | Rama declarada | Uso |
|---|---|---|---|
| S1-C1 | Cristhian | `feat/be2-v2-facilities-service-lanes` | Core datos. |
| S1-C2 | Axel | `feat/be1-v2-mcp-baseline-audit` | Core MCP local/V2. |
| S1-C3 | Jean Paul | `feat/be3-v2-pgtap-scenarios` | Core escenarios y pruebas. |
| S1-C4 | Luis | `feat/fe1-v2-ui-components-and-prototype` | Core componentes + prototipo. |
| S1-C5 | Juan Antonio | `feat/fe2-v2-carrier-contracts-audit` | Core catálogo/visualización preliminar. |
| S1-E1 | Cristhian, integrador | `feat/cycle-1-integration` | Única rama de integración del gate, creada cuando existan PRs revisables. |

Cada core nace de `codex/v2-amazon-contracts`, se vincula a **una issue nueva** y propone PR a esa base. Si hay solapamientos, el integrador usa `feat/cycle-1-integration`, ejecuta el gate y solo él fusiona a la base. Enablers de soporte no crean rama. Una tarea emergente con código necesita issue aprobada y rama añadida al manifiesto antes de empezar. Las ramas históricas V1 y las excepciones de gobernanza PR #81/#82 no son plantilla para abrir otras ramas; se resuelven en el gate sin borrarlas precipitadamente. No hay push, PR ni merge V2 a `main`.

## 4. Issues nuevas listas para redactar en Linear

Los códigos `S1-*` son referencias de planificación, **no IDs HAC**. Todas empiezan en `Backlog`/`Pendiente` hasta que su dueño acepte alcance y capacidad. Cada descripción definitiva debe usar los bloques A (metadatos), B (objetivo, alcance, dependencias, DoD) y C (rama, PR, evidencia y cierre) de `LINEAR_ISSUE_TEMPLATE.md`.

### S1-C1 — Cristhian, core

**Título:** `[BE-2] Aplicar esquema V2 de sedes, áreas y lanes dirigidas con RLS comprobable`.
**Hito/antecedente:** HITO 1; HAC-6 cancelada solo como referencia.
**Rama:** `feat/be2-v2-facilities-service-lanes` → PR a `codex/v2-amazon-contracts`.
**Incluye:** migración aditiva mínima para `Facility`, `CarrierDepot`, `ServiceArea` y `ServiceLane` ROAD; organización/rol, índices y constraints pertinentes; contrato de ubicación y lane dirigido compartido. **No incluye** calendario de flota, scoring, booking ni rehacer idempotencia ya existente.
**DoD:** `supabase db reset` aplica sin datos sintéticos en migraciones; pruebas pgTAP de RLS y A→B ≠ B→A pasan; una sede sin área/lane no concede cobertura; migración y decisión de esquema quedan explicadas en `docs/v2-amazon/DOMAIN_CONTRACTS.md` o ADR enlazado. Entregar comando, resultado, PR y riesgos a `In Review`.
**Dependencia:** publicar contrato/tipos temprano para S1-C3/C4/C5; coordinar frontera de archivos con Jean Paul.

### S1-C2 — Axel, core

**Título:** `[BE-1] Aislar el MCP local mergeado de la continuación WebMCP V1 y documentar brechas Alexa+`.
**Hito/antecedente:** HITO 1; PR #80 reutilizable, HAC-5 cancelada no completada.
**Rama:** `feat/be1-v2-mcp-baseline-audit` → PR a la base V2.
**Incluye:** inventario de las cuatro tools y transporte local existente; tests de protocolo/autorización y separación explícita entre `find/get` V1 y discovery V2; contrato de entrada/salida compatible con servicios compartidos; matriz de identidad remota y conexión Alexa+ pendiente. **No incluye** prometer Skill ASK, acceso Alexa live, tools futuras ni SSML p95 garantizado.
**DoD:** `pnpm test:mcp` y typecheck pertinentes pasan; ninguna tool local-only se anuncia como Alexa+ live; `docs/v2-amazon/ALEXA_MCP_AWS.md` o ADR enlazado indica lo reutilizado, lo reemplazado y la prueba faltante para conectividad remota. PR y evidencia en `In Review`.
**Dependencia:** ejemplos tipados de S1-C1; no bloquear el inventario inicial por la migración.

### S1-C3 — Jean Paul, core

**Título:** `[BE-3] Crear escenario ROAD V2 y pruebas de cobertura dirigida, RLS y datos desconocidos`.
**Hito/antecedente:** HITO 1; HAC-7 cancelada solo como referencia.
**Rama:** `feat/be3-v2-pgtap-scenarios` → PR a la base V2.
**Incluye:** `supabase/scenarios/v2-road-baseline/seed.sql` separado de migraciones y pruebas sobre esquema S1-C1. **No incluye** demostrar flota multimodal, tarifas o carrier live con seeds.
**DoD:** escenario reproduce y limpia datos; pgTAP prueba sede sin cobertura, lane inversa, exclusión o dato faltante y aislamiento por organización según esquema entregado; suite descubierta y ejecutada sin exigir un número fijo; README del escenario registra origen sintético, carga, cleanup y comandos. Reportar fallos reales y PR en `In Review`.
**Dependencia:** contrato/migración S1-C1; puede preparar fixtures y plan de pruebas antes del merge.

### S1-C4 — Luis, core

**Título:** `[FE-1] Estandarizar componentes UI y presentar prototipo navegable del intake V2`.
**Hito/antecedente:** HITO 1; HAC-8/HAC-19 canceladas solo como referencia.
**Rama:** `feat/fe1-v2-ui-components-and-prototype` → PR a la base V2.
**Incluye:** componentes reutilizables mínimos y prototipo de captura sede/ubicación, carga, ventana y restricciones con estados faltantes/`unknown`; accesibilidad básica y tokens existentes comprobados. **No incluye** submit real, subasta, todos los modos ni «botón canónico» como requisito del jurado.
**DoD:** demo navegable con datos rotulados como escenario/prototipo, captura de estados vacíos y validación visual/accesibilidad, typecheck/build pertinentes; guía breve de componentes y decisiones de flujo en `docs/v2-amazon/` o enlace de diseño; aprobación/observaciones del equipo adjuntas a la issue.
**Dependencia:** consume contrato de S1-C1; puede trabajar con interfaces tipadas provisionales sin fingir datos live.

### S1-C5 — Juan Antonio, core

**Título:** `[FE-2] Catalogar servicios y representar cobertura ROAD preliminar con procedencia visible`.
**Hito/antecedente:** HITO 1; HAC-9/HAC-20 canceladas solo como referencia.
**Rama:** `feat/fe2-v2-carrier-contracts-audit` → PR a la base V2.
**Incluye:** matriz `CarrierService`/área/lane/fuente y visualización o wireframe de un corredor ROAD con `eligible/ineligible/unknown`; distingue sede de cobertura y estimación de oferta. **No incluye** mapa multimodal live, scraping, cinco WebMCP tools por carrier ni cotizaciones confirmadas.
**DoD:** casos sede sin cobertura y socio sin sede documentados; el prototipo no representa una zona como atendida por proximidad ni marca permisos como concedidos; evidencia visual y matriz de fuentes/precisión en `docs/v2-amazon/` o enlace verificable; typecheck/build si se entrega código.
**Dependencia:** contrato S1-C1 y datos sintéticos S1-C3; coordinar UI con Luis.

### S1-E1 — Cristhian, enabler/gate

**Título:** `[GATE-1] Validar ramas e integrar entregas de Sprint 1 contra contratos V2`.
**Hito:** HITO 1. **Rama declarada:** `feat/cycle-1-integration` → PR a la base V2; no crearla hasta tener PRs revisables.
**Incluye:** manifiesto de ramas/PR/issue, revisión de #81/#82 y del preview Vercel por separado, matriz de dependencias, suite descubierta (DB, typecheck, pruebas pertinentes, build) y acta de decisiones. **No incluye** cambiar `main`, producción o marcar todo el hito completo por un build local.
**DoD:** acta en `docs/04-execution/` con PRs integrados/no integrados y motivo, comandos/resultados, contratos/evidencias comprobados y friction logs materiales; solo el Tech Lead autorizado fusiona y mueve **cada issue aceptada** a `Done`. Lo bloqueado permanece `In Review` o se replanifica.

### S1-E2 — Axel, HAC-17 existente

**Objetivo corregido:** solicitar los créditos AWS con el [formulario enlazado por las reglas oficiales](https://amazonappdev2026.devpost.com/rules) y guardar comprobante. El formulario actualmente escrito en HAC-17 no coincide con el oficial: verificarlo antes del cierre. **No exigir Bedrock habilitado** para considerar realizada la solicitud; acceso, cuota y uso real son estados separados. Sin rama. El Tech Lead valida evidencia y decide `Done`.

### S1-E3 — Jean Paul, HAC-18 existente

**Objetivo corregido:** estructura Drive de evidencias accesible al equipo, con carpeta de producto, AWS Builder/Kiro Crew, demo y friction logs; no presentar evidencias vacías como integración. Sin rama. El Tech Lead prueba enlace/permisos y decide `Done`.

### S1-E4 — Luis, enabler sin código

**Título:** `[FE-1] Mapear campos V1 reutilizables y validar el alcance del prototipo V2 con el equipo`.
**DoD:** matriz `reutilizar/reemplazar/retirar` para sede, carga, pesos, fechas y preferencias; comentarios/decisión del equipo vinculados a S1-C4. Sin rama ni PR; entrega en `In Review` con documento verificable.

### S1-E5 — Juan Antonio, enabler sin código

**Título:** `[FE-2] Inventariar fuentes y vacíos de datos para cobertura y mapa ROAD V2`.
**DoD:** tabla de origen, precisión, fecha y estado para área, lane, corredor, capacidad y costo; identifica dato sintético/estimado/confirmado y desbloquea S1-C5. Sin rama ni PR; entrega en `In Review` con enlace verificable.

## 5. Documentos mínimos del sprint y cierre

| Responsable | Documento/evidencia exigible para Sprint 1 |
|---|---|
| BE-2 | Contrato o ADR de red de datos + migración/RLS y comandos de reset. |
| BE-1 | Inventario MCP local/PR #80 + brechas de autenticación, Alexa remota y discovery V2. |
| BE-3 | README del escenario V2 + reporte de pgTAP/CI sin conteos heredados. |
| FE-1 | Guía de componentes/prototipo + matriz de campos y observaciones del equipo. |
| FE-2 | Catálogo de fuentes/áreas/lanes + captura de visualización preliminar honesta. |
| Tech Lead | Acta Gate-1 con manifiesto de ramas, PRs, suites, decisiones y friction logs. |

El responsable termina en `In Review` con PR y resumen si hay código, o enlace/acceso si es soporte. **Solo el Tech Lead** valida el DoD y pasa a `Done`. No usar `Closes HAC-X` o automatizaciones que cambien a `Done` antes del gate; vincular PR con la issue sin cierre automático si la configuración de Linear/GitHub lo permite.

## 6. Orden de carga posterior en Linear

1. Confirmar con los cinco responsables alcance/capacidad restante, nombres de ramas, labels y objetivo del HITO 1. No modificar Sprint 2 en esta operación.
2. Crear **ocho** issues nuevas: S1-C1…C5 y S1-E1/E4/E5; asociarlas a Sprint 1 e HITO 1. Linear asigna los HAC reales. Mantener HAC-17/HAC-18 sin duplicar.
3. Escribir en cada issue su rama exacta o `No aplica`, dependencias, documento y DoD. Marcar `Backlog`/`Pendiente`; pasar a `In Progress` solo cuando comience el trabajo.
4. Mantener las ocho V1 `Canceled` y vincular antecedentes desde las nuevas. Etiquetar `v1-legacy` solo si se crea/aprueba esa label, sin falsear progreso.
5. En el gate, cerrar únicamente entregas verificadas; no inferir progreso de un PR mergeado previamente, un seed o un preview.
