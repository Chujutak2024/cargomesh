# HAC-50 friction — Scenario row cleanup meets the production crew guard

Date: 2026-10-16. Scope: local synthetic Carrier scenario only.

## Observed

A transaction attempting to remove the new scenario's driver rows failed with `42501 COMMAND_REQUIRED` from `private.guard_v2_crew`. The native production function explicitly rejects DELETE, including for postgres. The transaction rolled back; scenario data was preserved.

## Resolution

Keep the production guard unchanged. Restrict the seed to an explicitly marked disposable `hac50_scenario_*` database, created from a local schema-only copy. Same-input replay is verified without revising rows; changed input is rejected with rollback. Use a fresh named bank when regenerating different data or a new clock.

Ship `cleanup-probe.sql` as a rollback-only capability check, not as a cleanup command. The final runner verifies the guard, unchanged fingerprints and preservation of an unrelated sentinel row. The runner performs no database drop, disables no trigger, changes no RLS policy and grants no production cleanup authority.

Physical row cleanup is unsupported by this delivery. Disposing of a dedicated bank later requires a separately authorized, explicitly targeted action. No change to the production crew mutation contract is proposed for convenience of a seed.

Evidence: `salida/carrier-scenario-20261016/final-verification/CLEANUP_GUARD_PROBE.txt` and `RESULTS.json`. The local seed and native-contract checks pass; this friction does not prevent the authorized isolated scenario.
