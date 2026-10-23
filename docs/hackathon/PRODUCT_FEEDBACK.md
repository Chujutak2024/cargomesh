# Product Feedback and friction

Product Feedback belongs in the Devpost submission. For each used developer tool/API/SDK state its purpose, what worked, onboarding, limitations/workarounds, and whether the team would use it again with reasons. [Official requirements](https://amazonappdev2026.devpost.com/rules).

Use the [reviewed Kiro/AWS feedback](AWS_BUILDER_PRODUCT_FEEDBACK.md) and [evidence guide](AWS_BUILDER_KIRO.md) for authentic Crew attribution. Cover the actual Strands/Bedrock voice work and other tools used in the presented build separately. Do not report unmeasured latency, token savings or a tested deployment from configuration alone.

## Evidence to select

| Record | What it supports |
|---|---|
| [Kiro session friction](../v2-amazon/delivery/friction-logs/FL-03-KIRO-CREW-HAC11-PGTAP.md) | Approval/environment issue during authentic Crew work |
| [Gateway retest](../v2-amazon/delivery/friction-logs/NOVA_GATEWAY_RETEST_2026-10-21.md) | Short-envelope positive control, expanded-context rejection, later rollout evidence and read-only inspection limit |
| [Typed-only continuous streaming](../v2-amazon/delivery/friction-logs/NOVA_TEXT_STREAMING_2026-10-22.md) | Timed-out text-only control versus completed audio with silence; integrated PR #149, final browser acceptance pending |

These **three entries** are the selected judge package. Each provides the task, steps, expected/actual result, severity, workaround and suggestion in English. They are historical observations with explicitly dated follow-up, not new test executions. Kiro's later Codex run remains separately attributed.

The earlier [typed-turn report](../v2-amazon/delivery/friction-logs/NOVA_TYPED_TURNS_2026-10-21.md) overlaps the more specific streaming record and is omitted to avoid duplicate feedback. The [OAuth boundary note](../v2-amazon/delivery/friction-logs/HAC41_OAUTH_CHANNEL_BOUNDARY.md) is not selected: it concerns CargoMesh channel acceptance and does not supply a comparably complete AWS/Kiro task-result-workaround record. Other internal visual/deployment reports are outside this focused selection; no missing friction has been invented.

Additional genuine reports remain under `docs/v2-amazon/delivery/friction-logs/`. Select relevant, actionable entries rather than submitting all internal visual iteration notes.

Each submitted friction entry should include: task, environment/version, reproduction steps, expected/actual behavior, severity, workaround and actionable suggestion. Sanitize account identifiers, signed grants, tokens, passwords and personal data. Review English translations for any Spanish evidence included in the final submission. The possible judging bonus is discretionary, not guaranteed by creating logs.
