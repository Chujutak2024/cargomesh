# Testing Strategy — CargoMesh V2

## Guiding Principles

1. **Never modify existing tests.** The 147 pgTAP tests and all existing TypeScript test files are frozen. New tests are always additive.
2. **A vertical is not done until its tests pass.** See the Definition of Done in MIGRATION_PLAN.md.
3. **Test the service layer, not the HTTP layer.** HTTP-level tests verify routing and auth middleware. Business logic is tested at the service function level.
4. **No new tests require a running database unless they are pgTAP tests.** TypeScript service tests use dependency injection / mocks for Supabase calls.

## Test Layers

### 1. TypeScript Unit Tests (existing, run with `tsx --test`)

**Location:** `frontend/src/features/**/*.test.ts`  
**Runner:** `tsx --test` (Node.js native test runner)  
**Command:** `pnpm test:release` (runs all suites)  

**Current suites and their counts:**
| Suite | Command | What it tests |
|---|---|---|
| Auth | `test:auth` | `requireAuthenticatedMember`, route guards, login copy |
| i18n | `test:i18n` | Locale config, judge evidence presentation, release copy |
| Landing | `test:landing` | Landing copy |
| Discovery | `test:discovery` | Candidate matcher logic |
| Decision Engine + Result Bridge | `test:c02` | BALANCED scoring algorithm, result bridge validation |
| Orchestration | `test:int02a` | Start run input parsing, view model |
| WebMCP Runner | `test:int02a-runner` | Provider runner, orchestration runner |
| External Navigation | `test:external-navigation` | External WebMCP validation harness, navigation adapter |
| Freight Intent | `test:freight-intent` | Execution intent contracts |
| Freight Intake | `test:freight-intake` | Intake flow, manual intake, draft creation, view models |
| Dashboard | `test:dashboard` | Dashboard view model, map geometry |
| Provider Tools | `test:a04` | Route params, query tools, booking tools |
| Booking | `test:booking` | Booking validation, server policy, bridge call ID, UI fixtures |
| D1 Recommendations (runtime) | `test:d1-recommendations` | WebMCP runtime, draft client, UI policy |
| D1 Recommendations (writer) | `test:d1-writer` | Draft server, draft persistence |

**These tests must ALWAYS pass before a PR merges.**

### 2. pgTAP Database Tests (existing, run with `npx supabase test db`)

**Location:** `supabase/tests/`  
**Runner:** Supabase CLI (`pg_prove`)  
**Command:** `npx supabase test db` (requires running local Supabase: `npx supabase start`)  

**Current test files:**
| File | Assertions | Covers |
|---|---|---|
| `01_cargomesh_rls_and_golden_flow.test.sql` | 21 | Schema, RLS, FR-1042 golden flow contract |
| `02_c02_result_bridge_and_decision.test.sql` | 31 | Result Bridge RPCs, decision persistence |
| `03_int02a_result_bridge.test.sql` | 17 | INT-02A overload, service identity |
| `04_int02a_orchestration_run.test.sql` | 14 | `start_orchestration_run` RPC |
| `05_c03_booking_bridge.test.sql` | 40 | Full booking lifecycle, recovery, reset |
| `06_release_service_role_grants.test.sql` | 16 | Service role grants |
| `07_d1_recommendation_draft_writer.test.sql` | 8 | `draft_version`, OCC constraint |

**Total: 147 assertions. All must pass.**

**Rule:** New migrations may add a corresponding `08_*.test.sql` file. Existing test files are NEVER modified.

### 3. Hono Route Tests (NEW — to be added per vertical)

**Location:** `frontend/src/server/hono/routes/**/*.test.ts`  
**Runner:** `tsx --test`  
**Pattern:** Each Hono route file has a corresponding `.test.ts` that:
- Calls the route handler with a mocked Hono context
- Asserts the response envelope shape and status code
- Tests auth rejection (401) on unauthenticated requests
- Tests input validation rejection (400) on schema violations
- Tests the "happy path" response shape

These tests do NOT call real Supabase — they mock the service function call. The service function itself is tested separately in the feature-level tests.

**Example:**
```typescript
// routes/freight/requests.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("POST /api/v2/freight/requests", () => {
  it("returns 201 with created freight request", async () => { ... });
  it("returns 401 when unauthenticated", async () => { ... });
  it("returns 400 when cargoWeightKg is negative", async () => { ... });
});
```

### 4. MCP Tool Tests (NEW — to be added per tool)

**Location:** `frontend/src/server/mcp/tools/**/*.test.ts`  
**Runner:** `tsx --test`  
**Pattern:** Each MCP tool has a test that:
- Calls the tool handler with a valid input (mocked service call)
- Asserts the MCP response content structure
- Tests missing/fabricated/expired trusted human approval before booking/recovery preparation, changed terms, and same-operation replay; a true boolean alone must not authorize
- Tests input schema validation

### 5. E2E Golden Flow Tests (PLANNED)

**Purpose:** End-to-end verification that the complete Golden Flow (FR-1042 demo scenario) works against a running local Supabase instance.

**Scope:** Covers Slices 1–12 in sequence:
1. Auth + create freight request
2. Start orchestration run
3. WebMCP provider navigation × 3 (Andes, Inca, Pacific)
4. Result Bridge persists all quotes
5. Decision Engine produces correct ranking (Andes 89, Inca 84, Pacific 72)
6. booking authorization
7. booking confirmation
8. Recovery flow (Andes REJECTED → Inca rebook)

**Implementation approach:** API/service tests may run in Node with explicit test doubles, but live WebMCP E2E requires a browser with document.modelContext and real provider navigation. HTTP-only tests cannot certify provider execution. Use local Supabase/scenario data; runtime resets require explicit authorization.

**Status:** PLANNED for post-Slice-2.

## Release Verification Gates

The following must ALL pass before any merge to `main`:

```bash
# Gate 1: TypeScript — zero errors
cd frontend && pnpm typecheck

# Gate 2: TypeScript unit tests — all suites pass
cd frontend && pnpm test:release

# Gate 3: Production build — clean with no errors
cd frontend && pnpm build

# Gate 4: Database tests — 147/147 pass (requires local Supabase running)
npx supabase test db

# Gate 5: Release preflight (env checks, bundle scan)
cd frontend && pnpm release:preflight
```

**Historical baseline reported before V2 (not rerun by this documentation change):**
- TypeScript: PASS (0 errors)
- Test suite: PASS (runs via `pnpm test:release`)
- Build: PASS (37 routes, 19.6s)
- pgTAP: PASS (147/147)

## Build / Typecheck Requirements

- TypeScript strict mode is enabled — no `any` without explicit justification
- All new code must pass `tsc --noEmit` with zero errors
- New Hono routes must export typed Hono app factories, not plain objects
- Zod schemas must be in `src/shared/schemas/` and imported — not defined inline in route files

## Regression Testing

Any time a service function in `features/` is called from a new context (Hono route or MCP tool), the existing tests for that feature module serve as regression coverage. No new test needs to duplicate what the existing tests already cover.

Before migrating a vertical, run the relevant existing tests to confirm they still pass on `feature/architecture`. This is the baseline. After adding the Hono route, they must still pass.

MCP-specific milestone gates and known blockers are specified in [MCP_TOOL_CONTRACTS.md](./MCP_TOOL_CONTRACTS.md). test:mcp is included in test:release. Its 36 tests exercise the real SDK transport/client, route handler, creation policy and normalizer with injected auth/database boundaries. M2 covers concurrent duplicate/conflicting creates, response loss, read-after-write failure, current-state replay and authorization. Existing Hono tests are still outside test:release and were run separately (42 passed). Typecheck, test:release and production build passed. The M2 migration and all 13 assertions in pgTAP test 08 passed on local PostgreSQL 17.6, inside a transaction that rolled back schema/test data/member-role changes. Permanent migration application and authenticated MCP smoke tests remain pending; the local database has zero orchestration runs.
