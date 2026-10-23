# Client dashboard — mockup adaptation, 22 Oct 2026

## Scope and reference

Local presentation update requested by the user, based on `Dashboard.dc.html`,
`README.md`, `support.js`, the two files in `vendor/`, and the accompanying image
from `C:/Users/holap/Desktop/Dashboard del cliente-html/`.
The CargoMesh layout in the HTML is the primary reference: AI entry, operational
summary, recent activity and a right-hand action rail. The image provides visual
context rather than home-automation functionality.

Both vendor files (`react.js`, `react-dom.js`) are readable and pass `node --check`.
They and the generated export runtime were not imported into the application.
No new dependencies, SQL, authentication, permissions or backend changes.

## Delivered locally

- Shared dashboard presentation for connected Client and the isolated shipper demo.
- Cooler blue/white Client shell, compact navigation/header, rounded cards and
  responsive content containers. Carrier presentation is unchanged.
- Existing AI entry restyled; its original `cargomesh:assistant-message` event,
  trimming and 1,000-character bound are preserved. It does not save a request.
- Original authorized readers, count completeness semantics and read notices
  remain in place. Requests/open requests/bookings/executions are independent
  record counts, not inferred physical shipment progress.
- Latest six requests with working All/Drafts/Pending filters, native statuses,
  exact native request links and localized presentation.
- Latest loaded draft and quick links to existing workflows. No copied prices,
  capacity, monthly plans, weather, members or invented reorder operation.
  The unsupported mockup actions are represented by new-request/draft actions.
- Browser filters are isolated from server formatting to avoid shipping the
  domain formatting dependencies in the dashboard client bundle.

## Verification

- `pnpm test:shipper-portal`: **121/121 passed**, including six new dashboard tests.
- `pnpm typecheck`: passed.
- `pnpm check:architecture`: passed, 729 modules / 214 client entrypoints.
- `pnpm build`: passed; `/clients` First Load JS **119 kB**.
- Browser at `http://127.0.0.1:8080/clients`: desktop 1440×1000, mobile 390×844
  and 320×568; no document horizontal overflow. Opening the copiloto changes
  the available container width and the dashboard reflows to one column.
- All/Drafts/Pending filters checked against loaded records; draft review opens
  the correct persisted request. Mobile navigation open/close and ES/EN checked.
- No quote, booking, commercial submission or AI message was sent during browser QA.
- Screenshots stored locally under
  `C:/Users/holap/Documents/Codex/artifacts/client-dashboard-mockup-2026-10-22/`.

## Friction log / verification limits

1. The booking presentation test inherited from current `main` lacked the existing
   `displayReference` dependency in its VM harness and still expected a raw
   reference. Updated the test harness and assertion to match the already accepted
   public-label behavior; production booking code was not changed.
2. Reading the existing draft detail surfaced local `503` responses for
   similar-cases/recoveries and `QUOTE_BACKEND_UNAVAILABLE`. This is outside the
   dashboard presentation scope; no backend workaround or fabricated success was
   added. This verification does not certify the commercial backend end-to-end.

The initial handoff remained local on the existing `main`. The user subsequently
explicitly authorized committing and pushing this dashboard update to `main`.
No remote migration, infrastructure configuration change or external message is
part of that authorization; any existing automatic deployment is unchanged.
