# Team Ownership — CargoMesh V2

## Engineer Assignments

### Engineer 1 — Alexa+ / MCP / AWS / Bedrock

**Primary ownership:**
- `frontend/src/mcp/` (entire new directory)
- `docs/architecture-v2/MCP_ARCHITECTURE.md`
- `docs/architecture-v2/AMAZON_HACKATHON.md`
- Alexa+ skill configuration (external, not in this repo)
- AWS Bedrock integration (`frontend/src/lib/bedrock.ts`)

**Secondary touch points:**
- `frontend/src/app/api/mcp/route.ts` (new Next.js catch-all for MCP transport)
- `frontend/next.config.ts` (if Bedrock requires Edge runtime config)

**Does NOT own:**
- Business logic in `features/`
- Hono API routes
- Supabase schema

**Cross-team interface:**  
Requires service function signatures from Engineer 2 before implementing MCP tool handlers. E2 provides: the exported function name, input/output types, and error codes for each service. This interface should be agreed in writing (a TypeScript `.d.ts` contract file or the service function itself) before E1 begins tool implementations.

---

### Engineer 2 — Core / APIs / Supabase Integration

**Primary ownership:**
- `frontend/src/server/hono/` (entire new directory)
- `frontend/src/app/api/v2/[[...route]]/route.ts`
- `frontend/src/shared/schemas/` and `frontend/src/shared/types/`
- `frontend/src/server/services/` (service re-export wrappers)
- Gap route implementations: `[bookingId]`, `[runId]`, `intake/[requestCode]`, `[id]/draft`, `[id]/execution-intent`, `[id]/manual-intake`, `[id]/recommendations`

**Secondary touch points:**
- `frontend/src/features/` (reading only, no rewrites unless a bug is found)
- `supabase/migrations/` (additive only — new columns, new test files)

**Does NOT own:**
- React components
- Provider WebMCP host pages
- MCP transport layer

**Cross-team interface:**  
E2 owns the service function contract that E1 depends on. E2 also owns the Hono route signatures that E3 depends on for API calls from the UI.

---

### Engineer 3 — Client UX / UI

**Primary ownership:**
- `frontend/src/app/(cargomesh)/` (all enterprise UI pages)
- `frontend/src/components/` (shared components)
- `frontend/src/features/freight-ui/` (UI state, view models for booking workspace)
- `frontend/src/features/i18n/` (copy, translations)
- CSS modules

**Secondary touch points:**
- API call patterns (switching UI from `/api/` to `/api/v2/` as verticals migrate)

**Does NOT own:**
- API route implementations
- Supabase clients
- WebMCP provider host pages (see E4)

**Cross-team interface:**  
E3 depends on E2's Hono routes having the same response shape as the current Next.js routes. Migration must be backward-compatible. E3 can switch UI calls to `/api/v2/` once a vertical is validated by E5.

---

### Engineer 4 — Carrier Application / WebMCP

**Primary ownership:**
- `frontend/src/app/providers/` (carrier-facing provider directory and WebMCP host pages)
- `frontend/src/features/providers/` (5 WebMCP tool implementations)
- `frontend/src/features/webmcp-runner/` (orchestration runner, provider runner)
- `frontend/src/features/result-bridge/` (Result Bridge)
- `frontend/src/features/discovery/` (candidate discovery)
- `supabase/scenarios/` (demo scenario seeds, not migrations)

**Does NOT own:**
- Enterprise UI pages
- Hono API routes
- MCP server

**Critical rule:** The WebMCP provider pages (`/providers/[carrierSlug]`) and the WebMCP runner MUST remain stable throughout V2. They are the backbone of the Golden Flow and have existing TypeScript tests. No changes to `features/webmcp-runner/` or `features/providers/` unless fixing a demonstrated bug.

**Cross-team interface:**  
E4 is the authority on what the WebMCP execution contract requires (tool input/output shapes). E1 (MCP) needs to know that `find_freight_options` and `authorize_and_book` will trigger the runner — E4 provides the trigger interface.

---

### Engineer 5 — QA / Integration / Automated Tests / Standards / Open Source

**Primary ownership:**
- `supabase/tests/` (pgTAP test files — may add new test files, NEVER modify existing ones)
- `frontend/src/features/**/*.test.ts` (ensuring all existing tests pass)
- New integration test harness for Hono routes
- New test files for MCP tool handlers
- `packages/cargomesh-mcp/` (open-source npm package — PLANNED)
- Release gate verification (typecheck, build, pgTAP, TypeScript test suite)
- Evidence documentation for judges

**Does NOT own:**
- Production application code (except test files)
- Supabase migrations

**Cross-team interface:**  
E5 is the gatekeeper. No vertical is considered DONE until E5 has reviewed its test coverage and confirmed the release gate passes. E5 also maintains the branch merge protocol: feature branches go to `feature/architecture`, never directly to `main`.

---

## Likely Merge Conflict Areas

| Area | Risk | Mitigation |
|---|---|---|
| `frontend/package.json` | High — Hono, MCP SDK, Zod, AWS SDK all add deps | Coordinate dep adds via a single PR per milestone |
| `frontend/src/features/booking/booking-bridge.ts` | Medium — E1 (MCP) and E2 (Hono) both call it | E2 owns the file; E1 imports, does not modify |
| `frontend/src/features/orchestration/` | Medium — E1 (MCP) and E4 (runner) both depend on it | E4 owns the files; others import |
| `frontend/next.config.ts` | Low | Coordinate any changes as a single PR |
| `supabase/tests/` | Low | E5 adds new files, does not modify existing |

## Cross-Team Integration Responsibilities

| Integration Point | Owner | Depends On |
|---|---|---|
| Hono auth middleware uses `requireAuthenticatedMember` | E2 | E2 (existing auth.ts) |
| MCP tools use service functions | E1 | E2 (service layer) |
| UI switches to Hono routes | E3 | E2 + E5 (validated) |
| MCP `find_freight_options` triggers WebMCP runner | E1 + E4 | E4 (trigger interface) |
| Release gate verification | E5 | All engineers |
