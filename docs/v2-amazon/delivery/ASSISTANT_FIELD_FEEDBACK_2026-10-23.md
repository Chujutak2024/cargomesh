# HAC-46 — Immediate feedback for assistant-applied form changes

Date: 2026-10-23. Base: main `350d5fa`. Branch: `codex/chatbot-field-change-feedback`.

The shared intake session now observes actual committed draft differences from
`updateFromChat`, used by both text and Nova voice. Changed controls and matching
live-summary rows receive a teal outline, one soft glow and an Updated badge for
4.5 seconds. A polite status message names the affected groups and explicitly
calls them draft changes. It does not claim a save, availability or booking.

The visual boundary keeps the controls mounted; only the decorative glow has a
new key. It never calls focus or scroll APIs. Reduced-motion preference disables
the glow animation while retaining the static outline, badge and status text.

Repeated identical values do not trigger a new success cue. New corrections
restart the timer; older callbacks cannot clear the newer change. Batched facts
retain each changed target. Manual edits remove obsolete assistant markers, and
reset/example/unmount clear feedback or release its timer. Derived cargo totals
are marked only when their displayed values actually change. Additional cargo
groups are not marked as modified by a primary-group assistant update.

Validation from `cargomesh/`:

- `pnpm test:v2-intake`: 67 passed, including four new feedback regressions using
  the real controller and real hook with deterministic React lifecycle/timers.
- `pnpm test:v2-chat-workflow`: 85 passed (includes controller regressions).
- `pnpm typecheck` and `pnpm check:architecture`: passed before the final UI-only
  coverage additions; production build performs final type validation.
- `git diff --check`: passed.
- Production build result is recorded in the PR.

Browser validation is pending. The integrated browser timed out while opening
local tabs, and the local app could not refresh its authenticated session
(AuthRetryableFetchError). No authentication bypass, hosted data mutation or
live Nova turn was performed to work around this environment limitation.

Human acceptance script (on an authenticated preview):

1. Keep the form visible and ask CargoMesh to set an authorized origin/destination.
   Expect both applied selectors and summary rows to glow, plus the draft notice.
   An unresolved location must not receive a success marker.
2. Correct the destination again before the cue expires. Expect the new destination
   to show immediately and its feedback to remain for a fresh 4.5 seconds.
3. Repeat the same value: expect no new change event. Edit the same field manually:
   expect its assistant marker to clear without losing focus.
4. Change quantity/weight/volume: inspect primary cargo controls and derived totals.
   Secondary cargo groups must not claim an assistant change.
5. With reduced motion enabled, expect static feedback without glow animation.
   Close/reset the intake: no stale message should appear in the next draft.

This is a UI feedback increment. Interpretation, shared-draft revision/idempotency,
API contracts, gateway, AWS configuration and commercial authorization are unchanged.
