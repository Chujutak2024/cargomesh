# HAC-44 F-02 coverage delivery — CP-2

This delivery preserves the exact harness measured in CP-1c and publishes its reviewed evidence. F-02 remains partial. No production behavior changes are included.

## Provenance and execution

- Product/base SHA: `9d0c3ee32179f00242a6961b90116293a1bc6d0e`.
- Pre-delivery branch HEAD: `68f8b797de0199bc5af9b753063aca648cd706b5`, the local merge of `origin/main` over CP-1b `1d9ab9920f25d004d199762054f1523c61d0fdb2`.
- Branch: `codex/v2-qa-f02-coverage`; PR target: `main`.
- CP-2 preflight: expected branch/HEAD and 18 changed paths, all under `scripts/qa/hac44/`; all 96/96 current harness source hashes match `INTEGRAL_RESULT.json`.
- All 96/96 staged harness blobs also match those SHA-256 values byte for byte. Preserving the measured Windows line endings adds 69 line-ending-only paths to the Git diff; the logical CP-1c delta remains exactly 18 paths. Per-command Git settings preserve these bytes without changing repository/global configuration or the measured working files.
- Supplemental `git diff --cached --check` returned exit 2: all 14,846 diagnostics were carriage returns from the preserved CRLF lines, with zero other trailing-space/tab diagnostics. This result is retained as a delivery friction; no whitespace policy or release gate was relaxed, and the measured harness was not edited.
- `git fetch origin` confirmed the same main SHA; no new synchronization merge was needed.
- UML07 inventory Git/hash baseline: `104b126cc17565b57064fca0c6a8efd5cf43a076c1cb041355e5174cbe68dc88`.

Each measured integral used Python 3.12: `python -X utf8 scripts/qa/hac44/run.py all`, with `HAC44_SOURCE_SHA=9d0c3ee32179f00242a6961b90116293a1bc6d0e`, `HAC44_PORT_BASE=62000`, `HAC44_CYCLES=1`, `HAC44_CP1C=1`, and an independent owned project prefix/evidence directory per attempt. pnpm was 11.25.0; 29 direct dependencies matched the frozen lock. Installation used a temporary external npmrc and Node + Norton CA bundle with strict SSL enabled; global configuration was unchanged.

## Measured cohort

| Type | Total | Measured | Partial | Blocked | Outdated documentation |
| --- | ---: | ---: | ---: | ---: | ---: |
| Attribute | 97 | 90 | 0 | 0 | 7 |
| Relationship | 37 | 5 | 21 | 11 | 0 |
| Class | 55 | 0 | 55 | 0 | 0 |
| UML method | 144 | 10 | 9 | 125 | 0 |

The original denominator remains 189. `coverage-198.csv` adds nine separately reconciled historical documentary rows: three McpAccountLink attributes, five UML08 relationships, and the still-partial McpAccountLink class. They do not rewrite the original cohort or historical evidence. There are 229 pending entries: 7 attributes, 32 relationships, 56 classes (including reconciled McpAccountLink), and 134 methods.

`method-mapping-144.csv` maps every signature (144/144) to a verified native symbol, runtime chain, source/consumer citations, observable, positive and frontier. Mapping does not certify an independent UML signature or unexecuted semantics. The nine assignment-policy methods remain partial because isolated rule calls lack a measured native consumer pair in this cut. The attribution observation belongs to HAC-40; the observed open PR #121 was not applied.

## Cycles, cleanup and suite 22

RUN_1/RUN_2/RUN_3/RUN_4 exited 1/1/1/2 respectively and remain failed/blocked attempts. RUN_2 stopped before bank creation after an exclusive port bind failed; no unrelated process was stopped. RUN_5 and RUN_6 both exited 0, and all 342/342 states match (189 cohort + 144 methods + 9 reconciled). `cycles-and-cleanup.json` preserves per-table business and operational Auth counts. Both final runs reached zero in every category before owned banks were stopped; owned containers remaining: 0.

Suite 22 passed on the original source (43/43) and reinforced source (46/46), with actual TAP, source hashes and authenticated boundary traces preserved externally and summarized in `suite-22.json`. D-04 was not reproduced at the original final boundary; reinforced source adds initial native coverage. Claims were issued/verified by real local Auth in memory, and the transport required ALL IMMEDIATE before RESET ROLE. That instrumentation is not proof that the original suite already had an initial native assertion.

## UML08, native revision and scenario equivalences

Relations 35/40/73/83/90 were measured against UML08 at both ends: exactly one plan source even with UNKNOWN availability; representative offerId plus disjoint offerIds coverage; mandatory embedded recipient/pickup contacts and native GET belonging; zero/many bookings per decision and duplicate rejection by `one_booking_per_offer_decision`. Nullable `asset_status_events.parent_id`, `carrier_opportunities.plan_id` and `v2_carrier_offers.carrier_id` were tested through native commands. Physical FK counts do not certify command ownership or minimum child counts.

HAR-06 is resolved as a QA fixture: coherent REVISE on a native DRAFT changes persisted quantities/totals/version, while prior route/plan/offer snapshots remain identical. Published/PENDING rejection is a separate valid frontier, not a functional defect. McpAccountLink preserves historical NULL reads and concrete provider/externalSubjectRef/verifiedAt after verified PKCE consent, while its methods remain pending.

All seven RouteSimulationScenario attributes remain outdated documentation, never PASS. Verified equivalents: package -> id, baseClock -> clock, provenance -> source, cases -> expectedOutcome, and stableSeedKeys/seed.sql -> seed. No scenario-level equivalent was verified for label or networkVersion after searching V2 manifests, loaders and nested keys. No production CRUD was created.

## Pending work and owners

`pending-classified-229.csv` records every cause, owner and retest criterion. HAC-44 / Jean Paul owns 87 cohort measurements and 134 signature mappings/fixtures; HAC-40 / Cristhian owns seven scenario documentary mismatches and the separate attribution observation; HAC-41 / Axel owns the remaining McpAccountLink documentary class entry. Measurement gaps are not assigned as functional backend defects. `defects-and-observations.csv` contains HAR-06, the attribution observation and D-04; reproduced functional defects: 0.

## Artifacts and limits

The class (57), attribute (397), relationship (93) and endpoint (225) matrices are compact English projections of the matrices regenerated in CP-1c RUN_6. Their source states are preserved and F-02 fields identify this measured cohort. Cells outside the cohort retain their source cut status, not a new certification. Row-level coverage, reconciliation, repeatability, method mapping, UML08 controls, scenario equivalences and source/harness SHA-256 manifests accompany them. Evidence references are paths relative to the external CP-1c package; source code citations are repository-relative. Full evidence, raw logs, backups and credentials are not copied into this repository.

CP-2 verification uses `python -X utf8 scripts/qa/hac44/tests.py` from the repository root and `pnpm release:verify` from `cargomesh/`, with pnpm 11.25.0. Actual delivery results and CI are recorded in the PR; prior integral typecheck/test:release results do not substitute for CP-2 release:verify.

No backend, migration, CI or scenario source changes; no hosted Supabase writes or db push; no remote database mutation tools; no use/mutation of unrelated Docker banks or reserved ports 48000–48999; no PR merge, direct main push, force push, rebase, published-history rewrite, Linear state change or F-02 closure. Manual C-01/C-02/C-03, hosted/live certification, Vercel configuration and Alexa+ live validation were not performed. `test:mcp:local` is not reported green. Full evidence and the original checkout remain preserved externally.

Part of HAC-44
