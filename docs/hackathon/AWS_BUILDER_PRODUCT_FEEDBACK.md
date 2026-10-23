# CargoMesh — Product Feedback: Kiro Crew and AWS Builder
Editorial and evidence review: October 23, 2026 (America/Lima).
Prepared by Codex at Axel's request. This is reviewed submission text, not proof of team acceptance or a Devpost submission. The "use again" response below is a recommendation for Axel to confirm.

## Kiro Crew

What did we use, and for what?
We used Kiro Crew during the hackathon for a bounded CargoMesh security-test task. On October 2 it extended an existing MCP account-link pgTAP file from nine to fourteen assertions. The five added cases cover direct authenticated insertion, inconsistent revocation timestamps, zero lifetime, and visibility when organization membership is inactive. The source contribution is c212c627cf81e133b7bc1cfe7e0761b3dd3ed53f.

What worked well?
The scoped task produced a concrete one-file diff that we could inspect. Session records connect the tool's edit and commit actions to the test contribution. This made the contribution more useful to review than a design suggestion alone.

What needs work?
The original database run was blocked because Docker Desktop's Linux engine was unavailable. An approval prompt timed out, and backend throttling notices appeared. A later Kiro review also made an authentication finding that conflicted with the implementation; we did not accept it. We would like prerequisite checks, resumable approval requests, and file/line evidence for review findings. These observations do not establish a production incident or a measured productivity improvement.

How was onboarding?
Our local workflow required Docker, the matching V2 migration chain, and the guarded synthetic scenario. We did not record a zero-to-hello-world time. Early environment validation would have helped separate setup failures from test failures.

Would we use it again?
Recommended team response, pending Axel's confirmation: Yes, for scoped test additions, review and documentation, with human review and independent validation of important results.

Attribution and results
Kiro's October 2 database execution was blocked. In a separate session, Codex, acting at Axel's request, corrected the expired-link fixture and recorded an isolated 14/14 pgTAP pass. That correction and passing run belong to Codex, not Kiro. Both commits have a human Git identity; Author metadata alone does not identify the tool.
On October 21 Axel reported a separate Kiro documentation session and supplied its runbook. We retain it as a documentation artifact, with no code change or successful reproduction claimed. Its primary session capture and final-checkout reproduction remain pending.

## AWS runtime — separate from Kiro

What did we use, and for what?
Amazon Nova through Amazon Bedrock provides the conversational voice model. The Python gateway uses Strands SDK and runs on Amazon ECS, with its container image stored in Amazon ECR. This is separate from Kiro's development-tool use.

What worked well?
The October 22 controlled deployment record identifies source 92ec470, task revision 5 and an image digest. It records /healthz 200, authenticated ready with textInput true, and an 8035-byte authentication envelope accepted by the gateway. A separate informational text probe with synthetic silence received a complete Spanish transcript, 307 audio frames and response_end. No microphone audio or business mutation was sent.

What needs work?
A text-only turn without continuous PCM input produced no response within the probe window. Supplying digital silence enabled a spoken answer. The frontend fix was delivered separately in PR #149; this feedback does not establish its current merge or deployment state. Provider streaming prerequisites need clear documentation. Deployment/configuration checks and a model-response probe are both necessary; health alone is insufficient.

How was onboarding?
Setup involved an existing ECR/ECS service, execution and task roles, a secret reference, an allowed origin and port, and image build/push/deployment. The original October 19 attempt encountered an infrastructure-role access denial; subsequent evidence shows a completed rollout. No onboarding duration or cost saving was measured.

Would we use it again?
Recommended team response, pending Axel's confirmation: Yes, for contextual voice workflows, while retaining explicit user confirmation for business actions and separate tests for authentication, streaming and complete playback.

## Evidence
Kiro commit: https://github.com/Chujutak2024/cargomesh/commit/c212c627cf81e133b7bc1cfe7e0761b3dd3ed53f
Codex correction: https://github.com/Chujutak2024/cargomesh/commit/81e0097723cec4888e62fd0e26558c7d3503e25c
Sanitized Kiro record: https://drive.google.com/file/d/1H4HXTiMyw1W2olxpaunnpDEV0RPi1hzS/view
Independent historical validation: https://drive.google.com/file/d/16edQeFFEhAH2W8dQZwkYS_G1rETlwUvB/view
Kiro review and limits: https://drive.google.com/file/d/1-BXmmP4Gp2uRts79KcwiYR88IjlWbnLs/view
AWS rollout documentation: https://github.com/Chujutak2024/cargomesh/pull/147
Frontend streaming fix: https://github.com/Chujutak2024/cargomesh/pull/149

Scope: Kiro/AWS feedback for this package. Consolidate feedback for other tools in the main submission. Nova voice is not proof of a live Alexa+ invocation. Historical counts and October 22 probes are dated observations, not certification of today's runtime.
