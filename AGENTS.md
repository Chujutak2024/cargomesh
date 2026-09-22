# CargoMesh Agent Invariants & Governance Rules

Este archivo establece las directivas prioritarias que deben respetar todos los agentes (Antigravity, Codex, etc.) que trabajen en este repositorio.

## 1. 🗄️ Supabase Migrations vs. Scenario Seeds
- **NUNCA agregar datos de prueba (INSERTs de camiones, carriers o shippers de demo) en `supabase/migrations/`**.
  - `supabase/migrations/` es EXCLUSIVAMENTE para DDL estructural (`CREATE TABLE`, `ALTER TABLE`, `ADD COLUMN`, `INDEXES`, `RLS POLICIES`). Todo lo que esté aquí se ejecuta en producción remoto mediante `supabase db push`.
- **Todos los datos sintéticos de prueba/demo DEBEN ir en `supabase/scenarios/<scenario-name>/seed.sql`** o en `supabase/seed.sql`.

## 2. 🌐 Providers WebMCP & Honestidad Técnica
- Para declarar un carrier como proveedor WebMCP operativo, debe contar con:
  1. Su ruta `/providers/[carrierSlug]` en Next.js.
  2. Sus 5 tools registradas en `document.modelContext`.
  3. Sus fixtures de capacidad en `cargomesh/src/features/providers/provider-capability-fixtures.ts`.
  4. Sus tarifas de cotización en `quote-freight-tool.ts`.
- Cualquier carrier que solo exista en la base de datos se debe documentar como **"Dato de escenario / Roadmap"**, nunca como tool en vivo.
- En la evidencia pública actual, solo Andes, Inca y Pacific pueden declararse providers WebMCP live del demo al cumplir ruta, cinco tools, capacidad y tarifa ejecutables. Sus `providerUrl` son rutas del mismo origin Vercel de CargoMesh y no prueban providers alojados independientemente.
- Polaris, Apex y Velocity son datos de escenario / roadmap, no providers WebMCP live.
- `get_freight_request_recommendations` es una tool read-only separada del intake y nunca debe contarse como sexta tool provider.
- El Golden Flow, el booking Andes confirmado y el recovery Andes `REJECT` → Inca `CONFIRMED` tienen evidencia pública sanitizada en [`REL02_Public_WebMCP_UAT_Evidence.md`](docs/04-execution/REL02_Public_WebMCP_UAT_Evidence.md), incluidas las capturas 06 y 06b.

## 3. 🌿 Flujo de Ramas & Deadline de Entrega
- La entrega final es inminente (24-48 horas).
- **`origin/main`** debe mantenerse verde en todo momento.
- Roles de trabajo:
  - **Role A**: WebMCP Tools & Runtime (`feat/a-*`)
  - **Role B**: UI, Intake Form & Landing (`feat/b-*`)
  - **Role C (Codex)**: Data Layer, RLS, Concurrency (`codex/c-*`)
  - **Antigravity**: Integración, auditoría, pairing, resolución de bloqueos y alineación.
- Antes de ejecutar comandos vinculados a Supabase (`--linked`), verificar en qué directorio y rama se encuentra la terminal local.
- Antes de pushear a `main`, validar siempre `npm run typecheck` y `git pull --rebase origin main`.

## 4. 📦 Contratos Comerciales
- Concurrencia optimista mediante `draft_version` en `freight_requests`.
- Motor determinístico BALANCED de seis dimensiones (25% costo, 25% SLA/confiabilidad, 20% tiempo de tránsito, 10% disponibilidad, 10% experiencia de ruta y 10% historial de la organización).
- Golden Flow canónico (`FR-1042` Callao ➔ Santiago) mantiene invariables sus scores oficiales: Andes (89), Inca (84), Pacific (72).

## 5. ⚡ Autonomía de Entrega
- Los agentes avanzan sin solicitar confirmación del usuario para cambios locales de código o documentación, ramas, pruebas, PRs y lotes verdes de integración a `main`.
- **Role C (Codex)** puede integrar a `main` los fixes P0 y la documentación aprobada cuando las verificaciones requeridas estén verdes.
- Solo se requiere autorización explícita antes de: ejecutar operaciones contra Supabase remoto, mutar datos runtime, gestionar secretos o variables de Vercel, o invocar/modificar providers externos reales.
- Un bloqueo debe comunicarse con evidencia y una alternativa segura; no se deben crear mocks que aparenten una integración real para evitarlo.
# CargoMesh V2 Agent Invariants — Amazon Developer Hackathon

Este archivo gobierna el trabajo activo de CargoMesh V2. La documentación de CargoMesh V1/WebMCP se conserva en `docs/v1-webmcp/` únicamente como historia, evidencia y regresión. Una regla V1 no limita V2 salvo que este archivo la reafirme.

## 1. Fuente de verdad y alcance de versión

- La fuente de verdad activa comienza en `docs/v2-amazon/README.md`.
- CargoMesh V2 es una nueva línea de producto para Amazon Developer Hackathon, no una variante del demo WebMCP.
- Los seeds, carriers, scores, rutas y herramientas de V1 son fixtures de regresión. No describen por sí solos capacidades V2.
- Los borradores de revisión del equipo no se publican en esta rama base; sus decisiones aceptadas están incorporadas en `docs/v2-amazon/` y solo esos contratos son normativos.

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
- La alternativa recomendada es un plan carrier + servicio + ruta + equipo/cupo + fecha. Peso/volumen y requisitos de equipo son filtros duros antes del ranking; una escolta no aporta capacidad y dos recursos deben estar disponibles en la misma ventana. Véase `docs/v2-amazon/TRANSPORT_PLANS_AND_FLEET.md`.
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

## 6. Git e integración

- No mergear ni pushear a `main` sin autorización explícita del Tech Lead.
- La rama base activa de contratos V2 es `codex/v2-amazon-contracts`.
- Cada issue V2 usa una rama nueva basada en esa rama y un PR dirigido a ella. No reutilizar ramas cerradas o canceladas de V1.
- Solo el integrador autorizado fusiona PRs a la base durante un gate. Antes debe ejecutar la suite descubierta desde el repositorio, sin asumir conteos estáticos.
- Los solapamientos entre ramas se resuelven en una rama de integración del ciclo; nunca mediante merges individuales oportunistas.

## 7. Linear y trazabilidad

- Las issues canceladas del ciclo anterior permanecen canceladas como historia. No se reabren cambiando radicalmente su Definition of Done.
- Un alcance V2 nuevo recibe una issue nueva y enlaza la issue V1 que reemplaza cuando corresponda.
- Estados: `Backlog` definido; `In Progress` con trabajo iniciado; `In Review` con PR y verificaciones; `Done` solo tras integración y evidencia.
- Cada issue debe indicar versión (`V2`), objetivo, fuera de alcance, dependencias, contrato afectado, DoD verificable y evidencia.

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
