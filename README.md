# CargoMesh ⬡

> **Autonomous Agentic Freight Orchestration for Cross-Border B2B Logistics**  
> *Technical Specification v5.6.0 — Google WebMCP Challenge 2026*

[![WebMCP Challenge 2026 Submission](https://img.shields.io/badge/WebMCP_Challenge_2026-Submission-8C6316?style=for-the-badge&logo=google-chrome&logoColor=white)](https://webmcp.devpost.com/)
[![Contract v5.6.0](https://img.shields.io/badge/Contract-v5.6.0_FINAL-3178C6?style=for-the-badge&logo=semantic-release&logoColor=white)](docs/00-master/CargoMesh_Planeacion_WebMCP_FINAL.md)
[![Protocol](https://img.shields.io/badge/Protocol-Browser_Native_WebMCP-38B2AC?style=for-the-badge&logo=w3c&logoColor=white)](https://github.com/Chujutak2024/cargomesh)
[![Backend](https://img.shields.io/badge/Backend-Supabase_PostgreSQL_RLS-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)

---

## 📑 Specification Metadata

| Parameter | Specification Value |
|:---|:---|
| **Project Name** | **CargoMesh Network** |
| **Document Version** | `v5.6.0` *(Dynamic Provider Registry Alignment)* |
| **Root Commercial Entity** | `FreightRequest` *(Dedicated B2B Freight Demand)* |
| **Core Protocol** | **WebMCP Browser-Native API** (`document.modelContext.registerTool`) |
| **Transport Mode & Service** | **ROAD / FTL** *(Full Truckload, Dedicated Capacity)* |
| **Demo Corridor** | **Callao / Lima, Peru $\longrightarrow$ Santiago, Chile** *(International Cross-Border Pan-American Corridor)* |
| **Operational Currency** | **USD ($)** |

---

## 🚀 WebMCP Challenge 2026 Submission

CargoMesh is an agent-native B2B freight orchestrator for LATAM. It discovers a
dynamic `0..N` carrier network and lets a browser agent quote, compare, book,
and recover freight directly through registered carrier web applications using
WebMCP (`document.modelContext`). The agent coordinates the workflow; carrier
tools provide structured commercial responses, and a deterministic engine—not
an LLM—produces the ranking.

### Five provider tools

| Tool | Annotation | Role in the provider pipeline |
|---|---|---|
| `check_service_coverage` | `readOnlyHint: true` | Verifies corridor, transport mode, service type, cargo category, and cross-border support. |
| `check_capacity` | `readOnlyHint: true` | Verifies weight, volume, special requirements, pickup window, and delivery deadline. |
| `quote_freight` | `readOnlyHint: true` | Returns the correlated price, breakdown, transit time, availability class, documents, and quote validity. |
| `book_freight` | `readOnlyHint: false`, `destructiveHint: true` | Submits an authorized, idempotent booking request for the selected provider offer. |
| `get_provider_booking_status` | `readOnlyHint: true` | Returns provider status, payment state, location, ETA, and deduplicated lifecycle events. |

The evaluator procedure, exact JSON contracts, Golden Flow payloads, recovery
causality, and cleanup check are documented in the
[WebMCP Judge Audit Guide](docs/04-execution/WebMCP_Judge_Audit_Guide.md).

WebMCP reduces the fragility of screen-based automation: CargoMesh consumes
typed, origin-gated tools through `document.modelContext` instead of depending
on button positions, DOM text extraction, or click synchronization.

### Decoupled architecture

| Layer | Technology | Responsibility and trust boundary |
|---|---|---|
| Frontend and provider portals | Next.js 15, React 19 | Authenticated intake, dynamic `/providers/[carrierSlug]` documents, WebMCP registration/execution, dispatch, booking, and Judge Drawer. |
| Data and authorization | Supabase, PostgreSQL 17, Auth, RLS | Organization isolation, versioned migrations, server-side authorization, and optimistic draft concurrency through `draft_version`. Privileged credentials never enter the client bundle. |
| Result Bridge | Next.js server routes + PostgreSQL | Validates run, carrier, `providerUrl`, `matchingServiceId`, tool identity, envelope, and timestamps before idempotent persistence. |
| Decision Engine | TypeScript `BALANCED` | Ranks any eligible `0..N` offer collection deterministically: 25% cost, 25% reliability, 20% transit, and 10% each for availability, route experience, and organization history. |

### Documentation map

| Area | Source of truth |
|---|---|
| `docs/00-master` | [Dynamic Provider Registry ADR](docs/00-master/ADR-001_Dynamic_Provider_Registry.md) |
| `docs/01-requirements` | [Requirements Catalogue](docs/01-requirements/CargoMesh_Catalogo_Requisitos.md) |
| `docs/02-database` | [Supabase Data Contract](docs/02-database/CargoMesh_Supabase_Data_Contract.md) |
| `docs/03-ux-ui` | [Devpost Screenshot Capture Plan](docs/03-ux-ui/screenshots/README.md) |
| `docs/04-execution` | [WebMCP Judge Audit Guide](docs/04-execution/WebMCP_Judge_Audit_Guide.md) and [Team Execution Checklist](docs/04-execution/CargoMesh_Team_Execution_Checklist.md) |

---

## 📖 Table of Contents

1. [WebMCP Challenge 2026 Submission](#-webmcp-challenge-2026-submission)
2. [Executive Summary & Official North Star](#-executive-summary--official-north-star)
3. [Canonical Transparency Declaration & Causality Rule](#-canonical-transparency-declaration--causality-rule)
4. [Architectural Triad & Strict Separation of Concerns](#-architectural-triad--strict-separation-of-concerns)
5. [The Four Data Classes](#-the-four-data-classes)
6. [Transactional Decoupling & The Result Bridge](#-transactional-decoupling--the-result-bridge)
7. [Deterministic Decision Engine & Balanced Formulas](#-deterministic-decision-engine--balanced-formulas)
8. [Decision Confidence Score & Anomaly Guard](#-decision-confidence-score--anomaly-guard)
9. [International Golden Flow Scenario Matrix](#-international-golden-flow-scenario-matrix)
10. [Database Schema Architecture](#-database-schema-architecture-15-domain--2-observability-tables)
11. [WebMCP Tool Contract Specification](#-webmcp-tool-contract-specification)
12. [Acceptance Test Summary](#-73-point-acceptance-test-summary)
13. [Repository Structure Map](#-repository-structure-map)

---

## ⚡ Executive Summary & Official North Star

**CargoMesh** is an agent-native B2B freight orchestration platform. Unlike e-commerce marketplaces (which start with a product, purchase, and consumer delivery), CargoMesh operates on **pre-existing B2B cargo** that needs heavy freight transport from origin to destination without monolithic human intermediation.

CargoMesh is designed as an open B2B trucking marketplace: any verified carrier can be added to the provider registry with its service coverage and WebMCP endpoint. The Golden Flow seeds three carriers to make the demo deterministic, but discovery, orchestration, ranking, selection, and booking always operate on a variable `0..N` candidate set.

> **Architecture invariant:** Andes, Inca, and Pacific are demo fixtures—not a hardcoded provider list. See [ADR-001: Dynamic Provider Registry](docs/00-master/ADR-001_Dynamic_Provider_Registry.md).

> **Team coordination:** Ownership, build milestones, verification checkpoints, and the multi-AI handoff protocol live in [CargoMesh Team Execution Checklist](docs/04-execution/CargoMesh_Team_Execution_Checklist.md).

### The Official North Star:
> *"An authenticated enterprise creates a `FreightRequest`; the AI agent navigates participating carrier websites via WebMCP, retrieves real structured responses from deterministic provider fixtures, CargoMesh validates and persists those results into its database, the customer selects an eligible alternative, the carrier confirms or rejects the booking, and the system maintains operational continuity through live milestone tracking or guided recovery."*

```mermaid
graph TD
    A["🏢 Authenticated Organization (ACME Mining)"] --> B["📋 Confirmed FreightRequest (FR-1042)"]
    B --> C["🚀 Start Orchestration Run"]
    C --> D["🔎 Discover Registered Compatible Carriers (0..N)"]
    D --> E["🌐 Agent Navigates Discovered provider_url Endpoints"]
    E --> F["🛠️ Provider WebMCP Tools"]
    F --> G["📦 Structured Provider Results"]
    G --> H["🌉 CargoMesh Result Bridge (record_provider_result)"]
    H --> I["💾 CarrierOffers Persisted (DB Runtime)"]
    I --> J["⚖️ Deterministic Decision Engine (BALANCED)"]
    J --> K["✨ OPTIONS_READY (Recommendations Presented)"]
    K --> L["👤 Human Selection / Smart Auto Policy"]
    L --> M["📑 book_freight() Provider Request"]
    M --> N["⏳ PENDING_PROVIDER_CONFIRMATION"]
    N -->|CONFIRMED| O["📍 Live Tracking & Customs Timeline (get_provider_booking_status)"]
    N -->|REJECTED / EXPIRED| P["🔄 Guided Recovery Run (Fresh Provider Evaluation)"]
    O --> Q["🏁 DELIVERED (COMPLETED)"]
```

---

## 🛡️ Canonical Transparency Declaration & Causality Rule

### 1.1 Canonical Declaration of Transparency
> **"Carrier base data and responses are deterministic demo fixtures residing in carrier web pages. WebMCP tool execution, structured result transfer, database persistence, mathematical scoring, human selection, booking lifecycle, provider acknowledgement, and recovery mechanisms are 100% real."**

### 1.2 Strict Causality Rule (Anti-Fake Demo)
In CargoMesh, the database seed initializes **only the baseline environment** (organization account, active member, cargo categories, carriers, services, and historical metrics).

**The runtime commercial tables start completely empty for `FR-1042`:**
```text
carrier_offers       = EMPTY
freight_decisions    = EMPTY
bookings             = EMPTY
booking_events       = EMPTY
orchestration_runs   = EMPTY
orchestration_events = EMPTY
```
These entities are **born strictly and exclusively** through the real runtime execution of the agent browsing carrier web pages and invoking WebMCP tools.

---

## 🏛️ Architectural Triad & Strict Separation of Concerns

To prevent Large Language Model hallucinations in mission-critical commercial logistics, CargoMesh enforces a strict three-tier decoupled architecture:

```mermaid
flowchart LR
    subgraph WebMCP ["🌐 WebMCP Layer (document.modelContext)"]
        W1["Exposes structured capabilities directly from carrier web pages"]
        W2["Answers: 'What can this web app do and how can an agent invoke it structuredly?'"]
    end

    subgraph Agent ["🤖 AI Agent Layer"]
        A1["Natural language comprehension, missing data extraction, workflow synthesis"]
        A2["Answers: 'What does the shipper need, what tools to visit, and how to communicate?'"]
    end

    subgraph Engine ["⚖️ Heuristic Decision Engine"]
        E1["Strict mathematical hard constraint filtering, (0-100) normalization, scoring & confidence"]
        E2["Answers: 'What is the objective, reproducible, and auditable ranking of eligible carriers?'"]
    end

    WebMCP <--> Agent
    Agent <--> Engine
```

---

## 📦 The Four Data Classes

CargoMesh strictly segregates data origin and mutability into 4 isolated classes:

```text
1. BOOTSTRAP DATA
   └── Registered Organization, Members, Organization Cargo Profiles, Cargo Categories, Carrier Profiles, Services, Historical Corridor Metrics.

2. DEMO SCENARIO
   └── Controlled initial state of FreightRequest FR-1042 (Callao/Lima, PE → Santiago, CL, 8,000 kg FTL, PENDING).

3. PROVIDER FIXTURES
   └── Deterministic browser-side responses attached to registered demo carriers. Andes, Inca, and Pacific are the Golden Flow seed, not a platform limit.

4. RUNTIME DATA
   └── Dynamically generated database rows: carrier_offers, freight_decisions, bookings, booking_events, orchestration_events.
```

---

## 🔄 Transactional Decoupling & The Result Bridge

### 2.3 Transactional Decoupling Formula
$$\text{recommended\_offer\_id} \neq \text{selected\_offer\_id} \neq \text{book\_freight}() \neq (\text{get\_provider\_booking\_status}() = \text{CONFIRMED})$$

- `recommended_offer_id`: Computed deterministically by the Heuristic Engine.
- `selected_offer_id`: Explicit commercial choice made by the authorized human shipper (or authorized policy).
- `book_freight()`: Formal submission of a booking intent to the provider via WebMCP.
- `get_provider_booking_status() == CONFIRMED`: Binding carrier acknowledgement that locks dedicated transport.

### 3.2 Idempotent Ingestion: The Result Bridge (`record_provider_result`)
WebMCP returns structured data to the agent in memory. CargoMesh implements a secure server-side bridge function `record_provider_result` to persist results:
- Validates correlation between `orchestration_run_id`, `carrier_id`, and `schema_version`.
- Guarantees strict idempotency via `tool_call_id UNIQUE` and `UNIQUE(orchestration_run_id, carrier_id, provider_offer_reference)`.
- Simultaneously writes `orchestration_events` (for judge observability) and `carrier_offers` (for commercial evaluation).

---

## 🧮 Deterministic Decision Engine & Balanced Formulas

### 3.3 Canonical Normalization Formulas (BALANCED Strategy P0)

$$\text{Final Score} = \text{round}\left( 0.25 \cdot S_{\text{cost}} + 0.25 \cdot S_{\text{reliability}} + 0.20 \cdot S_{\text{eta}} + 0.10 \cdot S_{\text{availability}} + 0.10 \cdot S_{\text{route}} + 0.10 \cdot S_{\text{history}}, 0 \right)$$

| Dimension | Weight | Canonical Normalization Formula | Operational Meaning |
|:---|:---:|:---|:---|
| **Cost Score** ($S_{\text{cost}}$) | **25%** | `(lowest_eligible_price / candidate_price) * 100` | Cheapest eligible carrier receives 100 pts. |
| **Reliability Score** ($S_{\text{reliability}}$) | **25%** | `(successful_trips / completed_trips) * 100` | Derived directly from verified historical trip logs. |
| **ETA Score** ($S_{\text{eta}}$) | **20%** | `(best_transit_hours / candidate_transit_hours) * 100` | Fastest transit time receives 100 pts. |
| **Availability Score** ($S_{\text{availability}}$) | **10%** | `AVAILABLE (90) | LIMITED (60)` | Carrier fleet certainty class in origin hub. |
| **Route Experience** ($S_{\text{route}}$) | **10%** | `min(100, completed_route_operations)` | 1 point per completed operation, capped at 100. |
| **Organization History** ($S_{\text{history}}$) | **10%** | `org_success_rate | 50 (neutral fallback)` | Neutral score (50) when no prior shipper history exists. |

---

## 🎯 Decision Confidence Score & Anomaly Guard

### 3.4 Decision Confidence Formula
$$\text{Decision Confidence} = 0.25 \cdot \text{Completeness} + 0.20 \cdot \text{Certainty} + 0.20 \cdot \text{Evidence} + 0.15 \cdot \text{Separation} + 0.20 \cdot \text{Safety}$$

- **Data Completeness (100 pts)**: Verified presence of all mandatory request and provider fields.
- **Constraint Certainty (100 pts)**: 100% of applicable hard constraints verified as `PASS`.
- **Historical Evidence (96 pts)**: $\min(100, \text{operations}) \times (\text{success\_rate} / 100) = 100 \times 0.96 = 96$.
- **Candidate Separation (25.46 pts)**: $\min\left(100, \frac{\text{Top Score} - \text{Second Score}}{20} \times 100\right) = \frac{89.2949 - 84.2031}{20} \times 100 = 25.46$.
- **Anomaly Safety (100 pts)**: Price deviation $\le +30\%$ against historical average.
- **Golden Flow Decision Confidence Result**:
  $$0.25(100) + 0.20(100) + 0.20(96) + 0.15(25.46) + 0.20(100) = \mathbf{88.02} \longrightarrow \mathbf{88 / 100}$$

### Price Anomaly Guard:
$$\text{price\_deviation\_pct} = \frac{\text{quote\_price} - \text{historical\_avg}}{\text{historical\_avg}} \times 100$$

If $\text{price\_deviation\_pct} > +30\% \implies \text{requires\_review} = \text{true}$, blocking autonomous execution.

---

## 🏆 International Golden Flow Scenario Matrix

**Corridor**: Callao / Lima, Peru $\longrightarrow$ Santiago, Chile (3,300 km Road FTL)  
**Cargo**: 10 Pallets $\times$ 800 kg = 8,000 kg (Mining Spare Parts), Budget: $2,000 USD, Strategy: `BALANCED`.

| Carrier Candidate | Vehicle / Capacity | WebMCP Quote & Transit | Historical SLA | Availability Class | Raw Score $\rightarrow$ Display Score |
|:---|:---|:---|:---|:---|:---:|
| 🥇 **Andes Freight** | **Scania R450 (18,000 kg)** | **$1,760 USD · 31h** | **100 trips · 96% SLA** | **AVAILABLE (90)** | **$89.29 \longrightarrow \mathbf{89}$ (WINNER)** |
| 🥈 **Inca Logistics** | Volvo FH (24,000 kg) | $1,920 USD · 29h | 50 trips · 98% SLA | AVAILABLE (90) | $84.20 \longrightarrow \mathbf{84}$ |
| 🥉 **Pacific Cargo** | Freightliner (15,000 kg) | $1,590 USD · 60h | 50 trips · 86% SLA | LIMITED (60) | $72.17 \longrightarrow \mathbf{72}$ |

---

## 🗄️ Database Schema Architecture (15 Domain + 2 Observability Tables)

```
cargomesh/
├── Business Domain Tables (15):
│   ├── organizations                    # Shipper corporate profiles & verified emails
│   ├── organization_members             # Authorized members & Supabase Auth bindings
│   ├── organization_preferences         # Default strategies, thresholds, auto-recovery flags
│   ├── organization_cargo_profiles      # Frequent cargo templates and suggested vehicle classes
│   ├── cargo_categories                 # Standardized cargo taxonomy (General, Machinery, etc.)
│   ├── freight_requests                 # Core freight intent, weights, dimensions & status
│   ├── carriers                         # Open registry of transport providers (0..N)
│   ├── carrier_services                 # Corridor coverage, mode, capacity & customs support
│   ├── carrier_service_cargo_categories # Authorized category compatibility map
│   ├── vehicles                         # Fleet units (Scania R450, Volvo FH, Freightliner)
│   ├── carrier_metrics                  # Global & organization-specific SLA statistics
│   ├── carrier_offers                   # WebMCP runtime offers (born during orchestration)
│   ├── freight_decisions                # Immutable evaluation snapshots & ranking versions
│   ├── bookings                         # Binding reservations & provider references
│   └── booking_events                   # Append-only milestone timeline with provider_event_id dedupe
│
└── Technical Observability Tables (2):
    ├── orchestration_runs               # Execution run tracker (INITIAL, RECOVERY)
    └── orchestration_events             # Raw WebMCP tool invocations, inputs, outputs & latencies
```

---

## 🛠️ WebMCP Tool Contract Specification

All carrier WebMCP tools implement a strict common envelope:

- **Success**: `{ "ok": true, "data": { ... } }`
- **Technical Failure**: `{ "ok": false, "error": { "code": "...", "message": "...", "retryable": true } }`
- **Commercial Rejection / Expiration**: Returns `{ "ok": true, "data": { "providerBookingStatus": "REJECTED" } }` *(Commercial rejections are valid business responses, not execution crashes)*.

The registered tool inventory is summarized at the top of this README. See the
[WebMCP Judge Audit Guide](docs/04-execution/WebMCP_Judge_Audit_Guide.md) for
the exact input/output schemas and evaluator-ready `getTools()` / `executeTool()`
commands.

---

## ✅ 73-Point Acceptance Test Summary

The v5.6.0 Technical Contract includes an exhaustive **73-point WebMCP Acceptance Test**, plus B2B identity and cargo-profile preconditions, covering:
- **1–6**: Real Supabase Auth demo session, active membership, RLS validation, and empty runtime tables.
- **7–21**: Dynamic discovery from the provider registry, full document navigation across the three seeded Golden Flow endpoints, real WebMCP tool calls, and idempotent `record_provider_result` insertions.
- **22–42**: Exact mathematical replication of BALANCED subscores (Andes 89, Inca 84, Pacific 72), Decision Confidence (88/100), immutable `FreightDecision v1`, and `OPTIONS_READY` halt.
- **43–58**: Human selection click, `book_freight()` submission, separate CargoMesh UUID vs `provider_reference`, `PENDING_PROVIDER_CONFIRMATION`, carrier confirmation via `get_provider_booking_status`, and tracking event deduplication.
- **59–70**: Resilient recovery scenario (`REJECTED` / `EXPIRED`), creation of `orchestration_run` (RECOVERY), versioned `FreightDecision v2`, and deterministic tie-breaking.
- **71–73**: Server-scoped demo reset and zero `service_role` exposure in client bundles.

---

## 📁 Repository Structure Map

```text
cargomesh/
├── docs/                                      # Master documentation & technical contracts
│   ├── 00-master/                             # Master product specification & WebMCP vision (v5.6.0)
│   │   ├── CargoMesh_Planeacion_WebMCP_FINAL.md
│   │   └── ADR-001_Dynamic_Provider_Registry.md # 0..N carriers; demo fixtures are not a closed list
│   ├── 01-requirements/                       # Functional requirements & sprint backlog
│   │   ├── CargoMesh_Catalogo_Requisitos.md
│   │   └── CargoMesh_Sprint_Backlog.md
│   ├── 02-database/                           # Schema contracts, RLS rules & data alignment
│   │   ├── CargoMesh_Supabase_Schema_Contract.md
│   │   └── CargoMesh_Supabase_Data_Contract.md
│   ├── 03-ux-ui/                              # UX architecture, screen flows & WebMCP evidence
│   │   ├── CargoMesh_Mockups_Requeridos.md
│   │   ├── CargoMesh_Mockups_WebMCP_Ajustes.md
│   │   └── screenshots/README.md              # REL-02 capture plan and image slots
│   └── 04-execution/                          # Team ownership, checklist and multi-AI handoffs
│       ├── CargoMesh_Team_Execution_Checklist.md
│       └── WebMCP_Judge_Audit_Guide.md
├── mockups/                                   # Standalone UX/UI HTML mockups & provider pages
├── supabase/                                  # Database migrations, seed, tests, and config
│   ├── config.toml                            # Local Supabase stack configuration
│   ├── migrations/                            # 11 synchronized migrations (including baseline legacy)
│   ├── current_public_schema.sql              # Schema reference dump
│   ├── database.types.ts                      # Generated TypeScript database types
│   ├── seed.sql                               # Local-only Demo Auth user & ACME SUPERVISOR seed
│   ├── tests/                                 # Automated pgTAP database test suite
│   └── snippets/                              # Standalone validation scripts
├── frontend/                                  # 🚀 Next.js 15 full-stack MVP
│   ├── src/app/                               # App Router, Route Handlers and /providers/[carrierSlug]
│   ├── src/components/                        # Modular UI components
│   ├── src/lib/                               # Provider discovery, WebMCP contracts, Supabase and Decision Engine
│   └── package.json                           # Next.js 15, React 19 and Supabase SSR
├── backend/                                   # Reserved for post-MVP services; not part of the hackathon critical path
├── .gitignore                                 # Git security exclusions (.env, node_modules, temp files)
└── README.md                                  # Executive technical specification (This document)
```

---

## ⚖️ North Star Anti-Scope Creep Filter

> **"Does this modification directly demonstrate how WebMCP enables an AI agent to turn customer logistics intent into an autonomous, explainable, and recoverable transport operation?"**  
> If the answer is **no**, it is excluded from the hackathon core.
