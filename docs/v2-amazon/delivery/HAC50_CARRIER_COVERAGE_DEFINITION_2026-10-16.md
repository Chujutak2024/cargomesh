# HAC-50 — Carrier service coverage definition

Date: 2026-10-16. Owner: Cristhian. Existing branch: `codex/unified-workspaces-demo-boundary`.

## 1. Authorized increment

This increment registers the two existing HAC-50 migrations and defines Carrier coverage using the existing V2 catalog. It does not create a seed, compute road routes, change application behavior or activate a hosted migration. Runtime behavior is described separately from the target acceptance rules below.

The user explicitly separated the next deliveries:

1. This increment: migration inventory and coverage definition.
2. Independent delivery: the synthetic Carrier/fleet scenario.
3. Independent delivery: road routing and its returned geometry.
4. Coordinated delivery with HAC-51: Client discovery, commercial integration and visualization contracts.

No PR or merge to `main` is authorized. No Vercel configuration change is authorized. The published Git rules and the local freeze differ; the user's 16 October instruction governs this increment. Reuse the registered branch and leave the future integration target undecided until agreed.

## 2. Separate ownership and entities

| Entity | Owner and purpose | Does not establish |
| --- | --- | --- |
| Client Facility | Client organization; a warehouse, store or other pickup/delivery address, with its own hours and restrictions | Carrier coverage or Carrier resource availability |
| Carrier Depot | Carrier; an operating base with resources, hours, appointments and associated assets | Coverage of its city, region or country; current vehicle presence |
| Carrier Service | Carrier; a specific transport product and its operational/cargo limits | Availability for every date or every vehicle |
| Service Area | One service; a PICKUP or DELIVERY inclusion/exclusion with geography and evidence | A connection to every other area |
| Service Lane | One service; an explicitly directed connection between a pickup area and a delivery area | The reverse connection, a road polyline or border permission |

A Client requests transport from address A to address B. Those addresses may reference its Facilities or use authorized explicit locations. A candidate Carrier can collect and deliver directly at those locations without owning a Depot at either end. Depot checks apply only to actual planned depot activities.

Carrier retains depot, fleet, crew, calendar and operational checks. HAC-51 retains Client Facilities, request dates, flexibility, Client-authorized discovery and the minimized/versioned request projection. Discovery composes Carrier rules; it must not manufacture Carrier membership or expose private fleet calendars to Client.

## 3. Persistence mapping — reuse current contracts

Source: `cargomesh/src/shared/schemas/v2/catalog.ts`, `CatalogInputsV2`, `CatalogScopeV2Schema` and `CatalogRecordV2Schema`.

| Concern | Existing representation |
| --- | --- |
| Ownership | Record `carrierId`; area/lane `serviceId`; service belongs to Carrier |
| Service | `mode`, `serviceClass`, `status`, cargo categories, weight/volume, temperature and requirements |
| Area purpose | `role: PICKUP / DELIVERY`, `inclusion: INCLUDE / EXCLUDE` |
| Geography | `geography.granularity`, `countryCode`, `region`, `city`, `postalCode`, optional `geometry` |
| Coverage source | `source: OWN / PARTNER`, `partnerId` |
| Area/lane evidence | `evidence`, `verifiedAt`, `validFrom`, `validUntil`, `active` |
| Lane | `pickupAreaId`, `deliveryAreaId`, `kind: DIRECT / WITHIN_AREA`, `mode` |
| Border constraints | `borderReviewRequired`, `crossBorderProhibited`, `crossBorderProhibitionReference` |
| Transit estimate | `plannedTransitMinutes`, `transitProvenanceStatus`; absent duration remains UNKNOWN |
| Partner agreement | Stable partner record ID, optional platform `partnerCarrierRef`, registered identity, agreement dates, status and coverage evidence |
| Revisions | Record `version`, `createdAt`, `updatedAt`; existing expected-version/idempotency mutation contracts |

Do not add a second `coverageRadius`, global country allowlist or UI-only geographic decision. `registeredCountry` is the Carrier's registration country, not its service territory. Do not place undeclared keys into strict catalog values.

The first independent scenario should use canonical CITY areas where the intended scope really is the named city. COUNTRY or REGION must be explicit product scope, never shorthand for a smaller territory. A narrower district, postal or polygon scope remains pending until its data and evaluator are implemented and shared consistently.

Use the same canonical country/region/city representation as the resolved request. Current administrative matching uses exact values; free-form spelling, translated city names or map coordinates alone do not prove a match. An unresolved address remains unknown instead of being assigned to the nearest covered city.

## 4. Countries and directional coverage

Countries shown in a coverage summary are derived from the referenced, active service areas and lanes, scoped to the relevant dates. Show pickup and delivery countries separately. Describe them as countries containing published service zones, not full-country coverage or operating permits.

For each service:

1. Publish PICKUP and DELIVERY areas separately, with independent exclusions and validity.
2. Connect permitted endpoints with directed lanes of the same service and mode.
3. Publish the reverse as another lane if intended; never infer it.
4. A local WITHIN_AREA service uses two different area IDs with identical geography and opposite roles. The current schema rejects equal endpoint IDs; SQL verifies equal geography for WITHIN_AREA.
5. A chain A→B and B→C is not a direct A→C lane. A later planner may construct a compatible multi-leg plan only with the required published corridors, timing and transfer evidence.
6. Known matching exclusions take precedence over inclusions for the relevant activity window. Incomplete or unsupported geographic evidence prevents a positive decision.
7. International lanes retain pending border requirements until verified. A published prohibition is a negative decision. A false review flag alone cannot establish border permission.

Different products of the same Carrier can have different coverage. A refrigerated service does not inherit the general-freight service's areas or lanes automatically. Equipment constrains cargo compatibility; it does not grant geography.

## 5. Coverage-only decision versus full eligibility

Target coverage evidence identifies the service, matching pickup/delivery areas, directed lane or explicit leg chain, record versions, source and activity windows. These are contract requirements for subsequent discovery integration, not a new endpoint implemented here.

- Verified, matching, current area/lane evidence can pass the coverage checks.
- A known exclusion, published prohibition or absent directed connection in a sufficiently evidenced evaluated catalog can reject coverage, with a reason.
- Missing, expired, partial or unsupported necessary evidence yields unknown. Do not turn an incomplete catalog into proof of no coverage.
- No candidates is a valid result. Do not fall back to another Carrier's territory or to a demo catalog.

Passing coverage does not prove compatible cargo, vehicle/driver availability, service price, border authorization, road access or a capacity reservation. An operational assessment also does not prove coverage. Preserve these dimensions separately until the shared Client plan evaluator composes them.

The current ROAD domain evaluator already has per-dimension evidence, including pickup/delivery/lane results, but its candidate status also evaluates cargo, capacity, temporal and other requirements. Do not relabel its aggregate as a new coverage-only API.

## 6. Planning matrix for the later independent scenario

The identifiers below are planning labels, not fixed runtime providers, inserted rows or UUIDs. All coverage will be synthetic scenario evidence. Exact administrative values, per-service products, validity and evidence must be pinned in the scenario delivery before persistence. The application continues to accept 0..N Carriers.

| Planning label | Countries containing planned zones | Initial directed connections |
| --- | --- | --- |
| C01 | PE | Lima pickup area → Lima delivery area, WITHIN_AREA |
| C02 | US | Los Angeles → San Diego |
| C03 | US | Dallas → Austin; Austin → Houston |
| C04 | PE | Chachapoyas → Chiclayo; Chiclayo → Lima |
| C05 | GT, SV | Guatemala City → San Salvador; border review pending |
| C06 | PE, CL | Tacna → Arica, international review pending |
| C07 | CL | Santiago → Valparaíso |
| C08 | CR, PA | San Jose → Panama City; border review pending |
| C09 | ES | Madrid → Zaragoza; Zaragoza → Barcelona |
| C10 | JP | Tokyo → Yokohama; Yokohama → Chiba |

Only these explicit directions are planned in this first matrix. A return journey requires its own publication. The names above are human-readable; the future scenario must pin canonical location values instead of matching translated labels. This matrix does not establish whole-country coverage, fleet counts, driving times, border permits or route geometry.

## 7. Implemented behavior and integration gaps

| Area | Current Carrier branch | Next owner/delivery |
| --- | --- | --- |
| Services/areas/directed lanes | Native schemas, scoped catalog commands and database constraints exist | Scenario materializes data later |
| Administrative matching | ROAD evaluator supports country/region/city matching; no fuzzy location normalization | Canonical address contract with Client |
| Geometry | Schemas can store polygon/point geometry; evaluation remains unknown for unsupported geometry | Separate geographic evaluator, not hand-drawn road routing |
| Postal matching | TS domain includes matching; current canonical request lacks a postal field and SQL parity must not be assumed | HAC-51/shared contract; not enabled by this definition |
| Partner coverage | Stable partner relation exists; ACTIVE alone is insufficient | HAC-51 A1 parity is locally reported, not present in this Carrier branch |
| Depot/crew availability | Carrier operational services exist; separate resource/activity windows | Client C3 composes via an authorized application boundary |
| Complete evidence/version projection | Catalog records carry versions; ROAD candidate DTO is not a complete versioned discovery snapshot | HAC-51 C3 contract, with Carrier review |
| Routes and cross-border execution | Coverage lanes are commercial declarations; no route geometry generated here | Independent road-routing delivery |

Client endpoints keep organization/request authorization. Carrier endpoints keep Carrier authorization. Sharing pure policies or an application port does not grant access to private catalogs; authorization must be enforced at the composed repository boundary.

## 8. Migration inventory and order

Register only the existing, unchanged SQL files:

| Version | Migration | Declared prerequisites |
| --- | --- | --- |
| 20261015055541 | HAC-50 depot operations | 20261010225539 Carrier identity/catalog scope and its existing dependency chain |
| 20261015122904 | HAC-50 booking/offer projection | 20261007083000 model associations and 20261008235540 Carrier workflow |

Both follow the existing inventory by timestamp. Jean's reported `20261016000100_hac51_coverage_and_request_time.sql` follows both; it remains in his branch and is not copied into this one. C6 must compose the latest `private.workflow_record` and preserve factual offer/decision and grouped-leg references.

Keep HAC-50 pgTAP number 35. HAC-51 can allocate 36 onward after checking the integrated inventory; the number itself does not order migrations. The two new manifest entries do not apply migrations or certify hosted activation.

## 9. Acceptance cases for subsequent integration

1. Depot in Lima with no published area/lane does not establish coverage.
2. A registered, evidenced partner can serve a supported zone without a Carrier-owned Depot; capacity is checked separately.
3. A→B does not imply B→A.
4. Matching exclusion overrides inclusion during its overlapping activity window.
5. Local coverage uses distinct pickup/delivery IDs with the same geography.
6. General and refrigerated services have independent geographic publications.
7. Tacna→Arica remains conditional/unknown with missing border evidence, or negative with a verified prohibition.
8. A→B→C requires a real multi-leg plan; no direct connection is synthesized.
9. Missing/expired/partial evidence and unsupported geometry remain unknown.
10. Facility ownership/hours and Depot resources remain separate; direct pickup does not require a Carrier Depot at that address.
11. Coverage can pass while the required vehicle/driver is occupied; this must not become an available plan.
12. Request revisions, coverage revisions and date changes invalidate old decisions; commitment revalidates capacity.

Cases describe the target shared contract. Existing regression results and remaining gaps are recorded separately; this document does not claim all twelve cases were executed against a new integrated system.

## 10. Verification and friction record

The published Carrier inventory contained 30 SQL files but only 28 manifest entries. The existing manifest gate reproduced `Every V2 migration must be manifested` before the correction. After registering the two HAC-50 entries, the same gate passed. Existing entries were preserved, and both SQL files retained their exact byte hashes. No database was changed.

The existing ROAD policy, request-scoped evaluation and catalog service suites passed: 43 tests across four suites. These regressions verify current behavior only; they do not certify the future scenario, route algorithm, HAC-51 implementation or an integrated Client/Carrier flow. `git diff --check` passed. The five pre-existing CSS edits remained outside this increment.

Reproduction from the repository root:

```text
python supabase-v2/gate.py manifest --evidence-dir <local-evidence-directory>
```

From `cargomesh/`:

```text
node --conditions=react-server --import tsx --test src/server/modules/road-serviceability/domain/evaluate-road.test.ts src/server/modules/road-serviceability/application/evaluate-v2-road.test.ts src/server/modules/catalog/application/catalog-service.test.ts
```

Local evidence: `salida/carrier-coverage-20261016/MANIFEST_BEFORE.txt`, `MANIFEST_AFTER.txt`, `MANIFEST_RESULT.json` and `COVERAGE_REGRESSION.txt`. Changes remain local on the existing Carrier branch. No commit, push, PR, merge, hosted migration or deployment was performed in this increment.

## References

- [Coverage and serviceability](../contracts/CARRIER_COVERAGE_AND_SERVICEABILITY.md)
- [Transport plans and fleet](../contracts/TRANSPORT_PLANS_AND_FLEET.md)
- [Operational assessment handoff](./HAC50_OPERATIONAL_ASSESSMENT_HANDOFF_2026-10-15.md)
- [Prior broader plan](./HAC50_COVERAGE_SITES_CARGO_PLAN_2026-10-15.md) — this increment supersedes its execution order, not its independently pending scene/cargo proposals.


### Geographical revision — 16 October

The user requested broader representation. C02/C03 now cover selected US city pairs and C05/C08 selected Central American pairs; no whole-country coverage is inferred. The independent scenario is now generated and locally verified; see HAC50_CARRIER_FLEET_SCENARIO_2026-10-16.md. Its native road travel times remain unknown. The prior planning matrix has been updated above; frontend presentation remains a separate delivery.
