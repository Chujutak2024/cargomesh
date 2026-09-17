# CargoMesh MCP Architecture

## Overview

The CargoMesh MCP Server exposes 6 high-level enterprise freight workflow tools to AI agents (primarily Alexa+). It is implemented as a Streamable HTTP MCP server (specification 2025-11-25) hosted at `/mcp` on the existing Vercel deployment.

**Key principle:** MCP tools are enterprise-workflow tools, not low-level carrier tools. The existing provider WebMCP tools (`check_service_coverage`, `check_capacity`, `quote_freight`, `book_freight`, `get_provider_booking_status`) are internal to the orchestration runner and are NEVER exposed directly via the CargoMesh MCP server.

**The same service functions called by Hono routes are called by MCP tools — no duplication.**

## Transport

- Protocol: MCP specification 2025-11-25 (or later)
- Transport: Streamable HTTP (single POST endpoint)
- Endpoint: `POST /mcp`
- Implementation: `@modelcontextprotocol/sdk` within the Next.js application
- File: `frontend/src/mcp/server/route.ts` (TARGET — not yet implemented)

## Authentication

MCP requests from Alexa+ include a Bearer JWT token (Supabase session token). The MCP route handler validates the token using `requireAuthenticatedMember()` before any tool is dispatched. Unauthenticated requests return a standard MCP error response.

## Tool Classification

| Tool | Type | Side Effects | Human Approval Required |
|---|---|---|---|
| `create_freight_request` | STATE-CHANGING | Writes `freight_requests` | No |
| `find_freight_options` | STATE-CHANGING | Writes `orchestration_runs`, triggers WebMCP | No |
| `get_freight_options` | READ-ONLY | None | No |
| `authorize_and_book` | DESTRUCTIVE | Writes `bookings`, calls `book_freight` WebMCP | **YES — `confirmed_by_human: true` required** |
| `get_booking_status` | READ-ONLY | None | No |
| `recover_booking` | DESTRUCTIVE | Writes new `bookings`, calls `book_freight` WebMCP | **YES — `confirmed_by_human: true` required** |

## Human Confirmation Gate

Tools marked DESTRUCTIVE require `confirmed_by_human: true` in their input. The MCP tool handler (not the service function) enforces this gate:

```typescript
// Pattern applied to authorize_and_book and recover_booking
if (!input.confirmed_by_human) {
  return {
    isError: true,
    content: [{
      type: "text",
      text: JSON.stringify({
        ok: false,
        error: {
          code: "HUMAN_APPROVAL_REQUIRED",
          message: "This action requires explicit human confirmation. Ask the user to confirm before calling this tool again with confirmed_by_human: true."
        }
      })
    }]
  };
}
```

The Alexa+ skill is responsible for asking the user and collecting confirmation before passing `confirmed_by_human: true`. This is a soft gate at the MCP level — the hard gate is the server-issued `authorization_reference` from `prepare_booking_authorization` RPC, which cannot be fabricated by the browser.

---

## Tool Definitions

### 1. `create_freight_request`

**Purpose:** Creates a new freight request draft for an enterprise organization.

**Input:**
```typescript
{
  originCity: string,           // e.g. "Callao"
  originCountry: string,        // ISO 3166-1 alpha-2, e.g. "PE"
  destinationCity: string,      // e.g. "Santiago"
  destinationCountry: string,   // e.g. "CL"
  cargoWeightKg: number,        // total weight in kg
  cargoVolumeM3?: number,       // optional total volume
  packageCount: number,         // number of packages/pallets
  isCrossBorder: boolean,
  budgetUsd?: number,           // optional max budget
  strategy?: "BALANCED" | "CHEAPEST" | "FASTEST",
  cargoDescription?: string
}
```

**Output:**
```typescript
{
  freight_request_id: string,   // UUID
  request_code: string,         // e.g. "FR-1043"
  status: "PENDING" | "DRAFT",
  draft_version: number
}
```

**Side effects:** Inserts row in `freight_requests`.

**Service function called:** `createFreightRequestDraftServer` + `executeIntentServer` (from `features/freight-requests/`)

**Idempotency:** Not idempotent — each call creates a new freight request. Use a client-side idempotency key if the caller needs to retry safely.

**Error behavior:** Returns `UNAUTHENTICATED` if no valid session. Returns `INVALID_ARGUMENT` on schema violations.

---

### 2. `find_freight_options`

**Purpose:** Starts a carrier discovery and quoting run for an existing freight request. Returns immediately with a `run_id`; the run completes asynchronously. Poll with `get_freight_options`.

**Input:**
```typescript
{
  freight_request_id: string,   // UUID from create_freight_request
  idempotency_key?: string      // optional; if omitted, one is generated
}
```

**Output:**
```typescript
{
  run_id: string,               // UUID
  status: "RUNNING",
  candidate_count: number,      // number of carriers being queried
  message: string               // human-readable status
}
```

**Side effects:** Inserts row in `orchestration_runs` with status RUNNING. Triggers WebMCP runner to navigate provider pages.

**Service function called:** `start_orchestration_run` (from `features/orchestration/start-run.ts`)

**Idempotency:** The underlying RPC is idempotent on `idempotency_key`. Same key + same freight request → returns existing run.

**Error behavior:** Returns `NOT_FOUND` if freight request does not exist. Returns `FREIGHT_REQUEST_NOT_READY` if the request is not in PENDING state.

---

### 3. `get_freight_options`

**Purpose:** Polls the status of a running orchestration run and returns the ranked carrier offers when available.

**Input:**
```typescript
{
  run_id: string    // UUID from find_freight_options
}
```

**Output:**
```typescript
{
  status: "RUNNING" | "OPTIONS_READY" | "NO_MATCH" | "FAILED",
  options?: {
    rank: number,
    offer_id: string,             // UUID — pass to authorize_and_book
    carrier_name: string,
    price_usd: number,
    transit_hours: number,
    score: number,                // 0–100
    confidence: number,           // 0–100
    availability_class: string
  }[],
  recommended_offer_id?: string,  // offer_id of rank-1 option
  decision_confidence?: number,   // overall confidence score
  explanation?: string,           // natural-language explanation (may use Bedrock)
  recovery_available?: boolean
}
```

**Side effects:** None (read-only).

**Service function called:** `getOrchestrationRunViewModel` (from `features/orchestration/view-model-server.ts`)

**Idempotency:** Fully idempotent — reads only.

**Error behavior:** Returns `NOT_FOUND` if run does not exist. Returns the current `status` if still RUNNING — the caller should poll again.

---

### 4. `authorize_and_book`

**Purpose:** Authorizes and books the selected carrier offer. **Requires explicit human confirmation.**

**Input:**
```typescript
{
  freight_request_id: string,     // UUID
  offer_id: string,               // UUID from get_freight_options
  confirmed_by_human: true,       // MUST be true — hard gate
  selection_rationale?: string
}
```

**Output:**
```typescript
{
  booking_id: string,             // UUID
  authorization_reference: string,
  provider_booking_status: "PENDING_PROVIDER_CONFIRMATION",
  idempotency_key: string,
  carrier_name: string
}
```

**Side effects:**
1. `prepare_booking_authorization` RPC → writes `booking_authorizations`
2. Triggers WebMCP `book_freight` tool on the provider page
3. `record_provider_booking_result` RPC → writes `bookings`, `booking_events`

**Service functions called:** `prepare_booking` + WebMCP runner trigger + `record_provider_booking` (from `features/booking/booking-bridge.ts`)

**Authorization requirements:** `confirmed_by_human: true` (MCP gate). Server-side: offer must be ELIGIBLE, request must be AWAITING_SELECTION, authorization token is server-generated.

**Idempotency:** Idempotent on the server-issued `idempotency_key`. Same key + same payload → deduplicated response.

**Error behavior:** Returns `HUMAN_APPROVAL_REQUIRED` if `confirmed_by_human` is not `true`. Returns `NOT_FOUND` if offer or request not found. Returns `RUN_NOT_ACTIVE` if the decision state is invalid.

---

### 5. `get_booking_status`

**Purpose:** Returns the current status of a booking including provider confirmation status and event timeline.

**Input:**
```typescript
{
  booking_id: string    // UUID from authorize_and_book or recover_booking
}
```

**Output:**
```typescript
{
  booking_id: string,
  cargomesh_status: "PENDING_PROVIDER_CONFIRMATION" | "CONFIRMED" | "REJECTED" | "IN_TRANSIT" | "COMPLETED" | "CANCELLED" | "DISRUPTED" | "REBOOKED",
  provider_status: string,
  carrier_name: string,
  provider_booking_reference?: string,
  estimated_arrival?: string,        // ISO 8601
  events: {
    event_type: string,
    provider_booking_status: string,
    occurred_at: string
  }[],
  recovery_available: boolean,
  recovery_offer_ids?: string[]       // UUIDs to pass to recover_booking
}
```

**Side effects:** None (read-only).

**Service function called:** booking bridge read (from `features/booking/booking-bridge.ts`)

**Idempotency:** Fully idempotent — reads only.

**Error behavior:** Returns `NOT_FOUND` if booking does not exist.

---

### 6. `recover_booking`

**Purpose:** Rebooking after a provider rejection. **Requires explicit human confirmation.**

**Input:**
```typescript
{
  booking_id: string,               // UUID of the REJECTED booking
  replacement_offer_id: string,     // UUID from recovery_offer_ids in get_booking_status
  confirmed_by_human: true,         // MUST be true — hard gate
}
```

**Output:**
```typescript
{
  new_booking_id: string,           // UUID
  carrier_name: string,
  provider_booking_status: "PENDING_PROVIDER_CONFIRMATION",
  authorization_reference: string,
  replaces_booking_id: string       // the rejected booking ID
}
```

**Side effects:**
1. `prepare_booking_recovery` RPC → marks old booking REBOOKED, writes new `booking_authorizations`
2. Triggers WebMCP `book_freight` on the replacement carrier's provider page
3. Persists new booking events

**Service functions called:** `prepare_booking_recovery` + WebMCP runner trigger + `record_provider_booking`

**Authorization requirements:** `confirmed_by_human: true`. `replacement_offer_id` must be in the original run's `recoveryOfferIds` list.

**Idempotency:** Idempotent on the server-issued `idempotency_key` for the new booking.

**Error behavior:** Returns `HUMAN_APPROVAL_REQUIRED` if not confirmed. Returns `NOT_FOUND` if booking or offer not found. Returns `INVALID_OFFER` if `replacement_offer_id` is not in `recovery_offer_ids`.

---

## MCP Tool Implementation Files (TARGET)

```
frontend/src/mcp/
  server/
    route.ts              ← Next.js route that mounts the MCP Streamable HTTP transport
    index.ts              ← Creates and exports the MCP server instance
  tools/
    create-freight-request.ts
    find-freight-options.ts
    get-freight-options.ts
    authorize-and-book.ts
    get-booking-status.ts
    recover-booking.ts
  schemas/
    index.ts              ← Zod schemas for all 6 tools
  middleware/
    auth.ts               ← MCP auth adapter (same requireAuthenticatedMember)
```

## Bedrock Integration (OPTIONAL, PLANNED)

`get_freight_options` may optionally call Amazon Bedrock Claude 3 Haiku to generate the `explanation` field from the structured scoring data. This is behind a feature flag (`CARGOMESH_BEDROCK_ENABLED`). When the flag is off or when Bedrock is unavailable, `explanation` is generated from a template string using the BALANCED subscores. **Bedrock never influences the ranking — it only generates spoken text from already-computed deterministic scores.**
