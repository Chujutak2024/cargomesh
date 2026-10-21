# Client bookings layout — 2026-10-21

## Scope

UI-only changes on local `main`; no push, migrations, authentication changes or workflow writes.

- Removed duplicate Assistant header/hero shortcuts from the Client shell, dashboards, request workspace and intake hero. The floating assistant and dashboard conversation input remain available.
- Reused a presentational BookingCard in connected and isolated-demo bookings. Status, carrier, full request reference, verified linked-offer amount, dates and capacity evidence remain sourced from the existing read model.
- Preserved booking-resource disclosures, request links, partial-read guards, unknown values and pending/rejected/cancelled consequences.
- Added container-aware one/two/three-column layout, readable type, wrapping references/status/actions and stacked mobile dates. The grid adapts when the assistant sidebar reduces available space.

## Verification

- `pnpm test:shipper-portal`: 111 passed, including five presentation/shortcut regressions.
- `pnpm typecheck`: passed.
- `pnpm check:architecture`: passed (683 modules; 203 client entry points).
- `pnpm build`: passed, including type validation and production page generation.
- Browser: connected local `/clients/bookings`, 1280px two columns; 1920px three columns; 390px and 320px one column. No document horizontal overflow or overflowing card descendants at tested widths.
- Expanded real linked-resource details: complete UUIDs wrap without clipping. Opening the retained assistant bubble at 1280px adapts reservations to one column without overflow; assistant and shared draft still render.
- No backend records were modified during these checks.

Screenshots are local QA artifacts under `C:/Users/holap/Documents/Codex/artifacts/client-bookings-2026-10-21/`.
