# CargoMesh — Amazon Developer Hackathon

> Status update: Hono bootstrap/draft creation and two MCP local tools (read/creation) exist. M2 requires permanent migration application and an authenticated MCP smoke test; local SQL checks passed. The other four MCP tools, remote auth, Alexa+ and Bedrock remain planned. The voice demo below is a target script, not execution evidence. See [MCP_TOOL_CONTRACTS.md](./MCP_TOOL_CONTRACTS.md) for missing submission, executor, auth and approval dependencies.

## What CargoMesh Was Before the Hackathon

CargoMesh is a pre-existing, fully functional B2B freight orchestration platform. The following components were **built, tested, and deployed before any hackathon work began:**

- Next.js 15 + TypeScript full-stack application
- Supabase/PostgreSQL with 19 migrations, 17 tables, 8 stored procedures, 22 RLS policies
- 147 pgTAP database tests — all passing
- Complete TypeScript test suite — all passing
- Production build — clean
- WebMCP-based provider orchestration (browser-native `document.modelContext` API)
- Deterministic BALANCED Decision Engine
- Result Bridge with idempotency
- Booking Bridge with recovery
- Live production deployment at [cargomesh.vercel.app](https://cargomesh.vercel.app)

The hackathon adaptation introduces **new components on top of this verified foundation** — it does not replace or rewrite it.

## Amazon-Specific Additions

### TARGET — not yet implemented (as of branch creation)

| Component | Description | Status |
|---|---|---|
| CargoMesh MCP Server | Local Streamable HTTP at `/mcp` with get_freight_options; other tools planned | PARTIAL, LOCAL ONLY |
| Hono API Layer | Health and freight draft creation at `/api/v2/`; other verticals planned | PARTIAL |
| Alexa+ Skill | Alexa+ skill configuration that calls CargoMesh MCP tools | PLANNED |
| Bedrock Haiku Integration | Optional explanation text generation from scoring data | PLANNED |
| `cargomesh-mcp` npm package | Open-source MCP tool schema package | PLANNED |

## Alexa+ Role

Alexa+ is the **front door for voice-driven enterprise freight workflows.** It does not contain business logic. It:
1. Receives a user utterance ("I need to ship 10 pallets from Callao to Santiago")
2. Extracts entities (origin, destination, weight, etc.)
3. Calls `create_freight_request` on the CargoMesh MCP server
4. Calls `find_freight_options` to start carrier discovery
5. Polls `get_freight_options` until `OPTIONS_READY`
6. Reads the recommendation aloud (using the `explanation` field)
7. Asks the user to confirm ("Say 'confirm' to book with Andes Freight for $1,760")
8. Calls `authorize_and_book` with `confirmed_by_human: true` and a trusted confirmation reference bound to the accepted terms (approval mechanism not implemented)
9. Reports confirmation or triggers recovery if rejected

**Alexa+ is the UI. CargoMesh is the brain.**

## MCP Role

The CargoMesh MCP server is the API between Alexa+ and the CargoMesh business core. It:
- Translates MCP tool calls into service function calls
- Will require trusted human approval evidence before booking/recovery preparation; a caller boolean alone is insufficient
- Returns structured data that Alexa+ can speak aloud
- Is not a new backend — it is a new interface to the existing service layer

See `MCP_ARCHITECTURE.md` for the complete tool specification.

## Optional Bedrock Role

Amazon Bedrock Claude 3 Haiku may be used for ONE narrow task:
- **Input:** the BALANCED scoring subscores (cost: 89, reliability: 96, transit: 74, etc.)
- **Output:** 1–2 sentences of natural-language explanation suitable for voice output
- **Example:** "Andes Freight ranks first because it balances cost at $1,760 with a 96% reliability score, and has the best overall fit for your LATAM cross-border route."

**Bedrock MUST NOT:**
- Choose the winning carrier (the BALANCED engine does this)
- Modify any scores
- Access the database
- Be called for any other purpose during this project

The call is feature-flagged (`CARGOMESH_BEDROCK_ENABLED`). When the flag is off, the explanation is generated from a template using the existing subscores. The Golden Flow works identically with or without Bedrock.

## Kiro Crew Evidence Strategy

Kiro Crew is the primary AWS Builder evidence. The team is using Kiro Crew actively:

1. **Repository analysis** — Kiro Crew analyzed the complete 150+ file codebase and produced the Phase 1 report
2. **Architecture decisions** — This `docs/architecture-v2/` directory was authored by Kiro Crew in a single session
3. **Implementation** — Hono bootstrap, MCP tool implementations, and test additions will be implemented by Kiro Crew
4. **Verification** — `pnpm typecheck`, `pnpm test:release`, `pnpm build`, `npx supabase test db` are all run by Kiro Crew and the results are reported in session artifacts
5. **Subagent orchestration** — Wide parallel analysis (5 subagents) was used for the initial repository analysis

**How to preserve evidence:**
- Export session transcripts from Kiro Crew dashboard
- Screenshot the subagent dispatch and completion events
- Record the architecture session that produced this document set
- Save the baseline verification report (TypeScript PASS, 147/147 pgTAP PASS, build PASS)

## Track-by-Track Additions

### Alexa+ Primary Track
- CargoMesh MCP Server (6 tools, Streamable HTTP)
- Alexa+ skill configuration
- Demo video showing complete voice-driven freight booking

**Evidence required:**
- Working MCP server URL (hosted on Vercel)
- Alexa+ skill registered and connected to the MCP endpoint
- Demo video: user → Alexa+ → CargoMesh MCP → carrier WebMCP → recommendation → booking → confirmation

### AWS Builder Mini Challenge
- Kiro Crew usage throughout development (session transcripts)
- Amazon Bedrock Haiku integration for explanation text (optional but recommended)

**Evidence required:**
- Kiro Crew dashboard session exports showing the development workflow
- Code showing `lib/bedrock.ts` Bedrock integration
- Bedrock call traces (AWS CloudWatch or session logs)

### Open Source Mini Challenge
- `cargomesh-mcp` npm package: TypeScript MCP tool schemas + `confirmed_by_human` authorization gate pattern

**Evidence required:**
- Published npm package (`npm publish` receipt)
- `packages/cargomesh-mcp/README.md` with usage example
- The package must contain working, usable code — not documentation only

## Target Demo Golden Flow (≤3 minutes; not yet an implemented Alexa flow)

### Pre-conditions
- Local Supabase running with demo seed data (FR-1042, ACME Mining, 3 carrier fixtures)
- Andes fixture: CONFIRMED
- Optional: stage Andes as REJECTED for recovery demo
- Alexa+ connected to CargoMesh MCP endpoint

### Script

**[0:00–0:20] Create request**  
User: "Alexa, ship 10 pallets of mining equipment from Callao to Santiago, budget $2,000."  
Alexa+ calls `create_freight_request` → returns FR-1043  
Alexa+: "Got it. Finding freight options now."

**[0:20–1:10] Orchestration**  
Alexa+ calls `find_freight_options` → run starts → WebMCP navigates Andes, Inca, Pacific → Result Bridge persists quotes → BALANCED engine scores → OPTIONS_READY  
Alexa+ polls `get_freight_options` until OPTIONS_READY

**[1:10–1:40] Recommendation**  
Alexa+: "I found 3 carriers. My recommendation is Andes Freight at $1,760, 31 hours, reliability 96%. Confidence 88 out of 100. [explanation from BALANCED subscores]"

**[1:40–2:00] Human approval**  
Alexa+: "Book with Andes Freight for $1,760?"  
User: "Yes, confirm."  
Alexa+ calls `authorize_and_book` with `confirmed_by_human: true`

**[2:00–2:30] Booking confirmation**  
Andes returns CONFIRMED.  
Alexa+: "Your shipment is confirmed. Reference AND-BK-2043. Estimated arrival 31 hours."

**[2:30–3:00] Recovery branch (optional)**  
If REJECTED: Alexa+: "Andes rejected. I found Inca Logistics at $1,920, 29 hours. Confirm?"  
User: "Confirm."  
Alexa+ calls `recover_booking` → CONFIRMED with Inca.

**Total: under 3 minutes including recovery.**

## Separation Boundary (Pre-existing vs New)

To clearly separate the pre-existing CargoMesh from the hackathon additions, the following structure is used:

**Pre-existing (fingerprinted by the baseline verification report):**
- All of `frontend/src/features/`
- All of `frontend/src/lib/supabase/`
- All of `frontend/src/app/(cargomesh)/`
- All of `frontend/src/app/providers/`
- All of `frontend/src/app/api/` (existing routes)
- All of `supabase/migrations/`
- All of `supabase/tests/`

**New for the hackathon (created on `feature/architecture` branch and subsequent branches):**
- `docs/architecture-v2/` (this directory)
- `frontend/src/server/hono/` (Hono API layer)
- `frontend/src/app/api/v2/` (Hono catch-all)
- `frontend/src/server/mcp/` (MCP server)
- `frontend/src/lib/bedrock.ts` (Bedrock integration)
- `frontend/src/shared/` (shared schemas)
- `packages/cargomesh-mcp/` (open-source package)
- `supabase/scenarios/amazon-hackathon/` (demo seed)
