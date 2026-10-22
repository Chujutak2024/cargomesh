# Client and Carrier closeout — 22 October 2026

## Scope

F-01/F-02/F-03/F-04/O-06 presentation and authorized read corrections. Checked remote main and recent PRs before implementation: Axel PR147/149 already merged; no new Client correction PR was published by Luis at that check. No Linear changes or visual review were performed, as requested by the project owner.

## Client

- Request detail derives its visible commercial phase from scoped, active bookings and executions. It preserves the technical request status and all historical offers.
- Expiry of a quote for new bookings does not invalidate a confirmed contract. Contracted offer details retain original validity, now labeled for new bookings. Existing multi-offer decisions can still authorize their remaining complementary bookings.
- New quote and opportunity prompts are hidden while an active booking exists. The cancelled attempt remains in history.
- Shared Client date formatting uses America/Lima with an explicit PET (UTC−05:00) suffix. Stored instants do not change.
- Tracking preparation reads an organization-scoped aggregate of confirmed vehicle assignments against their exact capacity reservations, plus primary drivers covering the execution window. It exposes counts, not driver identities, fleet rosters or private pricing.
- “Resources assigned” does not confirm operational clearance, physical pickup or departure. Missing or failed reads remain unverified. Pool-based or absent resource references remain unknown.

The additive read-only RPC is introduced by `20261022100000_client_execution_preparation.sql`. It grants authenticated execution only, checks the active organization member, and returns 404 for an execution outside that organization. It does not modify assignments or bookings.

## Carrier

- Fleet KPIs wait for a selected service and loaded records. Selection, loading, errors and empty catalogs stay distinct; the existing corrected selection message is reused.
- Vehicle assignment cards show their recorded capacity reservation reference and loaded reservation status. Unloaded references remain explicit. Driver-to-truck pairing is not inferred.

## Validation and limits

Focused state/tenant/date/tracking contracts and an isolated C01 run cover the semantic corrections. The latter returns two exact vehicle assignments and two primary drivers with operational clearance NOT_EVALUATED; execution stays PLANNED. SQL access tests check authenticated, anonymous, service-role and missing-identity boundaries. CI runs the repository's release/bootstrap gates against the delivered SHA.

No synthetic seeds, tariffs, C01 mutations or transport events are introduced by this closeout. The owner performs frontend visual acceptance. Maps remains Ramón's independent work; AWS remains Axel's.
