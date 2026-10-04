# HAC-38 controlled MCP client transcript

Environment: local in-process HTTP handler and official `@modelcontextprotocol/sdk` 1.30.0 client, `StreamableHTTPClientTransport`, protocol `2025-11-25`. Source: `cargomesh/src/server/mcp/http.test.ts`, test `controlled MCP client calls V2 draft and ROAD tools through the direct application port`. Run `pnpm test:mcp` to reproduce (78/78 at commit `69ac3e2`).

The test injects the HAC-27 JSON fixtures through a V2 application port and asserts every direct call. It does **not** insert a row into Supabase, use a production token, contact a carrier, or invoke Alexa+.

| Turn | MCP request | Observed assertion |
|---|---|---|
| 1 | `initialize`, protocol `2025-11-25` | Official client connects to the CargoMesh Streamable HTTP server |
| 2 | `tools/list` | `get_cargomesh_capabilities`, `create_v2_freight_request`, `get_v2_freight_request`, `evaluate_v2_road`; no V1 offer tools |
| 3 | `tools/call create_v2_freight_request` with complete HAC-27 ROAD payload and UUID idempotency key | Draft ID `a9c4e112-84b1-47d0-91e3-52f8c7a6b501`, reference `CM-V2-2026-0001` from the injected V2 fixture; actor organization is passed to the application port |
| 4 | `tools/call get_v2_freight_request` with that request ID | `draftVersion: 1`; read port receives that exact ID |
| 5 | `tools/call evaluate_v2_road` with the request ID and expected version 1 | `overallStatus: unknown`, evaluated version 1; ROAD port receives the exact ID/version. The fixture has one unknown candidate and `EVALUATION_ONLY_NO_OFFER_OR_BOOKING` |
| 6 | Service principal calls all three V2 business tools | `FORBIDDEN` before any application-port invocation |

The test also confirms call order: create for the linked organization → read the created request → ROAD evaluation for version 1. Existing auth tests cover missing, revoked, expired and wrong-client account links, plus tenant membership mismatch. A live V2 Supabase run with a safe account and an observed Alexa+ invocation are separate acceptance evidence still required.
