# Configuration reference

Use [`cargomesh/.env.example`](../cargomesh/.env.example) as the exhaustive commented starting point. Copy it to `.env.local`; never commit real values. Unset optional features stay disabled. This guide groups variables by responsibility rather than supplying credentials.

| Feature | Variables | Boundary |
|---|---|---|
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public project coordinates; RLS still required |
| Privileged server operations | `SUPABASE_SERVICE_ROLE_KEY` | Server only; never a browser key or business-user impersonation mechanism |
| MCP transport | `CARGOMESH_MCP_MODE`, `CARGOMESH_MCP_PROFILE`, `CARGOMESH_MCP_LOCAL_ENABLED`, `CARGOMESH_MCP_REMOTE_ENABLED` | V2 only; independent opt-ins |
| MCP origin/resource | `CARGOMESH_MCP_CANONICAL_ORIGIN`, `CARGOMESH_MCP_ALLOWED_ORIGINS`, `CARGOMESH_MCP_CANONICAL_RESOURCE`, `CARGOMESH_OAUTH_ISSUER` | Exact canonical deployment values |
| MCP auth | `CARGOMESH_MCP_SERVICE_CLIENT_ID`, `CARGOMESH_MCP_SERVICE_CLIENT_SECRET`, `CARGOMESH_MCP_JWT_SIGNING_SECRET`, `CARGOMESH_MCP_TOKEN_TTL_SECONDS`, `CARGOMESH_MCP_USER_BEARER_ENABLED`, `CARGOMESH_MCP_USER_OAUTH_CLIENT_ID` | Secrets server only; service identity does not authorize user business tools |
| Nova Web | `NEXT_PUBLIC_CARGOMESH_NOVA_VOICE_PREVIEW`, `CARGOMESH_VOICE_WS_URL`, `CARGOMESH_VOICE_BRIDGE_SECRET` | Flag built into client; WSS URL/grant issued by server; secret shared securely with gateway |
| Extended context | `CARGOMESH_VOICE_EXTENDED_CATALOG` | Enable only after gateway accepts 64 KiB auth and the authenticated large-context test passes |
| Local voice demo | `CARGOMESH_NOVA_DEMO_VOICE` | Restricted development preview; not production identity |
| Optional text interpretation | `CARGOMESH_BEDROCK_CONVERSATION_ENABLED`, `CARGOMESH_BEDROCK_ENDPOINT`, `CARGOMESH_BEDROCK_REGION`, `CARGOMESH_BEDROCK_MODEL_ID`, token/timeout/cost variables | Separate from the Nova audio gateway; use `.env.example` comments for adapter credentials |
| Maps/routes | `NEXT_PUBLIC_GOOGLE_MAPS_JS_API_KEY`, `GOOGLE_ROUTES_API_KEY`, `CARGOMESH_LOCAL_ROUTES_ENABLED`, `CARGOMESH_LOCAL_ROUTES_ORIGIN` | Browser key restricted by referrer; Routes key server only |
| Assigned demo | `CM_ENABLE_DEMO`, `CARGOMESH_ASSIGNED_DEMO_ENABLED`, `CARGOMESH_ASSIGNED_DEMO_ORIGIN`, `CARGOMESH_ASSIGNED_DEMO_SECRET`, `CARGOMESH_DEMO_CLIENT_EMAIL`, `CARGOMESH_DEMO_CLIENT_PASSWORD`, `CARGOMESH_DEMO_CLIENT_ORGANIZATION_ID`, carrier email/password equivalents | Fixed synthetic accounts, exact origin, native membership checks |
| Local workspace demo | `CARGOMESH_LOCAL_WORKSPACE_DEMO_ENABLED`, `CARGOMESH_LOCAL_WORKSPACE_DEMO_ORIGIN`, `CARGOMESH_LOCAL_WORKSPACE_DEMO_ACCESS_FILE` | Development-only, private local access file |

The current local workspace implementation additionally reads `CARGOMESH_LOCAL_WORKSPACE_DEMO_HOSTED=true` for the strict 8090/HTTPS-Supabase development opt-in; it is not a general production bypass. See `src/server/auth/workspace-demo-policy.ts` for the actual checks.

On AWS, use the ECS task role and Secrets Manager injection. Do not put AWS keys, bridge secrets, passwords, voice grants or access files in `NEXT_PUBLIC_*`, screenshots, logs or judge-facing source. Configure Vercel values through its environment settings. Keep deployment branch/root/aliases unchanged unless a separate rollout explicitly changes them.
