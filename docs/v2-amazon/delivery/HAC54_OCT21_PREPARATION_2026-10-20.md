# HAC-54 — current-main integration and October 21 local preparation

Owner: Luis. Branch `codex/v2-client-commercial-operations`, draft PR [#133](https://github.com/Chujutak2024/cargomesh/pull/133), target `main`. This follow-up preserves H0–H4 and the October 19 schedule. **It does not certify human CP-L1–L4 acceptance, whole-issue completion, deployment, live GPS or a working Google Maps provider.**

## Current approved main / environment

- Prior H4 delivery: `c3c128192d0ca6326997f4f386605fd942282dcf`. All existing CI jobs at that SHA were successful; that does not certify a later commit.
- Updated approved main: `f17fdc66cdade6b2820925918df871444c52ae79`, including already-integrated HAC-52 / PR #132 and workspace/demo boundaries / #134. Merged into the registered HAC-54 branch without reset/rebase using merge commit `742ea7053d19bf13cc7099701dff58ff76a89e9b`. The only conflict was package scripts: retained main's current scripts and HAC-54 additions. No direct main push, PR merge, force-push or deployment.
- Existing isolated V2 Docker bank was backed up before applying **eight unchanged migrations already in approved main**. Ledger advanced 29 → 37 without reset, preserving records/accounts. `scripts/hac54-local-main-upgrade.mjs` pins that main SHA, compares each pending SQL source against Git, verifies the named Docker gateway and existing backup, and applies/records pending migrations in one transaction. It does not edit migration source. Other Docker stacks and hosted databases are untouched.
- Private backup: `C:/Users/holap/Documents/Codex/HAC54-private-backups/v2-before-main-20261020.dump` (2,163,327 bytes). Contains private Auth/database material: do not upload/commit. Restoration is a separate destructive operation, not an automatic fallback.
- App is running on `http://localhost:3000`; V2 gateway is `http://127.0.0.1:61321`.

## Dated data / replay

See the separate [October 21 recipe, exact dates, commands and observed UUID manifest](../../../supabase/scenarios/v2-hac54-validation-2026-10-21/README.md). Twelve native synthetic cases were prepared and replayed successfully on October 20. Six execution chains pass the actual production tracking assembler; Client/Carrier execution DTOs agree. Anonymous/cross-tenant execution/events/incidents are denied with 401/404. Negative thermal/coverage/occupied/unknown cases never produce a selectable commercial success.

Preparation leaves future transit/delivery/incident executions **PLANNED**, without fake physical events. A pure scenario policy separates preparation from execution and rejects early/closed execution. Opportunity deadline and hold expiry were corrected to fit the native pickup/assignment windows after native 400 rejections; no domain guard was weakened and the same action keys/IDs were retained. The old October 20 recipe and transactions were not redated.

Manual comparison request: `8671391b-89a8-44c0-9e14-b99c5af26bc7`; offers `f5c6f066-1bf3-4c59-8888-691c71aa31d7` (USD 350) and `7411d35c-e0d3-4283-a569-7d963b37d77f` (USD 325); ranking `c2c4be04-b57a-4a0f-b561-965b321834b7`. Actual browser shows both available offers, correct Carrier identity, pending decision and **Bookings 0**. The runner does not select/authorize this case or replace future human records. Prices are native **synthetic local Carrier quotes**, not live commercial prices.

Keys/replay are deterministic in this existing bank; native entity UUIDs are backend-generated. This is not a portable clean-database ID manifest or activation of Jean's base dataset. Seed integration remains coordinated with its owner.

## Google Maps: exact external blocker

The user-supplied key is configured only in the ignored app `.env.local`, under `NEXT_PUBLIC_GOOGLE_MAPS_JS_API_KEY`. No key is in Git, screenshots, reports or PR text. The browser confirms the Google script loads with a key, then reports **`RefererNotAllowedMapError`**. This is an origin restriction, not proof of a billing, network or invalid-key error. The shared map renderer/3D engine was not changed to bypass it.

The user confirmed they do not have Google Cloud access. A project/key administrator must add **`http://localhost:3000/*`** under the key's allowed website referrers, keeping its other API/application restrictions. Then reload the page and retest; no successful basemap/provider recovery is claimed. No new cloud project, billable service, unrestricted key or account permission was created.

Primary guidance: [Google error definition](https://developers.google.com/maps/documentation/javascript/error-messages#referer-not-allowed-map-error), [API key restrictions](https://developers.google.com/maps/api-security-best-practices#restricting-api-keys). The existing unavailable-provider state/retry and conceptual 3D remain separate from real maps/GPS.

## Current-main handoff checks and the organization blocker

`scripts/hac54-main-handoff-local.mjs` uses the actual FE-1 intake/commercial clients and authenticated SSR session against localhost. It does not replace the form/chat state or select/book on the human's behalf.

Observed independent results:

- Native intake options report `source=api`, `fixtureReason=null`. Selected Lima/Arequipa IDs exist in the authenticated tenant's Facilities collection.
- Actual `createFreightRequestV2` → same-payload replay → `getFreightRequestV2` preserves ID, version, tenant and canonical Facility IDs. New synthetic DRAFT `f7c29f03-50e9-4b4a-9c42-0ab6e19b170e`, version 1, remains DRAFT (not submitted/quoted/booked).
- Current cargo-readiness: `COMPLETE`, `NOT_EVALUATED`; serviceability is **UNKNOWN**, not promoted to eligible. Stale readiness version 409; changed payload/same key 409; foreign/anonymous readiness reads 404/401.
- Actual commercial refresh/inspection sees two available backend-ranked options for the manual case and resolves the real persisted synthetic Carrier identity; no new decision/booking.

**Integrated Client context is blocked, not PASS.** Cookie-authenticated `GET /api/v2/client-context` returns 400 `VALIDATION_ERROR`, `value.defaultCurrency: Invalid literal value, expected "USD"`. Historical `v2-road-baseline` seeded QA tenant A with `PEN`, whereas the current Organization V2 schema requires USD. This is organization metadata, unrelated to offer prices.

A native `organization.revise` proposal with the current version was attempted for that exact synthetic tenant and returned **403 FORBIDDEN_TENANT**: the existing QA A membership is `SUPERVISOR`; this action requires `OWNER`. No active synthetic OWNER for that organization was found. No mutation, role escalation, privileged SQL repair or permissive schema fallback was applied. The final seam script reports the known blocker and exits **2** after independent assertions; it must not be reported as full handoff PASS. Resolution needs the authorized organization owner / coordinated correction of Jean's QA base data; do not silently modify his base seed or grant a new role.

Run from `cargomesh/` with the existing private access file:

```powershell
$env:HAC54_LOCAL_ACCESS_FILE='C:/Users/holap/Documents/Codex/CargoMesh-HAC54-local-access.txt'
$env:HAC54_LOCAL_AUTHORIZE_SYNTHETIC_DRAFT='1'
node --env-file=.env.local --conditions=react-server --import tsx scripts/hac54-main-handoff-local.mjs
```

This tests existing main adapters, not a new Juan/HAC-53 delivery, real Nova audio or human form↔chat acceptance. HAC-53 was still pending with no new attached delivery at this check. Shared auth/Facilities/shell/Nova and Carrier UI were not edited.

## Verification / handoff

| Check at this source cut | Result |
| --- | --- |
| Focused H4 + new scenario policy tests | **47/47 PASS** |
| `pnpm test:client-operations` (existing CI step, including scenario policy) | **79/79 PASS** |
| Current-main integration seam unit tests (tracking, settings/context, intake, serviceability) | **45/45 PASS** after main synchronization |
| `pnpm typecheck` | PASS |
| `pnpm check:architecture` | PASS, 645 modules / 193 client entry points |
| Dated prepare + idempotent replay | PASS, 12 cases, six exact execution chains; future events absent |
| Actual intake/commercial client runtime checks | Independent assertions above pass; context blocker makes overall handoff **PARTIAL / exit 2** |
| Real browser | Two current offers, pending decision/booking verified; Google referrer error identified. Not a broad visual/mobile/keyboard/voice acceptance audit |
| Full local build/release/pgTAP | Not re-run routinely before October 21, per current plan. Existing automatic PR CI remains enabled and must be read for the final pushed SHA |

Local screenshot: `C:/Users/holap/Documents/Codex/HAC54-evidence-20261020/oct21-offers-ready.jpg`. This is agent evidence, not team-uploaded human CP acceptance. Private secrets/backups and the screenshot are outside Git.

For immediate viewing: `/clients/bookings`, manual comparison `/clients/requests/8671391b-89a8-44c0-9e14-b99c5af26bc7`, planned tracking `/clients/tracking/4263816c-7646-4424-80a0-6b718e91415d`. For already-reported synthetic transit today use the unchanged October 20 case `/clients/tracking/fb4e98b8-9a8b-424e-901f-908d84d6bd2f`.

Remaining: Google referrer authorization; QA organization currency/OWNER dependency; grouped human CP-L1–L4, form/chat and Carrier end-to-end acceptance on October 21; authorized final gate/integration. HAC-54 stays **In Progress** and PR #133 stays incremental/draft. This report supersedes the earlier *local migration gap* and *no fresh October 21 recipe* caveats only at this new cut; it does not rewrite historical evidence or certify hosted state.

Material blockers and native constraint corrections are also recorded in the [friction log](./friction-logs/HAC54_OCT21_PROVIDER_AND_CONTEXT_2026-10-20.md).
