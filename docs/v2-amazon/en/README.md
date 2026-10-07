# CargoMesh V2 — English submission documentation

This English package describes the V2 product, its intended behavior, architecture, verification boundaries, and current evidence for the Amazon Developer Hackathon. It is an English translation and consolidation of the active Spanish contracts in [`docs/v2-amazon/`](../README.md), not a claim that every planned feature is implemented. The Spanish contracts and [`AGENTS.md`](../../../AGENTS.md) remain the team's governing sources for development; any disagreement must be resolved there before the submission is frozen.

| English document | Covers the active source contracts |
|---|---|
| [Product and domain](./PRODUCT_AND_DOMAIN.md) | [Scope](../contracts/PRODUCT_SCOPE.md), [domain](../contracts/DOMAIN_CONTRACTS.md), [coverage](../contracts/CARRIER_COVERAGE_AND_SERVICEABILITY.md), [discovery](../contracts/CARRIER_DISCOVERY_AND_RANKING.md), and [transport plans](../contracts/TRANSPORT_PLANS_AND_FLEET.md) |
| [Architecture and integrations](./ARCHITECTURE_AND_INTEGRATIONS.md) | [Architecture](../contracts/ARCHITECTURE.md), [Alexa/MCP](../contracts/ALEXA_MCP_AWS.md), and [V1/V2 boundary](../contracts/V1_BOUNDARY_AND_MIGRATION.md) |
| [Verification and submission claims](./VERIFICATION_AND_CLAIMS.md) | [Quality plan](../delivery/QUALITY_AND_VALIDATION_PLAN.md), Sprint 1 implementation notes and gate evidence |

## What the project is

CargoMesh V2 helps a business shipper describe a freight need, discover feasible carrier-service and transport-plan candidates, request attributable offers, compare eligible offers using an explainable policy, and authorize a booking. Web and Alexa+ are intended to use the same application services through an MCP server. The current implementation is incremental: a documented target capability is **not** an implemented, tested, or live integration.

## Current evidence boundary — September 23, 2026

- The shared V2 contract baseline is `codex/v2-amazon-contracts`; `main` is not the V2 deployment branch. Code and tests must be checked at the submitted commit, not inferred from this document.
- The draft-idempotency and ROAD facilities/service-area/service-lane structural migrations have been applied to the linked Supabase project. The four new ROAD tables have RLS and policies, but contain no V2 catalog rows in that remote project. Schema readiness is not product readiness.
- The Alexa MCP security/transport skeleton is integrated into the V2 base. Account linking and V2 commercial tools are not yet complete; a local MCP test is not an Alexa+ invocation. Do not advertise Alexa+ user access as live until the account-linking flow is implemented and verified end to end.
- V1 WebMCP fixtures and the three legacy carriers remain regression material. They do not demonstrate V2 coverage, availability, offers, or multimodal operation.
- Bedrock is optional for the primary Alexa+ track. Claim AWS Builder integrations only for services actually used and shown; Kiro Crew evidence must be real and sanitized.

## Language and evidence policy

The hackathon [rules](https://amazonappdev2026.devpost.com/rules) require submission materials, including the demo video, written description, and code documentation, to be in English or accompanied by an English translation. This package translates the **core product contracts**. Sprint planning, internal QA matrices, diagrams, inline code comments, and any documents linked from the final submission still need an English-language audit before the submission freeze. New submission-facing Sprint 2+ evidence should be written in English. Do not label this package as a full repository translation.

The final video and Devpost text must identify each demonstrated surface as live integration, local test, simulated integration, prototype, V2 scenario, or V1 regression. Every claim needs a matching execution path and evidence at the submitted commit.
