# D1-03 reproducible scenario package

This package is synthetic and local-only. It adds a small provider catalog,
two cargo profiles, and two marked historical request antecedents. It does not
seed a new demo request or any orchestration runtime (`runs`, events, offers,
decisions, or bookings). Those rows must be produced by the UI and WebMCP flow.

The single scenario clock is `2026-09-01T12:00:00Z`. Historical timestamps are
before it; new-request templates in `manifest.json` use future windows after it.

## Local commands (PowerShell)

Run from the repository root with the local Supabase database running:

```powershell
Get-Content -Raw supabase/scenarios/d1/seed.sql |
  docker exec -i supabase_db_cargomesh psql -U postgres -d postgres

# Re-run deliberately: the second application must not duplicate rows.
Get-Content -Raw supabase/scenarios/d1/seed.sql |
  docker exec -i supabase_db_cargomesh psql -U postgres -d postgres

Get-Content -Raw supabase/scenarios/d1/verify.sql |
  docker exec -i supabase_db_cargomesh psql -U postgres -d postgres
```

Scoped cleanup:

```powershell
Get-Content -Raw supabase/scenarios/d1/cleanup.sql |
  docker exec -i supabase_db_cargomesh psql -U postgres -d postgres
```

Do not run this package against a shared or remote Supabase project. It is not a
migration and it must not be added to the automatic hosted deployment path.

## Expected verification

- one synthetic carrier, two services, two vehicles, and two isolated metrics;
- one match for the national case;
- one match for the Peru-Chile case;
- zero matches for the capacity/category negative case;
- two marked synthetic antecedents and zero runtime rows for them;
- `FR-1042` still has exactly three canonical candidates.

The manifest declares fixed scenario tariffs as synthetic fixtures. They are not
live market quotes. Wiring those values and correcting domestic WebMCP coverage
gating belong to a separate provider-runtime cut, not to this data package.
