# WebMCP Comparative Analysis: LaporAI and CargoMesh

> **Purpose:** Internal design review of the WebMCP patterns visible in
> [LaporAI](https://lapor-ai-chi.vercel.app/) and CargoMesh. It identifies
> useful interaction patterns and possible improvements; it is not a benchmark
> or production proof.

> **Evidence boundary:** Andes, Inca, and Pacific expose five tools per provider
> page but currently share CargoMesh's Vercel origin. The cross-origin contract
> is covered by a synthetic harness; CargoMesh does not yet claim independently
> hosted partner deployments. Statements about LaporAI below summarize the
> implementation inspected during this internal review and should not be read as
> independently reproduced performance measurements.

---

## 1. Project overview

| Dimension | LaporAI | CargoMesh |
| :--- | :--- | :--- |
| Business domain | Cooperative assistant for Indonesian individual tax returns. | B2B freight discovery, comparison, booking, and recovery for LATAM road logistics. |
| WebMCP topology | Single-domain copilot whose available tools follow a form workflow. | Origin-gated, dynamic 0..N provider orchestration. Each discovered candidate preserves `providerUrl` and `matchingServiceId`. |
| Data architecture | Browser-oriented application state. | Next.js 15 with Supabase PostgreSQL, tenant-scoped RLS, server authorization, and optimistic concurrency. |
| Interaction model | Guided steps with visible human approval for proposed changes. | Typed provider pipeline, deterministic BALANCED ranking, explicit booking authorization, and human-confirmed recovery. |

## 2. WebMCP patterns observed in LaporAI

### 2.1 State-aware tool lifecycle

The reviewed implementation exposes only the tools relevant to the current
workflow stage and uses an `AbortController` to remove prior registrations when
the stage changes. This keeps the active tool surface aligned with visible UI
state.

### 2.2 Comparative testing surface

The application includes a dedicated evaluation experience for comparing manual,
screen-operated, and WebMCP-assisted completion. Its measurements belong to that
application and are not evidence of CargoMesh performance.

### 2.3 Visible proposals before mutation

Mutating actions are presented as proposals that the user can accept or reject.
This human-in-the-loop pattern avoids silent changes to sensitive form data.

### 2.4 Tool visibility in the UI

A visible WebMCP status and tool inspector help an evaluator distinguish the
current registered tool surface from historical execution evidence.

### 2.5 Strict schemas and annotations

The reviewed tools use closed JSON schemas and semantic annotations such as
`readOnlyHint` and `destructiveHint`. CargoMesh follows the same principle:
provider queries are read-only, while `book_freight` is explicitly mutating and
destructive.

### 2.6 Browser-side document processing

The reviewed application performs some document processing in a worker. This is
an application-specific privacy and responsiveness pattern, not a capability
required by CargoMesh's freight workflow.

---

## 3. Architectural comparison

| Aspect | LaporAI | CargoMesh |
| :--- | :--- | :--- |
| Agent topology | One application workflow with a state-aware tool surface. | Dynamic 0..N candidate collection; the three live demo providers currently share the CargoMesh origin. |
| Commercial orchestration | Sequential guided workflow. | Typed `coverage → capacity → quote` pipeline followed by deterministic six-dimension BALANCED ranking. |
| Exceptions | Form validation and visible proposals. | Technical failures remain distinct from commercial rejection; recovery requires an explicit alternative selection and confirmation. |
| Persistence | Browser-oriented state in the reviewed flow. | PostgreSQL with organization-scoped RLS, server-side authorization, idempotent bridges, and `draft_version` conflicts reported as `STALE_DRAFT`. |
| Evidence | Live tool inspector and application-specific comparison UI. | Provider-page `getTools()` diagnostic, persisted Judge Drawer evidence, automated suites, and sanitized UAT captures. |
| Human control | Approval before sensitive mutations. | Explicit recommendation-field consent, booking authorization, and recovery selection. |

---

## 4. Adopted lessons for CargoMesh

1. **Keep live state and historical evidence distinct.** The Judge Drawer shows
   persisted execution evidence; it must never imply that tools from an abandoned
   provider document remain registered.
2. **Expose a real provider diagnostic.** Each provider page checks
   `document.modelContext.getTools()` and reports the registered subset of the
   canonical five tools: `check_service_coverage`, `check_capacity`,
   `quote_freight`, `book_freight`, and `get_provider_booking_status`.
3. **Annotate intent explicitly.** Query tools use `readOnlyHint: true` and
   `book_freight` uses `readOnlyHint: false` plus `destructiveHint: true`.
4. **Explain the value without unsupported metrics.** WebMCP reduces the
   fragility of screen automation by consuming typed, origin-gated tools through
   `document.modelContext`, rather than depending on button positions, extracted
   DOM text, or click timing. CargoMesh does not claim measured latency or error
   improvements without a comparable benchmark.

---

## 5. Conclusion

LaporAI demonstrates a strong human-agent workflow with state-aware tools and
visible proposals. CargoMesh demonstrates a different pattern: dynamic provider
discovery, strict correlation, idempotent persistence, deterministic ranking,
and human-authorized booking and recovery. The current public demo proves the
same-origin provider implementation and the external-origin contract separately;
it does not present synthetic external fixtures as live logistics partners.
