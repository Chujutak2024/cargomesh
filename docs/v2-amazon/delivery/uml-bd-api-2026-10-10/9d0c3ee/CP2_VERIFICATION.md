# CP-2 delivery verification

Tested implementation/evidence commit: `d7440aa39ac84926efc9addc08137164f93eeeb0`. Product/base SHA: `9d0c3ee32179f00242a6961b90116293a1bc6d0e`. The subsequent verification-record commit changes only this evidence directory; the measured harness and product tree are identical.

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

All 96/96 committed and working harness SHA-256 values match CP-1c. Publication states match RUN_5/RUN_6 for all 342/342 rows. Byte preservation produces 69 CRLF-only Git paths alongside exactly 18 logical CP-1c changes; the supplemental whitespace diagnostic remains exit 2 solely for those carriage returns (14,846 diagnostics, zero trailing spaces/tabs). No whitespace policy was relaxed.

Full filtered command output and machine-specific execution metadata remain in the external CP-2 evidence package. `cp2-verification.json` identifies their SHA-256 values without publishing raw logs or local paths. The PR records its final SHA, base, requested reviewer and the three CI job outcomes; CI is independent of the local release result.

No backend, migration, CI, hosted Supabase, unrelated Docker bank, reserved port, original checkout or Linear state was changed. No PR merge, direct main push, force push, rebase or F-02 closure was performed.

Part of HAC-44
