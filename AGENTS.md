# CargoMesh Agent Invariants & Governance Rules (V2 — Amazon Developer Hackathon)

Este archivo establece las directivas prioritarias que deben respetar todos los agentes (Antigravity, Codex, etc.) que trabajen en este repositorio.

---

## 1. 🗄️ Supabase Migrations vs. Scenario Seeds
- **NUNCA agregar datos de prueba (INSERTs de camiones, carriers o shippers de demo) en `supabase/migrations/`**.
  - `supabase/migrations/` es EXCLUSIVAMENTE para DDL estructural (`CREATE TABLE`, `ALTER TABLE`, `ADD COLUMN`, `INDEXES`, `RLS POLICIES`). Todo lo que esté aquí se ejecuta en producción remoto mediante `supabase db push`.
- **Todos los datos sintéticos de prueba/demo DEBEN ir en `supabase/scenarios/<scenario-name>/seed.sql`** o en `supabase/seed.sql`.

---

## 2. 🌐 Providers WebMCP & Honestidad Técnica
- Para declarar un carrier como proveedor WebMCP operativo, debe contar con:
  1. Su ruta `/providers/[carrierSlug]` en Next.js.
  2. Sus 5 tools registradas en `document.modelContext`.
  3. Sus fixtures de capacidad en `cargomesh/src/features/providers/provider-capability-fixtures.ts`.
  4. Sus tarifas de cotización en `quote-freight-tool.ts`.
- Cualquier carrier que solo exista en la base de datos se debe documentar como **"Dato de escenario / Roadmap"**, nunca como tool en vivo.
- En la evidencia pública actual, solo **Andes, Inca y Pacific** pueden declararse providers WebMCP live del demo al cumplir ruta, cinco tools, capacidad y tarifa ejecutables.
- Polaris, Apex y Velocity son datos de escenario / roadmap, no providers WebMCP live.
- `get_freight_request_recommendations` es una tool read-only separada del intake y nunca debe contarse como sexta tool provider.

---

## 3. 🌿 Flujo de Ramas & Gobernanza de Integración (Amazon Hackathon 2026)
- **🛑 PROHIBIDO MERGEAR O PUSHEAR A `main`:**
  - La rama `main` está CONGELADA y protegida por la evaluación en vivo del jurado anterior hasta el 22 de Septiembre a las 23:59.
  - La rama base oficial para TODO el desarrollo del Hackathon Alexa es **`codex/c-mcp-contracts`**.
- **🔒 Control Estricto de Merges:**
  - Ningún desarrollador ni agente puede mergear PRs individuales por su cuenta a la rama base.
  - Los merges a `codex/c-mcp-contracts` están reservados **EXCLUSIVAMENTE a personas autorizadas** (Tech Lead / Integrador de ciclo) durante las sesiones oficiales de integración (ej. Gate-1).
  - La integración sincrónica se realiza en ramas de ciclo (ej. `feat/cycle-1-integration`), donde se corren las pruebas de humo duales y la verificación completa antes de tocar la base.
- **Roles y Ramas del Equipo:**
  - **Cristhian (BE-2 & Tech Lead):** `feat/be2-hac-6-draft-idempotency` | `feat/cycle-1-integration`
  - **Axel (BE-1 / Alexa & Cloud Lead):** `feat/be1-hac-5-alexa-skill-base`
  - **Jean Paul (BE-3 / CI & QA Lead):** `feat/be3-hac-7-ci-baseline-runner`
  - **Luis (FE-1 / Shipper UI Lead):** `feat/fe1-hac-19-design-tokens-components` | `feat/fe1-hac-8-intake-stepper-hono`
  - **Juan Antonio (FE-2 / Carrier Surface):** `feat/fe2-hac-9-carrier-tools-audit`

---

## 4. 📦 Contratos Comerciales de Carga
- Concurrencia optimista estricta mediante `draft_version` en `freight_requests`. Toda mutación requiere `expected_draft_version`; desajustes responden con `409 STALE_DRAFT`.
- Deduplicación criptográfica obligatoria con `creation_idempotency_key` y hash SHA-256 (`creation_payload_hash`).
- Motor determinístico BALANCED de 6 dimensiones (25% costo, 25% SLA/confiabilidad, 20% tránsito, 10% disponibilidad, 10% experiencia de ruta y 10% historial).
- Golden Flow canónico (`FR-1042` Callao ➔ Santiago): Andes Express (89), Transportes Inca (84), Pacific Cargo (72).

---

## 5. 🤖 Orquestación Autónoma de Skills y Ejecución

Los agentes en este repositorio deben operar de forma **autónoma e inteligente**, deduciendo la skill requerida según el requerimiento del usuario sin necesidad de solicitarle confirmación de qué skill emplear:

| Dominio del Requerimiento | Skill que el Agente Activa Automáticamente |
|---|---|
| Ramas, PRs, `gh` CLI, dry-runs de merge, CI de release, Gate-1 | **`cargomesh-integrator`** |
| Hono V2, validación Zod, sobre `{ ok, data }`, Supabase, pgTAP, endpoint `/mcp`, Alexa SSML | **`cargomesh-backend-architect`** |
| Linear, gestión de sprints, plantillas de issues, auditoría de PRs, evidencias Drive, video demo | **`cargomesh-team-coordinator`** |
| Contratos comerciales, concurrencia `draft_version`, idempotencia SHA-256, reglas WebMCP | **`cargomesh-governance-contracts`** |
| Ejecución integral, verificación cruzada vs Issue y registro de incidencias | **`cargomesh-orchestrator`** |

### Protocolo de Cierre y Verificación del Orquestador:
1. **Comparación contra la Issue:** Antes de reportar como completada una tarea, el agente debe comparar el **Resumen de lo Elaborado** contra los criterios de aceptación y el checklist de la issue en Linear.
2. **Registro Obligatorio de Fallas (Friction Logs):** Si durante la ejecución ocurre cualquier bloqueo, error de configuración, fallo de tooling o workaround:
   - **En Drive:** Registrar el incidente en `02_Friction_Logs_Borradores/FL-XX.md` para el bono del 10% del jurado.
   - **En Local:** Registrar el incidente en `docs/04-execution/friction-logs/FL-XX.md` para el seguimiento interno del equipo.
