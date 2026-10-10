# Integration certification access — 10 October 2026

- Scope: HAC-40 documentary increment; code inspected at `main @ 3ba9b95`.
- Owner of environment access: Tech Lead / authorized Vercel and AWS operator. OAuth/MCP implementation: HAC-41/Axel.
- Outcome: certification blocked by missing accessible configuration/provider, not a confirmed product defect.

## Evidence

Read-only Vercel management API requests using the operator's existing CLI session returned **403 forbidden**. No secret values were returned, and no environment/deployment/alias changes were made. The local real Bedrock adapter check reports missing/disabled configuration before invoking AWS. Hosted carrier integration configuration inventory is empty; no named external carrier sandbox was supplied.

The earlier hosted Supabase OAuth PKCE smoke remains valid evidence for its exact SHA and synthetic dataset. Its QA client, account links and carrier operator were deliberately deactivated afterward. The current preview redirects to protection and production protected-resource discovery returns 503; this is not a new successful authenticated smoke.

## Resolution and acceptance

Restore the authorized management session or provide a private approved Bedrock environment, then execute `scripts/certify-bedrock.mts` with real credentials and retain its sanitized JSON. A deterministic fallback must fail certification. Designate a carrier/provider sandbox before implementing and certifying its adapter. For a new OAuth client, agree callback/consent UI and disposable access, execute PKCE and MCP calls on the intended deployed SHA, and withdraw temporary access afterward.

Access and provider availability were requested while documentation and regression work continued. No security checks were bypassed. See the [certification record](../INTEGRATION_CERTIFICATION_2026-10-09.md) for exact boundaries and remaining inputs.
