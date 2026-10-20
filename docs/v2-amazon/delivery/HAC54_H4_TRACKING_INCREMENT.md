# HAC-54 H4 — connected tracking and local commercial cases

Owner: Luis. Registered branch: `codex/v2-client-commercial-operations`; existing draft PR #133 targets `main`. Parent cut: H3 `fc73da930a498a6c40cb72dfb195eb60690d9824`. This is an implementation and focused local-verification increment, **not whole-issue completion, human CP-L4 acceptance, integration or deployment**. October 21 joint validation remains pending under the current October 19 plan.

## Implemented / defects corrected

- Tracking detail now reads the **exact execution ID**, not an execution searched inside the first 100 tenant records. It follows exact booking → decision → selected plan → route and booked offer. Tenant/request/Carrier/selected offer/service/assignment mismatches fail closed. Missing legacy `booking.offerId` cannot authorize a guessed route or 3D scene.
- Tracking list uses native 25-record pagination with validated metadata and bounded four-execution enrichment batches. Each item reads its exact request/booking and parent-scoped events/incidents, not unrelated capped global lists. Search, filter, sort and page survive detail/back and refresh via sanitized URL parameters. Search/counts/sort explicitly cover the loaded page, **not the whole organization**.
- Fixed a real status mismatch: native `PLANNED` executions previously appeared unknown and were omitted from the active filter. They now say awaiting departure, without asserting start/position/delivery.
- Partial or failed event/incident collections remain incomplete and retryable. An unavailable incident read cannot produce a verified zero or “no incidents” state. Authentication/schema/scope failures propagate; there is no hidden fixture fallback. Existing tracking error/loading boundaries remain in use.
- The estimate panel distinguishes the booked offer's **estimate at quote time** from actual reported completion and the execution's planned window. It is not a recalculated/live ETA. Missing estimates remain unknown; no clock-based GPS or percentage is synthesized.
- Map and conceptual 3D share the selected persisted route. Existing shared `RouteNavigation3D` and map renderer are reused unchanged. Added explicit map-provider retry; existing 3D-unavailable → map/events fallback and retry remain. Conceptual animation is explicitly not load position/progress. Missing/unknown geometry disables the visual route rather than interpolating one.
- Refresh has pending feedback, and route/timeline tabs retain keyboard navigation. A narrow CSS correction keeps anchored incident headings below the sticky client header. No Carrier UI, shared auth/shell/Nova, schema, SQL function or 3D engine was modified. The only `/clients` wrapper change forwards tracking query parameters to the existing connected page.

## Local environment and scenario

Docker was initially stopped. The user started Docker Desktop; the existing V2 stack/gateway was verified. The frontend runs on port 3000. Other stacks were left untouched. No H4 migration, reset, hosted write, service-role business insert, new credential/grant or AWS call occurred.

Separate recipe: [`supabase/scenarios/v2-hac54-commercial/`](../../../supabase/scenarios/v2-hac54-commercial/README.md). It reuses existing H2 catalog/network references and creates new resources/transactions through actual authorized native commands. All evidence is SIMULATED and marked synthetic. Evidence clock **2026-10-20 00:00 UTC**; quote/hold expiry **2026-10-20 22:00 UTC**; planned window **October 20 08:00 → October 21 06:00 UTC**. Actual start/completion timestamps come from the native commands. H3's future October 23 execution remains unchanged.

### Observed local twelve-case manifest

IDs below belong to this local V2 database, not a hosted environment. The runner verifies all seven executions through the production tracking assembler and compares exact Client/Carrier execution DTOs.

| Case | Request ID | Booking / execution / observed outcome |
| --- | --- | --- |
| 01 planned | `37c2e7dd-c415-40d6-8bbe-82fe5f5e3913` | Booking `689c4e71-89b2-4987-acd2-63cf3458a962` CONFIRMED; execution `b71da863-ac70-404e-a044-9bf079e87a90` PLANNED |
| 02 transit | `ff7e0d5c-ec09-4bed-8783-5a2ad31b3d45` | Booking `d50613dc-187f-4c98-abd1-2c6884790ff7` CONFIRMED; execution `fb4e98b8-9a8b-424e-901f-908d84d6bd2f` IN_PROGRESS |
| 03 delivered | `1d381688-d846-4c7b-941f-f8b777055b16` | Booking `d935b1de-4907-4203-a5df-9dd39063d4c8`; execution `543c8ea5-4b90-48c9-b63d-d13120c403f0` COMPLETED |
| 04 incident | `cc497236-6b8c-428d-804c-476085d2a6b0` | Booking `5ff37f8a-d8eb-4be7-8bf6-ff12fa02a452`; execution `8c389103-b117-44c8-b9b9-96c63f53b24f` IN_PROGRESS; OPEN CRITICAL incident `3fbcd1ae-6cdd-4e34-a46a-b7e7c22932ac` |
| 05 cancellation | `2534464f-5acb-477a-a442-8764d04f01a4` | Booking `24a866b6-d3d6-43bf-bbab-aa47efe8b36b` CANCELLED; execution `2a9ace5f-99b6-4586-923e-e9c101e7dfca` CANCELLED |
| 06 rejection | `3d746082-655e-49f2-ad00-d3c3b2796bbc` | Booking `062ff42c-f044-49f4-9a22-5b8d1ab82ad0` REJECTED; no execution created |
| 07 comparison | `f029a05e-3dbb-4faa-ab10-44f2c92147cb` | Booking `0d801618-e27f-4958-9f85-5cf9e2c7d6ff`; execution `3fb96360-e70c-4465-b0b0-f6aa684dea1e` PLANNED; native ranking has two same-Carrier options, selected USD 325 |
| 08 cold compatible | `e7147609-cf05-448d-b90f-27bc6ae39ddf` | Booking `b95cae10-0724-495c-99de-2388f076d17b`; execution `ffa7bbec-3338-4cff-ab68-d9a85f506b7b` PLANNED |
| 09 cold incompatible | `79112bfb-0801-4eca-b2ff-4bbe97ae7276` | Native UNKNOWN / `TEMPERATURE_CAPABILITY_UNKNOWN`; `409 PLAN_NOT_ELIGIBLE` selection; no offer/booking |
| 10 no coverage V2 | `85b1a8be-20c6-428a-bb76-5f873298e25b` | Native serviceability INELIGIBLE; no fabricated plan/offer/booking |
| 11 occupied V2 | `95d2ee7b-4ba6-441b-a741-eab5100bfd4a` | Native INELIGIBLE / `RESOURCE_OCCUPIED`; no pending thermal requirements; `409 PLAN_NOT_ELIGIBLE` |
| 12 unknown V2 | `8d05fe6b-331c-4593-aa3d-55dec02bab8f` | Native UNKNOWN / `RESOURCE_WINDOW_UNKNOWN`; `409 PLAN_NOT_ELIGIBLE` |

Three earlier composite negative requests and a case-09 review invitation remain as historical test artifacts; nothing was deleted/reset. The selected isolated cases use `_V2` keys after correcting a shared nested test-input reference. See the [friction log](./friction-logs/HAC54_H4_NATIVE_BOUNDARIES_2026-10-20.md).

## Checks actually run

| Check | Observed result |
| --- | --- |
| `pnpm test:hac54:h4` | **44/44 PASS**: exact native chain, tenant/request/Carrier/offer/assignment negatives, legacy missing offer, unknown/partial/error, query round-trip, native PLANNED mapping, truthful milestones/geometry and bounded pagination |
| `pnpm typecheck` | PASS after H4 source changes |
| `pnpm check:architecture` | PASS; 619 modules / 186 client entry points inspected; not a substitute for RLS tests |
| Local native scenario runner | Twelve selected cases pass, including real Client submission/selection/authorization, independent Carrier offer/confirmation/start/position/completion/cancellation/incident commands; same action keys replay existing rows |
| Seven exact execution chains | Client/Carrier DTO equality, native event/incident reads and actual tracking assembler pass. Foreign-tenant reads of execution/events/incidents return 404; anonymous reads return 401 |
| Native negative updates | Stale position version and restart of completed execution return 409; completed state stays COMPLETED |
| Actual browser | Connected Client shows native PLANNED/transit/completion/attention counts. Search `ff7e0d5c` → detail → refresh → back preserves query/filter and one result. Native transit has two events and the simulated Ica report. Critical incident is visible with time/place and unknown schedule impact. Map unavailable/retry remains usable; 3D opens the shared conceptual scene/camera/pause controls |

Focused viewport observations: actual DOM widths **975 CSS px** and **390 CSS px**, not the nominal device-pixel setting; at 390, document `scrollWidth === clientWidth === 390`. The horizontal timeline scrolls internally. The browser capture adapter scales the page and leaves black padding; these artifacts are not a pixel-perfect desktop/mobile certification. Existing reduced-motion/3D engine behavior was not fully revalidated; keyboard/reduced-motion/full error recovery and the human desktop/mobile journey remain grouped for October 21. No routine full build/release/audit was run locally before that date. Existing CI remains enabled and must be read at the final H4 SHA.

Local screenshots, not team-uploaded/human acceptance: `C:/Users/holap/Documents/Codex/HAC54-evidence/h4-tracking-transit-desktop.jpg` and `h4-tracking-incident-mobile.jpg`.

## How to open now

Use the existing connected Client account, not the explicit preview. Start at `http://localhost:3000/clients/tracking`. For the transit case use `/clients/tracking/fb4e98b8-9a8b-424e-901f-908d84d6bd2f`; select **3D journey** for the conceptual scene. Critical incident: `/clients/tracking/8c389103-b117-44c8-b9b9-96c63f53b24f`. Delivered: `/clients/tracking/543c8ea5-4b90-48c9-b63d-d13120c403f0`. Rejection is in Bookings, not a physical tracking execution.

## Remaining acceptance boundaries

- Human CP-L1–L4 / integrated Client-intake and Carrier journey on October 21 remain unaccepted; screenshots from the agent and synthetic API consent are not human PASS. Do not move HAC-54 to Done or claim a final PR gate.
- Commercial actor/Facilities/intake integration on the shared approved manifest remains a cross-vertical acceptance task. This isolated local package does not activate Jean's hosted/base manifest or prove portable fixed entity UUIDs. Native contracts supply backend-generated UUIDs; deterministic idempotency and observed IDs are implemented, deterministic clean-database entity IDs are not.
- Google Maps provider is unavailable locally; successful real basemap/provider recovery is not verified. 3D is conceptual, not a routing/GPS/ETA provider. All operational data in this package is synthetic.
- Thermal mismatch is conservatively UNKNOWN in the native evaluator; no consumer change invents an INELIGIBLE classification. Native review invitations can exist for such plans, but the Client does not promote them to selectable options; selection/booking remain blocked.
- Quote expiry is October 20 22:00 UTC. Tracking remains readable afterward; a new dated commercial cut is needed for fresh write acceptance on October 21, not silent historical redating.
- No full immutable request-event history, HAC-51 alternative-date/recovery implementation, live Carrier quote/GPS, Nova/provider audio, hosted seed/migration or deployment is certified by H4. No new branch, main push, merge or infrastructure change.
