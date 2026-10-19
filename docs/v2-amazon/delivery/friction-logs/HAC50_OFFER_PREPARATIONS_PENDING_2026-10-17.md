# Offers friction and activation dependencies — 2026-10-17

1. **No existing persistent commercial preparation.** The current workflow's `offers.create` emits `RECEIVED`; it is not a draft endpoint. A separate schema, service, adapter and HTTP route were added. Native GET returns `503 OFFER_PREPARATIONS_NOT_INSTALLED`, because `offer_preparations_v2` is absent. The UI disables persistent save and labels memory-only preparation explicitly. The emitted workflow was not modified to conceal this gap.

2. **Database candidate unverified.** Docker's Linux engine pipe was unavailable; no local Supabase executable was discovered. The SQL and pgTAP candidate files remain outside the active migration chain and were not executed. Backend activation requires a generated additive migration, schema/role review, isolated SQL/RLS/advisor tests, real multi-user and concurrent version/idempotency checks, and separate remote application authorization. Service/repository-response tests do not certify SQL execution.

3. **Requested Customer windows remain absent from the guaranteed Carrier projection.** The existing Requests increment already records this contract gap. Offers uses its read-only opportunity projection and leaves missing pickup/delivery windows unknown. Resource windows, deadlines and proposed commercial dates are not substituted. No Customer endpoint or contract was changed.

4. **Browser unavailable.** CUA inventory returned “Local browser use is disabled in Work settings.” Controlled SSR and authenticated HTTP reads are reported separately; no screenshot, browser interaction, responsive layout or visual validation is claimed.

5. **Real mutation evidence intentionally limited.** Existing records were read but not emitted, withdrawn or substituted for testing. Controlled adapters cover mutation payloads, expected versions, retry keys and replacement semantics. Actual business writes and persistent preparation E2E remain unverified.
