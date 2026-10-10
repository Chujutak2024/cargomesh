# Integration certification — CargoMesh V2, 9–10 October 2026

Scope authorized by Cristhian: reconcile current domain documentation and certify available real integrations. Product code inspected: `main @ 3ba9b95d4fcd72e933d2ea9587c5f634bf0b973f`. Delivery branch: `codex/v2-domain-integration-certification`, PR to `main`, registered in HAC-40 before creation. Identity implementation remains owned by HAC-41/Axel; independent UML coverage remains HAC-44/QA.

## Results and boundaries

| Integration | Observed evidence | Certification status |
|---|---|---|
| Supabase OAuth server | Public OpenID discovery returns 200 with the V2 issuer and S256 support. The earlier hosted PKCE/HTTP/MCP smoke at `29c385f` reached IN_PROGRESS (21/21). | **Earlier hosted QA flow verified.** This pass checks discovery and configuration inventory only; it is not a new authenticated end-to-end run on `3ba9b95`. |
| OAuth client / MCP access now | Hosted inventory: zero enabled OAuth clients, zero ACTIVE account links and zero ACTIVE carrier operators. QA preview protected-resource discovery redirects (302); production discovery returns 503 `temporarily_unavailable`. | **Current end-to-end access blocked.** The previous smoke intentionally disabled its disposable access. Discovery alone does not certify client consent, token validation or a commercial tool invocation. |
| Bedrock | Runtime Converse and Mantle adapters exist in `server/conversation/interpret.ts`. The local real-adapter probe reports `BLOCKED / BEDROCK_CONFIGURATION_MISSING_OR_DISABLED`; no AWS invocation took place. Vercel management inventory returns 403. | **Not certified live.** Missing accessible environment/model/credentials. Stubbed adapter tests and deterministic fallback do not count as a real AWS response. |
| External carrier API/MCP | Hosted `response_integrations` contains zero rows. The identity diagnostic intentionally reports `liveIntegrationConfirmed=false`; configuration references neither resolve secrets nor call a provider. | **Not implemented/certified as an external integration.** Requires a named provider, authorized sandbox, provider contract and a concrete adapter. |
| Manual carrier operation | Earlier hosted smoke used a real authenticated CarrierOperator and persisted workflow operations, with synthetic carrier, capacity and offer data. | **QA workflow verified with simulated business data.** This is not a connection to a transport company's system. |
| Alexa+ live | No authorized Alexa+ invocation in this evidence. | **Not certified.** A working MCP client or simulated UI does not establish Alexa+ access. |

Current read-only database inventory: **27 applied migrations; zero integration configurations, ACTIVE links, enabled OAuth clients and ACTIVE carrier operators**. No DDL, seeds, grants, sessions, tokens, deployment settings or aliases were changed during this review.

The earlier hosted execution, its cleanup and exact product SHA are preserved in [DTO deployment and hosted recheck](./uml-bd-api-2026-10-09/DEPLOY_Y_REPRUEBA_29c385f.md). Its result is not relabeled as a new run of the current product. F-02 remains partial; missing QA evidence is not automatically a missing implementation.

## Reconciled commercial contract

- Selection persists one plan and `1..*` valid attributable offers covering every assignment exactly once.
- A decision may have several bookings. Each booking references the decision and one selected offer, retaining the issuing carrier's responsibility.
- Shipper authorization, carrier confirmation and resource commitment remain separate facts.
- Local transactions, cancellation, release, optimistic concurrency and idempotent retry have workflow regression coverage. They do not provide distributed atomicity across external carriers.
- The updated Spanish domain/architecture contracts and English translations replace the obsolete single-offer restriction. Dated historical reports and original UML evidence are preserved.

## Opt-in real Bedrock check

From the application's `cargomesh/` directory, with an ignored, private `.env.local` containing the approved server configuration:

```powershell
node --env-file=.env.local --conditions=react-server --import tsx scripts/certify-bedrock.mts
```

Use the variable names in [`.env.example`](../../../cargomesh/.env.example). Runtime uses the existing temporary IAM credential chain; Mantle uses the existing server-only Bedrock key configuration. Do not paste credentials into the command, source, issue or chat. No key or endpoint change is required by this script.

The check invokes the **production interpreter adapter**, without an injected provider response, for one synthetic turn: `from Lima to Arequipa`. PASS requires `mode=BEDROCK`, validated route fields and positive provider token usage. It emits only configuration identifiers, outcome and bounded telemetry; no prompt, response content or credential. Missing configuration is BLOCKED, and fallback is a nonzero failure. Maximum output/timeout use the existing bounded interpreter configuration. Missing pricing yields `estimatedCostUsd=null`, not a zero-cost claim.

This certifies only the configured AWS adapter call. It does not certify authenticated Web HTTP, deployment, all model outputs, Alexa+, commercial tools, a latency benchmark or a token reduction claim. A provider invocation may incur its normal API cost. The local run here was blocked before invocation.

## Concrete remaining inputs

1. **Bedrock:** an accessible approved environment with region/model and temporary IAM credentials or Bedrock Mantle key. Run the check and retain its dated JSON; then exercise the authenticated Web endpoint against the exact deployed SHA for Web certification. Vercel access must be restored by its authorized operator; a 403 is not bypassed.
2. **OAuth client:** designate the client and callback/consent UI to certify. A new hosted PKCE/MCP run requires restoring approved disposable access and testing own/foreign/revoked identities, then closing that access. Do not reactivate historical fixtures silently. The existing Supabase QA result is already recorded separately.
3. **Carrier:** designate the actual provider and sandbox/contract. Implement its adapter under the existing verified-identity boundary, resolve server-only secret references and test valid response, rejection, timeout, replay and stale version. Preserve provider correlation, provenance and independent commercial states. A placeholder adapter cannot pass this gate.
4. **Alexa+:** obtain authorized client access and record an actual invocation if available. Otherwise demonstrate a clearly labeled MCP/simulated channel.

Credential location and provider availability were requested while documentation work continued. No provider or new access was supplied in this pass, so those cases remain blocked and are not counted as PASS.

## Verification of this increment

- TypeScript: PASS.
- HAC-40 tests: **66/66 PASS**, including exact multi-offer coverage and separate commitments.
- HAC-41 tests: **10/10 PASS**, including tenant boundary, explicit consent and refusing raw integration secrets.
- Conversation/interpreter tests: **58/58 PASS**; these use test dependencies and are not AWS certification.
- Real Bedrock probe: **BLOCKED**, missing/disabled local configuration; nonzero exit.
- Read-only hosted/public inventory: results above. No new authenticated hosted smoke.

Reference documentation: [Supabase MCP authentication](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication), [Amazon Bedrock API keys](https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys.html). These describe provider mechanisms; they are not evidence of CargoMesh integration.
