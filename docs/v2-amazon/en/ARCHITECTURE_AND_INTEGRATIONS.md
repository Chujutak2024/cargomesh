# Architecture and integrations — CargoMesh V2

## Component boundaries

1. **Channels:** the Web UI, Alexa+, and possible later clients collect input and present the same application-service decisions. Channels do not calculate scores or invent carrier offers.
2. **Application API and MCP:** authentication, validation, idempotency, authorization, orchestration, correlation IDs, and versioned contracts. Hono routes and MCP tools map transport to shared services.
3. **Domain services:** request lifecycle, route and serviceability, transport-plan construction, opportunity and offer handling, deterministic ranking, shipper selection, and booking authorization.
4. **Data and adapters:** Supabase/PostgreSQL with constraints and RLS; geocoding/maps; carrier portal, API, or MCP adapters only where a real integration exists; optional AWS services.

Preferred implementation boundaries are pure deterministic `*-policy.ts` modules, `*-server.ts` integration modules, and shared versioned Zod schemas. External execution stays behind adapters; the domain must not import browser, voice SDK, or third-party carrier clients. Every remote result carries correlation, source, timestamps, and technical/commercial status separately.

## End-to-end target flow

```text
Web or Alexa intake
  -> authorized canonical FreightRequest draft
  -> location/route resolution for the requested date
  -> serviceability and transport-plan candidates
  -> hard eligibility filters with reasons and unknowns
  -> carrier opportunities
  -> attributable manual or integrated carrier offers
  -> normalized comparable eligible offers
  -> versioned deterministic scoring
  -> shipper choice and booking authorization
  -> adapter execution, tracking, and audit evidence
```

Eligibility identifies candidate plans and required resources. It does not set a commercial price. A serviceable area is not proof of free capacity, and capacity is not a carrier quote. A plan may combine documented partners, but responsibility and offers remain per carrier/leg unless an explicit unified commercial agreement exists. The Web stepper does not require WebMCP.

## Alexa+ and MCP

Alexa+ is a conversational client of the CargoMesh MCP server, not a second business engine. Voice handling adapts slots, confirmations, errors, and SSML. A consequential commercial or destructive operation requires explicit user confirmation. Both channels should explain provisional suggestions as provisional and request missing dates, weight, dimensions, temperature, or documents. They may summarize a few transport plans—including equipment count, route legs, window, ETA/cost status, and outstanding requirements—but cannot call an estimate a confirmed carrier offer, booking, border clearance, or toll amount.

The planned MCP capability families are request intake/update, route and carrier discovery, offer/recommendation lookup, and booking/status/tracking. There is no fixed tool-count contract. A tool may be advertised as operational only after it has authentication, a stable schema, a shared application service, tests, and end-to-end evidence. A local MCP server test does not prove an Alexa+ account-linked invocation. Account linking and V2 commercial tools are still Sprint 2 work at the September 23 snapshot; the present fail-closed user-token behavior should not be presented as user-ready Alexa+ access.

## AWS and optional challenges

The primary Alexa+ track can be implemented with a working Agent Skill or a self-hosted MCP server that meets the event's MCP specification requirement; Bedrock is **not inherently required** for that track. Any AWS Builder claim needs a genuinely used AWS service or qualifying Kiro Crew workflow, documented integration, reproducible configuration, evidence, and an operating-cost explanation. Bedrock may narrate already-computed decisions; it must not silently alter eligibility or scores. Deterministic SSML remains a valid fallback when clearly disclosed. If Bedrock is not run in the submitted demo/code path, do not claim “Powered by Bedrock.”

An Open Source mini-challenge entry must be an additional reusable licensed project or qualifying public contribution with its URL and explanation; merely publishing the main CargoMesh repository is not enough to prove that entry. Do not add services just to inflate an AWS technology list.

Token or latency savings need a reproducible baseline: same scenarios and schema versions, turn/tool-call counts, input/output tokens, p50/p95 latency, error classes, and equivalent functional quality. Separate schema optimization, context compression, cache, and model changes. Do not infer savings from a single demo.

## Data and security

V2 migrations contain production schema, functions, indexes, constraints, and RLS—not synthetic demo organizations, carriers, vehicles, lanes, or offers. V2 demo data belongs in versioned `supabase/scenarios/v2-*/seed.sql` scenarios with purpose, cleanup, and verification. The September 23 remote migration deployment added draft idempotency and ROAD facilities/depot/area/lane structures without inserting V2 catalog rows. This is an infrastructure milestone, not an operational carrier marketplace.

Every V2 table exposing organization or carrier data needs tenant-aware RLS and role-specific permissions. A service token cannot be treated as a shipper identity. Failed account-link lookup must fail closed. Retried writes use canonical-payload idempotency; concurrent draft writes use expected version and a stable conflict such as `409 STALE_DRAFT`. Selection and booking consent are recorded for audit.

## V1 boundary and transition

The WebMCP V1 code, fixed Andes/Inca/Pacific catalog, Golden Flow `FR-1042`, and three-carrier scores remain historical regression evidence. They are not V2 data, current coverage, or a requirement for the Web stepper. Useful idempotency, concurrency, RLS, and test patterns may be reused. V2 replaces fixed carrier selection, universal WebMCP-tool assumptions, depot-as-coverage, rigid global ROAD/FTL/PALLETS assumptions, and fixed historical test-count gates.

Transition is additive: inventory reusable code and debt, introduce V2 entities, keep V2 scenarios separate, place external integrations behind adapters, version observable APIs/MCP/events, and retire compatibility only after relevant regressions and impact are documented. Never rename V1 seeds and present them as V2.
