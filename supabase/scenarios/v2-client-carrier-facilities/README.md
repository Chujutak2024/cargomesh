# Local Client pickup and delivery sites · HAC-50

Prerequisites: existing fleet80 scenario and `v2-client-carrier-access` native identities.
Target is guarded by exact local DB name/marker, active synthetic client organization and
native SUPERVISOR identity. Never run against hosted Supabase or remove these guards.

Two clearly synthetic, active sites in Lima complete the existing demo corridor:

- `TEST-LINK-PICKUP`: warehouse, pickup.
- `TEST-LINK-DELIVERY`: distribution center, delivery.

Location points are illustrative, not verified addresses or carrier coverage evidence.
The initial local activation used the authenticated Facility create API with deterministic
idempotency keys; this seed records the same data for scenario reproduction. It skips
existing codes and does not replace/activate changed facilities. No freight requests,
offers, bookings, assignments, capacities or carrier permissions are created.

After activation, reload `/clients/freight-request/new`: the organization-scoped intake catalog
must return these two facilities. The user chooses pickup/delivery and reviews the example
before saving. This does not automate opportunity creation or certify transport feasibility.

Cleanup must inspect dependent requests before disabling sites; no automatic deletion.
Initial evidence: `salida/local-flow-start-20261020/client-facilities-result.json` in the
integrator workspace. Not a hosted activation or end-to-end commercial flow certification.
