# CargoMesh voice and commercial workflow — 17 Oct 2026

## Implemented in this branch

- Customer: Nova now speaks as CargoMesh and guides freight intake rather than describing a voice-comparison pilot. A completed voice transcript can be moved into the existing authenticated request chat; only that chat and its explicit review can create or revise a persisted DRAFT. Voice speech alone performs no mutation.
- Carrier: the connected portal refreshes authorized opportunities while visible and displays an in-app review alert for open, unquoted opportunities. Clicking its voice action opens the exact persisted detail and starts Nova. A carrier-only opening turn asks Nova to brief the operator; the signed, short-lived voice grant contains only a bounded summary of that authorized opportunity. The browser may still require microphone permission.
- Offer: a single explicit USD amount spoken by the carrier can populate an editable total and one provisional transport component. Ambiguous or invalid numbers are ignored. Evidence is deliberately left incomplete, so the existing carrier form requires the operator to supply it, review the full offer and confirm submission. Its backend revalidates the commercial contract, identity, expiry and idempotency. Voice does not send an offer, reserve capacity, or confirm a booking.

## Required for the requested complete experience

1. **Carrier price recommendation:** add a carrier-owned, versioned tariff or cost basis with route/equipment/date applicability, currency, component breakdown, validity, and evidence. Calculate a labeled estimate through a shared domain service; keep `UNKNOWN` when no matching tariff exists. Do not derive a quote from an old offer or an LLM answer.
2. **Broader voice-to-action orchestration:** the single spoken total above is only a draft helper. To change individual price components or terms by voice, add a validated command contract and show the exact proposed diff for operator review. The existing `offers.create` form remains the sole submission path; stale or denied changes must fail without mutation.
3. **Push alerts:** current alert polls while the portal is open. Background/email/push delivery requires an authorized notification channel, tenant-scoped event source, opt-in, deduplication and delivery tests.
4. **Deployment:** the Nova WebSocket gateway requires its own long-running service, task role with Bedrock access, HTTPS/WSS, origin allowlist, shared bridge secret and monitoring. Vercel hosts the web UI/API; Supabase stores V2 records. A local AWS console login alone does not provide deployed gateway credentials.

The voice channel must never present an estimate as a carrier offer, an accepted opportunity as a booking, or an unconfirmed form as a submitted offer. Customer and carrier mutations remain in the V2 services named in `contracts/ARCHITECTURE.md`.
