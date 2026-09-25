# CargoMesh V2 Agent Invariants — Amazon Developer Hackathon

Este archivo gobierna el trabajo activo de CargoMesh V2. La documentación de CargoMesh V1/WebMCP se conserva en `docs/v1-webmcp/` únicamente como historia, evidencia y regresión. Una regla V1 no limita V2 salvo que este archivo la reafirme.

## 1. Fuente de verdad y alcance de versión

- La fuente de verdad activa comienza en `docs/v2-amazon/README.md`.
- CargoMesh V2 es una nueva línea de producto para Amazon Developer Hackathon, no una variante del demo WebMCP.
- Los seeds, carriers, scores, rutas y herramientas de V1 son fixtures de regresión. No describen por sí solos capacidades V2.
- Los borradores de revisión del equipo no se publican en esta rama base; sus decisiones aceptadas están incorporadas en `docs/v2-amazon/` y solo esos contratos son normativos.
- Las instrucciones V1 o de transición copiadas a un PR no recuperan autoridad por estar en `AGENTS.md`; cualquier cambio a este archivo debe eliminar contradicciones y pasar revisión explícita de gobernanza V2.

## 2. Base de datos y separación V1/V2

- `supabase/migrations/` acepta solo cambios estructurales o lógica persistente de producción. No agregar datos sintéticos de demo mediante `INSERT` de organizaciones, carriers, vehículos, sedes, rutas u ofertas.
- Los datos sintéticos V2 deben vivir en `supabase/scenarios/v2-*/seed.sql`. Los escenarios existentes de V1 permanecen identificados como V1 y no se presentan como catálogo V2.
- No modificar migraciones históricas ya aplicadas para borrar seeds V1. Documentar la excepción legacy y hacer la transición mediante migraciones aditivas o escenarios nuevos.
- Toda tabla V2 con datos de organización o carrier debe definir RLS, índices, restricciones y pruebas pgTAP proporcionales al riesgo.

## 3. Carriers, medios y discovery

- V2 admite `0..N` carriers y no contiene una lista fija de proveedores permitidos.
- Un carrier V2 puede responder mediante portal manual, API o MCP cuando exista integración real. WebMCP permanece como legado V1 y no es dependencia del flujo principal V2.
- La elegibilidad se calcula desde datos persistidos y versionados: áreas de recojo/entrega, lanes dirigidas, modos, capacidad por fecha, requisitos de carga, documentación y política comercial. La presencia de una sede no concede cobertura automática al país o provincia; un socio registrado puede servir una zona sin sede propia.
- La flota propia o capacidad contratada debe descontar reservas, mantenimiento y reposicionamiento antes de indicar disponibilidad; datos desconocidos no se convierten en cobertura o capacidad confirmada.
- La alternativa recomendada es un plan carrier + servicio + ruta + equipo/cupo + fecha. Peso/volumen y requisitos de equipo son filtros duros antes del ranking; una escolta no aporta capacidad y dos recursos deben estar disponibles en la misma ventana. Véase `docs/v2-amazon/contracts/TRANSPORT_PLANS_AND_FLEET.md`.
- Modos y equipos se separan: ROAD/RAIL/SEA/AIR no implican flota individual registrada ni integración live. Costo, permisos y frontera deben distinguir cotizado, estimado, pendiente y desconocido.
- ROAD, SEA, RAIL, AIR y combinaciones multimodales son capacidades; ningún modo se considera implementado sin adaptador, datos, pruebas y evidencia ejecutable.
- Andes, Inca y Pacific y el Golden Flow `FR-1042` quedan como regresión V1. No limitan el discovery V2 ni autorizan afirmar que otros carriers están operativos.
- La UI y la evidencia deben distinguir con precisión: fixture V1, escenario V2, integración simulada e integración live.

## 4. Contratos comerciales V2

- Toda creación reintentable usa idempotencia con clave y huella SHA-256 de un payload canónico.
- Toda mutación concurrente usa versión esperada; una versión obsoleta responde con un conflicto estable como `409 STALE_DRAFT`.
- CargoMesh no inventa una oferta final en nombre del carrier. Una `CarrierOffer` debe indicar su fuente, vigencia, moneda, desglose y evidencia de cálculo.
- El ranking es determinístico, versionado y explicable. Sus dimensiones y pesos pertenecen a una `ScoringPolicy`; no se codifican carriers ni scores especiales.
- La selección evalúa todos los servicios del universo soportado, aplica restricciones verificables y optimiza entre alternativas/ofertas conocidas según una política versionada. No excluye candidatos mediante una heurística opaca ni promete un óptimo sobre datos faltantes.
- La decisión final del shipper y toda autorización de booking deben quedar auditadas.
- Los envíos históricos solo precargan datos de la organización autorizada; no heredan cotización, capacidad ni permisos sin revalidación actual.

## 5. Alexa MCP, AWS y medición

- Alexa+ es un canal cliente del servidor MCP de CargoMesh. La lógica de dominio vive en servicios compartidos, no en prompts ni handlers de voz.
- Las tools MCP se agregan por contrato y capacidad implementada; no se declara una tool como disponible solo por aparecer en documentación.
- SSML, Progressive Response, Bedrock, AgentCore, Strands SDK u otros servicios AWS son adaptadores o aceleradores. Se usan cuando aportan valor medible y se documenta su integración.
- Las afirmaciones de reducción de tokens o latencia requieren benchmark reproducible con baseline, dataset, versión de schemas y métricas p50/p95.
- La evidencia para AWS Builder y Open Source debe separarse del producto principal y cumplir los requisitos propios de cada mini challenge.

## 6. Git, integración y despliegue

- `main` permanece congelada para este trabajo: no mergear, pushear ni abrir un PR de V2 hacia `main`. La aprobación de un PR o una suite verde no autoriza por sí sola a tocarla.
- La rama base activa de contratos V2 es `codex/v2-amazon-contracts`.
- Cada issue V2 con código declara su rama exacta y target PR en Linear **antes de crearla**; se basa en `codex/v2-amazon-contracts` y no reutiliza ramas cerradas o canceladas de V1. Un enabler sin código registra `No aplica` y no abre rama.
- El manifiesto de ramas se aprueba por ciclo: una core por integrante, una rama de integración definida en la issue de gate y ramas emergentes solo después de aprobar su issue. No abrir ramas auxiliares por conveniencia; PR #81/#82 son excepciones de gobernanza previas a esta regla, no una plantilla.
- Flujo por issue: el responsable culmina y entrega PR/evidencia; el integrador valida contra el DoD; el Tech Lead aprueba; solo entonces el integrador autorizado mergea a la base durante el gate. Un PR ya mergeado se registra como hecho consumado y se audita, nunca se mergea de nuevo.
- Antes de aprobar o mergear, ejecutar la suite pertinente descubierta desde el repositorio, sin asumir conteos estáticos. Si el gate detecta un defecto bajo puramente documental o de metadatos, el integrador puede corregirlo con diff y prueba visibles. Un defecto medio o alto vuelve al dueño de la issue para implementación, prueba y nueva revisión; no se traslada silenciosamente a otro integrante.
- Los solapamientos entre ramas se resuelven en una rama de integración del ciclo; nunca mediante merges individuales oportunistas.
- Los previews automáticos de Vercel no cambian la rama de producción. No cambiar `productionBranch`, `rootDirectory`, alias ni desplegar a producción como efecto colateral de un PR V2; una migración de `frontend/` a otro directorio requiere plan y aprobación de despliegue separados.

## 7. Linear y trazabilidad

- Las issues de implementación canceladas permanecen canceladas como historia. Un alcance V2 nuevo recibe una issue nueva y enlaza su antecedente V1; HAC-17 (créditos AWS) y HAC-18 (Drive) son soporte vigente que se verifica por su propia evidencia.
- El Sprint 1 actual puede contener nuevas issues V2 sin reciclar las canceladas. La planificación semanal sigue el modelo `1 core + 1 enabler + N emergentes` por integrante: el core técnico usa rama y PR; un enabler operativo puede cerrarse con evidencia sin rama.
- Cada issue tiene un único dueño, que implementa, prueba y corrige los defectos funcionales de su entrega. Otros integrantes entregan contratos dependientes o revisan al terminar; no se crea una issue «colaborativa» sin responsable. La única excepción de corrección por el integrador es la clase baja definida en la plantilla Linear; las clases media/alta regresan al dueño con evidencia y criterio de nueva validación.
- Estados: `Backlog` definido; `In Progress` con ejecución iniciada; `In Review` es la entrega del responsable (PR verificado para código o enlace/evidencia para soporte). Solo el Tech Lead valida el gate y mueve a `Done`; para código exige merge autorizado, pruebas y documentación.
- Cada issue V2 usa la [plantilla vigente](./docs/v2-amazon/delivery/LINEAR_ISSUE_TEMPLATE.md) y declara versión, tipo, objetivo, fuera de alcance, dependencias, contrato afectado, DoD verificable y evidencia. Las cantidades históricas de tests y la rama `codex/c-mcp-contracts` no son criterios V2.

## 8. Skills activas

| Dominio | Skill |
|---|---|
| Ramas, PRs, CI, gates e integración | `cargomesh-integrator` |
| Hono, Supabase, servicios, MCP y Alexa | `cargomesh-backend-architect` |
| Linear, coordinación y evidencias de hackathon | `cargomesh-team-coordinator` |
| Dominio, discovery, ofertas, ranking e invariantes | `cargomesh-governance-contracts` |
| Enrutamiento integral y cotejo de cierre | `cargomesh-orchestrator` |

## 9. Cierre y friction logs

- Antes de reportar una tarea completa, comparar archivos, pruebas y evidencia contra el DoD de la issue V2.
- Registrar un friction log cuando exista un bloqueo, incompatibilidad o workaround material del proyecto. Un error de consulta corregido inmediatamente no constituye por sí solo un incidente del producto.
- Mantener la copia local y la evidencia externa que exija la categoría del hackathon, sin exponer secretos ni datos personales.
