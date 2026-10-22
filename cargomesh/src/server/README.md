# CargoMesh backend

Next.js entry points expose Hono REST and MCP over shared domain/application services. `modules/` owns business operations and repositories, `auth/` identity, `conversation/` scoped interpretation/voice context, and `db/supabase/` authenticated persistence. See [architecture](../../../docs/ARCHITECTURE.md), [API/MCP](../../../docs/API.md), [database profiles](../../../docs/DATA.md) and [configuration](../../../docs/CONFIGURATION.md). Runtime V2 uses `supabase-v2/`; SQL history is a separate regression input.
