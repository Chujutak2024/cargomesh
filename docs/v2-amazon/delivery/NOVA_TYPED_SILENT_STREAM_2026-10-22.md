# HAC-46: typed Nova replies without microphone access

Date: 2026-10-22. Branch: `codex/nova-typed-silent-stream`; target: `main`.
Base: `92ec4704b759db6f8104aaa32f38c22a2c9a7a82`.

## Problem and implementation

A gateway advertising `ready.textInput: true` accepted written turns, but Nova did
not produce a response without continuous input PCM. The browser now primes the
input with 1024 zero bytes every 32 ms after authenticated readiness. This is
16 kHz mono PCM16 silence, does not request microphone permission, and stays
within the gateway audio frame limit. Real microphone capture replaces this
stream. Pausing capture resumes silence while the authenticated session remains
open. Silence does not update user activity or enable idle-session renewal.

Input stops on session completion, socket/provider error, scope change, or
unmount. Already received assistant audio still drains before playback closes.
No domain contracts, credentials, AWS configuration, or commercial data change.
The deployed gateway must advertise text input; older gateways retain fallback.

## Requirement to evidence

| Requirement | Reproduction and observed result |
| --- | --- |
| Typed turn without microphone | Lifecycle harness: authenticated ready precedes PCM and text; no getUserMedia call; pass. |
| One input stream | Microphone activation, delayed permission, pause and resume: synthetic input replaced by capture; pass. |
| Lifecycle and complete playback | Scope change, errors, unmount and queued audio drain: timers released and received speech preserved; pass. |
| No artificial activity | Clock-controlled silence/session-limit test: user timestamp unchanged and idle session not renewed; pass. |

Run from `cargomesh/`: `pnpm test:v2-conversation` (97 + 26 passed, including
24 lifecycle tests), `pnpm test:v2-chat-workflow` (69 passed), `pnpm typecheck`
and `pnpm check:architecture` (passed). Before the component change, four of the
new lifecycle regressions failed; after the fix, all 24 lifecycle tests passed.
Production build result is recorded in the pull request.

## Live transport evidence and limits

A controlled probe against the existing AWS gateway (revision 5, source
`92ec470`) returned `ready.textInput: true`. A written informational turn with
synthetic silence received 307 audio frames / 794880 decoded bytes, a complete
Spanish transcript, and response_end. No microphone audio or commercial mutation
was sent. The same text without input PCM timed out without audio. This probe
establishes the transport prerequisite; it is not a human browser acceptance test.
Detailed rollout evidence is in documentation PR #147.

## Browser acceptance pending

Actor: an authorized Client or Carrier demo user. Use the preview of this PR,
current AWS gateway, and a foreground browser with audio enabled. Do not create
requests, offers, reservations, or bookings for this test.

1. Start with microphone access denied/unrequested and type an informational
   question. Expect the complete spoken answer and its transcript without a
   microphone prompt.
2. Ask a second question after the first answer ends. Expect the same voice
   session to reply; verify no clipping.
3. Activate, pause and resume the microphone. Expect one input source and retained
   conversation. Close the assistant or change authorized request scope; expect
   input to stop.

Status: not executed on the final browser bundle; evaluator, browser/device and
recording remain pending. Background-tab timer throttling and browser autoplay
policy require browser observation and are not certified by the VM harness.
