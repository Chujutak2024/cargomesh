# HAC-54 H4 — native scenario boundaries and test-input correction

Date: October 20, 2026. Surface: Luis's isolated local commercial scenario; parent H3 `fc73da9`. No shared SQL/schema or production permission was changed.

## Native behavior must remain authoritative

1. The native opportunity command accepts a review invitation for a non-eligible plan. Initial harness expectation `409` was incorrect: observed `201`. The Client's existing `opportunityTargets.current` correctly remains false, and the native selection command returns `409 PLAN_NOT_ELIGIBLE`. The corrected test asserts those actual commercial boundaries and no offers/bookings, rather than changing domain SQL to make a test pass. The single case-09 review invitation remains persisted, not hidden or deleted. It is not a commercial success.
2. For a request needing 2–6°C and a capability declaring 10–20°C, the native plan evaluator reports UNKNOWN / `TEMPERATURE_CAPABILITY_UNKNOWN`. It does not classify that mismatch as a hard INELIGIBLE result. No UI relabeling or fake compatibility was introduced. Any finer exclusion taxonomy belongs to a coordinated workflow/domain change; current selection is safely blocked.
3. Native creation inputs do not accept chosen business entity UUIDs. The scenario can supply deterministic idempotency keys and publish the observed ID manifest, but cannot promise identical entity UUIDs after a fresh database bootstrap. A portable-ID seed requirement needs an approved native interface or an explicitly authorized domain seeder; raw business inserts/guard bypasses are not an acceptable shortcut. Jean owns manifest integration/order.

## Test-only shared input reference

`requestToRevisionInput` returns existing nested cargo data. The first runner reused that object and modified it for the cold cases, carrying thermal requirements into later negative cases. This was a test harness defect, not evidence of persisted request mutation by the Client application. The runner now clones the source before mapping. Already persisted composite cases were not rewritten or deleted; native replay correctly refused a changed payload with `409 IDEMPOTENCY_CONFLICT`. The isolated replacements use explicit `_V2` action/case keys:

- Original no-coverage request `e21c0efc-e207-483a-85cf-002616ca316b` → selected `85b1a8be-20c6-428a-bb76-5f873298e25b`.
- Original occupied request `12ea7b01-c5c2-4ac6-9147-ac39997ee010` → selected `95d2ee7b-4ba6-441b-a741-eab5100bfd4a` (`RESOURCE_OCCUPIED`, no thermal pending requirement).
- Original unknown request `e14d7e7c-f948-4d8e-9871-7be0aacb2767` → selected `8d05fe6b-331c-4593-aa3d-55dec02bab8f` (`RESOURCE_WINDOW_UNKNOWN` only).

The final twelve-case runner exits successfully and replays stable native IDs in this database. It also verifies exact tracking chains, tenant/anonymous denials and stale/terminal execution commands. All credentials remain outside Git. No historical H2/H3 transaction, remote database or other Docker stack was changed.
