# Native local Client / Carrier access

Related work: HAC-50 local connection; coordinated with HAC-51/52/53/54.
This is a LOCAL identity scenario layered on the existing fleet80 database.
It changes no schema and creates no freight request, offer, booking or execution.

1. Verify the marked local database and the native local Auth container.
2. Create synthetic Auth users through Auth Admin; keep credentials outside Git.
3. In one transaction, set `cargomesh.test_access_manifest` to the validated manifest
   (scenario + accounts with profile, Auth userId, synthetic email, role and
   organizationId/memberId or carrierId/operatorId/grantExpiresAt).
4. Execute seed.sql in that transaction. It requires native app_metadata ownership,
   fixed local DB markers and the explicit Lima Local Carrier scope.
5. Verify native login, membership/grant scope and cross-tenant denial using user
   sessions. An admin query alone does not establish access correctness.

Initial verified local tooling/evidence is under the integrator workspace:
`C:/Users/HP/Documents/cargomesh/salida/client-carrier-connection-20261019/`.
Credentials and user IDs are not portable to hosted Supabase. Do not run this
scenario in the cloud, change the guards to target production, or store secrets
in a seed or a migration. Re-running does not reset passwords or revive grants.

Lifecycle: the synthetic Carrier grant expires 2026-10-30T00:00:00Z; Client
memberships persist until explicitly disabled. Before cleanup, inspect dependent
records and disable only this scenario's memberships/operator/grant. No cleanup
or hosted activation is performed automatically.
