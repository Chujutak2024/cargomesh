# Submission checklist and delivery

The official [rules](https://amazonappdev2026.devpost.com/rules) are controlling. Checked 22 October 2026. This guide is a delivery checklist, not a claim that the entry has been submitted or accepted.

## Timing

Submission closes **23 October 2026, 12:00 PDT = 14:00 America/Lima (19:00 UTC)**. Judging is **9–20 November 2026** (end: 12:00 Pacific / 15:00 Lima on November 20, after the US daylight-saving change). Keep judge access free and available through judging. Winner announcement is around December 3; it is not the submission deadline or proof of an automatic infrastructure shutdown.

## What belongs where

| Material | Location in repository | Delivery through Devpost |
|---|---|---|
| Product narrative and technical setup | Root README, product/setup/architecture guides | Text description, repository URL and testing instructions |
| Working demo | [Judge guide](JUDGE_GUIDE.md) | Demo URL and any private testing credentials through the intended judge instructions |
| Video | Public YouTube/Vimeo upload | Video URL; keep it under three minutes |
| Alexa+ path | [Alexa+ guide](ALEXA_PLUS.md) | Select primary track and identify real MCP/client path or explicit Web simulation |
| Kiro/AWS usage | [AWS Builder/Kiro](AWS_BUILDER_KIRO.md) and linked evidence | Select AWS Builder; explain use in Product Feedback and provide accessible evidence links |
| Additional open source | [Open Source](OPEN_SOURCE.md) | Contribution URL, project URL, GitHub username and explanation |
| Friction | [Feedback index](PRODUCT_FEEDBACK.md) and sanitized reports | Optional Friction Log fields/evidence; not just a disconnected Drive folder |

The rules prescribe no mandatory GitHub directory name for Kiro. This repository uses `docs/hackathon/` for discoverability. Do not import requirements from the separate Code with Kiro contest or fabricate `.kiro/specs` artifacts to imply a workflow that did not happen.

## Final form review

- [ ] Representative/team and chosen categories are correct.
- [ ] Description explains problem, users, working features, architecture and limitations; for an existing project, explain significant hackathon-window updates.
- [ ] Repository URL exposes source/assets/setup; public repo has detectable open-source license, or required private judge access is configured.
- [ ] Public English video (or English translation) demonstrates the real experience under three minutes; rights for included assets/music are cleared.
- [ ] Testing instructions work from a fresh browser and fresh checkout, with no developer-only path or undisclosed credentials.
- [ ] AWS Builder Product Feedback distinguishes Kiro development use from Nova runtime use and from Codex work.
- [ ] Open Source fields identify an actual eligible additional artifact; otherwise do not mark it completed.
- [ ] Product Feedback covers each used developer tool/API/SDK; selected friction reports include reproducible task/steps/results/severity/workaround/suggestion.
- [ ] Source commit, Web deployment, AWS image and scenario used in video agree; avoid promising pending rollout as working.
- [ ] Submit the entry before the deadline and retain Devpost's confirmation privately. This repository is not that confirmation.

The private/public repository access options and judge usernames are listed in the official rules; verify those current instructions before sharing a private repository. Do not commit passwords, grants, credentials, private account IDs or raw tool transcripts to satisfy judge access.
