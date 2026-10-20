# Client copilot: sidebar and movable launcher — 19 October 2026

## Scope

Local work on `main`, as explicitly requested by the user. No push, merge,
deployment, schema change or seed was performed. The carrier shell and its
business components were not changed. Monday screenshots supplied by the user
were visual references, not a dependency or an integration.

## Implementation

- One workspace-level `IntakeSessionProvider` owns the existing intake controller.
  The form and copilot consume the same draft, request/version, API errors,
  evaluation and selected candidate. The controller was extracted from
  `V2IntakePrototype`; it does not introduce a second request workflow.
- One `ClientAssistant` remains mounted across client route navigation. The
  former large inline chat was replaced by a bottom rainbow launcher, an expanded
  quick composer, a right sidebar and a detachable floating window.
- Submitting the launcher or dashboard prompt opens the conversation. Docking,
  detaching and closing preserve conversation and draft data. "Start new chat"
  clears conversation context and voice review only, not the shared request.
- The collapsible draft summary sits below the chat header, with field cards,
  pending-data feedback and links to the corresponding form step.
- History follows the latest response across docking, summary expansion and
  resizing, while preserving the position when the user reads older messages.
- Drag handles support pointer capture, arrows, Shift+arrows and Home to reset.
  Position is clamped on resize/expansion. Position/history/provisional contact
  data are not written to browser storage. Only the pre-existing persisted request
  ID remains in sessionStorage for authenticated recovery.
- Desktop docking reserves content space at 1200 px and above; container queries
  adapt the client toolbar, intake and portal cards. On smaller screens the panel
  overlays; on mobile it becomes a full-height modal with focus containment,
  Escape, scroll locking and safe-area/visual-viewport handling. Motion respects
  reduced-motion preferences.
- Existing interpretation, voice controls, explicit save confirmation,
  expected draft version, idempotency and POST → GET → serviceability are retained.
  Catalog failures are visible and retryable; no hidden fixture fallback was added.

## Validation on the implementation in this delivery

| Command | Result |
| --- | --- |
| `pnpm typecheck` | PASS |
| `pnpm check:architecture` | PASS, 599 modules / 181 client entry points |
| `pnpm test:v2-intake` | PASS, 47 tests |
| `pnpm test:v2-chat-workflow` | PASS, 15 tests, including 3 new position/keyboard tests |
| `pnpm test:v2-conversation` | PASS, 81 tests |
| `pnpm test:shipper-portal` | PASS, 40 tests |
| `pnpm test:workspace-modes` | PASS, 32 tests |
| `pnpm build` | PASS |

The suite counts overlap; they are execution results, not a unique acceptance count.
Negative tests cover stale revisions, invalid contracts, 401/403/network errors,
voice/typed send guards and demo/connected transport separation.

### Real browser checks

Authenticated local client, using the existing explicitly synthetic QA catalog:

1. Click launcher → expanded quick composer → send → sidebar opens automatically.
2. "I need to ship 10 pallets from Lima to Arequipa" → authorized facilities and
   quantity appear in the shared draft via the actual conversation endpoint.
3. "Actually 12 pallets, not 10" → quantity changes without clearing the route.
4. Edit Cargo from the summary → form contains 12. Form edit to 14 → summary
   immediately contains 14. The same state survives client navigation.
5. New conversation resets messages and preserves 14 and both facilities.
6. Dock/detach/close/reopen and actual pointer/keyboard drag were exercised.
   Expanding a moved launcher remains inside the viewport.
7. Incomplete draft review asks for missing data instead of creating a request.
8. Desktop (1280/1366 px), tablet (768 px) and mobile (390 px) were rendered;
   tablet and mobile have no document horizontal overflow. The mobile panel spans
   the viewport. Editing closes the modal and returns to the shared form;
   Escape closes it and restores focus to the launcher.

Screenshots are local artifacts in the task workspace under
`evidence/copilot-sidebar-2026-10-19/` (launcher, expanded composer, sidebar,
detached window and mobile). They are not hosted-product evidence.

## Limits

- No new booking or persisted request was created for this visual change.
  API request/revision/consent behavior is covered by the existing targeted tests;
  this delivery does not claim a fresh end-to-end commercial certification.
- Microphone capture and a live Nova audio round trip were not exercised. Existing
  voice code was retained and its automated suites passed; browser microphone
  permissions remain user-controlled.
- Unsaved drafts and conversation history remain in React memory. Full page
  reload does not invent an autosave or a persisted conversation.
- No PR was opened and nothing was pushed; publication remains with the user.
