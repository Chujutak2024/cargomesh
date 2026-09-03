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
  3. Sus fixtures de capacidad en `frontend/src/features/providers/provider-capability-fixtures.ts`.
  4. Sus tarifas de cotización en `quote-freight-tool.ts`.
- Cualquier carrier que solo exista en la base de datos se debe documentar como **"Dato de escenario / Roadmap"**, nunca como tool en vivo.

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
