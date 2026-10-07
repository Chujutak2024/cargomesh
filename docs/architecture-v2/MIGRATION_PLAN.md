# CargoMesh V2 Migration Plan

## Current Architecture Summary

CargoMesh is a Next.js 15 application. Application code lives under `cargomesh/`; API routes use Next.js Route Handlers and Hono, with business logic in `src/features/`. Hono bootstrap/draft creation and MCP at `/mcp` exist. MCP exposes get_freight_options and create_freight_request in an opt-in authenticated local preview. Creation requires permanent M2 migration application and an authenticated MCP smoke test; local SQL checks passed. See [MCP_TOOL_CONTRACTS.md](./MCP_TOOL_CONTRACTS.md) for service mapping, gaps and milestones.

**Legacy API route inventory (20 paths; Hono catch-all additional):**

| Route | Method(s) | Feature module called |
|---|---|---|
| `/api/auth/demo-login` | POST | `server/db/supabase/server` (inline) |
| `/api/bookings/prepare` | POST | `server/services/booking/booking-bridge.ts` |
| `/api/bookings/record-provider` | POST | `server/services/booking/booking-bridge.ts` |
| `/api/bookings/record-status` | POST | `server/services/booking/booking-bridge.ts` |
| `/api/bookings/recover` | POST | `server/services/booking/booking-bridge.ts` |
| `/api/bookings/reset-demo` | GET, POST | `server/services/booking/booking-bridge.ts` |
| `/api/bookings/[bookingId]` | GET | Existing legacy route; see source for method and service |
| `/api/freight-requests/drafts` | POST | `server/services/freight-requests/draft-creation-server.ts` |
| `/api/freight-requests/intake/[requestCode]` | GET | Existing legacy route; see source for method and service |
| `/api/freight-requests/[id]/draft` | GET, PATCH | Existing legacy route; see source for method and service |
| `/api/freight-requests/[id]/execution-intent` | GET | Existing legacy route; see source for method and service |
| `/api/freight-requests/[id]/manual-intake` | PATCH | Existing legacy route; see source for method and service |
| `/api/freight-requests/[id]/recommendations` | GET | Existing legacy route; see source for method and service |
| `/api/orchestration/candidates` | GET | `server/services/discovery/get-candidate-provider-pages.ts` |
| `/api/orchestration/runs` | POST | `server/services/orchestration/start-run.ts` |
| `/api/orchestration/runs/[runId]` | GET | Existing legacy route; see source for method and service |
| `/api/orchestration/evaluate-offers` | POST | `server/services/decision-engine/evaluate-offers.ts` |
| `/api/orchestration/record-result` | POST | `server/services/result-bridge/record-provider-result.ts` |
| `/api/judge/evidence` | GET | inline in route handler |
| `/api/organization/preferences` | PATCH | inline in route handler |

**Note (verified 2026-09-17):** ALL 20 route paths have `route.ts` implementations. Earlier drafts of this document incorrectly listed 7 as stubs — those stubs have since been filled. The accurate inventory below was verified by inspecting the file tree directly.

## Target Architecture

See `ARCHITECTURE_V2.md`. In brief:
- Hono app mounted at `/api/v2/` via the Next.js catch-all route `src/app/api/v2/[[...route]]/route.ts`
- Service layer: same `src/features/` functions; a re-export tree is not a prerequisite
- Proposed MCP endpoint at `src/app/mcp/route.ts`, directly calling shared services
- Shared Zod schemas in `src/shared/schemas/`

## Migration Strategy: Vertical Strangler

**Principle:** The old Next.js API routes REMAIN ACTIVE during migration. The Hono routes are added alongside them at a new path prefix. Once a Hono vertical is validated (tests pass, behavior matches), the old route can be deprecated but is NOT deleted until explicitly approved.

**Pattern for each vertical:**

```
1. Old path: POST /api/freight-requests/drafts
   New path: POST /api/v2/freight/requests  (Hono)
   
2. Both paths call the same service function
   → No logic duplication

3. Frontend UI switches to the new path after integration tests pass

4. Old route marked @deprecated but kept alive

5. Old route deleted only after explicit sign-off
```

## Vertical Slice Sequence

Migration priority is the complete Golden Flow. Non-Golden-Flow routes are lower priority.

### Slice 0: Hono Bootstrap (no business logic)
**Scope:** Introduce Hono, mount in Next.js, health route, auth middleware, response envelope, error handler.  
**Files created:**
- `cargomesh/src/server/hono/app.ts`
- `cargomesh/src/server/hono/middleware/auth.ts`
- `cargomesh/src/server/hono/middleware/error-handler.ts`
- `cargomesh/src/server/hono/routes/health.ts`
- `cargomesh/src/app/api/v2/[[...route]]/route.ts`
- `cargomesh/src/shared/schemas/api-envelope.ts`

**Tests:** `GET /api/v2/health` returns `{ ok: true }`. Auth middleware returns 401 on unauthenticated request.  
**Done when:** TypeScript passes, build passes, health route works.

### Slice 1: Authentication / Context
**Scope:** Hono auth middleware properly resolves `AuthenticatedMemberContext` from Supabase session.  
**Re-uses:** `server/auth/member.ts` → `requireAuthenticatedMember()` unchanged.  
**New:** Hono middleware that calls the existing function and injects context into `c.set('member', ...)`.  
**Tests:** Auth test calling `/api/v2/*` with and without valid session.

### Slice 2: Freight Request Creation
**Scope:** `POST /api/v2/freight/requests` → calls `createFreightRequestDraftServer`.  
**Re-uses:** `server/services/freight-requests/draft-creation-server.ts` unchanged.  
**New:** Hono route file, Zod input schema for freight request creation.  
**Tests:** Create a freight request via the Hono route; assert the DB row; assert the response envelope.

### Slice 3: Freight Request Intake / Read
**Scope:** `GET /api/v2/freight/requests/:requestCode` → load intake view model.  
**Re-uses:** `server/services/freight-requests/intake-server.ts`.  
**Note:** The legacy read route already exists; this slice adds its Hono counterpart.

### Slice 4: Provider Discovery
**Scope:** `GET /api/v2/orchestration/candidates?freightRequestId=:id` → `get_candidate_provider_pages`.  
**Re-uses:** `server/services/discovery/get-candidate-provider-pages.ts` unchanged.  
**Tests:** Discovery returns the correct 3 candidates for FR-1042.

### Slice 5: Orchestration Start
**Scope:** `POST /api/v2/orchestration/runs` → `start_orchestration_run`.  
**Re-uses:** `server/services/orchestration/start-run.ts` unchanged.

### Slice 6: Result Bridge
**Scope:** `POST /api/v2/orchestration/results` → `record_provider_result`.  
**Re-uses:** `server/services/result-bridge/record-provider-result.ts` unchanged.

### Slice 7: Decision Engine
**Scope:** `POST /api/v2/orchestration/evaluate` → `evaluate_offers`.  
**Re-uses:** `server/services/decision-engine/evaluate-offers.ts` unchanged.

### Slice 8: Orchestration Run View Model
**Scope:** `GET /api/v2/orchestration/runs/:runId` → view model assembly.  
**Re-uses:** `server/services/orchestration/view-model-server.ts`.  
**Note:** The legacy read route already exists; this slice adds its Hono counterpart.

### Slice 9: Booking Authorization
**Scope:** `POST /api/v2/bookings/prepare` → `prepare_booking`.  
**Re-uses:** `server/services/booking/booking-bridge.ts`.

### Slice 10: Booking Record + Status
**Scope:** `POST /api/v2/bookings/record-provider` and `POST /api/v2/bookings/record-status`.  
**Re-uses:** `server/services/booking/booking-bridge.ts`.

### Slice 11: Booking Read
**Scope:** `GET /api/v2/bookings/:bookingId`.  
**Note:** The legacy read route already exists; this slice adds its Hono counterpart.

### Slice 12: Booking Recovery
**Scope:** `POST /api/v2/bookings/recover` → `prepare_booking_recovery`.

### Slice 13: MCP Server
**Scope:** Proposed `/mcp` transport, incremental tool registration. This is not blocked on migrating every Hono route. Remote auth, submission and WebMCP dispatch gaps must be resolved per the tool contracts.
**Re-uses:** All service functions from Slices 1–12.  
**New:** `@modelcontextprotocol/sdk`, MCP tool files under `src/server/mcp/tools/`.

## Compatibility Strategy

During migration, both paths are active:
```
POST /api/freight-requests/drafts   ← legacy (Next.js Route Handler)
POST /api/v2/freight/requests       ← new (Hono)
```

The UI and WebMCP runner continue using legacy paths until the Hono path is validated. The MCP server uses the service layer directly (function calls, not HTTP), so it is not affected by which HTTP path is active.

## Rollback Strategy

Each vertical slice is on a separate commit. Rolling back a vertical means reverting those commits. The service layer functions (`server/services/`) are never modified during migration (only wrapped/re-exported), so a rollback cannot break the legacy routes.

If the Hono bootstrap causes a build failure, revert the single commit that added it. The Next.js catch-all route is additive — removing it removes Hono entirely with no collateral damage.

## Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Hono version incompatible with Next.js 15 App Router | Low | Medium | Pin Hono version; test build on Day 1 |
| Auth middleware diverges from `requireAuthenticatedMember` | Low | High | Hono middleware calls the same function — no divergence possible |
| Missing shared submission, remote WebMCP dispatch and auth context | High | High | Resolve the explicit gates in MCP_TOOL_CONTRACTS.md |
| Supabase client import conflicts in Hono context | Low | Medium | Server-only imports tested explicitly in Slice 0 |
| pnpm-workspace collision with new packages | Low | Low | Not adding a monorepo — Hono stays inside `cargomesh/` |

## Definition of Done — Per Vertical

A vertical is DONE when:
1. Hono route implemented and merged to `feature/architecture`
2. TypeScript typecheck passes (`pnpm typecheck`)
3. New service-level TypeScript tests pass for the vertical
4. All existing tests still pass (`pnpm test:release`)
5. Supabase pgTAP tests still pass (`npx supabase test db` — 147/147)
6. Production build passes (`pnpm build`)
7. Legacy Next.js route still functional (not broken by the migration)
8. PR approved by WS-5 (QA)

## What NOT to Migrate in the First Phase

- Demo reset (`reset-demo`) — keep on legacy path; only used for judge tooling
- Judge evidence route — keep on legacy path
- Organization preferences — keep on legacy path
- Carrier-facing pages / provider WebMCP host — not touched at all
- Any existing pgTAP tests — NEVER modified during migration
