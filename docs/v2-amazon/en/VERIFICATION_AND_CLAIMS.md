# Verification, human validation, and submission claims

This lightweight plan applies verification and validation to the hackathon schedule. It does not change an issue's approved scope, due date, state, or Definition of Done (DoD) in Linear by itself. The issue owner implements and corrects their work; QA verifies reproducibility; the integrator and Tech Lead follow the documented gate and approval flow. A green preview, PR, or test count is not proof that the product solves the user's problem.

## Two different checks

**Verification** asks whether the implementation satisfies its contract. Each code issue should link at least one traceable row: requirement/contract → test case and expected result → command, commit, version, and dataset → actual result → evidence → defect and rerun. Include negative and tenant-isolation cases appropriate to risk. If a case does not apply, say why. V1 WebMCP or `FR-1042` regression results are labeled V1; V2 scenarios use `supabase/scenarios/v2-*`.

**Validation** asks whether a person can complete the intended task and understand the result correctly. Use selective human tests for changes to a visible flow, copy/status, accessibility, carrier/route decision, booking consent, provider integration, Alexa, or the final demo. Pure schema/refactor work can use automation and expert review until a consumable flow exists. A team member's walkthrough is formative, not external-user validation.

## Human-test card

For each selected flow, record:

1. **Goal and actor:** what the shipper or operator attempts and the scenario assumptions.
2. **Setup:** commit/PR, authorized preview or local URL, V2 scenario, test account without exposed secrets, browser/device, and whether each integration is live, local, simulated, prototype-only, or blocked.
3. **Steps:** numbered user actions and exact setup commands only when needed. Never make a human tester run an improvised production migration or seed.
4. **Oracle:** visible expected behavior for success, loading, failure, `unknown`, and `ineligible`. A map ETA is an estimate, not a carrier offer or guaranteed delivery time. A local MCP test is not an Alexa+ invocation.
5. **Record:** `pass`, `fail`, `blocked`, or `not run`; date, evaluator role, sanitized screenshot/video or reproducible note, observed confusion, severity, owner, defect link, and result of the same-step retest.

Let a participant try the flow without steering them toward the correct button. If access is missing, mark the case blocked—not passed. If only a clickable prototype exists, label it prototype. An Alexa human test requires authorized channel access and an observed invocation; otherwise demonstrate only a labeled local or simulated path. Do not paste Bedrock credentials, tokens, map keys, or Kiro session files into issues or Drive.

## Gate focus by sprint

| Sprint | Verification focus | Proportionate human validation |
|---|---|---|
| 1 | Schema/RLS, MCP security, prototype, map data provenance, known-failure matrix | Unguided dashboard → intake → review prototype walk; interpret map states. Alexa/Bedrock only with actual access, otherwise declare blocked/fallback. |
| 2 | ROAD eligibility/capacity, account linking, V2 MCP, Web preview using the same scenario | One eligible and one unknown/ineligible case; Web and MCP must not promise coverage or quotes. Alexa only if an actual invocation can be observed. |
| 3 | Request → discovery → attributable offer → explainable ranking; data-change and negative cases | Compare known plans and exclusions; check that estimates do not look like quotes. |
| 4 | End-to-end authorization, audit, security, benchmark | Web plus Alexa or explicitly labeled simulation; error recovery and consent before booking. |
| 5 | Regression, setup, access, video/runtime consistency | Timed judge rehearsal without developer guidance; explain what is live, estimated, simulated, or pending. |

A blocked capability may be documented and omitted from the demo, but not marked complete or advertised as live. Medium/high defects return to the issue owner for a fix and rerun. At the end of each sprint, record accepted versus committed work, open severity, critical V2 scenarios passed versus executed (blocked separately), one human observation, and one improvement with an owner and date. These are lightweight engineering practices, not a CMMI, MoProSoft, or ISO certification claim.

## Evidence and claim ledger for the final submission

| Claim type | Required proof before stating it |
|---|---|
| MCP server | Submitted endpoint/code path, spec/version compatibility, authentication, executable tests, and observed use. |
| Alexa+ live | Authorized account link and real Alexa+ invocation of the submitted path, with sanitized recording/logs. A local MCP client is insufficient. |
| V2 carrier discovery | Versioned V2 scenario/catalog, eligibility changes for route/cargo/date, provenance and negative cases. V1 fixed carriers are insufficient. |
| Capacity and booking | Reservation/maintenance overlap tests, consent/audit trail, and attributable carrier offer; a plan candidate alone is insufficient. |
| Bedrock or AWS Builder | Actual service/Kiro Crew use, architecture/configuration, cost and sanitized evidence. Remove the claim if the integration did not run. |
| Token/latency improvement | Comparable baseline and repeated measurements with dataset/schema version and p50/p95. |
| Open Source entry | Additional licensed project or qualifying public contribution, URL, and concise technical explanation. |

All submitted video, written description, and code documentation must be in English or accompanied by an English translation under the [event rules](https://amazonappdev2026.devpost.com/rules). Review every linked document, README, diagram legend, and captured screen before freeze. This English package translates the core contracts, not all internal Spanish planning documents. Keep the final Devpost narrative synchronized with the exact submitted commit and demo recording.
