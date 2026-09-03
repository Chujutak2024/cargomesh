# REL-02 Public WebMCP UAT Evidence

Status: provider surface passed; Golden Flow evidence blocked

Validation date: 2026-09-02 (America/Lima)

Public URL: [https://cargomesh.vercel.app](https://cargomesh.vercel.app)

Reported deployed revision: `origin/main@b1e3457`

Browser surface: external Google Chrome session with WebMCP enabled

## Provider surface result

The following public provider documents returned HTTP-rendered pages and exposed
the five expected tools through the native `document.modelContext` object:

| Provider | `serviceId` | Tools |
|---|---|---|
| Andes Freight | `30000000-0000-0000-0000-000000000001` | 5/5 |
| Inca Logistics | `30000000-0000-0000-0000-000000000003` | 5/5 |
| Pacific Cargo | `30000000-0000-0000-0000-000000000002` | 5/5 |

Tool names:

- `check_service_coverage`
- `check_capacity`
- `quote_freight`
- `book_freight`
- `get_provider_booking_status`

Andes annotations reported `readOnlyHint: true` for coverage, capacity, quote,
and booking status, and `readOnlyHint: false` for booking.

## Native execution sample

`check_service_coverage` was executed through
`document.modelContext.executeTool()` on the Andes document with this sanitized
input:

```json
{
  "origin": "Callao, PE",
  "destination": "Santiago, CL",
  "transport_mode": "ROAD",
  "service_type": "FTL",
  "cargo_category": "MACHINERY"
}
```

The provider returned a successful `ProviderToolEnvelope` with
`providerServiceCode: "ANDES-PECL-FTL"`, `supported: true`,
`crossBorderSupported: true`, and the same Callao → Santiago corridor.

## Cleanup

After leaving the provider document through a full-document navigation to the
CargoMesh root, `document.modelContext.getTools()` returned `[]`. None of the
five provider tools remained registered.

## Sanitized captures

- [FR-1042 intake](../03-ux-ui/screenshots/01-intake-fr1042.png)
- [Five provider tools on the Andes production page](../03-ux-ui/screenshots/02-provider-tools-production.png)

## Golden Flow blocker

The authenticated ACME Mining session did not expose the persisted Golden Flow
claimed by the production handoff:

- `/dispatch` displayed zero evaluations;
- `GET /api/judge/evidence` returned HTTP `200` with `{ "events": [] }`;
- FR-1042 loaded as draft version `35` with status `DRAFT`;
- the review step displayed `Dispatch bloqueado`, so no new orchestration could
  be started without first changing persisted application state.

For that reason, this run does **not** claim a current Judge Drawer trace,
`89 / 84 / 72` ranking, confirmed booking, or recovery screenshot for
`origin/main@b1e3457`. Those four evidence slots remain open until C reconciles
the production runtime and authorizes a fresh run or provides the exact visible
run correlation for the authenticated demo organization.

## Scope note

The external Chrome agent controlled the public HTTPS deployment. The three
registered demo `providerUrl` values resolve to paths on the same Vercel origin.
This validates native browser-agent WebMCP, exact `matchingServiceId`, execution,
and cleanup, but it is not presented as proof of a provider hosted on a second
independent HTTPS origin.
