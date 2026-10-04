# HAC-37 Web voice and Bedrock check — 2026-10-04

This is Web-channel evidence, not an Alexa+ invocation or a production deployment.

## Observed Bedrock console result

Axel ran Amazon Nova 2 Lite in the AWS Bedrock Playground with an English freight sentence. The visible response extracted Lima, Arequipa, 12 boxes and a draft-creation intent. The screenshot showed 224 input tokens, 1,083 output tokens and 4,763 ms latency. This proves a console model response only. The model incorrectly returned `missing_information: null` even though a precise date and cargo measurements were absent. CargoMesh must validate every model proposal and ask for missing details; a model response alone must not create a draft or decide ROAD eligibility.

## Local application status

The HAC-37 branch has a server-only Bedrock Converse interpreter behind `CARGOMESH_BEDROCK_CONVERSATION_ENABLED=false` by default. It accepts bounded input, validates the structured result with Zod, and falls back to deterministic interpretation on model or access failure. It requires temporary AWS session credentials. The local CLI read-only Bedrock query in `us-east-1` returned `AccessDenied` on 2026-10-04, so a CargoMesh-to-Bedrock invocation is **not verified**. Do not call the Web chat “powered by Bedrock” until an observed server invocation is recorded.

For a local test, an account administrator must provision a dedicated least-privilege temporary-credential profile with `bedrock:InvokeModel` for the selected authorized model in the chosen region. Keep root credentials and static keys out of the app and repository. Configure the local AWS profile for the server process, set `CARGOMESH_BEDROCK_REGION`, `CARGOMESH_BEDROCK_MODEL_ID`, and opt in with `CARGOMESH_BEDROCK_CONVERSATION_ENABLED=true` in ignored local environment configuration. Verify one bounded English turn through the authenticated Web chat; record model ID, region, input/output tokens, latency, redacted output, and whether fallback was used. Restore the flag to `false` when testing ends.

## Web voice behavior

In a browser with a working English Web Speech recognition engine, the user starts capture with the microphone button. A 1.4-second pause after recognized speech completes one turn; a browser end event cannot submit it twice. The transcript remains visible. Pressing **Stop listening** before the pause cancels auto-send and leaves it editable. The assistant speaks the completed response when speech synthesis is supported. Input and microphone controls are unavailable during playback; **Stop audio** releases them. Text remains the full fallback. Brave can expose microphone permission while lacking a usable English Web Speech engine; that condition is reported as unsupported rather than claiming voice works.

No physical-microphone browser test or Alexa+ invocation was observed in this check. A compatible device test remains required before claiming voice E2E success.
