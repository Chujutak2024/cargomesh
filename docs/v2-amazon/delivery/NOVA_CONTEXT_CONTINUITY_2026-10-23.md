# Nova: product and scheduling continuity

HAC-46 · branch `codex/nova-context-date-continuity` · target `main` · base `c074f6c`.

## Report and cause

The supplied English conversation lost the product after correcting dates and relabeled the delivery window as pickup. This is distinct from the historical 4 KiB authentication rejection: the signed initial envelope already permits 64 KiB. Audio and text transport limits are unchanged.

The web question guard did not recognize several English scheduling questions. Partial dates did not retain their pickup/delivery role and clock across replies. Reconnection context kept only the latest customer turns, losing both early cargo information and the assistant question needed to interpret short replies. Product text was absent from structured voice draft hints.

## Change

- Resolve English/Spanish dates and explicit clocks into separate pickup/delivery windows. Keep partial day and clock with their role, even if a subsequent assistant question incorrectly says pickup. Explicit customer corrections can update either or both roles.
- Never silently choose between alternative dates, guess an afternoon hour, copy clocks from a different day, or roll an omitted past date into next year. Upcoming omitted-year dates use the visible session year and are provisional until review.
- Preserve the literal robot product from boxes-with-product phrasing and accept explicitly stated per-unit weights, including `500kg each`.
- A short yes selects only one named, authorized, non-hazardous category. It never authorizes saving or booking. Equipment must exist in the supplied catalog.
- Renewed sessions retain four early customer anchors plus twelve recent dialogue turns, within the existing sixteen-entry/320-character bounds. Latest corrections take precedence.
- Signed draft hints carry bounded product text, session reference date and pending window role/clocks. Product hints omit contact-like values and known contact values. The shared interpretation schema remains unchanged.
- Gateway guidance maintains a product/category/equipment/date ledger, binds short answers to its latest question and avoids restarting intake after a correction.
- Hide the rule-guided text interpreter status when the Nova channel is enabled; it does not describe Nova's generative response.

## Reproduction and acceptance

Use a fresh authenticated English session. Describe Lima to Arequipa, two boxes with one robot each at 500 kg each; dimensions 50 x 50 x 100 cm per box. Accept Machinery and Heavy Industrial and select only equipment actually offered in the catalog.

Set pickup November 10, 09:00–17:00 Lima time and delivery December 10 afternoon, then answer 2pm and 8pm. Delivery must become December 10, 14:00–20:00; pickup remains November 10. Correct delivery to 21:00, then explicitly correct both: pickup November 10, 08:00–17:00 and delivery December 10, 14:00–21:00. Product, category, count and measurements remain unchanged. Review full dates/year before explicit saving.

## Validation and publication boundary

Automated checks: conversation 103 + 26 passed; chat workflow 91 passed; intake 67 passed; Python guidance 6 passed; transport limits 2 passed; TypeScript and architecture passed. Production build passed. A standalone ESLint check could not run because this checkout has no ESLint executable; no lint pass is claimed.

The tests reproduce the supplied transcript and reject ambiguous dates, invalid dates, ungrounded total-as-per-unit weights, unsupported equipment and hazardous-category shortcuts. Prompt tests check instructions, not model compliance.

Publish the web changes and rebuild the existing AWS gateway image from the accepted source to apply the new model instructions. Preserve existing URL, origin, port, IAM, secret and infrastructure. A web-only rollout improves local capture but does not change the running gateway prompt. No AWS/Vercel deployment or live human conversation was performed for this correction. After both rollouts, repeat the authenticated conversation and renewal test; do not infer deployment from health alone.


## Integration review: signed renewal context

The integration review reproduced a boundary defect: the browser retained four early
cargo anchors plus twelve recent turns, but the session API signed only the last twelve.
The route now keeps the bounded sixteen-turn intake envelope (180 characters per turn).
Shipper offer sessions still use six turns of 160 characters; Carrier grants do not accept
browser transcript hints. No consent, identity or commercial data behavior changes.

The regression calls the native session POST in isolated local-preview mode, verifies
the JWT signature, and asserts the initial robot product and latest delivery exchange
survive together. It fails against the previous route. Separate checks retain role budgets,
reject seventeen turns and oversized strings, and preserve no-store headers.

Combined with main 4f2a286: TypeScript, 292 conversation/intake/briefing tests, nine
navigation/motion tests and 36 gateway tests passed locally. No new authenticated visual
or live-audio acceptance is claimed. Rebuild the existing AWS gateway after the accepted
web merge for the updated instructions; publishing the web does not update ECS.
