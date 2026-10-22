# HAC-53 — Client presentation increment (22 October 2026)

## Scope and integration

Owner: Juan. Branch: `codex/v2-client-intake-experience`. Base: `origin/main` at `657885aa095132f0c2bef88e1920f1858db89d1d`. Draft PR target: `main`, according to the current repository rules and HAC-53 branch manifest. This is a presentation increment, not completion of HAC-53's full connected workflow.

The local work was backed up, then applied to the current base (35 commits newer than the original local base). Overlapping bookings/dashboard, app shell, intake and assistant files were reconciled against current main. The shared BookingCard, current Nova composer and action review, demo provider, incident recovery, consent/version checks and existing routes remain in place. No dependency, migration, deployment or business-data change is included.

## Delivered presentation

- Shared Client shell: white workspace, petroleum text/actions, teal interaction accents, restrained radii, visible focus and responsive navigation.
- Dashboard, requests and history: open rows, scoped filters, hierarchy and a desktop side rail.
- Reservations: the existing shared BookingCard renders as a responsive list in Client; resource, price and confirmation facts remain.
- Tracking: consistent milestones, activity, incident and unknown-geometry presentation.
- Facilities and organization: consistent sections, form controls and states; the connected editors keep their existing handlers.
- New request and Nova: matching controls, structured review and focus treatment, preserving the four steps and explicit consent actions.
- Help/support, loading, error and missing-record views: consistent recovery affordances.

The seven earlier local preview/auth files are included deliberately: frontend-only preview is explicitly opted into, loopback-only (8080/8092), nonproduction-only, signed and expiring. A configured backend is not replaced by this frontend-only path. Preview does not grant Supabase membership.

## Reproduction

From `cargomesh/`, use Node 22+ and the repository's pnpm setup:

```powershell
pnpm.cmd install --frozen-lockfile
$env:CM_ENABLE_DEMO = '1'
$env:CARGOMESH_LOCAL_CLIENT_PREVIEW_ENABLED = 'true'
$env:CARGOMESH_LOCAL_CLIENT_PREVIEW_SECRET = node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
$env:NEXT_PUBLIC_V2_INTAKE_OPTIONS_SOURCE = 'fixture'
pnpm.cmd dev --hostname 127.0.0.1 --port 8092
```

In a frontend-only checkout without Supabase configuration, open `http://127.0.0.1:8092/login?returnTo=%2Fclients`, enter the explicitly labelled test workspace, then open `/clients`. Keep existing private configuration intact; the preview credentials above live only in that shell. If the checkout already has authorized Supabase configuration, retain its normal authenticated workflow instead. Never put administrative credentials in public variables.

The sample preview is read-only. The fixture option catalog allows reviewing intake; it does not turn request creation or booking into a simulated success. Do not submit business mutations for this visual review.

## Verification on the updated base

Commands run from `cargomesh/`:

| Requirement | Command/evidence | Actual result |
| --- | --- | --- |
| Preserve portal models, filters and commercial boundaries | `pnpm.cmd test:shipper-portal` | 115 passed |
| Preserve intake contracts, validation and state | `pnpm.cmd test:v2-intake` | 54 passed |
| Preserve assistant workflow, consent and summaries | `pnpm.cmd test:v2-chat-workflow` | 69 passed |
| Preview opt-in, allowed hosts, production denial, configured-backend denial, signature/expiry/forgery | `node --conditions=react-server --import tsx --test src/server/auth/local-client-preview-policy.test.ts` | 3 passed |
| Types | `pnpm.cmd typecheck` | Passed |
| Client/server architecture | `pnpm.cmd check:architecture` | Passed: 709 modules, 206 client entries |
| Production compilation, including final assistant CSS | `pnpm.cmd build` | Passed |
| Whitespace/conflict hygiene | `git diff --check`, `git diff --cached --check` | Passed |

These are **241 relevant tests**, not a claim that every repository suite ran. Logs are retained locally in `.planning/2026-10-22-client-publish/` (ignored).

## Browser review

Chromium, explicit synthetic/read-only profile. Twelve route-top views were captured at 1440×1000 and 390×844: dashboard, requests, reservations, tracking list/detail, facilities, organization, history, support, help, intake and request detail. With a final mobile Nova capture and a validation-state capture, the current-base set contains 26 images. Representative copies are committed below; the complete local set is in `C:/Users/PISFIL/Documents/Codex/outputs/client-publish-20261022/`.

- [Dashboard desktop](../evidence/hac53-client-presentation/dashboard-desktop.png)
- [Reservations desktop](../evidence/hac53-client-presentation/bookings-desktop.png)
- [Tracking mobile](../evidence/hac53-client-presentation/tracking-detail-mobile.png)
- [Nova mobile](../evidence/hac53-client-presentation/nova-mobile.png)

Observed checks: route-top content matches each filename; no document overflow at 390px, plus reservations at 800px; one main landmark and a skip link; no unnamed visible icon buttons in the intermediate reservation view. Mobile navigation and Nova close with Escape and restore focus. The inspected reservation navigation produced no console warnings/errors. Previous local review covered four intake steps and additional states on the older base; those captures are retained separately and are not presented as current-base end-to-end evidence.

A single manual Impeccable scan reported five warnings in existing shared rules (BookingCard top border and four intake side borders). Client-scoped overrides flatten the relevant surfaces; shared non-Client designs were preserved. The static accessibility scanner is not a runtime audit: its 210 findings include landmark checks against CSS modules and leaf components. Rendered semantics/focus were checked instead; no full WCAG certification is claimed.

Independent review inspected all 25 current-base captures and representative source. It requested one material fix: remove the Client facility-picker error stripe. The normal empty-form Continue action reproduced two required-field errors; both now compute a 0px left border while preserving their text, danger background/color and alert role. An additional intentionally scrolled mobile error capture records this check (26 local images in total). The reviewer scored that fix as resolved and returned **`disposition: ship`**. This expert verdict does not certify the untested connected scenarios below.

## Limits and reviewer handoff

No authorized Supabase V2 session was available. Connected organization/facility writes, live offers, booking, live route/3D geometry and induced backend errors were not end-to-end exercised. Unknown geometry remains unavailable, and the preview's incident-recovery endpoint can truthfully show `DEMO_DATA_UNAVAILABLE`; no synthetic business data was inserted to hide that state.

This is an expert browser/visual inspection plus an independent screenshot/source review, not observed research with a separate end user. It does not measure screen-reader behavior, Core Web Vitals or every supported browser. Main's newer functional components were preserved; the integrator should validate their authorized connected scenario before accepting the full HAC-53 DoD.

No merge or deployment is part of this delivery.

## Follow-up refinement after visual feedback

The user requested another Client-wide visual pass after the first published increment. This follow-up keeps the same branch and PR. It strengthens the existing petroleum/teal palette with a dark Client navigation rail and high-contrast active state, raises operational typography, groups filters and counts into flat bands, widens the dashboard assistant rail, and aligns page widths/header scales. Support uses two open columns on desktop. Facility names and diagnostic copy are more readable. No commercial behavior or data changed.

A mobile navigation defect found during this pass is fixed: the mounted assistant becomes hidden and inert while the menu is open. Its state is retained. The menu's visibility no longer transitions through a hidden focus target; the existing focus and Escape handlers are preserved.

Current follow-up evidence: 25 PNGs in `C:/Users/PISFIL/Documents/Codex/outputs/client-refinement-20261022/` (12 route tops at both sizes plus the open mobile menu). Dashboard, reservations and tracking copies below are refreshed; [mobile navigation](../evidence/hac53-client-presentation/navigation-mobile.png) is added. The first-pass Nova capture remains representative because this follow-up does not change its panel styling.

Observed assert-based browser checks:
- Open mobile navigation: assistant layer is inert and display:none; focus lands on Close.
- Escape: focus returns to Open menu; unsent quick-composer text remains unchanged.
- Collapsed navigation at800px: existing collapse handler works, reservations remains visible, document width stays800px.
- Navigation contrast: normal text10.43:1, group labels6.93:1, active row6.82:1. This is a targeted check, not an overall accessibility certificate.
- No warnings/errors in the inspected reservation console.

Types, architecture709/206 and production build were rerun successfully for the follow-up code. The final CSS transition-property correction was confirmed in the browser; it changes no imports or build configuration. The241 business/preview tests above belong to the first published increment; they were not repeated for this presentation-only follow-up. A single new detector scan retained four inherited intake border rules with Client overrides, and no second scan was run.

Local follow-up logs and assertions are in `.planning/2026-10-22-client-refinement/`. The same connected-data limitations apply. This iteration remains separate from accepting the full HAC-53 workflow.

The independent full follow-up review inspected all25 new captures and representative source, returning **`disposition: ship`** with no material fixes. Final browser assertions were repeated after removing a temporary focus workaround: the original focus handler works with the corrected visibility styling, and assistant text remains intact.
