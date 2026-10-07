# Product scope and domain contract — CargoMesh V2

## Problem, users, and value

Logistics teams need feasible freight options without comparing a fixed directory of carriers, modes, facilities, capacities, and incompatible restrictions by hand. A shipper requester describes the shipment and retains the final decision. An operations supervisor manages policy, exceptions, and booking authorization. A carrier operator maintains published services, coverage, capacity, and offers. An auditor or judge must be able to reproduce recommendations and distinguish facts from estimates.

CargoMesh V2 normalizes a freight request, finds `0..N` eligible published services, builds transport plans for the requested date, seeks attributable commercial offers, ranks comparable eligible offers under a versioned policy, and audits selection and booking. It is a new product line, not the WebMCP V1 demo with a different interface.

## Request and cargo

A `FreightRequest` belongs to a shipper organization and includes origin and destination (a registered facility or a free location), pickup/delivery window, acceptable modes, optional budget, status, and a draft version. Origin facility and destination facility are **two independent optional roles**; if selected, each must belong to the request's organization. Its cargo specification describes units (for example pallets, boxes, containers, or bulk), count, packaging, weight and dimensions per unit, volume, divisibility, temperature, fragility, hazardous properties, oversize conditions, and other special handling. These are operational constraints, not decorative labels. A historical shipment may prefill the same organization's request, but current capacity, price, permits, and coverage must be checked again.

Retried creation uses an idempotency key and a SHA-256 hash of a canonical payload. Reusing the key with identical content returns the existing result; different content yields a stable conflict. A mutation supplies `expected_draft_version`, and the server increments the version atomically. Authorization and tenant isolation are required at every boundary.

## Physical network versus commercial coverage

`Facility` is a shipper site or operational point. `CarrierDepot` is a carrier-owned base or yard. `LogisticsNode` can be a shared terminal, port, or border crossing. A depot is **not** evidence that the carrier serves its entire province or country, and the absence of a depot does not rule out service through a documented partner.

A `Carrier` publishes one or more `CarrierService` records. Each service describes its mode, service class, accepted cargo and limits, operating state, integration type, and evidence. It declares pickup and delivery `ServiceArea` records and directed `ServiceLane` records, with inclusion/exclusion, granularity, source, and validity. An A→B lane does not imply B→A. A specific exclusion overrides a broad inclusion. A local within-area service must be explicit. A partner serving an area must be identified and current; proximity alone is not proof.

For a given request and date, serviceability requires a sufficiently precise origin/destination, compatible pickup and delivery areas and lane or explicit multi-leg plan, cargo and mode fit, required documents and nodes, and compatible carrying/auxiliary capacity throughout the window. Existing bookings, maintenance, travel, and repositioning reduce availability. Missing coverage or capacity is `unknown`, not eligible by default; a current negative fact is `ineligible`. When no candidate qualifies, return reasons and a later window only if a reliable calendar supports it. Discovery never fabricates an offer or reservation.

## Modes, equipment, fleet, and plans

`TransportMode` identifies ROAD, RAIL, SEA, or AIR per leg. `EquipmentType` identifies the carrying or supporting equipment, such as a rigid truck, tractor, trailer, refrigerated body, container, or escort. `TransportAsset` is a known physical unit owned, contracted, or authorized through a partner; a `CapacityPool` is contracted space when no individual ship/train/aircraft asset is known. Do not invent an asset identity merely because a mode exists. `VehicleCombination` groups units operating together, such as tractor plus trailer, without double-counting carrying capacity.

A `TransportPlanCandidate` combines a request, one or more compatible services and route legs, a date/window, and the carrying and auxiliary resources required on each leg. Two trucks splitting a divisible load, tractor plus trailer, and an escort are different configurations. An escort adds no carrying capacity. An indivisible item is never split across vehicles. All legs and resources must pass weight, volume, dimensions, temperature, coverage, reservation, maintenance, and repositioning checks for the same window. Effective ROAD payload is bounded by the most restrictive verified manufacturer, configuration, route/jurisdiction, and service limit; no universal legal limit is hardcoded. Missing critical limits require review, not a confirmed eligible result.

`TransportPlan` is the general term used in prose; `TransportPlanCandidate` is the single proposed concrete plan aggregate in the design. Selection retains that candidate's identity and snapshot rather than creating a second, potentially divergent, final-plan record.

The initial executable slice may focus on ROAD and one-versus-two-vehicle alternatives. RAIL, SEA, AIR, and multimodal plans remain taxonomy or target capability until adapters, data, tests, and runnable evidence exist.

## Discovery, offers, ranking, and booking

The canonical flow is: resolve locations and route requirements; build supported route and resource alternatives; apply hard filters; record exclusions and uncertainty; invite eligible carriers; obtain offers; normalize comparable offers; rank under a persisted, versioned `ScoringPolicy` or explicit objective; let the shipper select; authorize booking; record execution and audit evidence.

The search considers every service in the supported V2 dataset. It does not silently preselect three carriers, apply an opaque radius, or claim a market-wide optimum. An exact shortest-path method can serve a single nonnegative objective; cost/time tradeoffs retain non-dominated alternatives before applying the chosen policy. “Best” means best among **known eligible plans and attributable offers** under that policy.

`CarrierOpportunity` is an invitation, not a price. `CarrierOffer` belongs to an issuing carrier/service, a request, and an accepted plan or legs. It records source, validity, currency, transit, reservable capacity, conditions, and a cost breakdown. Fuel, tolls, handling, special equipment, border/agent fees, taxes, and discounts each state whether included, quoted, estimated, excluded, or unknown; avoid double-counting. A CargoMesh estimate is not a carrier offer. A multi-carrier plan does not become a unified contractual quote without an explicit agreement. Carrier discounts need the carrier's policy or consent; CargoMesh can discount only its own fee independently.

The offer's request, candidate, issuing carrier, covered services, and leg assignments must agree with its opportunity and the plan; repeated identifiers are checked references, not independent sources of truth. Currency is held by the `Money` value, not a second mutable field. The first V2 demonstration accepts and compares **USD offers only**; it does not convert legacy PEN amounts.

Hard filters (including cargo mass) run before ranking. The scoring policy defines objective, weights where relevant, normalization, tie breaks, and missing-data treatment. Show why each alternative scored as it did. Delivery success, punctuality, and verified reviews need an observation period and sample size; missing ratings are neither zero nor five stars. Historical recommendations remain organization-scoped and are revalidated. Plans with unresolved hard requirements appear separately as conditional, not mixed into confirmed options. The shipper's final choice and booking authorization are audited.

`SelectionDecision` records the chosen candidate, attributable offer(s), authorizing organization member, policy version, and evidence. The executable ROAD slice selects exactly **one** offer. The class diagram allows `1..*` only as a future multi-responsibility design: each issuing carrier would need its own booking and capacity commitment, never an invented unified quote. A `Booking` separates shipper authorization from carrier confirmation; technical adapter attempts and correlation IDs remain in the application/integration layer. A confirmed carrying resource requires a linked, valid internal `CapacityReservation` or verifiable external carrier commitment. A booking record alone does not prove that capacity was held; holds, release, overlap prevention, and retries require dedicated tests.

## Borders, permits, and uncertainty

Route distance, ETA, deadhead, tolls, and border handling may be estimated with a source and confidence level. A technically suitable truck is not automatically authorized for an oversize route or international crossing. The system distinguishes required documents, operator/vehicle eligibility, border post, customs regime, and verified authorization. Customs duties are not freight or agent fees. Unknown material costs prevent a “confirmed total cost” claim and should not be silently ranked as comparable.

## MVP acceptance boundary

A useful MVP demonstrates at least two routes, more than one supported mode **or** transport strategy, V2 data-driven carriers, and a real eligibility change caused by cargo, equipment, capacity, or date. A ROAD one-truck versus two-truck strategy can satisfy the second-strategy objective when both alternatives have traceable data and offers. No exact carrier count is contractual. The target architecture must not be confused with this implemented slice.
