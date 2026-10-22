# Product and supported journeys

CargoMesh coordinates customers and carriers around structured freight requests. It keeps discovery, proposals, commercial offers, selection, booking and execution separate.

## Customer workspace

Enter `/clients`. The customer can consult organization/facility data, describe a shipment, correct measurements or route details, review a structured draft, and explicitly create/submit it through the authorized workflow. Commercial screens expose known offers, decisions, bookings and tracking information subject to the current identity and record state.

The conversational interface supports text, browser speech fallback and optional Nova bidirectional audio. Recognized details remain provisional until validated. Questions can be answered without forcing the user into a form. Review/confirmation is required for business changes; asking a question or finishing a sentence is not consent.

## Carrier workspace

Enter `/carriers`. The connected dashboard reads commercial records, shows confirmed contracted amounts by currency, pending work and booking trends. Contracted amount is not cash collected. Estimated margin appears only for ADMIN with matching complete native cost data; unknown costs do not become zero profit.

Opportunities lead to scoped request details and Nova briefings. Offer preparation, quote policies (`/carriers/offers/automation`), orders, fleet, drivers, sites and control tower use their corresponding services and permissions. ADMIN policy editing does not bypass price evidence, consent, versions or idempotency. Fleet navigation does not itself create an assignment.

## Logistics semantics

- Eligibility uses persisted coverage, directed lanes, equipment, capacity/window and cargo requirements. A facility is not coverage.
- Offers identify their source, price evidence, currency and validity. Ranking explains a versioned policy over known alternatives.
- Commercial/destructive actions prepare a specific proposal and require confirmation; current authorization and state are rechecked.
- ROAD is the implemented operational validation path. Other modeled modes are not a claim of working adapters.
- Maps distinguish provider geometry from presentation. Animated vehicles and fixture movement are not live GPS.
- Synthetic scenarios demonstrate behavior; they do not represent operating carriers or guaranteed availability.

See [domain contracts](v2-amazon/contracts/README.md), [architecture](ARCHITECTURE.md) and [current status](STATUS.md).
