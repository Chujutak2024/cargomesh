# Database and synthetic data

The active migration chain is `supabase-v2/supabase/migrations/`, with hashes/dependencies in `supabase-v2/migration-manifest.json`. `supabase/migrations/` remains a historical SQL regression input, not the active runtime chain. Do not rewrite applied migrations or embed synthetic companies/vehicles/offers into new production migrations.

## Choose a scenario deliberately

| Scenario directory under `supabase/scenarios/` | Purpose |
|---|---|
| `v2-road-baseline` | Minimal ROAD serviceability and SQL QA fixture |
| `v2-client-base` | Customer organization/facility foundation |
| `v2-hosted-client-demo` | Guarded synthetic customer demo preparation |
| `v2-client-carrier-access` | Scoped synthetic access setup |
| `v2-client-carrier-facilities` | Customer/carrier facility data |
| `v2-client-carrier-requests` / `v2-client-carrier-quotes` | Requests and commercial examples |
| `v2-client-carrier-flow-cases` | Ordered customer/carrier cases |
| `v2-carrier-fleet-80` | Synthetic fleet scenario |
| `v2-international-client-demo` | 32 additional facilities in 16 countries; with existing Peru baseline, 35 facilities in 17 countries |
| `v2-full-flow-qa` | Broader workflow QA fixture |

Every scenario's README and SQL guards define its actual prerequisites, target, verification and cleanup. They are not a sequence to apply wholesale. Development-specific `v2-hac54-*` and `v2-c01-sim-v1` scenarios remain explicit fixtures with their own boundaries; the latter's name does not turn it into the V1 runtime.

## International customer catalog

[International scenario instructions](../supabase/scenarios/v2-international-client-demo/README.md) describe the exact synthetic organization, stable IDs and guarded baseline. The seed adds saved city/facility references only: no carrier, fleet, capacity, offer, booking or new account. It refuses conflicting data and has exact-ID cleanup. Do not assert it is loaded on hosted Supabase until seed verification and an authorized API read confirm it.

International facilities do not make ocean crossings ROAD routes. Discovery still needs a compatible persisted service, lane and available resources. Unknown or unsupported results must remain visible to judges.

Back up the intended target before an authorized hosted operation. Run seed, verification and identity-scoped API readback; do not use cascade cleanup or bypass RLS to manufacture a successful demo. [Bootstrap reference](v2-amazon/delivery/HAC29_CLEAN_BOOTSTRAP.md).
