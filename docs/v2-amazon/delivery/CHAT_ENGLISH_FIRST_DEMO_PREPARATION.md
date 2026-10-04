# CargoMesh V2 ROAD conversation — English demo and evidence

HAC-37 adds a guided English chat to the authenticated `/freight-request/new` page. The chat and form share one provisional draft. Only the existing HAC-12 Web API creates and reads a complete draft and evaluates ROAD eligibility. HAC-38 adds V2 MCP tools that call the same application services directly. Neither channel quotes a carrier price or books freight.

## Local Web preview

Run `pnpm dev --port 3217` from `cargomesh/`, then open `http://localhost:3217/hac37-preview`. This development-only visual preview uses synthetic selector options. Its create/read/evaluate buttons are disabled. It proves layout and turn interactions, not persistence.

The authenticated `/freight-request/new` page requires a configured Supabase V2 test environment and an active member. Its chat uses the live V2 options API. The server derives the organization; the browser does not send an organization authority. Once every field is valid, the create control uses POST, then GET, then ROAD serviceability. A request ID alone is stored in tab-scoped session storage for recovery; a reload must reauthorize the GET. No transcript or contact detail is stored in browser storage.

On 2026-10-04, the authenticated flow was observed against **local** Supabase V2 with the versioned `v2-road-baseline` synthetic scenario. A guided Lima → Arequipa request created persisted `DRAFT` `V2-8819be16ed1b40e3914e65c6832faea9` at version 1. ROAD returned `unknown` for two synthetic candidates with `SERVICE_CARGO_UNKNOWN`, `CARRYING_CAPACITY_UNKNOWN`, `REQUIREMENTS_UNVERIFIED`, and `TEMPORAL_FEASIBILITY_UNKNOWN`; the capacity source was `MISSING_CAPACITY_SOURCE`. Reload reauthorized the same draft by ID and a fresh ROAD evaluation returned the same status. This is local Web/API/database evidence, not a hosted preview, carrier quote, booking, or Alexa+ invocation. No credentials or contacts are recorded here.

The integrated floating UI was reviewed in the authenticated V2 intake at desktop and a 390 × 844 mobile viewport. It uses CargoMesh green tokens, a bottom-right launcher, close control, scrollable bubble history, and a fixed composer with editable text, microphone and send controls. The mobile layout keeps the header and composer visible; the visible viewport is tracked for on-screen keyboard resizing. [Desktop screenshot](./evidence/hac37-desktop-integrated.png) and [mobile screenshot](./evidence/hac37-mobile-integrated.png) contain only synthetic selector data. Escape closed the panel and returned focus to the launcher; reopening retained the provisional turn. The in-app browser exposed speech recognition but returned a recognition error when the microphone control was clicked; the English error and full text path were observed. A microphone-equipped physical-device capture is still required to verify spoken transcript accuracy and audio playback.

A second authenticated local browser walk through the redesigned panel created and read `DRAFT` `V2-1c16c3bfa273442194edd409e2eae277` at version 1, then returned ROAD `unknown` with the same explicit reason codes and missing-capacity source. Reload reauthorized the draft by ID. This evidence verifies that the visual refactor still invokes the real V2 Web services in the local synthetic scenario.

## English walkthrough

1. Open the chat. Pick the origin and destination by the numbers displayed from the current selector list. Ambiguous or unavailable names are rejected rather than guessed.
2. Answer the guided cargo, unit, dimension, date-window, equipment, and contact questions. Values remain provisional. Type `correct 1 3` to correct the origin to option 3, then inspect the form. Changes after a persisted draft are explicitly stale until an approved update contract exists.
3. Ask `price` or `booking`. The assistant refuses to quote or reserve because those V2 services are unavailable.
4. Click the microphone in the fixed composer. The browser asks for permission if required. Recognition places text in the same editable field without sending it; review it and click **Send**. **Stop listening** ends capture, while typing remains available for every step. **Read latest response** is opt-in speech output.
5. With a configured test Supabase and active account, create a complete draft. Observe POST and GET correlation, saved reference/version, and the ROAD response's `eligible | ineligible | unknown` status, reasons, capacity source, observed date, and evaluated draft version. A local visual preview cannot prove this step.
6. For MCP, run the controlled client test in `src/server/mcp/http.test.ts`. It negotiates the protocol and calls V2 create/read/evaluate through injected application ports. It is not an Alexa+ invocation or a live database test.

## Current evidence boundaries

| Surface | Verified | Remaining |
|---|---|---|
| Web | Guided turns, correction, price refusal, text path, and authenticated POST/GET/ROAD in a browser against local seeded Supabase V2; reload reauthorizes GET | Hosted preview and HAC-33 location contract integration |
| Browser voice | Permission-triggered microphone control, explicit error state and text fallback observed in the in-app browser; recognized text is designed to remain editable and never auto-send | The browser returned a recognition error, so successful spoken capture and audio output on a microphone-equipped device remain unverified |
| MCP | Controlled official MCP client create/read/evaluate test; direct shared-service wiring | Live V2 Supabase integration call with authorized token |
| Alexa+ | Nothing observed | Authorized account linking, remote deployment and real invocation |

Do not submit the visual fixture or controlled MCP client as evidence of a real carrier integration, quote, booking, or Alexa+ call. Judge-facing artifacts must name the commit, environment, dataset, test account setup, observed output and limitations in English. Redact tokens, credentials, contacts and AWS identifiers.
