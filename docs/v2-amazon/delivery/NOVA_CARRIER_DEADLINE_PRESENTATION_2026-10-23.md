# Carrier deadline presentation — 23 October 2026

HAC-46 · `codex/carrier-authoritative-peru-deadline` → `main` · base `c5365eac7362d093b1f2132ab365b238b70f9034`.

## Problem and correction

Hosted acceptance of source `8db2fc89b34adeb07c4a652c72fa20f082324895` exposed a conversion error: C02 carried the correct signed deadline `2026-10-26T00:00:00.000Z`, but Nova answered **25 October 17:00 Peru**. Correct local time is **25 October 19:00 Peru (UTC−05:00)**. Its original answer only stated UTC and omitted the per-pallet weight.

The gateway now formats both deadline representations in deterministic Python from the same validated, server-signed `temporal.responseDeadline`: numeric full date, clock and explicit zone. The guidance asks Nova to read the precomputed Peru value first and UTC second, without converting again or substituting the session clock. Carrier summaries also request the recorded package count, per-unit weight and total when available, without inventing missing values.

This changes presentation hints only. Stored deadlines, status/role checks, offer consent, request versions, native business commands, session limits and cancellation behavior are unchanged. Unknown or expired snapshots do not gain authority or action permission.

## Required examples

| Case | UTC deadline | Authoritative Peru deadline | Commercial behavior |
|---|---|---|---|
| C01 expired | 22 Oct 2026 23:00 UTC | 22 Oct 2026 18:00 PET | No invitation to make a new offer; historical booking is unaffected |
| C02 open | 26 Oct 2026 00:00 UTC | 25 Oct 2026 19:00 PET | Explain the web review only; 10 pallets × 120 kg = 1,200 kg is recorded cargo, not live capacity |

Regressions cover both examples, year/month boundaries, equivalent offset input, missing/invalid/naive deadline and stale snapshots. The existing full gateway suite retains JWT, one-time authentication, framing, packaging and hard Carrier expiry checks.

## Local verification

- Gateway Python suite in Docker: **40 passed**, including the four new deadline-presentation regressions.
- Web temporal context, Carrier briefing and scope: **12 passed**.
- Full TypeScript check: passed.
- Docker gateway build and `git diff --check`: passed.
- New generated audio/human acceptance: not performed for this source; repeat after the accepted gateway update.

## Prior deployment evidence and current limit

The prior source `8db2fc8` was deployed to the existing service as task definition `default-cargomesh-nova-staging:6`, runtime digest `sha256:84713f5cfc38b2c00665e1390689138ec276cf6238900daab656a569c652d521`. Rollout `M2lq9Vtb2tvFnbykL47r7` completed 23 October 03:10 Peru. Health 200, authenticated ready/textInput, Spanish transcript and non-silent PCM were observed. No business commands were sent; complete opportunities/offers/bookings snapshots retained the same IDs and versions.

That observation proves the previous deployment and its acceptance defect, **not** acceptance of this new prompt. The new code is delivered by PR; it has not been published to ECR or deployed to AWS. Local deterministic tests do not guarantee generated speech. After source acceptance and a separately authorized gateway update, repeat both prompts below with fresh permissions and verify transcript/audio before closing the defect:

- C01: “¿Sigue abierto el plazo de respuesta? No prepares ni envíes ofertas.” Require the exact 23:00 UTC / 18:00 Peru deadline and refusal of a new offer.
- C02: “Resume la carga y dime hasta cuándo podemos responder. Solo explícamelo, no hagas cambios.” Require 10 × 120 kg = 1,200 kg and 25 October **19:00 Peru**, with the correct UTC equivalent and no claimed offer/booking.

The scenario is SIMULATED over fictitious C01 corridor points, not a real Lima–Arequipa operation. Preserve IAM, secret reference, origin, URL, command, port, network and scaling when updating the existing gateway. PR #163 (chat guidance and field feedback) is already merged and is not reopened by this change.
