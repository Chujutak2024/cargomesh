# CargoMesh V2 — Protocolo Estricto de Revisión Técnica de Código (PR Review Guidelines)
## Amazon Developer Hackathon (Track Alexa+)

Este documento establece las **reglas no negociables de revisión técnica y control de calidad (Quality Gate)** que Cristhian Chujutalli (BE-2 & Tech Lead) y Antigravity aplican rigurosamente antes de aprobar y fusionar cualquier Pull Request hacia la rama base `codex/c-mcp-contracts`.

Cualquier PR que viole una sola de estas reglas será **RECHAZADO con bloqueo (Request Changes)** sin excepción.

---

## 🏛️ 1. Invariantes de Gobernanza Git & Ramas

1. **Rama Base Sagrada:**
   - Todo PR debe tener como base exclusivamente `codex/c-mcp-contracts`.
   - ⛔ **PROHIBIDO TERMINANTEMENTE:** Crear ramas desde `main`, hacer merge hacia `main` o rebasar contra `main`.
2. **Convención de Ramas por Rol:**
   - BE-1 (Alexa / MCP / AWS): `feat/be1-hac-*`
   - BE-2 (Core / APIs / Services / DB): `feat/be2-hac-*`
   - BE-3 (CI / QA / Runner / Automation): `feat/be3-hac-*`
   - FE-1 (Shipper UI / Intake / Tokens): `feat/fe1-hac-*`
   - FE-2 (WebMCP / Carrier Surface / Audit): `feat/fe2-hac-*`
3. **Trazabilidad con Linear:**
   - Cada commit y el cuerpo del PR deben declarar explícitamente `Part of HAC-X` o `Closes HAC-X`.
4. **Higiene de Repositorio:**
   - ⛔ **Cero archivos residuales:** No se permiten archivos temporales, dumps, videos, caches (`.pnpm-store/`), notas personales ni `package-lock.json` huérfanos.

---

## 🗄️ 2. Invariantes de Base de Datos (PostgreSQL & Supabase Local)

1. **Regla de Oro: DDL vs Seeds:**
   - `supabase/migrations/` es **EXCLUSIVAMENTE para DDL estructural** (`CREATE TABLE`, `ALTER TABLE`, `CREATE INDEX`, `CREATE POLICY`, `CREATE TRIGGER`, `CREATE FUNCTION`).
   - ⛔ **NUNCA agregar datos de prueba o demo (`INSERT INTO vehicles`, `carriers`, `shippers`) en `supabase/migrations/`**.
   - Los datos sintéticos o de prueba van en `supabase/seed.sql` o `supabase/scenarios/<scenario-name>/seed.sql`.
2. **RLS Obligatorio (Row Level Security):**
   - Toda tabla pública nueva o modificada debe tener `ENABLE ROW LEVEL SECURITY`.
   - Se debe verificar que ninguna política permita lectura/escritura anónima sin autenticación.
3. **Suite pgTAP Intocable y Aditiva:**
   - Las 147 aserciones base de pgTAP (tests 01 al 07) están **congeladas**. Está prohibido modificarlas para "hacer pasar" un cambio.
   - Nuevas migraciones deben añadir su suite correspondiente (ej. `08_*.test.sql`).
   - `npx supabase test db` debe pasar al 100% en verde antes de aprobar.
4. **Concurrencia Optimista & Recibos Inmutables:**
   - Mutaciones en `freight_requests` deben exigir y verificar `draft_version` e incrementarlo en `+1`.
   - Los recibos de creación (`creation_idempotency_key`, `creation_payload_hash`) deben estar custodiados por constraints y triggers inmutables (`guard_freight_creation_receipt`).

---

## ⚡ 3. Invariantes de Arquitectura Backend (Hono V2 & Shared Services)

1. **Separación Estricta: Rutas vs Servicios:**
   - Las rutas Hono (`src/server/hono/routes/`) **NO contienen lógica de negocio ni llamadas directas a base de datos**.
   - Las rutas solo realizan: (1) Validación Zod, (2) Invocación de 1 función de servicio, (3) Serialización del sobre estándar de respuesta.
2. **Única Fuente de Verdad:**
   - Los casos de uso viven en `src/server/services/`. La misma función de servicio debe ser consumible tanto por las rutas Hono como por las tools MCP de Alexa.
3. **Aislamiento de Módulo (`server-only`):**
   - Las políticas y funciones puras de dominio (`*-policy.ts`) **NO deben importar `server-only`**, permitiendo que sean testeadas rápidamente con `tsx --test` sin emuladores de Next.js.
   - El archivo runtime (`*-server.ts`) encapsula `server-only` y las dependencias reales de Supabase.
4. **Sobre de Respuesta Estándar:**
   - Éxito: `{ ok: true, data: T }` con código HTTP 200 o 201.
   - Error: `{ ok: false, error: { code: string, message: string } }` con códigos HTTP mapeados:
     - `INVALID_ARGUMENT` / Validación: 400
     - `UNAUTHENTICATED`: 401
     - `FORBIDDEN`: 403
     - `NOT_FOUND`: 404
     - `STALE_DRAFT` / `IDEMPOTENCY_CONFLICT`: 409
     - `INVALID_DRAFT` / `INVALID_INPUT`: 422
     - Errores inesperados: 500
5. **Esquemas Zod Centralizados:**
   - Todos los esquemas públicos de entrada residen en `src/shared/schemas/` y son inmutables.

---

## 🌐 4. Honestidad Técnica & Providers WebMCP

1. **Condición de Carrier Live:**
   - Para que un carrier sea documentado o ejecutado como WebMCP en vivo, debe contar con:
     1. Ruta `/providers/[carrierSlug]`.
     2. Las 5 tools registradas en `document.modelContext` (`check_service_coverage`, `check_capacity`, `quote_freight`, `book_freight`, `get_provider_booking_status`).
     3. Fixtures de capacidad en `provider-capability-fixtures.ts`.
     4. Cálculo tarifario en `quote-freight-tool.ts`.
2. **Estatus de Carriers:**
   - Solo **Andes Express, Transportes Inca y Pacific Cargo** son WebMCP live.
   - **Polaris, Apex y Velocity** son estrictamente "Dato de escenario / Roadmap".
   - ⛔ **Cero Mocks Engañosos:** Queda prohibido crear mocks simulados que aparenten integraciones reales con carriers externos.

---

## 🧪 5. Quality Gate de Compilación y Pruebas

Antes de estampar la firma de aprobación (Approved):
1. **Compilación TypeScript:**
   - `pnpm typecheck` (`tsc --noEmit`) con **0 errores**.
   - Prohibido el uso de `any` para silenciar errores de tipos.
2. **Pruebas Automatizadas:**
   - Toda nueva funcionalidad debe incluir su archivo de prueba unitario (`*.test.ts`).
   - `pnpm test:release` debe correr al 100% en verde.
3. **Verificación Local Obligatoria:**
   - No se aprueba código que solo funcione en teoría; el revisor debe verificar la ejecución de comandos locales.

---

## 📋 Checklist Rápido del Revisor (Template de Aprobación)

```markdown
### 🛡️ CargoMesh PR Review Checklist
- [ ] **Git:** Rama base `codex/c-mcp-contracts` (no `main`), commit trazable con ticket HAC-X.
- [ ] **DB:** Sin datos sintéticos en migraciones; pgTAP pasando al 100%; RLS activo.
- [ ] **Arquitectura:** Lógica en `services/`, rutas Hono limpias con sobre `{ ok, data }`.
- [ ] **Concurrencia:** `draft_version` respetado y manejado con `STALE_DRAFT`.
- [ ] **WebMCP:** Respeto estricto a las 5 tools y honestidad de carriers.
- [ ] **Tests & Types:** `pnpm typecheck` limpio (0 errores) y tests pasando en verde.
```
