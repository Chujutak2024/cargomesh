# RouteCondition fixture and map projection — HAC-13 / HAC-15

**SUPUESTO (HAC-13): pending confirmation by the Tech Lead in HAC-27.**
The user authorized this fixture shape and projection on 2026-10-02. It implements
the six UML attributes without claiming that HAC-27 already defines a JSON schema.
The fixture is synthetic display data, with no real traffic incidents or feed.

Contract references at commit `3cf966fa95e0ee315454b1950815b229497a8c7e` (PR #91):

- [HAC-27 dictionary, section 24](https://github.com/Chujutak2024/cargomesh/blob/3cf966fa95e0ee315454b1950815b229497a8c7e/docs/v2-amazon/delivery/HAC27_UML_ATTRIBUTE_DICTIONARY_2026-10-02.md#L660).
- [Persistence decision and map props](https://github.com/Chujutak2024/cargomesh/blob/3cf966fa95e0ee315454b1950815b229497a8c7e/docs/v2-amazon/delivery/SPRINT2_HAC27_CLASS_DB_API_CONTRACT.md#L719).
- [Executable condition projection](https://github.com/Chujutak2024/cargomesh/blob/3cf966fa95e0ee315454b1950815b229497a8c7e/cargomesh/src/shared/schemas/v2/serviceability.ts#L23).

## Fixture and fixed controls

[fixtures/route-conditions.json](./fixtures/route-conditions.json) is a file fixture.
It is outside migrations and is never inserted into a database. Its identity and
`association` sit outside the `condition` domain object. `expectedProjection` is
the expected `legs[].conditions` array at the fixed reference
`2026-10-05T12:00:00Z`; it is an independent test oracle for HAC-15.

| Case ID (c2400000 prefix) | Existing lane | Domain condition | Expected active array |
|---|---|---|---|
| `c2400000-0000-4000-8000-000000000001` | `c2380000-0000-4000-8000-000000000001` | RESTRICTION at the Lima pickup facility; 2026-10-01 to 2026-10-10 UTC | One INFO / SIMULATED item |
| `c2400000-0000-4000-8000-000000000002` | Same lane | DELAY at the Arequipa delivery facility; 2026-09-25 to 2026-10-01 UTC | Empty: expired |
| `c2400000-0000-4000-8000-000000000003` | `c23c0000-0000-4000-8000-000000000001` | null: no condition | Empty: absence |

The third ID identifies a scenario test case, not a fake RouteCondition row.
Lanes are separate association keys: sharing endpoint locations does not propagate
a condition from one lane to another. The fixture changes no existing facility,
area, lane or capacity data.

## Domain shape (six attributes)

| Field | Fixture rule |
|---|---|
| kind | CLOSURE, DELAY, HAZARD or RESTRICTION |
| location | CanonicalLocationV2 shape: facilityId, label, countryCode, region, city, lat, lng; matches an existing scenario facility |
| observedAt | Explicit ISO instant; inclusive validity start |
| validUntil | Required for this fixture; exclusive validity end; later than observedAt |
| source | SIMULATED |
| confidence | SIMULATED |

`validUntil` is stricter than the UML's optional field. Unknown region/coordinates
remain null; no coordinates are invented. The location labels and countries/cities
match existing baseline facilities. Time comparisons use the supplied instant,
never today's date. Before observedAt and at/after validUntil, no active projection
is returned. An expired object remains structurally valid evidence for its test.

## Projection for Juan (HAC-15)

Only when an existing lane has a corresponding leg with approved geometry, use
the active fixture's expected projection as the condition-array test contract.

| Domain input | Strict map field |
|---|---|
| kind | code = RC_<KIND>, for example RC_RESTRICTION |
| User-approved display assumption | severity = INFO |
| kind, location.label, observedAt, validUntil | description with [SYNTHETIC] SIMULATED, place name and both exact timestamps; end explicitly exclusive |
| source/confidence = SIMULATED | provenanceStatus = SIMULATED |

The object has exactly four fields: code, severity, description and
provenanceStatus. Show SIMULATED prominently; expose the observedAt/validUntil
text from description in the condition detail/tooltip or accessible text.
Do not add location or validity fields to the strict DTO. Expired/absent conditions
produce no active badge, marker or condition item. A before-start condition is
also inactive. Preserve the condition's synthetic wording.

**Current runtime limitation:** the backend provides `routePreview: null` and
no route legs (`legs: []` where an empty preview is represented). Therefore the
condition is not drawn today. The fixture does not create routePreview, legs,
waypoints, a point, a corridor or a connecting line. Null coordinates cannot become
a map marker. The future geometry must be separately approved; its provenance
must not be upgraded by this fixture. This delivery documents the projection;
it does not implement the frontend, mapper or runtime injection.

No changes to estimatedTransitHours, ETA, eligibility, ranking, capacity, checks
or service coverage are implied by any kind, including DELAY or RESTRICTION.
These are display fixtures, not functional road rules. HAC-29 remains closed.

## Executable validation and gate

From the repository root:

```powershell
python supabase/scenarios/v2-road-baseline/verify_route_conditions.py
$evidence = Join-Path $env:TEMP 'hac13-routecondition-gate'
python supabase-v2/gate.py v2 --evidence-dir $evidence
```

The standalone check uses the existing scenario manifest and request locations as
reference controls. The full V2 gate runs the same check after seed/verify, with
a read-only export of actual local facilities and lanes. Standard-library Python
adds no dependency or CI job; existing pgTAP suites and failure behavior remain.
Use the existing configurable replay ports if Windows excludes the defaults.

Checks cover the valid active fixture, structural validity and fixed expiration
of the expired fixture, lane-scoped absence, inclusive start/exclusive end, exact
domain/projection fields, the three-value documented severity enum, and rejection
of missing source/validity, a non-SIMULATED source/confidence and inverted ranges.
Every negative or empty-result test executes its active positive control in the
same test. A failed control is reported BLOCKED and fails the process.

No RouteCondition DB cleanup is needed: no rows are inserted. The full gate still
loads the existing baseline using psql local_only=1, backs up outside Git, audits
foreign keys and cleans the existing scenario by explicit IDs.

## Identity reservation and low observation

c230–c23c already belong to the baseline; c23d–c23f are HAC-12 reservations.
Before creation, these read-only searches returned exit 1 (no matches):

```powershell
git grep -n -i c240 origin/feat/cycle-2-integration
git grep -n -i c240 3cf966fa95e0ee315454b1950815b229497a8c7e
```

The fetched base was `f2a8e3eb441e7bdd35718e7c69192256c6aaf553`.
This delivery reserves c2400000 ...000001 through ...000003 for file fixtures/cases.
No existing scenario IDs or HAC-12 reservations are changed.

Low observation for HAC-27/HAC-12: the mirror restricts severity to
INFO | WARNING | CRITICAL, while the current Zod accepts any nonempty string.
This validator enforces the documented enum and this fixture uses INFO, valid
under both. No application schema or other owner's code is repaired here.
