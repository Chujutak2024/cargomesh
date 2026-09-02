# CargoMesh Agent Invariants & Governance Rules

This file defines the priority instructions that every agent working in this
repository must follow, including Antigravity and Codex.

## 1. Supabase Migrations vs. Scenario Seeds

- **NEVER add test data**—including demo trucks, carriers, or shippers—to
  `supabase/migrations/`.
- `supabase/migrations/` is exclusively for structural DDL such as `CREATE TABLE`,
  `ALTER TABLE`, columns, indexes, constraints, and RLS policies. Everything in
  this directory can be applied to the remote production project through
  `supabase db push`.
- All synthetic test/demo data must live in
  `supabase/scenarios/<scenario-name>/seed.sql` or in `supabase/seed.sql`.

## 2. WebMCP Providers & Technical Honesty

A carrier can be described as an operational WebMCP provider only when it has:

1. a Next.js `/providers/[carrierSlug]` route;
2. its five tools registered through `document.modelContext`;
3. capacity fixtures in
   `frontend/src/features/providers/provider-capability-fixtures.ts`;
4. quote rates in `frontend/src/features/providers/quote-freight-tool.ts`.

A carrier that exists only in the database must be documented as
**Scenario Data / Roadmap**, never as a live provider tool integration.

## 3. Branch Flow & Release Deadline

- The final delivery is imminent. Keep `origin/main` green at all times.
- Work ownership:
  - **Role A:** WebMCP tools and runtime (`feat/a-*`)
  - **Role B:** UI, intake form, landing, i18n, and map (`feat/b-*`)
  - **Role C:** data layer, RLS, concurrency, and integration (`codex/c-*`)
  - **Antigravity:** integration support, audits, pairing, blocker resolution,
    and alignment
- Before running any linked Supabase command, verify the current directory,
  branch, and linked project.
- Before pushing work intended for `main`, run `npm run typecheck` and reconcile
  the branch with the latest `origin/main` according to the agreed PR workflow.

## 4. Commercial Contracts

- `freight_requests` uses optimistic concurrency through `draft_version`.
- Deterministic BALANCED weights are 25% cost, 25% reliability/SLA, 20% ETA,
  10% availability, 10% route experience, and 10% organization history.
  The executable source is
  `frontend/src/features/decision-engine/contracts.ts`.
- The canonical FR-1042 Golden Flow from Callao to Santiago preserves the
  official scores: Andes 89, Inca 84, and Pacific 72.

## 5. Documentation Language

- New and materially updated active/canonical documentation is written in
  English for the WebMCP Challenge review audience.
- Historical evidence may remain in Spanish when translating it would not
  improve the active release path. It must be labeled as historical and must not
  act as the current source of truth.
- Translation must preserve identifiers, schemas, states, percentages, and
  acceptance criteria. A translation is never authorization to change a
  contract.
