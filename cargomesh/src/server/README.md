# Backend CargoMesh V2

El backend TypeScript vive en la aplicación Next.js `cargomesh/`.

| Directorio | Función |
|---|---|
| modules/ | Servicios de dominio, repositorios y contratos persistentes V2 |
| services/v2-workspace/ | Lectores V2 para dashboard, solicitudes, reservas y ejecuciones |
| auth/ | Sesión, membresía activa y autorización |
| db/supabase/ | Clientes autenticados tipados contra el esquema V2 |
| hono/ | API REST /api/v2 |
| mcp/ | Transporte y herramientas MCP V2 implementadas |
| conversation/ | Interpretación acotada, con Bedrock opcional |

La UI y los canales llaman servicios compartidos. Los datos sintéticos se cargan únicamente mediante escenarios locales identificados. El runtime no registra rutas ni herramientas del demo WebMCP V1.

Consulta [el inventario API](../../../docs/v2-amazon/delivery/HAC40_API_ENDPOINTS.md) y [los límites actuales](../../../docs/v2-amazon/delivery/HAC40_FULL_API_AND_CLOSURE.md). Las migraciones históricas de importación/regresión permanecen separadas de la cadena nativa supabase-v2.
