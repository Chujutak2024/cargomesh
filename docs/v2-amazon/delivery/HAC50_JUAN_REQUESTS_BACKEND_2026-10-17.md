# HAC-50 — Requests: authorized opportunities in Juan's frontend

Date: 2026-10-17, America/Lima. Branch: `codex/unified-workspaces-demo-boundary`.

## Scope and result

Connect the existing Requests directory to received Carrier opportunities. Preserve Juan's directory/card/detail composition and CSS. Customer request data is read-only; accepting an opportunity means review only, not a quote, assignment, capacity reservation or booking.

The new connected component mounts at the unchanged `/carriers/requests` route, including `/carriers/requests/details/<opportunity-id>`. The original directory CSS, card route/cargo/facts arrangement and detail-plus-review-aside layout are reused. Obsolete local five-step progress and customer edit links are not attributed to the connected workflow.

The authorized Carrier selector is reused from the existing header. Requests does not read `/api/v2/freight/requests`, rely on local request storage for its contents, or fall back to examples on empty/denied reads. The parent still hosts local hooks for its other legacy screens; they do not provide Requests data.

## Available API reused

- List: Carrier-scoped opportunities, with bounded pagination and partial-read reporting.
- Detail: exact Carrier-scoped opportunity identity and current opportunity revision.
- Response: `POST /api/v2/carriers/{carrierId}/opportunities/{id}/responses`, containing only schema version, expected opportunity version, ACCEPTED/DECLINED, response note and audit evidence.

Response UI requires a current permitted status, an open response deadline, permitted role and complete list read. The client rechecks status/role/deadline before sending. Server authorization and state validation remain authoritative. An identical failed retry retains its idempotency key; changed payload receives a different receipt. Returned kind, ID, Carrier, request, organization and response status are validated. A stale-version error remains visible and asks for refresh. A response reloads list/detail.

The confirmation form exposes audit note, source reference and explicit provenance. Provenance defaults to UNKNOWN, not VERIFIED. The provider is the selected authorized Carrier and the observed timestamp is established when the response form opens. The backend attributes the actor.

## Known projection gap: customer windows

The active opportunity contract supplies origin, destination, cargo and assignment snapshots, plus the response deadline. It does not guarantee customer pickup/delivery windows or the customer request revision/timezone context. This environment returned 4 opportunities: zero with pickup windows, zero with delivery windows, and all 4 with planned resource windows.

The UI labels customer windows as not included in the Carrier projection. Resource windows are displayed separately. They are not used as pickup/delivery windows or as an ETA. The response deadline is not a transport window. Supplied cargo details and requirements remain visible; absent weight/volume do not become zero.

Coordinate the missing read projection with the Client backend/C6 owner: authoritative requested pickup/delivery windows, timezone context, source request revision and minimized required snapshot. This task does not replace the shared workflow projection or modify migrations.

## Verification

- 44 targeted tests passed, covering scoped/empty/denied lists, exact response path and audit payload, idempotency receipt, stale/foreign results, expired/role guards, window semantics, commercial domain and existing navigation.
- 7 server-rendered component checks passed for directory composition, read-only details, open/OFFERED actions, partial/denied/empty reads and response-form guards. State injection and visual dependencies were stubbed; these checks do not verify browser interaction or visual layout.
- Typecheck passed after removing the now-unreachable old local Requests table branch. Architecture check passed: 520 modules and 154 client entry points at verification time.
- Native authenticated reads: 4 opportunities, complete list, all OFFERED and zero currently respondable. Detail lookup succeeded. Requests list/detail URLs returned 200 and mount the connected source marker; the local saved-on-device marker is absent.
- Zero hosted business writes. Positive response behavior is verified with controlled HTTP responses, not a claimed real accept/decline. An open SENT opportunity in an authorized test scenario is needed for manual end-to-end response validation.
- No Requests changes to styles, routing, server/API, scenes, Fleet or Sites. The protection check observed a concurrent change to Fleet's Sites integration from parallel work; it was reviewed as outside this task and retained. Requests did not write that file.

Browser automation remains disabled in Work settings. HTTP/API checks and unit tests do not verify browser interaction, hydration, focus, responsive layout or current animation playback.

## Files and evidence

Added under `cargomesh/src/features/carrier-juan/`: `connected-opportunities.tsx`, `opportunity-response-form.tsx`, `opportunity-model.ts`, `opportunity-client.ts`, plus two focused test files. The existing coordinator has minimal mount, provenance and header-busy handling changes.

Primary-checkout evidence: `salida/juan-requests-backend-20261017/`, including original coordinator backup, staged sources, `NATIVE_RESULTS.json`, `PRESERVATION_RESULTS.json`, `SSR_RESULTS.json` and the authenticated read script.

No commit, push, merge, deployment, credential change or hosted migration was performed. Offers, Orders, Pipeline, Fleet and Sites remain separate work.
