# FE-1 final visual and functional audit — 2026-10-11

## Scope and baseline

- Branch: `codex/v2-full-shipper-flow`; starting HEAD: `16a7d5f`. The work continues the earlier FE-1 commits, including `d440a98`; nothing was reset or merged.
- Current local reference: `origin/main` at `9d5f681`. FE-2 was inspected at `/carrier-portal#/commercial` but its files were not changed.
- Environment: local Next.js with an authenticated synthetic V2 tenant. Its visible records are test data, not proof of a production carrier, offer or execution.
- Pull request: [#122](https://github.com/Chujutak2024/cargomesh/pull/122), open and Ready for review. GitHub currently reports `mergeable: CONFLICTING` against `main`; no merge, rebase or deployment was performed in this audit. The conflict needs a separately coordinated base update before merge review.

## Route and visual inventory

The evidence directory is [`evidence/fe1-final-audit/`](evidence/fe1-final-audit/). For each principal route, browser screenshots were captured at 390, 768, 1366, 1440 and 1920 CSS pixels. The `carrier-fe2-*` captures provide a direct visual comparison at 390 and 1366. The browser check found no document-level horizontal overflow or offscreen primary controls at those widths. This is a visual/DOM check, not an automated WCAG contrast certification.

| FE-1 surface | Visual result | Functional result and limit |
| --- | --- | --- |
| `/dashboard` | Shared FE-2-inspired rail, blue/cyan surfaces, clear activity and assistant entry; 768 px clipping fixed. | Authenticated tenant shows 3 requests, 3 facilities, 0 bookings, 0 executions. No decorative live metrics were invented. |
| `/freight-request/new` and inline chat | Rebuilt intake and first-class conversational panel use the shared shell and tokens. | Live options and a persisted request's serviceability were inspected; full new-request POST was not repeated in this audit. Form/chat draft synchronization, revisions and errors have automated tests. |
| `/facilities` | Shared cards and search hierarchy. | Tenant-owned facility list rendered; address/contact autocomplete remains limited by the intake-options payload. |
| `/requests` | Shared filter/table-card surface at all five widths. | 3 tenant requests rendered; search, status/date filters and sorting are implemented. |
| `/requests/[id]` | Request detail, candidate cards/map, commercial area and decision UI follow the same language. | Existing request showed eligible and unknown candidates. Card/map selection synchronized; no route geometry was claimed. No current offer was present to perform a live booking. |
| `/bookings` | Shared empty/loading/error surface. | Authenticated result is empty. Successful/rejected booking visuals and live authorization remain unverified without records. |
| `/history` | Search, filters, dates, sort and request chronology match the rest of the portal. | Request history is distinct from physical execution events. No backend clone/reuse operation was proven; no old price/availability is copied. |
| `/tracking` | Shared summary/list and truthful empty state. | No executions for this tenant. |
| `/tracking/[id]` | Loading and recoverable error states were captured. | A valid execution detail, timeline, route and optional 3D could not be exercised because there is no execution. Invalid ID produced a visible error rather than simulated GPS. |
| `/organization`, `/support`, `/help` | Residual legacy styling was replaced with the shared tokens; organization/help text is bilingual. | Informational surfaces; no new business operation was invented. |

## Requirement matrix

“Verified” below means the indicated evidence was actually exercised in this audit or its tests. It does not imply a complete hosted end-to-end business transaction.

| Original superprompt / later phase | Status | Evidence or precise remaining gap |
| --- | --- | --- |
| Common FE-2 visual identity and client shell | Implemented and visually verified | FE-1/FE-2 captures; shared `--cm-color-*` tokens, compact rail, cyan/blue accents, light surfaces. FE-2 files unchanged. |
| Mobile navigation, responsive, keyboard | Implemented and verified for inspected routes | Five viewport widths; no horizontal document overflow; menu opens as modal navigation, traps Tab, closes with Escape, restores focus. No full screen-reader audit was run. |
| Consistent colors, type, spacing, cards, inputs, status surfaces | Implemented and visually verified for inspected states | Replaced remaining legacy palette in the shipper portal and auxiliary pages. Fixed inherited dark `color-scheme` on FE-1. Automated contrast measurements are still pending. |
| Dynamic intake, facility selection, local draft, summary, validation | Implemented; partly live-verified | Live five-group options were seen. Contract tests cover facility IDs, codes, units, conditional temperature, draft preservation, version and idempotency. Facility address/contact autocomplete is **not** in `GET /api/v2/intake/options`; cannot infer it from label/city. |
| POST → GET → serviceability, map/card selection, unknown and provenance | Implemented; partly live-verified | Existing persisted request and serviceability GET showed eligible and unknown candidates, synchronized card/map selection and missing-geometry state. Unit tests cover POST/GET correlation, 401/403/409/network/contract failures. This audit did not create a further live request. |
| Chat-led intake, corrections, form continuity, confirmation, voice | Implemented; tests pass, live conversation only partly checked | Chat visually present without relying on floating launch. Tests cover partial corrections and shared draft, conversation, voice support and workflow gating. No Alexa+ live integration is claimed, and no persisted revision was executed manually here. |
| Offers, ranking, consent, booking, rejections | Implemented; live outcome unverified | Tests cover expired/withdrawn/missing offers, explicit consent, booking retry key, conflict and distinct outcomes. Tenant has no current offers or bookings, so positive/rejected commercial journeys and ranking explanation cannot be observed live. Backend remains authority. |
| Requests/history/search/filter/sort/reuse | Implemented except reuse | Live tenant list and responsive filtering UI checked; tests cover models. No verified clone endpoint for a past request, so there is no reuse action and no stale commercial reuse. |
| Tracking stages/incidents/map/3D | Implemented; live detail blocked by data | Timeline/event models, route selection, no-GPS/no-geometry and FE-2 logistics/3D tests pass. Tenant has zero executions; valid detail, incident, animated progress and 3D fallback cannot be browser-verified here. The 3D scene is conceptual, not shipment telemetry. |
| Loading/empty/error/unknown/retry | Implemented; several states visually verified | Empty bookings/tracking, invalid tracking ID, intake skeleton and missing-geometry state captured. Not every 5xx/permission state was induced in-browser; tests cover representative negative paths. |
| Auth, tenant, permissions, no fixture fallback | Implemented; negative paths verified | Unauthenticated GETs to intake options, freight requests and workflow executions returned 401. Authenticated data was tenant-scoped. Options fixture requires explicit development mode; no silent fallback. A second tenant's browser session was not available for a live cross-tenant attempt. |
| FE-2 regression protection | Verified by automated gate and visual baseline | `pnpm test:logistics` passed; FE-2 commercial portal captured. No FE-2 source files changed. Full manual FE-2 journey was not rerun. |

## Connected operations and authority

| Surface/action | V2 operation | Client rule / negative path |
| --- | --- | --- |
| Intake selectors | `GET /api/v2/intake/options` | Five versioned groups; 401/403/network/contract errors visible; fixture only via explicit dev flag. |
| Create/read/evaluate request | `POST /api/v2/freight/requests`; `GET /api/v2/freight/requests/:id`; `GET /api/v2/freight/requests/:id/serviceability` | Same-origin auth, idempotency on POST; API evaluation is not an offer. |
| Revise/submit | `POST /api/v2/freight/requests/:id/revisions`; `POST /api/v2/freight/requests/:id/submissions` | Expected draft version; 409 remains visible; no optimistic success claim. |
| Resolve/confirm place | `POST /api/v2/locations/resolutions`; `POST /api/v2/locations/confirmations` | Explicit place confirmation; no invented proximity/coordinates. |
| Commercial decision/booking | `POST /api/v2/freight/requests/:id/decisions`; `POST /api/v2/bookings` | Explicit selection and consent; stable booking retry key; no automatic alternate booking. |
| Workspace lists/detail | Tenant-scoped V2 workspace services for facilities, requests, offers, decisions, bookings, executions, events, incidents and routes | Empty/error states preserved; no hidden mock substitution. |

## Corrections made in this audit

1. Set the FE-1 shell to the light color scheme so native controls no longer inherit the global dark form appearance.
2. Removed legacy green/cream rules in shared shipper styles and aligned candidate cards and auxiliary pages with the established blue/cyan tokens.
3. Fixed the 768 px activity-row clipping by keeping the dashboard single-column until 1050 px.
4. Made mobile navigation a keyboard-operable modal region with Escape, focus containment and focus return.
5. Added a factual warning when a candidate's provenance validity ended before its serviceability evaluation; the backend's eligibility remains untouched. This was observed on a live synthetic response and covered by unit tests.

## Validation

All commands ran from `cargomesh/` on this feature branch:

| Command | Result |
| --- | --- |
| `pnpm release:verify` | PASS: typecheck, architecture (`292` modules / `73` client entry points), release/conversation/workflow/logistics tests and production build. |
| `pnpm test:release` | 341/341 PASS. |
| `pnpm test:v2-conversation` | 65/65 PASS. |
| `pnpm test:v2-chat-workflow` | 12/12 PASS. |
| `pnpm test:logistics` | 117/117 PASS. |
| `pnpm test:v2-intake` | 47/47 PASS. |
| `pnpm test:shipper-portal` | 22/22 PASS. |

The two focused suites overlap the release suite; these numbers must not be added as unique tests. Browser screenshots verify composition, not every interactive or commercial state. The local environment supplied no current offers, bookings, executions, valid route geometry or 3D shipment record; those are concrete remaining acceptance checks, not green claims. A source-validity mismatch was found in the current synthetic serviceability response and surfaced without changing the server decision.
