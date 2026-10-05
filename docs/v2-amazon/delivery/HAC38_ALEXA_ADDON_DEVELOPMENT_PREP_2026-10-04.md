# HAC-38 — Alexa+ track development path

**Status:** CargoMesh has a controlled V2 MCP client test, but no Alexa+-originated invocation. The Amazon Developer Hackathon does not provide access to the gated Alexa+ MCP Toolkit, Alexa AI CLI, or Web Simulator. This branch must not claim a live Alexa+ add-on.

## Hackathon access decision (2026-10-04)

The hackathon [FAQ](https://amazonappdev2026.devpost.com/details/faqs) states that Category SDK, MCP Toolkit, Alexa AI CLI, and Web Simulator access is limited to selected partners, with no application path for participants. An [organizer reply](https://amazonappdev2026.devpost.com/forum_topics/45262-is-the-alexa-mcp-toolkit-alexa-ai-cli-available-to-hackathon-participants) explicitly confirms that the Amazon-owned `AddOn3PDeveloperToolsRead` role will not be enabled for hackathon participants. The [official rules](https://amazonappdev2026.devpost.com/rules) instead accept either a working self-hosted MCP server implementing protocol version `2025-11-25` or later over Streamable HTTP, or a clearly identified simulated Alexa+ experience built with agentic tools.

The user configured a dedicated `alexa-ai-tools` IAM principal with the documented `sts:AssumeRole` policy. Its base profile resolves to that IAM user, and the role profile matches the setup guide, but STS returns `AccessDenied` on the Amazon-owned role. The originally exposed access key was disabled and deleted; a replacement key was verified through `sts get-caller-identity` without displaying its secret. Do not request more IAM permissions or create more keys to pursue the gated CLI. The replacement `alexa-ai-tools` key can be removed once no other authorized use remains; the separate Bedrock development profile is unaffected.

## Supported prototype path

1. Keep the V2 Web conversation as the clearly labeled self-built Alexa+ simulation. It may call Amazon Bedrock for intent handling, but must not claim to be Alexa+ or use Alexa speech services unless independently verified.
2. Preserve the HAC-38 server as a self-hosted MCP endpoint with Streamable HTTP and its explicit `2025-11-25` protocol-version test. Its V2 profile exposes `get_cargomesh_capabilities`, `create_v2_freight_request`, `get_v2_freight_request`, and `evaluate_v2_road`. Authentication, tenant resolution, confirmation, and business logic remain server-side and shared with Web.
3. Exercise the endpoint with an independent MCP client through initialize, tools/list, and tools/call. Record an authorized draft and ROAD result, plus missing-auth and cross-tenant failures. A controlled local test is evidence for CargoMesh MCP operation, not Alexa+ integration.
4. Provide reproducible local run instructions and a demo video that visibly exercises the conversation and MCP calls. For judging access, host only a separate non-production V2 preview if needed, verify its URL and auth, and retain an explicit teardown procedure to prevent continuing AWS charges.
5. Label the submission accurately: self-hosted MCP and self-built Alexa+ simulation. Record the conflicting public setup guide and gated role as a friction log, not as an unresolved implementation dependency.

The [MCP adapter transcript](./HAC38_CONTROLLED_MCP_TRANSCRIPT.md) records the controlled Streamable HTTP protocol test. It is local evidence, not public availability or a live Alexa+ integration. The USD 1 AWS Budget is an alert, not a hard spending cap.
