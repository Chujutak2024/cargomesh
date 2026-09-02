# CargoMesh — Team Execution Checklist

> **Version:** 1.4.0 — active delivery and release status
> **Last reconciled:** 2026-09-02 against `main@ea3e37b`
> **Team:** A (WebMCP), B (product/UI), C (data, security, and integration)
> **Full history:** [checklist v1.2](CargoMesh_Team_Execution_Checklist_v1.2_History.md)

## 1. Purpose and source hierarchy

This document answers only four questions: what is integrated, what remains,
who owns it, and what evidence closes each gate. It does not redefine contracts
or replace Git history.

Order of authority:

1. code, migrations, and tests integrated into `main`;
2. [ADR-001 — Provider Registry](../00-master/ADR-001_Dynamic_Provider_Registry.md)
   and [ADR-002 — D1 recommendations](../00-master/ADR-002_D1_Intake_Recommendations.md);
3. executable TypeScript/SQL contracts linked in section 4;
4. this checklist for ownership, status, and gates;
5. Pull Requests for evidence and review;
6. historical documents for context, never for deciding current status.

Status rules:

- `[x]` means integrated and verified in `main`.
- `[ ]` means pending, even when a branch or approved PR exists.
- An open PR neither changes a contract nor completes a task.
- Only C, as Integration Owner, closes gates and updates the integrated record.
- A and B report results through PRs and an AI/Developer Handoff.

## 2. Demonstrable outcome

An authenticated organization creates or edits a `FreightRequest`, can query a
read-only historical recommendation through WebMCP, and explicitly decides which
fields to apply. CargoMesh discovers `0..N` registered services, navigates to the
exact `matchingServiceId`, executes the five provider tools, persists results,
calculates BALANCED, enables selection and booking, and preserves replay/recovery
without duplicates.

```text
Persisted FreightRequest
→ optional WebMCP recommendation + consent
→ discovery 0..N
→ providerUrl + matchingServiceId
→ coverage → capacity → quote
→ Result Bridge → CarrierOffer[]
→ BALANCED → selection
→ book_freight → status
→ replay / rejection / recovery
```

Carriers, organizations, and synthetic history are demo data. They are not
presented as real commercial integrations. Offers, decisions, bookings, and
events for the evaluated journey are created during execution.

## 3. Current ownership

| Member | Ownership | Boundaries |
|---|---|---|
| **A** | provider pages, WebMCP registration/runtime, external navigation, provider fixtures, and tool evidence | does not modify scoring, privileged persistence, or B-owned screens without coordination |
| **B** | landing, visual authentication, dashboard, intake, dispatch, selection, booking UI, i18n, and map | does not duplicate discovery/scoring or use client state as authorization |
| **C** | server-side Supabase, RLS, discovery, bridges, BALANCED, reset, deployment, and integration | does not absorb provider handlers or UI; critical changes require cross-review |

Shared files—`package.json`, the root layout, shared contracts, and environment
variables—require prior notice. No temporary ownership reassignment is active.

## 4. Canonical contracts: link, do not copy

The following definitions are the executable sources. They are not copied into
this checklist because a copied contract inevitably drifts from runtime.

| Boundary | Canonical source |
|---|---|
| `CandidateProvider`, `ProviderPageConfig`, `ProviderToolEnvelope` | [`frontend/src/features/providers/contracts.ts`](../../frontend/src/features/providers/contracts.ts) |
| provider booking and status | [`frontend/src/features/providers/provider-booking-contracts.ts`](../../frontend/src/features/providers/provider-booking-contracts.ts) |
| Booking Bridge | [`frontend/src/features/booking/contracts.ts`](../../frontend/src/features/booking/contracts.ts) |
| orchestration and ViewModel | [`frontend/src/features/orchestration/contracts.ts`](../../frontend/src/features/orchestration/contracts.ts) |
| BALANCED | [`frontend/src/features/decision-engine/contracts.ts`](../../frontend/src/features/decision-engine/contracts.ts) |
| recommendation draft | [`frontend/src/features/recommendations/recommendation-draft-contracts.ts`](../../frontend/src/features/recommendations/recommendation-draft-contracts.ts) |
| manual intake | [`frontend/src/features/freight-requests/manual-intake-contracts.ts`](../../frontend/src/features/freight-requests/manual-intake-contracts.ts) |
| schema/RLS | [`supabase/migrations`](../../supabase/migrations) and the `docs/02-database` contracts |

Release invariants:

- providers and discovery are generic `0..N`; carrier names exist only as fixtures;
- `matchingServiceId` is preserved from discovery through the provider and Result Bridge;
- the five provider tools use real WebMCP, `AbortSignal`, explicit `exposedTo`, and cleanup;
- `get_freight_request_recommendations` is a read-only CargoMesh tool, not a
  sixth mandatory tool on every carrier;
- recommendation ≠ application ≠ confirmation ≠ selection ≠ booking ≠ acceptance;
- Result Bridge and Booking Bridge remain separate and idempotent;
- BALANCED uses 25% cost, 25% reliability, 20% ETA, 10% availability,
  10% route experience, and 10% organization history;
- FR-1042 preserves the `89/84/72` regression and confidence `88`.

## 5. Consolidated state in `main`

### 5.1 Historical technical baseline

| Gate | Status | Evidence summary |
|---|---|---|
| Contracts + WebMCP vertical (`G0/G1`) | ✅ | PR #1, #2, #5, #6, and #8 |
| Headless + visual decision (`G2A/G2`) | ✅ | PR #9, #10, #12, #14, #16, #17, and #21; BALANCED `89/84/72` |
| Booking + recovery (`G3`) | ✅ | PR #20, #23, #24, and #26; replay, rejection, and recovery without duplicates |
| Demo Auth/RLS | ✅ | PR #30, #31, #32, and #33; server-side session and membership |

The detailed chronology remains in the
[v1.2 history](CargoMesh_Team_Execution_Checklist_v1.2_History.md). Prompts and
blockers from those days are not active tasks.

### 5.2 Integrated D1 slice

- [x] **D1-01 — Authenticated, editable, persisted intake**
  - PR #35 and #43: resolution by organization and real `requestCode`.
  - PR #50 and #51: authenticated writer, `draftVersion`, server-side totals, and UI.
  - PR #52: `entryMethod` payload, mounted runner, and canonical document codes.
  - PR #53: LATAM directory, structured route, and reactive sidebar.

- [x] **D1-02 — Read-only WebMCP recommendations with explicit application**
  - PR #39, #40, and #42: ADR, WebMCP runtime, modal, authenticated PATCH,
    `STALE_DRAFT`, canonical recalculation, and cleanup.

- [x] **D1-03 — Coherent scenarios and real dashboard**
  - PR #37 and #38: local-only 1/1/0 cases, synthetic history, and
    domestic/cross-border coverage without pre-created runtime data.
  - PR #44: organization requests and derived metrics with a legitimate empty state.

- [ ] **D1-04 — Revalidate the integrated journey on the release SHA**
  - The required code is integrated. A clean-browser journey after #52/#53 using
    a request other than FR-1042 still needs to be executed.
  - It must demonstrate persistence/reload, recommendation or legitimate absence,
    provider tools, ranking, booking/replay/recovery, and cleanup without manually
    preparing results.
  - This evidence can be collected as part of REL-01; it does not require another
    feature PR.

## 6. Active work and closing order

| Order | Task | Owner | Status | Completion |
|---:|---|---|---|---|
| 1 | `DOC-01` — checklist v1.4, BALANCED, and REL-01 | A; reviewed by C | PR #45 | documents reconciled with the real SHA |
| 2 | `B-I18N-01` — EN/ES selector, English by default | B; reviewed by A/C | pending | consistent landing/login, persisted locale, Auth unchanged |
| 3 | `B-MAP-01` — corridor map | B; reviewed by A/C | pending | route/state derived from request/events; simulation disclosed |
| 4 | `SCN-EXP-01` — expanded scenarios/fleet | A/C | PR #47/#49 Draft | integrate only when seed, provider fixtures, and verification agree |
| 5 | `D1-04 / REL-01 / G4` — freeze and public UAT | C coordinates; A WebMCP; B UX | pending | section 7 matrix passes on one deployed SHA |
| 6 | `REL-02` — Devpost materials | B; A/C provide evidence | PR #29 Draft | copy, screenshots, and video match the validated SHA |

PR #18 is a historical A-04 proposal already materialized by PR #20. It must not
be integrated automatically; it should be closed or marked superseded.

i18n and the map may proceed in parallel, but they must not change Auth, RLS,
WebMCP contracts, matching, scoring, or persisted states. The map does not block
G4 when the team classifies it as a visual enhancement rather than a Golden Flow
requirement.

## 7. D1-04 and REL-01/G4 criteria

The final run must record:

1. the exact HTTPS URL and deployed SHA;
2. a clean browser compatible with `document.modelContext`;
3. real login and `ACTIVE` membership;
4. request creation/editing and preservation after reload;
5. WebMCP recommendation with consent or legitimate absence;
6. discovery `0..N` with exact `providerUrl` and `matchingServiceId`;
7. `getTools()` plus coverage, capacity, quote, booking, and status execution;
8. Result Bridge, three Golden Flow offers, BALANCED `89/84/72`, and confidence 88;
9. idempotent replay, controlled conflict, rejection, and recovery;
10. cleanup without provider tools after leaving each page;
11. empty/error/NO_MATCH states without fabricated offers;
12. `test:release`, typecheck, build, pgTAP, db lint, and secret scan on the
    same SHA, or an explicit explanation for any difference.

Do not publish IDs, tokens, cookies, emails, or keys. Screenshots and JSON must be
sanitized. Only the operator authorized by C may run a remote reset.

## 8. Short multi-AI protocol

Before modifying:

```text
1. Read AGENTS.md, README, the applicable ADR, and this checklist.
2. Inspect git status, branch, origin/main, and dependent PRs.
3. Identify ownership and executable sources.
4. Confirm scope and acceptance criteria.
```

Required handoff:

```text
- Task ID / objective
- branch, base, SHA, and PR
- affected files and contracts
- tests and evidence
- risks or limitations
- blockers and next owner
```

An AI must not trust status copied from chats or historical documents without
checking it against `origin/main`, PRs, and executable sources.

## 9. Documentation governance

| Type | Purpose | Rule |
|---|---|---|
| `AGENTS.md` | agent invariants | concise, executable, and free of schedules |
| Master/ADR | vision and durable decisions | no daily PR status |
| Code/SQL contracts | executable truth | override copied examples |
| Checklist | status, ownership, and gates | updated after verifying `main` |
| Evidence/handoff | proof for one slice | includes date, SHA, and scope |
| History | context | explicitly labeled as non-current |

Active and materially updated canonical documents are written in English. Historical
documents may remain in Spanish when they are clearly labeled and do not act as the
current source of truth.

Do not create parallel plans for the same work. If this checklist starts growing
with copied contracts, daily prompts, or reports, link or archive that content
instead of duplicating it.
