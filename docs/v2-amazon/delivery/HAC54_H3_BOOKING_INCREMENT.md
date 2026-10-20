# HAC-54 H3 — explicit selection, booking, resources and history

Owner Luis; registered branch `codex/v2-client-commercial-operations`; existing draft PR #133 to `main`. Parent cut: H2 `40f3fa6a22a01e80f8439f92dce5bf28cc79ac22`. This is an implementation/local-verification increment, not human CP-L3 acceptance, main integration or completion of HAC-54. The user explicitly requested H3 after the H2 local follow-up.

## Implemented

- Client selection and booking keep the **same idempotency key and evidence timestamp/payload** on retries. A synchronous selection guard complements the existing booking guard. Intent identity persists before submission in session storage, scoped to organization/member/request/action and exact choice. Storage failure/corruption stops submission instead of silently rotating an ambiguous action. This is not another business-state store; decisions and bookings still come from native reads. A new tab/device must re-read native state; no cross-device retry guarantee is claimed.
- Native `WorkflowInputsV2` validates commands. Decision/booking responses must identify the intended request/plan/offers or decision/offer; the connected view additionally checks organization and Carrier. A native idempotency receipt may retain an old projection/state: a replay re-reads its exact authorized resource rather than presenting the original snapshot as current. No native guard, permission or schema was relaxed.
- Client consent remains explicit. Comparing an option or opening consent never authorizes another booking. Unknown, superseded, expired, withdrawn and mismatched chains cannot become a selectable alternative. Request version, current quote and capacity validation remain native authority; creation does not invent an `expectedVersion` field. Carrier confirmations retain native expected-version checks.
- Bookings now show the authorized **Carrier name**, distinct from the quote reference. The linked resources disclosure reads current native capacity reservations and executions by booking parent, not a stale embedded confirmation snapshot. It distinguishes temporary holds, committed/released capacity, planned/started/completed/cancelled executions and unknown start/delivery. Exact booking/decision/offer/Carrier references are inspectable. Planned execution is never labeled as started, GPS or delivered.
- Request detail and commercial refresh include those correlated resource reads. Parent budget is 25; an oversized/failed read is explicit and blocks commercial mutation until a complete refresh. Foreign-parent, request, Carrier and tenant records are not promoted to valid resources.
- History adds a separate commercial chronology from persisted selection/authorization/last booking response timestamps. Existing URL search/status/date filters also filter this commercial group. It is not a complete immutable transition log: the latest response snapshot is labeled as such. Physical execution events remain in their separate section; no physical event is fabricated from booking status. Existing request URLs/back-navigation are retained.
- Offer withdrawal outcomes use authoritative envelope status, preserving the immutable issuer snapshot.

No new dependency, Carrier UI/wrapper, shared SQL/schema, intake/shell/Nova component or hosted configuration was changed. The narrow voice route change belongs to the preceding H2 cut.

## Local environment correction

The local migration ledger stopped at `20261010225539`. Real booking creation exposed a missing `offerId` in the older read projection. Replayed the **existing, unchanged, committed** migration `20261015122904_hac50_booking_offer_projection.sql` against `supabase_db_cargomesh-v2-local`, checking its prerequisite function/column and gateway `127.0.0.1:61321`. The exact migration is recorded atomically in the local ledger by `cargomesh/scripts/hac54-local-booking-projection.mjs`. No reset, deletion, commercial SQL insert, guard bypass, hosted connection or unrelated Depot/Border/Driver migration was performed.

This is a targeted local migration, **not a claim that the entire local migration chain is current**. Earlier pending Depot migration and later unrelated migrations remain pending; a later general local upgrade must include missing earlier versions rather than assuming every version below the latest ledger entry is applied. Future environment setup should use the full approved chain. Other environments need this existing projection or later compatible migrations before the strict booking write/read adapter is usable.

## Real local synthetic transaction

Extends the dated H2 case without resetting historical records. Quote expiry: **October 22, 2026 00:00 UTC**; planned transport: October 23. Native user actions are independently authenticated Client and Carrier OPERATOR; not impersonated roles.

| Entity | ID / state |
| --- | --- |
| Request | `745929db-5a19-48f1-8667-3c04358c0771`, native request status remains PENDING |
| Selected offer | `a1e63e89-7454-42bc-bf0e-d26c9d3338a8`, v2, synthetic USD 325 |
| Decision | `6a92530a-3ec7-4675-abec-5f0b13562d31` |
| Booking | `825043bd-120f-4def-8de4-cd03a589136c`, CONFIRMED, v2 |
| Capacity reservation | `693b1d22-428a-47c9-9f1e-9c337c040cba`, CONFIRMED, SIMULATED evidence, 1000 kg / 2 m³ |
| Execution | `36080061-154c-4c87-a114-8908fe2c82da`, PLANNED, v1; no start/delivery |

Runner: `node --env-file=.env.local --conditions=react-server --import tsx scripts/hac54-h3-local.mjs`, from `cargomesh/`, with process-only Client/Carrier passwords and **`HAC54_LOCAL_AUTHORIZE_SYNTHETIC_BOOKING=1`**. It refuses nonlocal origins or expired dates. This explicitly authorized synthetic test consent is not a live contract or proof of a human UI click. Existing credentials remain outside Git. Replay the existing projection runner first only where that version is absent and prerequisites match.

### Checks actually executed

| Check | Result |
| --- | --- |
| `pnpm test:hac54:h3` (same final five test files executed directly) | **19/19 PASS**: intent persistence/isolation/storage failure, identical retry payloads, wrong response IDs, expiry/missing offers, conservative legacy correlation, cancelled pair not reauthorized, resources/history scope, failed reads and pagination |
| `pnpm typecheck` | PASS after implementation |
| `pnpm check:architecture` | PASS; 615 modules / 185 client entry points inspected, not an authorization proof |
| Native decision replay | Same persisted decision ID |
| Intentional lost booking response **after native persistence**, then retry same key/payload | Same single booking; no fabricated local success |
| Same decision/offer with another key; same key changed payload | Expected 409; no duplicate booking |
| Superseded v1 selection; historical expired quote authorization | Expected 409; expired case `DECISION_OFFER_NOT_CURRENT`; old records unchanged |
| Foreign-tenant booking / anonymous booking read | Expected 404 (existence hidden) / 401 |
| Carrier confirmation without committed capacity | Expected `409 CAPACITY_COMMITMENT_REQUIRED`, observed before the first successful confirmation; safely skipped on later already-confirmed reruns |
| Stale expected booking version | Expected 409 |
| Native hold/Carrier confirmation; final Client/Carrier reads | Same confirmed booking; confirmed capacity and planned execution; no execution event or delivery invented |
| Actual browser | Client Bookings rendered USD 325 / confirmed status. Expanded resource disclosure showed 1000 kg / 2 m³, SIMULATED evidence and PLANNED execution. History showed selection/authorization/confirmation; searching `745929db` filtered that group to this case. No Client error boundary observed in these checks. |

Local screenshot: `C:/Users/holap/Documents/Codex/HAC54-evidence/h3-booking-resources.jpg`. This is local agent evidence, not an uploaded team artifact or human PASS. No automatic screenshot substitutes for CP-L3.

## Remaining boundaries / next increment

- H4 owns tracking route/events/provider/recovery/error cases and the separate 12-case commercial scenario. This one H2/H3 positive case is not that full seed or a delivered shipment. Do not backdate/fake an execution start to show progress before its planned window.
- HAC-51 recovery/alternate-date rules are not implemented here; no alternative is selected or booked automatically. Existing rejection/cancellation presentations remain. A fresh **persisted rejected booking** scenario and interactive rejection/consent/mobile/keyboard checks remain for grouped validation; a pure negative-state test is not equivalent to that run.
- History has no native full revision/transition enumeration in this consumer. It displays available audit timestamps/last state, not invented intermediate changes. Historical intake cloning remains with the intake owner; no alternate prefill contract was created in H3.
- Voice grant/context was verified in H2; real Nova microphone/provider/audio acceptance is still untested. No AWS/provider connection was opened for these local checks.
- No routine full release/build/UI audit was rerun before October 21. H2 CI on `40f3fa6` was independently observed green; it is not evidence for a later H3 SHA. Existing CI remains enabled. Final CI/human acceptance must be checked on the integrated cut.

Open locally: `/clients/bookings`, expand the USD 325 booking; `/clients/history?q=745929db`; `/clients/requests/745929db-5a19-48f1-8667-3c04358c0771`. HAC-54 remains In Progress; PR #133 stays draft/incremental. No main push, merge or deployment.
