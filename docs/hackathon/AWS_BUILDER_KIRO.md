# AWS Builder mini challenge — Kiro Crew and Nova

The event's [official rules](https://amazonappdev2026.devpost.com/rules) explicitly accept Kiro Crew development use on its own for AWS Builder, alongside a qualifying primary-track project. A runtime Bedrock call is not additionally required to substantiate Kiro use.

## Reviewed participation package — 23 October 2026

- [Evidence dossier](../v2-amazon/delivery/evidence/hac-30/KIRO_AWS_BUILDER_DOSSIER_2026-10-23.md): corrected GitHub commit, contribution/result matrix, authentic evidence links and limits.
- [Reviewed Product Feedback](AWS_BUILDER_PRODUCT_FEEDBACK.md): Kiro, Nova/Bedrock, Strands, ECS and ECR, organized by the submission questions.
- [Sanitized provenance audit](../v2-amazon/delivery/evidence/hac-30/KIRO_EVIDENCE_AUDIT_2026-10-23.json): allowlisted session-event metadata and verified commit identity; no raw transcript, inputs, outputs or secrets.

This is evidence supporting the team's AWS Builder entry, not confirmation of Devpost submission, eligibility acceptance or an award. Axel owns the material; Codex prepared the editorial/evidence review. Team endorsement of subjective feedback and final screenshot/access review remain pending.

## Authentic Kiro work

Kiro Crew extended the MCP account-link security pgTAP tests in commit [`c212c62`](https://github.com/Chujutak2024/cargomesh/commit/c212c627cf81e133b7bc1cfe7e0761b3dd3ed53f). The sanitized [session record](../v2-amazon/delivery/evidence/hac-30/KIRO_CREW_HAC11_2026-10-02_REDACTED.md) identifies the task, artifact and result. The Crew session's database execution was blocked. A later **independent Codex** correction/run passed the assertions; see [execution evidence](../v2-amazon/delivery/evidence/hac-11/HAC11_LOCAL_AUTH_AND_PGTAP_2026-10-03.md). Do not attribute the later work to Crew or treat a Git author label as proof of manual human implementation.

The team also reported a Kiro Crew documentation review on 21 October producing a demo reproducibility runbook. That report alone is not a checked-in artifact in this source checkout. Add only the actual reviewed/sanitized document or session evidence; do not invent it or describe it as deployed code.

## Runtime AWS work

The gateway code uses Strands and Bedrock Nova, packaged for ECS/ECR with ALB TLS, a task role and Secrets Manager injection. [Voice guide](../VOICE.md) describes the actual runtime boundary. Earlier hosted transport/health observations exist, but they do not certify the latest image or human audio acceptance. Kiro's own internal model traffic is not a CargoMesh Bedrock invocation.

## Where this is delivered

Select **AWS Builder** on the same Devpost primary-track submission and describe Kiro/AWS usage in **Product Feedback**. Link this guide and accessible sanitized evidence. The rules do not prescribe `.kiro/`, a particular README heading, or a separate Kiro contest entry. GitHub is the reviewable documentation source; Drive can host supplementary authentic screenshots/video if judges have access.

Before submitting, check evidence URLs without relying on the owner's login. Add a real Kiro UI screenshot if available and obtain the team's review of attribution; do not recreate screenshots or publish raw session logs/secrets. The screenshot is a useful supporting artifact, not an extra mandatory rule invented by this guide.

## Product Feedback — reviewed text and team endorsement

Use the [reviewed English feedback](AWS_BUILDER_PRODUCT_FEEDBACK.md). It separates Kiro's blocked database execution from the independent Codex fixture correction and historical 14/14 result. The willingness-to-use-again answers are proposed for Axel to confirm, not attributed to him without endorsement.

The [feedback guide](PRODUCT_FEEDBACK.md) covers other used tools and the entry-form requirements. Preserve the dated evidence boundaries; documentation alone does not establish the final hosted state.
