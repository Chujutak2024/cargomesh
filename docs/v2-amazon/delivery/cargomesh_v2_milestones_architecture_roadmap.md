# Plan de hitos y transición arquitectónica — CargoMesh V2

**Estado:** roadmap auditado; Hitos 0–5 tienen descripciones alineadas en Linear al corte del 22 sep. HITO 0 se mantiene pendiente de aceptación explícita; Linear muestra HITO 1 al 25% tras pasar HAC-22/26 a `In Progress`, lo que no implica 25% de entregas aceptadas. Hitos 2–5 son dirección de producto, no promesa de capacidades live. PR #81/#82/#83/#85 ya están mergeados en la base V2.
**Track principal planificado:** Alexa+ mediante servidor MCP propio o experiencia simulada declarada, conforme a las [reglas oficiales](https://amazonappdev2026.devpost.com/rules).
**Mini challenges:** AWS Builder y Open Source solo con artefactos y evidencia propios. Bedrock es opcional.
**Base V2:** `codex/v2-amazon-contracts`. `main` no es el target de trabajo ni de entrega por defecto.
**Meta interna propuesta:** freeze 19 de octubre; **cierre oficial:** 23 de octubre de 2026, 12:00 PDT.

## 1. Qué está implementado y qué sigue siendo objetivo

CargoMesh V1/WebMCP se preserva como regresión. El PR #80 incorporó un endpoint `/mcp` local reutilizable; el PR #85 añadió transporte seguro y catálogo V2 parcial, **sin** demostrar invocación Alexa+ live ni tools comerciales V2. El PR #83 añadió el esquema ROAD de sedes, áreas y lanes, **sin** calendario de capacidad ni `mcp_account_links`. Los contratos en `docs/v2-amazon/` describen el objetivo: carriers `0..N`, sedes separadas de cobertura, capacidad por ventana, filtros físicos, rutas/planes, ofertas atribuibles y ranking versionado. RAIL/SEA/AIR permanecen en la taxonomía hasta tener adaptadores, datos y pruebas.

`supabase/migrations/` recibe cambios estructurales y RLS, no datos sintéticos. Los escenarios V2 viven en `supabase/scenarios/v2-*/seed.sql`. No reescribir migraciones históricas aplicadas ni atribuir al V2 los tres carriers o puntajes FR-1042 de V1. Descubrir el número de pruebas al ejecutarlas; 160 pgTAP y 36 MCP son referencias antiguas, no criterios fijos.

Las fuentes normativas están en el repositorio: `docs/v2-amazon/README.md` y los contratos `docs/v2-amazon/contracts/DOMAIN_CONTRACTS.md`, `CARRIER_COVERAGE_AND_SERVICEABILITY.md`, `CARRIER_DISCOVERY_AND_RANKING.md` y `TRANSPORT_PLANS_AND_FLEET.md`.

## 2. Hito ↔ sprint ↔ entrega

Los **hitos** expresan resultados de producto y evidencia; los **sprints** son ventanas de trabajo; las **issues** asignan un resultado comprobable a una persona. Un hito no se cierra porque su descripción contenga casillas marcadas o un porcentaje visual. Cada issue tiene dueño, dependencia, rama si hay código, DoD y documento/evidencia; el Tech Lead cierra tras gate.

| Hito ya creado en Linear | Ciclo | Entrega demostrable y límite |
|---|---|---|
| HITO 0 · Gobernanza y baseline | Previo/Sprint 1 | Contratos V2 revisados y PR #81/#82 mergeados. Linear reporta 0% porque no hay issues aceptadas asociadas al hito; verificar el baseline y registrar aceptación explícita antes de llamarlo completo. |
| HITO 1 · Cimientos V2 **corregido en Linear** | Sprint 1 · 19–25 sep (Lima) | HAC-21 mapping/esquema V2 ROAD y RLS; HAC-22 MCP seguro Alexa+ y Bedrock condicionado; HAC-23 QA; HAC-24 UI/prototipo; HAC-25 mapa piloto; HAC-26 gate. HAC-17/18 son soportes. Alexa live, Bedrock live y mapa externo se declaran solo con prueba real. |
| HITO 2 · Elegibilidad ROAD, tools MCP V2 y acceso Alexa+ | Sprint 2 · 26 sep–2 oct | HAC-11…16 se reescribieron en sus IDs sin reciclar trabajo ejecutado: servicio ROAD/capacidad por ventana, account linking y consulta MCP V2, QA, preview Web, mapa con fuente/estado y Gate-2. HAC-27 analiza el corte QA previo. Alexa+ real solo con acceso/invocación verificables; Bedrock opcional. Ramas propuestas pendientes de aprobación del manifiesto. |
| HITO 3 · Intake, discovery y ofertas | Sprint 3 · 3–9 oct | Corte Web con servicios ROAD, candidatos trazables, oferta real solo si un carrier la emite, ranking por política versionada y mapa con fuentes. Sin fórmula 6D universal ni precio inventado. |
| HITO 4 · Experiencia dual y auditoría | Sprint 4 · 10–16 oct | E2E Web + Alexa+ **real si se conecta**, o simulación claramente rotulada según ruta de postulación elegida. Confirmación humana para booking, autorización y auditabilidad; no auto-reserva por umbral arbitrario. |
| HITO 5 · Hardening, demo y postulación Devpost | Sprint 5 · 17–23 oct | Freeze interno propuesto el 19, regresión, documentación de instalación/pruebas, benchmark, video <3 min y postulación antes del cierre oficial. Sprints 6/7 quedan fuera de la postulación. |

HITO 2 tiene issues y dependencias concretas en Linear, pero sus ramas propuestas aún necesitan aprobación del equipo antes de abrirse. El alcance de Hitos 3–5 es dirección, no compromiso de branches ni issues futuras. La [ficha detallada de Sprint 1](./linear_sprint1_v2_rebase_proposal.md) registra IDs reales, dueños, fechas y evidencia esperada; la [ruta por sprint](./SPRINT_ROADMAP.md#rebase-de-sprint-2-en-linear) resume la asignación V2 de Sprint 2.

## 3. Correcciones aplicadas a las descripciones de hitos en Linear

La corrección del HITO 1 y de la descripción del proyecto se aplicó el 22 sep. En el corte posterior se actualizaron las descripciones de Hitos 0/2–5 sin alterar dueños, labels, issues de Sprint 2 ni fechas target. Los porcentajes siguen derivados de issues aceptadas, no de edición manual:

1. **Proyecto — aplicado / HITO 0 — pendiente de aceptación:** la descripción del proyecto ya distingue 19 de octubre como freeze interno y 23 como cierre oficial, sin exigir «160 pgTAP» ni Alexa Skill como única vía. PR #81/#82 se mergearon; HITO 0 mantiene 0% por falta de issues aceptadas asociadas, por lo que sus casillas históricas no equivalen a gate aprobado.
2. **HITO 1 — aplicado:** target 25 sep Lima; cinco frentes con HAC-21…25 y gate HAC-26; sin «160 tests» fijo ni color supuesto como requisito del jurado. El hito registra PR #83/#85 mergeados, HAC-21 `Done` y HAC-22 pendiente de validación. La descripción antigua del objeto `Sprint 1` aún dice DRAFT/PENDING porque la conexión disponible no expone edición de ciclos; hito e issues contienen el objetivo vigente.
3. **HITO 2 — rebase aplicado en Linear:** HAC-11…16 seguían `Pendiente`, sin PRs ni ejecución; se conservaron los IDs, HITO 2, ciclo y fechas y se reemplazaron sus DoD WebMCP/BALANCED V1. HAC-12 (Cristhian) entrega elegibilidad ROAD/capacidad; HAC-11 (Axel) vinculación de cuenta y tool MCP V2; HAC-13 (Jean Paul) QA; HAC-14 (Luis) preview Web; HAC-15 (Juan) mapa; HAC-16 es el gate. HAC-27 analiza HAC-23. No pedir implementar `/mcp` desde cero ni afirmar que una ASK Skill conectada es obligatoria. Alexa+ live se declara solo con acceso/invocación reales; `p95 <700 ms` es objetivo interno medible, no garantía; Bedrock es opcional. Las ramas exactas están propuestas en HAC-16 y no se crean sin aprobar el manifiesto.
4. **HITO 3:** sustituir «Balanced 6D» como verdad por `ScoringPolicy` versionada; distinguir oportunidad, estimación y `CarrierOffer` atribuible. El número de pasos del stepper, 50 variaciones de benchmark y modalidades son decisiones de diseño/dataset, no requisitos universales.
5. **HITO 4:** retirar la cotización ficticia de Andes por USD 3,200 y la autoaprobación de USD 5,000. Una oferta final exige fuente, vigencia y autorización; booking requiere confirmación humana y política corporativa explícita. El «Live MCP Inspector» solo se llama live si muestra eventos auténticos; de otro modo se rotula simulación. `409 STALE_DRAFT` aplica a mutación con versión obsoleta, no se inventa a partir de cualquier intento posterior a reservar.
6. **HITO 5:** eliminar conteos fijos 160/36 y el merge «final» automático a `main`: la postulación puede referenciar la rama/repo evaluable conforme a las reglas y una decisión de release separada. Ajustar el target de hito 20 de octubre si pretende representar envío oficial del 23; conservar el 19 como freeze interno. El video debe mostrar lo que realmente funciona, durar menos de tres minutos, estar disponible públicamente en YouTube/Vimeo y tener materiales en inglés o traducción inglesa conforme a las [reglas](https://amazonappdev2026.devpost.com/rules).

También separar en la descripción del proyecto «subasta inversa» como objetivo del marketplace de un flujo ya implementado. Linear calcula el progreso visual desde estados de issues, incluidos avances en curso; el porcentaje no sustituye la matriz de aceptación del gate ni procede de seeds o casillas manuales.

## 4. Arquitectura incremental y dependencias

`FreightRequest` y preferencias del shipper alimentan el servicio de aplicación compartido. Ese servicio resuelve ubicación, área, lane y ruta; aplica filtros duros de carga/equipo/capacidad/permiso; produce planes con estado y procedencia; recibe ofertas atribuibles; y compara solo alternativas conocidas con `ScoringPolicy` versionada. Web y el canal MCP consumen el mismo resultado; Alexa no decide elegibilidad ni cambia el score.

- **Datos:** sede ≠ cobertura; A→B ≠ B→A; modo ≠ equipo; disponibilidad ≠ oferta; ausencia de dato ≠ elegibilidad.
- **Ruta y costo:** distancia, ETA, peajes, combustible y frontera indican fuente y estado `quoted/estimated/unknown`. No se simula autorización aduanera ni precio contractual.
- **Flota:** una escolta no suma capacidad; una carga indivisible no se reparte; varios recursos deben estar libres en toda la ventana.
- **Historial:** solo precarga datos de la organización autorizada; revalida precio, cupo, permisos y política antes de recomendar.
- **Alexa+:** una tool y una llamada se consideran live solo con identidad, transporte, código, pruebas y demo de esa integración; el MCP local de PR #80 es un punto de partida. Alexa+ → MCP CargoMesh → dominio; Bedrock es adaptador opcional de lenguaje natural, no conexión directa que determine scores.

## 5. Ramas por ciclo y responsabilidad

No crear ramas «por si acaso». En cada sprint se aprueba primero el manifiesto de issues: **una persona responsable por issue**, rama exacta si hay código y target `codex/v2-amazon-contracts`. Una core por integrante normalmente usa una rama; un enabler de evidencia no necesita otra. La rama de integración del ciclo se define en la issue de gate y solo el integrador autorizado la crea cuando hay PRs revisables. Una emergente que exija código añade su rama al manifiesto tras aprobar su issue; no se mezcla en la rama de otro miembro. Las ramas antiguas permanecen como historia, sin borrados precipitados. `main` y producción no se alteran para arreglar un preview.

El dueño de cada issue implementa y prueba; culmina → el equipo valida DoD y evidencia → el Tech Lead aprueba → el integrador autorizado mergea a `codex/v2-amazon-contracts`. Si se detecta un hallazgo bajo no semántico, el integrador puede corregirlo con evidencia y aviso; un hallazgo medio/alto vuelve al dueño con reproducción y criterio de nueva revisión. Si el PR ya se mergeó, se audita ese hecho sin repetirlo ni convertirlo automáticamente en aceptación. Las dependencias entregan un contrato, no transfieren la responsabilidad funcional. Gate-1 tiene dueño único y Hitos futuros no preasignan ramas antes de aprobar issues. Véase [la escala](./LINEAR_ISSUE_TEMPLATE.md#flujo-de-aceptación-y-escala-de-hallazgos).

## 6. Documentación mínima por sprint

| Sprint | Documentación / evidencia que habilita el gate |
|---|---|
| 1 | Mapping entidad/tabla/RLS y migración; decisión de seguridad MCP/identidad Alexa y prueba Bedrock o bloqueo+fallback; escenario y matriz QA; guía de componentes, prototipo; ADR Google Maps/alternativa y mapa piloto; manifiesto y acta Gate-1. HAC-17/18 con comprobantes y evidencia auténtica de Kiro Crew desde esta semana. |
| 2 | HAC-11…16 vigentes: contrato y pruebas de elegibilidad/capacidad ROAD, account linking y tool MCP V2, matriz QA separada de regresión V1, preview Web, mapa con procedencia y acta Gate-2. Ver [refinamiento propuesto](./SPRINT2_EXECUTION_PLAN.md); benchmark inicial solo con método/baseline y no como sustituto de aceptación. |
| 3 | Contratos de oportunidad/oferta y `ScoringPolicy`, procedencia de rutas/costos/mapa, pruebas E2E Web y dataset V2 reproducible. |
| 4 | Guion y evidencia E2E Web/Alexa o simulación declarada, política de confirmación/booking, auditoría de versiones, resultados p50/p95 y errores. |
| 5 | Guía de instalación y acceso para jueces, reporte de suites descubiertas, video y texto coherentes con el runtime, feedback de herramientas, AWS Builder/Open Source solo si se demuestran, friction logs materiales y comprobante de envío. |

El DoD de cada issue enumera su documento exacto y enlace; este cuadro no autoriza marcar una issue `Done` sin evidencia. Solo el Tech Lead cierra las issues aceptadas en el gate.
