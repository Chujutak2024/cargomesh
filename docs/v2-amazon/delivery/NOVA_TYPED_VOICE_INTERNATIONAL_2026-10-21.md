# Typed voice replies and international Client demo — 21 October 2026

HAC-46 conversational increment, existing branch `codex/unified-workspaces-demo-boundary`, based on `origin/main` `c705a64`. Target main; no direct push or merge. This is V2, not a V1 fixture upgrade.

## Problem and resulting behavior

With Nova enabled, `ConversationChat` disabled browser reading for every written reply. The gateway accepted only binary PCM after authentication, so typed questions went to the independent deterministic interpretation path. The English Nova panel also repeated a technical local-draft notice.

Typed questions and intake details now use the same authenticated Nova connection and PCM playback as spoken turns. Sending text creates audio output without requesting the microphone. The user can then turn on the microphone and continue in the same session. The model is instructed to answer the actual question first instead of repeating the next form field or an introductory notice, acknowledge uncertainty and retain the existing no-invented-quotes/availability boundaries. The repeated notice is removed. A voice-replies toggle preserves the transcript when muted.

The new ready event advertises `textInput: true`. The browser sends a strict `{type:"text",text}` frame only after that capability, with 4,096 characters maximum. Invalid shapes, identity-bearing fields, blank and oversized text are rejected by the gateway. The PCM frame cap stays 8,192 bytes and the signed first-frame cap stays 65,536. JWT/single-use/origin/tenant rules are unchanged. `.dockerignore` now includes the transport limits module required by the existing Dockerfile; packaging regression verifies COPY inputs and private-file exclusion.

Written user turns enter the same history and validated draft-capture pipeline as voice, once per submitted turn. Business reads and actions keep the existing native workflow rather than being delegated to the voice model. Its responses can still be read by device speech; Nova speech is not read twice and native speech is muted out of microphone input to prevent echo. Draft/booking consent, expiry, version and idempotency remain native checks. Request-scope changes cancel pending fallback rather than issuing a stale action. Existing gateways without the capability receive no text frame and keep native text/device-reading fallback.

## International scenario

`supabase/scenarios/v2-international-client-demo/` contains manifest, guarded additive seed, read-only verification and explicit cleanup. It adds **32 synthetic facilities**, yielding **35 facilities in 17 countries** with existing Lima/Arequipa/Tacna. The same demo organization receives the locations, so judges can select them under its existing membership. No new users or privileges, carriers, service areas, lanes, assets, offers, bookings or confirmed capacity are generated. All 35 locations fit the current voice-catalog cap of 40. Addresses are fictional, coordinates approximate, hours unknown.

The seed refuses ordinary/missing organizations and collisions; identical reruns leave existing records unchanged. It is not in migrations and has not been applied to hosted Supabase. International endpoints do not certify a ROAD path across oceans or operational AIR/SEA/RAIL. Current evaluation must explain unknown/no coverage when appropriate.

## Rollout and verification boundaries

1. Review and publish the Web change through its authorized PR/deployment flow.
2. Build the updated gateway from the accepted SHA, publish a new SHA-tagged image in the existing ECR repository and update only that ECS image. Keep current IAM, secret, origin, port and URL. The 64 KiB image deployed earlier does not yet advertise typed input.
3. Verify ready advertises text input; an authenticated typed question yields a complete transcript and PCM response. No claims of live text-to-Nova audio from offline tests.
4. Review/apply the seed explicitly to the agreed demo database, run `verify.sql`, then check intake options through an ordinary demo session. Native tenant RLS is unchanged. No remote seed application occurred in this increment.
5. Vercel extended catalog flag remains a separate configuration decision; this increment does not change it or deploy production.

## Human acceptance card — not yet executed

Actor: a judge or team reviewer who did not implement the change, authorized demo Client. Environment: preview with the updated gateway and explicitly loaded international scenario. Preparation must name SHA, URL and dataset without sharing secrets.

- With microphone permission unset, type “What is the difference between FTL and LTL?” Expected: one user turn, a relevant written and spoken answer, no microphone permission prompt, no repeated draft notice.
- Continue with “From Madrid to Barcelona, ten pallets of boxed shoes, 100 kilograms each.” Expected: authorized ES facilities and 1,000 kg provisional total; missing details asked naturally. No carrier or price invented.
- Activate voice, correct destination to Paris, then ask for a summary. Expected: one shared conversation, current correction, complete audio before the review/confirmation, customs/coverage left unconfirmed pending native checks.
- While Nova speaks, compose a correction. Expected: text retained, send waits until audio ends; no automatic cutoff. Mute replies and confirm the transcript still completes.
- Attempt the same city with another tenant: its own catalog only, no international demo location leakage.

Status: automated verification recorded below; human audio/provider acceptance and hosted scenario application pending. Do not label these pending checks as PASS.

## Automated evidence

- `pnpm test:v2-conversation`: 93 conversation/catalog tests + 17 lifecycle/catalog-adapter tests PASS (inert browser media/socket adapters, no provider/audio live).
- `pnpm test:v2-chat-workflow`: 68 PASS; confirmation and commercial boundaries retained.
- `python -m unittest test_gateway_packaging test_nova_voice_gateway test_voice_guidance test_voice_transport_limits test_voice_response_finish`: 27 PASS.
- `pnpm check:architecture`: PASS. `pnpm build` (including type validation): PASS. No hosted deployment was executed.
- International manifest tests verify all 32 cities resolve through the real selector parser, unique IDs, synthetic-only rows and collision guards. SQL application/verification and tenant-scoped API readback remain pending in a reviewed demo database; no local PostgreSQL runtime was available for a SQL execution claim.
