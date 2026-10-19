# HAC-50 — Carrier catalog consumer scope mismatch

Date: 2026-10-17. Local-only, resolved in this increment. No hosted change.

The first native operation verification failed with `VALIDATION_ERROR` before any Google query. The new consumer supplied a service scope for fleet/capability catalog reads. The actual Carrier RPC only permits a non-null service scope for `areas` and `lanes`; test doubles had accepted the broader shape.

Resolution: retain the production RPC contract. Read fleet records within the authenticated Carrier scope (`serviceId:null`), validate row/value ownership and filter capabilities by service. Direct asset/driver lookups must still match the requested service. Never relax SQL authorization to accommodate the consumer. Bounded partial reads remain unknown.

Evidence: native identity, catalog and workflow reads passed afterward; two actual Google city-pair calculations; six native cases, no writes. The test repository now asserts the native scope rule and includes a foreign-service capability case. Authentication remains controlled local Postgres claims, not browser/hosted E2E.
