# Nova and C01: verification and spoken draft correction

## Scope and observed production state

The user requested checking AWS voice/text/corrections/draft filling and completing the C01 vehicle/driver assignments, without starting transportation. Verification used native authenticated CargoMesh APIs. No new order, booking, reservation, resource or assignment was created.

### C01 operations: already complete

The latest native read supersedes the earlier report of zero assignments. Booking `01f64c87-6483-4c51-8809-67b93589a252` is CONFIRMED; execution `f1502f63-16f4-4535-82e9-25652362c733` is PLANNED, with actual start/end null. Two distinct vehicles C01_SIM_V1_T1/T2 and two distinct synthetic drivers are already CONFIRMED on that execution. Each vehicle links to its corresponding confirmed reservation and 6,000 kg / 7.776 m³ allocation. Assignment and reservation windows match: 2 November 2026, 08:00–14:30 PET. The two assignments per kind are unique; no overlapping confirmed assignment to another execution was observed. Existing assignments were preserved, with zero writes.

### AWS: capabilities verified, source revision unknown

The gateway `/healthz` returns200 and an authenticated Vercel WebSocket grant reaches `ready`. The current handshake does not advertise `textInput`; written Nova turns are unavailable in the web channel's capability contract. The health response does not expose an image digest or source SHA, so this check cannot identify the ECS revision or certify the PR146 prompt. AWS remains Axel's deployment responsibility.

### Actual synthetic audio test

Two generated PCM speech recordings were streamed to the live AWS voice endpoint. Input speech was English using the only installed system voice; Nova was asked to reply in Spanish. This is a controlled synthesized-audio test, not a human microphone/browser acceptance test.

Nova returned Spanish transcripts and audio: ten pallets of dry rice, 100kg each and 1,000kg total; correction to twelve pallets, 1,200kg and 12m³, preserving 1×1×1m per pallet. It acknowledged that no order was saved. Both recorded audio responses contained audio frames. No typed turn or commercial command was sent.

## Real defect and correction

Replaying those real user transcripts through the production interpretation endpoint and shared UI validators left quantity10, weight blank and dimensions blank. The active interpretation mode is DETERMINISTIC. Spoken quantities beyond ten, compound weights and individually named axes were not captured even though Nova understood them verbally.

The correction normalizes bounded English/Spanish integer quantities in measurement contexts and short numeric answers. It captures explicit per-unit weight stated before the number, grounds speech guards against the same normalization and accepts complete labeled dimensions while retaining per-unit versus whole-shipment ambiguity. Original transcripts remain unchanged. No model response is treated as user evidence, and group total weight is not converted into per-unit weight.

Replaying the same transcripts through the corrected local native endpoint plus shared UI validators produces quantity12, weight per unit100kg, total1,200kg, dimensions100×100×100cm, volume per unit1m³ and total12m³. No draft was saved. This verifies native interpretation and shared filling logic; the browser component was not inspected per the user's visual-review instruction.

## Checks and remaining acceptance

- 37 targeted quantity/interpretation/measurement/guard tests passed; typecheck and architecture passed.
- The new quantity suite is included in `test:v2-conversation`; measurement/guard checks are already in the conversation CI chains.
- Hosted rollout of this correction needs the authorized main/Vercel flow. AWS requires its accepted text-input-capable image; no AWS resources were changed here.
- After deployment, a person tests Spanish microphone input, correction and visible draft in Vercel. No request should be saved without explicit review and consent.

Sanitized local evidence: `salida/nova-c01-closeout-20261022/{session-handshake,NOVA-AUDIO-RESULT,DRAFT-RESULT,DRAFT-LOCAL-RESULT,C01-RESULT}.json`.
