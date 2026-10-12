# FE-1 commercial decisions, bookings and history — local evidence

Branch: `codex/v2-full-shipper-flow` (continuing after `fb9729d`). Scope is the shipper portal only; no FE-2 route, production, Vercel setting or hosted database was changed.

## What changed

- Request detail now compares persisted ranking options as a single selection surface. Each option exposes the backend's rank, cost, transit, reliability and missing ranking dimensions. Its underlying carrier offers show currency/price, validity, terms, breakdown, declared transit, pickup/delivery estimates, service coverage and reservable capacity. Withdrawn, superseded, expired or absent offers cannot be selected locally; the backend remains authoritative and may still reject a stale selection.
- Booking consent names every selected carrier, price, validity and commercial term. It is unchecked by default. A synchronous in-flight guard and stable per-offer idempotency keys prevent double submission/retry duplication within a session; 409 errors remain visible. Rejected/cancelled bookings can lead to a **new explicit decision** for a different current option, never an automatic substitution.
- `/bookings` separates shipper authorization from carrier confirmation, rejection and cancellation. It shows known timestamps and does not invent a missing reason or offer price.
- `/history` adds status, search, date and sort controls; request history is separate from physical execution events. The outcome panel distinguishes withdrawn offers, rejected/cancelled bookings, failed/cancelled requests and operational incidents, with source-provided notes when present and context-appropriate recovery links.
- The shipper CSS module now consumes the established `--cm-color-*`, radius and shadow tokens for the dominant page/panel/status rules and the new comparison surface. FE-2 files are untouched.

## Visual check (authenticated local synthetic tenant A, 2026-10-11)

- Desktop (1280 px): `/history`, `/bookings`, and `/requests/3e62f98f-3d9a-4040-aa08-b45f62b1d22c` rendered in the blue/cyan shipper shell. History filters, cards, empty booking state, request detail and outcomes were inspected in the browser.
- Mobile (390 × 844 px): `/history` measured `innerWidth=390` and `document.documentElement.scrollWidth=375`; no horizontal document overflow. `/bookings` also rendered its real empty state without clipping. The option selector is designed with horizontal snap scrolling rather than squeezed comparison cards, but no populated offer was available for a mobile browser check.
- This tenant contains three requests, **zero persisted offers and zero bookings**. Thus the real-browser check verifies actual empty states, not populated commercial cards or a live booking. Populated/negative paths are covered by model/API tests, but a live end-to-end commercial approval still requires tenant data supplied by the backend/team. No offers or prices were fabricated to produce screenshots.

## Contract limitations to resolve upstream

1. The booking read DTO omits `offerId` although the database row stores it. The Bookings page can show an offer price only when the persisted decision, request and carrier identify exactly one offer; otherwise it says the detail is unavailable. After any authorization on a decision, the client cannot safely identify a remaining offer after reload or partial failure. It therefore blocks automatic retry and directs the user to Bookings/operations. Exposing `offerId` in the booking response would permit precise per-offer recovery.
2. The freight request status enum has `FAILED` and `CANCELLED`, but no separate `REJECTED`; the UI does not mislabel failure as rejection. Carrier booking rejection is distinct and visible. The booking confirmation record also lacks a guaranteed rejection reason; a reason is shown only when the persisted data actually has one.
3. No approved V2 operation for cloning/reusing a historic request was found. History links to details or an empty new request; it does not silently copy stale addresses, offers or consent.
4. Workspace list endpoints currently read up to 50 requests and 100 workflow records per kind. Complete historical pagination is a backend/workspace follow-up for larger tenants.

## Verification

- `pnpm test:shipper-portal`: 14/14, including current/expired/withdrawn/missing offers, invalid validity and empty ranking options, unambiguous booking→offer resolution, persisted pending booking response, stable retry key, 409 conflict and distinct booking/physical-event outcomes.
- `pnpm test:release`: 331/331 (commercial-view tests are now included in the release script).
- `pnpm check:architecture`: pass (290 modules, 73 client entry points).
- `pnpm typecheck`: pass after the booking-response union test was narrowed correctly.
- `pnpm build`: pass after the final changes (Next.js 15.5.24; dynamic `/bookings`, `/history` and `/requests/[id]` routes generated).

No live booking, cancellation or rejection was created in the authenticated tenant for this visual check.
