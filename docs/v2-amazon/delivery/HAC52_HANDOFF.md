# HAC-52 implementation handoff

Owner: Jean Paul. Integrator: Cristhian. PR: https://github.com/Chujutak2024/cargomesh/pull/132.
Initial and final fetched base: `c7e394db3c0d2d135011ad601df161cf05b61620`.
Branch: `codex/v2-client-identity-facilities`. No synchronization merge was needed.

- H0: `f3a19d297439b7cde22fda37c72f1ee79f16ffb6`, [contract](HAC52_CLIENT_IDENTITY_CONTRACT.md).
- H1: `f7e9b4fe6cdba99125c696b63dfe269f9c65e962`, connected local identity.
- H2: `2c7c16036958260c7f5c1992c093f447c3fcf6ab`, persisted settings editors.
- H3: this PR's seed/context increment; exact SHA is recorded in the PR body.

Open http://127.0.0.1:59580/api/local/hac52/client-session and press **Open
connected Client workspace**, then `/clients/facilities` or
`/clients/organization`. [Startup and earlier checks](HAC52_LOCAL_DELIVERY.md).
The PE account is usable. Local technical verification is distinct from human
CP-J1..J3 validation on October 21; no human PASS is claimed.

## Seed and consumer boundary

`supabase/scenarios/v2-client-base/manifest.json` and `seed.sql` provide 3 Client
organizations, 8 Facilities, 3 profiles and 3 preferences with deterministic IDs.
Clock: `2026-10-19T12:00:00Z`; horizon ends `2026-11-02T12:00:00Z`. Countries/zones:
PE/America/Lima, BO/America/La_Paz, CL/America/Santiago. Addresses are identified
as fictitious. `PE_TACNA` demonstrates unknown hours without assuming 24/7.

Three own active Facilities are available in the existing intake options for PE.
This bank has zero Carriers. The seed does not create another fleet catalog,
request, opportunity, offer, booking or Depot. Juan consumes the IDs/options;
Luis supplies his separate commercial seed and verifies the existing Carrier
catalog in the chosen integration environment.

## Assistant adapter supplied to Juan

Server factory: `clientContextForCurrentMember()` in
`server/modules/client-context/infrastructure/client-context-server.ts`.
The actor is resolved from validated Auth/membership, never supplied by the browser.

| Endpoint | Contract |
| --- | --- |
| `GET /api/v2/client-context?limit=25&offset=0` | Own organization plus individually paginated Facilities, profiles and preferences. |
| `POST /api/v2/client-context` | Prepare `{ action, resourceId, expectedVersion, idempotencyKey, value }`. |
| `POST /api/v2/client-context/confirm` | Execute `{ confirmationId, confirmed: true }` after explicit user confirmation. |

Actions: `facility.create/revise`, `organization.revise`,
`cargo-profile.create/revise`, `preferences.create/revise`. Creation uses null
resource/version; revision requires UUID and positive expected version. Values
reuse the domain schemas. This HTTP surface uses session cookies; both POSTs
require the same origin. Existing REST endpoints remain available to consumers.

Preparation persists a tenant/member-bound proposal with SHA-256 fingerprint,
10-minute expiry and `requiresConfirmation: true`; it makes no business mutation.
Juan must show the proposal and ask the user before calling confirm. Do not
auto-confirm an assistant proposal. Confirmation rechecks active membership,
organization and role, invokes the existing atomic domain command and reads the
result back. Replay is stable; stale versions return 409. Expired proposals need
a fresh reviewed proposal. The private confirmation table has RLS, an indexed
scope and no direct authenticated grants. Another organization cannot inspect or
confirm it. Assistant component/tool wiring remains Juan's consumer integration;
HAC-52 does not edit his files.

## Executed H3 evidence

All commands below ran from the worktree root unless stated otherwise. Raw logs
are outside Git under `C:\Users\Usuario\Documents\Proyectos\hac52-evidence`.

| Exact command | Actual result |
| --- | --- |
| `node scripts/hac52/seed-local.mjs C:\Users\Usuario\Documents\Proyectos\hac52-private\client-access.json` | Initial execution exit 0: 3 accounts, 3 organizations, 8 Facilities, 3 profiles/preferences. Seed count 8 → 8. |
| `node scripts/hac52/verify-seed.mjs C:\Users\Usuario\Documents\Proyectos\hac52-evidence\h3-seed-replay.json` | Exit 0; two further SQL reruns preserved complete row content, edits, timestamps and versions. |
| `node scripts/hac52/verify-sql.mjs C:\Users\Usuario\Documents\Proyectos\hac52-evidence\h3-rls-tap.txt` | 30 assertions passed; authenticated role + real synthetic JWT claims. Temporary fixtures rolled back. |
| `node scripts/hac52/verify-h3.mjs C:\Users\Usuario\Documents\Proyectos\hac52-evidence\h3-http.json` | 12 checks passed against actual local HTTP: scoped context/intake, no mutation on prepare, confirmation refusal/acceptance/replay, unknown hours. |
| From `cargomesh/`: `node --conditions=react-server --import tsx --test src/server/modules/client-context/application/client-context-service.test.ts` | 3 passed, 0 failed. |
| From `cargomesh/`: `pnpm typecheck` | Exit 0 after adapter changes. |
| `pnpm --dir cargomesh check:architecture` | Exit 0; `Architecture OK`. |
| `pnpm --dir cargomesh build` | Exit 0. Only the local public API URL/anonymous credential was supplied in memory; no `.env` file created/copied. |

Seed replay hash: `d8f3bb11a78bb68184a4c9b0ccf7ad7e4861c6cf102504a0d1aece25e8015c7e`.
Post-SQL counts: temporary confirmations 0; Carriers 0; PE active owner 1.
The first Carrier positive control lacked `CARRIER_EDITOR` and failed. Its
dependent negatives were not accepted as PASS. The temporary fixture was
completed from the actual authorization contract and the focused file passed on
rerun; no production policy or gate was relaxed. Foreign read/write, Carrier-only
membership, Requester/Supervisor roles, empty organization and confirmations have
positive controls in the same transaction. No full release suite was run.

## Exact hosted prerequisites — not applied

1. Review/apply these additive migrations in order after the existing chain:
   `20261020000100_hac52_facility_civil_hours.sql`,
   `20261020000200_hac52_client_action_confirmations.sql`.
2. Administrator provisions the approved synthetic Client account, isolated
   organization and active member via an authorized hosted procedure. No hosted
   Auth credential or provisioning command is supplied by this task.
3. Deploy identity/pages/context endpoints without changing production branch,
   root directory or aliases. Do not deploy the private access file or enable
   the local `hac52-client` profile hosted.
4. The seed deliberately rejects hosted databases. Any hosted demo dataset needs
   a separately approved deployment script/ID policy; do not remove its guard.
5. Juan wires confirmed assistant actions; Luis supplies commercial relations
   and verifies the existing Carrier catalog. No fleet duplication is required.

## Blocked local access recovery

PE connected access remains usable. A provisioning rerun during H3 overwrote the
private file's BO/CL entries while preserving PE. Organization/membership/business
rows were not lost. The corrected provisioner preserves the existing object
(`...old`) before writing its own fields.

Automatic approval review rejected recovery of those two credentials because it
administers local credentials with a local service-role key and stores passwords,
conflicting with the general no-secrets rule. No recovery action was executed or
worked around. Explicit user authorization is pending for exactly the two owned
synthetic BO/CL accounts and the private file outside Git.

Prepared action: `scripts/hac52/recover-owned-access.mjs`.
`--check` passed: two exact owned synthetic identities verified; no password
change, private-file write or service-key access. The mutating
`--recover-owned-bo-cl` mode remains **BLOCKED pending user authorization**.
After approval, execute it and rerun the seed provisioner to verify retained
access entries. Until then, repeated BO/CL Auth provisioning is not certified;
SQL seed replay is verified. PR remains an incremental draft pending this step.

## Preserved scope

No hosted database/Auth/seed action; no merge, direct main push or force-push;
no Linear state change; no shared shell/sidebar/filter/assistant, commercial or
Carrier agenda/Depot edit. HAC-51 still contains `2bcb1ba`, with preserved head
`c9cd7bb0f686299920b017a4a15dfaf129c7fa5a`; it is not integrated in main.
The original checkout retains its original branch and its two pre-existing
untracked Devpost files. Logs, private access and backups stay outside the repo.
