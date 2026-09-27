# Evaluación ROAD V2 (HAC-12)

Este módulo separa la lectura del catálogo persistido (`infrastructure/`), las reglas puras de elegibilidad (`domain/`) y la construcción de la respuesta de servicio (`application/`). La evaluación es de solo lectura: no crea ofertas, reservas ni rutas.

`UNKNOWN` permanece desconocido; la falta de geometría produce `routePreview: null`. El endpoint Web es `GET /api/v2/freight/requests/:id/serviceability` y requiere sesión y pertenencia a la organización de la solicitud.

La migración HAC-12 en `supabase-v2/supabase/migrations/` depende del bootstrap HAC-29. La prueba HTTP local usa el escenario sintético HAC-29 más `supabase/scenarios/v2-hac12-road-capacity/` y cubre 1 elegible, 1 desconocido y cero candidatos en Piura. Aún faltan el replay de ambas migraciones desde cero en un perfil aislado, integración MCP/frontend y aplicación autorizada al Supabase remoto.
