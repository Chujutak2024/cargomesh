# Devpost narrative and demo outline

This is an English draft for team review. Align it with the final recorded build, verified deployment and chosen Alexa+ path before pasting it into Devpost.

## Project description

CargoMesh turns a freight conversation into a structured, reviewable logistics workflow. A customer describes pickup, destination, cargo, measurements and timing; the assistant answers questions, preserves corrections and helps complete missing information. The customer reviews the details before any business action is confirmed.

Carriers receive scoped opportunities and use a native workspace to inspect requests, prepare attributable offers, manage quote policies and follow confirmed orders. The commercial dashboard separates contracted value from payments and exposes estimated margin only when authorized, complete cost evidence exists.

The application combines Next.js/React, Hono services and Supabase authentication/PostgreSQL/RLS. Its MCP server reuses the same application services, while a separate Python/Strands gateway connects browser voice to Amazon Bedrock Nova. The assistant cannot invent quotes, available trucks or customer consent. Retriable writes and concurrent edits retain idempotency and expected-version checks.

For the hackathon, our work includes native customer/carrier workspaces, shared commercial workflows, authenticated MCP, scoped Nova guidance and typed/audio continuity. The international synthetic facility scenario broadens possible intake examples without claiming worldwide carrier coverage. Kiro Crew contributed a real security-test change; its original session and later independent verification are separately attributed.

If presenting the Web alternative, describe it as a **simulated Alexa+ experience**. A working Nova Web session is not a claim of an Echo integration. ROAD is the operational validation path; other modeled modes and external carrier integrations are not represented as live without evidence.

## Suggested video plan (2 minutes 45 seconds)

| Time | Show |
|---|---|
| 0:00–0:15 | Freight coordination problem and customer/carrier users; state the chosen Alexa+ demonstration path |
| 0:15–1:10 | Actual customer question, freight intake and one spoken/typed correction; let Nova finish its answer |
| 1:10–1:35 | Structured summary, missing requirements and explicit native confirmation boundary |
| 1:35–2:10 | Carrier opportunity, scoped briefing, attributable offer/order and dashboard |
| 2:10–2:30 | Shared services/MCP/AWS diagram, with synthetic/live boundaries clearly labeled |
| 2:30–2:45 | Demonstrated outcome, repository/setup access and honest limitations |

Record actual functioning footage; do not stage a successful result for a pending rollout. Only include a commercial mutation on an explicitly disposable synthetic case. Upload the final English video publicly to YouTube/Vimeo and put its URL in Devpost. Add accurate Product Feedback and mini-challenge fields separately.
