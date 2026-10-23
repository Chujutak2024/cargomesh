# CargoMesh — conversational freight coordination

CargoMesh helps customers describe freight in natural language and helps carriers evaluate requests, prepare offers and manage confirmed work. Its Web workspaces combine a shared, persistent logistics backend with Amazon Nova voice guidance and an authenticated MCP server.

Built for **Build, Ship, Shape: Amazon Developer Hackathon 2026**. Submission-facing guides are in English. Internal domain contracts remain in Spanish and are identified separately.

**[Try the Web application](https://cargomesh.vercel.app/)** · **[Judge guide](docs/hackathon/JUDGE_GUIDE.md)** · **[Setup](docs/SETUP.md)** · **[Submission checklist](docs/hackathon/SUBMISSION.md)**

## What you can explore

| Workspace | Entry | Implemented experience |
|---|---|---|
| Customer | `/clients` | Facilities, request capture by text/voice, editable review, commercial decisions, bookings and tracking views |
| Carrier | `/carriers` | Native dashboard, opportunities, offer preparation, quote automation, orders, fleet, sites and control tower |
| MCP client | `/mcp` | Authenticated intake, routing, workflow reads and prepared/confirmed commercial commands |

For the public judge demo, open the application and choose **Explore Shipper** or **Explore Carrier**. Both entries opened their workspaces without entering credentials on 23 October 2026. The server supplies the scoped demo identity; this does not grant arbitrary tenant membership. See the [read-only access record](docs/hackathon/JUDGE_ACCESS_2026-10-23.md) for observations and the remaining clean-profile check. Browser-only visual examples and connected records are different data sources.

Nova can answer questions and capture/correct details. Typed turns can receive Nova audio when the deployed gateway advertises `textInput`. Commercial actions use application validation and explicit confirmation. Nova does not independently create offers or book transport.

## Start locally

Use **Node 24.20.0**, **pnpm 11.19.0**, and a configured Supabase V2 project. From the repository root:

```sh
pnpm --dir cargomesh install --frozen-lockfile
# Copy cargomesh/.env.example to cargomesh/.env.local; configure your own values.
pnpm --dir cargomesh dev
```

Open `http://localhost:3000/`. See [setup and database profiles](docs/SETUP.md) for local Supabase, authentication, optional providers and scenario loading. Voice additionally needs the Python gateway and authorized Bedrock access.

## Documentation

- [Product and data boundaries](docs/PRODUCT.md)
- [Architecture and integrations](docs/ARCHITECTURE.md)
- [REST and MCP reference](docs/API.md)
- [Configuration](docs/CONFIGURATION.md)
- [Voice and gateway deployment](docs/VOICE.md)
- [Database and demo scenarios](docs/DATA.md)
- [Testing](docs/TESTING.md)
- [Hackathon: Alexa+, AWS Builder/Kiro and Open Source](docs/hackathon/README.md)
- [Current verification status](docs/STATUS.md)
- [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [MIT license](LICENSE)

ROAD has the implemented operational validation path. International facilities do not establish carrier coverage or cross-border service; AIR/SEA/RAIL and multimodal concepts must not be presented as live merely because the schema represents them. The Web Nova experience is **not a verified live Alexa+ integration**. Read the status guide before making deployment or contest claims.
