# CargoMesh backend

This is the active TypeScript backend. Next.js hosts it in the same deployment
as the web UI; `frontend/` is the historical application directory name.

| Directory | Responsibility |
| --- | --- |
| `services/<domain>/` | Authenticated use cases, persistence and injectable server policies |
| `auth/` | Session/member resolution and server page access guards |
| `db/supabase/` | Session and administrative database clients; server-only |
| `hono/` | REST transport: parsing, dispatch and HTTP responses |
| `mcp/` | MCP transport, tool registration and safe result projection |
| `i18n/` | Locale resolution using server request context |

Next.js route entry points remain in `../app/api/` and `../app/mcp/`; server
pages may call services directly. Both Hono and MCP call the same services
without internal HTTP. Services must not import transport handlers or UI.

`../features/` contains domain contracts, pure calculations, client workflows
and feature presentation. `../shared/` holds cross-cutting schemas.
The browser Supabase client remains in `../lib/supabase/client.ts` and never
uses the administrative client.

Production service entry points retain `import "server-only"`. Injectable
policies can be tested in Node without Next.js; their server directory still
excludes them from browser dependencies through `pnpm check:architecture`.
Tests live beside the code they exercise; functional/browser regression tests
remain with their feature.

From `frontend/`, run:

```sh
pnpm check:architecture
pnpm typecheck
pnpm test:release
pnpm build
```

The architecture check follows static and literal dynamic runtime imports from
every `use client` entry, rejects dependencies on `server/`, `server-only` and
Node built-ins, and checks service-to-transport and shared-to-server boundaries.
Type-only imports are permitted. Next.js build remains the final bundling check.
