# HAC-52 — Authorized local access recovery

Owner: Jean Paul. Existing implementation: `388698eb4842da76a09f998c927d868c9eb241ff`.
PR: https://github.com/Chujutak2024/cargomesh/pull/132.

The user explicitly authorized restoring only the local BO/CL synthetic accounts
by exact IDs, preserving PE and every other bank, and saving the new passwords
only in the private access file outside the repository. This supersedes the
earlier approval rejection for this specific action; no broader credential
administration is authorized.

## Scope actually executed

Bank: `cargomesh-hac52-local`; container `supabase_db_cargomesh-hac52-local`.
API: `http://127.0.0.1:64621`; DB: `127.0.0.1:64622/postgres`.
App: `http://127.0.0.1:59580`.

| Account | Auth user ID | Organization ID |
| --- | --- | --- |
| BO — recovered | `8611d4f9-bc58-4ec4-821e-f64aee3d9ce2` | `52000000-0000-4000-8000-000000000002` |
| CL — recovered | `4445548f-d8bf-4348-ba41-0b8317100f73` | `52000000-0000-4000-8000-000000000003` |
| PE — preserved, verified login only | `6fc92c96-f3b8-4f1b-9038-9ca07bf5dc7d` | `52000000-0000-4000-8000-000000000001` |

The recovery script validates each BO/CL Auth ID against its exact member and
organization ID. It validates the local project marker and both endpoint ports.
Only those two Auth IDs receive password updates. The administrative credential
stays in process memory, never the private file or a report. New passwords are
written only to `C:\Users\Usuario\Documents\Proyectos\hac52-private\client-access.json`,
whose contents are read back and whose ACL is restricted to the current user.

## Exact commands and observed results

From `C:\Users\Usuario\Documents\Proyectos\cargomesh-hac52`:

```powershell
node scripts/hac52/recover-owned-access.mjs --recover-owned-bo-cl C:\Users\Usuario\Documents\Proyectos\hac52-private\client-access.json C:\Users\Usuario\Documents\Proyectos\hac52-local-bank C:\Users\Usuario\Documents\Proyectos\hac52-evidence\access-recovery.json
node scripts/hac52/verify-access.mjs C:\Users\Usuario\Documents\Proyectos\hac52-private\client-access.json C:\Users\Usuario\Documents\Proyectos\hac52-evidence\access-verification.json
```

Recovery exited 0 and reported:

- Recovered Auth IDs: exactly BO/CL listed above.
- `pePrivateAccessUnchanged: true`.
- `nonTargetPrivateAccessUnchanged: true`.
- `nonTargetAuthRowsUnchanged: true` (full row digest comparison in memory).
- `privateFileOutsideRepo: true`, `hostedAccess: false`.

Access verification exited 0: **3/3 accounts, 35/35 checks**. Each account used
the normal `/api/auth/login` endpoint with `/clients` as its destination, received
an isolated session cookie, and read its own organization, seeded Facilities and
assistant context. The connected organization page showed the expected name and
excluded the other two organization names. All six foreign Facility reads
returned 404, each paired with a successful own-Facility read. Anonymous access
returned 401. PE credential/membership digest was unchanged after verification;
normal login timestamps are not credential changes.

The first access probe stopped at its PE login control. No dependent negatives
were accepted from that attempt. The focused rerun above passed all cases; no
login implementation was changed during recovery.

No password, JWT, cookie or service key was printed or written to evidence. Logs
and reports contain only IDs, statuses, boolean safeguards and check names. No
other bank or hosted resource was accessed. No PE credential or membership
change, full provisioner rerun, migration, seed, deletion or new account creation
was part of this recovery. Application source remains the previously built cut;
only recovery/verification scripts and delivery documentation changed here.
