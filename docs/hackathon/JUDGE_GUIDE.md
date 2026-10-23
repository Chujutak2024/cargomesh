# Judge testing guide

Web entry: **https://cargomesh.vercel.app/**. Choose **Explore Shipper** to open `/clients`, or **Explore Carrier** to open `/carriers`. No credentials need to be entered for these public demo entries. Both paths opened on 23 October 2026 in a new in-app browser tab without a login step. The [access record](JUDGE_ACCESS_2026-10-23.md) documents the steps, URLs, visible results and the remaining clean-profile check; it does not certify every product action.

## Suggested walkthrough

1. Open the home page. It shows “Every shipment. A clearer journey.” and the two workspace entries.
2. Choose **Explore Shipper**. After “Opening Client”, `/clients` shows the request copilot, shipment counts and recent synthetic activity.
3. Follow **Tracking** to `/clients/tracking`. Open an existing **Open tracking** link to inspect milestones and the planned route. On the observed active record, Booking was reported; departure and delivery were awaiting reports, with no reported position. A planned route is not live tracking.
4. Return to the home page and choose **Explore Carrier**. After “Opening Carrier”, `/carriers` shows the dashboard, recorded operations, fleet/site counts and operations map. Counts describe loaded records, not available capacity.
5. Inspect existing records only. Do not create a request, prepare or confirm an offer, confirm/cancel a booking, start transport, or change a record while exploring.

For the team's recorded conversational walkthrough, demonstrate a real question, capture/correction and structured review on the agreed synthetic case. Nova audio, microphone behavior and the complete video flow are **pending confirmation — Axel (voice) and Cristhian (final walkthrough/video)**. Preserve microphone opt-in, permissions and native commercial confirmation. Do not portray this read-only access check as that acceptance test.

Use synthetic records only. Do not launch real dispatch, start transportation or cancel an existing booking merely to explore. A read-only walkthrough is sufficient to inspect the interface; use the specific disposable case agreed in the submission for write testing.

## Expected boundaries

- No microphone permission is needed for a typed turn's audio reply; browser autoplay may need a user interaction.
- If the gateway lacks `textInput`, typed interaction uses the available fallback; this is not evidence that the newer AWS image is deployed.
- Countries/cities appear only if the relevant synthetic scenario was loaded. International city selection does not imply a supported cross-border/multimodal route.
- Permission failures remain failures. Visual profiles do not grant real organization/carrier access.
- The Web demo can be presented as a simulated Alexa+ experience under the event alternative; it is not an Echo/live Alexa integration.

Google basemaps rendered on the inspected Shipper tracking record and Carrier dashboard. The previously reported `RefererNotAllowedMapError` was not reproduced on these two views; this is not a claim that every referrer or route is fixed. PR #151's labeled schematic fallback is integrated in main, but its failure path was not triggered in this check. If maps fail, report the URL and exact message to **Juan**, with Cristhian coordinating; do not change cloud keys or permissions.

For local reproduction see [setup](../SETUP.md). For source-versus-hosted gaps see [status](../STATUS.md). The team must attach the final tested scenario, deployment and public video to Devpost before declaring judge readiness.
