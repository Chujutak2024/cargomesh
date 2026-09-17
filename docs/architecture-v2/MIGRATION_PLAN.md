# CargoMesh V2 Migration Plan

## Current Architecture Summary

CargoMesh is a Next.js 15 application. The full codebase lives under `frontend/`. All API routes are Next.js Route Handlers (`src/app/api/***/route.ts`). Business logic is in `src/features/`. There is no Hono, no MCP server, no shared Zod schemas outside of feature modules.

**Current API route inventory (22 routes):**

| Route | Method(s) | Feature module called |
|---|---|---|
| `/api/auth/demo-login` | POST | `lib/supabase/server` (inline) |
| `/api/bookings/prepare` | POST | `features/booking/booking-bridge.ts` |
| `/api/bookings/record-provider` | POST | `features/booking/booking-bridge.ts` |
| `/api/bookings/record-status` | POST | `features/booking/booking-bridge.ts` |
| `/api/bookings/recover` | POST | `features/booking/booking-bridge.ts` |
| `/api/bookings/reset-demo` | GET, POST | `features/booking/booking-bridge.ts` |
| `/api/bookings/[bookingId]` | GET, PATCH | (PLANNED — route stub exists, no `route.ts`) |
| `/api/freight-requests/drafts` | POST | `features/freight-requests/draft-creation-server.ts` |
| `/api/freight-requests/intake/[requestCode]` | GET | (PLANNED — route stub exists, no `route.ts`) |
| `/api/freight-requests/[id]/draft` | PATCH | (PLANNED — route stub exists, no `route.ts`) |
| `/api/freight-requests/[id]/execution-intent` | POST | (PLANNED — route stub exists, no `route.ts`) |
| `/api/freight-requests/[id]/manual-intake` | POST | (PLANNED — route stub exists, no `route.ts`) |
| `/api/freight-requests/[id]/recommendations` | GET | (PLANNED — route stub exists, no `route.ts`) |
| `/api/orchestration/candidates` | GET | `features/discovery/get-candidate-provider-pages.ts` |
| `/api/orchestration/runs` | POST | `features/orchestration/start-run.ts` |
| `/api/orchestration/runs/[runId]` | GET | (PLANNED — route stub exists, no `route.ts`) |
| `/api/orchestration/evaluate-offers` | POST | `features/decision-engine/evaluate-offers.ts` |
| `/api/orchestration/record-result` | POST | `features/result-bridge/record-provider-result.ts` |
| `/api/judge/evidence` | GET | inline in route handler |
| `/api/organization/preferences` | PATCH | inline in route handler |

**Note (verified 2026-09-17):** ALL 20 route paths have `route.ts` implementations. Earlier drafts of this document incorrectly listed 7 as stubs — those stubs have since been filled. The accurate inventory below was verified by inspecting the file tree directly.

## Target Architecture

See `ARCHITECTURE_V2.md`. In brief:
- Hono app mounted at `/api/v2/` via the Next.js catch-all route `src/app/api/v2/[[...route]]/route.ts`
- Service layer: same `src/features/` functions, gradually re-exported through `src/server/services/`
- MCP server at `/mcp` (separate Next.js API route or Hono route)
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
- `frontend/src/server/hono/app.ts`
- `frontend/src/server/hono/middleware/auth.ts`
- `frontend/src/server/hono/middleware/error-handler.ts`
- `frontend/src/server/hono/routes/health.ts`
- `frontend/src/app/api/v2/[[...route]]/route.ts`
- `frontend/src/shared/schemas/api-envelope.ts`

**Tests:** `GET /api/v2/health` returns `{ ok: true }`. Auth middleware returns 401 on unauthenticated request.  
**Done when:** TypeScript passes, build passes, health route works.

### Slice 1: Authentication / Context
**Scope:** Hono auth middleware properly resolves `AuthenticatedMemberContext` from Supabase session.  
**Re-uses:** `lib/supabase/auth.ts` → `requireAuthenticatedMember()` unchanged.  
**New:** Hono middleware that calls the existing function and injects context into `c.set('member', ...)`.  
**Tests:** Auth test calling `/api/v2/*` with and without valid session.

### Slice 2: Freight Request Creation
**Scope:** `POST /api/v2/freight/requests` → calls `createFreightRequestDraftServer`.  
**Re-uses:** `features/freight-requests/draft-creation-server.ts` unchanged.  
**New:** Hono route file, Zod input schema for freight request creation.  
**Tests:** Create a freight request via the Hono route; assert the DB row; assert the response envelope.

### Slice 3: Freight Request Intake / Read
**Scope:** `GET /api/v2/freight/requests/:requestCode` → load intake view model.  
**Re-uses:** `features/freight-requests/intake-server.ts`.  
**Note:** This fills the gap for `GET /api/freight-requests/intake/[requestCode]` which currently has no `route.ts`.

### Slice 4: Provider Discovery
**Scope:** `GET /api/v2/orchestration/candidates?freightRequestId=:id` → `get_candidate_provider_pages`.  
**Re-uses:** `features/discovery/get-candidate-provider-pages.ts` unchanged.  
**Tests:** Discovery returns the correct 3 candidates for FR-1042.

### Slice 5: Orchestration Start
**Scope:** `POST /api/v2/orchestration/runs` → `start_orchestration_run`.  
**Re-uses:** `features/orchestration/start-run.ts` unchanged.

### Slice 6: Result Bridge
**Scope:** `POST /api/v2/orchestration/results` → `record_provider_result`.  
**Re-uses:** `features/result-bridge/record-provider-result.ts` unchanged.

### Slice 7: Decision Engine
**Scope:** `POST /api/v2/orchestration/evaluate` → `evaluate_offers`.  
**Re-uses:** `features/decision-engine/evaluate-offers.ts` unchanged.

### Slice 8: Orchestration Run View Model
**Scope:** `GET /api/v2/orchestration/runs/:runId` → view model assembly.  
**Re-uses:** `features/orchestration/view-model-server.ts`.  
**Note:** This fills the gap for `GET /api/orchestration/runs/[runId]` which currently has no `route.ts`.

### Slice 9: Booking Authorization
**Scope:** `POST /api/v2/bookings/prepare` → `prepare_booking`.  
**Re-uses:** `features/booking/booking-bridge.ts`.

### Slice 10: Booking Record + Status
**Scope:** `POST /api/v2/bookings/record-provider` and `POST /api/v2/bookings/record-status`.  
**Re-uses:** `features/booking/booking-bridge.ts`.

### Slice 11: Booking Read
**Scope:** `GET /api/v2/bookings/:bookingId`.  
**Note:** Fills the gap for `GET /api/bookings/[bookingId]` which currently has no `route.ts`.

### Slice 12: Booking Recovery
**Scope:** `POST /api/v2/bookings/recover` → `prepare_booking_recovery`.

### Slice 13: MCP Server
**Scope:** `POST /mcp` — Streamable HTTP MCP transport. 6 tools.  
**Re-uses:** All service functions from Slices 1–12.  
**New:** `@modelcontextprotocol/sdk`, MCP tool files under `src/mcp/tools/`.

## Compatibility Strategy

During migration, both paths are active:
```
POST /api/freight-requests/drafts   ← legacy (Next.js Route Handler)
POST /api/v2/freight/requests       ← new (Hono)
```

The UI and WebMCP runner continue using legacy paths until the Hono path is validated. The MCP server uses the service layer directly (function calls, not HTTP), so it is not affected by which HTTP path is active.

## Rollback Strategy

Each vertical slice is on a separate commit. Rolling back a vertical means reverting those commits. The service layer functions (`features/`) are never modified during migration (only wrapped/re-exported), so a rollback cannot break the legacy routes.

If the Hono bootstrap causes a build failure, revert the single commit that added it. The Next.js catch-all route is additive — removing it removes Hono entirely with no collateral damage.

## Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Hono version incompatible with Next.js 15 App Router | Low | Medium | Pin Hono version; test build on Day 1 |
| Auth middleware diverges from `requireAuthenticatedMember` | Low | High | Hono middleware calls the same function — no divergence possible |
| Stub route gaps (`[bookingId]`, `[runId]`, etc.) block MCP | Medium | Medium | Fill stubs as part of Slices 3, 8, 11 |
| Supabase client import conflicts in Hono context | Low | Medium | Server-only imports tested explicitly in Slice 0 |
| pnpm-workspace collision with new packages | Low | Low | Not adding a monorepo — Hono stays inside `frontend/` |

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
