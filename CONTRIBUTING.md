# Contributing

Use `main` as the active base and a `codex/*` or team-approved issue branch. Open a reviewed pull request; do not push directly to main or rewrite shared history. Follow [AGENTS.md](AGENTS.md) for team issue ownership, domain invariants and merge/deployment authorization.

Read [setup](docs/SETUP.md), [architecture](docs/ARCHITECTURE.md), [testing](docs/TESTING.md) and the relevant [domain contract](docs/v2-amazon/contracts/README.md). Run focused tests and the applicable release/SQL gate. Keep synthetic data in scenario directories and preserve applied migration hashes. Do not introduce hardcoded carriers or infer capacity from missing data.

Keep documentation aligned with the changed runtime. Prefer current product/setup/API guides over a new dated progress report. Evidence belongs with the test/tool claim it supports. Never commit secrets or private access files. Public bug reports should contain sanitized reproduction, expected/actual behavior and relevant source revision; report vulnerabilities using [the security guide](SECURITY.md).

Opening a PR does not authorize a merge, hosted migration, scenario load, IAM change or deployment configuration change. The existing production pipeline can deploy an authorized main merge; reviewers should account for that effect.
