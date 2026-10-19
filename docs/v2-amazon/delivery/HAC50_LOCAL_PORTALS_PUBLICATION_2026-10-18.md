# HAC-50 — Local portal and Carrier integration publication

Date: 2026-10-18 (America/Lima). Existing branch: `codex/unified-workspaces-demo-boundary`. User explicitly requested push. The remote voice update `4fd892f` was fast-forwarded before this publication. No branch or PR targeting main is created.

This checkpoint publishes the accumulated dependencies required by the delivered local frontend: Juan presentation restored over connected data, canonical portal navigation and explicit local Client test session, Carrier fleet/sites/commercial/orders/pipeline views, point/road planning and border review, scenario/runtime helpers and regular vehicle-driver associations. It includes the completed shared-header/Commercial/Orders-Incidents/Sites presentation from the concurrent frontend work, preserving the same application composition.

Regular drivers and the 80-vehicle scenario are activated only in the isolated local bank; no hosted database migration is performed by this push. Environment secrets and runtime private configuration stay outside Git. Condition remains Not assessed without inspection evidence. Illustrative scenes, test data and live provider geometry retain their source labels. Local development helpers do not create a production login bypass.

## Fresh publication checks

- Release test command discovered from package.json and executed directly: 402 passed, 0 failed.
- Next production build: exit 0; compilation and type/lint checks completed.
- Staged diff whitespace check: passed after seven metadata-only corrections.
- Exact staged blobs scanned for credential patterns and values from private env: no findings.
- Earlier increment evidence: 25 focused TS tests, 21 pgTAP and native API concurrency/scope checks, documented in HAC50_REGULAR_DRIVERS_2026-10-18.md. These are distinct from the fresh release suite, not claimed to be rerun by the push.

pnpm attempted automatic dependency management of a shared node_modules junction and refused it. No dependencies were reinstalled; the package scripts were executed directly with Node. See friction-logs/HAC50_PNPM_SHARED_RUNTIME_2026-10-18.md.

Browser interaction/responsive validation remains unperformed under the current disabled-browser setting and user preference. The full release:verify umbrella, every historical logistics fixture suite and hosted integration gate are not certified by this checkpoint. Publication is not a main merge or production deployment, and does not activate pending environment-specific capabilities.
