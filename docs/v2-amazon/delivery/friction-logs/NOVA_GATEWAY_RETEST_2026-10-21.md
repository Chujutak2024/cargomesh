# Nova gateway: accepted short auth, rejected expanded context

Observed: 21 October 2026, 12:19 America/Lima (17:19 UTC). Source checkout: `f8da07678cdd1a27190affdce24794c48c38bdc1`. **Severity: Important** for the expanded-context rollout; no production business-data incident was established.

## Task and reproduction steps

Task: verify that the existing AWS voice gateway accepts both the baseline and expanded authenticated context from the native Client demo at `https://cargomesh.vercel.app`.

1. Enter the native Client demo and obtain a fresh voice grant with `preview=false`.
2. Connect to the configured public gateway using the same authorized HTTPS Origin.
3. Send the baseline authentication envelope; wait for ready and close voluntarily.
4. Repeat with a fresh grant and bounded synthetic history of 12 diagnostic turns. Do not send audio or commercial commands. Keep all grants/cookies in memory and out of logs.

## Expected and actual result

Expected: both valid envelopes reach ready under the approved 64 KiB transport contract.

| Case | Grant HTTP | Auth envelope, UTF-8 | Ready | Close |
|---|---|---|---|---|
| No history — positive control | 200 | 2,057 bytes | Yes | 1000, voluntary |
| Bounded synthetic diagnostic history | 200 | 5,007 bytes | No | 1008 before ready |

The same session path succeeded with the smaller envelope and failed with expanded context. This reproduced the PR #140 transport defect. It was compatible with the earlier limit but did not identify the deployed image digest. No requests, offers or bookings were created. No audio was sent; no token/cookie was printed or saved.

## Workaround and inspection limit

Retain the bounded baseline context until an authorized rollout and large-envelope retest pass. This is a transport workaround, not permission to weaken grant validation.

The existing AWS session was valid, but `ecs:DescribeServices` returned AccessDenied for the target service. The identity lacked an allowing policy. No IAM changes or permission expansion were attempted, and this retest did not build/publish an image or change AWS/Vercel deployment settings. The then-running revision/digest remained unverified by ECS during this observation.

## Actionable suggestion

Expose the supported authentication-envelope limit as a documented capability and return a safe size-specific failure. Provide an authorized read-only way to match a running gateway to its source SHA/digest before testing, and keep a positive baseline alongside the expanded-context case.

## Later evidence and owner

The [22 October rollout record](../evidence/nova/GATEWAY_92EC470_2026-10-22.md) separately reports revision 5 accepting 5,085- and 8,035-byte contexts. That later observation resolves the original size blocker at its recorded deployment; it is not a current-version claim or human audio acceptance. Current AWS identity and browser acceptance are **pending confirmation — Axel**, coordinated by Cristhian.

The former reference to a colocated result JSON/probe was removed because neither artifact is present in this checkout. The table preserves the recorded observation; no missing artifact is presented as accessible evidence.
