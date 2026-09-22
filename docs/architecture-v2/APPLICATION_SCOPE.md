# CargoMesh Application Scope

## Enterprise Client Application

The enterprise application is the primary product experience for the hackathon. It is used by logistics supervisors at companies like ACME Mining to create and manage freight shipments.

### Golden Flow Screens (REQUIRED for hackathon)

| Screen | Route | Status | Notes |
|---|---|---|---|
| Dashboard | `/dashboard` | EXISTS | Org metrics, operations map, request table |
| Create Freight Request | `/freight-request/new` | EXISTS | Multi-step intake form with D1 recommendations |
| Dispatch Queue | `/dispatch` | EXISTS | List of orchestration runs |
| Dispatch / Booking Workspace | `/dispatch/[id]` | EXISTS | Ranked offers, carrier selection, booking actions |
| Booking Status | `/booking/[requestCode]/status` | EXISTS | Provider confirmation state |
| Tracking | `/tracking/[id]` | EXISTS | Live Leaflet map with booking events timeline |
| Login | `/login` | EXISTS | One-click ACME demo login |

**All Golden Flow screens exist. No new pages need to be created for the core demo.**

### Enterprise Screens — Supporting (USEFUL but not critical path)

| Screen | Route | Status | Notes |
|---|---|---|---|
| Freight Requests List | `/requests` | EXISTS | Directory of all requests |
| Organization Settings | `/organization` | EXISTS | Org policies, preferences |
| Supervisor Exceptions | `/supervisor/exceptions` | EXISTS | Exception review queue |
| Support | `/support` | EXISTS | Static |
| Help | `/help` | EXISTS | Static |

### Carrier / Provider Application

The carrier application is the second product experience. It is the surface where carrier companies manage their service offerings and respond to bookings. It also hosts the WebMCP tool registration pages.

| Screen | Route | Status | Notes |
|---|---|---|---|
| Providers Directory | `/providers` | EXISTS | List of carriers |
| Provider WebMCP Host | `/providers/[carrierSlug]` | EXISTS | Registers 5 WebMCP tools on `document.modelContext`; THIS IS CRITICAL — DO NOT MODIFY |
| Carrier Dashboard | `[PLANNED]` | NOT YET | Service routes, capacity, booking queue |
| Carrier Booking Management | `[PLANNED]` | NOT YET | Accept / reject bookings |

**For the hackathon:** The carrier experience is represented by the three demo provider pages (Andes, Inca, Pacific). The carrier application screens are PLANNED but not required for the Golden Flow demo. Do not build carrier CRUD screens at the expense of polishing the enterprise Golden Flow.

## Screens EXPLICITLY EXCLUDED from Hackathon Scope

The following MUST NOT be built during the hackathon adaptation:

| Excluded Feature | Why |
|---|---|
| Full platform admin portal | Not a user-facing need in the demo |
| Billing / invoicing / payments | Out of domain for logistics orchestration demo |
| Payroll / accounting | Out of scope entirely |
| Fleet ERP / vehicle management | Not needed for the carrier demo level |
| User management / org admin | Not needed for single-org demo |
| Mobile applications | No mobile target |
| Real production carrier integrations | Fixture-based WebMCP providers are sufficient |
| Python backend | Explicitly excluded per working rules |
| AgentCore / Strands | Not justified for this project |
| Multi-tenant org switching | Single-org demo is sufficient |
| Email / notification system | Not part of demo flow |

## Judge Drawer (Special — Preserve and Enhance)

The Judge Drawer (`src/components/judge-drawer.tsx`) is a critical hackathon evidence surface. It shows raw JSON WebMCP tool call traces, fixture toggles (ACCEPT/REJECT), and demo reset functionality.

**For V2:** The Judge Drawer should eventually show MCP tool call traces alongside WebMCP traces (PLANNED, not required for Slice 0-2).

## Feature Polish Priority

For the hackathon, prioritize this order:
1. Golden Flow is fully functional end-to-end (enterprise path)
2. Alexa+ MCP integration works for the 6 tools
3. Recovery flow is demonstrable (Andes REJECT → Inca rebook)
4. Carrier WebMCP pages remain stable (do not break them)
5. Carrier application screens (lower priority)

**The desired demo quality is: one complete, polished, reliable flow — not many half-finished features.**
