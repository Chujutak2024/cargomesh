# CargoMesh V2 — English submission documentation

This English package describes the V2 product, its intended behavior, architecture, verification boundaries, and current evidence for the Amazon Developer Hackathon. It is an English translation and consolidation of the active Spanish contracts in [`docs/v2-amazon/`](../README.md), not a claim that every planned feature is implemented. The Spanish contracts and [`AGENTS.md`](../../../AGENTS.md) remain the team's governing sources for development; any disagreement must be resolved there before the submission is frozen.

| English document | Covers the active source contracts |
|---|---|
| [Product and domain](./PRODUCT_AND_DOMAIN.md) | [Scope](../contracts/PRODUCT_SCOPE.md), [domain](../contracts/DOMAIN_CONTRACTS.md), [coverage](../contracts/CARRIER_COVERAGE_AND_SERVICEABILITY.md), [discovery](../contracts/CARRIER_DISCOVERY_AND_RANKING.md), and [transport plans](../contracts/TRANSPORT_PLANS_AND_FLEET.md) |
| [Architecture and integrations](./ARCHITECTURE_AND_INTEGRATIONS.md) | [Architecture](../contracts/ARCHITECTURE.md), [Alexa/MCP](../contracts/ALEXA_MCP_AWS.md), and [V1/V2 boundary](../contracts/V1_BOUNDARY_AND_MIGRATION.md) |
| [Verification and submission claims](./VERIFICATION_AND_CLAIMS.md) | [Quality plan](../delivery/QUALITY_AND_VALIDATION_PLAN.md), Sprint 1 implementation notes and gate evidence |

## What the project is

CargoMesh V2 helps a business shipper describe a freight need, discover feasible carrier-service and transport-plan candidates, request attributable offers, compare eligible offers using an explainable policy, and authorize a booking. Web and Alexa+ are intended to use the same application services through an MCP server. The current implementation is incremental: a documented target capability is **not** an implemented, tested, or live integration.

## Current evidence boundary — October 9, 2026

- The shared V2 baseline is `main`, authorized on 9 October 2026. Work uses registered branches and reviewed pull requests to `main`; an existing automatic deployment does not prove hosted functionality. Code and tests must be checked at the submitted commit, not inferred from this document.
- The separate hosted V2 project has 27 applied migrations and a synthetic V2 QA dataset. An earlier hosted OAuth PKCE/HTTP/MCP smoke reached IN_PROGRESS; see the [dated result](../delivery/uml-bd-api-2026-10-09/DEPLOY_Y_REPRUEBA_29c385f.md). This does not certify every UML method or a real carrier integration.
- Account linking, verified identity and commercial MCP tools are implemented. The earlier hosted QA smoke used Supabase OAuth and simulated carrier data. Its temporary access was withdrawn; Alexa+ live and external carriers remain uncertified. Consult the [current integration record](../delivery/INTEGRATION_CERTIFICATION_2026-10-09.md).
- V1 WebMCP fixtures and the three legacy carriers remain regression material. They do not demonstrate V2 coverage, availability, offers, or multimodal operation.
- Bedrock is optional for the primary Alexa+ track. Claim AWS Builder integrations only for services actually used and shown; Kiro Crew evidence must be real and sanitized.

## Language and evidence policy

The hackathon [rules](https://amazonappdev2026.devpost.com/rules) require submission materials, including the demo video, written description, and code documentation, to be in English or accompanied by an English translation. This package translates the **core product contracts**. Sprint planning, internal QA matrices, diagrams, inline code comments, and any documents linked from the final submission still need an English-language audit before the submission freeze. New submission-facing Sprint 2+ evidence should be written in English. Do not label this package as a full repository translation.

The final video and Devpost text must identify each demonstrated surface as live integration, local test, simulated integration, prototype, V2 scenario, or V1 regression. Every claim needs a matching execution path and evidence at the submitted commit.
