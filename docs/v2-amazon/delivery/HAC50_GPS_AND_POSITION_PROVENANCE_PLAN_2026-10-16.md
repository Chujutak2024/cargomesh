# Vehicle tracking and GPS — future integration plan

Requested by Cristhian, 2026-10-16. Status: researched and documented; **not implemented or live**. Vehicle tracking was outside the original HAC-50 implementation. This plan adds it to the future backlog, independently of the border-review backend.

## Is the proposal realistic?

Yes. A Carrier organization can connect its vehicles through a telematics provider/API, vehicle tracker, or an explicitly authorized driver application. The tracked identity is a vehicle/device/trip, not one position for the entire Carrier. Google Maps renders the information and Google Routes calculates road alternatives; neither supplies the live position of CargoMesh vehicles by itself.

Two failures must be distinguished:

- **Positioning failure:** buildings, bridges, trees and other conditions can block or degrade satellite positioning. GPS reception quality varies; a coordinate needs time and accuracy metadata. [GPS.gov accuracy guidance](https://archive.gps.gov/systems/gps/performance/accuracy/).
- **Transmission failure:** the device may still obtain positions without a connection to CargoMesh. Some vehicle gateways store data offline and send it after connectivity returns. This is a capability of the chosen device/provider; it is not automatic for every tracker or phone. [Samsara Vehicle Gateway specifications](https://www.samsara.com/products/models/vehicle-gateway), [connectivity states](https://kb.samsara.com/hc/en-us/articles/360044700152-Internet-Connectivity-States-and-Best-Practices).

CargoMesh cannot conclude which failure occurred merely because no new point arrived. Use **No recent update** unless an explicit device/provider diagnostic identifies the cause. Describe operation as near real time, subject to observation and upload frequency; do not promise continuous exact positioning.

## Data and architecture

Future flow: authorized device/provider -> server adapter -> validated append-only observations -> current-position projection -> authorized API/optional Realtime -> map and Three.js coordinator.

Minimal observation: event/provider/device ID, Carrier and vehicle ID, optional execution ID, latitude/longitude, `observedAt`, server `receivedAt`, accuracy when provided, optional speed/heading, source/provenance, and diagnostics when actually available. Separate raw observations from any derived map-matched point or extrapolation. A record with no accuracy remains accuracy-unknown.

Validate device ownership and trip/Carrier scope on the server. Deduplicate replayed observations and reject/quarantine implausible coordinates, times or jumps. Delayed offline points can fill history but must not replace a newer last-observed point. Keep observation time distinct from receipt time: an old point received now is still old.

Existing execution position fields are not proof of an ingest adapter, reliable current location, or live GPS. The 10/16/80/80 scenario currently supplies no physical-position telemetry.

## Display states and loss of contact

| State | Map behavior | English label |
| --- | --- | --- |
| Recent valid observation | Observed point, age and accuracy | Last update / Reported position |
| Old observation | Retain its exact location; show age | Last known position / No recent update |
| Bounded optional estimate | Separate translucent/ghost marker; keep observed marker visible | Estimated position — no recent update |
| Scenario playback | Explicit scenario marker, independent of connection state | Simulated position |
| No trustworthy observation | No invented current marker | Position unavailable |

When contact is lost, any estimate starts **from the last known observation**, not “up to the last connection”. The vehicle may have stopped or deviated. Define configurable freshness and short projection limits per provider; stop extrapolating when its bound expires. Do not describe extrapolation as GPS or silently switch a connected vehicle to a demo simulation.

An optional estimate may follow an already calculated road polyline using its last credible motion and timestamps. It must not invent a road, cross an unreviewed border, pass a hold/inspection, complete delivery, establish custody, reserve capacity or prove depot presence. When no reliable route/motion evidence exists, keep only the last observed point.

On reconnection, accept valid newer observations as authoritative and reconcile the display. Retain previous estimates as derived information if needed for audit; never write them as raw GPS observations. Real dead reckoning with onboard sensors is a separate provider capability, not assumed here.

## Security, practical limits and demo

- Start with one provider adapter or a controlled simulator using the same observation contract. No hardware purchase or provider selection is required for the demo.
- A phone option needs consent, OS/background permissions, battery and connection handling; a web page alone does not guarantee continuous background tracking.
- Keep credentials and webhook signatures server-side; use least-privilege Carrier/trip-scoped access, retention rules and a minimal Client projection. A Client must not see every vehicle/driver of a Carrier.
- Cross-country connectivity, roaming and device coverage depend on the selected integration. Keep them unverified until tested.
- Demo cases: normal reports; GPS diagnostic failure; communication silence; offline replay arriving late; recovery; no route for estimation; stopped/held at border; no assigned device; unauthorized tenant.
- No telemetry observation or geofence alone approves a border crossing or transfers cargo custody.

## Delivery order

1. Border document/passage backend: local implementation in this increment.
2. Google road routes: real returned geometry and explicit comparison scope.
3. Frontend: reflect review, physical status, pending evidence and route provenance.
4. Tracking contract and simulated observations, only when explicitly implemented next.
5. One real provider integration and operational validation, future work.

The current task documents GPS. It does not build an ingest endpoint, connect devices, enable tracking permissions or claim a live feed.
