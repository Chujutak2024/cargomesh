# HAC-30 · Bedrock IAM check · 2026-10-03

An AWS CLI credential was available in this local environment. `aws sts get-caller-identity` succeeded in a read-only check; its response was suppressed, and no account identifier, ARN, token or key was recorded.

The following read-only Bedrock query was run in `us-east-1`, with the model list and AWS error text suppressed from the shared output:

```powershell
aws --no-cli-pager bedrock list-foundation-models --region us-east-1 --query 'length(modelSummaries)' --output text
```

Result: **`AccessDeniedException`**. Therefore `bedrock:ListFoundationModels` is still blocked for the credential available here. `bedrock:InvokeModel`/Converse permission and model quota were **not verified**; no runtime model invocation was attempted and there are no real Bedrock token, latency or output metrics to report. Promotional credits and a valid AWS identity do not imply Bedrock access.

The CargoMesh narration adapter exists behind `CARGOMESH_BEDROCK_NARRATION_ENABLED` and remains off by default. The tested deterministic SSML fallback is the active path. Bedrock must not determine eligibility, ranking, price or booking. The AWS account administrator must review the narrowly scoped IAM/model access before a future bounded sandbox call; this file is evidence of a blocked permission, not evidence of Bedrock integration.
