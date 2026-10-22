# AWS Builder mini challenge — Kiro Crew and Nova

The event's [official rules](https://amazonappdev2026.devpost.com/rules) explicitly accept Kiro Crew development use on its own for AWS Builder, alongside a qualifying primary-track project. A runtime Bedrock call is not additionally required to substantiate Kiro use.

## Authentic Kiro work

Kiro Crew extended the MCP account-link security pgTAP tests in commit [`c212c62`](https://github.com/Chujutak2024/cargomesh/commit/c212c627cf81e133b7bc1fe7e0761b3dd3ed53f). The sanitized [session record](../v2-amazon/delivery/evidence/hac-30/KIRO_CREW_HAC11_2026-10-02_REDACTED.md) identifies the task, artifact and result. The Crew session's database execution was blocked. A later **independent Codex** correction/run passed the assertions; see [execution evidence](../v2-amazon/delivery/evidence/hac-11/HAC11_LOCAL_AUTH_AND_PGTAP_2026-10-03.md). Do not attribute the later work to Crew or treat a Git author label as proof of manual human implementation.

The team also reported a Kiro Crew documentation review on 21 October producing a demo reproducibility runbook. That report alone is not a checked-in artifact in this source checkout. Add only the actual reviewed/sanitized document or session evidence; do not invent it or describe it as deployed code.

## Runtime AWS work

The gateway code uses Strands and Bedrock Nova, packaged for ECS/ECR with ALB TLS, a task role and Secrets Manager injection. [Voice guide](../VOICE.md) describes the actual runtime boundary. Earlier hosted transport/health observations exist, but they do not certify the latest image or human audio acceptance. Kiro's own internal model traffic is not a CargoMesh Bedrock invocation.

## Where this is delivered

Select **AWS Builder** on the same Devpost primary-track submission and describe Kiro/AWS usage in **Product Feedback**. Link this guide and accessible sanitized evidence. The rules do not prescribe `.kiro/`, a particular README heading, or a separate Kiro contest entry. GitHub is the reviewable documentation source; Drive can host supplementary authentic screenshots/video if judges have access.

Before submitting, check evidence URLs without relying on the owner's login. Add a real Kiro UI screenshot if available and obtain the team's review of attribution; do not recreate screenshots or publish raw session logs/secrets. The screenshot is a useful supporting artifact, not an extra mandatory rule invented by this guide.

## Product Feedback draft — team review required

We used Kiro Crew for a bounded CargoMesh MCP account-link security test task. It added negative pgTAP assertions with an identifiable code contribution. The session produced a focused change, but a tool-approval timeout and unavailable Docker engine blocked execution during that session. A separate Codex review corrected a fixture and ran the tests; we keep those results separately attributed. We would use Crew again for focused implementation and review with reproducible checks. CargoMesh additionally contains an AWS-hosted Nova voice gateway; its deployment and audio evidence are tracked separately from Kiro's development use.

This draft covers Kiro; complete the other used tools' feedback using [the feedback guide](PRODUCT_FEEDBACK.md). Do not claim the mini challenge is submitted or awarded merely because this file exists.
