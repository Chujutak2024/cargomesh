# HAC-49 — Local login and launch consolidation

Verified 2026-10-14.

## Cause and correction

The unified preview loaded a different Supabase environment and its login prefill still depended on an old 3907 proxy. The landing directly opened a guarded workspace, making the approved Oops state appear instead of the login form. The fix consolidates the known working private local settings in the active app's ignored `.env.local`, uses an explicit login-first Carrier entry and direct whitelisted fleet return, and integrates a loopback-only development prefill endpoint.

The previous same-origin initialization also waited for an 8083 transfer iframe. The current local workspace restores its own saved data and seven examples without that dependency. No stored drafts or immutable originals were removed.

## Automatic approval review

Review rejected overwriting four historical launcher scripts, including previews owned by other chats, because doing so could interfere with concurrent work. That operation did not execute. The safer alternative preserves those files, documents `node scripts/dev-local.mjs` as the current entry point, and adds a preflight check to this task's new launcher so a second build is not started when 8080 is already occupied. No workaround was used to overwrite the rejected files.

A separate browser auto-review rejected clicking Sign in based on a stale observation that the fields were empty. A fresh DOM check returned exactly two complete fields without printing their contents; the subsequent authorized login succeeded. No credential was filled or submitted through an alternate channel to bypass that rejection.

## Evidence and remaining scope

30 unit/regression tests, typecheck, architecture and 14 real login/logout HTTP checks passed. Browser tests verified fleet, seven requests, logout, Back → protected English Oops, and a fresh successful login. The old already-merged map branch was deleted only after SHA/ancestry/PR checks. Main and the recent unified branch were preserved. Real Google Routes validation remains a separate missing-server-credential dependency.
