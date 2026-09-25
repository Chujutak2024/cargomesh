# Sprint 1 V2 — propuesta de issues para Linear

**Estado:** aprobado y cargado en Linear el 22 de septiembre de 2026: HITO 1 corregido y HAC-21…26 creadas inicialmente en `Pendiente`; este texto conserva el plan inicial y las notas de avance indican el corte posterior. **Proyecto:** `P-HAC-1`. **Ciclo:** 19–25 septiembre 2026 (Lima). **Base Git:** `codex/v2-amazon-contracts`; ningún push a `main`.

## Objetivo real y corte del sprint

Al terminar Sprint 1 debe existir un **cimiento V2 integrado y comprobable**, no cinco auditorías sueltas: (1) modelo/mapping de datos multi-sede y servicios ROAD con migración/RLS; (2) MCP heredado de PR #80 adaptado a un límite seguro de identidad y transporte para Alexa+, más prueba Bedrock aislada si hay acceso; (3) sistema visual coherente y prototipo navegable del nuevo intake; (4) decisión de proveedor cartográfico con un mapa piloto que consuma un contrato de ruta y muestre fuente/estado; y (5) matriz QA transversal, escenario V2, suites y gate de integración. El corte habilita el Sprint 2; **no** promete aún marketplace, cotización de carriers, booking, optimización multimodal ni conexión Alexa+ en producción.

«Alexa conectada con Bedrock» no es una conexión directa obligatoria: el trayecto correcto es Alexa+ → MCP de CargoMesh → servicios de dominio; Bedrock es un adaptador opcional para lenguaje natural, nunca autoridad para score, elegibilidad u oferta. El track Alexa+ exige MCP self-hosted compatible con MCP 2025-11-25/Streamable HTTP o la ruta alternativa de simulación claramente declarada; Bedrock no es requisito. El equipo sí puede proponerse una prueba Bedrock este sprint. Si faltan créditos/cuota/acceso, la issue de Axel no se da por «Bedrock integrado»: registra prueba bloqueada, fallback SSML determinista y decisión con fecha para Sprint 2. El [reglamento oficial](https://amazonappdev2026.devpost.com/rules) admite Kiro Crew por sí solo para AWS Builder si su uso está documentado. Empezar **ahora**, no en el sprint final: cada dueño conserva evidencia de un uso real; Jean Paul organiza la carpeta y el gate verifica qué se puede declarar.

La [guía Alexa+ MCP](https://www.developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-quickstart.html) exige Streamable HTTP; la [página de acceso](https://developer.amazon.com/docs/alexaplus/add-ons/home.html) advierte disponibilidad para socios selectos. Por ello un servidor remoto probado y una conexión efectivamente invocada desde Alexa+ son evidencias distintas. El Tech Lead registra temprano acceso/no acceso y el camino de demo; no se finge que un test local sea Alexa live.

## Estado y distribución

Linear muestra HAC-17 y HAC-18 en `In Review`; HAC-5…10, HAC-19 y HAC-20 siguen `Canceled` como V1/intermedio. No se reabren ni se duplican. HAC-11…16 de Sprint 2 no se modificaron. Las referencias `S1-*` de abajo son alias de planificación; Linear asignó HAC-21…26 como indica la tabla. Cada persona tiene **una issue principal con resultado sustancial**; solo Cristhian añade el gate y Axel/Jean Paul conservan sus soportes ya abiertos. No imponer una segunda issue a Luis o Juan por simetría. Si aparece trabajo nuevo, registrar una emergente con dueño, capacidad y DoD antes de crear otra rama.

| Referencia | Dueño/rol | Principal o apoyo | Fecha límite propuesta | Resultado que desbloquea Sprint 2 |
|---|---|---|---|---|
| S1-C1 · HAC-21 | Cristhian · dominio/BD y validación de flujo | Principal | 24 sep | Mapping, esquema y contratos compartidos de datos V2 |
| S1-C2 · HAC-22 | Axel · Alexa MCP/AWS | Principal | 24 sep | Límite seguro MCP, prueba de transporte/identidad y decisión Bedrock |
| S1-C3 · HAC-23 | Jean Paul · QA y gestor de evidencia | Principal | 25 sep | Escenario V2, matriz de pruebas/CI y reporte de riesgos |
| S1-C4 · HAC-24 | Luis · frontend | Principal | 24 sep | Sistema visual refactorizado y prototipo navegable |
| S1-C5 · HAC-25 | Juan Antonio · mapa, tester y apoyo FE | Principal | 25 sep | Decisión cartográfica + mapa piloto + pruebas de uso |
| S1-E1 · HAC-26 | Cristhian · integrador autorizado | Apoyo/gate | 25 sep | Integración controlada y acta de aceptación |
| HAC-17 | Axel | Apoyo existente | 25 sep en Linear; gestión inmediata | Solicitud AWS comprobable, cuota/acceso separados |
| HAC-18 | Jean Paul | Apoyo existente | 21 sep en Linear | Drive con acceso/evidencia Kiro Crew y friction logs |

Fechas aprobadas y guardadas en Linear; el freeze técnico interno propuesto es 25 sep, no el cierre oficial del concurso (23 oct, 12:00 PDT). HAC-18 tenía vencimiento 21 sep y un comentario de Jean Paul con enlace/evidencia fechado el 20; permanece en `In Review` hasta verificación del Tech Lead. HAC-17 también permanece en `In Review` sin acuse visible en comentarios.

## Manifiesto de ramas — declarar en Linear antes de crearlas

| Issue planificada | Rama exacta propuesta | Target |
|---|---|---|
| S1-C1 | `feat/be2-v2-domain-db-mapping` | `codex/v2-amazon-contracts` |
| S1-C2 | `feat/be1-v2-alexa-mcp-security` | `codex/v2-amazon-contracts` |
| S1-C3 | `feat/be3-v2-qa-foundation` | `codex/v2-amazon-contracts` |
| S1-C4 | `feat/fe1-v2-design-system-prototype` | `codex/v2-amazon-contracts` |
| S1-C5 | `feat/fe2-v2-map-provider-poc` | `codex/v2-amazon-contracts` |
| S1-E1 | `feat/cycle-1-integration` | `codex/v2-amazon-contracts` |
| HAC-17/18 | No aplica: gestiones/evidencia, sin código | No aplica |

Las cinco ramas técnicas parten de la base, cada una enlazada a su issue. La sexta se crea **solo** al recibir PRs revisables. Solapamientos se resuelven en esa rama del ciclo; el dueño de cada PR corrige sus propios defectos antes de `In Review`. Revisión final no significa codeveloping de una issue ajena. PR #81/#82 son correcciones de gobernanza preexistentes, no modelo para abrir ramas espontáneas. No cambiar `main`, Vercel producción ni su rootDirectory desde estas issues.

## Fichas listas para Linear — usar los tres bloques de la plantilla

### S1-C1 — [BE-2] Modelar y aplicar la base de datos V2 para sedes y servicios ROAD

**Bloque A — metadatos.** V2 · P-HAC-1 · Sprint 1 · HITO 1 · `core`. Responsable: Cristhian Chujutalli (BD/flujo). Prioridad: High. Labels existentes: `backend`, `must-have`; tipo global `Feature`. Fecha límite propuesta: **2026-09-24** (Lima). Rama: `feat/be2-v2-domain-db-mapping`.

**Bloque B — contexto operativo.** Objetivo: entregar un mapping entidad→tabla→relación→política de acceso que permita registrar organizaciones, sedes de shipper, depots, servicios, áreas de recojo/entrega y lanes dirigidas sin heredar cobertura de una sede. Incluye inventario del esquema existente y delta V1/V2, diagrama/matriz de cardinalidades, Zod/tipos compartidos, migración aditiva ROAD con constraints/índices/RLS y flujo mínimo DRAFT→PENDING con idempotencia/`draft_version` **solo donde el contrato existente requiera adaptación**, sin duplicar el escritor V1. Publicar un contrato tipado de ubicación/servicio y estados `eligible/ineligible/unknown` para consumidores. Pruebas propias de migración, aislamiento organizacional, lane A→B no B→A y sede sin cobertura. Documento: `docs/v2-amazon/delivery/SPRINT1_DATA_MAPPING.md` o ADR enlazado, con matriz y decisiones.

Fuera de alcance: flota/calendario exhaustivos, scoring, booking, seeds en migraciones y convertir tres carriers V1 en catálogo V2. Depende de contratos V2 existentes; entrega temprano esquema/tipos a Axel, Jean Paul, Luis y Juan. Coordinar nombres/API con ellos, pero Cristhian implementa y corrige su PR. Antecedente HAC-6 cancelada: reemplazar; reutilizar solo idempotencia probada. Herramientas: Supabase CLI, pgTAP, Zod; descubrir comandos vigentes del repo.

DoD:
- [ ] Mapping cubre entidades, claves, cardinalidades, RLS, campos faltantes y decisiones para Sprint 2.
- [ ] Migración aditiva aplica en reset limpio sin datos sintéticos; constraints/RLS y pruebas negativas pasan.
- [ ] Contrato compartido de sedes/servicios/lanes es consumible sin hardcodear carrier y distingue desconocido de falso.
- [ ] Camino DRAFT→PENDING existente se preserva o se adapta con prueba de idempotencia/concurrencia si se toca.
- [ ] Documento, comandos/resultados, PR y riesgos se enlazan en la issue.

Checklist: contrato publicado → implementación propia → pruebas y correcciones propias → `In Review`.

**Bloque C — gobernanza y cierre.** PR desde rama declarada a base V2; nada a `main`. Sin despliegue de producción. En la issue: archivos/migración, reporte de reset/pgTAP/typecheck, limitaciones y friction log solo si material. Tech Lead mueve a `Done` únicamente después del gate y merge autorizado.

### S1-C2 — [BE-1] Asegurar el MCP V2 para Alexa+ y probar el adaptador Bedrock opcional

**Bloque A.** V2 · P-HAC-1 · Sprint 1 · HITO 1 · `core`. Axel Arista (MCP/Alexa). High. Labels existentes: `backend`, `must-have`; tipo `Feature`. Límite: **2026-09-24**. Rama: `feat/be1-v2-alexa-mcp-security`.

**Bloque B.** Objetivo: pasar del `/mcp` local mergeado por PR #80 a un límite de servicio remoto **seguro y verificable** para la ruta Alexa+, sin confundirlo con una conexión live ya otorgada. Incluye inventario de cuatro tools y remoción/aislamiento de dependencias WebMCP V1 del contrato visible V2, configuración de Streamable HTTP, decisión de identidad/autoridad por organización, autenticación/autorización por tool, manejo de secretos, errores y límites de payload; prueba con cliente MCP externo en entorno controlado. Define qué acceso Developer Console/partner falta para una llamada desde Alexa real. Incluye un adaptador Bedrock detrás de feature flag para narrar un resultado ya calculado: ejecutar una invocación de sandbox si existen crédito/cuota/credenciales, registrar costo y latencia; si no, dejar integración no declarada y SSML determinista como fallback probado. Documento: `docs/v2-amazon/delivery/SPRINT1_ALEXA_SECURITY_AND_BEDROCK.md` con diagrama de confianza, matriz live/local/bloqueado y decisión Sprint 2.

Fuera de alcance: que Bedrock calcule scores, prometer p95 <700 ms, ASK Skill obligatoria, booking por voz y publicar un endpoint abierto sin controles. Depende de contrato tipado S1-C1; se puede avanzar en auth/transporte con fixtures locales. HAC-5 cancelada se reemplaza; PR #80 aporta código, no DoD V2. HAC-17 gestiona crédito, no bloquea el control de seguridad. Herramientas: MCP SDK, Hono, tests de protocolo y, condicionalmente, AWS SDK/Bedrock; credenciales nunca en repo ni evidencia.

DoD:
- [ ] Transporte/protocolo 2025-11-25 y auth/autorización se prueban con casos válidos y negativos; tool de otra organización no filtra datos.
- [ ] Endpoint local/remoto de prueba está rotulado; llamada Alexa+ live solo si hay evidencia de invocación real.
- [ ] Bedrock sandbox call real con salida y costo/latencia **o** bloqueo documentado y fallback SSML probado; no se marca “integrado” por un mock.
- [ ] Tools V1 no se anuncian como discovery V2; los contratos de respuesta distinguen fuente y estado.
- [ ] Documento, amenazas, pruebas/comandos y PR están enlazados.

Checklist: matriz de acceso → hardening propio → prueba de cliente/Bedrock o bloqueo → revisión del propio PR → `In Review`.

**Bloque C.** PR a base V2 desde la rama declarada. Preview/URL de prueba no cambia Vercel producción. Resumen identifica exactamente local, remoto, Alexa live, simulado y Bedrock real/no disponible; friction log si el acceso de partner o cuota bloquea materialmente. Tech Lead valida y cierra tras gate.

### S1-C3 — [BE-3] Construir la base QA V2 y certificar el corte transversal del sprint

**Bloque A.** V2 · P-HAC-1 · Sprint 1 · HITO 1 · `core`. JEAN PAUL (QA/gestor). High. Labels existentes: `audit`, `must-have`; tipo `Feature`. Límite: **2026-09-25**. Rama: `feat/be3-v2-qa-foundation`.

**Bloque B.** Objetivo: hacer reproducible y medible el corte V2, no contar tests V1 como prueba del producto nuevo. Incluye escenario `supabase/scenarios/v2-road-baseline/` con seed/cleanup/verify y README de procedencia sintética; matriz trazable contrato→caso→comando→resultado para RLS, lanes, identidad MCP, idempotencia, estados desconocidos y UI/mapa; pgTAP/integración para la BD de S1-C1 y tests MCP negativos sobre interfaz de S1-C2; smoke de build/preview y lista de defectos por dueño. Reporte de QA previsto en `docs/v2-amazon/delivery/SPRINT1_QA_MATRIX.md`. Preparar gates CI reproducibles sin cantidades fijas.

Fuera de alcance: implementar código de Axel/Luis/Juan o reparar sus PR; QA devuelve defectos al dueño. Depende de interfaces tempranas de C1/C2/C4/C5, pero puede preparar escenario y matriz en paralelo. HAC-7 cancelada: reemplazar MCDA 6D por cobertura V2. HAC-18 cubre Drive/evidencias, no pruebas. Herramientas: Supabase/pgTAP, runner MCP y scripts reales del repositorio.

DoD:
- [ ] Escenario V2 carga y limpia sin mezclarse con migraciones ni fixtures FR-1042.
- [ ] Casos negativos RLS, sede sin cobertura, lane inversa y MCP no autorizado son reproducibles; casos FE/mapa tienen observación o prueba definida.
- [ ] Matriz reporta pass/fail/bloqueado y propietario del defecto con comandos exactos; no exige 160/36 pruebas heredadas.
- [ ] CI o comandos locales ejecutables se documentan; fallos no se maquillan como verde.
- [ ] PR, README, matriz y resumen de riesgos enlazados.

Checklist: matriz → fixtures/tests propios → ejecución → defectos a sus dueños → `In Review`.

**Bloque C.** PR a base V2; no despliegue prod. QA no mueve a `Done` tareas ajenas; Tech Lead valida su issue con escenario, pruebas y evidencia en Gate-1.

### S1-C4 — [FE-1] Estandarizar la interfaz V2 y entregar prototipo navegable del intake

**Bloque A.** V2 · P-HAC-1 · Sprint 1 · HITO 1 · `core`. Luis (frontend). High. Labels existentes: `frontend`, `must-have`; tipo `Feature`. Límite: **2026-09-24**. Rama: `feat/fe1-v2-design-system-prototype`.

**Bloque B.** Objetivo: reutilizar coherentemente identidad visual y patrones útiles de V1, corrigiendo duplicados e inconsistencias, y validar la nueva experiencia V2 antes del stepper conectado del Sprint 2/3. Incluye inventario de botones, inputs, selects, badges, modals, estados de error/carga, colores/tipografía/espaciado; tokens y componentes accesibles/responsivos; migración de las pantallas objetivo sin cambiar toda la aplicación; prototipo navegable Dashboard→solicitud (sede/ubicación, carga/peso/volumen/tipo, fecha, preferencia de equipo, resumen) con sugerencias provisionales y estados `unknown`. Entregar guía de diseño, flujo/capturas y decisión de qué se conserva/reemplaza en `docs/v2-amazon/delivery/SPRINT1_UI_PROTOTYPE.md` o link estable.

Fuera de alcance: submit real, ofertas y ranking operativos, automatización WebMCP o refactor global cosmético. Consume tipos provisionales de C1 y consulta estados de mapa a C5; no espera a que la DB esté terminada para prototipar. HAC-8/HAC-19 canceladas: reutilizar estilo si sigue válido, no sus DoD. Herramientas: componentes/tokens del repo y herramienta de prototipado que use el equipo; no se presupone Figma.

DoD:
- [ ] Inventario y matriz reutilizar/reemplazar con ejemplos antes/después para botones, inputs, modals, colores y estados.
- [ ] Componentes objetivos no duplican reglas visuales, cubren foco/teclado/errores y se verifican en anchos móvil/escritorio.
- [ ] Prototipo navegable muestra pasos y datos V2, diferencia preliminar/desconocido/confirmado y obtiene feedback del equipo.
- [ ] Build/typecheck y revisión visual pertinentes quedan evidenciados; no se presenta prototipo como flujo transaccional live.
- [ ] Guía/flujo, PR, screenshots y decisiones pendientes enlazadas.

Checklist: auditoría visual → tokens/componentes → prototipo → validación y corrección propia → `In Review`.

**Bloque C.** PR a base V2 desde rama declarada. Preview no autoriza alterar rootDirectory de Vercel ni producción. Tech Lead valida DoD, revisión FE y gate antes de `Done`.

### S1-C5 — [FE-2] Seleccionar proveedor cartográfico e integrar un mapa piloto de rutas V2

**Bloque A.** V2 · P-HAC-1 · Sprint 1 · HITO 1 · `core`. Juan Antonio Coronado Palacios (mapa, tester y apoyo FE). High. Labels existentes: `frontend`, `audit`; tipo `Feature`. Límite: **2026-09-25**. Rama: `feat/fe2-v2-map-provider-poc`.

**Bloque B.** Objetivo: decidir Google Maps frente a una alternativa viable y demostrar el contrato mínimo de mapa que consumirá el discovery V2. Incluye comparación documentada de licencia, costo/cuota, geocodificación/rutas ROAD, cobertura, latencia, gestión de API key y límites de uso; decisión con riesgo y fallback. Implementar un adaptador aislado con mapa piloto que pinte origen/destino, ruta/corredor y estado/fuente de distancia/ETA para escenario V2, sin inferir cobertura carrier por cercanía. Si hay API key autorizada, probar la consulta real con key restringida; si no, separar mapa renderizado con dato sintético de integración externa pendiente. Probar interacción/teclado/responsividad y entregar observaciones a Luis como revisión, no reparar su issue. Documento previsto: `docs/v2-amazon/delivery/SPRINT1_MAP_PROVIDER_DECISION.md` con matriz y evidencia.

Fuera de alcance: mapa multimodal live, peajes/permisos o aduanas confirmados, optimizador, tarifas de carrier y hardcodear una única API en dominio. Consume tipo de ruta/área de C1 y estilo de C4; puede investigar proveedor desde el día uno. HAC-9/HAC-20 canceladas: reemplazar, no reclamar su progreso. Herramientas: proveedor seleccionado/SDK oficial y pruebas FE; estimaciones llevan fuente/fecha.

DoD:
- [ ] Comparativa Google Maps vs al menos una opción alternativa y ADR con costos/cuotas/seguridad/fallback.
- [ ] Mapa piloto renderiza escenario V2 y distingue ruta estimada, ausencia de dato y servicio carrier no confirmado.
- [ ] Key no queda en código, screenshots o logs; si falta acceso, integración real queda `pendiente` y no se declara live.
- [ ] Smoke de UI móvil/escritorio/teclado, build/typecheck y evidencia de proveedor o bloqueo.
- [ ] PR, ADR, capturas y hallazgos para Luis/QA enlazados.

Checklist: investigación → contrato/adaptador → mapa piloto → test propio → `In Review`.

**Bloque C.** PR a base V2; ningún cambio de Vercel prod. Tech Lead verifica seguridad de key, evidencia y gate antes de `Done`.

### S1-E1 — [GATE-1] Integrar y aceptar el cimiento V2 del Sprint 1

**Bloque A.** V2 · P-HAC-1 · Sprint 1 · HITO 1 · `enabler`. Cristhian (integrador autorizado/Tech Lead). High. Labels existentes: `integration-gate`, `must-have`; tipo `Improvement`. Límite: **2026-09-25**. Rama condicional: `feat/cycle-1-integration`.

**Bloque B.** Objetivo: evitar cinco PRs aislados. Incluye aprobar manifiesto issue→rama al inicio, acordar superficies compartidas, revisar PRs **terminados**, integrar en rama de ciclo solo los aceptables, ejecutar reset/pgTAP/MCP/build/typecheck/preview según scripts descubiertos, registrar dependencia/bloqueo y decisión de demo Alexa/Bedrock/Kiro Crew. Documento: `docs/v2-amazon/delivery/SPRINT1_GATE_V2.md` con matriz issue→PR→test→evidencia→estado. PR #81/#82 ya fueron mergeados y se auditan sin repetición; igual ocurre con PR #83/#85. Fuera: reparar defectos funcionales medios/altos de otras issues, push a `main`, producción y declarar HITO 1 completo con una sola prueba. El integrador puede resolver solo hallazgos bajos no semánticos con evidencia, según [la escala](./LINEAR_ISSUE_TEMPLATE.md#flujo-de-aceptación-y-escala-de-hallazgos). Depende de C1…C5, HAC-17/18 para su evidencia particular. HAC-10 cancelada se reemplaza.

DoD:
- [ ] Manifiesto aprobado antes de crear ramas; PRs y dependencias trazables.
- [ ] Integración de entregas aceptadas con comandos/resultados reales, fallos y responsable visibles.
- [ ] HITO 1 describe correctamente lo entregado y lo diferido; decisión Alexa real/simulado y Bedrock real/bloqueado documentada.
- [ ] Cada issue se acepta/rechaza individualmente por DoD; no se marca `Done` por estar en el ciclo.
- [ ] Acta y friction logs materiales enlazados.

Checklist: manifiesto → PRs listos → gate → acta → cierre individual autorizado.

**Bloque C.** Abrir rama de integración solo al existir PRs revisables, PR a base V2, sin auto-close de HAC. Un fallo de Vercel preview se trata como incidencia separada. Solo Tech Lead fusiona y mueve a `Done` cada issue aceptada.

### HAC-17 existente — [BE-1] Solicitar créditos AWS

**Bloque A.** V2 · P-HAC-1 · Sprint 1 · HITO 1 · `enabler existente`. Axel. Urgent. Label existente `Request`. Fecha ya cargada: **2026-09-25**. Rama: No aplica.

**Bloque B.** Corregir la descripción sin reabrir ni duplicar: comprobar formulario/plazo oficiales, enviar solicitud, guardar acuse y estado de cuota Bedrock. La solicitud no equivale a créditos aprobados ni a Bedrock ejecutado; esa prueba pertenece a C2. Fuera: prometer disponibilidad inmediata. Dependencia: C2 consume el resultado, pero progresa en auth/SSML aunque los créditos no lleguen. DoD: comprobante con fecha y destinatario, responsable de seguimiento y acceso seguro; si se rechaza, evidencia y alternativa explícita.

**Bloque C.** Sin PR, sin secretos en Drive. Está `In Review`; Tech Lead comprueba acuse y decide `Done`. La cuota pendiente queda como riesgo separado.

### HAC-18 existente — [OPS] Organizar Drive y evidencia de construcción

**Bloque A.** V2 · P-HAC-1 · Sprint 1 · HITO 1 · `enabler existente`. JEAN PAUL. High. Label existente `management`. Fecha ya cargada: **2026-09-21**. Rama: No aplica.

**Bloque B.** Corregir la descripción: carpeta accesible al equipo con índice por issue/PR, Kiro Crew, AWS/Bedrock, demo, QA y friction logs; permisos verificados y sin datos sensibles. Cada responsable aporta evidencia de uso real de Kiro Crew desde Sprint 1; Jean Paul clasifica, no inventa logs. Fuera: que una carpeta vacía pruebe uso de AWS. DoD: URL/acceso probado, estructura e índice, muestra de evidencia auténtica con fecha/autor/resultado y regla de redacción de secretos.

**Bloque C.** Sin PR. `In Review` solo con enlace funcional; Tech Lead verifica y mueve a `Done`. Si aún no se logra, registrar vencimiento/replanificación.

## Dependencias, cierre y carga

Secuencia crítica: C1 publica tipos tempranos → C2/C3/C4/C5 los consumen; C4 y C5 acuerdan sólo el contrato visual del mapa; C3 prueba negativos a medida que llegan los PRs; E1 integra **después** de validación y aprobación. Cada dueño repara sus errores funcionales medios/altos; el integrador puede corregir únicamente hallazgos bajos no semánticos con trazabilidad. El DoD de cada issue exige documento/evidencia exacta, comandos y PR cuando aplica. `Backlog` al crear, `In Progress` al comenzar, `In Review` con entregable listo, `Done` solo tras gate/merge autorizado o verificación de soporte.

**Corte de avance 22 sep:** PR #83 de HAC-21 y PR #85 de HAC-22 ya están mergeados en la base V2. HAC-21 figura `Done`; HAC-22 todavía no debe tratarse como aceptada ni Alexa+ live solo por el merge. El esquema ROAD de HAC-21 no incluyó `mcp_account_links` ni tools comerciales V2: son pendientes reales del canal MCP y requieren definición/propietario antes de declararlos desbloqueados. PR #81/#82 también están mergeados. HAC-23…25 y el gate HAC-26 conservan entregables pendientes; HAC-17/18 permanecen `In Review` hasta verificación de sus evidencias.

**Carga aplicada el 22 sep:** HITO 1 ahora incluye **Alexa MCP segura + experimento Bedrock condicionado + mapa piloto** y conserva target 25 sep. Se crearon HAC-21…26 con ciclo, hito, dueño, due date, labels existentes, rama en descripción, bloques A/B/C y relaciones. Se corrigieron HAC-17/18 sin duplicarlas ni alterar sus estados; las canceladas siguen históricas. El proyecto distingue freeze del 19 oct y cierre oficial del 23 oct. Sprint 2 quedó intacto. `v2`/`core`/`enabler` no se crearon como labels; el tipo consta en cada descripción. **Pendiente de UI/operación separada:** la descripción antigua del objeto `Sprint 1` en Linear todavía menciona DRAFT/PENDING; el conector disponible permite listar ciclos pero no editar esa descripción. El HITO 1 y las issues contienen el objetivo aprobado.
