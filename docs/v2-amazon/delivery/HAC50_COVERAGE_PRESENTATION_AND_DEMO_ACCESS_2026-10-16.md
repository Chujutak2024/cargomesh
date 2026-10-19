# HAC-50 — Readable coverage and representative demo access

16 October 2026. This document defines frontend work; it does not claim that the screen was changed. Existing Carrier APIs and `ConnectedCarrierNetwork` are reused. Three local Auth profiles are provisioned and verified separately from the current app connection.

## Geography accepted for the scenario

Retain 10 Carriers, 16 Depots, 80 vehicles and 80 drivers. Replace C02 with California (Los Angeles→San Diego), C03 with Texas (Dallas→Austin→Houston), C05 with Guatemala City→San Salvador, and C08 with San Jose→Panama City. Keep C01 Lima, C04 Chachapoyas→Chiclayo→Lima, C06 Tacna→Arica, C07 Santiago→Valparaiso, C09 Spain and C10 Japan.

These are synthetic CITY coverage declarations, with 28 directed lanes and no road geometry or driving-time claim. International lanes retain border review. All four newly represented Carriers preserve their original asset/driver/depot counts and available/busy/maintenance/unknown cases.

## Coverage presentation proposal

Start with the existing **Sites & coverage** navigation destination and its service selector. Keep Depot operations in its own section. For the selected service, present:

1. **Pickup areas**: city, country, inclusion/exclusion, source and dates.
2. **Delivery areas**: the corresponding independently published endpoint areas.
3. **Published connections**: a compact table resolving area references to readable names.

Example in English:

| Pickup | Delivery | Direction | Publication / restrictions |
| --- | --- | --- | --- |
| Los Angeles, US | San Diego, US | Outbound only | Simulated publication |
| Guatemala City, GT | San Salvador, SV | Outbound only | Simulated publication · Border review required |

The label does not claim actual vehicle availability, customs permission or verified road access. A reverse journey requires its own lane. Show exclusions, expired/missing evidence and partial reads explicitly; absence from an incomplete list is not a negative eligibility decision. No geography or decision is recreated in a React component.

Service labels must come from explicit display metadata. A missing temperature range is not proof of general-cargo capability. The isolated fixture can supply its explicit GENERAL/CHILLED labels through a scenario adapter; connected production services require a proper authorized display-name projection instead of exposing UUIDs or guessing from them.

Use one service filter and readable rows before adding a map. A later selection can highlight that same lane on the map once computed geometry exists. The visual map/Three.js connection remains last, as requested.

## Three representative local accounts

| Profile | Native role | Carrier access |
| --- | --- | --- |
| Administrator | ADMIN | C01 Lima, C02 California, C05 Central America North |
| Dispatcher | DISPATCHER | C02 California |
| Operations | OPERATOR | C05 Central America North |

Only these three profiles have generated login passwords. The ten base test subjects remain inert identities for database isolation checks; the 80 drivers do not receive login accounts. All five memberships/grants are explicit. Role and tenant checks remain native backend rules.

`prepare-demo-access.py` starts a separate local Auth container at loopback port 59731, using the already-installed local image and the isolated scenario bank. It validates actual password login, authenticated `/user`, exact Carrier memberships and two denied non-admin catalog writes. Test sessions are logged out. It does not alter the frontend environment, the current Auth service, hosted Supabase or Vercel.

Private credentials and Auth environment live in `%TEMP%/CargoMesh-demo-access-20261016/`, outside both repositories. Passwords, API keys and session tokens are not printed or stored in committed files. The helper's safe summary gives the private credentials path.

The frontend still needs an explicit local scenario adapter/profile that directs Auth and domain reads to this environment together. Pointing login alone at the new Auth service would create an inconsistent session/data setup. No such environment switch is included or silently applied here.

## Auth compatibility friction and resolution

The earlier schema-only bank omitted genuine Auth migration-history rows and retained two DDL differences: the identities primary key and the flow-state comment. Starting Auth without correcting the snapshot attempted old OAuth DDL and failed. The optional helper now compares full Auth DDL with the working local Auth database. It allows only those two known copy differences, repairs them in the isolated bank with its local schema administrator, requires exact DDL equality, and only then copies genuine Auth system migration versions. Unexpected differences stop provisioning; no history is invented and no V2 migration is rewritten.

The dedicated service then started and all three password logins passed. The current application's Auth service was not stopped or reconfigured.

## Verification

Latest base scenario evidence: `salida/carrier-scenario-20261016/global-verification/`. Optional login evidence: the safe `RESULTS.json` next to the private credentials file. Coverage frontend work remains proposed, not visually certified.

References for the native Auth boundary: [Supabase Auth configuration](https://supabase.com/docs/guides/self-hosting/auth/config) and [User management](https://supabase.com/docs/guides/auth/managing-user-data). No package upgrade or deployment is needed for this local verification.
