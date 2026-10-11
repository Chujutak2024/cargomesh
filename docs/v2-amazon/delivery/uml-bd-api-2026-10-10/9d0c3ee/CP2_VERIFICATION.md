# CP-2 delivery verification

Initial CP-2 tested implementation/evidence commit: `d7440aa39ac84926efc9addc08137164f93eeeb0`; verification-record commit: `c8c9a7a845be4777226c11a950f6352439309cae`. Measured product/base SHA: `9d0c3ee32179f00242a6961b90116293a1bc6d0e`. The initial release results below belong to that product cut. The subsequent LF correction changes repository line endings and evidence metadata, plus the explicitly authorized removal of one extra final empty line in `scripts/qa/hac44/f02_native.mts`. Executable source content is preserved.

| Command | Directory | Observed result |
| --- | --- | --- |
| `python -X utf8 scripts/qa/hac44/tests.py` | Repository root | exit 0; Python 144/144, HTTP 23/23 |
| `pnpm --version` | `cargomesh/` | 11.25.0; exit 0 |
| `pnpm release:verify` | `cargomesh/` | exit 0; 72.72 seconds |

The release chain executed typecheck, architecture validation, release tests, V2 conversation tests, V2 chat workflow tests, logistics tests and production build without changing any gate.

| Release stage | Observed result |
| --- | --- |
| Typecheck | PASS |
| Architecture | `Architecture OK: 264 modules; 60 client entry points checked.` |
| `test:release` | 312 passed; 0 failed |
| `test:v2-conversation` | 58 passed; 0 failed |
| `test:v2-chat-workflow` | 12 passed; 0 failed |
| `test:logistics` | 117 passed; 0 failed |
| Build | Next.js 15.5.24; `Compiled successfully in 28.9s`; `Generating static pages (13/13)`; exit 0 |

These counts are recorded observations, not fixed-count acceptance gates. Python and HTTP suites were discovered/executed through the unchanged harness runner. No database bank was needed for CP-2 verification.

The first sandbox attempt could not access its temporary test directories (WinError 5) or resolve the measured node_modules junction (pnpm EPERM). It returned Python exit 1, HTTP exit 0 and release exit 4294963248 before running release stages. Both attempt logs remain external. Repeating the same suites on the authorized host succeeded; the harness, assertions and release gate were not edited. No new dependency installation or TLS workaround was needed in CP-2; the existing measured installation has 29 lockfile-matching direct dependencies, with SSL/global configuration unchanged. `pnpm_config_verify_deps_before_run=false` prevents pnpm 11 from implicitly reinstalling these verified dependencies; it does not waive verification or tests.

Identity proof: 95/96 committed hashes exactly match the measured CP-1c HARNESS_SNAPSHOT content normalized to LF, plus 1/96 with an explicitly authorized EOF-only difference. All 96 original snapshot hashes still match INTEGRAL_RESULT.harnessSha256. Exactly 72 measured files contain CRLF; their committed representation removes only CR from those line endings. The single exception is `scripts/qa/hac44/f02_native.mts`, whose measured LF content ends with two LF bytes. Exactly one final LF byte was removed; every preceding byte is identical. Measured normalized SHA-256: `801361575424f28ce695b1c074eaedeb5bc4ea08adcf070029b801a7d300821a`; committed LF SHA-256: `80e1e811a3227a1707c2d63a82a30b09dfa4e3e0ee0a6ca68d389b01f5267aaf`. For this file only, normalize CRLF to LF, ignore final empty lines and retain one terminating LF: both sides hash to `80e1e811a3227a1707c2d63a82a30b09dfa4e3e0ee0a6ca68d389b01f5267aaf`. `harness-sha256.json` records both exact hashes and this equivalence proof. No other source difference is permitted or observed. The immutable measured snapshot is unchanged. Publication states still match RUN_5/RUN_6 for all 342/342 rows.

The initial delivery incorrectly committed CRLF and treated 14,846 whitespace diagnostics as acceptable. LF is now restored in the index; those line-ending-only repository changes are removed without relaxing any gate. Exact identity initially exposed one existing measured extra empty line at EOF (`f02_native.mts:27`), and the user explicitly authorized only its removal. After that exception, the correction reran `python -X utf8 scripts/qa/hac44/tests.py`: exit 0, Python 144/144 and HTTP 23/23. The exact filtered outputs are retained externally and their hashes recorded in `cp2-verification.json`. `git ls-files --eol -- scripts/qa/hac44 docs/v2-amazon/delivery/uml-bd-api-2026-10-10` filtered for `i/crlf` returned empty output. `git diff --cached --check 9d0c3ee32179f00242a6961b90116293a1bc6d0e` returned exit 0 with empty output before the correction commit. The final commit's ordinary and `--ignore-cr-at-eol` PR shortstats and `git diff --check origin/main...HEAD` results are recorded in the PR and external correction evidence.

The current target is `origin/main` @ `e8a04cb19dd0df9d859a15db1b4948b0384308ce` (#123/HAC-45). That advance is deliberately not merged into this branch. F-02 coverage remains evidence of `9d0c3ee`; no certification is extended to migration 28 or new carrier-portal/catalog/workflow behavior. The new three-job CI run checks integration against the current target separately.

Full filtered command output and machine-specific execution metadata remain in the external CP-2 evidence package. `cp2-verification.json` identifies their SHA-256 values without publishing raw logs or local paths. The PR records its final SHA, base, requested reviewer and the three CI job outcomes; CI is independent of the local release result.

No backend, migration, CI, hosted Supabase, unrelated Docker bank, reserved port, original checkout or Linear state was changed. No PR merge, direct main push, force push, rebase or F-02 closure was performed.

Part of HAC-44
