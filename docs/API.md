# REST and MCP

## REST authority

`cargomesh/src/server/hono/app.ts` and its mounted routers define the REST surface under `/api/v2`. Next.js also exposes authentication, conversation and provider routes. Do not infer API support from an old endpoint count.

| Domain | Runtime family |
|---|---|
| Intake and lifecycle | Intake options; freight requests and revisions/submission |
| Organization and catalog | Members, facilities, carriers, services, cargo/equipment reference data |
| Operations | Fleet, drivers, availability, route planning, depot and execution data |
| Commercial | Opportunities, offers, quote policies, operating costs, decisions, bookings and confirmations |
| Conversation | Interpretation/context and short-lived scoped voice sessions |
| Identity/integration | Linking, OAuth, revocation and diagnostics |

The [detailed route reference](v2-amazon/delivery/HAC40_API_ENDPOINTS.md) is generated from the reviewed runtime router (329 unique operations, health excluded); router source remains authoritative after further changes. Shared Zod schemas in `src/shared/schemas/v2/` define payloads. Reads are actor-scoped and paginated where applicable. Retriable writes use UUID `Idempotency-Key` and a canonical payload fingerprint; revisioned operations require the expected version. Reload/review after `409 STALE_DRAFT`; changing the retry key is not a solution to a stale or conflicting action.

## MCP runtime

`/mcp` exports POST/GET/DELETE through `createMcpHttpHandler`. It registers shared application services directly, not an internal REST proxy. The dependency supports MCP **2025-11-25**; verify the negotiated version in the actual client exchange when preparing contest evidence.

The source registers these tools:

- `get_cargomesh_capabilities`
- `get_v2_intake_options`
- `create_v2_freight_request`
- `get_v2_freight_request`
- `evaluate_v2_road`
- `list_v2_freight_requests`
- `revise_v2_freight_request`
- `submit_v2_freight_request`
- `find_v2_route_alternatives`
- `replan_v2_route`
- `explain_v2_route`
- `build_v2_transport_plan`
- `rank_v2_offers`
- `read_v2_workflow`
- `prepare_v2_commercial_action`
- `confirm_v2_commercial_action`
- `resolve_v2_location`
- `confirm_v2_location`

`get_cargomesh_capabilities` reports the runtime catalog. The catalog remains `PARTIAL` and names `ALEXA_PLUS_LIVE_ACCESS` and `EXTERNAL_GEOCODER` as boundaries. An implemented tool is not proof of a deployed Alexa session.

## Identity and confirmation

Local MCP is explicit development/test loopback opt-in. Remote MCP requires its own flag, exact allowed HTTPS origin/resource and configured OAuth identity. User tools revalidate active links, organization/carrier authority and scopes. A service client does not inherit customer permissions.

Commercial MCP tools separate `prepare_v2_commercial_action` from `confirm_v2_commercial_action`: present the stored proposal, affected resources, expiry and price before asking for consent. Confirm the same stored proposal only after explicit consent; do not fabricate a confirmation ID or replace a rejected action with a broader principal.

For detailed contracts see [identity](v2-amazon/contracts/IDENTITY_AND_MCP_CHANNELS.md), [workflow reference](v2-amazon/delivery/HAC40_WORKFLOW_API.md) and [Alexa submission guide](hackathon/ALEXA_PLUS.md).
