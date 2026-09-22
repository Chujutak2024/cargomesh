# CargoMesh Architecture V2 — Entry Point

> **ARCHIVO DE TRANSICIÓN (PR #80): NO ES LA FUENTE DE VERDAD V2.** Esta carpeta mezcla inventario de código local reutilizable con un plan anterior dependiente de WebMCP, ROAD/FTL/PALLETS, seis tools y ranking BALANCED. Para decisiones y nuevas issues usar [los contratos vigentes V2](../v2-amazon/README.md) y [la ruta de sprints](../v2-amazon/SPRINT_ROADMAP.md). Una afirmación de implementación aquí exige verificación en código y pruebas; Alexa+ y discovery V2 no se consideran entregados por el merge.

> **Status:** transitional inventory from PR #80. It includes local implementation
> facts and obsolete V1-based target proposals; none of the latter is a V2
> acceptance criterion. Four local MCP tools are registered; consult the
> [local MCP guide](../../cargomesh/src/server/mcp/README.md) for their limits.

## What This Is

This directory records a transitional architecture and local implementation inventory from PR #80. It is useful for selective reuse and regression, but its WebMCP-dependent flow and fixed V1 rules do not override `docs/v2-amazon/`.

## Project Scope

CargoMesh is an agentic B2B freight orchestration platform for LATAM cross-border logistics. It connects enterprise shippers with freight carriers through a deterministic Decision Engine, a WebMCP-based provider protocol, and a human-in-the-loop booking flow.

The V2 architecture makes the core CargoMesh business logic reachable via two independent interfaces:

```text
Enterprise UI -> Hono REST --\
                             -> Shared services -> Core -> Supabase/RPC
Agent client  -> MCP -------/                        |
                                                    -> WebMCP executor -> Providers
```

## Actors

| Actor | Description |
|---|---|
| Enterprise Supervisor / ACME Mining | Creates freight requests, reviews ranked options, approves bookings |
| Alexa+ Agent | Voice-driven interface; calls CargoMesh MCP tools |
| CargoMesh MCP Server | Currently exposes 4 verified workflow tools; booking tools remain planned |
| CargoMesh Hono API | HTTP interface to the service layer; used by the web UI; MCP calls shared services directly |
| Provider WebMCP Runtime | Browser-based agent that navigates carrier portals and collects quotes |
| Carrier / Provider | Hosts `/providers/[carrierSlug]` page; registers 5 WebMCP tools |

## Golden Flow status

```
User speaks to Alexa+
  → create_freight_request (MCP)
  → submit_freight_request (MCP)         # DRAFT to PENDING
  → find_freight_options (MCP)           # starts orchestration run
    → local autonomous WebMCP worker     # V1 implemented; durable dispatch remains planned
    → Provider WebMCP execution × N carriers
    → Result Bridge persists quotes
    → Decision Engine scores + ranks (deterministic, BALANCED)
  → get_freight_options (MCP)            # polls until OPTIONS_READY
  → [Alexa+ reads recommendation aloud]
  → [User says "confirm"]
  → authorize_and_book (MCP, human-approved)
    → prepare_booking_authorization (RPC)
    → book_freight (WebMCP provider tool)
    → Booking Bridge persists
  → get_booking_status (MCP)
  → [Optional] recover_booking (MCP, human-approved)
```

## In Scope — Hackathon

**Enterprise Application:**
- Dashboard
- Create Freight Request (intake form)
- Freight Request Detail
- Provider Discovery state
- Carrier Offers + Recommendation
- Booking Approval
- Booking Status / Tracking Timeline
- Booking Rejection + Recovery Flow

**Carrier Application:**
- Provider Dashboard
- Services / Routes / Coverage
- Capacity
- Quotes
- Bookings (confirm / reject)
- Booking Status
- WebMCP provider capability exposure (`/providers/[carrierSlug]`)

**Amazon Additions:**
- CargoMesh MCP Server (6 tools)
- Alexa+ skill configuration
- Optional Bedrock Haiku for explanation text only

**Hono API Layer:**
- Replaces Next.js API routes for migrated verticals (strangler pattern)
- Mounted at `/api/v2/` initially alongside existing `/api/` routes

## Out of Scope

- Full platform admin portal
- Billing / payments / accounting
- Payroll / fleet ERP
- Mobile applications
- Real production carrier integrations
- Python backend
- AgentCore / Strands (not justified)
- Multi-org admin UI

## Architecture Documents in This Directory

| Document | Contents |
|---|---|
| [CARGOMESH_V2_EVOLUTION_BLUEPRINT.md](./CARGOMESH_V2_EVOLUTION_BLUEPRINT.md) | **TARGET V2:** marketplace evolution, carrier-owned offers and delivery phases |
| [DATABASE_SCHEMA_V2_PROPOSAL.md](./DATABASE_SCHEMA_V2_PROPOSAL.md) | **TARGET V2:** additive schema proposal; it is not the current database |
| [BACKEND_DOMAIN_AND_PERSISTENCE_DIAGRAMS.md](./BACKEND_DOMAIN_AND_PERSISTENCE_DIAGRAMS.md) | **TARGET V2:** corrected domain ownership and persistence boundaries |
| [CARGO_DIMENSIONS_AND_TAXONOMY_V2.md](./CARGO_DIMENSIONS_AND_TAXONOMY_V2.md) | **TARGET V2:** richer industrial cargo model and dimensions |
| [ARCHITECTURE_V2.md](./ARCHITECTURE_V2.md) | Target architecture, layer responsibilities, dependency rules, diagrams |
| [MIGRATION_PLAN.md](./MIGRATION_PLAN.md) | Current → target migration strategy, vertical slice sequence, rollback |
| [APPLICATION_SCOPE.md](./APPLICATION_SCOPE.md) | Enterprise + Carrier app scope, Golden Flow screens, explicit exclusions |
| [API_AND_SERVICE_CONVENTIONS.md](./API_AND_SERVICE_CONVENTIONS.md) | Hono structure, Zod validation, error/response envelopes, service patterns |
| [MCP_TOOL_CONTRACTS.md](./MCP_TOOL_CONTRACTS.md) | Verified services, proposed contracts, auth spike, gaps and milestones |
| [MCP_ARCHITECTURE.md](./MCP_ARCHITECTURE.md) | 6 MCP tools: inputs, outputs, authorization, idempotency, error behavior |
| [TEAM_OWNERSHIP.md](./TEAM_OWNERSHIP.md) | 5-engineer workstream map, directories, cross-team interfaces |
| [TESTING_STRATEGY.md](./TESTING_STRATEGY.md) | Unit, service, API, DB, MCP, E2E, release verification gates |
| [AMAZON_HACKATHON.md](./AMAZON_HACKATHON.md) | Amazon-specific additions, Alexa+, demo flow, submission evidence |

## Key Invariants (Never Violate)

1. The deterministic BALANCED Decision Engine is the sole authority for carrier ranking. No LLM replaces it.
2. `book_freight` and `recover_booking` require explicit human confirmation before execution.
3. Supabase / RPCs remain the single source of truth for all runtime state.
4. WebMCP provider protocol is preserved unchanged.
5. `origin/main` stays green. No migration is considered done until its tests pass.
6. Business logic lives in the service layer. Route handlers contain only parsing, dispatch, and error mapping.
