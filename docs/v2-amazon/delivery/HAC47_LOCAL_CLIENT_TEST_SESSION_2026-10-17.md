# HAC-47 — Local Client test session (2026-10-17)

## Scope

Existing branch `codex/unified-workspaces-demo-boundary`. The user requested a predefined Client profile for frontend review and identified Carrier credentials incorrectly appearing at `/login?returnTo=%2Fclients`. This increment changes only local preview access; no hosted accounts, memberships, seeds or migrations are created. `main` and deployments remain unchanged.

## Behavior

- Open `/clients` or `/login?returnTo=%2Fclients` and choose **Continue as test client**.
- Predefined visual identity: **Alex Morgan**, **Northstar Logistics · Test organization**. This is a simulated identity, not a Supabase user.
- A signed HttpOnly cookie lasts two hours. It requires explicit private environment opt-in, a server secret, nonproduction mode and loopback port 8080. Cookies are not accepted by real domain APIs.
- The existing Client sample page family supplies the data; clean `/clients/...` links remain. All business writes through the preview transport are blocked. Unknown sample reads do not fall back to live APIs.
- The shared shell labels the source **Client test session · Sample data · Read only**. **Exit test session** clears only this cookie, preserving the independent Carrier session.
- **Use a connected Client account** opens manual real authentication. Client sign-in never falls back to Carrier default credentials; optional Client-specific defaults use separate server environment variables.
- With the local flag off, on a nonloopback host or in production, existing Supabase membership guards remain mandatory. This does not implement real Client authentication, chatbot access or an editable simulated order lifecycle.

## Private configuration

Ignored app `.env.local`: `CARGOMESH_LOCAL_CLIENT_PREVIEW_ENABLED=true`, `CARGOMESH_LOCAL_CLIENT_PREVIEW_SECRET` (random server secret) and `CM_ENABLE_DEMO=1`. No secret value is included here.

## Verification

- 30 focused tests pass: signature/expiry/tampering, disabled/production/host checks, origin/login defaults separation, local preview transport read/write isolation and navigation/auth regression.
- Native HTTP passes: dedicated Client login; session creation; dashboard, requests, facilities, request detail, tracking and new-request pages; unauthorized real API with only a preview cookie; rejected sample writes; forged cookie rejection; isolated logout.
- TypeScript and architecture pass (448 modules, 116 client entries). Used installed TypeScript because the pnpm launcher attempted dependency reconciliation against the existing shared node_modules junction and refused it. No dependency install or rebuild was performed.
- Corrected sample intake response to return the raw API contract, so the browser parser normalizes it once.
- Browser visual/interaction validation was unavailable because browser use is disabled in Work settings. HTTP checks confirm rendered page content, not visual layout or animation quality.

Local evidence: `salida/client-preview-20261017/RESULTS.json` in the primary workspace. Credentials and cookies are not logged.
