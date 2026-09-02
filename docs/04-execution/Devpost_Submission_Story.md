# CargoMesh — Devpost Submission Story and 3-Minute Demo Script

Status: REL-02 public-presentation draft
Language: English, prepared for an international judging panel
Submission state: local draft only; nothing in this document has been sent to Devpost

## Submission title

**CargoMesh — Browser-Native Freight Orchestration for LATAM**

## One-line summary

CargoMesh is an agent-native B2B freight orchestrator that discovers a dynamic `0..N` carrier network and uses WebMCP to quote, compare, book, and recover cross-border shipments directly through carrier web applications.

## Inspiration and problem

Moving a truckload across Latin America is not one transaction. A shipper often moves between carrier portals, email threads, spreadsheets, phone calls, and country-specific processes just to answer four questions: who can serve this corridor, who has capacity, what will it cost, and will the carrier actually confirm the truck?

The portals are isolated and expose different interfaces. Traditional automation usually depends on a private integration for every carrier or fragile scraping that breaks when a page changes. Smaller carriers may have a useful web portal but no standardized API, while shippers cannot compare responses consistently or audit how a recommendation was produced.

We asked a different question: what if the carrier website itself could expose structured capabilities to an authorized browser agent?

## What CargoMesh does

CargoMesh turns one enterprise freight request into an explainable and recoverable transport workflow:

1. The shipper creates or loads a freight request, such as the reproducible FR-1042 corridor from Callao, Peru, to Santiago, Chile.
2. CargoMesh discovers compatible services from an open provider registry. The result may contain zero, one, or many carriers.
3. The browser agent navigates to each discovered `providerUrl`, preserving the exact `matchingServiceId`.
4. Each carrier portal exposes five structured WebMCP tools through `document.modelContext`:
   - `check_service_coverage`;
   - `check_capacity`;
   - `quote_freight`;
   - `book_freight`;
   - `get_provider_booking_status`.
5. CargoMesh validates and records the structured responses through an idempotent Result Bridge.
6. The deterministic BALANCED engine ranks eligible offers and explains every subscore.
7. An authorized user selects an offer before CargoMesh requests a booking.
8. If the provider rejects the booking, CargoMesh offers only valid recovery alternatives and requires a new explicit selection.

The Golden Flow uses Andes, Inca, and Pacific as deterministic demo fixtures. They make the result reproducible, but they are not a closed carrier list or hardcoded discovery rule.

## Why it matters

WebMCP changes the integration boundary. Instead of teaching an agent to click through an opaque website or requiring CargoMesh to own a custom connector for every carrier, the provider page publishes a typed, permissioned tool surface.

That creates a practical path for a fragmented logistics market:

- carriers retain control of their portal and commercial response;
- agents receive structured data instead of scraping presentation markup;
- shippers get comparable offers and an auditable decision trail;
- booking intent, provider confirmation, and recovery remain separate transactions;
- a new registered carrier can join the `0..N` network without adding a carrier-name branch to orchestration or ranking.

## How we built it

### Application layer

CargoMesh uses Next.js 15 and React 19. The App Router hosts the authenticated shipper experience, server-side route handlers, dynamic provider portals at `/providers/[carrierSlug]`, the dispatch workspace, booking lifecycle, and the Judge Drawer.

### WebMCP provider layer

Each provider page loads the exact active carrier service selected by discovery and registers its tools using `document.modelContext.registerTool`. Inputs are closed JSON Schemas, additional properties are rejected, calls support `AbortSignal`, and registration is removed when the provider document is abandoned.

For cross-origin execution, providers explicitly allow the exact CargoMesh origin through `exposedTo`; wildcards are rejected. The external navigation adapter binds execution to the immutable discovery snapshot, verifies `providerUrl + matchingServiceId`, filters tools by the registered provider origin, and checks cleanup before advancing to the next candidate.

### Data and security layer

Supabase provides PostgreSQL 17, Supabase Auth, Row Level Security, and organization-scoped access. The browser uses only public Supabase configuration. Privileged `service_role` credentials stay server-side and are excluded from client bundles.

Freight drafts use optimistic concurrency through `draft_version`. A stale update returns `409 STALE_DRAFT` rather than silently overwriting another operator's work.

### Result Bridge and idempotency

WebMCP responses exist first in browser memory. CargoMesh sends each correlated provider record to a server-side Result Bridge containing the run, request, carrier, exact service, navigation URL, tool identity, input, envelope, and timestamps.

The bridge validates the discovery relationship before persistence. Deterministic call IDs make an exact replay deduplicate safely, while a changed payload with the same identity returns an idempotency conflict. Coverage and capacity create observability events; only a successful quote can create a `CarrierOffer`.

### Deterministic decision engine

The BALANCED engine is deterministic rather than generative. It scores any eligible offer collection using:

- 25% normalized cost;
- 25% historical reliability;
- 20% transit time;
- 10% availability;
- 10% route experience;
- 10% organization history.

For the canonical fixture, it reproduces Andes `89`, Inca `84`, and Pacific `72`, with decision confidence `88`. The AI can explain and operate the workflow, but it cannot invent prices or change the ranking formula.

## How AI is used

The browser agent converts shipper intent into a tool-driven plan: discover candidates, visit the matching provider documents, inspect their registered capabilities, execute the required tools, and present the resulting choices.

AI is deliberately separated from commercial truth. Provider pages own their structured responses, the server validates and persists them, and BALANCED produces the ranking mathematically. The agent coordinates and explains; it does not hallucinate a carrier, quote, authorization, booking, or score.

## How Codex helped us build

Our three-person team used separate AI development environments with an explicit ownership model and handoff protocol. Codex helped us:

- convert the original fixed-provider concept into a dynamic provider registry;
- freeze and review shared contracts before parallel implementation;
- build and test the native WebMCP runner, cross-origin adapter, cleanup, and provider tools;
- identify replay, service correlation, multi-organization authorization, and stale-draft edge cases;
- run focused TypeScript, build, pgTAP, database lint, and secret-scan gates;
- maintain technical handoffs so each teammate's AI environment worked from the same evidence.

Every material change still went through branch isolation, cross-review, reproducible tests, and a human-controlled merge.

## Challenges we overcame

### 1. Keeping browser execution separate from database writes

Calling a carrier tool in a browser is not a database transaction. We built the Result Bridge so untrusted or mismatched results cannot become commercial offers, while exact retries remain safe.

### 2. Preserving identity across dynamic navigation

Discovery may return any number of carrier services. We retained `matchingServiceId` from discovery through the provider URL, every WebMCP call, Result Bridge validation, offer persistence, booking authorization, and evidence capture.

### 3. Making retries safe without hiding conflicts

An exact replay must not repeat browser work or create another offer or booking. At the same time, reusing an idempotency identity with different data must fail visibly. CargoMesh implements both behaviors.

### 4. Modeling booking as a lifecycle, not a button

A recommendation is not a selection, a selection is not a booking, and a booking request is not provider confirmation. Keeping those states separate allowed us to implement deterministic rejection recovery without silently switching the user's carrier.

### 5. Demonstrating cross-origin WebMCP honestly

Cross-origin access requires exact origin permissions, an immutable discovery snapshot, active-document tool execution, and cleanup between providers. We built a reusable validation harness and documented the remaining public HTTPS UAT as a release gate rather than claiming localhost evidence as production proof.

## What we are proud of

- A native `document.modelContext` flow rather than internal handler shortcuts.
- Five typed carrier tools with strict schemas, cancellation, cleanup, and explicit read/write annotations.
- Dynamic `0..N` discovery and rendering.
- Idempotent offer and booking persistence with conflict detection.
- An explainable Golden Flow of `89 / 84 / 72`, not hardcoded scores.
- A real rejection path that preserves the failed booking and offers valid alternatives.
- Organization-scoped RLS, server-side authorization, optimistic concurrency, and client-bundle secret checks.
- A Judge Drawer that connects navigation, tool calls, persistence, decisions, and booking events.

## Technical transparency

Carrier profiles and provider responses used in the demo are deterministic synthetic fixtures. The WebMCP registration and execution, navigation and cleanup, Result Bridge, database persistence, BALANCED evaluation, explicit selection, booking lifecycle, replay handling, and recovery flow are implemented application behavior.

The public cross-origin UAT is being executed against [https://cargomesh.vercel.app](https://cargomesh.vercel.app) at `origin/main@78af18b`. We will not present a local or same-origin run as final production evidence.

## Public links

- Repository: [https://github.com/Chujutak2024/cargomesh](https://github.com/Chujutak2024/cargomesh) — verify public visibility before submission.
- Public demo: [https://cargomesh.vercel.app](https://cargomesh.vercel.app)
- Demo video: `<FINAL_VIDEO_URL>`

## Testing instructions

From `frontend`:

```powershell
pnpm install --frozen-lockfile
pnpm test:release
pnpm typecheck
pnpm build
```

Database verification requires the local Supabase stack and runs the repository's pgTAP suite and database lint. The final release evidence must also include a clean-browser public smoke test, native WebMCP `getTools/executeTool`, Golden Flow, booking replay, rejection recovery, cleanup, and a client-bundle secret scan.

## Three-minute demo video script

Target duration: **2:55–3:00**. The narration below is approximately 385 words. Keep transitions tight and avoid waiting for network animations on camera.

### 0:00–0:40 — Hook and intake

**Visual direction**

- Open on the CargoMesh landing page, then move immediately to the authenticated intake.
- Show the clean draft, load the canonical FR-1042 case, and highlight the cargo and route selectors.
- Keep Callao, Peru → Santiago, Chile, 8,000 kg, and 18 m³ visible.

**Narration**

> Moving freight across Latin America still means carrier portals, email, spreadsheets, and phone calls. Every provider has a different interface, and scraping those pages is fragile. CargoMesh replaces that fragmentation with a browser-native carrier network. Here our shipper creates FR-1042: eight thousand kilograms of mining spare parts moving by full truckload from Callao, Peru, to Santiago, Chile. The request is organization-scoped, and its canonical weight, volume, route, and schedule are persisted before orchestration begins.

**Proof on screen**

- Authenticated organization and request code.
- Canonical route and cargo totals.
- No offers or bookings preloaded.

### 0:40–1:40 — The WebMCP moment and Judge Trace

**Visual direction**

- Start orchestration and show a variable candidate collection.
- Use a split view or quick cuts between provider portals and the Judge Drawer.
- Highlight `document.modelContext`, `matchingServiceId`, the three tool names in order, and structured envelopes.
- Show cleanup before the next provider.

**Narration**

> This is the WebMCP moment. CargoMesh discovers a dynamic set of compatible services—zero, one, or many—and preserves the exact matching service for every carrier. The agent opens each registered provider page. The page itself exposes typed tools through document.modelContext; CargoMesh does not scrape its HTML and does not call a hidden provider handler. First we check corridor coverage, then capacity and schedule, and only then request a quote. The Judge Drawer shows the exact navigation URL, tool input, structured envelope, timestamps, and cleanup. Each result crosses our server-side Result Bridge, which validates the run, carrier, service, and URL. Exact replays deduplicate; changed payloads conflict. In this reproducible demo, Andes, Inca, and Pacific are fixtures, but orchestration has no fixed carrier list.

**Proof on screen**

- `getTools()` and `executeTool()` evidence.
- Coverage → capacity → quote sequence.
- Exact `providerUrl` and `matchingServiceId` correlation.
- Provider tools absent after cleanup.
- Three persisted offers created by runtime execution.

### 1:40–2:25 — Explainable decision and booking

**Visual direction**

- Show the three ranked cards and expand Andes' explanation.
- Select Andes explicitly.
- Show booking moving from authorization to provider confirmation.

**Narration**

> CargoMesh now evaluates the offers with BALANCED, a deterministic engine—not an LLM score. It weighs cost and reliability at twenty-five percent each, transit at twenty percent, and availability, route experience, and organization history at ten percent each. Andes ranks first with eighty-nine points: one thousand seven hundred sixty dollars, thirty-one hours, ninety-six percent historical reliability, and availability in the requested window. Inca scores eighty-four and Pacific seventy-two. The user selects Andes; recommendation and selection remain separate. CargoMesh creates server-side authorization, calls book_freight through WebMCP, and polls provider status until the booking is confirmed.

**Proof on screen**

- Scores `89 / 84 / 72` and confidence `88`.
- Andes commercial evidence and score explanation.
- Explicit `ASSISTED` selection.
- Provider reference and `CONFIRMED` event.

### 2:25–3:00 — Recovery and close

**Visual direction**

- Cut to the controlled contingency run.
- Show Andes changing to `REJECTED`, the recovery panel, and Inca as an eligible alternative.
- Select Inca and finish on the CargoMesh value proposition.

**Narration**

> Real logistics fails, so our demo does too. In the controlled contingency, Andes rejects the booking. CargoMesh preserves that event, never rewrites it as success, and offers only eligible recovery IDs. With one explicit click, the shipper selects Inca Logistics at one thousand nine hundred twenty dollars and twenty-nine hours. A new authorization and idempotency key create the alternative booking without duplicating the first. CargoMesh turns fragmented carrier websites into one explainable, secure, and recoverable freight workflow—powered by WebMCP, not scraping.

**Proof on screen**

- Stable Andes `BOOKING_REJECTED` event.
- `recoveryOfferIds` boundary.
- Explicit Inca selection, new authorization, and new booking.
- Final Judge Drawer timeline and CargoMesh logo.

## Recording checklist

- [ ] Use the final public HTTPS URL and display the deployed Git SHA once.
- [ ] Record in a clean browser profile with WebMCP available.
- [ ] Hide email addresses, cookies, access tokens, authorization references, and private IDs.
- [ ] Pre-reset FR-1042 so no runtime offer or booking is preloaded.
- [ ] Capture one continuous Golden Flow or clearly label cuts.
- [ ] Capture a separate controlled recovery run; do not pretend one booking both confirms and rejects.
- [ ] Keep DevTools text large enough to read at 1080p.
- [ ] Show `getTools`, at least one complete `executeTool` envelope, and cleanup.
- [ ] End before 3:00 and reserve two seconds for the project name and repository URL.

## Screenshot shot list

1. FR-1042 intake with Callao → Santiago and canonical cargo totals.
2. Provider page with five WebMCP tools registered.
3. Judge Drawer showing structured coverage, capacity, and quote evidence.
4. BALANCED ranking with Andes `89`, Inca `84`, Pacific `72`, confidence `88`.
5. Confirmed booking event timeline.
6. Andes rejection and eligible Inca recovery selection.
7. Cleanup result with no abandoned provider tools active.

## Finalization placeholders

- [ ] Complete the public WebMCP UAT at [https://cargomesh.vercel.app](https://cargomesh.vercel.app) and attach sanitized evidence.
- [ ] Replace `<FINAL_VIDEO_URL>` after the edited video is uploaded.
- [ ] Confirm the repository is public and the license is detected.
- [ ] Add final screenshots and their repository paths.
- [ ] Map this story to the live official Devpost fields after the project is initialized with the hackathon workflow.
- [ ] Perform one final secret scan before making or confirming any public artifact.
