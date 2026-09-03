# REL-02 Public WebMCP UAT Evidence

Status: provider surface and Golden Flow passed; recovery capture pending

Validation date: 2026-09-02 (America/Lima)

Public URL: [https://cargomesh.vercel.app](https://cargomesh.vercel.app)

Reported deployed revision: `origin/main@76d03ef`

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
- [Judge Drawer WebMCP trace](../03-ux-ui/screenshots/03-judge-drawer-webmcp-trace.png)
- [BALANCED ranking](../03-ux-ui/screenshots/04-balanced-ranking.png)
- [Confirmed Andes booking](../03-ux-ui/screenshots/05-confirmed-booking.png)
- [Provider cleanup](../03-ux-ui/screenshots/07-provider-cleanup.png)

## Golden Flow result

The authenticated ACME Mining supervisor executed a fresh FR-1042 run after the
authorized server-side reset and transition to `PENDING`.

Correlation:

- orchestration run: `2a8c3009-10ba-4492-81d9-2ba944a0fed7`;
- booking: `ae760cbb-eafa-4c55-ab5e-0dfffb42a127`;
- provider reference: `AND-BOOK-48133070`.

The browser flow discovered three candidates and executed coverage, capacity,
and quote for every provider. The Result Bridge persisted exactly nine
orchestration events: three tools for each of three carriers. Separately, the
Booking Bridge persisted the later `book_freight` and
`get_provider_booking_status` calls. The Judge Drawer exposed ten navigation
records across orchestration and booking. Each navigation retained the exact
`matchingServiceId`, listed the five provider tools, and ended with
`cleanupToolNames: []`.

The Result Bridge persisted three offers and one decision. Supabase read-only
verification for the run returned:

| Rank | Provider | Price | Transit | Reliability | Raw BALANCED score |
|---:|---|---:|---:|---:|---:|
| 1 | Andes Freight | USD 1,760 | 31 h | 96 | 89.2949 |
| 2 | Inca Logistics | USD 1,920 | 29 h | 98 | 84.2031 |
| 3 | Pacific Cargo | USD 1,590 | 60 h | 86 | 72.1667 |

The decision confidence was `88`, the user explicitly selected Andes in
`ASSISTED` mode, and `get_provider_booking_status` persisted both booking and
provider status as `CONFIRMED`. No credential, cookie, token, authorization
reference, anon key, or `service_role` value is included in the captures.

## Recovery status

The confirmed Golden Flow is preserved as evidence. The separate controlled
`REJECT` → recovery run has not yet been executed in this evidence revision;
it requires an authorized demo reset because that operation deletes the current
runtime. It must use a fresh run and must not portray the confirmed booking as
the same booking that rejected.

## Scope note

The external Chrome agent controlled the public HTTPS deployment. The three
registered demo `providerUrl` values resolve to paths on the same Vercel origin.
This validates native browser-agent WebMCP, exact `matchingServiceId`, execution,
and cleanup, but it is not presented as proof of a provider hosted on a second
independent HTTPS origin.
