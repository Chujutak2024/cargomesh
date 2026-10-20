# HAC-52 — Client identity and facilities contract

Owner: Jean Paul. Integrator: Cristhian. Consumers: Juan (HAC-53), Luis (HAC-54).

Initial base: `origin/main` at `c7e394db3c0d2d135011ad601df161cf05b61620`.
Branch: `codex/v2-client-identity-facilities`. Target: `main`.
Worktree: `C:\Users\Usuario\Documents\Proyectos\cargomesh-hac52`.

The user-approved October 19 plan supersedes the older visual approval checkpoints:
October 19–20 implementation; October 21 joint validation (CP-J1..J3); October 22
stabilization. Only compilation, domain checks and build are required during construction.
This contract describes the inspected base and explicitly identifies planned additions.
No hosted database, Auth, configuration or secret is accessed or changed by this task.

## Identity and authorization

- `server/auth/member.ts` validates Supabase `auth.getUser()` and resolves an
  `organization_members` row by `auth_user_id`, `status = ACTIVE` and optional
  organization ID. The current default selects the first active membership; explicit
  deterministic ordering is an HAC-52 addition. Organization IDs supplied by a caller
  never create membership. User-editable metadata does not authorize access.
- The actor is `{ userId, userEmail, memberId, organizationId, role, status }`.
  Roles: `OWNER`, `SUPERVISOR`, `REQUESTER`.
- `v2AuthMiddleware` resolves the same actor for REST. A Bearer token overrides
  cookies and scopes repository calls to that token. Repositories use the caller's
  JWT, explicit organization filters, and database RLS/RPC authorization.
- Active members read their organization, facilities, cargo profiles and preferences.
  Facility/profile writes require `OWNER` or `SUPERVISOR`; organization/preference
  writes require `OWNER`. The database is the authorization authority.
- Carrier identity lives in `carrier_operators`, independently of Client membership.
  A Carrier-only account receives Client `403 FORBIDDEN_TENANT`; it is never
  automatically provisioned as an organization member.
- The existing signed Client preview and assigned demo grant a visual session only,
  without a Supabase member. The inspected `/clients/layout.tsx` checks preview first
  and displays Alex Morgan / Northstar. HAC-52 must prefer an authenticated Client
  session, retain explicit visual/connected labels and reuse the existing shell
  identity prop without changing HAC-53 shell/sidebar files.

## Existing REST surface

All paths below are relative to `/api/v2`. All use `schemaVersion: "2.0"`.
All writes are `POST` with `Content-Type: application/json` and UUID
`Idempotency-Key`; no browser service-role credential is used.

| Resource | Read | Create | Revise |
| --- | --- | --- | --- |
| Organization | `GET /organizations/current` | Provisioning only | `POST /organizations/current/revisions` |
| Facilities | `GET /facilities`, `GET /facilities/:id` | `POST /facilities` | `POST /facilities/:id/revisions` |
| Cargo profiles | `GET /cargo-profiles`, `GET /cargo-profiles/:id` | `POST /cargo-profiles` | `POST /cargo-profiles/:id/revisions` |
| Preferences | `GET /organizations/current/preferences`, `GET /organizations/current/preferences/:id` | `POST /organizations/current/preferences` | `POST /organizations/current/preferences/:id/revisions` |
| Intake selectors | `GET /intake/options` | — | — |

Revision body: `{ expectedVersion: positiveInteger, value: completeResourceValue }`.
Creation body: the complete resource value, without a version or organization ID.
Facility/organization records contain `id`, `version`, `value`, `createdAt`,
`updatedAt`; Facility also has `organizationId`. Catalog records additionally
contain nullable `organizationId`, `carrierId`, `serviceId`.

Single-record responses: `{ schemaVersion, data, meta: { idempotentReplay,
environmentProfile: "v2-clean" } }`. Facility/catalog creation returns 201;
identical replay returns 200. Revisions return 200. Commands persist receipts
with SHA-256 payload hashes; reuse with a different payload is a conflict.

Lists accept `limit` (1–100, default 25) and `offset` (0–100000, default 0).
Response: `{ schemaVersion, data: Record[], meta: { limit, offset, nextOffset } }`.
`nextOffset` is null for a short page; a full last page can require an extra empty
request. Facilities order by `created_at`, then `id`. No total count is promised.
The current server workspace helper truncates lists at 100; HAC-52 pages must
consume pagination. Empty lists are valid data, not a reason to load fixtures.

Errors: `{ schemaVersion: "2.0", error: { code, message, retryable } }`.

| HTTP | Codes/meaning | Client recovery |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Show field/contract errors and retain input. |
| 401 | `UNAUTHORIZED` | Sign in again. |
| 403 | `FORBIDDEN_TENANT`, `FORBIDDEN_CATALOG` | Explain missing membership or write permission. |
| 404 | `FACILITY_NOT_FOUND`, `ORGANIZATION_NOT_FOUND`, `CATALOG_NOT_FOUND` | Reload authorized data; never disclose another tenant. |
| 409 | `STALE_DRAFT` | Retain draft; explicitly reload latest version before retrying. |
| 409 | `IDEMPOTENCY_CONFLICT`, identifier/code conflicts | Correct conflicting command; do not silently change the retry key. |
| 409 | `CATALOG_DATA_INCOMPLETE` | Explain that persisted data needs revision. |
| 5xx/network | `INTERNAL_ERROR` or failed fetch | Show unavailable state; retry the identical pending command with its original key. |

## Required DTO fields

`shared/schemas/v2/{organization,facilities,catalog,intake-options}.ts` are the
executable schemas; nullable properties are still present in complete commands.

**Organization value:** `schemaVersion`, `code`, `commercialName`, `legalName`,
`taxIdType`, `taxIdValue`, `countryCode`, `corporateEmail`, `corporatePhone`,
`defaultCurrency: "USD"`, `status: ACTIVE | INACTIVE`. Tax type/value are paired.
Country is uppercase ISO alpha-2; phone uses E.164. Organization creation is
administrative provisioning, not a public Client create endpoint.

**Facility value:** `schemaVersion`, `code`, `name`, `facilityType`
(`SHIPPER_SITE | WAREHOUSE | DISTRIBUTION_CENTER | OTHER`), `location`, `active`,
`accessRestrictions`, `operatingHours`. Location has `label` (address),
`countryCode`, nullable `region`, `city`, nullable `lat` and `lng`; coordinates
are paired, latitude -90..90 and longitude -180..180. Restrictions are an array
of `{ code, description, evidenceReference: string | null }`.
Facility is a Client pickup/delivery address, never a CarrierDepot or coverage proof.

**Cargo profile value:** `schemaVersion`, `name`, `categoryId`, `typicalUnits`,
`requirements`, `preferredEquipment`, `active`. Each unit has `packageType`,
positive integer `quantity`, positive `weightPerUnitKg`, `volumePerUnitM3`,
`dimensionsCm: { length, width, height }`, `indivisible`, `stackable`, positive
integer `unitsPerPackage`. Category IDs come from the persisted category catalog.

**Preference value:** `schemaVersion`, nullable `objective`,
`maximumWaitMinutes`, `preferredMode`, `preferredEquipment`, `usualBudget`,
`validUntil`. Budget is `{ amount: positiveNumber, currency: "USD" }`.
Preference/profile values do not certify availability, price or a booking.

**Intake options:** active authorized `facilities`, persisted `cargoCategories`,
`equipmentOptions`, `packagingOptions`, `requirementOptions`. Facility choices
currently expose `id`, `code`, `label` (name), `countryCode`, `region`, `city`,
`lat`, `lng`; they do not expose address, hours, timezone or restrictions. Consumers
needing these read Facility detail. Category guidance comes from persisted data.
Selectors are capture vocabulary, not confirmed Carrier capabilities.

## IANA operating hours

- `operatingHours: null` means unknown, never open 24/7.
- Known hours: `{ timezone: "America/Lima", weekly: [{ dayOfWeek: 1,
  opensAt: "08:00", closesAt: "17:00" }] }`. Monday = 1, Sunday = 7;
  up to 28 intervals, no overlaps on the same weekday. An empty weekly array
  explicitly has no open interval, unlike unknown hours.
- Hours are local wall-clock times in the Facility IANA zone, not UTC offsets or
  browser timezone. Overnight hours are split at midnight. The base disallows
  `24:00`; the HAC-51 reusable schema supports `24:00` only as a closing boundary.
  Porting that support requires a new additive migration later than
  `20261019030218`, never modification of an applied migration.
- Reuse the narrow scheduling schema from `codex/v2-client-order-contracts`
  via `git show`; preserve the HAC-51 worktree and its commits. No order contracts
  or facilityChecks are implicitly ported. DST ambiguity and date-specific
  eligibility remain with the request/planning owner, not inferred by this editor.

## Stable consumer IDs reserved for H3

These are a deterministic allocation, not a claim that the seed is already loaded.
The machine-readable source will be `supabase/scenarios/v2-client-base/manifest.json`.

| Kind | UUID allocation | Consumer use |
| --- | --- | --- |
| Organization | `52000000-0000-4000-8000-000000000001` | Synthetic Pacific Produce (Peru), default Client account |
| Organization | `52000000-0000-4000-8000-000000000002` | Synthetic Altiplano Supply (Bolivia), isolation control |
| Organization | `52000000-0000-4000-8000-000000000003` | Synthetic Southern Distribution (Chile) |
| Facilities | `52010000-0000-4000-8000-000000000001` through `...000008` | 3 Peru, 3 Bolivia, 2 Chile; exact addresses/zones in manifest |
| Members | `52020000-0000-4000-8000-000000000001` through `...000003` | Active synthetic owners, linked by local provisioning |
| Cargo profiles | `52040000-0000-4000-8000-000000000001` through `...000003` | One reusable profile per organization |
| Preferences | `52050000-0000-4000-8000-000000000001` through `...000003` | One preference per organization |

Scenario clock: `2026-10-19T12:00:00Z`. No V1 ACME/FR-1042/Andes/Inca/Pacific
carrier data. Reuse the existing `v2-carrier-fleet-80` catalog when commercial
data is needed; HAC-54 supplies its own 12 requests in a separate file.

## Gaps and ownership

| Gap at inspected base | Delivery/owner |
| --- | --- |
| Connected identity loses to visual preview in Client layout | HAC-52 identity boundary; reuse existing shell props |
| No Client local account provisioning/runbook | HAC-52 loopback-only bank and private access file outside Git |
| Facility list has no detail/create/edit; organization is read-only | HAC-52 connected pages/forms with native domain commands |
| Cargo profiles read-only; preferences have no connected editor | HAC-52 scoped editors and pagination |
| Schedule closing at midnight differs from HAC-51 | HAC-52 narrow schema port + additive SQL validator migration |
| Assistant needs authorized organization/Facility/profile context | HAC-52 adapter with confirmation on mutation; Juan wires assistant |
| Shared sidebar/filter/control design | HAC-53 Juan; request integration via this contract; do not edit his files |
| Operations/offers/bookings and commercial seed | HAC-54 Luis; no edits by HAC-52 |
| Carrier agenda/Depots | HAC-50; no edits by HAC-52 |

The H0 publication requires no hosted migration or configuration. H1–H3 must
append exact local commands, new migration filenames, test evidence and deployment
prerequisites. Hosted rollout remains an integrator action after separate approval.
Linear issue contents could not yet be read through a connected integration;
the branch and current plan above come from the user's explicit task request.
