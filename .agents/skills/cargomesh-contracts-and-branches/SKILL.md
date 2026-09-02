---
name: cargomesh-contracts-and-branches
description: >-
  Protocolo estricto de gobernanza técnica de CargoMesh para Antigravity y Codex:
  diferenciación entre migraciones DDL y seeds de escenarios, flujo de ramas Git,
  contratos comerciales de flete, y reglas para providers WebMCP antes del deadline.
---

# CargoMesh Technical Governance & Contract Skill

Este skill define las reglas inviolables de arquitectura, base de datos, Git y contratos
para el proyecto **CargoMesh** (Google WebMCP Challenge 2026).

---

## 1. Regla de Oro de Base de Datos: Migraciones vs. Seeds

### ❌ Lo que NUNCA debe ir en `supabase/migrations/`:
- **Datos sintéticos de prueba:** Flotas de camiones con placas ficticias, carriers inventados, organizaciones de demo.
- **Inserciones masivas (`INSERT INTO public.vehicles`, `INSERT INTO public.carriers`, etc.).**
- **Motivo:** Todo archivo en `supabase/migrations/` es procesado por `npx supabase db push` directamente contra la base de datos de producción remota. Meter datos de prueba allí contamina producción y bloquea los pipelines CI/CD.

### ✅ Dónde van los datos de prueba y escenarios:
- **`supabase/scenarios/<scenario-name>/seed.sql`**: Para conjuntos de datos de prueba reproducibles (como `supabase/scenarios/d1/seed.sql` o `supabase/scenarios/expanded-fleet/seed.sql`).
- **`supabase/seed.sql`**: Únicamente para usuarios Auth demo y la organización canónica inicial (`ACME`).
- **`supabase/migrations/`**: EXCLUSIVAMENTE para DDL estructural (`CREATE TABLE`, `ALTER TABLE`, `ADD CONSTRAINT`, `CREATE INDEX`, `CREATE POLICY` de RLS).

---

## 2. Regla de Providers WebMCP y Honestidad Técnica

Antes de declarar un transportista como proveedor WebMCP en documentación o en la app:

1. **Host y Ruta:** Debe resolver a `/providers/[carrierSlug]` en Next.js.
2. **Tools Registradas:** Debe exponer las 5 tools del contrato en `document.modelContext`:
   - `check_service_coverage`
   - `check_capacity`
   - `quote_freight`
   - `book_freight`
   - `get_provider_booking_status`
3. **Fixtures de Capacidad:** Debe tener su entrada en `frontend/src/features/providers/provider-capability-fixtures.ts`.
4. **Tarifas y Cotización:** Debe contar con cálculo en `quote-freight-tool.ts`.

> **Directiva:** Si un carrier solo existe en la base de datos como fila de catálogo pero no tiene fixtures ni página probada, se debe catalogar honestamente como **"Dato de escenario / Roadmap"**, nunca como "Tool en vivo".

---

## 3. Flujo de Ramas y Trabajo en Equipo (A / B / C / Antigravity)

Con la entrega final fijada para mañana:

| Rol | Área de Responsabilidad | Convención de Ramas | Regla Crítica |
|---|---|---|---|
| **Role A** | WebMCP Tools & Runtime | `feat/a-*` | No tocar componentes visuales de B ni migraciones de C. |
| **Role B** | UI, Intake Form, Landing | `feat/b-*` | Mantener compatibilidad con ViewModels y 98/98 tests verdes. |
| **Role C (Codex)** | Capa de Datos, RLS, Concurrencia | `codex/c-*` o `feat/c-*` | Dueño de `supabase/migrations/` y contratos server-side. |
| **Antigravity** | Orquestación, Auditoría, Pairing | `main` / ramas específicas | Resolver bloqueos, sincronizar ramas, auditar coherencia global. |

### Protocolo de Commits y Pushes a `main`:
1. **Verificar estado de rama local:** Siempre revisar `git branch --show-current` antes de correr comandos vinculados a Supabase (`--linked`).
2. **Validar compilación:** Siempre ejecutar `npm run typecheck` o `npx tsc --noEmit` antes de integrar a `main`.
3. **Rebase limpio:** Siempre hacer `git pull --rebase origin main` antes de pushear para no crear bifurcaciones innecesarias en el historial.

---

## 4. Contratos Comerciales de Carga (Freight Contracts)

1. **Concurrencia Optimista:** `freight_requests.draft_version` se incrementa atómicamente en cada modificación. Si el cliente envía una versión obsoleta, el servidor rechaza con `STALE_DRAFT`.
2. **Motor BALANCED Determinístico:**
   - Score = Costo (25%) + SLA / Confiabilidad (25%) + Velocidad de Tránsito (20%) + Disponibilidad de Ventana (30%).
   - Para el Golden Flow (`FR-1042` en Callao ➔ Santiago), los scores oficiales son:
     - **Andes Express:** 89
     - **Transportes Inca:** 84
     - **Pacific Cargo:** 72
3. **Firma Criptográfica:** Toda oferta recibida desde un provider genera un SHA-256 inmutable en el Result Bridge (`carrier_offers`).
