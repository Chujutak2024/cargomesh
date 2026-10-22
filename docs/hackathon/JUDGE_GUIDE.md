# Judge testing guide

Web entry: **https://cargomesh.vercel.app/**. Customer: `/clients`; Carrier: `/carriers`. The source includes an optional fixed synthetic-account demo. If it is not enabled on the evaluated deployment, use the test access supplied privately in the Devpost testing instructions. This guide does not publish passwords or assert the current hosted login has been checked.

## Suggested walkthrough

1. Enter the customer workspace and inspect facilities and requests. Confirm whether the screen is connected or explicitly a visual/demo surface.
2. Open request capture. Ask a CargoMesh question, then describe pickup/delivery, cargo, measurements and a future date. Use cities present in the authorized facility catalog.
3. If Nova is enabled, activate audio and ask a typed question; the updated gateway should answer aloud. Activate the microphone separately to speak. Correct a detail and request a summary. Let the full answer finish.
4. Review the structured values and remaining requirements. A request is created/submitted only after the native confirmation flow. Unsupported coverage or missing data should be explained, not replaced with a fictional quote.
5. Switch to the carrier workspace using its authorized test identity. Inspect dashboard, opportunities, an offer and an order. Nova's opportunity briefing should reflect the scoped record; commercial actions remain explicitly confirmed.
6. Review fleet/sites/control tower. Synthetic graphics and scenario records are demonstration data, not live carrier telemetry or guaranteed capacity.

Use synthetic records only. Do not launch real dispatch, start transportation or cancel an existing booking merely to explore. A read-only walkthrough is sufficient to inspect the interface; use the specific disposable case agreed in the submission for write testing.

## Expected boundaries

- No microphone permission is needed for a typed turn's audio reply; browser autoplay may need a user interaction.
- If the gateway lacks `textInput`, typed interaction uses the available fallback; this is not evidence that the newer AWS image is deployed.
- Countries/cities appear only if the relevant synthetic scenario was loaded. International city selection does not imply a supported cross-border/multimodal route.
- Permission failures remain failures. Visual profiles do not grant real organization/carrier access.
- The Web demo can be presented as a simulated Alexa+ experience under the event alternative; it is not an Echo/live Alexa integration.

For local reproduction see [setup](../SETUP.md). For source-versus-hosted gaps see [status](../STATUS.md). The team must attach the final tested scenario, deployment and public video to Devpost before declaring judge readiness.
