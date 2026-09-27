# CargoMesh V2 · HAC-14 client intake and ROAD preview

Status: frontend implementation completed on `feat/fe1-v2-intake-eligibility`; integration remains **in progress** until the shared HAC-12 endpoints and the HAC-15 map component are available on the declared integration base.

Date: 2026-09-27

Owner: Luis (FE-1, client/shipper application)

Entry route: `Dashboard → /freight-request/new`

Declared PR target: `feat/cycle-2-integration`

## 1. Ownership and product boundary

HAC-14 implements the client/shipper intake. It does not redesign the carrier/company portals owned by FE-2 and it does not change the global role architecture.

The connected workflow is deliberately bounded:

1. Load the organization-scoped selector catalog from `GET /api/v2/intake/options`.
2. Keep all four intake steps in local React state. There is no autosave.
3. On the explicit final action, create one request with `POST /api/v2/freight/requests` and an `Idempotency-Key`.
4. Read the created `DRAFT` through `GET /api/v2/freight/requests/:id`.
5. Request ROAD serviceability through `GET /api/v2/freight/requests/:id/serviceability?expectedDraftVersion=...`.

The client does not send `organizationId` as authorization data. Session cookies authenticate the request and the server remains authoritative for tenant membership, facility ownership, canonical coordinates, the returned `draftVersion`, and every serviceability conclusion.

No frontend code computes carrier eligibility, coverage, lane validity, capacity, price, ETA, ranking, offer, or booking. The result area preserves `eligible`, `ineligible`, and `unknown` and displays the contractual boundary `EVALUATION_ONLY_NO_OFFER_OR_BOOKING`.

## 2. HAC-27 selector coverage audit

The team message named `GET /api/v2/intake/options` as the source for the selectors. As of this implementation, that route is not present in `codex/v2-amazon-contracts`, `feat/cycle-2-integration`, or any fetched remote branch. The HAC-27 Linear contract also does not define the response shape for that endpoint. Therefore the client first calls the stated route and falls back only when it is unavailable or malformed.

The fallback is explicit, visible, and contract-scoped:

- `meta.source = HAC-27_LOCAL_CONTRACT_FIXTURE`;
- `meta.provenanceStatus = SIMULATED`;
- the UI shows the failure code (currently expected to be `HTTP_404` on the shared branch);
- creating a DRAFT still requires the real POST; fixture mode never simulates successful persistence or serviceability;
- facility selection never claims route, coverage, capacity, availability, price, or persistence.

The catalog covers every selector currently displayed by HAC-14:

| Selector group | Client field | HAC-27 payload field | Fixture coverage |
| --- | --- | --- | --- |
| Facilities | origin and destination facility | `origin` / `destination` | Lima, Arequipa, and Piura synthetic HAC-23-aligned facilities |
| Cargo categories | cargo taxonomy | `cargoSpecification.categoryCode` | 8 provisional codes |
| Packaging | cargo package type | `cargoSpecification.packaging` and `units[0].packageType` | pallet, box, crate, drum, bulk |
| ROAD equipment | required equipment | `requiredEquipment` | dry van, reefer, flatbed, lowboy |
| Requirements | special handling options | `cargoSpecification.requirements[]` | temperature, seal, fragile, hazardous |

The option parser rejects an API response unless all five groups exist and have the expected minimal shape. This prevents a partially published catalog from silently leaving selectors unusable.

## 3. UI-to-contract mapping

| UI data | HAC-27 request path | Mapping rule and server boundary |
| --- | --- | --- |
| Origin facility | `origin.*` | Selected `facilityId` maps to the option's label/country/region/city/coordinates. The server revalidates tenant ownership and canonical geography. |
| Destination facility | `destination.*` | Same rule; origin and destination must differ. |
| Pickup window | `pickupWindow.startsAt/endsAt` | Local date-time values are validated as an increasing range and serialized to ISO timestamps. |
| Delivery window | `deliveryWindow.startsAt/endsAt` | Must be increasing and start no earlier than pickup-window end. |
| Transport mode | `acceptedModes` | Fixed to `['ROAD']` for the Sprint 2 contract. |
| Equipment | `requiredEquipment` | Required option value; no “no preference” value is invented. |
| Cargo category | `cargoSpecification.categoryCode` | Required option value. |
| Cargo description | `cargoSpecification.description` | Required free text. |
| Packaging | `cargoSpecification.packaging` | Required option value. |
| Total weight and volume | `cargoSpecification.totalWeightKg/totalVolumeM3` | Required positive numbers; no capacity inference. |
| Divisibility | `cargoSpecification.divisible` | Explicit client choice. |
| Requirements | `cargoSpecification.requirements[]` | Checked option values; temperature fields become mandatory only when `TEMP_CONTROLLED` is selected. |
| Temperature | `cargoSpecification.temperatureRange` | `{ minCelsius, maxCelsius }` or `null`; minimum cannot exceed maximum. |
| Cargo unit | `cargoSpecification.units[0]` | Quantity, per-unit weight/volume, dimensions, indivisible, and stackable are sent as one typed unit. |
| Pickup contact | `contacts.pickup` | Name, E.164 phone, and email are validated locally, then revalidated by the API. |
| Recipient contact | `contacts.recipient` | Same rule. |

Fields intentionally not mapped:

- The old prototype `notes` field was removed because the HAC-27 create contract has no equivalent. Mapping it would require guessing.
- The old `NO_PREFERENCE` equipment value was removed because `requiredEquipment` is required and no canonical “no preference” code is published.
- Budget is not requested by the current HAC-14 UI. It is not needed to evaluate the ROAD integration boundary and the UI must not suggest a price or offer flow.
- The option vocabularies are provisional fixture values until the team publishes the canonical `/api/v2/intake/options` response. They are not presented as database truth.

## 4. Screen states and interaction

The route covers:

- empty/local editing;
- selector loading and explicit fixture fallback;
- field and step validation errors;
- create/evaluate loading;
- recoverable API failure with retry;
- persisted `DRAFT` summary;
- zero candidates;
- mixed eligible/unknown candidates;
- ineligible/unknown checks;
- selected candidate synchronized with the typed map boundary;
- dirty local edits after creation, explicitly marked as not autosaved.

The form revalidates the complete draft before entering review and again before the POST. Future steps remain disabled until reached. Errors are linked to fields, announced through a focusable alert summary, and keyboard navigation is supported. The responsive layout has no horizontal overflow at 390 px or 1440 px.

## 5. HAC-15 map handoff

The frontend exposes a pure mapper at:

`cargomesh/src/features/v2-intake/mappers/road-map-props.mapper.ts`

It creates `RoadCandidateMapViewProps` with origin, destination, overall status, nested carrier/service data, compatibility aliases, nullable route preview, selected candidate ID, and selection callback. It preserves `null`, `UNKNOWN`, and empty legs instead of inventing a line between endpoints.

Until FE-2 publishes the actual `<RoadCandidateMapView />`, HAC-14 renders a typed mount boundary. It shows canonical locations and server facts only. The provider-backed map remains HAC-15 ownership and is not claimed as completed here.

## 6. Automated and visual evidence

Executed from `cargomesh/` on 2026-09-27:

| Check | Result |
| --- | --- |
| `pnpm test:v2-intake` | Pass; 24/24 model, options/API client, fixture, state, and map-mapper tests |
| `pnpm typecheck` | Pass; 0 TypeScript errors |
| `pnpm check:architecture` | Pass |
| `pnpm test:release` | Pass; all existing release suites completed with 0 failures |
| `pnpm build` | Pass; `/freight-request/new` compiles as a dynamic route (18.5 kB route bundle) |
| Desktop visual QA | Pass at 1440 px; no horizontal overflow |
| Mobile visual QA | Pass at 390 px; single-column form and summary, no horizontal overflow |
| Keyboard regression | Pass; after clearing a previously valid field and jumping to review, the UI returns to the invalid step and focuses the alert |

Desktop evidence:

![HAC-14 desktop client intake](./evidence/hac-14/desktop-client-intake.png)

Mobile evidence:

![HAC-14 mobile client intake](./evidence/hac-14/mobile-client-intake.png)

Visual-capture note: Supabase Auth was unreachable from the local QA machine. The route guard was removed only in the uncommitted working tree for capture and was restored immediately afterward. The delivered page still calls `requireOperationalRouteAccess()` and no auth fallback is included.

## 7. Dependencies that remain external to HAC-14

- **HAC-12:** the real HAC-27 `POST`, request `GET`, serviceability `GET`, shared executable Zod schemas, and server-side tenant enforcement are not yet published on the integration branch. The existing V1 compatibility adapter is rejected by the client if it does not return the V2 envelope.
- **HAC-15:** the provider-backed `<RoadCandidateMapView />` is not yet published. HAC-14 supplies and tests the integration props/mapper only.
- **Options contract:** the stated `GET /api/v2/intake/options` endpoint is absent. The client is ready to consume it, and the visible fixture fallback makes that absence auditable.

Because these are integration dependencies, HAC-14 must not be described as end-to-end live and must not move to `Done`. The frontend implementation can be reviewed, but final Gate-2 acceptance requires rebasing/integrating the published HAC-12 and HAC-15 work and rerunning the same commands plus a real authenticated flow.

No merge, production deployment, Vercel root-directory change, carrier/company screen refactor, or Linear closure is part of this delivery.
