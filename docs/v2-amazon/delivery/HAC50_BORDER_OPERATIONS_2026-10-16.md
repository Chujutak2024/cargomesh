# HAC-50 — border operations local delivery

Branch: `codex/unified-workspaces-demo-boundary`; published base `f5cd589c30899e2f9fa7390b39c4b8d7e933dc08`. Authorized scope: Carrier border review before road routing, then frontend; GPS research/documentation only. No main integration or hosted activation.

## Delivered

- Additive migration `20261016165018_hac50_border_operations.sql`, recorded in the V2 manifest with its SHA-256 and dependency on the existing depot/Carrier identity surface.
- Strict Zod contracts, pure document policy, application service, authenticated Supabase repository, and seven Carrier HTTP operations.
- Current catalog version binding, immutable country pair/operation context, checklist evidence and whole-window validity, internal review, separate passage events, version history, scoped roles, idempotency and serialized mutations.
- Simulation remains simulation. Carrier reports remain attestations. All assessments keep travel authorization UNKNOWN. Existing ROAD/global commercial eligibility is not weakened.

Contract: [Border review and passage](../contracts/BORDER_REVIEW_AND_PASSAGE.md).
Future GPS: [Vehicle tracking plan](./HAC50_GPS_AND_POSITION_PROVENANCE_PLAN_2026-10-16.md).

## Reproduce locally

Requires the already installed Supabase Docker stack `supabase_db_hac45-carrier-local`, existing schema-only source bank, Python, Node and current app dependencies. The runner creates a new named local database, never resets/drops one or changes hosted configuration.

From `cargomesh/`:

```powershell
python ../scripts/qa/hac50-border/local.py --database hac50_scenario_border_recheck --evidence-dir '<private local evidence directory>'
node --conditions=react-server --import tsx --test src/server/modules/border-operations/domain/border-policy.test.ts src/server/modules/border-operations/application/border-service.test.ts src/server/hono/routes/carrier-borders.test.ts
node node_modules/typescript/bin/tsc --noEmit --incremental false
node scripts/check-architecture.mjs
```

The standalone pgTAP file creates 13 minimal rollback-only fixtures; it does not require the 80-vehicle scenario to have been loaded. The runner then verifies coexistence with that scenario and races using independent PostgreSQL connections. Exact temporary race rows are removed only from the marked disposable bank. No source bank, hosted database, permissions or triggers are weakened.

## Verification

- 61 standalone pgTAP assertions: transitions, missing/expired/partial/future evidence, immutable provenance, roles, foreign scope, direct-write/anonymous denial, revisions/receipts/history and catalog changes.
- 27 new Node assertions/tests across pure policy, application and HTTP transport.
- Two real PostgreSQL races: same-key concurrent create yields one record and one replay; concurrent revisions yield one winner and one `STALE_DRAFT`.
- Three native PostgreSQL records parsed through the actual Zod schema, comparing SQL/TypeScript document readiness: complete, missing and expired evidence.
- Existing 10/16/80/80 scenario rechecked independently: 121 assertions, native projections/window decisions and media paths, without creating road geometry or physical telemetry.
- Types, architecture and manifest gates: verified separately in local evidence.

HTTP tests inject identity/repository to isolate transport; database identity and tenant isolation are exercised by pgTAP. This is not a browser/hosted end-to-end certification. Local evidence root: `salida/carrier-border-20261016/`, final fresh-bank runner output under `final-verification/`.

## Frontend handoff — next increment

Reuse the Carrier context and English UI. Display separate Document review and Border passage timelines. Show required documents, missing/expired reasons, reported source/time, catalog changes and authority-unknown state. Permit ADMIN/DISPATCHER actions; OPERATOR reads only. Preserve versions and idempotency keys on retries, distinguish 409 conflicts, and show 503 migration missing without a demo fallback.

Do not move Three.js trucks or automatically approve review when a panel opens. A hold, release and crossing require explicit events. No GPS position is created by these commands. Publish a minimal authorized projection with Jean before exposing Carrier evidence to Client.

## Remaining

- Hosted activation of this new migration needs its own specific authorization and correct project connection; none performed.
- Frontend mounting, browser E2E and actual local demo environment wiring are pending.
- Real Google road geometry and provider-verified route/checkpoint bindings are the next separate step. The existing returned-alternatives selector does not prove a global road optimum or truck legality.
- Current crossings cover explicit endpoint-country lanes. Intermediate/transit-country detection, official country-specific rules, verified authority adapters, document upload storage, incident/delay impacts on commitments, Client recovery and full pagination are future increments.
- GPS integration remains a researched future plan.
- Test number 36 is owned by this Carrier increment; coordinate numbering with HAC-51 before branch integration. No shared Client schema or `private.workflow_record` replacement in this cut.
