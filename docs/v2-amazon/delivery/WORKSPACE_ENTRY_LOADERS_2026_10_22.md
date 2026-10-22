# Landing workspace loaders — 22 October 2026

UI-only work initially verified on local `main` at `657885a`. No infrastructure deployment, database mutation or authentication-policy change. The initial remote was four commits ahead; subsequent synchronization and publication were explicitly requested by the user.

Pulled/rebased onto `107d2f3` (PR #155), including PR #151/#153/#154. The only content conflict was the Client route loading fallback; the requested workspace bars remain there, while the incoming shared operational loader remains unchanged for its other consumers.

## Scope

- Carrier: animated SVG truck, suspension, rotating wheels, moving road and lamp, adapted from vinodjangid07's `popular-owl-27`.
- Client: five animated bars adapted from satyamchaudharydev's `ugly-bulldog-75`.
- CargoMesh petroleum blue/teal palette, violet/blue Client accents, local brand icon, responsive centered composition and localized copy. MIT notices retained in the root `THIRD_PARTY_NOTICES.md`.
- Per follow-up review, omitted the workspace eyebrow and waiting caption from both loaders. Removed the landing route badge, sign-in note, illustrative-scene caption and playback button. Decorative video still autoplays when allowed; reduced motion or unavailable playback uses its poster.
- Landing links retain standard Next Link navigation. `onNavigate` starts the visual transition only for same-tab navigation; modified/new-tab clicks remain native.
- A persistent root presentation boundary covers streamed layouts, releases on committed route changes with a brief fade, restores page scrolling and clears on `pageshow`. It does not add a minimum delay, fake percentages or any session/API calls.
- A slow navigation exposes Retry/Go back after 15 seconds. Pending demo session and route loading reuse the same visuals; existing access guards, inert boundaries and retry/failure handling remain in place.
- CSS-only motion; `prefers-reduced-motion` disables repeated and entrance/exit animation. Low-height layouts use safe centering and scrollable recovery content.

## Verification

- Post-pull `pnpm release:verify` passed on rebased source `982b6e6`: typecheck, architecture (721 modules / 209 client entries), workspace/demo, release and ordered-flow cases, incident recovery, conversation, chat workflow, carrier-commercial, logistics and production build. Only this evidence line was added after that verification.
- `pnpm test:workspace-demo`: 43 passed (seven new entry/loading regressions).
- `pnpm typecheck`: passed.
- `pnpm check:architecture`: passed (712 modules, 208 client entry points).
- `pnpm build`: passed.
- Browser: landing → Carrier and landing → Client both displayed their correct loader and reached the native connected workspace. Completed navigation had no remaining transition loader, inert boundary or body scroll lock.
- Browser: Carrier loader at 390×844 fit without horizontal overflow; Client loader at 320×568 fit without visual clipping. Back navigation restored the landing. Reduced-motion behavior is covered by CSS/source regression checks, not an emulated browser test.
- Evidence screenshots: `C:/Users/holap/Documents/Codex/artifacts/workspace-loaders-2026-10-22/`.

Only session navigation was exercised in the browser; no request, offer, booking or fleet record was submitted.
