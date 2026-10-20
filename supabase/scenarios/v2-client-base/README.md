# V2 Client base — HAC-52

Local synthetic Client scenario, never a migration or hosted seed.

- Clock: `2026-10-19T12:00:00Z`; horizon through `2026-11-02T12:00:00Z`.
- [manifest.json](manifest.json) is the stable ID/address/zone source for Juan
  (HAC-53) and Luis (HAC-54): 3 organizations, 8 Facilities, 3 profile IDs,
  3 preference IDs and their local member IDs.
- Street addresses are fictional; coordinates approximate the named city.
  Known schedules open Monday–Friday, 08:00–18:00 in the Facility's IANA zone.
  `PE_TACNA` has unknown persisted hours. Its manifest zone describes the
  location, not a known opening schedule; `operating_hours` remains null.
- Carrier data is not generated or changed. Reuse `../v2-carrier-fleet-80`
  through its existing owner/loader when a commercial bank requires it. The
  identity bank currently contains zero Carriers and does not certify hosted
  availability. Luis supplies his 12 requests/relations in a separate file.
- Auth users are linked by local provisioning, without credentials in SQL.

From the worktree root after [local startup](../../../docs/v2-amazon/delivery/HAC52_LOCAL_DELIVERY.md):

```powershell
node supabase/scenarios/v2-client-base/generate.mjs
node scripts/hac52/seed-local.mjs C:\Users\Usuario\Documents\Proyectos\hac52-private\client-access.json
node scripts/hac52/verify-seed.mjs C:\Users\Usuario\Documents\Proyectos\hac52-evidence\h3-seed-replay.json
```

The SQL runner uses the fixed HAC-52 container and `psql -v local_only=1`.
The seed also requires the exact `LOCAL_ONLY:HAC52_CLIENT_BASE` database marker.
Explicit IDs and `ON CONFLICT(id) DO NOTHING` preserve edits, timestamps and
versions. An unrelated identifier collision fails instead of overwriting it.
The transaction verifies Facility-to-organization mappings. The verifier
compares full row hashes before/after two executions, alongside manifest counts.

There is no destructive cleanup. Retain the bank for October 21. Any later
cleanup requires explicit IDs, backups, counts and FK review. Logs/access files
stay outside Git. The current BO/CL access-recovery limitation is documented in
[the handoff](../../../docs/v2-amazon/delivery/HAC52_HANDOFF.md).
