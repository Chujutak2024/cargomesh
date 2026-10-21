# HAC-50 — Shared dependency runtime during publication

Date: 2026-10-18. Context: active unified-workspaces checkout, publication checks.

Running package scripts through pnpm 11.24.0 attempted automatic install/synchronization. pnpm refused because node_modules resolves through a junction to the preserved Juan checkout outside the current project root (ERR_PNPM_UNSAFE_MODULES_DIR).

Resolution: retain the dependency runtime and execute the existing script commands directly through Node. The release suite passed 402 tests and Next production build completed with exit 0. No install, dependency upgrade, junction deletion or lockfile change was used as a workaround.

The initial log wrapper also failed to print Unicode to the Windows console after its child completed. Logs were preserved; the wrapper now uses UTF-8 and records exit status before printing. Build was confirmed again with exit 0. This was a tooling issue, not a product failure or a justification to bypass a product gate.

Local logs and exact publication plan are retained under salida/push-carrier-20261018 in the primary workspace. The remaining portability question is whether the team wants independent dependency installations per checkout; no such migration is included here.


Plan1 continuation: pnpm exec/check attempted the same automatic synchronization and refused the shared modules path. The task used the installed TypeScript and test runtime directly through Node. No dependency, lockfile or junction was changed. Evidence belongs to the Plan1 local handoff; historical test counts above are not new results.
