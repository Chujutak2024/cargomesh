# HAC-44 local full-flow scenario

This synthetic V2 scenario covers B1–B6: tenants A/B and an inactive member; USD organizations and complete depots; catalog/preferences; native fleet, crew and capacity; routing/plans; opportunity/offer/ranking/decision; booking/reservation/execution/incident; and a separate LTL service/consolidation. `complete-seed.sql` supplies an independent completed operation through authenticated native RPCs. Additional HTTP fixtures are created through the actual Hono API.

The stable bootstrap namespace is `d4400000`–`d44f0000` (see `manifest.json` and literal IDs in `seed.sql`/`ltl-seed.sql`). It is separate from road-baseline `c23…` and CP-1 `a44…`. A collision aborts the seed. Native writers generate their own UUIDs; overriding those IDs would require changing product writers. Their exact IDs are captured in `hac44_qa.ids` and the external registry, rather than being inferred from names or a UUID prefix.

Auth contains three synthetic local users labeled `LOCAL_ONLY_AUTH_PLACEHOLDER`, without password credentials, identities, sessions or persisted JWTs. Local test JWTs are signed in memory using the dedicated CLI stack and passed only to the child process. No real authentication credential is written to disk.

## Execute

Use Python 3.11+, Node satisfying the project engine, supplied lockfile-matching dependencies, Docker and Supabase CLI 2.117.0. Follow [the QA runner](../../../scripts/qa/hac44/README.md) to build the dedicated stack and set `HAC44_EVIDENCE` outside the repository.

```powershell
python scripts/qa/hac44/lifecycle.py seed
python scripts/qa/hac44/lifecycle.py verify
python scripts/qa/hac44/lifecycle.py cleanup
```

The lifecycle wrapper expands local `\ir` includes, runs `psql -v local_only=1` only in `supabase_db_hac44-full-flow-v2`, and stores logs/backups externally. To use psql directly, use the dedicated local socket and `-v ON_ERROR_STOP=1 -v local_only=1 -f <scenario>/seed.sql`; paths must exist in the psql filesystem. `cleanup.sql` also requires `-v backup_confirmed=1` after creating the backups described below.

`counts.sql` reports only registered scenario rows plus the three exact Auth IDs, including writer-generated rows. A completed `hac44_qa` run/ID/baseline registry remains as local audit metadata; zero dataset counts do not mean deleting audit history.

## Writers and cleanup

Bootstrap tenant/member/facility/carrier/service/network anchors, catalog grants, the synthetic CarrierOperator/MCP link and the LTL service clone use literal local inserts because the public writers need an established tenant/carrier/network context or do not expose those identity fields. Fleet, crew, request lifecycle, routing, offer/decision and operational entities use native writers. Seed does not suspend domain guards.

Before deleting, `cleanup.sql` captures every newly inserted exact PK, prints every incoming FK (including implicit `ON DELETE CASCADE` and all `auth.users` children), and requires a backup. The wrapper backs up public/private/QA rows and an allowlisted, credential-free Auth placeholder record. Each parent waits until every actual child has been removed by its exact key; an external child or FK cycle aborts the transaction. No `DELETE ... CASCADE`, name-based deletion or prefix-based deletion is used. Auth identities/sessions would abort cleanup and require explicit IDs/backups.

Teardown disables only noninternal triggers on affected tables inside the local transaction, deletes exact registered rows, restores each original O/A/R/D trigger state, and compares all original public/private rows with the captured baseline. FK/CHECK constraints remain active. The following table-by-table allowance applies only to exact teardown and rollback-only physical FK fixtures, never to functional HTTP/RPC positives.

| Table | Reason | Noninternal triggers |
|---|---|---|
| `public.asset_cargo_capabilities` | Native fleet facts and capability references; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `v2_fleet_command_guard` |
| `public.asset_status_events` | Native fleet facts and capability references; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `workflow_guard` |
| `public.capacity_calendars` | Native capacity sources, reservations and LTL lifecycle facts; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `a_crew_calendar_guard`, `v2_fleet_command_guard` |
| `public.capacity_consolidations` | Native capacity sources, reservations and LTL lifecycle facts; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `workflow_guard` |
| `public.capacity_pools` | Native capacity sources, reservations and LTL lifecycle facts; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `v2_fleet_command_guard` |
| `public.capacity_reservations` | Native capacity sources, reservations and LTL lifecycle facts; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `a_crew_reservation_guard`, `v2_fleet_reservation_guard`, `z_workflow_reservation_sharing` |
| `public.cargo_capability_definitions` | Published guide/profile/capability facts; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `v2_fleet_command_guard` |
| `public.cargo_categories` | Published guide/profile/capability facts; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `v2_catalog_command_guard` |
| `public.carrier_depots` | Published catalog facts and native commercial references; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `v2_catalog_command_guard` |
| `public.carrier_opportunities` | Published catalog facts and native commercial references; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `workflow_guard` |
| `public.carrier_service_cargo_categories` | Published catalog facts and native commercial references; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `v2_catalog_link_guard` |
| `public.carrier_services` | Published catalog facts and native commercial references; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `a_crew_service_guard`, `v2_catalog_command_guard`, `v2_service_fleet_mode_guard` |
| `public.carriers` | Published catalog facts and native commercial references; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `v2_catalog_command_guard`, `z_workflow_carrier_status_guard` |
| `public.driver_assignments` | Native crew facts and assignment references; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `a_driver_occupancy`, `crew_command_guard` |
| `public.drivers` | Native crew facts and assignment references; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `crew_command_guard` |
| `public.execution_events` | Append-only execution audit facts; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `workflow_guard` |
| `public.facilities` | Native tenant-owned facility facts; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `protect_v2_facility_command` |
| `public.freight_requests` | Native request lifecycle/snapshot facts; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `guard_freight_creation_receipt`, `protect_v2_draft_insert`, `protect_v2_draft_update`, `verify_v2_receipt_hash` |
| `public.fulfilment_partners` | Published partner facts; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `v2_catalog_command_guard` |
| `public.incident_updates` | Append-only native incident audit facts; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `workflow_guard` |
| `public.logistics_nodes` | Published routing-node facts; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `workflow_guard` |
| `public.operational_incidents` | Native incident facts; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `workflow_guard` |
| `public.organization_cargo_profiles` | Native tenant/preferences/profile facts; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `v2_catalog_command_guard` |
| `public.organization_preferences` | Native tenant/preferences/profile facts; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `v2_catalog_command_guard` |
| `public.organizations` | Native tenant/preferences/profile facts; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `v2_organization_command_guard` |
| `public.repositioning_blocks` | Native availability evidence; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `a_crew_repositioning_guard`, `v2_fleet_command_guard` |
| `public.route_conditions` | Native route snapshots, published routing facts and dependent references; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `workflow_guard` |
| `public.route_corridors` | Native route snapshots, published routing facts and dependent references; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `workflow_guard` |
| `public.route_planning_policies` | Native route snapshots, published routing facts and dependent references; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `workflow_guard` |
| `public.route_plans` | Native route snapshots, published routing facts and dependent references; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `workflow_guard` |
| `public.route_resource_limits` | Native route snapshots, published routing facts and dependent references; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `workflow_guard` |
| `public.scheduled_maintenances` | Native maintenance evidence; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `a_crew_maintenance_guard`, `v2_fleet_command_guard` |
| `public.scoring_policies` | Published scoring-policy facts; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `workflow_guard` |
| `public.selection_decisions` | Native decision/audit facts; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `workflow_guard` |
| `public.service_areas` | Directed service network facts; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `guard_v2_road_area_before_update`, `v2_catalog_command_guard` |
| `public.service_lanes` | Directed service network facts; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `v2_catalog_command_guard`, `validate_v2_road_lane_before_write` |
| `public.transport_assets` | Native asset, plan and execution facts; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `a_crew_asset_guard`, `v2_fleet_command_guard` |
| `public.transport_executions` | Native asset, plan and execution facts; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `crew_execution_scope` |
| `public.transport_plan_candidates` | Native asset, plan and execution facts; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `workflow_guard` |
| `public.v2_bookings` | Native commercial facts and audit snapshots; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `workflow_guard` |
| `public.v2_carrier_metrics` | Native commercial facts and audit snapshots; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `workflow_guard` |
| `public.v2_carrier_offers` | Native commercial facts and audit snapshots; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `workflow_guard` |
| `public.v2_rankings` | Native commercial facts and audit snapshots; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `workflow_guard` |
| `public.vehicle_assignments` | Native vehicle/combination assignment references; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `crew_command_guard` |
| `public.vehicle_combination_assets` | Native vehicle/combination assignment references; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `combination_members_nonempty`, `crew_member_guard` |
| `public.vehicle_combinations` | Native vehicle/combination assignment references; exact QA teardown/physical FK isolation must bypass the native-only writer and computed metadata triggers. | `combination_nonempty`, `crew_command_guard` |

The physical FK runner first establishes the existing-reference control with all FK checks immediate. Only during the orphan probe, overlapping/incoming FK checks are deferred to prevent a different FK from masking the target constraint. The target must raise `23503` with its exact constraint name. A subtransaction rolls back every row, trigger and deferrability change before pgTAP records the result; the outer transaction also rolls back. CHECK failures or missing controls remain red/blocked. This proves physical referential integrity, not the whole UML cardinality or public writer semantics.

## Limits

Local and simulated only. No hosted Supabase, live integration, external messaging or deployment is part of this scenario. It does not modify `v2-road-baseline`, applied migrations, product code or the native profiles/gate/CI. Canonical identity/integration gaps and known contract counterexamples are reported to their owners; fixtures do not change the product contract.
