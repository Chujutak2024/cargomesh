# Plan de hitos y transición arquitectónica — CargoMesh V2

**Estado:** roadmap auditado; HITO 1 y seis issues de Sprint 1 (HAC-21…26) se actualizaron en Linear el 22 sep tras aprobación. Las correcciones futuras de Hitos 0/2–5 siguen pendientes.
**Track principal planificado:** Alexa+ mediante servidor MCP propio o experiencia simulada declarada, conforme a las [reglas oficiales](https://amazonappdev2026.devpost.com/rules).
**Mini challenges:** AWS Builder y Open Source solo con artefactos y evidencia propios. Bedrock es opcional.
**Base V2:** `codex/v2-amazon-contracts`. `main` no es el target de trabajo ni de entrega por defecto.
**Meta interna propuesta:** freeze 19 de octubre; **cierre oficial:** 23 de octubre de 2026, 12:00 PDT.

## 1. Qué está implementado y qué sigue siendo objetivo

CargoMesh V1/WebMCP se preserva como regresión. El PR #80 ya incorporó en la base V2 un endpoint `/mcp` local con cuatro tools, Hono y servicios reutilizables; esto **no** prueba identidad remota, uso real por Alexa+, discovery V2 ni ofertas live. Los contratos en `docs/v2-amazon/` describen el objetivo: carriers `0..N`, sedes separadas de cobertura, `ServiceArea` y `ServiceLane` dirigidas, capacidad por ventana, filtros físicos, rutas/planes, ofertas atribuibles y ranking versionado. El primer corte ejecutable puede ser ROAD; RAIL/SEA/AIR permanecen en la taxonomía hasta tener adaptadores, datos y pruebas.

`supabase/migrations/` recibe cambios estructurales y RLS, no datos sintéticos. Los escenarios V2 viven en `supabase/scenarios/v2-*/seed.sql`. No reescribir migraciones históricas aplicadas ni atribuir al V2 los tres carriers o puntajes FR-1042 de V1. Descubrir el número de pruebas al ejecutarlas; 160 pgTAP y 36 MCP son referencias antiguas, no criterios fijos.

Las fuentes normativas están en el repositorio: `docs/v2-amazon/README.md`, `DOMAIN_CONTRACTS.md`, `CARRIER_COVERAGE_AND_SERVICEABILITY.md`, `CARRIER_DISCOVERY_AND_RANKING.md` y `TRANSPORT_PLANS_AND_FLEET.md`.

## 2. Hito ↔ sprint ↔ entrega

Los **hitos** expresan resultados de producto y evidencia; los **sprints** son ventanas de trabajo; las **issues** asignan un resultado comprobable a una persona. Un hito no se cierra porque su descripción contenga casillas marcadas o un porcentaje visual. Cada issue tiene dueño, dependencia, rama si hay código, DoD y documento/evidencia; el Tech Lead cierra tras gate.

| Hito ya creado en Linear | Ciclo | Entrega demostrable y límite |
|---|---|---|
| HITO 0 · Gobernanza y baseline | Previo/Sprint 1 | Contratos V2 revisados, separación V1/V2 y decisión sobre PR #81/#82. Su descripción marca «completado», pero Linear reporta 0% y esos PR siguen abiertos: **estado real pendiente de verificación del gate**, no cierre automático. |
| HITO 1 · Cimientos V2 **corregido en Linear** | Sprint 1 · 19–25 sep (Lima) | HAC-21 mapping/esquema V2 ROAD y RLS; HAC-22 MCP seguro Alexa+ y Bedrock condicionado; HAC-23 QA; HAC-24 UI/prototipo; HAC-25 mapa piloto; HAC-26 gate. HAC-17/18 son soportes. Alexa live, Bedrock live y mapa externo se declaran solo con prueba real. |
| HITO 2 · MCP y elegibilidad | Sprint 2 · 26 sep–2 oct | Sobre la base del HITO 1: elegibilidad/capacidad física, servicios compartidos y conexión Alexa+ real si hay acceso, o simulación rotulada; Bedrock se continúa solo si aporta valor y existe cuota. HAC-11…16 son plan intermedio y se revisarán; **no** son compromisos V2 aprobados aquí. |
| HITO 3 · Intake, discovery y ofertas | Sprint 3 · 3–9 oct | Corte Web con servicios ROAD, candidatos trazables, oferta real solo si un carrier la emite, ranking por política versionada y mapa con fuentes. Sin fórmula 6D universal ni precio inventado. |
| HITO 4 · Experiencia dual y auditoría | Sprint 4 · 10–16 oct | E2E Web + Alexa+ **real si se conecta**, o simulación claramente rotulada según ruta de postulación elegida. Confirmación humana para booking, autorización y auditabilidad; no auto-reserva por umbral arbitrario. |
| HITO 5 · Hardening y envío | Sprint 5 · 17–23 oct | Freeze interno propuesto el 19, regresión, documentación de instalación/pruebas, benchmark, video <3 min y postulación antes del cierre oficial. Sprints 6/7 quedan fuera de la postulación. |

El alcance de Hitos 2–5 es dirección, no compromiso de branches ni issues futuras. La [ficha detallada de Sprint 1](./linear_sprint1_v2_rebase_proposal.md) registra IDs reales, dueños, fechas y evidencia esperada.

## 3. Correcciones necesarias en los hitos ya cargados en Linear

La corrección del HITO 1 y de la descripción del proyecto se aplicó el 22 sep. Las demás discrepancias siguen como auditoría para decisiones posteriores; no se modificó Sprint 2:

1. **Proyecto — aplicado / HITO 0 — pendiente:** la descripción del proyecto ya distingue 19 de octubre como freeze interno y 23 como cierre oficial, sin exigir «160 pgTAP» ni Alexa Skill como única vía. HITO 0 todavía tiene casillas `[X]` con progreso 0%; no declararlo terminado hasta verificar PRs y contratos.
2. **HITO 1 — aplicado:** target 25 sep Lima; cinco frentes con HAC-21…25 y gate HAC-26; sin «160 tests» fijo ni color supuesto como requisito del jurado. El manifiesto de seis ramas quedó en el hito y cada issue. La descripción antigua del objeto `Sprint 1` aún dice DRAFT/PENDING porque la conexión disponible no expone edición de ciclos; hito e issues contienen el objetivo vigente.
3. **HITO 2:** no pedir implementar `/mcp` desde cero ni afirmar que una ASK Skill conectada es obligatoria por las reglas. El límite seguro de identidad/transporte se inicia en Sprint 1; Sprint 2 lo consume para elegibilidad y, si el acceso Alexa+ está disponible, prueba conexión real. La [documentación Alexa+](https://developer.amazon.com/docs/alexaplus/add-ons/home.html) advierte acceso de socios selectos. `p95 <700 ms` es una **hipótesis/objetivo interno medible**, nunca garantía previa. Bedrock no es requisito del track.
4. **HITO 3:** sustituir «Balanced 6D» como verdad por `ScoringPolicy` versionada; distinguir oportunidad, estimación y `CarrierOffer` atribuible. El número de pasos del stepper, 50 variaciones de benchmark y modalidades son decisiones de diseño/dataset, no requisitos universales.
5. **HITO 4:** retirar la cotización ficticia de Andes por USD 3,200 y la autoaprobación de USD 5,000. Una oferta final exige fuente, vigencia y autorización; booking requiere confirmación humana y política corporativa explícita. El «Live MCP Inspector» solo se llama live si muestra eventos auténticos; de otro modo se rotula simulación. `409 STALE_DRAFT` aplica a mutación con versión obsoleta, no se inventa a partir de cualquier intento posterior a reservar.
6. **HITO 5:** eliminar conteos fijos 160/36 y el merge «final» automático a `main`: la postulación puede referenciar la rama/repo evaluable conforme a las reglas y una decisión de release separada. Ajustar el target de hito 20 de octubre si pretende representar envío oficial del 23; conservar el 19 como freeze interno. El video debe mostrar lo que realmente funciona, durar menos de tres minutos, estar disponible públicamente en YouTube/Vimeo y tener materiales en inglés o traducción inglesa conforme a las [reglas](https://amazonappdev2026.devpost.com/rules).

También separar en la descripción del proyecto «subasta inversa» como objetivo del marketplace de un flujo ya implementado. Los porcentajes de hito deben salir de issues aceptadas, no de seeds ni de checkboxes manuales.

## 4. Arquitectura incremental y dependencias

`FreightRequest` y preferencias del shipper alimentan el servicio de aplicación compartido. Ese servicio resuelve ubicación, área, lane y ruta; aplica filtros duros de carga/equipo/capacidad/permiso; produce planes con estado y procedencia; recibe ofertas atribuibles; y compara solo alternativas conocidas con `ScoringPolicy` versionada. Web y el canal MCP consumen el mismo resultado; Alexa no decide elegibilidad ni cambia el score.

- **Datos:** sede ≠ cobertura; A→B ≠ B→A; modo ≠ equipo; disponibilidad ≠ oferta; ausencia de dato ≠ elegibilidad.
- **Ruta y costo:** distancia, ETA, peajes, combustible y frontera indican fuente y estado `quoted/estimated/unknown`. No se simula autorización aduanera ni precio contractual.
- **Flota:** una escolta no suma capacidad; una carga indivisible no se reparte; varios recursos deben estar libres en toda la ventana.
- **Historial:** solo precarga datos de la organización autorizada; revalida precio, cupo, permisos y política antes de recomendar.
- **Alexa+:** una tool y una llamada se consideran live solo con identidad, transporte, código, pruebas y demo de esa integración; el MCP local de PR #80 es un punto de partida. Alexa+ → MCP CargoMesh → dominio; Bedrock es adaptador opcional de lenguaje natural, no conexión directa que determine scores.

## 5. Ramas por ciclo y responsabilidad

No crear ramas «por si acaso». En cada sprint se aprueba primero el manifiesto de issues: **una persona responsable por issue**, rama exacta si hay código y target `codex/v2-amazon-contracts`. Una core por integrante normalmente usa una rama; un enabler de evidencia no necesita otra. La rama de integración del ciclo se define en la issue de gate y solo el integrador autorizado la crea cuando hay PRs revisables. Una emergente que exija código añade su rama al manifiesto tras aprobar su issue; no se mezcla en la rama de otro miembro. Las ramas antiguas permanecen como historia, sin borrados precipitados. `main` y producción no se alteran para arreglar un preview.

El dueño de cada issue implementa, prueba y corrige sus propios defectos hasta `In Review`. Las dependencias entregan un contrato, no transfieren la responsabilidad de reparar la tarea del otro. Los compañeros revisan el PR **cuando esté listo**, no comparten una issue difusa de «trabajo conjunto». Gate-1 tiene dueño único (Tech Lead); pedir revisión no convierte a los revisores en co-responsables de implementación. Hitos futuros no preasignan nombres de rama antes de aprobar sus issues.

## 6. Documentación mínima por sprint

| Sprint | Documentación / evidencia que habilita el gate |
|---|---|
| 1 | Mapping entidad/tabla/RLS y migración; decisión de seguridad MCP/identidad Alexa y prueba Bedrock o bloqueo+fallback; escenario y matriz QA; guía de componentes, prototipo; ADR Google Maps/alternativa y mapa piloto; manifiesto y acta Gate-1. HAC-17/18 con comprobantes y evidencia auténtica de Kiro Crew desde esta semana. |
| 2 | Contratos de elegibilidad y capacidad, plan de identidad/seguridad MCP remoto, pruebas de protocolo/autorización, benchmark inicial con método y limitaciones. Se define al aprobar las nuevas issues; ignorar HAC-11…16 como compromisos vigentes. |
| 3 | Contratos de oportunidad/oferta y `ScoringPolicy`, procedencia de rutas/costos/mapa, pruebas E2E Web y dataset V2 reproducible. |
| 4 | Guion y evidencia E2E Web/Alexa o simulación declarada, política de confirmación/booking, auditoría de versiones, resultados p50/p95 y errores. |
| 5 | Guía de instalación y acceso para jueces, reporte de suites descubiertas, video y texto coherentes con el runtime, feedback de herramientas, AWS Builder/Open Source solo si se demuestran, friction logs materiales y comprobante de envío. |

El DoD de cada issue enumera su documento exacto y enlace; este cuadro no autoriza marcar una issue `Done` sin evidencia. Solo el Tech Lead cierra las issues aceptadas en el gate.
