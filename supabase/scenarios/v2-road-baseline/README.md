# Synthetic V2 ROAD baseline — HAC-29

Local-only scenario, separate from migrations and V1 fixtures. Follow the
[bootstrap runbook](../../../docs/v2-amazon/delivery/HAC29_CLEAN_BOOTSTRAP.md) for exact
reset/seed/verify/cleanup/count commands and external backup requirements.

The original c230–c238 IDs remain unchanged: two organizations/Auth identities/active
supervisors, four facilities (tenant A: Lima, Arequipa, Piura; tenant B: Lima), one
carrier/service, a Piura depot, four endpoint areas and one Lima→Arequipa lane.
The c239–c23c extension adds one carrier, one service, two areas and a second directed
Lima→Arequipa lane. c23d/c23e/c23f reserve the HAC-27 asset/pool/calendar IDs but create
no rows or tables. Both services lack Piura coverage and have no reverse lane.

`manifest.json` is the stable identity inventory. `seed.sql` is idempotent by exact ID;
`verify.sql` fails on missing/mismatched controls. No request, offer, booking, calendar
or MCP link is created. The existing service's nominal 10000 kg / 30 m³ is metadata,
not evidence of capacity availability. The second service copies those nominal maxima
because the historical schema requires a weight limit; its calendar remains unverified.
The seed does not claim that either service is presently eligible.

`fixtures/id-map.json` maps the HAC-27 published example IDs to this scenario.
The four case files provide request bodies plus explicit expected response projections
for positive, zero (Piura), unknown and foreign tenant. They are BLOCKED contract
expectations for HAC-12, not captured API outputs. Positive and unknown use the same
two-candidate response: total 2, eligible 1, unknown 1, ineligible 0. The unknown case
selects its candidate; it does not invent a third candidate or change global counts.

The input cargo/windows/contacts/budget are copied from HAC-27 PHARMA. Locations come
from these canonical scenario facilities: no invented coordinates, region codes or
Callao geometry. Geometry is null/UNKNOWN with no legs. Expected area codes and error
wording are omitted where HAC-27 gives no adapted values. Bind `$createdRequestId`
from the eventual native POST; do not seed or assume a request UUID.

Executable DB evidence: positive declared lanes, no Piura/reverse lane, preserved nominal
metadata, actual authenticated tenant isolation and composite-FK rejection with a
successful own-facility update. Capacity availability, HTTP statuses/counts, writer
idempotency/rollback and UI/MCP behavior remain BLOCKED with owners in the manifest.

Cleanup uses explicit IDs only and requires `local_only=1`, a prior external backup and
`backup_confirmed=1`. Incoming FK/cascade checks reject any external dependent row.
Never broaden the inventory to remove another task's data. `counts.sql` reports all
ten affected relations and the retained reference count; the clean gate asserts zero
scenario rows and eight meaningful reference categories after cleanup.
