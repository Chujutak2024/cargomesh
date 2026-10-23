# Assistant guide for New shipment

HAC-46 · `codex/nova-context-date-continuity` · PR #163 → `main`.

## Behavior

The assistant and New shipment share the same draft and form validators. Their section names and text-interpreter next-field selection now come from the shared form guide: Facilities → Cargo & units → Windows & contacts → Create & evaluate.

Every actual assistant-applied change keeps the existing 4.5-second field outline/badge and produces a receipt with the recorded values. A route receipt shows the resolved facility cities and codes, including synthetic labels when applicable. Cargo receipts include package count/type, per-unit weight/dimensions and total volume. Scheduling receipts keep pickup and delivery separate. Contact receipts acknowledge updates without duplicating phone/email values. Recognized proposals and unchanged values do not become success receipts.

A compact guide stays outside the chat history scroll, so new acknowledgements remain visible during a long conversation. It displays section completion and a question based on the first actual validation issue. It does not imply carrier capacity, price or a saved request.

After a real assistant change completes the current and preceding sections, a 1.4-second pause leaves the field feedback visible before advancing to the next incomplete section (or review if all three sections are valid). Route IDs must resolve in the active catalog. No save or serviceability API is called by advancement. Existing explicit save/booking authorization remains unchanged.

Manual form interaction, navigation, edits, reset, new changes, busy operations and unmount cancel a pending transition. A generation check prevents an old callback from moving a reset draft. Automatic navigation disables heading focus/scroll; manual navigation keeps its existing accessible focus behavior. No voice component is remounted or stopped by this transition. Reduced motion disables receipt glow while retaining the textual acknowledgement and static field cue.

Renewed Nova permissions include the validated form section number and pending field names, without contact values. Gateway guidance follows that order, acknowledges actual data briefly, asks for missing/invalid details and requests confirmation at review. Applying these model instructions requires rebuilding the existing gateway after source acceptance; the web-only receipt and automatic form navigation are independent of that deployment.

## Validation

- Real controller regressions: route partial/full; delayed transition; no automatic save; same/unknown facilities blocked; invalid cargo blocked; incomplete contacts block review; manual navigation/interaction/reset cancellation; stale callback safety; route receipt values and correct next question.
- Voice draft regression: valid facilities lead to Cargo & units, without optional urgency fields taking priority.
- Intake: 75 passed. Chat workflow: 100 passed. Conversation: 103 + 26 passed. Python guidance: 6 passed. Types and architecture passed. Production build passed.
- Standalone ESLint is unavailable in this checkout (documented in the preceding continuity evidence); no lint pass is claimed.

## Manual acceptance after publication

1. Open New shipment and the assistant in an authenticated account. Dictate an authorized A → B route. Verify the two fields, visible route receipt and gentle outline/glow.
2. After the pause, Cargo & units opens; the cursor stays in chat and speech finishes normally. A partial or unresolved route remains in Facilities.
3. Complete product, category, packages, per-unit weight/volume/dimensions. Only a valid cargo section advances to Windows & contacts.
4. Leave a contact invalid or a time window reversed: remain in that section and show the pending question. Correct it and advance to review without saving.
5. Click/focus a form control during the pause, reset, or issue a correction. Verify the pending move is cancelled; newer changes can trigger a new validated transition.
6. Repeat on mobile, keyboard and reduced motion. Confirm the receipt remains visible without hiding the message composer.

No authenticated browser or live human voice acceptance is claimed for this change. No merge, hosted data mutation, AWS configuration or deployment was performed.
