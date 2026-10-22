# Alexa+ primary track

The [official rules](https://amazonappdev2026.devpost.com/rules) permit two routes: a working Agent Skill/self-hosted MCP server using MCP 2025-11-25 or later over Streamable HTTP, or an explicitly demonstrated simulated Alexa+ Web experience built with an AI/agentic tool. The simulation alternative is exempt from the runtime-hook requirement, but its source and working video must be provided.

## CargoMesh implementation

The self-hosted MCP entry is `cargomesh/src/app/mcp/route.ts`; registration lives in `src/server/mcp/server.ts`. It actually imports/uses the MCP SDK and registers shared intake/workflow services. See the [current tool reference](../API.md). Dependency support for the required protocol is present; acceptance must record the version negotiated with the actual deployed client.

The Web experience uses Next.js conversation UI, native services, and optional Strands/Bedrock Nova voice. It supports corrections and native confirmation. Nova is not Alexa's runtime, and a WebSocket voice gateway is not the MCP transport.

## Evidence for the chosen path

For MCP, demonstrate initialization, negotiated protocol, `tools/list`, authenticated tenant-scoped reads, request handling and prepared/confirmed actions using a compatible client. Demonstrate invalid/revoked identity rejection. Local OAuth/HTTP smoke is useful source evidence but does not prove hosted Alexa account linking.

For the Web alternative, label the Devpost narrative and video **simulated Alexa+ experience**. Show an actual question/answer, freight capture, correction and confirmation boundary. Include the implementation and setup. Do not state that an Echo or Amazon Alexa account was connected without an actual recorded test.

No live Alexa+/Echo acceptance is established by this documentation audit. Use the demonstrated path and avoid making partner tooling or device access an invented prerequisite for the allowed simulation route. A moderator's [clarification](https://amazonappdev2026.devpost.com/forum_topics/45567-questions-about-the-rules) also accepts a standard MCP client demonstration; the official rules remain controlling.
