# FL-03 · Kiro Crew HAC-11 pgTAP execution blocked

**Date:** 2026-10-02 (America/Lima)  
**Work:** Kiro Crew extended CargoMesh V2 HAC-11 account-link pgTAP negatives in commit `c212c62`.  
**Severity:** Medium for delivery verification; no production incident.

## Expected and actual

Expected: after adding five assertions, run the HAC-29 V2 local bootstrap and `supabase test db` to demonstrate `14/14` passing checks. Actual: Kiro Crew could edit, inspect and commit the file, but `npx supabase status` could not connect to the Docker Desktop Linux engine (`npipe:////./pipe/dockerDesktopLinuxEngine`). The suite was **not run**. An earlier shell approval prompt timed out after ten minutes, and the session proceeded without treating that timeout as a user rejection. A Kiro backend throttling notice appeared; it is not evidence of a CargoMesh Bedrock runtime call.

## Reproduction and workaround

1. On the HAC-11 branch, check `docker info` or `npx supabase status` while Docker Desktop's Linux engine is stopped.
2. Observe the connection error before any V2 database test can start.
3. Keep the SQL test and commit for review, but mark pgTAP **BLOCKED**, not PASS.
4. Start Docker Desktop locally, apply only the HAC-29/HAC-11 V2 local migration chain, load the synthetic V2 scenario with its local-only guard, and rerun the isolated pgTAP test. Do not use linked or hosted Supabase for this verification.

## Actionable improvement

The team should provide a one-command V2 test profile that checks the Docker daemon and prints the exact bootstrap/test sequence before invoking Supabase. Kiro Crew could surface an approval timeout distinctly from a rejected operation and preserve the pending action so the developer can resume it without re-specifying the task.

Evidence: [sanitized Crew record](../evidence/hac-30/KIRO_CREW_HAC11_2026-10-02_REDACTED.md), [PR #94](https://github.com/Chujutak2024/cargomesh/pull/94). No secrets or full account identifiers are included.
