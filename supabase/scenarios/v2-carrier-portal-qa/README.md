# HAC-44 carrier portal synthetic scenario

LOCAL_ONLY / SIMULATED. CP-1b fixture and authorization evidence on `codex/v2-qa-carrier-portal-seeds`, based exactly on `9d0c3ee32179f00242a6961b90116293a1bc6d0e`. This package changes scenario data and local QA scripts only. It does not certify the final portal on a future carrier correction SHA.

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

`prepare` checks immutable migration provenance and builds this dedicated local bank from the V2 main migrations. SQL runs through the owned Docker socket with `psql -X -A -t -v ON_ERROR_STOP=1 -v local_only=1`. A functional contract failure retains exit 1; the cycle runner performs mandatory cleanup and repeats the known defect. A new HTTP failure or prerequisite blocker stops further cycles after cleanup and forbids CP-2. Evidence snapshots are immutable directories `cycles/<label>/1` and `2`; an existing label is rejected. Do not interpret process exit 1 as a teardown failure without reading the phase records.

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

## Observed defects and evidence limits

Carrier-only profile and catalog access returns `403 FORBIDDEN_TENANT` despite a valid ADMIN/operator/grant and nonempty catalog fixtures. The same profile succeeds for the independent setup OWNER + CATALOG_ADMIN and is explicitly an endpoint control, not carrier authorization. The carrier driver-assignment POST also returns 403; the unchanged native catalog seam succeeds with the separate setup actor, allowing the workflow test to continue without adding shipper membership to carrier users. These are reproduced product/contract defects, not a reason to change expected results. Backend owner: Axel / HAC-41; consuming portal owner: Juan / HAC-43, as recorded in `docs/v2-amazon/delivery/HAC43_MODEL_TRACEABILITY.md:14,61` and `docs/v2-amazon/delivery/friction-logs/HAC43_LOCAL_ENVIRONMENT_2026-10-07.md:29,30`. Reproduction: seed + verify + `http`, then inspect the profile, catalog and driver-assignment cases. The harness exit remains 1.

Calendar conflict is measured after a positive hold and actual carrier confirmation. Revalidation of the second assignment rejects the overlapping commitment with `409 BOOKING_ASSIGNMENT_NOT_CURRENT` before another hold is inserted. Driver conflict independently returns `409 FLEET_COMMITMENT_CONFLICT`. Insufficient capacity returns HTTP 201 for the recorded candidate with domain status `ineligible` and a capacity reason; its paired control is an otherwise compatible eligible C2 plan. A 201 here does not mean capacity acceptance.

The active page imports `CarrierPortal` (`cargomesh/src/app/carrier-portal/page.tsx:2`); that component and `CarrierMap` use `portalRequest` and resource paths. Static inspection found no active demo fallback in this page tree. This is not a browser rendering certification. All 28 resource collection paths in `carrierResources` were probed after the flow. CP-1b fills metrics, OPEN LTL consolidations and spare-asset events through native writers during HTTP execution. Both carriers have one exact row in each collection. ADMIN/OPERATOR/DISPATCHER own-carrier reads find exact IDs; other-carrier and shipper reads are denied with paired nonempty controls. This proves authorization and data, not a complete shared LTL trip. The consolidation follows the ROAD LTL service, physical asset/calendar, carrier-linked route and native writer recipe in `supabase/scenarios/v2-full-flow-qa/ltl-seed.sql`; it has no member executions or reservations. Spare LTL assets enter MAINTENANCE only after the primary booking completes. Map routing nodes/conditions and every optional mutation/revision are not covered by this minimum flow; the API inventory must not be read as full UI acceptance.

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

Backend owner Axel/HAC-41 must correct `cargomesh/src/server/hono/middleware/v2-auth.ts:19-25` and the carrier catalog authorization path so verified carrier-only actors work without OrganizationMember. Final portal retest must use the correction SHA delivered by the team: repeat profile/catalog/fleet positives under carrier-only ADMIN, preserve cross-carrier/role/identity denials and verify the full booking and cleanup cycles. That future retest and rendered browser acceptance are outside this delivery.


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

## Exact owned row inventory

Seed counts precede HTTP native fixture creation. Before-cleanup counts include workflow and real Auth operations. Every after-cleanup count was zero in both cycles.

| Relation | Seed | Before cleanup | After cleanup |
|---|---:|---:|---:|
| `auth.audit_log_entries` | 0 | 24 | 0 |
| `auth.identities` | 0 | 0 | 0 |
| `auth.mfa_amr_claims` | 0 | 12 | 0 |
| `auth.refresh_tokens` | 0 | 12 | 0 |
| `auth.sessions` | 0 | 12 | 0 |
| `auth.users` | 12 | 12 | 0 |
| `private.v2_carrier_workflow_receipts` | 2 | 16 | 0 |
| `private.v2_catalog_grants` | 11 | 11 | 0 |
| `private.v2_catalog_receipts` | 28 | 30 | 0 |
| `private.v2_identity_receipts` | 14 | 14 | 0 |
| `private.v2_request_command_receipts` | 2 | 3 | 0 |
| `private.v2_workflow_receipts` | 14 | 23 | 0 |
| `public.asset_cargo_capabilities` | 2 | 2 | 0 |
| `public.asset_status_events` | 0 | 2 | 0 |
| `public.capacity_calendars` | 4 | 4 | 0 |
| `public.capacity_consolidations` | 0 | 2 | 0 |
| `public.capacity_reservations` | 0 | 1 | 0 |
| `public.cargo_capability_definitions` | 2 | 2 | 0 |
| `public.carrier_depots` | 2 | 2 | 0 |
| `public.carrier_operators` | 10 | 10 | 0 |
| `public.carrier_opportunities` | 3 | 3 | 0 |
| `public.carrier_service_cargo_categories` | 4 | 4 | 0 |
| `public.carrier_services` | 4 | 4 | 0 |
| `public.carriers` | 2 | 2 | 0 |
| `public.driver_assignments` | 0 | 1 | 0 |
| `public.drivers` | 2 | 2 | 0 |
| `public.execution_events` | 0 | 2 | 0 |
| `public.freight_requests` | 2 | 3 | 0 |
| `public.incident_updates` | 0 | 1 | 0 |
| `public.load_allocations` | 3 | 4 | 0 |
| `public.logistics_nodes` | 2 | 2 | 0 |
| `public.operational_incidents` | 0 | 1 | 0 |
| `public.organization_members` | 2 | 2 | 0 |
| `public.organizations` | 2 | 2 | 0 |
| `public.plan_leg_assignments` | 3 | 4 | 0 |
| `public.plan_resource_bindings` | 3 | 4 | 0 |
| `public.plan_resources` | 3 | 4 | 0 |
| `public.route_corridors` | 1 | 1 | 0 |
| `public.route_legs` | 3 | 4 | 0 |
| `public.route_planning_policies` | 1 | 1 | 0 |
| `public.route_plans` | 3 | 4 | 0 |
| `public.route_resource_limits` | 2 | 2 | 0 |
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

## Affected-table trigger inventory and reasons

Only affected noninternal triggers below are suspended within the authorized cleanup transaction. Their original O/A/R/D state is restored and checked before COMMIT. Internal FK triggers and CHECK constraints remain active.

| Relation | Ordinary triggers, original state | Teardown-only reason |
|---|---|---|
| `auth.audit_log_entries` | none | No ordinary trigger to suspend. |
| `auth.mfa_amr_claims` | none | No ordinary trigger to suspend. |
| `auth.refresh_tokens` | none | No ordinary trigger to suspend. |
| `auth.sessions` | none | No ordinary trigger to suspend. |
| `auth.users` | none | No ordinary trigger to suspend. |
| `private.v2_carrier_workflow_receipts` | none | No ordinary trigger to suspend. |
| `private.v2_catalog_grants` | none | No ordinary trigger to suspend. |
| `private.v2_catalog_receipts` | none | No ordinary trigger to suspend. |
| `private.v2_identity_receipts` | none | No ordinary trigger to suspend. |
| `private.v2_request_command_receipts` | none | No ordinary trigger to suspend. |
| `private.v2_workflow_receipts` | none | No ordinary trigger to suspend. |
| `public.asset_cargo_capabilities` | `v2_fleet_command_guard` (O) | Native/domain/computed-reference guards prevent direct synthetic fact removal; exact-ID teardown only. |
| `public.asset_status_events` | `workflow_guard` (O) | Native/domain/computed-reference guards prevent direct synthetic fact removal; exact-ID teardown only. |
| `public.capacity_calendars` | `a_crew_calendar_guard` (O), `v2_fleet_command_guard` (O) | Native/domain/computed-reference guards prevent direct synthetic fact removal; exact-ID teardown only. |
| `public.capacity_consolidations` | `workflow_guard` (O) | Native/domain/computed-reference guards prevent direct synthetic fact removal; exact-ID teardown only. |
| `public.capacity_reservations` | `a_crew_reservation_guard` (O), `a_reservation_resource` (O), `v2_fleet_reservation_guard` (O), `z_workflow_reservation_sharing` (O) | Native/domain/computed-reference guards prevent direct synthetic fact removal; exact-ID teardown only. |
| `public.cargo_capability_definitions` | `v2_fleet_command_guard` (O) | Native/domain/computed-reference guards prevent direct synthetic fact removal; exact-ID teardown only. |
| `public.carrier_depots` | `v2_catalog_command_guard` (O) | Native/domain/computed-reference guards prevent direct synthetic fact removal; exact-ID teardown only. |
| `public.carrier_operators` | none | No ordinary trigger to suspend. |
| `public.carrier_opportunities` | `workflow_guard` (O) | Native/domain/computed-reference guards prevent direct synthetic fact removal; exact-ID teardown only. |
| `public.carrier_service_cargo_categories` | `v2_catalog_link_guard` (O) | Native/domain/computed-reference guards prevent direct synthetic fact removal; exact-ID teardown only. |
| `public.carrier_services` | `a_crew_service_guard` (O), `v2_catalog_command_guard` (O), `v2_service_fleet_mode_guard` (O) | Native/domain/computed-reference guards prevent direct synthetic fact removal; exact-ID teardown only. |
| `public.carriers` | `v2_catalog_command_guard` (O), `z_workflow_carrier_status_guard` (O) | Native/domain/computed-reference guards prevent direct synthetic fact removal; exact-ID teardown only. |
| `public.driver_assignments` | `a_driver_occupancy` (O), `crew_command_guard` (O) | Native/domain/computed-reference guards prevent direct synthetic fact removal; exact-ID teardown only. |
| `public.drivers` | `crew_command_guard` (O) | Native/domain/computed-reference guards prevent direct synthetic fact removal; exact-ID teardown only. |
| `public.execution_events` | `workflow_guard` (O) | Native/domain/computed-reference guards prevent direct synthetic fact removal; exact-ID teardown only. |
| `public.freight_requests` | `guard_freight_creation_receipt` (O), `protect_v2_draft_insert` (O), `protect_v2_draft_update` (O), `verify_v2_receipt_hash` (O) | Native/domain/computed-reference guards prevent direct synthetic fact removal; exact-ID teardown only. |
| `public.incident_updates` | `workflow_guard` (O) | Native/domain/computed-reference guards prevent direct synthetic fact removal; exact-ID teardown only. |
| `public.load_allocations` | none | No ordinary trigger to suspend. |
| `public.logistics_nodes` | `workflow_guard` (O) | Native/domain/computed-reference guards prevent direct synthetic fact removal; exact-ID teardown only. |
| `public.operational_incidents` | `workflow_guard` (O) | Native/domain/computed-reference guards prevent direct synthetic fact removal; exact-ID teardown only. |
| `public.organization_members` | none | No ordinary trigger to suspend. |
| `public.organizations` | `v2_organization_command_guard` (O) | Native/domain/computed-reference guards prevent direct synthetic fact removal; exact-ID teardown only. |
| `public.plan_leg_assignments` | `leg_partner_guard` (O), `leg_requires_resources` (O) | Native/domain/computed-reference guards prevent direct synthetic fact removal; exact-ID teardown only. |
| `public.plan_resource_bindings` | `binding_preserves_resources` (O), `resource_binding_leg_guard` (O) | Native/domain/computed-reference guards prevent direct synthetic fact removal; exact-ID teardown only. |
| `public.plan_resources` | none | No ordinary trigger to suspend. |
| `public.route_corridors` | `workflow_guard` (O) | Native/domain/computed-reference guards prevent direct synthetic fact removal; exact-ID teardown only. |
| `public.route_legs` | none | No ordinary trigger to suspend. |
| `public.route_planning_policies` | `workflow_guard` (O) | Native/domain/computed-reference guards prevent direct synthetic fact removal; exact-ID teardown only. |
| `public.route_plans` | `workflow_guard` (O) | Native/domain/computed-reference guards prevent direct synthetic fact removal; exact-ID teardown only. |
| `public.route_resource_limits` | `workflow_guard` (O) | Native/domain/computed-reference guards prevent direct synthetic fact removal; exact-ID teardown only. |
| `public.scoring_policies` | `workflow_guard` (O) | Native/domain/computed-reference guards prevent direct synthetic fact removal; exact-ID teardown only. |
| `public.selection_decisions` | `workflow_guard` (O) | Native/domain/computed-reference guards prevent direct synthetic fact removal; exact-ID teardown only. |
| `public.selection_offers` | none | No ordinary trigger to suspend. |
| `public.service_areas` | `guard_v2_road_area_before_update` (O), `v2_catalog_command_guard` (O) | Native/domain/computed-reference guards prevent direct synthetic fact removal; exact-ID teardown only. |
| `public.service_lanes` | `v2_catalog_command_guard` (O), `validate_v2_road_lane_before_write` (O) | Native/domain/computed-reference guards prevent direct synthetic fact removal; exact-ID teardown only. |
| `public.transport_assets` | `a_crew_asset_guard` (O), `v2_fleet_command_guard` (O) | Native/domain/computed-reference guards prevent direct synthetic fact removal; exact-ID teardown only. |
| `public.transport_executions` | `crew_execution_scope` (O) | Native/domain/computed-reference guards prevent direct synthetic fact removal; exact-ID teardown only. |
| `public.transport_plan_candidates` | `workflow_guard` (O) | Native/domain/computed-reference guards prevent direct synthetic fact removal; exact-ID teardown only. |
| `public.v2_bookings` | `workflow_guard` (O) | Native/domain/computed-reference guards prevent direct synthetic fact removal; exact-ID teardown only. |
| `public.v2_carrier_metrics` | `workflow_guard` (O) | Native/domain/computed-reference guards prevent direct synthetic fact removal; exact-ID teardown only. |
| `public.v2_carrier_offers` | `offer_issuer_guard` (O), `workflow_guard` (O) | Native/domain/computed-reference guards prevent direct synthetic fact removal; exact-ID teardown only. |
| `public.vehicle_assignments` | `crew_command_guard` (O) | Native/domain/computed-reference guards prevent direct synthetic fact removal; exact-ID teardown only. |

## Case-by-case expected versus observed

I/W/F references resolve to the repository file:line listed above. Endpoint controls explicitly do not certify carrier authorization. Every negative names a positive control from the same cycle.

| Case/action | Actor | HTTP endpoint | Expected and source file:line | Observed | Control / classification |
|---|---|---|---|---|---|
| c1-admin-own-open | c1-admin | `GET /api/v2/carriers/:id/opportunities` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 | —; PASS |
| c1-operator-own-open | c1-operator | `GET /api/v2/carriers/:id/opportunities` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 | —; PASS |
| c1-dispatcher-own-open | c1-dispatcher | `GET /api/v2/carriers/:id/opportunities` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 | —; PASS |
| c2-admin-own-open | c2-admin | `GET /api/v2/carriers/:id/opportunities` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 | —; PASS |
| c2-operator-own-open | c2-operator | `GET /api/v2/carriers/:id/opportunities` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 | —; PASS |
| cookie-open-positive | c1-admin | `GET /api/v2/carriers/:id/opportunities` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 | —; PASS |
| c2-operator-control | c2-operator | `GET /api/v2/carriers/:id/opportunities` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 | —; PASS |
| c2-operator-negative | c2-operator | `GET /api/v2/carriers/:id/opportunities` | 403; FORBIDDEN_CARRIER_IDENTITY; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_IDENTITY | c2-operator-control; PASS |
| inactive-control | c1-admin | `GET /api/v2/carriers/:id/opportunities` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 | —; PASS |
| inactive-negative | inactive | `GET /api/v2/carriers/:id/opportunities` | 403; FORBIDDEN_CARRIER_IDENTITY; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_IDENTITY | inactive-control; PASS |
| invited-control | c1-admin | `GET /api/v2/carriers/:id/opportunities` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 | —; PASS |
| invited-negative | invited | `GET /api/v2/carriers/:id/opportunities` | 403; FORBIDDEN_CARRIER_IDENTITY; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_IDENTITY | invited-control; PASS |
| unverified-control | c1-admin | `GET /api/v2/carriers/:id/opportunities` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 | —; PASS |
| unverified-negative | unverified | `GET /api/v2/carriers/:id/opportunities` | 403; FORBIDDEN_CARRIER_IDENTITY; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_IDENTITY | unverified-control; PASS |
| expired-control | c1-admin | `GET /api/v2/carriers/:id/opportunities` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 | —; PASS |
| expired-negative | expired | `GET /api/v2/carriers/:id/opportunities` | 403; FORBIDDEN_CARRIER_IDENTITY; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_IDENTITY | expired-control; PASS |
| revoked-control | c1-admin | `GET /api/v2/carriers/:id/opportunities` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 | —; PASS |
| revoked-negative | revoked | `GET /api/v2/carriers/:id/opportunities` | 403; FORBIDDEN_CARRIER_IDENTITY; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_IDENTITY | revoked-control; PASS |
| anonymous-control | c1-admin | `GET /api/v2/carriers/:id/opportunities` | 200; IDENTITY_AND_MCP_CHANNELS.md:60 | 200 | —; PASS |
| anonymous-negative | anonymous | `GET /api/v2/carriers/:id/opportunities` | 401; IDENTITY_AND_MCP_CHANNELS.md:60 | 401; UNAUTHORIZED | anonymous-control; PASS |
| portal-profile-carrier-only | c1-admin | `GET /api/v2/carriers/:id` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT | C1-setup-profile-endpoint-control; DEFECT_REPRODUCED; Axel/HAC-41 |
| C1-setup-profile-endpoint-control | setup | `GET /api/v2/carriers/:id` | 200; 20261004032151_hac40_catalog.sql:164,178 | 200 | —; PASS; ENDPOINT_CONTROL_ONLY; setup OWNER + CATALOG_ADMIN is not a carrier principal |
| C1-setup-catalog-endpoint-control | setup | `GET /api/v2/carriers/:id/services` | 200; 20261004032151_hac40_catalog.sql:164,178 | 200 | —; PASS; ENDPOINT_CONTROL_ONLY; does not certify carrier authorization |
| C1-carrier-workflow-control | c1-admin | `GET /api/v2/carriers/:id/opportunities` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 | —; PASS |
| C1-shipper-no-carrier-negative | shipper | `GET /api/v2/carriers/:id/opportunities` | 403; FORBIDDEN_CARRIER_IDENTITY; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_IDENTITY | C1-carrier-workflow-control; PASS |
| C1-shipper-discovery-observation | shipper | `GET /api/v2/carriers/:id/services` | 200; IDENTITY_AND_MCP_CHANNELS.md:9,10,14; PRODUCT_SCOPE.md:47 (policy interpretation above) | 200 | —; PASS; SHIPPER_DISCOVERY_OBSERVATION; no catalog grant; not a carrier authorization control |
| C2-setup-profile-endpoint-control | setup | `GET /api/v2/carriers/:id` | 200; 20261004032151_hac40_catalog.sql:164,178 | 200 | —; PASS; ENDPOINT_CONTROL_ONLY; setup OWNER + CATALOG_ADMIN is not a carrier principal |
| C2-setup-catalog-endpoint-control | setup | `GET /api/v2/carriers/:id/services` | 200; 20261004032151_hac40_catalog.sql:164,178 | 200 | —; PASS; ENDPOINT_CONTROL_ONLY; does not certify carrier authorization |
| C2-carrier-workflow-control | c2-admin | `GET /api/v2/carriers/:id/opportunities` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 | —; PASS |
| C2-shipper-no-carrier-negative | shipper | `GET /api/v2/carriers/:id/opportunities` | 403; FORBIDDEN_CARRIER_IDENTITY; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_IDENTITY | C2-carrier-workflow-control; PASS |
| C2-shipper-discovery-observation | shipper | `GET /api/v2/carriers/:id/services` | 200; IDENTITY_AND_MCP_CHANNELS.md:9,10,14; PRODUCT_SCOPE.md:47 (policy interpretation above) | 200 | —; PASS; SHIPPER_DISCOVERY_OBSERVATION; no catalog grant; not a carrier authorization control |
| portal-catalog-services | c1-admin | `GET /api/v2/carriers/:id/services` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT | C1-setup-catalog-endpoint-control; DEFECT_REPRODUCED; Axel/HAC-41 |
| portal-catalog-depots | c1-admin | `GET /api/v2/carriers/:id/depots` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT | C1-setup-catalog-endpoint-control; DEFECT_REPRODUCED; Axel/HAC-41 |
| portal-catalog-assets | c1-admin | `GET /api/v2/carriers/:id/assets` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT | C1-setup-catalog-endpoint-control; DEFECT_REPRODUCED; Axel/HAC-41 |
| portal-catalog-drivers | c1-admin | `GET /api/v2/carriers/:id/drivers` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT | C1-setup-catalog-endpoint-control; DEFECT_REPRODUCED; Axel/HAC-41 |
| portal-catalog-calendars | c1-admin | `GET /api/v2/carriers/:id/calendars` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT | C1-setup-catalog-endpoint-control; DEFECT_REPRODUCED; Axel/HAC-41 |
| portal-catalog-asset-capabilities | c1-admin | `GET /api/v2/carriers/:id/asset-capabilities` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT | C1-setup-catalog-endpoint-control; DEFECT_REPRODUCED; Axel/HAC-41 |
| portal-catalog-capability-definitions | c1-admin | `GET /api/v2/carriers/:id/capability-definitions` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT | C1-setup-catalog-endpoint-control; DEFECT_REPRODUCED; Axel/HAC-41 |
| fresh-offer | c1-operator | `POST /api/v2/carriers/:id/opportunities/:id/offers` | 201; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 201; RECEIVED | —; PASS |
| shipper-select | shipper | `POST /api/v2/freight/requests/:id/decisions` | 201; HAC40_WORKFLOW_API.md:38,40 | 201; SELECTED | —; PASS |
| shipper-authorize | shipper | `POST /api/v2/bookings` | 201; HAC40_WORKFLOW_API.md:38,40 | 201; AUTHORIZED | —; PASS |
| shipper-prepare-execution | shipper | `POST /api/v2/executions` | 201; HAC40_WORKFLOW_API.md:38,40 | 201; PLANNED | —; PASS |
| conflict-fresh-offer | c1-operator | `POST /api/v2/carriers/:id/opportunities/:id/offers` | 201; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 201; RECEIVED | —; PASS |
| conflict-shipper-select | shipper | `POST /api/v2/freight/requests/:id/decisions` | 201; HAC40_WORKFLOW_API.md:38,40 | 201; SELECTED | —; PASS |
| conflict-shipper-authorize | shipper | `POST /api/v2/bookings` | 201; HAC40_WORKFLOW_API.md:38,40 | 201; AUTHORIZED | —; PASS |
| conflict-shipper-prepare-execution | shipper | `POST /api/v2/executions` | 201; HAC40_WORKFLOW_API.md:38,40 | 201; PLANNED | —; PASS |
| calendar-plan-before-occupancy | shipper | `GET /api/v2/plans/:id` | 200; HAC40_WORKFLOW_API.md:38,40; TRANSPORT_PLANS_AND_FLEET.md:52 | 200; eligible | —; PASS |
| calendar-free-positive | shipper | `POST /api/v2/capacity/holds` | 201; HAC40_WORKFLOW_API.md:38,40; TRANSPORT_PLANS_AND_FLEET.md:52 | 201; HELD | —; PASS |
| carrier-confirm-capacity | c1-operator | `POST /api/v2/carriers/:id/capacity/holds/:id/confirmations` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200; CONFIRMED | —; PASS |
| calendar-occupied-negative | shipper | `POST /api/v2/capacity/holds` | 409; HAC40_WORKFLOW_API.md:38,40; TRANSPORT_PLANS_AND_FLEET.md:52 | 409; BOOKING_ASSIGNMENT_NOT_CURRENT | calendar-free-positive; PASS |
| carrier-confirm-booking | c1-operator | `POST /api/v2/carriers/:id/bookings/:id/confirmations` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200; CONFIRMED | —; PASS |
| portal-driver-assignment-carrier-only | c1-admin | `POST /api/v2/carriers/:id/driver-assignments` | 201; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9; TRANSPORT_PLANS_AND_FLEET.md:52 | 403; FORBIDDEN_TENANT | driver-free-positive (setup endpoint control); DEFECT_REPRODUCED; Axel/HAC-41 |
| driver-free-positive | setup | `POST /api/v2/carriers/:id/driver-assignments` | 201; 20261004032151_hac40_catalog.sql:164,178; TRANSPORT_PLANS_AND_FLEET.md:52 | 201 | —; PASS; ENDPOINT_CONTROL_ONLY; independent catalog setup, not carrier authorization |
| shipper-no-catalog-grant-negative | shipper | `POST /api/v2/carriers/:id/driver-assignments` | 403; FORBIDDEN_CATALOG; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CATALOG | driver-free-positive; PASS |
| driver-occupied-negative | setup | `POST /api/v2/carriers/:id/driver-assignments` | 409; 20261004032151_hac40_catalog.sql:164,178; TRANSPORT_PLANS_AND_FLEET.md:52 | 409; FLEET_COMMITMENT_CONFLICT | driver-free-positive; PASS |
| vehicle-confirmed-positive | setup | `POST /api/v2/carriers/:id/vehicle-assignments` | 201; 20261004032151_hac40_catalog.sql:164,178 | 201 | —; PASS |
| dispatcher-start | c1-dispatcher | `POST /api/v2/carriers/:id/executions/:id/starts` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200; IN_PROGRESS | —; PASS |
| dispatcher-incident | c1-dispatcher | `POST /api/v2/carriers/:id/executions/:id/incidents` | 201; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 201; OPEN | —; PASS |
| dispatcher-resolve-incident | c1-dispatcher | `POST /api/v2/carriers/:id/incidents/:id/updates` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200; RESOLVED | —; PASS |
| execution-version-before-complete | c1-dispatcher | `GET /api/v2/carriers/:id/executions/:id` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200; IN_PROGRESS | —; PASS |
| dispatcher-complete | c1-dispatcher | `POST /api/v2/carriers/:id/executions/:id/completions` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200; COMPLETED | —; PASS |
| carrier-closed-booking | c1-admin | `GET /api/v2/carriers/:id/bookings/:id` | 200; COMPLETED; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200; COMPLETED | —; PASS |
| C1-admin-metric-native-positive | c1-admin | `POST /api/v2/carriers/:id/metrics` | 201; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 201; ACTIVE | —; PASS |
| C1-consolidation-native-positive | c1-dispatcher | `POST /api/v2/carriers/:id/consolidations` | 201; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 201; OPEN | —; PASS |
| C1-asset-event-native-positive | c1-dispatcher | `POST /api/v2/carriers/:id/assets/:id/events` | 201; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 201; RECORDED | —; PASS |
| c1-operator-metrics-role-negative | c1-operator | `POST /api/v2/carriers/:id/metrics` | 403; FORBIDDEN_CARRIER_ROLE; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_ROLE | C1-admin-metric-native-positive; PASS |
| c1-dispatcher-metrics-role-negative | c1-dispatcher | `POST /api/v2/carriers/:id/metrics` | 403; FORBIDDEN_CARRIER_ROLE; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_ROLE | C1-admin-metric-native-positive; PASS |
| other-carrier-metrics-write-negative | c2-admin | `POST /api/v2/carriers/:id/metrics` | 403; FORBIDDEN_CARRIER_IDENTITY; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_IDENTITY | C1-admin-metric-native-positive; PASS |
| other-carrier-consolidation-write-negative | c2-operator | `POST /api/v2/carriers/:id/consolidations` | 403; FORBIDDEN_CARRIER_IDENTITY; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_IDENTITY | C1-consolidation-native-positive; PASS |
| other-carrier-asset-event-write-negative | c2-operator | `POST /api/v2/carriers/:id/assets/:id/events` | 403; FORBIDDEN_CARRIER_IDENTITY; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_IDENTITY | C1-asset-event-native-positive; PASS |
| C2-admin-metric-native-positive | c2-admin | `POST /api/v2/carriers/:id/metrics` | 201; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 201; ACTIVE | —; PASS |
| C2-consolidation-native-positive | c2-operator | `POST /api/v2/carriers/:id/consolidations` | 201; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 201; OPEN | —; PASS |
| C2-asset-event-native-positive | c2-operator | `POST /api/v2/carriers/:id/assets/:id/events` | 201; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 201; RECORDED | —; PASS |
| c1-admin-metrics-exact-row-positive | c1-admin | `GET /api/v2/carriers/:id/metrics` | 200; exact native ID and own carrier only; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 | —; PASS |
| c1-operator-metrics-exact-row-positive | c1-operator | `GET /api/v2/carriers/:id/metrics` | 200; exact native ID and own carrier only; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 | —; PASS |
| c1-dispatcher-metrics-exact-row-positive | c1-dispatcher | `GET /api/v2/carriers/:id/metrics` | 200; exact native ID and own carrier only; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 | —; PASS |
| c2-admin-metrics-foreign-read-negative | c2-admin | `GET /api/v2/carriers/:id/metrics` | 403; FORBIDDEN_CARRIER_IDENTITY; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_IDENTITY | c1-admin-metrics-exact-row-positive; PASS |
| c2-operator-metrics-foreign-read-negative | c2-operator | `GET /api/v2/carriers/:id/metrics` | 403; FORBIDDEN_CARRIER_IDENTITY; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_IDENTITY | c1-admin-metrics-exact-row-positive; PASS |
| shipper-metrics-foreign-read-negative | shipper | `GET /api/v2/carriers/:id/metrics` | 403; FORBIDDEN_CARRIER_IDENTITY; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_IDENTITY | c1-admin-metrics-exact-row-positive; PASS |
| c1-admin-consolidations-exact-row-positive | c1-admin | `GET /api/v2/carriers/:id/consolidations` | 200; exact native ID and own carrier only; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 | —; PASS |
| c1-operator-consolidations-exact-row-positive | c1-operator | `GET /api/v2/carriers/:id/consolidations` | 200; exact native ID and own carrier only; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 | —; PASS |
| c1-dispatcher-consolidations-exact-row-positive | c1-dispatcher | `GET /api/v2/carriers/:id/consolidations` | 200; exact native ID and own carrier only; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 | —; PASS |
| c2-admin-consolidations-foreign-read-negative | c2-admin | `GET /api/v2/carriers/:id/consolidations` | 403; FORBIDDEN_CARRIER_IDENTITY; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_IDENTITY | c1-admin-consolidations-exact-row-positive; PASS |
| c2-operator-consolidations-foreign-read-negative | c2-operator | `GET /api/v2/carriers/:id/consolidations` | 403; FORBIDDEN_CARRIER_IDENTITY; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_IDENTITY | c1-admin-consolidations-exact-row-positive; PASS |
| shipper-consolidations-foreign-read-negative | shipper | `GET /api/v2/carriers/:id/consolidations` | 403; FORBIDDEN_CARRIER_IDENTITY; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_IDENTITY | c1-admin-consolidations-exact-row-positive; PASS |
| c1-admin-asset-events-exact-row-positive | c1-admin | `GET /api/v2/carriers/:id/assets/:id/events` | 200; exact native ID and own carrier only; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 | —; PASS |
| c1-operator-asset-events-exact-row-positive | c1-operator | `GET /api/v2/carriers/:id/assets/:id/events` | 200; exact native ID and own carrier only; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 | —; PASS |
| c1-dispatcher-asset-events-exact-row-positive | c1-dispatcher | `GET /api/v2/carriers/:id/assets/:id/events` | 200; exact native ID and own carrier only; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 | —; PASS |
| c2-admin-asset-events-foreign-read-negative | c2-admin | `GET /api/v2/carriers/:id/assets/:id/events` | 403; FORBIDDEN_CARRIER_IDENTITY; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_IDENTITY | c1-admin-asset-events-exact-row-positive; PASS |
| c2-operator-asset-events-foreign-read-negative | c2-operator | `GET /api/v2/carriers/:id/assets/:id/events` | 403; FORBIDDEN_CARRIER_IDENTITY; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_IDENTITY | c1-admin-asset-events-exact-row-positive; PASS |
| shipper-asset-events-foreign-read-negative | shipper | `GET /api/v2/carriers/:id/assets/:id/events` | 403; FORBIDDEN_CARRIER_IDENTITY; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_IDENTITY | c1-admin-asset-events-exact-row-positive; PASS |
| dispatcher-offer-role-negative | c1-dispatcher | `POST /api/v2/carriers/:id/opportunities/:id/offers` | 403; FORBIDDEN_CARRIER_ROLE; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_ROLE | fresh-offer; PASS |
| dispatcher-booking-confirm-role-negative | c1-dispatcher | `POST /api/v2/carriers/:id/bookings/:id/confirmations` | 403; FORBIDDEN_CARRIER_ROLE; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_ROLE | carrier-confirm-booking; PASS |
| dispatcher-hold-confirm-role-negative | c1-dispatcher | `POST /api/v2/carriers/:id/capacity/holds/:id/confirmations` | 403; FORBIDDEN_CARRIER_ROLE; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_CARRIER_ROLE | carrier-confirm-capacity; PASS |
| overweight-request | shipper | `POST /api/v2/freight/requests` | 201; HAC40_WORKFLOW_API.md:38,40 | 201; DRAFT | —; PASS |
| overweight-submit | shipper | `POST /api/v2/freight/requests/:id/submissions` | 200; HAC40_WORKFLOW_API.md:38,40 | 200; PENDING | —; PASS |
| overweight-route | shipper | `POST /api/v2/freight/requests/:id/routes` | 201; HAC40_WORKFLOW_API.md:38,40 | 201; ineligible | —; PASS |
| capacity-sufficient-positive | shipper | `GET /api/v2/plans/:id` | 200; TRANSPORT_PLANS_AND_FLEET.md:30,32 | 200; eligible | —; PASS |
| capacity-insufficient-negative | shipper | `POST /api/v2/freight/requests/:id/plans` | 201; ineligible + capacity reason; TRANSPORT_PLANS_AND_FLEET.md:30,32 | 201; ineligible | capacity-sufficient-positive; PASS |
| screen-depots | c1-admin | `GET /api/v2/carriers/:id/depots` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT | —; DEFECT_REPRODUCED; Axel/HAC-41 |
| screen-services | c1-admin | `GET /api/v2/carriers/:id/services` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT | —; DEFECT_REPRODUCED; Axel/HAC-41 |
| screen-areas | c1-admin | `GET /api/v2/carriers/:id/services/:id/areas` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT | —; DEFECT_REPRODUCED; Axel/HAC-41 |
| screen-lanes | c1-admin | `GET /api/v2/carriers/:id/services/:id/lanes` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT | —; DEFECT_REPRODUCED; Axel/HAC-41 |
| screen-partners | c1-admin | `GET /api/v2/carriers/:id/partners` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT | —; DEFECT_REPRODUCED; Axel/HAC-41 |
| screen-limits | c1-admin | `GET /api/v2/carriers/:id/route-limits` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 | —; PASS |
| screen-assets | c1-admin | `GET /api/v2/carriers/:id/assets` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT | —; DEFECT_REPRODUCED; Axel/HAC-41 |
| screen-vehicle-combinations | c1-admin | `GET /api/v2/carriers/:id/vehicle-combinations` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT | —; DEFECT_REPRODUCED; Axel/HAC-41 |
| screen-drivers | c1-admin | `GET /api/v2/carriers/:id/drivers` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT | —; DEFECT_REPRODUCED; Axel/HAC-41 |
| screen-capacity-pools | c1-admin | `GET /api/v2/carriers/:id/capacity-pools` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT | —; DEFECT_REPRODUCED; Axel/HAC-41 |
| screen-calendars | c1-admin | `GET /api/v2/carriers/:id/calendars` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT | —; DEFECT_REPRODUCED; Axel/HAC-41 |
| screen-driver-assignments | c1-admin | `GET /api/v2/carriers/:id/driver-assignments` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9; TRANSPORT_PLANS_AND_FLEET.md:52 | 403; FORBIDDEN_TENANT | —; DEFECT_REPRODUCED; Axel/HAC-41 |
| screen-vehicle-assignments | c1-admin | `GET /api/v2/carriers/:id/vehicle-assignments` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT | —; DEFECT_REPRODUCED; Axel/HAC-41 |
| screen-maintenances | c1-admin | `GET /api/v2/carriers/:id/maintenances` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT | —; DEFECT_REPRODUCED; Axel/HAC-41 |
| screen-repositioning-blocks | c1-admin | `GET /api/v2/carriers/:id/repositioning-blocks` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT | —; DEFECT_REPRODUCED; Axel/HAC-41 |
| screen-asset-capabilities | c1-admin | `GET /api/v2/carriers/:id/asset-capabilities` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT | —; DEFECT_REPRODUCED; Axel/HAC-41 |
| screen-capability-definitions | c1-admin | `GET /api/v2/carriers/:id/capability-definitions` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 403; FORBIDDEN_TENANT | —; DEFECT_REPRODUCED; Axel/HAC-41 |
| screen-opportunities | c1-admin | `GET /api/v2/carriers/:id/opportunities` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 | —; PASS |
| screen-offers | c1-admin | `GET /api/v2/carriers/:id/offers` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 | —; PASS |
| screen-metrics | c1-admin | `GET /api/v2/carriers/:id/metrics` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 | —; PASS |
| screen-bookings | c1-admin | `GET /api/v2/carriers/:id/bookings` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 | —; PASS |
| screen-holds | c1-admin | `GET /api/v2/carriers/:id/capacity/holds` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 | —; PASS |
| screen-executions | c1-admin | `GET /api/v2/carriers/:id/executions` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 | —; PASS |
| screen-incidents | c1-admin | `GET /api/v2/carriers/:id/executions/:id/incidents` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 | —; PASS |
| screen-execution-events | c1-admin | `GET /api/v2/carriers/:id/executions/:id/events` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 | —; PASS |
| screen-incident-updates | c1-admin | `GET /api/v2/carriers/:id/incidents/:id/updates` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 | —; PASS |
| screen-consolidations | c1-admin | `GET /api/v2/carriers/:id/consolidations` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 | —; PASS |
| screen-asset-events | c1-admin | `GET /api/v2/carriers/:id/assets/:id/events` | 200; IDENTITY_AND_MCP_CHANNELS.md:10,14; HAC40_WORKFLOW_API.md:9 | 200 | —; PASS |

## Portal resource collection coverage

| Resource | Family | HTTP | Rows | Classification |
|---|---|---:|---:|---|
| depots | catalog | 403 | unknown | DEFECT_REPRODUCED |
| services | catalog | 403 | unknown | DEFECT_REPRODUCED |
| areas | catalog | 403 | unknown | DEFECT_REPRODUCED |
| lanes | catalog | 403 | unknown | DEFECT_REPRODUCED |
| partners | catalog | 403 | unknown | DEFECT_REPRODUCED |
| limits | workflow | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| assets | catalog | 403 | unknown | DEFECT_REPRODUCED |
| vehicle-combinations | catalog | 403 | unknown | DEFECT_REPRODUCED |
| drivers | catalog | 403 | unknown | DEFECT_REPRODUCED |
| capacity-pools | catalog | 403 | unknown | DEFECT_REPRODUCED |
| calendars | catalog | 403 | unknown | DEFECT_REPRODUCED |
| driver-assignments | catalog | 403 | unknown | DEFECT_REPRODUCED |
| vehicle-assignments | catalog | 403 | unknown | DEFECT_REPRODUCED |
| maintenances | catalog | 403 | unknown | DEFECT_REPRODUCED |
| repositioning-blocks | catalog | 403 | unknown | DEFECT_REPRODUCED |
| asset-capabilities | catalog | 403 | unknown | DEFECT_REPRODUCED |
| capability-definitions | catalog | 403 | unknown | DEFECT_REPRODUCED |
| opportunities | workflow | 200 | 2 | FUNCTIONAL_DATA_OBSERVED |
| offers | workflow | 200 | 2 | FUNCTIONAL_DATA_OBSERVED |
| metrics | workflow | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| bookings | workflow | 200 | 2 | FUNCTIONAL_DATA_OBSERVED |
| holds | workflow | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| executions | workflow | 200 | 2 | FUNCTIONAL_DATA_OBSERVED |
| incidents | workflow | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| execution-events | workflow | 200 | 2 | FUNCTIONAL_DATA_OBSERVED |
| incident-updates | workflow | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| consolidations | workflow | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |
| asset-events | workflow | 200 | 1 | FUNCTIONAL_DATA_OBSERVED |

## CP-1b evidence result

Both final `cp1b-final` cycles: 102/127 HTTP PASS, 25/127 known FORBIDDEN_TENANT failures, 30/30 paired negatives PASS, 2/2 real authenticated RLS controls (own=1, foreign=0), and one COMPLETED booking per cycle. Cleanup: 54/54 and 54/54 zero counts, 53 affected ordinary triggers restored and 1234 captured trigger states compared. Native metric/consolidation/asset-event counts are 2/2/2 globally, one per carrier. Functional exit 1 preserves the known defect; no new failure was observed.

Unchanged V2 gate command: `python scripts/qa/carrier_portal.py pgtap`; actual output `Files=27, Tests=988,  7 wallclock secs ( 0.21 usr  0.07 sys +  0.20 cusr  0.30 csys =  0.78 CPU)` and `Result: PASS`, exit 0. All suites come from `supabase-v2/test-profiles.json` with the unchanged `v2-road-baseline` prerequisite. The assertion count is observed evidence, not a fixed gate requirement.

External evidence: `hac44-carrier-portal-cp1b-evidence`, including immutable cycle snapshots, exact commands/exits, inventories, backups and source hashes. CP-1 history remains in `hac44-carrier-portal-evidence/CP-1.md`. CP-2 is authorized only because both cycles have no failures beyond HAC-41. No hosted database operations, product/migration/CI changes, existing scenario changes, merge, direct main push, force-push, rebase or issue completion are part of this delivery.
