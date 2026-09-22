# HAC-23 V2 ROAD baseline — local synthetic scenario

This package is `SYNTHETIC_DEMO_ONLY`. Run it only against the isolated local
Supabase stack after `db reset`. It is not a migration and must never be deployed
as hosted data. Its UUIDs occupy the `c230`–`c238` namespace, disjoint from D1
(`a1`, `b1`, `d1`, `f1`, `f2`) and the FR-1042 baseline. `seed.sql` is
idempotent; `cleanup.sql` names each package ID explicitly and leaves UI-created
requests and all other scenarios untouched.

## Why each row exists for CP-3

| Seeded data | CP-3 negative case enabled |
|---|---|
| Tenant A/B organizations, local Auth users/identities, exact ACTIVE memberships | User B must not read or mutate tenant A facilities/requests; MCP user identity must not select an arbitrary organization. The local-only password in `seed.sql` is a test fixture, not a hosted credential. |
| Tenant A Lima pickup facility and Arequipa delivery facility | Positive control: a declared ROAD A→B lane exists. An area/lane is still not proof of capacity, booking, or a live offer. |
| Tenant A Piura facility and physical Piura carrier depot | Negative “site without coverage”: neither facility nor depot creates a Piura service area or lane. |
| Tenant B Lima facility | Same city, different tenant: geography must not bypass ownership/RLS. |
| Four service areas (pickup/delivery at A and B), only A→B lane | Reverse B→A has valid endpoint roles but deliberately no lane; do not infer the reverse direction. |

`mcp_account_links` is **not seeded**: HAC-22 records its persistence as missing
and requires fail-closed behavior. This package supports local negative identity
and RLS tests, not a claim of Alexa+ or OAuth linking live. No freight request,
offer, orchestration run, decision or booking is pre-created.

## Commands from repository root (PowerShell)

First run `npx supabase db reset`. The following commands target only the local
`supabase_db_cargomesh` container; never point them at a shared/hosted database.

```powershell
Get-Content -Raw supabase/scenarios/v2-road-baseline/counts.sql |
  docker exec -i supabase_db_cargomesh psql -U postgres -d postgres
Get-Content -Raw supabase/scenarios/d1/seed.sql |
  docker exec -i supabase_db_cargomesh psql -U postgres -d postgres
Get-Content -Raw supabase/scenarios/v2-road-baseline/seed.sql |
  docker exec -i supabase_db_cargomesh psql -U postgres -d postgres
Get-Content -Raw supabase/scenarios/v2-road-baseline/verify.sql |
  docker exec -i supabase_db_cargomesh psql -U postgres -d postgres
Get-Content -Raw supabase/scenarios/v2-road-baseline/cleanup.sql |
  docker exec -i supabase_db_cargomesh psql -U postgres -d postgres
Get-Content -Raw supabase/scenarios/v2-road-baseline/counts.sql |
  docker exec -i supabase_db_cargomesh psql -U postgres -d postgres
Get-Content -Raw supabase/scenarios/d1/verify.sql |
  docker exec -i supabase_db_cargomesh psql -U postgres -d postgres
```

Compare every relation in `counts.sql` with its post-D1/pre-V2 count, then
repeat V2 `seed.sql`, `verify.sql`, and `cleanup.sql` twice. A passing
`verify.sql` alone does not prove that cleanup spared D1 or the baseline.
