# FE-1 conversational intake handoff

Branch: `codex/v2-full-shipper-flow` (working tree; no PR or merge from this phase).

## One draft, two ways to edit

- Dashboard handoff stores only an unsent prompt in `sessionStorage`; it neither interprets nor creates a request. The intake consumes and removes that prompt.
- `V2IntakePrototype` owns the sole editable React draft. `ConversationChat` receives it as props and emits a batch of validated field changes. Form edits appear in the chat summary; chat corrections appear in the form and recalculate unit totals.
- The client stores only a request ID for same-tab-session recovery. Reloading calls authenticated GET and hydrates a supported single-unit, facility-based DRAFT; it does not persist the conversation transcript or unsaved changes. Unsupported multi-unit/external-location requests are not silently flattened for editing.
- Every local edit hides the previous serviceability cards/map. The evaluation returns only after a confirmed versioned revision followed by GET and serviceability. No fixture fallback occurs for API/auth/network/contract errors.

## Human authorization and limits

- The chat asks for missing fields, shows an editable structured summary, and requires explicit confirmation before POST creation or POST revision. The revision sends `expectedDraftVersion` and a stable idempotency key for retries. A 409 `STALE_DRAFT` offers an explicit reload that warns about discarding unsaved local edits.
- Explicit corrections such as `Son 12 pallets, no 10` or `Cambia el origen a Arequipa` change only their named field. `Mejor hazlo el martes` requests exact pickup/delivery windows; no date is guessed. A place outside the authenticated facility catalog (e.g. Callao or Santiago in the synthetic QA tenant) requires clarification and is not invented as a facility ID.
- ROAD evaluation remains preliminary. The chat does not create offers, quote prices, or book a carrier. Booking still requires the separate authorized human workflow.
- Browser speech recognition depends on the browser and its permissions. Dictated text remains editable before sending; microphone access was not requested during this QA pass. Spoken replies can be stopped, replayed, or disabled. The chat transcript itself does not survive a refresh; the persisted request does.

## Connected synthetic QA check (2026-10-10/11 local session)

Authenticated synthetic QA tenant A on `http://localhost:3000`, after ensuring one Next dev server owned `.next`:

1. GET `/api/v2/intake/options` returned five selector groups.
2. A chat message with 10 pallets, Lima and Arequipa selected the two catalog facilities and asked for the missing category. A correction to 12 pallets changed only the quantity and the shared form totals.
3. Loaded the explicit V2 example, reviewed the chat summary, and confirmed creation. POST `/api/v2/freight/requests` returned **201**; GET of request `e664c7bd-90d1-4331-9661-b25ea5c90b5f` and serviceability at version 1 returned **200/200**.
4. Corrected its saved quantity from 8 to 12 in chat. The previous evaluation vanished while local changes were pending. Confirmed revision: POST `/api/v2/freight/requests/:id/revisions` returned **200**, then GET and serviceability for expected version 2 returned **200/200**. The summary showed 12 pallets, 7,200 kg and 28.8 m³; candidates and map were refreshed for v2.
5. Reloaded the page: authenticated GET recovered v2 and quantity 12 without retaining the conversation transcript. Edited quantity to 13 in the form; the chat summary immediately showed 13 and the previous evaluation was hidden. This last change was **not saved**.
6. Visual checks at 390×844 and 1280×800 found no horizontal document overflow (document widths 375 and 1265 respectively). The inline assistant, mobile stacked summary and form were inspected in the browser. No persistent screenshot artifact was exported in this environment.

The first attempt used two concurrent Next dev servers sharing `.next`; a module-cache error produced an unreliable 404/500. After stopping both and starting one server on port 3000, the connected flow above passed. This is an environment friction observation, not a V2 endpoint failure.

## Verification

- `pnpm typecheck` — PASS.
- `pnpm test:v2-conversation` — 65/65 PASS.
- `pnpm test:v2-intake` — 46/46 PASS.
- `pnpm test:v2-chat-workflow` — 12/12 PASS.
- `pnpm test:shipper-portal` — 7/7 PASS.
- `pnpm check:architecture` — PASS.
- `pnpm build` — PASS after stopping dev, to avoid two processes writing `.next`.
