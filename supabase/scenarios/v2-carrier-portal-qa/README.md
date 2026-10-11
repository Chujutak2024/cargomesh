# HAC-44 carrier portal synthetic scenario

LOCAL_ONLY / SIMULATED. Final HAC-45 API retest on main `e8a04cb19dd0df9d859a15db1b4948b0384308ce`, integrated into QA test cut `7a4aaa1ba7055ab8dafb29d960a7bfd6076c28cb` by an authorized no-ff merge. CP-1b before evidence remains anchored to `9d0c3ee32179f00242a6961b90116293a1bc6d0e`. This package changes scenario data and local QA scripts only. This is HTTP/RPC evidence; browser rendering acceptance is not included.

## Native writers and bootstrap boundaries

`seed.sql` includes the unchanged full-flow `control.sql` exact-PK registry. The Python runner loads the unchanged ROAD catalog/fleet/crew/request JSON templates, then expands SQL includes. `open-flow.sql` and `conflict-flow.sql` construct two requests and three eligible plans/opportunities through native commands. The initial opportunity status is `SENT`, the actual open/waiting state at this SHA. There are no preexecuted offers, decisions, bookings, holds, executions or incidents.

Catalog and fleet use `command_v2_catalog`; operators use `command_v2_identity_directory` (invite, own consent/accept, optional revision); workflow uses request RPCs and `command_v2_workflow`; carrier limits use `command_v2_carrier_workflow` with the actual initial ADMIN identity. Seed, verification and functional HTTP/RPC tests never disable guards.

Literal inserts are limited to bootstrap seams without a public onboarding writer: the separate setup and shipper organizations/OWNERs, Auth placeholders, each carrier's initial ADMIN and server-owned `private.v2_catalog_grants`. The ACTIVE/unverified operator is a deliberately invalid identity anchor because the native directory refuses to create that state. Other operator identities use native commands. Expired/revoked grants are explicit server provisioning fixtures. Catalog setup uses a dedicated OWNER with CATALOG_ADMIN in its own organization (ordinal 12). The shipper OWNER (ordinal 1) has no catalog grant or carrier identity and only creates requests, selects offers and authorizes bookings. Setup publishes global catalog/routing policies and supplies endpoint controls and crew preparation. Neither organization actor has a carrier identity; carrier actors have no organization memberships.

Bootstrap UUIDs occupy `e4400000` through `e44f0000`; seed scans every UUID column in public/private/auth and aborts on collision. Native commands generate their own UUIDs; cleanup records exact primary keys in `hac44_qa.ids`. Prefixes and names are never deletion predicates. The preexisting eight V2 reference cargo categories remain baseline data; no V1 carrier/request data is introduced.

## Local bank and commands

Use Windows PowerShell from the new worktree. Set `HAC44_EVIDENCE` to an external directory, `HAC44_PROJECT_PREFIX` to a dedicated project name, `HAC44_PORT_BASE=48000`, and `HAC44_CLI` to the actual verified Supabase executable. The tested CLI was 2.117.0. The runner requires configured ports in 48000–48999 and reuses HAC-44 `banks.py` project configuration, actual `com.supabase.cli.project` resource labels, external ownership marker and database marker. Each SQL/Auth/cleanup operation rechecks ownership. It never targets the hosted project or banks on 47000/62000.

```powershell
$env:PYTHONDONTWRITEBYTECODE='1'
$env:HAC44_CARRIER_CYCLE_SET='a-new-evidence-label'
python scripts/qa/carrier_portal.py prepare
python scripts/qa/carrier_portal.py cycles
python scripts/qa/carrier_portal.py pgtap
python scripts/qa/carrier_portal.py stop
```

`prepare` checks immutable migration provenance and builds this dedicated local bank from the V2 main migrations. SQL runs through the owned Docker socket with `psql -X -A -t -v ON_ERROR_STOP=1 -v local_only=1`. A functional contract failure retains exit 1. The HAC-45 cycle runner preserves both repetitions and mandatory cleanup, including failures for publication; a missing prerequisite is explicitly BLOQUEADO in its snapshot. Evidence snapshots are immutable directories `cycles/<label>/1` and `2`; an existing label is rejected. Do not interpret process exit 1 as a teardown failure without reading the phase records.

`pgtap` loads the unchanged `v2-road-baseline` prerequisite, runs every V2 suite listed in `supabase-v2/test-profiles.json`, and cleans its separately registered exact IDs. No gate or fixed test-count requirement is changed. `test:mcp:local` is outside this V2 task and is not reported as passing.

## Auth and manual login

Seeded Auth users are confirmed local placeholders with no credential, identity or session. The runner assigns fresh cryptographically random credentials through the owned LOCAL Auth admin API, then verifies real Auth session principals. HTTP uses those real bearer sessions and a real local Auth cookie; the unchanged Next request stores, Hono application, services and RPCs run over loopback HTTP. This is API evidence, not a rendered browser acceptance test.

For a temporary manual portal login, run seed and verify first, then:

```powershell
python scripts/qa/carrier_portal.py manual-login --credentials-file <absolute-path-outside-repo-and-evidence>
```

The destination must not exist. It is checked before Auth mutation, written only at the explicit external destination and reread for integrity. Credential values never enter command arguments, Git, logs or reports. Keys and functional sessions stay in memory. Cleanup invalidates these users/sessions; provision again for a later manual session. The HTTP runner independently rotates credentials, so run manual-login immediately before manual use rather than before an HTTP test.

## Contract references used by the case matrix

- I10: `docs/v2-amazon/contracts/IDENTITY_AND_MCP_CHANNELS.md:10` — active, verified own-carrier identity plus independent current server grant.
- I14: the same file `:14` — ADMIN/OPERATOR/DISPATCHER permissions and own-carrier reads. This is the target permission contract for carrier-only catalog access, even though the older catalog writer still requires an organization member.
- I60: the same file `:60` — actual Auth, user-scoped RPC, 401 without credentials.
- W7/W9: `docs/v2-amazon/delivery/HAC40_WORKFLOW_API.md:7` / `:9` — HTTP authentication, idempotency, envelope and current evaluated snapshots.
- W19–28: the same file `:19` through `:28` — opportunity, offer, decision, booking, hold, execution and incident endpoint families.
- W38/W40: the same file `:38` / `:40` — shipper authorization, carrier confirmation, reservations, confirmed crew, execution and booking completion.
- F30/F32/F52: `docs/v2-amazon/contracts/TRANSPORT_PLANS_AND_FLEET.md:30` / `:32` / `:52` — effective capacity, all-resource eligibility and prevention of overlapping commitments.

RPC mapping: own-carrier workflow GET/POST uses `read_v2_carrier_workflow` / `command_v2_carrier_workflow`; shipper workflow uses `read_v2_workflow` / `command_v2_workflow`; catalog GET/POST uses `read_v2_catalog` / `command_v2_catalog`; request creation/submission uses `create_v2_freight_request` / `command_v2_freight_request`. The HTTP source and recorded request bodies contain the exact command actions. In the matrix, `:id` stands for the actual native UUID saved in each cycle's inventory/response.

## Historical CP-1b defect and evidence limits

Before HAC-45, carrier-only profile and catalog access returned `403 FORBIDDEN_TENANT` despite a valid ADMIN/operator/grant and nonempty catalog fixtures. The same profile succeeds for the independent setup OWNER + CATALOG_ADMIN and is explicitly an endpoint control, not carrier authorization. The carrier driver-assignment POST also returns 403; the unchanged native catalog seam succeeds with the separate setup actor, allowing the workflow test to continue without adding shipper membership to carrier users. These are reproduced product/contract defects, not a reason to change expected results. Backend owner: Axel / HAC-41; consuming portal owner: Juan / HAC-43, as recorded in `docs/v2-amazon/delivery/HAC43_MODEL_TRACEABILITY.md:14,61` and `docs/v2-amazon/delivery/friction-logs/HAC43_LOCAL_ENVIRONMENT_2026-10-07.md:29,30`. Reproduction: seed + verify + `http`, then inspect the profile, catalog and driver-assignment cases. The harness exit remains 1.

Calendar conflict is measured after a positive hold and actual carrier confirmation. Revalidation of the second assignment rejects the overlapping commitment with `409 BOOKING_ASSIGNMENT_NOT_CURRENT` before another hold is inserted. Driver conflict independently returns `409 FLEET_COMMITMENT_CONFLICT`. Insufficient capacity returns HTTP 201 for the recorded candidate with domain status `ineligible` and a capacity reason; its paired control is an otherwise compatible eligible C2 plan. A 201 here does not mean capacity acceptance.

The active page imports `CarrierPortal` (`cargomesh/src/app/carrier-portal/page.tsx:2`); that component and `CarrierMap` use `portalRequest` and resource paths. Static inspection found no active demo fallback in this page tree. This is not a browser rendering certification. All 28 resource collection paths in `carrierResources` were probed after the flow. CP-1b fills metrics, OPEN LTL consolidations and spare-asset events through native writers during HTTP execution. Both carriers have one exact row in each collection. ADMIN/OPERATOR/DISPATCHER own-carrier reads find exact IDs; other-carrier and shipper reads are denied with paired nonempty controls. This proves authorization and data, not a complete shared LTL trip. The consolidation follows the ROAD LTL service, physical asset/calendar, carrier-linked route and native writer recipe in `supabase/scenarios/v2-full-flow-qa/ltl-seed.sql`; it has no member executions or reservations. Spare LTL assets enter MAINTENANCE only after the primary booking completes. The HAC-45 retest adds map routing and all resource collection/detail reads for all three roles, profile revision and driver-assignment role denials. Every optional mutation/state transition is not covered by this booking flow; the API inventory must not be read as full UI acceptance.

## Exact-ID teardown exception

The user explicitly authorized suspension only inside `cleanup.sql`, after ownership verification of this dedicated local bank. The implementation adapts `v2-full-flow-qa/cleanup.sql` instead of introducing a second deletion algorithm. External business and credential-free Auth backups are required before entry. Within one transaction it snapshots the exact rows (Auth uses an explicit metadata whitelist) and every affected ordinary trigger's O/A/R/D state, audits incoming FK definitions including implicit CASCADE actions, and disables only noninternal triggers of affected tables. It deletes child-first by registered PK, never by name/prefix or with CASCADE. An external child or an FK cycle aborts and rolls back everything. FK and CHECK constraints stay active. Original trigger states and unchanged baseline rows are checked before COMMIT, and every owned business/Auth count must be zero.

Business backups preserve rows; Auth backups deliberately omit credential hashes, refresh material and MFA secrets, so restoring Auth requires fresh local provisioning. SQL backups/logs are outside Git. QA metadata (`hac44_qa` and `carrier_portal_qa`) and the untouched migration baseline are intentionally retained for evidence and ownership. The real Auth flow creates `auth.mfa_amr_claims` children; these are registered by exact session/user ownership, rather than relying on an Auth FK cascade.

The following inventories and matrix come from the two final CP-1b cycles. Full request/response bodies, exact UUIDs, commands, exits, ownership proofs and backups are external evidence; no credentials are included here.


## Shipper and carrier boundary

`docs/v2-amazon/contracts/IDENTITY_AND_MCP_CHANNELS.md:10,14,34` requires an independent active verified carrier identity/grant and restricts carrier reads to its own carrier. The shipper has neither; C1/C2 opportunity routes and the three new carrier workflow collections return 403 FORBIDDEN_CARRIER_IDENTITY. Each denial names its nonempty carrier control. The shipper cannot write driver assignments without a catalog grant (403 FORBIDDEN_CATALOG), paired with the setup actor's 201.

The conditional catalog-read denial is not asserted: the contract distinguishes OrganizationMember at `IDENTITY_AND_MCP_CHANNELS.md:9` and carrier principals at `:10,14`; `PRODUCT_SCOPE.md:47` permits discovery over 0..N services and does not explicitly prohibit shipper discovery reads. Our interpretation is that the own-carrier read restriction applies to carrier principals, not all organizational discovery. The current native reader enforces active organization membership but checks catalog grants for writes only (`supabase-v2/supabase/migrations/20261004032151_hac40_catalog.sql:164,178,208`). Shipper service reads for C1/C2 return nonempty 200 and are labeled discovery observations, never carrier authorization controls. A stricter shipper catalog-read policy requires an explicit contract decision; these observations do not certify such a policy.

DISPATCHER writes are measured positively for execution, incidents, asset events and consolidation; offers, booking confirmation, capacity confirmation and metrics publication return 403 FORBIDDEN_CARRIER_ROLE with positive controls. OPERATOR metrics publication is also denied; ADMIN publication succeeds. Own-carrier history reads remain available to all three roles, as the contract states at `IDENTITY_AND_MCP_CHANNELS.md:14`.

## Reproduction and retest criterion

Use a fresh external evidence directory and project prefix for `prepare` (it intentionally rejects an existing ownership marker). All API/RPC phases keep domain guards enabled. Run the commands above; inspect `cycles/<label>/{1,2}/result.json`, `logs/carrier-http-cases.json`, exact ID inventories, credential-free backups and cleanup counts. `cycles` retains exit 1 while the carrier catalog defect exists; never change its expected 200/201 responses to 403. For a standalone seeded/manual session, run `cleanup` before `stop`; the cycle and pgTAP runners already clean their own registered rows.

Backend owner Axel/HAC-41 must correct `cargomesh/src/server/hono/middleware/v2-auth.ts:19-25` and the carrier catalog authorization path so verified carrier-only actors work without OrganizationMember. Final portal retest must use the correction SHA delivered by the team: repeat profile/catalog/fleet positives under carrier-only ADMIN, preserve cross-carrier/role/identity denials and verify the full booking and cleanup cycles. The HAC-45 retest below completes the correction-SHA API retest; rendered browser acceptance remains outside this delivery.


## Actor and grant map

| Actor | Carrier/context | Role | Identity | Verified | Grant | Organization membership |
|---|---|---|---|---|---|---|
| shipper | independent shipper | OWNER | ACTIVE | True | NONE | own organization OWNER only |
| c1-admin | C1 | ADMIN | ACTIVE | True | VALID | none |
| c1-operator | C1 | OPERATOR | ACTIVE | True | VALID | none |
| c1-dispatcher | C1 | DISPATCHER | ACTIVE | True | VALID | none |
| c2-admin | C2 | ADMIN | ACTIVE | True | VALID | none |
| c2-operator | C2 | OPERATOR | ACTIVE | True | VALID | none |
| inactive | C1 | OPERATOR | INACTIVE | True | VALID | none |
| invited | C1 | OPERATOR | INVITED | False | VALID | none |
| unverified | C1 | OPERATOR | ACTIVE | False | VALID | none |
| expired | C1 | OPERATOR | ACTIVE | True | EXPIRED | none |
| revoked | C1 | OPERATOR | ACTIVE | True | REVOKED | none |
| setup | independent setup | OWNER | ACTIVE | True | CATALOG_ADMIN | own organization OWNER only |

## HAC-45 retest contract and fixture changes

`origin/main` was fetched at `e8a04cb19dd0df9d859a15db1b4948b0384308ce`, exactly the requested PR #123 merge (66d4bd7 and 69c64d6). There was no newer database/API delta. Merge cut `7a4aaa1ba7055ab8dafb29d960a7bfd6076c28cb` has parents 1449e3e and e8a04cb; it had no conflicts. Product files, migrations, CI and v2-road-baseline were inherited unchanged from main.

- Identity data is unchanged: no organization memberships were added to carrier actors. The current identity contract is `docs/v2-amazon/delivery/HAC45_CARRIER_PORTAL_INTEGRATION.md:12,16-20`; migration `supabase-v2/supabase/migrations/20261010225539_hac45_carrier_portal_identity.sql:15-28` delegates to the existing identity/grant guard.
- Profile/catalog/fleet HTTP probes now follow the Web namespace `/api/v2/carrier-portal/carriers/:id`; member setup/discovery controls retain `/api/v2/carriers/:id`. Sources: integration document `:26-30`, `cargomesh/src/features/carrier-portal/resources.ts:62-64`. Existing expected HTTP statuses and domain predicates were retained for all 127 historical cases.
- Seed adds an independent control driver per carrier through `command_v2_catalog`. The carrier ADMIN assignment now succeeds and would occupy the previous setup control's driver. This preserves both positive writers and the driver conflict negative without disabling commitment validation: migration 28 `:185-230`; `docs/v2-amazon/contracts/TRANSPORT_PLANS_AND_FLEET.md:52`.
- Seed fills partners, capacity pools, PROPOSED combinations, maintenance and repositioning using existing catalog writers/templates. Future January 2027 windows avoid the current booking window. These supply nonempty collection/detail controls required by the Web families: integration `:28`; migration 28 `:52-183,185-230,331-343`. No existing scenario/template was edited.
- Seed publishes one inactive shared condition through `conditions.publish`; it cannot constrain the plans. Map nodes/conditions are checked through native routing reads: integration `:29`; migration 28 `:357-365`; `cargomesh/src/shared/schemas/v2/workflow.ts:40-43`.
- `/carrier-portal/access` returns 200 with an empty list for actors without an authorized carrier, as specified by migration 28 `:349-355`. Their profile/catalog/workflow routes remain 403 with nonempty paired controls. Shipper discovery in the member namespace remains a separate observation.

The diagnostic set `hac45-final` completed two cleaned cycles with four incorrect new error-code assertions per cycle (HTTP 403 was correct). Catalog HTTP translates SQL PT403 to FORBIDDEN_CATALOG at `cargomesh/src/server/modules/catalog/infrastructure/supabase-catalog-repository.ts:8`; workflow retains FORBIDDEN_CARRIER_ROLE. The final set `hac45-retest` corrects that harness assertion only. No historical expected status was changed. A first fixture preflight transaction was rolled back because the new condition omitted the location region; it now reuses the canonical request location. These were QA harness/fixture errors, owned and corrected by HAC-44, not product defects. Their evidence is retained externally.

## Exact owned row inventory

The final two cycles independently returned every registered business/Auth count to zero. Auth values and sessions are never included in the inventory.

| Relation | Seed | Before cleanup | After cleanup |
|---|---:|---:|---:|
| `auth.audit_log_entries` | 0 | 24 | 0 |
| `auth.identities` | 0 | 0 | 0 |
| `auth.mfa_amr_claims` | 0 | 12 | 0 |
| `auth.refresh_tokens` | 0 | 12 | 0 |
| `auth.sessions` | 0 | 12 | 0 |
| `auth.users` | 12 | 12 | 0 |
| `private.v2_carrier_catalog_receipts` | 0 | 2 | 0 |
| `private.v2_carrier_workflow_receipts` | 2 | 16 | 0 |
| `private.v2_catalog_grants` | 11 | 11 | 0 |
| `private.v2_catalog_receipts` | 40 | 42 | 0 |
| `private.v2_identity_receipts` | 14 | 14 | 0 |
| `private.v2_request_command_receipts` | 2 | 3 | 0 |
| `private.v2_workflow_receipts` | 15 | 24 | 0 |
| `public.asset_cargo_capabilities` | 2 | 2 | 0 |
| `public.asset_status_events` | 0 | 2 | 0 |
| `public.capacity_calendars` | 4 | 4 | 0 |
| `public.capacity_consolidations` | 0 | 2 | 0 |
| `public.capacity_pools` | 2 | 2 | 0 |
| `public.capacity_reservations` | 0 | 1 | 0 |
| `public.cargo_capability_definitions` | 2 | 2 | 0 |
| `public.carrier_depots` | 2 | 2 | 0 |
| `public.carrier_operators` | 10 | 10 | 0 |
| `public.carrier_opportunities` | 3 | 3 | 0 |
| `public.carrier_service_cargo_categories` | 4 | 4 | 0 |
| `public.carrier_services` | 4 | 4 | 0 |
| `public.carriers` | 2 | 2 | 0 |
| `public.driver_assignments` | 0 | 2 | 0 |
| `public.drivers` | 4 | 4 | 0 |
| `public.execution_events` | 0 | 2 | 0 |
| `public.freight_requests` | 2 | 3 | 0 |
| `public.fulfilment_partners` | 2 | 2 | 0 |
| `public.incident_updates` | 0 | 1 | 0 |
| `public.load_allocations` | 3 | 4 | 0 |
| `public.logistics_nodes` | 2 | 2 | 0 |
| `public.operational_incidents` | 0 | 1 | 0 |
| `public.organization_members` | 2 | 2 | 0 |
| `public.organizations` | 2 | 2 | 0 |
| `public.plan_leg_assignments` | 3 | 4 | 0 |
| `public.plan_resource_bindings` | 3 | 4 | 0 |
| `public.plan_resources` | 3 | 4 | 0 |
| `public.repositioning_blocks` | 2 | 2 | 0 |
| `public.route_conditions` | 1 | 1 | 0 |
| `public.route_corridors` | 1 | 1 | 0 |
| `public.route_legs` | 3 | 4 | 0 |
| `public.route_planning_policies` | 1 | 1 | 0 |
| `public.route_plans` | 3 | 4 | 0 |
| `public.route_resource_limits` | 2 | 2 | 0 |
| `public.scheduled_maintenances` | 2 | 2 | 0 |
| `public.scoring_policies` | 1 | 1 | 0 |
| `public.selection_decisions` | 0 | 2 | 0 |
| `public.selection_offers` | 0 | 2 | 0 |
| `public.service_areas` | 4 | 4 | 0 |
| `public.service_lanes` | 2 | 2 | 0 |
| `public.transport_assets` | 4 | 4 | 0 |
| `public.transport_executions` | 0 | 2 | 0 |
| `public.transport_plan_candidates` | 3 | 4 | 0 |
| `public.v2_bookings` | 0 | 2 | 0 |
| `public.v2_carrier_metrics` | 0 | 2 | 0 |
| `public.v2_carrier_offers` | 0 | 2 | 0 |
| `public.vehicle_assignments` | 0 | 1 | 0 |
| `public.vehicle_combination_assets` | 2 | 2 | 0 |
| `public.vehicle_combinations` | 2 | 2 | 0 |

## Affected-table trigger inventory and reasons

Only affected ordinary triggers below are suspended in the authorized local cleanup transaction, then restored and compared before COMMIT. FK/CHECK remain active.

| Relation | Ordinary triggers, original state | Teardown-only reason |
|---|---|---|
| `auth.audit_log_entries` | none | No ordinary trigger to suspend; FK/CHECK remain active. |
| `auth.identities` | none | No ordinary trigger to suspend; FK/CHECK remain active. |
| `auth.mfa_amr_claims` | none | No ordinary trigger to suspend; FK/CHECK remain active. |
| `auth.refresh_tokens` | none | No ordinary trigger to suspend; FK/CHECK remain active. |
| `auth.sessions` | none | No ordinary trigger to suspend; FK/CHECK remain active. |
| `auth.users` | none | No ordinary trigger to suspend; FK/CHECK remain active. |
| `private.v2_carrier_catalog_receipts` | none | No ordinary trigger to suspend; FK/CHECK remain active. |
| `private.v2_carrier_workflow_receipts` | none | No ordinary trigger to suspend; FK/CHECK remain active. |
| `private.v2_catalog_grants` | none | No ordinary trigger to suspend; FK/CHECK remain active. |
| `private.v2_catalog_receipts` | none | No ordinary trigger to suspend; FK/CHECK remain active. |
| `private.v2_identity_receipts` | none | No ordinary trigger to suspend; FK/CHECK remain active. |
| `private.v2_request_command_receipts` | none | No ordinary trigger to suspend; FK/CHECK remain active. |
| `private.v2_workflow_receipts` | none | No ordinary trigger to suspend; FK/CHECK remain active. |
| `public.asset_cargo_capabilities` | `v2_fleet_command_guard` (O) | Exact-ID synthetic teardown; native domain guard blocks direct removal. |
| `public.asset_status_events` | `workflow_guard` (O) | Exact-ID synthetic teardown; native domain guard blocks direct removal. |
| `public.capacity_calendars` | `a_crew_calendar_guard` (O), `v2_fleet_command_guard` (O) | Exact-ID synthetic teardown; native domain guard blocks direct removal. |
| `public.capacity_consolidations` | `workflow_guard` (O) | Exact-ID synthetic teardown; native domain guard blocks direct removal. |
| `public.capacity_pools` | `v2_fleet_command_guard` (O) | Exact-ID synthetic teardown; native domain guard blocks direct removal. |
| `public.capacity_reservations` | `a_crew_reservation_guard` (O), `a_reservation_resource` (O), `v2_fleet_reservation_guard` (O), `z_workflow_reservation_sharing` (O) | Exact-ID synthetic teardown; native domain guard blocks direct removal. |
| `public.cargo_capability_definitions` | `v2_fleet_command_guard` (O) | Exact-ID synthetic teardown; native domain guard blocks direct removal. |
| `public.carrier_depots` | `v2_catalog_command_guard` (O) | Exact-ID synthetic teardown; native domain guard blocks direct removal. |
| `public.carrier_operators` | none | No ordinary trigger to suspend; FK/CHECK remain active. |
| `public.carrier_opportunities` | `workflow_guard` (O) | Exact-ID synthetic teardown; native domain guard blocks direct removal. |
| `public.carrier_service_cargo_categories` | `v2_catalog_link_guard` (O) | Exact-ID synthetic teardown; native domain guard blocks direct removal. |
| `public.carrier_services` | `a_crew_service_guard` (O), `v2_catalog_command_guard` (O), `v2_service_fleet_mode_guard` (O) | Exact-ID synthetic teardown; native domain guard blocks direct removal. |
| `public.carriers` | `v2_catalog_command_guard` (O), `z_workflow_carrier_status_guard` (O) | Exact-ID synthetic teardown; native domain guard blocks direct removal. |
| `public.driver_assignments` | `a_driver_occupancy` (O), `crew_command_guard` (O) | Exact-ID synthetic teardown; native domain guard blocks direct removal. |
| `public.drivers` | `crew_command_guard` (O) | Exact-ID synthetic teardown; native domain guard blocks direct removal. |
| `public.execution_events` | `workflow_guard` (O) | Exact-ID synthetic teardown; native domain guard blocks direct removal. |
| `public.freight_requests` | `guard_freight_creation_receipt` (O), `protect_v2_draft_insert` (O), `protect_v2_draft_update` (O), `verify_v2_receipt_hash` (O) | Exact-ID synthetic teardown; native domain guard blocks direct removal. |
| `public.fulfilment_partners` | `v2_catalog_command_guard` (O) | Exact-ID synthetic teardown; native domain guard blocks direct removal. |
| `public.incident_updates` | `workflow_guard` (O) | Exact-ID synthetic teardown; native domain guard blocks direct removal. |
| `public.load_allocations` | none | No ordinary trigger to suspend; FK/CHECK remain active. |
| `public.logistics_nodes` | `workflow_guard` (O) | Exact-ID synthetic teardown; native domain guard blocks direct removal. |
| `public.operational_incidents` | `workflow_guard` (O) | Exact-ID synthetic teardown; native domain guard blocks direct removal. |
| `public.organization_members` | none | No ordinary trigger to suspend; FK/CHECK remain active. |
| `public.organizations` | `v2_organization_command_guard` (O) | Exact-ID synthetic teardown; native domain guard blocks direct removal. |
| `public.plan_leg_assignments` | `leg_partner_guard` (O), `leg_requires_resources` (O) | Exact-ID synthetic teardown; native domain guard blocks direct removal. |
| `public.plan_resource_bindings` | `binding_preserves_resources` (O), `resource_binding_leg_guard` (O) | Exact-ID synthetic teardown; native domain guard blocks direct removal. |
| `public.plan_resources` | none | No ordinary trigger to suspend; FK/CHECK remain active. |
| `public.repositioning_blocks` | `a_crew_repositioning_guard` (O), `v2_fleet_command_guard` (O) | Exact-ID synthetic teardown; native domain guard blocks direct removal. |
| `public.route_conditions` | `workflow_guard` (O) | Exact-ID synthetic teardown; native domain guard blocks direct removal. |
| `public.route_corridors` | `workflow_guard` (O) | Exact-ID synthetic teardown; native domain guard blocks direct removal. |
| `public.route_legs` | none | No ordinary trigger to suspend; FK/CHECK remain active. |
| `public.route_planning_policies` | `workflow_guard` (O) | Exact-ID synthetic teardown; native domain guard blocks direct removal. |
| `public.route_plans` | `workflow_guard` (O) | Exact-ID synthetic teardown; native domain guard blocks direct removal. |
| `public.route_resource_limits` | `workflow_guard` (O) | Exact-ID synthetic teardown; native domain guard blocks direct removal. |
| `public.scheduled_maintenances` | `a_crew_maintenance_guard` (O), `v2_fleet_command_guard` (O) | Exact-ID synthetic teardown; native domain guard blocks direct removal. |
| `public.scoring_policies` | `workflow_guard` (O) | Exact-ID synthetic teardown; native domain guard blocks direct removal. |
| `public.selection_decisions` | `workflow_guard` (O) | Exact-ID synthetic teardown; native domain guard blocks direct removal. |
| `public.selection_offers` | none | No ordinary trigger to suspend; FK/CHECK remain active. |
| `public.service_areas` | `guard_v2_road_area_before_update` (O), `v2_catalog_command_guard` (O) | Exact-ID synthetic teardown; native domain guard blocks direct removal. |
| `public.service_lanes` | `v2_catalog_command_guard` (O), `validate_v2_road_lane_before_write` (O) | Exact-ID synthetic teardown; native domain guard blocks direct removal. |
| `public.transport_assets` | `a_crew_asset_guard` (O), `v2_fleet_command_guard` (O) | Exact-ID synthetic teardown; native domain guard blocks direct removal. |
| `public.transport_executions` | `crew_execution_scope` (O) | Exact-ID synthetic teardown; native domain guard blocks direct removal. |
| `public.transport_plan_candidates` | `workflow_guard` (O) | Exact-ID synthetic teardown; native domain guard blocks direct removal. |
| `public.v2_bookings` | `workflow_guard` (O) | Exact-ID synthetic teardown; native domain guard blocks direct removal. |
| `public.v2_carrier_metrics` | `workflow_guard` (O) | Exact-ID synthetic teardown; native domain guard blocks direct removal. |
| `public.v2_carrier_offers` | `offer_issuer_guard` (O), `workflow_guard` (O) | Exact-ID synthetic teardown; native domain guard blocks direct removal. |
| `public.vehicle_assignments` | `crew_command_guard` (O) | Exact-ID synthetic teardown; native domain guard blocks direct removal. |
| `public.vehicle_combination_assets` | `combination_members_nonempty` (O), `crew_member_guard` (O) | Exact-ID synthetic teardown; native domain guard blocks direct removal. |
| `public.vehicle_combinations` | `combination_nonempty` (O), `crew_command_guard` (O) | Exact-ID synthetic teardown; native domain guard blocks direct removal. |

## Case-by-case expected versus observed

Before: 9d0c3ee, immutable CP-1b cycle 1. After: e8a04cb product at QA cut 7a4aaa1, both final cycles agree. New cases say Not measured for before. I/W/F references resolve to the contract list above; H45 means the integration document :12-31 and migration 28. Each denial names a positive control in the same cycle. Empty access lists certify discovery filtering only, not carrier authorization.

| Case/action | Actor | HTTP endpoint after HAC-45 | Expected and source file:line | Before 9d0c3ee | Observed after e8a04cb | Control / classification |
|---|---|---|---|---|---|---|
| c1-admin-own-open | c1-admin | `GET /api/v2/carriers/:id/opportunities` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 PASS | 200 PASS | —; PASS |
| c1-operator-own-open | c1-operator | `GET /api/v2/carriers/:id/opportunities` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 PASS | 200 PASS | —; PASS |
| c1-dispatcher-own-open | c1-dispatcher | `GET /api/v2/carriers/:id/opportunities` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 PASS | 200 PASS | —; PASS |
| c2-admin-own-open | c2-admin | `GET /api/v2/carriers/:id/opportunities` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 PASS | 200 PASS | —; PASS |
| c2-operator-own-open | c2-operator | `GET /api/v2/carriers/:id/opportunities` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 PASS | 200 PASS | —; PASS |
| cookie-open-positive | c1-admin | `GET /api/v2/carriers/:id/opportunities` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 PASS | 200 PASS | —; PASS |
| c2-operator-control | c2-operator | `GET /api/v2/carriers/:id/opportunities` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 PASS | 200 PASS | —; PASS |
| c2-operator-negative | c2-operator | `GET /api/v2/carriers/:id/opportunities` | 403; FORBIDDEN_CARRIER_IDENTITY; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_IDENTITY PASS | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c2-operator-control; PASS |
| inactive-control | c1-admin | `GET /api/v2/carriers/:id/opportunities` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 PASS | 200 PASS | —; PASS |
| inactive-negative | inactive | `GET /api/v2/carriers/:id/opportunities` | 403; FORBIDDEN_CARRIER_IDENTITY; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_IDENTITY PASS | 403; FORBIDDEN_CARRIER_IDENTITY PASS | inactive-control; PASS |
| invited-control | c1-admin | `GET /api/v2/carriers/:id/opportunities` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 PASS | 200 PASS | —; PASS |
| invited-negative | invited | `GET /api/v2/carriers/:id/opportunities` | 403; FORBIDDEN_CARRIER_IDENTITY; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_IDENTITY PASS | 403; FORBIDDEN_CARRIER_IDENTITY PASS | invited-control; PASS |
| unverified-control | c1-admin | `GET /api/v2/carriers/:id/opportunities` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 PASS | 200 PASS | —; PASS |
| unverified-negative | unverified | `GET /api/v2/carriers/:id/opportunities` | 403; FORBIDDEN_CARRIER_IDENTITY; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_IDENTITY PASS | 403; FORBIDDEN_CARRIER_IDENTITY PASS | unverified-control; PASS |
| expired-control | c1-admin | `GET /api/v2/carriers/:id/opportunities` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 PASS | 200 PASS | —; PASS |
| expired-negative | expired | `GET /api/v2/carriers/:id/opportunities` | 403; FORBIDDEN_CARRIER_IDENTITY; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_IDENTITY PASS | 403; FORBIDDEN_CARRIER_IDENTITY PASS | expired-control; PASS |
| revoked-control | c1-admin | `GET /api/v2/carriers/:id/opportunities` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 PASS | 200 PASS | —; PASS |
| revoked-negative | revoked | `GET /api/v2/carriers/:id/opportunities` | 403; FORBIDDEN_CARRIER_IDENTITY; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_IDENTITY PASS | 403; FORBIDDEN_CARRIER_IDENTITY PASS | revoked-control; PASS |
| anonymous-control | c1-admin | `GET /api/v2/carriers/:id/opportunities` | 200; IDENTITY_AND_MCP_CHANNELS.md:60 | 200 PASS | 200 PASS | —; PASS |
| anonymous-negative | anonymous | `GET /api/v2/carriers/:id/opportunities` | 401; IDENTITY_AND_MCP_CHANNELS.md:60 | 401; UNAUTHORIZED PASS | 401; UNAUTHORIZED PASS | anonymous-control; PASS |
| portal-profile-carrier-only | c1-admin | `GET /api/v2/carrier-portal/carriers/:id` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT FAIL | 200 PASS | —; PASS |
| c1-admin-portal-access | c1-admin | `GET /api/v2/carrier-portal/access` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-admin-portal-profile | c1-admin | `GET /api/v2/carrier-portal/carriers/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-admin-portal-other-profile-negative | c1-admin | `GET /api/v2/carrier-portal/carriers/:id` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-admin-portal-profile; PASS |
| c1-operator-portal-access | c1-operator | `GET /api/v2/carrier-portal/access` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-portal-profile | c1-operator | `GET /api/v2/carrier-portal/carriers/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-portal-other-profile-negative | c1-operator | `GET /api/v2/carrier-portal/carriers/:id` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-operator-portal-profile; PASS |
| c1-dispatcher-portal-access | c1-dispatcher | `GET /api/v2/carrier-portal/access` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-portal-profile | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-portal-other-profile-negative | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-dispatcher-portal-profile; PASS |
| c2-admin-portal-access | c2-admin | `GET /api/v2/carrier-portal/access` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c2-admin-portal-profile | c2-admin | `GET /api/v2/carrier-portal/carriers/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c2-admin-portal-other-profile-negative | c2-admin | `GET /api/v2/carrier-portal/carriers/:id` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c2-admin-portal-profile; PASS |
| c2-operator-portal-access | c2-operator | `GET /api/v2/carrier-portal/access` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c2-operator-portal-profile | c2-operator | `GET /api/v2/carrier-portal/carriers/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c2-operator-portal-other-profile-negative | c2-operator | `GET /api/v2/carrier-portal/carriers/:id` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c2-operator-portal-profile; PASS |
| inactive-portal-access-empty | inactive | `GET /api/v2/carrier-portal/access` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| inactive-portal-profile-negative | inactive | `GET /api/v2/carrier-portal/carriers/:id` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | portal-profile-carrier-only; PASS |
| inactive-portal-catalog-control | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/services` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| inactive-portal-catalog-negative | inactive | `GET /api/v2/carrier-portal/carriers/:id/services` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | inactive-portal-catalog-control; PASS |
| invited-portal-access-empty | invited | `GET /api/v2/carrier-portal/access` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| invited-portal-profile-negative | invited | `GET /api/v2/carrier-portal/carriers/:id` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | portal-profile-carrier-only; PASS |
| invited-portal-catalog-control | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/services` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| invited-portal-catalog-negative | invited | `GET /api/v2/carrier-portal/carriers/:id/services` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | invited-portal-catalog-control; PASS |
| unverified-portal-access-empty | unverified | `GET /api/v2/carrier-portal/access` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| unverified-portal-profile-negative | unverified | `GET /api/v2/carrier-portal/carriers/:id` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | portal-profile-carrier-only; PASS |
| unverified-portal-catalog-control | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/services` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| unverified-portal-catalog-negative | unverified | `GET /api/v2/carrier-portal/carriers/:id/services` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | unverified-portal-catalog-control; PASS |
| expired-portal-access-empty | expired | `GET /api/v2/carrier-portal/access` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| expired-portal-profile-negative | expired | `GET /api/v2/carrier-portal/carriers/:id` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | portal-profile-carrier-only; PASS |
| expired-portal-catalog-control | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/services` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| expired-portal-catalog-negative | expired | `GET /api/v2/carrier-portal/carriers/:id/services` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | expired-portal-catalog-control; PASS |
| revoked-portal-access-empty | revoked | `GET /api/v2/carrier-portal/access` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| revoked-portal-profile-negative | revoked | `GET /api/v2/carrier-portal/carriers/:id` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | portal-profile-carrier-only; PASS |
| revoked-portal-catalog-control | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/services` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| revoked-portal-catalog-negative | revoked | `GET /api/v2/carrier-portal/carriers/:id/services` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | revoked-portal-catalog-control; PASS |
| shipper-portal-access-empty | shipper | `GET /api/v2/carrier-portal/access` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| shipper-portal-profile-negative | shipper | `GET /api/v2/carrier-portal/carriers/:id` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | portal-profile-carrier-only; PASS |
| shipper-portal-catalog-control | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/services` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| shipper-portal-catalog-negative | shipper | `GET /api/v2/carrier-portal/carriers/:id/services` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | shipper-portal-catalog-control; PASS |
| setup-portal-access-empty | setup | `GET /api/v2/carrier-portal/access` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| setup-portal-profile-negative | setup | `GET /api/v2/carrier-portal/carriers/:id` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | portal-profile-carrier-only; PASS |
| setup-portal-catalog-control | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/services` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| setup-portal-catalog-negative | setup | `GET /api/v2/carrier-portal/carriers/:id/services` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | setup-portal-catalog-control; PASS |
| C1-setup-profile-endpoint-control | setup | `GET /api/v2/carriers/:id` | 200; 20261004032151_hac40_catalog.sql:164,178 | 200 PASS | 200 PASS | —; PASS; ENDPOINT_CONTROL_ONLY; setup OWNER + CATALOG_ADMIN is not a carrier principal |
| C1-setup-catalog-endpoint-control | setup | `GET /api/v2/carriers/:id/services` | 200; 20261004032151_hac40_catalog.sql:164,178 | 200 PASS | 200 PASS | —; PASS; ENDPOINT_CONTROL_ONLY; does not certify carrier authorization |
| C1-carrier-workflow-control | c1-admin | `GET /api/v2/carriers/:id/opportunities` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 PASS | 200 PASS | —; PASS |
| C1-shipper-no-carrier-negative | shipper | `GET /api/v2/carriers/:id/opportunities` | 403; FORBIDDEN_CARRIER_IDENTITY; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_IDENTITY PASS | 403; FORBIDDEN_CARRIER_IDENTITY PASS | C1-carrier-workflow-control; PASS |
| C1-shipper-discovery-observation | shipper | `GET /api/v2/carriers/:id/services` | 200; IDENTITY_AND_MCP_CHANNELS.md:9,10,14; PRODUCT_SCOPE.md:47 (policy interpretation above) | 200 PASS | 200 PASS | —; PASS; SHIPPER_DISCOVERY_OBSERVATION; no catalog grant; not a carrier authorization control |
| C2-setup-profile-endpoint-control | setup | `GET /api/v2/carriers/:id` | 200; 20261004032151_hac40_catalog.sql:164,178 | 200 PASS | 200 PASS | —; PASS; ENDPOINT_CONTROL_ONLY; setup OWNER + CATALOG_ADMIN is not a carrier principal |
| C2-setup-catalog-endpoint-control | setup | `GET /api/v2/carriers/:id/services` | 200; 20261004032151_hac40_catalog.sql:164,178 | 200 PASS | 200 PASS | —; PASS; ENDPOINT_CONTROL_ONLY; does not certify carrier authorization |
| C2-carrier-workflow-control | c2-admin | `GET /api/v2/carriers/:id/opportunities` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 PASS | 200 PASS | —; PASS |
| C2-shipper-no-carrier-negative | shipper | `GET /api/v2/carriers/:id/opportunities` | 403; FORBIDDEN_CARRIER_IDENTITY; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_IDENTITY PASS | 403; FORBIDDEN_CARRIER_IDENTITY PASS | C2-carrier-workflow-control; PASS |
| C2-shipper-discovery-observation | shipper | `GET /api/v2/carriers/:id/services` | 200; IDENTITY_AND_MCP_CHANNELS.md:9,10,14; PRODUCT_SCOPE.md:47 (policy interpretation above) | 200 PASS | 200 PASS | —; PASS; SHIPPER_DISCOVERY_OBSERVATION; no catalog grant; not a carrier authorization control |
| portal-catalog-services | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/services` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT FAIL | 200 PASS | —; PASS |
| portal-catalog-depots | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/depots` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT FAIL | 200 PASS | —; PASS |
| portal-catalog-assets | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/assets` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT FAIL | 200 PASS | —; PASS |
| portal-catalog-drivers | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/drivers` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT FAIL | 200 PASS | —; PASS |
| portal-catalog-calendars | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/calendars` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT FAIL | 200 PASS | —; PASS |
| portal-catalog-asset-capabilities | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/asset-capabilities` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT FAIL | 200 PASS | —; PASS |
| portal-catalog-capability-definitions | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/capability-definitions` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT FAIL | 200 PASS | —; PASS |
| admin-profile-revision-positive | c1-admin | `POST /api/v2/carrier-portal/carriers/:id/revisions` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-profile-revision-negative | c1-operator | `POST /api/v2/carrier-portal/carriers/:id/revisions` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14; supabase-catalog-repository.ts:8 | Not measured | 403; FORBIDDEN_CATALOG PASS | admin-profile-revision-positive; PASS |
| c1-dispatcher-profile-revision-negative | c1-dispatcher | `POST /api/v2/carrier-portal/carriers/:id/revisions` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14; supabase-catalog-repository.ts:8 | Not measured | 403; FORBIDDEN_CATALOG PASS | admin-profile-revision-positive; PASS |
| c2-admin-profile-revision-negative | c2-admin | `POST /api/v2/carrier-portal/carriers/:id/revisions` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | admin-profile-revision-positive; PASS |
| shipper-profile-revision-negative | shipper | `POST /api/v2/carrier-portal/carriers/:id/revisions` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | admin-profile-revision-positive; PASS |
| inactive-profile-revision-negative | inactive | `POST /api/v2/carrier-portal/carriers/:id/revisions` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | admin-profile-revision-positive; PASS |
| invited-profile-revision-negative | invited | `POST /api/v2/carrier-portal/carriers/:id/revisions` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | admin-profile-revision-positive; PASS |
| unverified-profile-revision-negative | unverified | `POST /api/v2/carrier-portal/carriers/:id/revisions` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | admin-profile-revision-positive; PASS |
| expired-profile-revision-negative | expired | `POST /api/v2/carrier-portal/carriers/:id/revisions` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | admin-profile-revision-positive; PASS |
| revoked-profile-revision-negative | revoked | `POST /api/v2/carrier-portal/carriers/:id/revisions` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | admin-profile-revision-positive; PASS |
| fresh-offer | c1-operator | `POST /api/v2/carriers/:id/opportunities/:id/offers` | 201; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 201; RECEIVED PASS | 201; RECEIVED PASS | —; PASS |
| shipper-select | shipper | `POST /api/v2/freight/requests/:id/decisions` | 201; HAC40_WORKFLOW_API.md:38,40 | 201; SELECTED PASS | 201; SELECTED PASS | —; PASS |
| shipper-authorize | shipper | `POST /api/v2/bookings` | 201; HAC40_WORKFLOW_API.md:38,40 | 201; AUTHORIZED PASS | 201; AUTHORIZED PASS | —; PASS |
| shipper-prepare-execution | shipper | `POST /api/v2/executions` | 201; HAC40_WORKFLOW_API.md:38,40 | 201; PLANNED PASS | 201; PLANNED PASS | —; PASS |
| conflict-fresh-offer | c1-operator | `POST /api/v2/carriers/:id/opportunities/:id/offers` | 201; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 201; RECEIVED PASS | 201; RECEIVED PASS | —; PASS |
| conflict-shipper-select | shipper | `POST /api/v2/freight/requests/:id/decisions` | 201; HAC40_WORKFLOW_API.md:38,40 | 201; SELECTED PASS | 201; SELECTED PASS | —; PASS |
| conflict-shipper-authorize | shipper | `POST /api/v2/bookings` | 201; HAC40_WORKFLOW_API.md:38,40 | 201; AUTHORIZED PASS | 201; AUTHORIZED PASS | —; PASS |
| conflict-shipper-prepare-execution | shipper | `POST /api/v2/executions` | 201; HAC40_WORKFLOW_API.md:38,40 | 201; PLANNED PASS | 201; PLANNED PASS | —; PASS |
| calendar-plan-before-occupancy | shipper | `GET /api/v2/plans/:id` | 200; HAC40_WORKFLOW_API.md:38,40; TRANSPORT_PLANS_AND_FLEET.md:52 | 200; eligible PASS | 200; eligible PASS | —; PASS |
| calendar-free-positive | shipper | `POST /api/v2/capacity/holds` | 201; HAC40_WORKFLOW_API.md:38,40; TRANSPORT_PLANS_AND_FLEET.md:52 | 201; HELD PASS | 201; HELD PASS | —; PASS |
| carrier-confirm-capacity | c1-operator | `POST /api/v2/carriers/:id/capacity/holds/:id/confirmations` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200; CONFIRMED PASS | 200; CONFIRMED PASS | —; PASS |
| calendar-occupied-negative | shipper | `POST /api/v2/capacity/holds` | 409; HAC40_WORKFLOW_API.md:38,40; TRANSPORT_PLANS_AND_FLEET.md:52 | 409; BOOKING_ASSIGNMENT_NOT_CURRENT PASS | 409; BOOKING_ASSIGNMENT_NOT_CURRENT PASS | calendar-free-positive; PASS |
| carrier-confirm-booking | c1-operator | `POST /api/v2/carriers/:id/bookings/:id/confirmations` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200; CONFIRMED PASS | 200; CONFIRMED PASS | —; PASS |
| portal-driver-assignment-carrier-only | c1-admin | `POST /api/v2/carrier-portal/carriers/:id/driver-assignments` | 201; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9; TRANSPORT_PLANS_AND_FLEET.md:52 | 403; FORBIDDEN_TENANT FAIL | 201 PASS | —; PASS |
| c1-operator-portal-driver-write-negative | c1-operator | `POST /api/v2/carrier-portal/carriers/:id/driver-assignments` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14; supabase-catalog-repository.ts:8 | Not measured | 403; FORBIDDEN_CATALOG PASS | portal-driver-assignment-carrier-only; PASS |
| c1-dispatcher-portal-driver-write-negative | c1-dispatcher | `POST /api/v2/carrier-portal/carriers/:id/driver-assignments` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14; supabase-catalog-repository.ts:8 | Not measured | 403; FORBIDDEN_CATALOG PASS | portal-driver-assignment-carrier-only; PASS |
| c2-admin-portal-driver-write-negative | c2-admin | `POST /api/v2/carrier-portal/carriers/:id/driver-assignments` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | portal-driver-assignment-carrier-only; PASS |
| shipper-portal-driver-write-negative | shipper | `POST /api/v2/carrier-portal/carriers/:id/driver-assignments` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | portal-driver-assignment-carrier-only; PASS |
| driver-free-positive | setup | `POST /api/v2/carriers/:id/driver-assignments` | 201; 20261004032151_hac40_catalog.sql:164,178; TRANSPORT_PLANS_AND_FLEET.md:52 | 201 PASS | 201 PASS | —; PASS; ENDPOINT_CONTROL_ONLY; independent catalog setup, not carrier authorization |
| shipper-no-catalog-grant-negative | shipper | `POST /api/v2/carriers/:id/driver-assignments` | 403; FORBIDDEN_CATALOG; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CATALOG PASS | 403; FORBIDDEN_CATALOG PASS | driver-free-positive; PASS |
| driver-occupied-negative | setup | `POST /api/v2/carriers/:id/driver-assignments` | 409; 20261004032151_hac40_catalog.sql:164,178; TRANSPORT_PLANS_AND_FLEET.md:52 | 409; FLEET_COMMITMENT_CONFLICT PASS | 409; FLEET_COMMITMENT_CONFLICT PASS | driver-free-positive; PASS |
| vehicle-confirmed-positive | setup | `POST /api/v2/carriers/:id/vehicle-assignments` | 201; 20261004032151_hac40_catalog.sql:164,178 | 201 PASS | 201 PASS | —; PASS |
| dispatcher-start | c1-dispatcher | `POST /api/v2/carriers/:id/executions/:id/starts` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200; IN_PROGRESS PASS | 200; IN_PROGRESS PASS | —; PASS |
| dispatcher-incident | c1-dispatcher | `POST /api/v2/carriers/:id/executions/:id/incidents` | 201; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 201; OPEN PASS | 201; OPEN PASS | —; PASS |
| dispatcher-resolve-incident | c1-dispatcher | `POST /api/v2/carriers/:id/incidents/:id/updates` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200; RESOLVED PASS | 200; RESOLVED PASS | —; PASS |
| execution-version-before-complete | c1-dispatcher | `GET /api/v2/carriers/:id/executions/:id` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200; IN_PROGRESS PASS | 200; IN_PROGRESS PASS | —; PASS |
| dispatcher-complete | c1-dispatcher | `POST /api/v2/carriers/:id/executions/:id/completions` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200; COMPLETED PASS | 200; COMPLETED PASS | —; PASS |
| carrier-closed-booking | c1-admin | `GET /api/v2/carriers/:id/bookings/:id` | 200; COMPLETED; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200; COMPLETED PASS | 200; COMPLETED PASS | —; PASS |
| C1-admin-metric-native-positive | c1-admin | `POST /api/v2/carriers/:id/metrics` | 201; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 201; ACTIVE PASS | 201; ACTIVE PASS | —; PASS |
| C1-consolidation-native-positive | c1-dispatcher | `POST /api/v2/carriers/:id/consolidations` | 201; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 201; OPEN PASS | 201; OPEN PASS | —; PASS |
| C1-asset-event-native-positive | c1-dispatcher | `POST /api/v2/carriers/:id/assets/:id/events` | 201; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 201; RECORDED PASS | 201; RECORDED PASS | —; PASS |
| c1-operator-metrics-role-negative | c1-operator | `POST /api/v2/carriers/:id/metrics` | 403; FORBIDDEN_CARRIER_ROLE; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_ROLE PASS | 403; FORBIDDEN_CARRIER_ROLE PASS | C1-admin-metric-native-positive; PASS |
| c1-dispatcher-metrics-role-negative | c1-dispatcher | `POST /api/v2/carriers/:id/metrics` | 403; FORBIDDEN_CARRIER_ROLE; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_ROLE PASS | 403; FORBIDDEN_CARRIER_ROLE PASS | C1-admin-metric-native-positive; PASS |
| other-carrier-metrics-write-negative | c2-admin | `POST /api/v2/carriers/:id/metrics` | 403; FORBIDDEN_CARRIER_IDENTITY; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_IDENTITY PASS | 403; FORBIDDEN_CARRIER_IDENTITY PASS | C1-admin-metric-native-positive; PASS |
| other-carrier-consolidation-write-negative | c2-operator | `POST /api/v2/carriers/:id/consolidations` | 403; FORBIDDEN_CARRIER_IDENTITY; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_IDENTITY PASS | 403; FORBIDDEN_CARRIER_IDENTITY PASS | C1-consolidation-native-positive; PASS |
| other-carrier-asset-event-write-negative | c2-operator | `POST /api/v2/carriers/:id/assets/:id/events` | 403; FORBIDDEN_CARRIER_IDENTITY; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_IDENTITY PASS | 403; FORBIDDEN_CARRIER_IDENTITY PASS | C1-asset-event-native-positive; PASS |
| C2-admin-metric-native-positive | c2-admin | `POST /api/v2/carriers/:id/metrics` | 201; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 201; ACTIVE PASS | 201; ACTIVE PASS | —; PASS |
| C2-consolidation-native-positive | c2-operator | `POST /api/v2/carriers/:id/consolidations` | 201; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 201; OPEN PASS | 201; OPEN PASS | —; PASS |
| C2-asset-event-native-positive | c2-operator | `POST /api/v2/carriers/:id/assets/:id/events` | 201; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 201; RECORDED PASS | 201; RECORDED PASS | —; PASS |
| c1-admin-metrics-exact-row-positive | c1-admin | `GET /api/v2/carriers/:id/metrics` | 200; exact native ID and own carrier only; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 PASS | 200 PASS | —; PASS |
| c1-operator-metrics-exact-row-positive | c1-operator | `GET /api/v2/carriers/:id/metrics` | 200; exact native ID and own carrier only; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 PASS | 200 PASS | —; PASS |
| c1-dispatcher-metrics-exact-row-positive | c1-dispatcher | `GET /api/v2/carriers/:id/metrics` | 200; exact native ID and own carrier only; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 PASS | 200 PASS | —; PASS |
| c2-admin-metrics-foreign-read-negative | c2-admin | `GET /api/v2/carriers/:id/metrics` | 403; FORBIDDEN_CARRIER_IDENTITY; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_IDENTITY PASS | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-admin-metrics-exact-row-positive; PASS |
| c2-operator-metrics-foreign-read-negative | c2-operator | `GET /api/v2/carriers/:id/metrics` | 403; FORBIDDEN_CARRIER_IDENTITY; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_IDENTITY PASS | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-admin-metrics-exact-row-positive; PASS |
| shipper-metrics-foreign-read-negative | shipper | `GET /api/v2/carriers/:id/metrics` | 403; FORBIDDEN_CARRIER_IDENTITY; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_IDENTITY PASS | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-admin-metrics-exact-row-positive; PASS |
| c1-admin-consolidations-exact-row-positive | c1-admin | `GET /api/v2/carriers/:id/consolidations` | 200; exact native ID and own carrier only; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 PASS | 200 PASS | —; PASS |
| c1-operator-consolidations-exact-row-positive | c1-operator | `GET /api/v2/carriers/:id/consolidations` | 200; exact native ID and own carrier only; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 PASS | 200 PASS | —; PASS |
| c1-dispatcher-consolidations-exact-row-positive | c1-dispatcher | `GET /api/v2/carriers/:id/consolidations` | 200; exact native ID and own carrier only; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 PASS | 200 PASS | —; PASS |
| c2-admin-consolidations-foreign-read-negative | c2-admin | `GET /api/v2/carriers/:id/consolidations` | 403; FORBIDDEN_CARRIER_IDENTITY; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_IDENTITY PASS | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-admin-consolidations-exact-row-positive; PASS |
| c2-operator-consolidations-foreign-read-negative | c2-operator | `GET /api/v2/carriers/:id/consolidations` | 403; FORBIDDEN_CARRIER_IDENTITY; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_IDENTITY PASS | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-admin-consolidations-exact-row-positive; PASS |
| shipper-consolidations-foreign-read-negative | shipper | `GET /api/v2/carriers/:id/consolidations` | 403; FORBIDDEN_CARRIER_IDENTITY; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_IDENTITY PASS | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-admin-consolidations-exact-row-positive; PASS |
| c1-admin-asset-events-exact-row-positive | c1-admin | `GET /api/v2/carriers/:id/assets/:id/events` | 200; exact native ID and own carrier only; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 PASS | 200 PASS | —; PASS |
| c1-operator-asset-events-exact-row-positive | c1-operator | `GET /api/v2/carriers/:id/assets/:id/events` | 200; exact native ID and own carrier only; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 PASS | 200 PASS | —; PASS |
| c1-dispatcher-asset-events-exact-row-positive | c1-dispatcher | `GET /api/v2/carriers/:id/assets/:id/events` | 200; exact native ID and own carrier only; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 PASS | 200 PASS | —; PASS |
| c2-admin-asset-events-foreign-read-negative | c2-admin | `GET /api/v2/carriers/:id/assets/:id/events` | 403; FORBIDDEN_CARRIER_IDENTITY; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_IDENTITY PASS | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-admin-asset-events-exact-row-positive; PASS |
| c2-operator-asset-events-foreign-read-negative | c2-operator | `GET /api/v2/carriers/:id/assets/:id/events` | 403; FORBIDDEN_CARRIER_IDENTITY; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_IDENTITY PASS | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-admin-asset-events-exact-row-positive; PASS |
| shipper-asset-events-foreign-read-negative | shipper | `GET /api/v2/carriers/:id/assets/:id/events` | 403; FORBIDDEN_CARRIER_IDENTITY; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_IDENTITY PASS | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-admin-asset-events-exact-row-positive; PASS |
| dispatcher-offer-role-negative | c1-dispatcher | `POST /api/v2/carriers/:id/opportunities/:id/offers` | 403; FORBIDDEN_CARRIER_ROLE; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_ROLE PASS | 403; FORBIDDEN_CARRIER_ROLE PASS | fresh-offer; PASS |
| dispatcher-booking-confirm-role-negative | c1-dispatcher | `POST /api/v2/carriers/:id/bookings/:id/confirmations` | 403; FORBIDDEN_CARRIER_ROLE; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_ROLE PASS | 403; FORBIDDEN_CARRIER_ROLE PASS | carrier-confirm-booking; PASS |
| dispatcher-hold-confirm-role-negative | c1-dispatcher | `POST /api/v2/carriers/:id/capacity/holds/:id/confirmations` | 403; FORBIDDEN_CARRIER_ROLE; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_ROLE PASS | 403; FORBIDDEN_CARRIER_ROLE PASS | carrier-confirm-capacity; PASS |
| overweight-request | shipper | `POST /api/v2/freight/requests` | 201; HAC40_WORKFLOW_API.md:38,40 | 201; DRAFT PASS | 201; DRAFT PASS | —; PASS |
| overweight-submit | shipper | `POST /api/v2/freight/requests/:id/submissions` | 200; HAC40_WORKFLOW_API.md:38,40 | 200; PENDING PASS | 200; PENDING PASS | —; PASS |
| overweight-route | shipper | `POST /api/v2/freight/requests/:id/routes` | 201; HAC40_WORKFLOW_API.md:38,40 | 201; ineligible PASS | 201; ineligible PASS | —; PASS |
| capacity-sufficient-positive | shipper | `GET /api/v2/plans/:id` | 200; TRANSPORT_PLANS_AND_FLEET.md:30,32 | 200; eligible PASS | 200; eligible PASS | —; PASS |
| capacity-insufficient-negative | shipper | `POST /api/v2/freight/requests/:id/plans` | 201; ineligible + capacity reason; TRANSPORT_PLANS_AND_FLEET.md:30,32 | 201; ineligible PASS | 201; ineligible PASS | capacity-sufficient-positive; PASS |
| screen-depots | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/depots?limit=25&offset=0` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT FAIL | 200 PASS | —; PASS |
| c1-admin-detail-depots | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/depots/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-admin-other-carrier-screen-negative-depots | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/depots` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-depots; PASS |
| c1-operator-screen-depots | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/depots?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-detail-depots | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/depots/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-other-carrier-screen-negative-depots | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/depots` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-operator-screen-depots; PASS |
| c1-dispatcher-screen-depots | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/depots?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-detail-depots | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/depots/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-other-carrier-screen-negative-depots | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/depots` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-dispatcher-screen-depots; PASS |
| c2-admin-foreign-screen-negative-depots | c2-admin | `GET /api/v2/carrier-portal/carriers/:id/depots` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-depots; PASS |
| c2-operator-foreign-screen-negative-depots | c2-operator | `GET /api/v2/carrier-portal/carriers/:id/depots` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-depots; PASS |
| shipper-foreign-screen-negative-depots | shipper | `GET /api/v2/carrier-portal/carriers/:id/depots` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-depots; PASS |
| screen-services | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/services?limit=25&offset=0` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT FAIL | 200 PASS | —; PASS |
| c1-admin-detail-services | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/services/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-admin-other-carrier-screen-negative-services | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/services` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-services; PASS |
| c1-operator-screen-services | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/services?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-detail-services | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/services/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-other-carrier-screen-negative-services | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/services` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-operator-screen-services; PASS |
| c1-dispatcher-screen-services | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/services?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-detail-services | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/services/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-other-carrier-screen-negative-services | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/services` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-dispatcher-screen-services; PASS |
| c2-admin-foreign-screen-negative-services | c2-admin | `GET /api/v2/carrier-portal/carriers/:id/services` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-services; PASS |
| c2-operator-foreign-screen-negative-services | c2-operator | `GET /api/v2/carrier-portal/carriers/:id/services` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-services; PASS |
| shipper-foreign-screen-negative-services | shipper | `GET /api/v2/carrier-portal/carriers/:id/services` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-services; PASS |
| screen-areas | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/services/:id/areas?limit=25&offset=0` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT FAIL | 200 PASS | —; PASS |
| c1-admin-detail-areas | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/services/:id/areas/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-admin-other-carrier-screen-negative-areas | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/services/:id/areas` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-areas; PASS |
| c1-operator-screen-areas | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/services/:id/areas?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-detail-areas | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/services/:id/areas/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-other-carrier-screen-negative-areas | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/services/:id/areas` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-operator-screen-areas; PASS |
| c1-dispatcher-screen-areas | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/services/:id/areas?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-detail-areas | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/services/:id/areas/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-other-carrier-screen-negative-areas | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/services/:id/areas` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-dispatcher-screen-areas; PASS |
| c2-admin-foreign-screen-negative-areas | c2-admin | `GET /api/v2/carrier-portal/carriers/:id/services/:id/areas` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-areas; PASS |
| c2-operator-foreign-screen-negative-areas | c2-operator | `GET /api/v2/carrier-portal/carriers/:id/services/:id/areas` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-areas; PASS |
| shipper-foreign-screen-negative-areas | shipper | `GET /api/v2/carrier-portal/carriers/:id/services/:id/areas` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-areas; PASS |
| screen-lanes | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/services/:id/lanes?limit=25&offset=0` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT FAIL | 200 PASS | —; PASS |
| c1-admin-detail-lanes | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/services/:id/lanes/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-admin-other-carrier-screen-negative-lanes | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/services/:id/lanes` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-lanes; PASS |
| c1-operator-screen-lanes | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/services/:id/lanes?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-detail-lanes | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/services/:id/lanes/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-other-carrier-screen-negative-lanes | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/services/:id/lanes` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-operator-screen-lanes; PASS |
| c1-dispatcher-screen-lanes | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/services/:id/lanes?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-detail-lanes | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/services/:id/lanes/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-other-carrier-screen-negative-lanes | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/services/:id/lanes` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-dispatcher-screen-lanes; PASS |
| c2-admin-foreign-screen-negative-lanes | c2-admin | `GET /api/v2/carrier-portal/carriers/:id/services/:id/lanes` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-lanes; PASS |
| c2-operator-foreign-screen-negative-lanes | c2-operator | `GET /api/v2/carrier-portal/carriers/:id/services/:id/lanes` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-lanes; PASS |
| shipper-foreign-screen-negative-lanes | shipper | `GET /api/v2/carrier-portal/carriers/:id/services/:id/lanes` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-lanes; PASS |
| screen-partners | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/partners?limit=25&offset=0` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT FAIL | 200 PASS | —; PASS |
| c1-admin-detail-partners | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/partners/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-admin-other-carrier-screen-negative-partners | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/partners` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-partners; PASS |
| c1-operator-screen-partners | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/partners?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-detail-partners | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/partners/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-other-carrier-screen-negative-partners | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/partners` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-operator-screen-partners; PASS |
| c1-dispatcher-screen-partners | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/partners?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-detail-partners | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/partners/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-other-carrier-screen-negative-partners | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/partners` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-dispatcher-screen-partners; PASS |
| c2-admin-foreign-screen-negative-partners | c2-admin | `GET /api/v2/carrier-portal/carriers/:id/partners` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-partners; PASS |
| c2-operator-foreign-screen-negative-partners | c2-operator | `GET /api/v2/carrier-portal/carriers/:id/partners` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-partners; PASS |
| shipper-foreign-screen-negative-partners | shipper | `GET /api/v2/carrier-portal/carriers/:id/partners` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-partners; PASS |
| screen-limits | c1-admin | `GET /api/v2/carriers/:id/route-limits?limit=25&offset=0` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 PASS | 200 PASS | —; PASS |
| c1-admin-detail-limits | c1-admin | `GET /api/v2/carriers/:id/route-limits/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200; ACTIVE PASS | —; PASS |
| c1-admin-other-carrier-screen-negative-limits | c1-admin | `GET /api/v2/carriers/:id/route-limits` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-limits; PASS |
| c1-operator-screen-limits | c1-operator | `GET /api/v2/carriers/:id/route-limits?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-detail-limits | c1-operator | `GET /api/v2/carriers/:id/route-limits/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200; ACTIVE PASS | —; PASS |
| c1-operator-other-carrier-screen-negative-limits | c1-operator | `GET /api/v2/carriers/:id/route-limits` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-operator-screen-limits; PASS |
| c1-dispatcher-screen-limits | c1-dispatcher | `GET /api/v2/carriers/:id/route-limits?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-detail-limits | c1-dispatcher | `GET /api/v2/carriers/:id/route-limits/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200; ACTIVE PASS | —; PASS |
| c1-dispatcher-other-carrier-screen-negative-limits | c1-dispatcher | `GET /api/v2/carriers/:id/route-limits` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-dispatcher-screen-limits; PASS |
| c2-admin-foreign-screen-negative-limits | c2-admin | `GET /api/v2/carriers/:id/route-limits` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-limits; PASS |
| c2-operator-foreign-screen-negative-limits | c2-operator | `GET /api/v2/carriers/:id/route-limits` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-limits; PASS |
| shipper-foreign-screen-negative-limits | shipper | `GET /api/v2/carriers/:id/route-limits` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-limits; PASS |
| screen-assets | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/assets?limit=25&offset=0` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT FAIL | 200 PASS | —; PASS |
| c1-admin-detail-assets | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/assets/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-admin-other-carrier-screen-negative-assets | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/assets` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-assets; PASS |
| c1-operator-screen-assets | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/assets?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-detail-assets | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/assets/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-other-carrier-screen-negative-assets | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/assets` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-operator-screen-assets; PASS |
| c1-dispatcher-screen-assets | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/assets?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-detail-assets | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/assets/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-other-carrier-screen-negative-assets | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/assets` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-dispatcher-screen-assets; PASS |
| c2-admin-foreign-screen-negative-assets | c2-admin | `GET /api/v2/carrier-portal/carriers/:id/assets` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-assets; PASS |
| c2-operator-foreign-screen-negative-assets | c2-operator | `GET /api/v2/carrier-portal/carriers/:id/assets` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-assets; PASS |
| shipper-foreign-screen-negative-assets | shipper | `GET /api/v2/carrier-portal/carriers/:id/assets` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-assets; PASS |
| screen-vehicle-combinations | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/vehicle-combinations?limit=25&offset=0` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT FAIL | 200 PASS | —; PASS |
| c1-admin-detail-vehicle-combinations | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/vehicle-combinations/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-admin-other-carrier-screen-negative-vehicle-combinations | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/vehicle-combinations` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-vehicle-combinations; PASS |
| c1-operator-screen-vehicle-combinations | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/vehicle-combinations?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-detail-vehicle-combinations | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/vehicle-combinations/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-other-carrier-screen-negative-vehicle-combinations | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/vehicle-combinations` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-operator-screen-vehicle-combinations; PASS |
| c1-dispatcher-screen-vehicle-combinations | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/vehicle-combinations?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-detail-vehicle-combinations | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/vehicle-combinations/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-other-carrier-screen-negative-vehicle-combinations | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/vehicle-combinations` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-dispatcher-screen-vehicle-combinations; PASS |
| c2-admin-foreign-screen-negative-vehicle-combinations | c2-admin | `GET /api/v2/carrier-portal/carriers/:id/vehicle-combinations` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-vehicle-combinations; PASS |
| c2-operator-foreign-screen-negative-vehicle-combinations | c2-operator | `GET /api/v2/carrier-portal/carriers/:id/vehicle-combinations` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-vehicle-combinations; PASS |
| shipper-foreign-screen-negative-vehicle-combinations | shipper | `GET /api/v2/carrier-portal/carriers/:id/vehicle-combinations` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-vehicle-combinations; PASS |
| screen-drivers | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/drivers?limit=25&offset=0` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT FAIL | 200 PASS | —; PASS |
| c1-admin-detail-drivers | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/drivers/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-admin-other-carrier-screen-negative-drivers | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/drivers` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-drivers; PASS |
| c1-operator-screen-drivers | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/drivers?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-detail-drivers | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/drivers/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-other-carrier-screen-negative-drivers | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/drivers` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-operator-screen-drivers; PASS |
| c1-dispatcher-screen-drivers | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/drivers?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-detail-drivers | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/drivers/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-other-carrier-screen-negative-drivers | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/drivers` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-dispatcher-screen-drivers; PASS |
| c2-admin-foreign-screen-negative-drivers | c2-admin | `GET /api/v2/carrier-portal/carriers/:id/drivers` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-drivers; PASS |
| c2-operator-foreign-screen-negative-drivers | c2-operator | `GET /api/v2/carrier-portal/carriers/:id/drivers` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-drivers; PASS |
| shipper-foreign-screen-negative-drivers | shipper | `GET /api/v2/carrier-portal/carriers/:id/drivers` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-drivers; PASS |
| screen-capacity-pools | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/capacity-pools?limit=25&offset=0` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT FAIL | 200 PASS | —; PASS |
| c1-admin-detail-capacity-pools | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/capacity-pools/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-admin-other-carrier-screen-negative-capacity-pools | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/capacity-pools` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-capacity-pools; PASS |
| c1-operator-screen-capacity-pools | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/capacity-pools?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-detail-capacity-pools | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/capacity-pools/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-other-carrier-screen-negative-capacity-pools | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/capacity-pools` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-operator-screen-capacity-pools; PASS |
| c1-dispatcher-screen-capacity-pools | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/capacity-pools?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-detail-capacity-pools | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/capacity-pools/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-other-carrier-screen-negative-capacity-pools | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/capacity-pools` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-dispatcher-screen-capacity-pools; PASS |
| c2-admin-foreign-screen-negative-capacity-pools | c2-admin | `GET /api/v2/carrier-portal/carriers/:id/capacity-pools` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-capacity-pools; PASS |
| c2-operator-foreign-screen-negative-capacity-pools | c2-operator | `GET /api/v2/carrier-portal/carriers/:id/capacity-pools` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-capacity-pools; PASS |
| shipper-foreign-screen-negative-capacity-pools | shipper | `GET /api/v2/carrier-portal/carriers/:id/capacity-pools` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-capacity-pools; PASS |
| screen-calendars | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/calendars?limit=25&offset=0` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT FAIL | 200 PASS | —; PASS |
| c1-admin-detail-calendars | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/calendars/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-admin-other-carrier-screen-negative-calendars | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/calendars` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-calendars; PASS |
| c1-operator-screen-calendars | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/calendars?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-detail-calendars | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/calendars/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-other-carrier-screen-negative-calendars | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/calendars` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-operator-screen-calendars; PASS |
| c1-dispatcher-screen-calendars | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/calendars?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-detail-calendars | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/calendars/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-other-carrier-screen-negative-calendars | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/calendars` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-dispatcher-screen-calendars; PASS |
| c2-admin-foreign-screen-negative-calendars | c2-admin | `GET /api/v2/carrier-portal/carriers/:id/calendars` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-calendars; PASS |
| c2-operator-foreign-screen-negative-calendars | c2-operator | `GET /api/v2/carrier-portal/carriers/:id/calendars` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-calendars; PASS |
| shipper-foreign-screen-negative-calendars | shipper | `GET /api/v2/carrier-portal/carriers/:id/calendars` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-calendars; PASS |
| screen-driver-assignments | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/driver-assignments?limit=25&offset=0` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9; TRANSPORT_PLANS_AND_FLEET.md:52 | 403; FORBIDDEN_TENANT FAIL | 200 PASS | —; PASS |
| c1-admin-detail-driver-assignments | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/driver-assignments/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-admin-other-carrier-screen-negative-driver-assignments | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/driver-assignments` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-driver-assignments; PASS |
| c1-operator-screen-driver-assignments | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/driver-assignments?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-detail-driver-assignments | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/driver-assignments/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-other-carrier-screen-negative-driver-assignments | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/driver-assignments` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-operator-screen-driver-assignments; PASS |
| c1-dispatcher-screen-driver-assignments | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/driver-assignments?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-detail-driver-assignments | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/driver-assignments/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-other-carrier-screen-negative-driver-assignments | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/driver-assignments` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-dispatcher-screen-driver-assignments; PASS |
| c2-admin-foreign-screen-negative-driver-assignments | c2-admin | `GET /api/v2/carrier-portal/carriers/:id/driver-assignments` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-driver-assignments; PASS |
| c2-operator-foreign-screen-negative-driver-assignments | c2-operator | `GET /api/v2/carrier-portal/carriers/:id/driver-assignments` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-driver-assignments; PASS |
| shipper-foreign-screen-negative-driver-assignments | shipper | `GET /api/v2/carrier-portal/carriers/:id/driver-assignments` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-driver-assignments; PASS |
| screen-vehicle-assignments | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/vehicle-assignments?limit=25&offset=0` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT FAIL | 200 PASS | —; PASS |
| c1-admin-detail-vehicle-assignments | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/vehicle-assignments/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-admin-other-carrier-screen-negative-vehicle-assignments | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/vehicle-assignments` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-vehicle-assignments; PASS |
| c1-operator-screen-vehicle-assignments | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/vehicle-assignments?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-detail-vehicle-assignments | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/vehicle-assignments/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-other-carrier-screen-negative-vehicle-assignments | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/vehicle-assignments` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-operator-screen-vehicle-assignments; PASS |
| c1-dispatcher-screen-vehicle-assignments | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/vehicle-assignments?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-detail-vehicle-assignments | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/vehicle-assignments/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-other-carrier-screen-negative-vehicle-assignments | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/vehicle-assignments` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-dispatcher-screen-vehicle-assignments; PASS |
| c2-admin-foreign-screen-negative-vehicle-assignments | c2-admin | `GET /api/v2/carrier-portal/carriers/:id/vehicle-assignments` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-vehicle-assignments; PASS |
| c2-operator-foreign-screen-negative-vehicle-assignments | c2-operator | `GET /api/v2/carrier-portal/carriers/:id/vehicle-assignments` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-vehicle-assignments; PASS |
| shipper-foreign-screen-negative-vehicle-assignments | shipper | `GET /api/v2/carrier-portal/carriers/:id/vehicle-assignments` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-vehicle-assignments; PASS |
| screen-maintenances | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/maintenances?limit=25&offset=0` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT FAIL | 200 PASS | —; PASS |
| c1-admin-detail-maintenances | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/maintenances/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-admin-other-carrier-screen-negative-maintenances | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/maintenances` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-maintenances; PASS |
| c1-operator-screen-maintenances | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/maintenances?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-detail-maintenances | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/maintenances/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-other-carrier-screen-negative-maintenances | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/maintenances` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-operator-screen-maintenances; PASS |
| c1-dispatcher-screen-maintenances | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/maintenances?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-detail-maintenances | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/maintenances/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-other-carrier-screen-negative-maintenances | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/maintenances` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-dispatcher-screen-maintenances; PASS |
| c2-admin-foreign-screen-negative-maintenances | c2-admin | `GET /api/v2/carrier-portal/carriers/:id/maintenances` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-maintenances; PASS |
| c2-operator-foreign-screen-negative-maintenances | c2-operator | `GET /api/v2/carrier-portal/carriers/:id/maintenances` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-maintenances; PASS |
| shipper-foreign-screen-negative-maintenances | shipper | `GET /api/v2/carrier-portal/carriers/:id/maintenances` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-maintenances; PASS |
| screen-repositioning-blocks | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/repositioning-blocks?limit=25&offset=0` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT FAIL | 200 PASS | —; PASS |
| c1-admin-detail-repositioning-blocks | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/repositioning-blocks/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-admin-other-carrier-screen-negative-repositioning-blocks | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/repositioning-blocks` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-repositioning-blocks; PASS |
| c1-operator-screen-repositioning-blocks | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/repositioning-blocks?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-detail-repositioning-blocks | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/repositioning-blocks/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-other-carrier-screen-negative-repositioning-blocks | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/repositioning-blocks` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-operator-screen-repositioning-blocks; PASS |
| c1-dispatcher-screen-repositioning-blocks | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/repositioning-blocks?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-detail-repositioning-blocks | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/repositioning-blocks/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-other-carrier-screen-negative-repositioning-blocks | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/repositioning-blocks` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-dispatcher-screen-repositioning-blocks; PASS |
| c2-admin-foreign-screen-negative-repositioning-blocks | c2-admin | `GET /api/v2/carrier-portal/carriers/:id/repositioning-blocks` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-repositioning-blocks; PASS |
| c2-operator-foreign-screen-negative-repositioning-blocks | c2-operator | `GET /api/v2/carrier-portal/carriers/:id/repositioning-blocks` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-repositioning-blocks; PASS |
| shipper-foreign-screen-negative-repositioning-blocks | shipper | `GET /api/v2/carrier-portal/carriers/:id/repositioning-blocks` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-repositioning-blocks; PASS |
| screen-asset-capabilities | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/asset-capabilities?limit=25&offset=0` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT FAIL | 200 PASS | —; PASS |
| c1-admin-detail-asset-capabilities | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/asset-capabilities/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-admin-other-carrier-screen-negative-asset-capabilities | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/asset-capabilities` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-asset-capabilities; PASS |
| c1-operator-screen-asset-capabilities | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/asset-capabilities?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-detail-asset-capabilities | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/asset-capabilities/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-other-carrier-screen-negative-asset-capabilities | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/asset-capabilities` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-operator-screen-asset-capabilities; PASS |
| c1-dispatcher-screen-asset-capabilities | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/asset-capabilities?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-detail-asset-capabilities | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/asset-capabilities/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-other-carrier-screen-negative-asset-capabilities | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/asset-capabilities` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-dispatcher-screen-asset-capabilities; PASS |
| c2-admin-foreign-screen-negative-asset-capabilities | c2-admin | `GET /api/v2/carrier-portal/carriers/:id/asset-capabilities` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-asset-capabilities; PASS |
| c2-operator-foreign-screen-negative-asset-capabilities | c2-operator | `GET /api/v2/carrier-portal/carriers/:id/asset-capabilities` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-asset-capabilities; PASS |
| shipper-foreign-screen-negative-asset-capabilities | shipper | `GET /api/v2/carrier-portal/carriers/:id/asset-capabilities` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-asset-capabilities; PASS |
| screen-capability-definitions | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/capability-definitions?limit=25&offset=0` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT FAIL | 200 PASS | —; PASS |
| c1-admin-detail-capability-definitions | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/capability-definitions/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-admin-other-carrier-screen-negative-capability-definitions | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/capability-definitions` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-capability-definitions; PASS |
| c1-operator-screen-capability-definitions | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/capability-definitions?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-detail-capability-definitions | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/capability-definitions/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-other-carrier-screen-negative-capability-definitions | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/capability-definitions` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-operator-screen-capability-definitions; PASS |
| c1-dispatcher-screen-capability-definitions | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/capability-definitions?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-detail-capability-definitions | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/capability-definitions/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-other-carrier-screen-negative-capability-definitions | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/capability-definitions` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-dispatcher-screen-capability-definitions; PASS |
| c2-admin-foreign-screen-negative-capability-definitions | c2-admin | `GET /api/v2/carrier-portal/carriers/:id/capability-definitions` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-capability-definitions; PASS |
| c2-operator-foreign-screen-negative-capability-definitions | c2-operator | `GET /api/v2/carrier-portal/carriers/:id/capability-definitions` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-capability-definitions; PASS |
| shipper-foreign-screen-negative-capability-definitions | shipper | `GET /api/v2/carrier-portal/carriers/:id/capability-definitions` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-capability-definitions; PASS |
| screen-opportunities | c1-admin | `GET /api/v2/carriers/:id/opportunities?limit=25&offset=0` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 PASS | 200 PASS | —; PASS |
| c1-admin-detail-opportunities | c1-admin | `GET /api/v2/carriers/:id/opportunities/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200; OFFERED PASS | —; PASS |
| c1-admin-other-carrier-screen-negative-opportunities | c1-admin | `GET /api/v2/carriers/:id/opportunities` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-opportunities; PASS |
| c1-operator-screen-opportunities | c1-operator | `GET /api/v2/carriers/:id/opportunities?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-detail-opportunities | c1-operator | `GET /api/v2/carriers/:id/opportunities/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200; OFFERED PASS | —; PASS |
| c1-operator-other-carrier-screen-negative-opportunities | c1-operator | `GET /api/v2/carriers/:id/opportunities` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-operator-screen-opportunities; PASS |
| c1-dispatcher-screen-opportunities | c1-dispatcher | `GET /api/v2/carriers/:id/opportunities?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-detail-opportunities | c1-dispatcher | `GET /api/v2/carriers/:id/opportunities/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200; OFFERED PASS | —; PASS |
| c1-dispatcher-other-carrier-screen-negative-opportunities | c1-dispatcher | `GET /api/v2/carriers/:id/opportunities` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-dispatcher-screen-opportunities; PASS |
| c2-admin-foreign-screen-negative-opportunities | c2-admin | `GET /api/v2/carriers/:id/opportunities` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-opportunities; PASS |
| c2-operator-foreign-screen-negative-opportunities | c2-operator | `GET /api/v2/carriers/:id/opportunities` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-opportunities; PASS |
| shipper-foreign-screen-negative-opportunities | shipper | `GET /api/v2/carriers/:id/opportunities` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-opportunities; PASS |
| screen-offers | c1-admin | `GET /api/v2/carriers/:id/offers?limit=25&offset=0` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 PASS | 200 PASS | —; PASS |
| c1-admin-detail-offers | c1-admin | `GET /api/v2/carriers/:id/offers/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200; RECEIVED PASS | —; PASS |
| c1-admin-other-carrier-screen-negative-offers | c1-admin | `GET /api/v2/carriers/:id/offers` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-offers; PASS |
| c1-operator-screen-offers | c1-operator | `GET /api/v2/carriers/:id/offers?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-detail-offers | c1-operator | `GET /api/v2/carriers/:id/offers/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200; RECEIVED PASS | —; PASS |
| c1-operator-other-carrier-screen-negative-offers | c1-operator | `GET /api/v2/carriers/:id/offers` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-operator-screen-offers; PASS |
| c1-dispatcher-screen-offers | c1-dispatcher | `GET /api/v2/carriers/:id/offers?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-detail-offers | c1-dispatcher | `GET /api/v2/carriers/:id/offers/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200; RECEIVED PASS | —; PASS |
| c1-dispatcher-other-carrier-screen-negative-offers | c1-dispatcher | `GET /api/v2/carriers/:id/offers` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-dispatcher-screen-offers; PASS |
| c2-admin-foreign-screen-negative-offers | c2-admin | `GET /api/v2/carriers/:id/offers` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-offers; PASS |
| c2-operator-foreign-screen-negative-offers | c2-operator | `GET /api/v2/carriers/:id/offers` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-offers; PASS |
| shipper-foreign-screen-negative-offers | shipper | `GET /api/v2/carriers/:id/offers` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-offers; PASS |
| screen-metrics | c1-admin | `GET /api/v2/carriers/:id/metrics?limit=25&offset=0` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 PASS | 200 PASS | —; PASS |
| c1-admin-detail-metrics | c1-admin | `GET /api/v2/carriers/:id/metrics/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200; ACTIVE PASS | —; PASS |
| c1-admin-other-carrier-screen-negative-metrics | c1-admin | `GET /api/v2/carriers/:id/metrics` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-metrics; PASS |
| c1-operator-screen-metrics | c1-operator | `GET /api/v2/carriers/:id/metrics?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-detail-metrics | c1-operator | `GET /api/v2/carriers/:id/metrics/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200; ACTIVE PASS | —; PASS |
| c1-operator-other-carrier-screen-negative-metrics | c1-operator | `GET /api/v2/carriers/:id/metrics` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-operator-screen-metrics; PASS |
| c1-dispatcher-screen-metrics | c1-dispatcher | `GET /api/v2/carriers/:id/metrics?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-detail-metrics | c1-dispatcher | `GET /api/v2/carriers/:id/metrics/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200; ACTIVE PASS | —; PASS |
| c1-dispatcher-other-carrier-screen-negative-metrics | c1-dispatcher | `GET /api/v2/carriers/:id/metrics` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-dispatcher-screen-metrics; PASS |
| c2-admin-foreign-screen-negative-metrics | c2-admin | `GET /api/v2/carriers/:id/metrics` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-metrics; PASS |
| c2-operator-foreign-screen-negative-metrics | c2-operator | `GET /api/v2/carriers/:id/metrics` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-metrics; PASS |
| shipper-foreign-screen-negative-metrics | shipper | `GET /api/v2/carriers/:id/metrics` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-metrics; PASS |
| screen-bookings | c1-admin | `GET /api/v2/carriers/:id/bookings?limit=25&offset=0` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 PASS | 200 PASS | —; PASS |
| c1-admin-detail-bookings | c1-admin | `GET /api/v2/carriers/:id/bookings/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200; COMPLETED PASS | —; PASS |
| c1-admin-other-carrier-screen-negative-bookings | c1-admin | `GET /api/v2/carriers/:id/bookings` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-bookings; PASS |
| c1-operator-screen-bookings | c1-operator | `GET /api/v2/carriers/:id/bookings?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-detail-bookings | c1-operator | `GET /api/v2/carriers/:id/bookings/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200; COMPLETED PASS | —; PASS |
| c1-operator-other-carrier-screen-negative-bookings | c1-operator | `GET /api/v2/carriers/:id/bookings` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-operator-screen-bookings; PASS |
| c1-dispatcher-screen-bookings | c1-dispatcher | `GET /api/v2/carriers/:id/bookings?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-detail-bookings | c1-dispatcher | `GET /api/v2/carriers/:id/bookings/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200; COMPLETED PASS | —; PASS |
| c1-dispatcher-other-carrier-screen-negative-bookings | c1-dispatcher | `GET /api/v2/carriers/:id/bookings` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-dispatcher-screen-bookings; PASS |
| c2-admin-foreign-screen-negative-bookings | c2-admin | `GET /api/v2/carriers/:id/bookings` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-bookings; PASS |
| c2-operator-foreign-screen-negative-bookings | c2-operator | `GET /api/v2/carriers/:id/bookings` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-bookings; PASS |
| shipper-foreign-screen-negative-bookings | shipper | `GET /api/v2/carriers/:id/bookings` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-bookings; PASS |
| screen-holds | c1-admin | `GET /api/v2/carriers/:id/capacity/holds?limit=25&offset=0` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 PASS | 200 PASS | —; PASS |
| c1-admin-detail-holds | c1-admin | `GET /api/v2/carriers/:id/capacity/holds/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200; RELEASED PASS | —; PASS |
| c1-admin-other-carrier-screen-negative-holds | c1-admin | `GET /api/v2/carriers/:id/capacity/holds` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-holds; PASS |
| c1-operator-screen-holds | c1-operator | `GET /api/v2/carriers/:id/capacity/holds?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-detail-holds | c1-operator | `GET /api/v2/carriers/:id/capacity/holds/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200; RELEASED PASS | —; PASS |
| c1-operator-other-carrier-screen-negative-holds | c1-operator | `GET /api/v2/carriers/:id/capacity/holds` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-operator-screen-holds; PASS |
| c1-dispatcher-screen-holds | c1-dispatcher | `GET /api/v2/carriers/:id/capacity/holds?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-detail-holds | c1-dispatcher | `GET /api/v2/carriers/:id/capacity/holds/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200; RELEASED PASS | —; PASS |
| c1-dispatcher-other-carrier-screen-negative-holds | c1-dispatcher | `GET /api/v2/carriers/:id/capacity/holds` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-dispatcher-screen-holds; PASS |
| c2-admin-foreign-screen-negative-holds | c2-admin | `GET /api/v2/carriers/:id/capacity/holds` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-holds; PASS |
| c2-operator-foreign-screen-negative-holds | c2-operator | `GET /api/v2/carriers/:id/capacity/holds` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-holds; PASS |
| shipper-foreign-screen-negative-holds | shipper | `GET /api/v2/carriers/:id/capacity/holds` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-holds; PASS |
| screen-executions | c1-admin | `GET /api/v2/carriers/:id/executions?limit=25&offset=0` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 PASS | 200 PASS | —; PASS |
| c1-admin-detail-executions | c1-admin | `GET /api/v2/carriers/:id/executions/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200; COMPLETED PASS | —; PASS |
| c1-admin-other-carrier-screen-negative-executions | c1-admin | `GET /api/v2/carriers/:id/executions` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-executions; PASS |
| c1-operator-screen-executions | c1-operator | `GET /api/v2/carriers/:id/executions?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-detail-executions | c1-operator | `GET /api/v2/carriers/:id/executions/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200; COMPLETED PASS | —; PASS |
| c1-operator-other-carrier-screen-negative-executions | c1-operator | `GET /api/v2/carriers/:id/executions` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-operator-screen-executions; PASS |
| c1-dispatcher-screen-executions | c1-dispatcher | `GET /api/v2/carriers/:id/executions?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-detail-executions | c1-dispatcher | `GET /api/v2/carriers/:id/executions/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200; COMPLETED PASS | —; PASS |
| c1-dispatcher-other-carrier-screen-negative-executions | c1-dispatcher | `GET /api/v2/carriers/:id/executions` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-dispatcher-screen-executions; PASS |
| c2-admin-foreign-screen-negative-executions | c2-admin | `GET /api/v2/carriers/:id/executions` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-executions; PASS |
| c2-operator-foreign-screen-negative-executions | c2-operator | `GET /api/v2/carriers/:id/executions` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-executions; PASS |
| shipper-foreign-screen-negative-executions | shipper | `GET /api/v2/carriers/:id/executions` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-executions; PASS |
| screen-incidents | c1-admin | `GET /api/v2/carriers/:id/executions/:id/incidents?limit=25&offset=0` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 PASS | 200 PASS | —; PASS |
| c1-admin-detail-incidents | c1-admin | `GET /api/v2/carriers/:id/executions/:id/incidents/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200; RESOLVED PASS | —; PASS |
| c1-admin-other-carrier-screen-negative-incidents | c1-admin | `GET /api/v2/carriers/:id/executions/:id/incidents` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-incidents; PASS |
| c1-operator-screen-incidents | c1-operator | `GET /api/v2/carriers/:id/executions/:id/incidents?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-detail-incidents | c1-operator | `GET /api/v2/carriers/:id/executions/:id/incidents/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200; RESOLVED PASS | —; PASS |
| c1-operator-other-carrier-screen-negative-incidents | c1-operator | `GET /api/v2/carriers/:id/executions/:id/incidents` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-operator-screen-incidents; PASS |
| c1-dispatcher-screen-incidents | c1-dispatcher | `GET /api/v2/carriers/:id/executions/:id/incidents?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-detail-incidents | c1-dispatcher | `GET /api/v2/carriers/:id/executions/:id/incidents/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200; RESOLVED PASS | —; PASS |
| c1-dispatcher-other-carrier-screen-negative-incidents | c1-dispatcher | `GET /api/v2/carriers/:id/executions/:id/incidents` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-dispatcher-screen-incidents; PASS |
| c2-admin-foreign-screen-negative-incidents | c2-admin | `GET /api/v2/carriers/:id/executions/:id/incidents` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-incidents; PASS |
| c2-operator-foreign-screen-negative-incidents | c2-operator | `GET /api/v2/carriers/:id/executions/:id/incidents` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-incidents; PASS |
| shipper-foreign-screen-negative-incidents | shipper | `GET /api/v2/carriers/:id/executions/:id/incidents` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-incidents; PASS |
| screen-execution-events | c1-admin | `GET /api/v2/carriers/:id/executions/:id/events?limit=25&offset=0` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 PASS | 200 PASS | —; PASS |
| c1-admin-detail-execution-events | c1-admin | `GET /api/v2/carriers/:id/executions/:id/events/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200; RECORDED PASS | —; PASS |
| c1-admin-other-carrier-screen-negative-execution-events | c1-admin | `GET /api/v2/carriers/:id/executions/:id/events` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-execution-events; PASS |
| c1-operator-screen-execution-events | c1-operator | `GET /api/v2/carriers/:id/executions/:id/events?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-detail-execution-events | c1-operator | `GET /api/v2/carriers/:id/executions/:id/events/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200; RECORDED PASS | —; PASS |
| c1-operator-other-carrier-screen-negative-execution-events | c1-operator | `GET /api/v2/carriers/:id/executions/:id/events` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-operator-screen-execution-events; PASS |
| c1-dispatcher-screen-execution-events | c1-dispatcher | `GET /api/v2/carriers/:id/executions/:id/events?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-detail-execution-events | c1-dispatcher | `GET /api/v2/carriers/:id/executions/:id/events/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200; RECORDED PASS | —; PASS |
| c1-dispatcher-other-carrier-screen-negative-execution-events | c1-dispatcher | `GET /api/v2/carriers/:id/executions/:id/events` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-dispatcher-screen-execution-events; PASS |
| c2-admin-foreign-screen-negative-execution-events | c2-admin | `GET /api/v2/carriers/:id/executions/:id/events` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-execution-events; PASS |
| c2-operator-foreign-screen-negative-execution-events | c2-operator | `GET /api/v2/carriers/:id/executions/:id/events` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-execution-events; PASS |
| shipper-foreign-screen-negative-execution-events | shipper | `GET /api/v2/carriers/:id/executions/:id/events` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-execution-events; PASS |
| screen-incident-updates | c1-admin | `GET /api/v2/carriers/:id/incidents/:id/updates?limit=25&offset=0` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 PASS | 200 PASS | —; PASS |
| c1-admin-detail-incident-updates | c1-admin | `GET /api/v2/carriers/:id/incidents/:id/updates/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200; RECORDED PASS | —; PASS |
| c1-admin-other-carrier-screen-negative-incident-updates | c1-admin | `GET /api/v2/carriers/:id/incidents/:id/updates` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-incident-updates; PASS |
| c1-operator-screen-incident-updates | c1-operator | `GET /api/v2/carriers/:id/incidents/:id/updates?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-detail-incident-updates | c1-operator | `GET /api/v2/carriers/:id/incidents/:id/updates/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200; RECORDED PASS | —; PASS |
| c1-operator-other-carrier-screen-negative-incident-updates | c1-operator | `GET /api/v2/carriers/:id/incidents/:id/updates` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-operator-screen-incident-updates; PASS |
| c1-dispatcher-screen-incident-updates | c1-dispatcher | `GET /api/v2/carriers/:id/incidents/:id/updates?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-detail-incident-updates | c1-dispatcher | `GET /api/v2/carriers/:id/incidents/:id/updates/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200; RECORDED PASS | —; PASS |
| c1-dispatcher-other-carrier-screen-negative-incident-updates | c1-dispatcher | `GET /api/v2/carriers/:id/incidents/:id/updates` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-dispatcher-screen-incident-updates; PASS |
| c2-admin-foreign-screen-negative-incident-updates | c2-admin | `GET /api/v2/carriers/:id/incidents/:id/updates` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-incident-updates; PASS |
| c2-operator-foreign-screen-negative-incident-updates | c2-operator | `GET /api/v2/carriers/:id/incidents/:id/updates` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-incident-updates; PASS |
| shipper-foreign-screen-negative-incident-updates | shipper | `GET /api/v2/carriers/:id/incidents/:id/updates` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-incident-updates; PASS |
| screen-consolidations | c1-admin | `GET /api/v2/carriers/:id/consolidations?limit=25&offset=0` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 PASS | 200 PASS | —; PASS |
| c1-admin-detail-consolidations | c1-admin | `GET /api/v2/carriers/:id/consolidations/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200; OPEN PASS | —; PASS |
| c1-admin-other-carrier-screen-negative-consolidations | c1-admin | `GET /api/v2/carriers/:id/consolidations` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-consolidations; PASS |
| c1-operator-screen-consolidations | c1-operator | `GET /api/v2/carriers/:id/consolidations?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-detail-consolidations | c1-operator | `GET /api/v2/carriers/:id/consolidations/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200; OPEN PASS | —; PASS |
| c1-operator-other-carrier-screen-negative-consolidations | c1-operator | `GET /api/v2/carriers/:id/consolidations` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-operator-screen-consolidations; PASS |
| c1-dispatcher-screen-consolidations | c1-dispatcher | `GET /api/v2/carriers/:id/consolidations?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-detail-consolidations | c1-dispatcher | `GET /api/v2/carriers/:id/consolidations/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200; OPEN PASS | —; PASS |
| c1-dispatcher-other-carrier-screen-negative-consolidations | c1-dispatcher | `GET /api/v2/carriers/:id/consolidations` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-dispatcher-screen-consolidations; PASS |
| c2-admin-foreign-screen-negative-consolidations | c2-admin | `GET /api/v2/carriers/:id/consolidations` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-consolidations; PASS |
| c2-operator-foreign-screen-negative-consolidations | c2-operator | `GET /api/v2/carriers/:id/consolidations` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-consolidations; PASS |
| shipper-foreign-screen-negative-consolidations | shipper | `GET /api/v2/carriers/:id/consolidations` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-consolidations; PASS |
| screen-asset-events | c1-admin | `GET /api/v2/carriers/:id/assets/:id/events?limit=25&offset=0` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 PASS | 200 PASS | —; PASS |
| c1-admin-detail-asset-events | c1-admin | `GET /api/v2/carriers/:id/assets/:id/events/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200; RECORDED PASS | —; PASS |
| c1-admin-other-carrier-screen-negative-asset-events | c1-admin | `GET /api/v2/carriers/:id/assets/:id/events` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-asset-events; PASS |
| c1-operator-screen-asset-events | c1-operator | `GET /api/v2/carriers/:id/assets/:id/events?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-detail-asset-events | c1-operator | `GET /api/v2/carriers/:id/assets/:id/events/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200; RECORDED PASS | —; PASS |
| c1-operator-other-carrier-screen-negative-asset-events | c1-operator | `GET /api/v2/carriers/:id/assets/:id/events` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-operator-screen-asset-events; PASS |
| c1-dispatcher-screen-asset-events | c1-dispatcher | `GET /api/v2/carriers/:id/assets/:id/events?limit=25&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-detail-asset-events | c1-dispatcher | `GET /api/v2/carriers/:id/assets/:id/events/:id` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200; RECORDED PASS | —; PASS |
| c1-dispatcher-other-carrier-screen-negative-asset-events | c1-dispatcher | `GET /api/v2/carriers/:id/assets/:id/events` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-dispatcher-screen-asset-events; PASS |
| c2-admin-foreign-screen-negative-asset-events | c2-admin | `GET /api/v2/carriers/:id/assets/:id/events` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-asset-events; PASS |
| c2-operator-foreign-screen-negative-asset-events | c2-operator | `GET /api/v2/carriers/:id/assets/:id/events` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-asset-events; PASS |
| shipper-foreign-screen-negative-asset-events | shipper | `GET /api/v2/carriers/:id/assets/:id/events` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | screen-asset-events; PASS |
| c1-admin-map-nodes | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/routing/nodes?limit=100&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-admin-other-map-negative-nodes | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/routing/nodes` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-admin-map-nodes; PASS |
| c1-admin-shipper-map-negative-nodes | shipper | `GET /api/v2/carrier-portal/carriers/:id/routing/nodes` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-admin-map-nodes; PASS |
| c1-operator-map-nodes | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/routing/nodes?limit=100&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-other-map-negative-nodes | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/routing/nodes` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-operator-map-nodes; PASS |
| c1-operator-shipper-map-negative-nodes | shipper | `GET /api/v2/carrier-portal/carriers/:id/routing/nodes` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-operator-map-nodes; PASS |
| c1-dispatcher-map-nodes | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/routing/nodes?limit=100&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-other-map-negative-nodes | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/routing/nodes` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-dispatcher-map-nodes; PASS |
| c1-dispatcher-shipper-map-negative-nodes | shipper | `GET /api/v2/carrier-portal/carriers/:id/routing/nodes` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-dispatcher-map-nodes; PASS |
| c1-admin-map-conditions | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/routing/conditions?limit=100&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-admin-other-map-negative-conditions | c1-admin | `GET /api/v2/carrier-portal/carriers/:id/routing/conditions` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-admin-map-conditions; PASS |
| c1-admin-shipper-map-negative-conditions | shipper | `GET /api/v2/carrier-portal/carriers/:id/routing/conditions` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-admin-map-conditions; PASS |
| c1-operator-map-conditions | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/routing/conditions?limit=100&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-operator-other-map-negative-conditions | c1-operator | `GET /api/v2/carrier-portal/carriers/:id/routing/conditions` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-operator-map-conditions; PASS |
| c1-operator-shipper-map-negative-conditions | shipper | `GET /api/v2/carrier-portal/carriers/:id/routing/conditions` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-operator-map-conditions; PASS |
| c1-dispatcher-map-conditions | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/routing/conditions?limit=100&offset=0` | 200; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 200 PASS | —; PASS |
| c1-dispatcher-other-map-negative-conditions | c1-dispatcher | `GET /api/v2/carrier-portal/carriers/:id/routing/conditions` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-dispatcher-map-conditions; PASS |
| c1-dispatcher-shipper-map-negative-conditions | shipper | `GET /api/v2/carrier-portal/carriers/:id/routing/conditions` | 403; H45; IDENTITY_AND_MCP_CHANNELS.md:10,14 | Not measured | 403; FORBIDDEN_CARRIER_IDENTITY PASS | c1-dispatcher-map-conditions; PASS |

## Portal resource HTTP coverage by role

All 28 resources use their actual resourcePath and parseRecords functions. Each ADMIN/OPERATOR/DISPATCHER collection has data, a detail probe, an other-carrier denial and a shipper denial. Access/profile and map paths are included in the case matrix. Advisory permissions are compared to explicit contract roles/states; database HTTP denials are measured independently. Optional command/state combinations beyond this flow remain unmeasured.

| Resource | Actor | Family | HTTP | Rows | Classification |
|---|---|---|---:|---:|---|
| depots | c1-admin | catalog | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| depots | c1-operator | catalog | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| depots | c1-dispatcher | catalog | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| services | c1-admin | catalog | 200 | 2 | FUNCTIONAL_DATA_OBSERVED |
| services | c1-operator | catalog | 200 | 2 | FUNCTIONAL_DATA_OBSERVED |
| services | c1-dispatcher | catalog | 200 | 2 | FUNCTIONAL_DATA_OBSERVED |
| areas | c1-admin | catalog | 200 | 2 | FUNCTIONAL_DATA_OBSERVED |
| areas | c1-operator | catalog | 200 | 2 | FUNCTIONAL_DATA_OBSERVED |
| areas | c1-dispatcher | catalog | 200 | 2 | FUNCTIONAL_DATA_OBSERVED |
| lanes | c1-admin | catalog | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| lanes | c1-operator | catalog | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| lanes | c1-dispatcher | catalog | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| partners | c1-admin | catalog | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| partners | c1-operator | catalog | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| partners | c1-dispatcher | catalog | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| limits | c1-admin | workflow | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| limits | c1-operator | workflow | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| limits | c1-dispatcher | workflow | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| assets | c1-admin | catalog | 200 | 2 | FUNCTIONAL_DATA_OBSERVED |
| assets | c1-operator | catalog | 200 | 2 | FUNCTIONAL_DATA_OBSERVED |
| assets | c1-dispatcher | catalog | 200 | 2 | FUNCTIONAL_DATA_OBSERVED |
| vehicle-combinations | c1-admin | catalog | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| vehicle-combinations | c1-operator | catalog | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| vehicle-combinations | c1-dispatcher | catalog | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| drivers | c1-admin | catalog | 200 | 2 | FUNCTIONAL_DATA_OBSERVED |
| drivers | c1-operator | catalog | 200 | 2 | FUNCTIONAL_DATA_OBSERVED |
| drivers | c1-dispatcher | catalog | 200 | 2 | FUNCTIONAL_DATA_OBSERVED |
| capacity-pools | c1-admin | catalog | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| capacity-pools | c1-operator | catalog | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| capacity-pools | c1-dispatcher | catalog | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| calendars | c1-admin | catalog | 200 | 2 | FUNCTIONAL_DATA_OBSERVED |
| calendars | c1-operator | catalog | 200 | 2 | FUNCTIONAL_DATA_OBSERVED |
| calendars | c1-dispatcher | catalog | 200 | 2 | FUNCTIONAL_DATA_OBSERVED |
| driver-assignments | c1-admin | catalog | 200 | 2 | FUNCTIONAL_DATA_OBSERVED |
| driver-assignments | c1-operator | catalog | 200 | 2 | FUNCTIONAL_DATA_OBSERVED |
| driver-assignments | c1-dispatcher | catalog | 200 | 2 | FUNCTIONAL_DATA_OBSERVED |
| vehicle-assignments | c1-admin | catalog | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| vehicle-assignments | c1-operator | catalog | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| vehicle-assignments | c1-dispatcher | catalog | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| maintenances | c1-admin | catalog | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| maintenances | c1-operator | catalog | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| maintenances | c1-dispatcher | catalog | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| repositioning-blocks | c1-admin | catalog | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| repositioning-blocks | c1-operator | catalog | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| repositioning-blocks | c1-dispatcher | catalog | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| asset-capabilities | c1-admin | catalog | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| asset-capabilities | c1-operator | catalog | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| asset-capabilities | c1-dispatcher | catalog | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| capability-definitions | c1-admin | catalog | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| capability-definitions | c1-operator | catalog | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| capability-definitions | c1-dispatcher | catalog | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| opportunities | c1-admin | workflow | 200 | 2 | FUNCTIONAL_DATA_OBSERVED |
| opportunities | c1-operator | workflow | 200 | 2 | FUNCTIONAL_DATA_OBSERVED |
| opportunities | c1-dispatcher | workflow | 200 | 2 | FUNCTIONAL_DATA_OBSERVED |
| offers | c1-admin | workflow | 200 | 2 | FUNCTIONAL_DATA_OBSERVED |
| offers | c1-operator | workflow | 200 | 2 | FUNCTIONAL_DATA_OBSERVED |
| offers | c1-dispatcher | workflow | 200 | 2 | FUNCTIONAL_DATA_OBSERVED |
| metrics | c1-admin | workflow | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| metrics | c1-operator | workflow | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| metrics | c1-dispatcher | workflow | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| bookings | c1-admin | workflow | 200 | 2 | FUNCTIONAL_DATA_OBSERVED |
| bookings | c1-operator | workflow | 200 | 2 | FUNCTIONAL_DATA_OBSERVED |
| bookings | c1-dispatcher | workflow | 200 | 2 | FUNCTIONAL_DATA_OBSERVED |
| holds | c1-admin | workflow | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| holds | c1-operator | workflow | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| holds | c1-dispatcher | workflow | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| executions | c1-admin | workflow | 200 | 2 | FUNCTIONAL_DATA_OBSERVED |
| executions | c1-operator | workflow | 200 | 2 | FUNCTIONAL_DATA_OBSERVED |
| executions | c1-dispatcher | workflow | 200 | 2 | FUNCTIONAL_DATA_OBSERVED |
| incidents | c1-admin | workflow | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| incidents | c1-operator | workflow | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| incidents | c1-dispatcher | workflow | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| execution-events | c1-admin | workflow | 200 | 2 | FUNCTIONAL_DATA_OBSERVED |
| execution-events | c1-operator | workflow | 200 | 2 | FUNCTIONAL_DATA_OBSERVED |
| execution-events | c1-dispatcher | workflow | 200 | 2 | FUNCTIONAL_DATA_OBSERVED |
| incident-updates | c1-admin | workflow | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| incident-updates | c1-operator | workflow | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| incident-updates | c1-dispatcher | workflow | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| consolidations | c1-admin | workflow | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| consolidations | c1-operator | workflow | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| consolidations | c1-dispatcher | workflow | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| asset-events | c1-admin | workflow | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| asset-events | c1-operator | workflow | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| asset-events | c1-dispatcher | workflow | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |

## Final HAC-45 result

Two final `hac45-retest` cycles: each 510/510 HTTP PASS; 242/242 paired negatives PASS; 108/108 UI permission checks PASS; 2/2 actual-session authenticated RLS controls (own=1, foreign=0); primary booking COMPLETED. All 25 prior FORBIDDEN_TENANT cases now meet their original 200/201 expectation. Cleanup: 62/62 and 62/62 zero counts, 64 affected ordinary triggers restored, 1242 captured trigger states compared. Global Auth users/sessions/identities/refresh/AMR counts are zero after the gate too. Eight baseline cargo categories remain unchanged.

Gate: `python scripts/qa/carrier_portal.py pgtap`, actual `Files=28, Tests=1015,  6 wallclock secs ( 0.19 usr  0.06 sys +  0.17 cusr  0.30 csys =  0.72 CPU)`, `Result: PASS`, exit 0. All V2 profile suites, including pgTAP 34, ran with unchanged main v2-road-baseline. Counts are observed evidence, never a fixed gate requirement. No new product defect was observed in this measured scope. The historical HAC-41 blocker is not reproduced on HAC-45.

Evidence: external `hac44-carrier-portal-hac45-evidence`, including commands/exits, both immutable cycle sets, request/response cases, exact PKs, credential-free backups, trigger snapshots, source hashes, gate output and final docker inventory. Historical CP-1/CP-1b remains preserved. The dedicated bank is stopped after cleanup; other containers are untouched. No hosted DB write, other-bank mutation, product/migration/CI/existing-scenario edit, PR merge, main push, force-push, rebase or issue completion was performed. The only merge was the explicitly authorized origin/main synchronization into this QA branch.
