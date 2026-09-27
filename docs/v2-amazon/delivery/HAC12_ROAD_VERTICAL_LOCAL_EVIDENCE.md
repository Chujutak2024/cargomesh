# HAC-12 — evidencia local del vertical ROAD V2

Estado: **implementación local en revisión**, no desplegada ni aceptada. Rama de trabajo `feat/be2-v2-road-serviceability`; PR objetivo `feat/cycle-2-integration` después del bootstrap HAC-29 (#90). El proyecto Supabase V2 alojado no fue modificado.

## Corte implementado

- Hono/Next: `GET /api/v2/intake/options`, `POST /api/v2/freight/requests`, `GET /api/v2/freight/requests/:id` y `GET /api/v2/freight/requests/:id/serviceability`.
- DTO anidado `schemaVersion: "2.0"`; persistencia atómica mediante una RPC `SECURITY INVOKER`, recibo/hash de idempotencia y snapshots canónicos de sedes. El servidor resuelve el tenant desde la sesión. Sede ajena → `403`; ID inexistente → `400`; lectura de otra organización → `404`.
- Elegibilidad ROAD de solo lectura: áreas, lane dirigida, categoría, equipo, peso/volumen, certificaciones y temperatura **del mismo recurso**, calendario, reservas, mantenimiento y reposicionamiento. Sin ruta inferida, precio ni booking. Se recorren todos los servicios ROAD activos; falta evidencia → `unknown`.
- Migración estructural aditiva en `supabase-v2/supabase/migrations/`; datos de demo exclusivamente en `supabase/scenarios/v2-hac12-road-capacity/`, encima del baseline sintético HAC-29. Una disponibilidad `SIMULATED` se presenta como tal, nunca como live.

## Verificación realizada

- TypeScript, chequeo de arquitectura y build Next.js de producción: PASS.
- Pruebas unitarias de DTO, intake, solicitud y elegibilidad: 32/32 PASS.
- Regresiones existentes: Hono 42/42 y MCP 75/75 PASS. Estas suites heredadas no sustituyen el smoke HTTP V2.
- pgTAP local: 15/15, incluyendo creación/replay/conflicto, RLS/tenant, sedes ajenas, USD y rollback.
- Smoke HTTP local contra Next/Hono + Auth/REST Supabase: PASS para autenticación, ocho categorías, POST→GET, replay `200`, conflicto `409`, sede ajena `403`, inexistente `400`, lectura cruzada `404`, `expectedDraftVersion` obsoleta `409`, 1 candidato elegible, 1 `unknown` y Piura con cero. El script falla si la URL no es loopback y borra por ID los borradores que crea.

## Pendientes antes de In Review/Done

1. Revisar/aceptar PR #90; reproducir desde **reset limpio** la cadena HAC-29 → HAC-12 y pgTAP/escenarios. La prueba local actual se hizo sobre una base HAC-29 preexistente con el delta HAC-12 aplicado durante el desarrollo.
2. Ejecutar la suite de release completa, chequeo de seguridad/advisors y revisión independiente. Publicar PR HAC-12; no mezclar directo a la rama base ni a `main`.
3. Conectar el mismo servicio de aplicación a HAC-11 (MCP) y las vistas HAC-14/15, y pasar QA HAC-13 sobre el corte integrado.
4. Resolver con HAC-27/HAC-29 la proyección de fixture que espera `serviceClass: FTL_DEDICATED` y canales `API/MANUAL`: el catálogo físico actual acredita `FTL` y **ningún canal V2 publicado**. La API devuelve `FTL` y `responseChannels: []`; no inventa capacidades comerciales.

Este corte no persiste las 57 clases UML ni implementa ofertas, reservas de booking, otros modos o Alexa+ live. Reutiliza tablas V1 seleccionadas como estructura, no sus carriers ni su flujo WebMCP.
