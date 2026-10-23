# Nova typed-only Web response needs a continuous stream

Date: 22 October 2026. Severity: **Important**. Environment: accepted main `92ec470`, AWS gateway task revision 5, image digest `611b194e3a36e46b8623b9bc48420510955e383ed2af3c93a56dfa9f6db6732b`, Strands 1.61.0 / Nova 2.5 Sonic. [Deployment evidence](../evidence/nova/GATEWAY_92EC470_2026-10-22.md).

## Task and reproduction

Use an authorized native Client session at the configured Vercel Origin. Obtain a fresh one-use voice grant, connect to `/voice`, send auth and wait for ready. Confirm `textInput:true`. Send one bounded informational `{type:"text",text:"..."}` turn without starting microphone/audio input. Do not execute a commercial action.

Expected: a completed spoken answer without requesting microphone permission. Actual: ready/text capability succeeds, but no audio or response completion within the 55-second bound. Repeat with 16-bit mono PCM digital silence (1,024 bytes per 32 ms at 16 kHz): the same text produces Spanish transcript, 307 audio frames and response_end. Neither test records microphone input or changes business data.

## Cause and correction boundary

The [official cross-modal guidance](https://docs.aws.amazon.com/nova/latest/nova2-userguide/sonic-cross-modal.html) requires continuous streaming. The installed Strands model starts its audio input container on the first AudioDelta; sending a string alone does not create that stream. At the observed revision, `NovaVoicePreview.start(false,false)` avoided microphone permission but provided no digital-silence stream. This limitation was independent of PR148's spoken quantity parsing fix and of JWT/context-size authentication.

The controlled probe's silence stream was a verified diagnostic workaround at the time of observation. A browser fix must keep the authenticated stream active while microphone capture is absent, avoid duplicate PCM when live capture runs, stop on disconnect/unmount/scope change, respect existing idle/session bounds, and never treat synthetic silence as user activity for automatic renewal. Preserve microphone opt-in and complete-response playback.

Product Feedback suggestion: make the continuous-input requirement and typed-without-microphone initialization explicit in SDK cross-modal examples. A ready connection and text support declaration alone are insufficient evidence of a completed text/audio round trip.

## Source correction and remaining acceptance — 23 October

[PR #149](https://github.com/Chujutak2024/cargomesh/pull/149) is integrated in main and implements the silence stream with existing lifecycle regression evidence. The original limitation is historical, not a claim that current source still lacks the fix. The [acceptance script](../NOVA_TYPED_SILENT_STREAM_2026-10-22.md) still requires observation of the final browser bundle, autoplay, long answers and background behavior. **Pending confirmation — Axel**, with Cristhian responsible for the final video. No new unit tests were added for this documentation update.
