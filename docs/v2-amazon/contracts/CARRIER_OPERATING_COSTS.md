# Carrier operating costs and cost-plus quotations

## Authority and separation

Carrier chooses and approves versioned `operatingCosts`. `COST_PLUS` is an additional calculation mode; PER_TRIP/PER_KM remain supported. No mode authorizes a booking without the independent scheduling consent and Client selection/authorization. No defaults or pricing data are activated by the migration.

Eligibility is computed before price: coverage, direction, equipment, physical capacity, date and route limits remain hard restrictions. This cost calculator applies to every supported route having sufficient evidence; it does not provide a new global routing/discovery adapter. Current automatic dispatch remains direct ROAD/FTL with an unambiguous service/resource corridor. Cost option reads require an explicit limit for that service and corridor.

## Inputs and formula

`CarrierOperatingCostsSchema` defines fuel L/100 km, fuel USD/L, driver USD/hour, vehicle USD/km, fixed cost per carrying resource, shared handling cost, markup on cost, tax, continuous/duty-period driving limits, pause and daily-rest durations, and whether rest is paid. Four decimal places for unit rates; cents for fixed costs. Without a fleet profile, an explicitly approved legacy policy applies common service rates. With `fleet: TRUCK_PROFILES_V1`, every selected truck requires an explicit asset-to-profile binding. Type/model profiles define consumption, driver hourly cost, wear per kilometre, fixed vehicle cost and maximum speed. Individual overrides replace only the specified values. Equipment must agree with the persisted active asset, Carrier and service; cargo size labels never infer these rates. Actual driver fitness and legal permissions are not inferred from these commercial parameters.

`operatingProfile` is an optional, versioned corridor input: effective driving seconds, tolls, ordered stops referenced to actual REST waypoints, cumulative driving offsets, rest duration and facility fees, and source/validity/provenance. Stopping at the destination does not count as an en-route break. Unknown, expired or insufficient evidence produces review. Pauses reset the continuous-driving counter only when sufficiently long; daily rest resets both applicable counters. Durations are estimates, not statutory compliance findings.

Fuel = distance * L/100 km / 100 * USD/L * carrying resources.
Driver = paid seconds / 3600 * USD/hour * resources. Paid seconds include driving, loading/unloading and waiting; declared rest is included only if approved as paid. All declared rest still increases elapsed travel and capacity occupancy.
Vehicle = distance * USD/km * resources.
Operating cost = fuel + driver + vehicle + fixed per vehicle + tolls and rest facilities per vehicle + handling once per shipment.
Price before tax = max(minimum plan amount, operating cost + Carrier markup on cost).
Tax is calculated on that subtotal. Each monetary component is rounded once to cents and then summed. No duplication of fixed fuel/handling/tax fields is allowed with COST_PLUS.

Native dispatch uses the maximum of published route duration, lane transit and effective driving plus declared rest. Final pricing includes the real proposed operation window; a missing schedule cannot price a flexible envelope. The SQL function and TypeScript calculator share the same numeric contract. Rates and route evidence must be valid at quotation and through the operation where required.

## Persistence and visibility

`private.quote_issued_offers.calculation_snapshot` retains the calculation, source route inputs and formula version alongside the existing policy snapshot. No direct authenticated/anonymous table grants. A new Carrier ADMIN reader verifies the actual operator, current authority and offer ownership. Client receives the commercial offer total and components; internal wages, cost rates and markup stay private. Native commercial actions, optimistic versions, idempotency, quote provenance and audit remain enforced.

## Limits and activation

Single rested driver per vehicle is a planning assumption, not proof of legal crew availability; existing execution/crew checks still apply. The profile validates published stops rather than inventing rest locations or optimizing a full road network. Empty return/repositioning fuel, multi-driver crews, refrigeration/idle fuel and currency conversion are not independently modeled. Where needed, these require an explicit extension or manual quotation; no claim that all operating expenses are represented.

Local additive migration: `20261021175507_carrier_operating_costs.sql`. No hosted application authorized by preparing the proposal. Rollout requires existing dispatch migrations, approved cost inputs, sufficient corridor profile, native Carrier approval and ScoringPolicy activation. Synthetic values belong to scenarios; tests roll back and are not product seeds.

Evidence: focused domain tests and `45_v2_operating_costs.test.sql` with TypeScript/SQL cents parity, native two-truck offer, inadequate/missing rest rejection and private calculation access. No new visual, real audio or hosted commercial end-to-end claim.

## Truck profiles and deterministic search (21 October extension)

Carrier ADMIN creates named type/model profiles and assigns existing fleet assets in the automatic quotation policy. The form uses registered equipment types and truck identities. A profile is not automatically assigned to every truck of that type. Missing assignments, wrong equipment, inactive or foreign assets require review. When profiles are enabled, unused common per-truck rates are stored as zero and hidden by the editor; they cannot price a truck with a missing binding. shipment handling, fuel price, driver/rest rules, markup, tax and minimum are common commercial rules.

For a heterogeneous plan, calculate each selected truck separately and round each component to cents. Sum truck operating components, add shipment handling once, apply markup once, apply the minimum once, and then tax once. Persist asset identity/code, selected profile, consumption, individual operating cost and effective speed cap in the private immutable calculation snapshot. Only Carrier ADMIN can read policies or these internal costs. Client comparison receives a correlated total, never wages or margin.

`BOUNDED_ASSET_SUBSETS_V1` enumerates asset subsets up to the approved resource count (maximum eight), feeding each subset through the existing whole-package feasibility and event-window planner. It considers at most 128 subsets/proposals per service search and preserves all supported services. Exceeding a bound returns a stable review outcome instead of claiming a cheapest partial search. The application asks `preview_v2_dispatch_costs` for read-only native totals and selects price then arrival for SCHEDULED; arrival then price for URGENT, with deterministic tie breakers. Search intent is persisted through the existing idempotent command. Final issuance and booking revalidate the native rules and permissions.

This is bounded enumeration over constructed direct-FTL plans, not a new metaheuristic, a full time-dependent road-network optimizer, nor proof of global optimality across every departure instant. The event planner supplies the earliest feasible schedule for each evaluated subset and corridor; a later unenumerated departure might change waiting cost. Existing continuous/daily driving rules validate published rest stops rather than discovering new ones. Larger fleet/VRP optimization remains an explicit adapter extension; it must return evidence, bounds and native revalidation.

## Exact locations and speed

For a fleet-profile tariff, `operatingProfile.endpoints` must contain pickup and delivery coordinates matching the canonical authorized request. Same city, same facility label or a city-centre route is insufficient. Missing coordinates or unmatched endpoints require `EXACT_COST_ROUTE_REQUIRED`/review. The backend never substitutes approximate city coordinates. Existing Carrier point-to-point Google adapter resolves saved depots, addresses or coordinates, checks coverage and correlates endpoints within 200 m; it remains a planning estimate with unverified truck access. This change does **not** automatically publish its geometry as an authorized corridor or fetch a fresh Google route during every quote. A usable exact corridor, distance/driving evidence and per-resource physical limits must be published through the existing authorized workflow before automatic quotation.

A truck speed cap checks `drivingSeconds >= ceil(distanceKm / maxSpeedKph * 3600)`. It does not divide by maximum speed to promise an ETA, accelerate provider duration, infer traffic, change consumption with an invented speed curve or invent rest locations. Inconsistent travel time produces `TRUCK_DRIVING_TIME_INCONSISTENT` and requires a corrected evidenced route plan. Transit still takes the maximum of published corridor duration, service lane time and driving plus rests; loading, waiting and unloading occupy the operation window and are priced. Different per-truck route timing, automatic repositioning/empty-return costs and dynamic speed-dependent fuel curves remain outside this formula.

## Focused verification and activation boundary

The critical test cases cover two different truck profiles, asset override precedence, exact cents, one shared handling charge, speed inconsistency, foreign/wrong/duplicate assets, exact endpoints, private preview, stale versions, actual native offer issuance and idempotent retry. SQL fixtures run in a temporary local database and roll back; they do not activate product seeds. Types and architecture checks supplement these cases. Human visual validation remains with the user.

The extension shares the still-unapplied local migration `20261021175507_carrier_operating_costs.sql`. No hosted migration, tariff approval, ranking-policy publication, synthetic dataset activation or production deploy is implied by preparing this implementation. Existing live tariff records remain unchanged.


## Single-request plans versus multi-request consolidation — 21 October

The accepted case matrix separates one request allocated to alternative truck combinations from several requests sharing one physical operation. The current bounded subset search implements the first problem only. It keeps actual assets within the evaluated Carrier/service, indivisible pieces whole, and Carrier private cost separate from the shipper's final attributable offer. N1/N2/N3 must never substitute for payload, equipment, cost profiles or commercial load-size bands.

The executable synthetic matrix and remaining gaps are recorded in [the implementation evidence](../delivery/CARRIER_OPTIMIZATION_MATRIX_2026_10_21.md). The matrix uses at most two trucks per plan; production policy remains configurable up to the existing maximum. No PEN commercial quotation is emitted and no synthetic tariff is activated by running it.

Current physical validation checks individual upright dimensions and aggregate weight/volume; it is not a full geometric packing, loading-door or axle-load solver. Per-vehicle corridor admission, mandatory empty-return/repositioning costs and full hosted C-01 certification remain explicit gaps. Calendar feasibility alone does not prove assigned driver readiness. Multi-request consolidation requires its own physical execution aggregate, customer consent, cost/revenue allocation and protection against double capacity reservations; it is not implemented by this change.


## Explicit resource/corridor admission — local A-12 implementation

Existing `limits.publish` accepts optional `admission: {decision, reasonCode}` on the versioned route/resource limit. Persisted decisions are ALLOWED, DENIED or UNKNOWN; EXPIRED is derived from evidence validity for the complete operation. Legacy compatibility true is allowed only with sufficient current evidence; false is unknown, not an invented prohibition. Explicit decisions must agree with the compatibility flag. No new permission table or legal weight-class inference is introduced.

The application reads `read_v2_dispatch_options_with_admission`, preserving the previous RPC response. Generation, native preview, offer eligibility and booking confirmation enforce the same current admission. Publication keeps ADMIN authority, idempotency and expected-version conflicts. An anonymous or unscoped caller receives no new direct helper privileges. The preview validates its existing policy/request scope before returning admission; public plan snapshot shapes are preserved during rollout.

Local evidence and remaining gates are in [A-12 and C-01 implementation](../delivery/RESOURCE_ROUTE_ADMISSION_2026_10_21.md). This supersedes the earlier statement that admission was entirely missing: it is now implemented locally, with publication still pending. Full geometric packing and the final hosted dataset remain outside that evidence. New additive DDL `20261021203000_resource_route_admission.sql` depends on the still-unapplied cost migration. No hosted activation is implied.
