# HAC-38 — Alexa+ MCP add-on development preparation

**Status:** package copy prepared; no Alexa+ add-on, hosted MCP endpoint, account link or Alexa-originated invocation has been observed. This document belongs to the HAC-38 MCP branch and does not change the HAC-37 Web PR.

## Supported first release

Name: **CargoMesh Freight Assistant**. Locale: `en-US`. The add-on should expose only the executable V2 tools `get_v2_intake_options`, `create_v2_freight_request`, `get_v2_freight_request`, and `evaluate_v2_road`. Alexa+ is the conversational MCP client; CargoMesh resolves the linked user, organization and scopes server-side and calls the same application services as Web. Creating a draft requires complete validated fields and explicit customer confirmation. ROAD returns `eligible`, `ineligible` or `unknown` with source and reasons. No tool offers a carrier price or makes a booking.

Suggested English listing copy:

- Short description: `Prepare a freight request and check preliminary ROAD eligibility with CargoMesh.`
- Full description: `CargoMesh helps an authorized shipper describe a freight request, clarify missing details, review a draft, and check preliminary ROAD eligibility. It explains unknown or unavailable evidence. It does not quote prices or reserve freight.`
- Example phrases: `Help me prepare a ROAD freight request.`; `I need to ship machinery from Lima to Arequipa next week.`; `Read my saved freight draft.`; `Check ROAD eligibility for my draft.`

## Verified preflight on 2026-10-04

- HAC-38 controlled MCP HTTP client test passed 36/36, including the V2 create/read/evaluate path and authorization failures. This is not an Alexa+ call.
- `node --version` returned `v24.14.1`. The Alexa AI CLI is not installed.
- `npm view @alexa-ai/cli version --json --prefer-online` against public npm returned HTTP 404. Amazon's setup guide configures a private CodeArtifact registry for `@alexa-ai/*`; the public registry cannot be used as proof that the CLI is unavailable.
- A credential-safe `aws sts assume-role` probe using the existing temporary `cargomesh-bedrock` profile was denied: the dedicated IAM user lacks `sts:AssumeRole` for Amazon's `AddOn3PDeveloperToolsRead` role. No access key was created or printed.
- The Alexa+ Developer Console at `/alexa/console/ask/addons#/` displayed `Coming Soon` in the user's account. This does not prove that CLI onboarding is unavailable.

## Exact remaining sequence

1. Grant the dedicated IAM user only `sts:AssumeRole` on `arn:aws:iam::372468808636:role/AddOn3PDeveloperToolsRead`, after confirming this role and the account's Alexa+ program access with Amazon. Re-test role assumption with temporary credentials; do not use root or create long-lived access keys merely to install the CLI.

   Minimal proposed inline statement for `cargomesh-hackathon-local`:

   ```json
   {
     "Effect": "Allow",
     "Action": "sts:AssumeRole",
     "Resource": "arn:aws:iam::372468808636:role/AddOn3PDeveloperToolsRead"
   }
   ```

   This permission alone does not guarantee that the Amazon-owned role trusts this account; the follow-up `assume-role` result is the gate.
2. In a supported macOS or Ubuntu environment with Node 24+, configure the private CodeArtifact registry as Amazon documents, install `@alexa-ai/cli`, then run `alexa-ai configure` with the registered **Amazon Developer** account. Windows support is not stated in Amazon's setup guide; this Windows host's WSL availability has not been verified.
3. Bring up a separate, non-production V2 HTTPS preview for `/mcp`, with V2 profile, request-scoped user Bearer validation, resource metadata and OAuth authorization-code/PKCE account linking. Verify the hosted URL and redirect URIs. Never substitute `localhost`, the frozen V1 production domain or an unverified placeholder.
4. Create the MCP add-on package in `en-US` using the verified HTTPS `/mcp` URL. Fill privacy/terms URLs and required raster assets with reviewed public artifacts. Keep it in Alexa development stage.
5. Link an authorized CargoMesh test user and run the Alexa+ Web Simulator. Record an Alexa-originated initialize/list/call trace, the linked tenant and scopes, a draft confirmation, and a ROAD result with redacted evidence. Only then claim Alexa+ operation.

The official [MCP quickstart](https://www.developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-quickstart.html) defines the add-on package and remote HTTPS requirement. The [development setup](https://www.developer.amazon.com/docs/alexaplus/add-ons/set-up-your-development-environment.html) describes the private CLI registry and role setup. AWS credits and the existing USD 1 budget alert are not a spending cap; this preparation made no deployment or Bedrock call.
