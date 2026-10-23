# Current verification status

Reviewed **23 October 2026**, against `main` at `795c973e89993f7c76bf18a3c768049d8e65c6e2`, including PR #158's Kiro/AWS evidence package. PR #149 (typed-only continuous input) and PR #151 (map fallback and booked-route facts) are integrated. The [dated browser observation](hackathon/JUDGE_ACCESS_2026-10-23.md) checks public entry and selected reads only. This is a source/deployment boundary, not a live monitoring dashboard.

| Area | Evidence-backed state | Still requires verification |
|---|---|---|
| Web customer/carrier | Explore Shipper and Explore Carrier opened `/clients` and `/carriers` without entered credentials on 23 October; selected synthetic records loaded | Strict clean-profile repeat and fresh-checkout setup: pending confirmation — Jean. Full walkthrough/deployment identity: Cristhian |
| Business backend | REST/shared services for requests, coverage, planning, commercial workflow, fleet and identity | Exact hosted migration/scenario state and chosen end-to-end judge case |
| MCP | Registered intake and workflow tools with OAuth/confirmation code; local CI smoke exists | Actual remote negotiated protocol and hosted client acceptance |
| Nova transport | Historical 22 October evidence records revision 5, health 200, native ready/textInput:true and 5,085/8,035-byte grants accepted | Current AWS revision/image and human browser listening: pending confirmation — Axel; final recording: Cristhian |
| Typed-only Web source | PR #149 implements continuous silence without microphone permission; historical controlled transport probe completed audio with silence | Final browser bundle, autoplay/background behavior and complete conversation: pending confirmation — Axel; no voice turn was run in the access check |
| Maps | Google basemaps rendered on the inspected Shipper tracking and Carrier dashboard views; source includes PR #151's labeled fallback | Other referrers/routes and production degraded fallback: pending confirmation — Juan, coordinated by Cristhian; prior RefererNotAllowedMapError was not reproduced in those two views |
| International catalog | Guarded 32-facility addition; 35 total across 17 countries with Peru baseline | Authorized SQL apply, verify and tenant API readback; no worldwide coverage claim |
| Alexa+ | Self-hosted MCP implementation plus Web agent experience | No verified Alexa+/Echo live session; declare simulation if using the Web alternative |
| Kiro Crew | Authentic development evidence and attributable SQL contribution retained | Submit accurate Product Feedback and accessible evidence with primary-track entry |
| Open Source mini challenge | CargoMesh has an MIT license | Additional qualifying contribution URL/repository/user and explanation not established by this documentation audit |

The last documented AWS image is `92ec470-text-carrier`, task revision 5, digest `sha256:611b194e3a36e46b8623b9bc48420510955e383ed2af3c93a56dfa9f6db6732b`, observed on 22 October at 01:43 Lima. No current AWS deployment query was made on 23 October. The historical controlled text/audio round trip succeeded with digital silence; PR #149 supplies the browser stream in accepted source, with final browser acceptance still pending. [Rollout evidence](v2-amazon/delivery/evidence/nova/GATEWAY_92EC470_2026-10-22.md), [Web correction and acceptance script](v2-amazon/delivery/NOVA_TYPED_SILENT_STREAM_2026-10-22.md).

CI passed for PR #145 before merge. PR #146 supplies focused dashboard/briefing/authentication evidence in its integrated reference. Do not transfer any passing count to this documentation revision without rerunning the relevant command. See [testing](TESTING.md) for current commands and [submission checklist](hackathon/SUBMISSION.md) for missing delivery assets.

The preceding 22 October documentation refresh recorded local Markdown, UML/DER, QA source/matrix and architecture checks and regenerated the REST inventory without sending requests. Those historical results are not a test run for this revision. This judge-package change is documentation only; its own checks and actual PR CI are reported with the delivery. No application source, SQL, cloud configuration or environment values were changed.
