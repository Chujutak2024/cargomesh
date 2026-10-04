# HAC-37 Web voice and Bedrock check — 2026-10-04

This is Web-channel evidence, not an Alexa+ invocation or a production deployment.

## Observed Bedrock console result

Axel ran Amazon Nova 2 Lite in the AWS Bedrock Playground with an English freight sentence. The visible response extracted Lima, Arequipa, 12 boxes and a draft-creation intent. The screenshot showed 224 input tokens, 1,083 output tokens and 4,763 ms latency. This proves a console model response only. The model incorrectly returned `missing_information: null` even though a precise date and cargo measurements were absent. CargoMesh must validate every model proposal and ask for missing details; a model response alone must not create a draft or decide ROAD eligibility.

## Local application status

The HAC-37 branch has a server-only Bedrock Converse interpreter behind `CARGOMESH_BEDROCK_CONVERSATION_ENABLED=false` by default. It accepts bounded input, validates the structured result with Zod, and falls back to deterministic interpretation on model or access failure. It requires temporary AWS session credentials. An earlier local CLI read-only Bedrock query in `us-east-1` returned `AccessDenied`. Axel subsequently provisioned the dedicated `cargomesh-hackathon-local` IAM user with MFA, temporary CLI login and a Nova 2 Lite scoped invoke policy. On 2026-10-04, `aws sts get-caller-identity --profile cargomesh-bedrock` showed that IAM user rather than root. AWS Budgets showed an active monthly USD 1 budget, with the email recipient verified and a real-cost alert above USD 0.01. The budget is an alert, not a spending cap.

One bounded Bedrock Runtime CLI smoke invocation then succeeded using `--profile cargomesh-bedrock --region us-east-1` and the US inference profile `us.amazon.nova-2-lite-v1:0`. The prompt was `Reply with exactly OK.` and `maxTokens` was 16. AWS returned `OK.`, 51 input tokens, 3 output tokens and 365 ms model latency. This verifies IAM permission and a real model call; it does **not** verify a CargoMesh server-to-Bedrock call, authenticated Web chat, or Alexa+. No static access key was created or recorded. Cost was not asserted because current model pricing and credit application were not measured from billing. Do not call the Web chat “powered by Bedrock” until an observed server invocation is recorded.

For a local test, an account administrator must provision a dedicated least-privilege temporary-credential profile with `bedrock:InvokeModel` for the selected authorized model in the chosen region. Keep root credentials and static keys out of the app and repository. Configure the local AWS profile for the server process, set `CARGOMESH_BEDROCK_REGION`, `CARGOMESH_BEDROCK_MODEL_ID`, and opt in with `CARGOMESH_BEDROCK_CONVERSATION_ENABLED=true` in ignored local environment configuration. Verify one bounded English turn through the authenticated Web chat; record model ID, region, input/output tokens, latency, redacted output, and whether fallback was used. Restore the flag to `false` when testing ends.

## Web voice behavior

In a browser with a working English Web Speech recognition engine, the user starts capture with the microphone button. A 1.4-second pause after recognized speech completes one turn; a browser end event cannot submit it twice. The transcript remains visible. Pressing **Stop listening** before the pause cancels auto-send and leaves it editable. The assistant speaks the completed response when speech synthesis is supported. Input and microphone controls are unavailable during playback; **Stop audio** releases them. Text remains the full fallback. Brave can expose microphone permission while lacking a usable English Web Speech engine; that condition is reported as unsupported rather than claiming voice works.

No physical-microphone browser test or Alexa+ invocation was observed in this check. A compatible device test remains required before claiming voice E2E success.
