# CargoMesh — Kiro Crew / AWS Builder evidence dossier

Reviewed October 23, 2026 (America/Lima). Owner: Axel Arista. Team acceptance: Cristhian Chujutalli.
Prepared and reviewed by Codex; not a new Kiro session. [HAC-30](https://linear.app/hackatonteamcargomesh/issue/HAC-30).

## Corrected contribution links

- [Kiro test contribution](https://github.com/Chujutak2024/cargomesh/commit/c212c627cf81e133b7bc1cfe7e0761b3dd3ed53f): `c212c627cf81e133b7bc1cfe7e0761b3dd3ed53f`.
- [Separate Codex correction and validation record](https://github.com/Chujutak2024/cargomesh/commit/81e0097723cec4888e62fd0e26558c7d3503e25c): `81e0097723cec4888e62fd0e26558c7d3503e25c`.

The previous full Kiro SHA omitted a "c" in the segment "b7bc1cfe". The corrected Kiro commit and SQL diff were retrieved successfully from GitHub on October 23 and matched local Git. Its change is one file, 119 insertions and one deletion, extending plan(9) to plan(14).

## What each contributor actually did

| Date / actor | Concrete action | Evidence and limit |
| --- | --- | --- |
| Oct 2 / Kiro Crew | Added five HAC-11 account-link security assertions (T10–T14). | Local session edit/commit records and GitHub diff. Original database execution blocked by unavailable Docker engine. |
| Oct 3 / Codex at Axel's request | Corrected the expired-link fixture and independently recorded isolated pgTAP 14/14. | Separate commit and historical execution record. Not a Kiro pass and not a current release gate. |
| Oct 3 / Kiro Crew | Reported typecheck and MCP 76/76 in a review. | Genuine UI reports retained; screenshots are not complete raw command logs. An unsupported authentication finding was rejected. |
| Oct 21 / Kiro Crew, reported by Axel | Read files and produced a reproducibility runbook. | Original document retained. No code change or executed tests claimed; primary session capture and final-SHA reproduction pending. |
| Oct 23 / Codex | Rechecked commit/source provenance, corrected links, edited feedback and this package. | Documentation/evidence audit only. No new Kiro execution, database test, deployment or team acceptance. |

Git Author is a repository identity, not proof of manual authorship or which assistant was used.

## Authentic evidence index

1. [Sanitized October 2 record](https://drive.google.com/file/d/1H4HXTiMyw1W2olxpaunnpDEV0RPi1hzS/view).
2. [Original Kiro UI: prior contribution](https://drive.google.com/file/d/1yseM6Xd7EenIOXU4CVSMI4ECnaeNhohl/view).
3. [Original Kiro UI: review and branch](https://drive.google.com/file/d/14-Nk-uYi3X3tX372KP_bOsFSbDMJ9Zny/view).
4. [Original Kiro UI: results and blocker](https://drive.google.com/file/d/1HlFcHpVcCd5LTka4iANx-eyoQfJbOYdQ/view).
5. [Independent Codex validation](https://drive.google.com/file/d/16edQeFFEhAH2W8dQZwkYS_G1rETlwUvB/view).
6. [Review distinguishing authorship and limits](https://drive.google.com/file/d/1-BXmmP4Gp2uRts79KcwiYR88IjlWbnLs/view).
7. [Original October 21 Kiro runbook](https://drive.google.com/file/d/1INqQoDplovHOEdRS3SMKrL4BCCNK-wfD/view).
8. [Separate Codex review of that runbook](https://drive.google.com/file/d/1LaCMIeCNJpGzgcnfC9Lvy40tADhLA16N/view).

The original Drive evidence is retained unchanged. This audit retrieved metadata/raw-file references for all three PNGs; it did not complete a new visual/redaction inspection because the local download host could not be resolved. Historical screenshot descriptions come from the existing review. No synthetic screenshot or reconstructed transcript is presented as original evidence.

The local Kiro JSONL was re-read selectively: it contains an edit record at 2026-10-02T21:16:44Z (16:16 Lima) with the purpose "Write the extended HAC-11 pgTAP test with the 5 missing assertion blocks", plus stage/commit records at 21:20:24Z and 21:26:30Z. This supports the tool attribution independently of Git Author. The raw file was not uploaded.

Its current full-file SHA256 is `92e0685fabb08e4c813cfbab7cbd19ac7eebbeb1b42b36a0e52d764513cade1a`. The older sanitized record reports a different hash of an earlier snapshot; we cannot treat those snapshots as identical. The raw session is an evolving private artifact and the earlier hash is not a hash of this revised dossier.

## AWS runtime evidence is separate

The October 22 deployment/probe records identify source `92ec4704b759db6f8104aaa32f38c22a2c9a7a82`, task revision 5 and digest `sha256:611b194e3a36e46b8623b9bc48420510955e383ed2af3c93a56dfa9f6db6732b`. They record a completed ECS rollout, health 200, authenticated ready/textInput true and an 8035-byte auth envelope accepted. A controlled informational text turn with digital silence returned 307 audio frames (794880 decoded bytes), a complete transcript and response_end, with no microphone input or commercial mutation.

[Rollout evidence PR #147](https://github.com/Chujutak2024/cargomesh/pull/147) and [separate frontend streaming fix PR #149](https://github.com/Chujutak2024/cargomesh/pull/149). These are dated observations, not a fresh October 23 deployment or a live Alexa+ invocation. The October 3 IAM denial is historical, not the current runtime conclusion. Kiro backend notices do not prove CargoMesh called Bedrock.

## Rules and delivery

[Official rules checked October 23](https://amazonappdev2026.devpost.com/rules): AWS Builder accepts documented Kiro Crew development-tool use on its own, alongside a primary-track entry. Product Feedback must explain tool/service use, strengths, issues, onboarding and willingness to use again. This dossier does not itself submit Devpost or guarantee eligibility.

## Remaining acceptance steps

- Axel confirms first-person feedback and the proposed willingness-to-use-again answers.
- Reconcile the October 21 runbook against the final demo SHA and execute it; retain real results.
- Attach a genuine primary capture of the October 21 session if relying on that additional session.
- Complete a final visual/redaction check and judge-access check on linked evidence.
- Cristhian accepts the package; the authorized representative submits the primary-track project and selects AWS Builder.
- Video, repository/testing access and feedback for other tools remain part of the main submission.

No Linear issue is declared Done and no submission confirmation is claimed.
