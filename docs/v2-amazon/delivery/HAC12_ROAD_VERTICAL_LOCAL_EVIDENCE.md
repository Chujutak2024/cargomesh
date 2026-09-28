# HAC-12 — evidencia local del vertical ROAD V2

Estado: **implementación local en revisión**, no desplegada ni aceptada. Rama de trabajo `feat/be2-v2-road-serviceability`; PR objetivo `feat/cycle-2-integration` después del bootstrap HAC-29 (#90). El proyecto Supabase V2 alojado no fue modificado.

## Corte implementado

- Hono/Next: `GET /api/v2/intake/options`, `POST /api/v2/freight/requests`, `GET /api/v2/freight/requests/:id` y `GET /api/v2/freight/requests/:id/serviceability`.
- `intake/options` entrega cinco grupos tipados: `facilities` del tenant, las ocho `cargoCategories` con guía, y vocabularios versionados `equipmentOptions`, `packagingOptions`, `requirementOptions`. Embalaje lleva `CAPTURE_ONLY`; temperatura y sello llevan `RESOURCE_EVIDENCE`; frágil y peligroso llevan `REQUIRES_REVIEW`. Los selectores no certifican capacidad ni permisos del carrier.
- DTO anidado `schemaVersion: "2.0"`; persistencia atómica mediante una RPC `SECURITY INVOKER`, recibo/hash de idempotencia y snapshots canónicos de sedes. El servidor resuelve el tenant desde la sesión. Sede ajena → `403`; ID inexistente → `400`; lectura de otra organización → `404`.
- Elegibilidad ROAD de solo lectura: áreas, lane dirigida, categoría, equipo, peso/volumen, certificaciones y temperatura **del mismo recurso**, calendario, reservas, mantenimiento y reposicionamiento. `TEMP_CONTROLLED` sin rango térmico y los requisitos `FRAGILE`/`HAZARDOUS` quedan `unknown`, incluso si el recurso publica una etiqueta con ese código. Sin ruta inferida, precio ni booking. Se recorren todos los servicios ROAD activos; falta evidencia → `unknown`.
- Migración estructural aditiva en `supabase-v2/supabase/migrations/`; datos de demo exclusivamente en `supabase/scenarios/v2-hac12-road-capacity/`, encima del baseline sintético HAC-29. Una disponibilidad `SIMULATED` se presenta como tal, nunca como live.

## Verificación realizada

- TypeScript, chequeo de arquitectura y build Next.js de producción: PASS.
- Pruebas unitarias de DTO, intake, solicitud y elegibilidad: 34/34 PASS en el corte de cinco grupos; `tsc --noEmit --incremental false`: PASS. Las nuevas pruebas cubren códigos/estados de los cinco grupos, requisitos pendientes de revisión y temperatura/sello en el mismo recurso.
- Regresiones existentes: Hono 42/42 y MCP 75/75 PASS. Estas suites heredadas no sustituyen el smoke HTTP V2.
- Reset local limpio de HAC-29 PR #90 (`25b2b46`) más delta HAC-12 (`7de491c`): las tres migraciones aplicaron en orden; ocho categorías y cero organizaciones/solicitudes/Auth antes de sembrar el escenario. Los escenarios HAC-29 y HAC-12 se sembraron y verificaron en ese orden.
- pgTAP local combinado: 90/90 en cinco archivos; HAC-12 aporta 17/17, incluyendo creación/replay/conflicto, RLS/tenant, sedes ajenas, USD y un fallo temporal **después del INSERT** que deja cero borradores/recibos. El trigger de fallo existe solo dentro de la transacción de prueba.
- `supabase db advisors --local` sobre la cadena combinada: seguridad y rendimiento sin hallazgos `warn`/`error`.
- Smoke HTTP local contra Next/Hono + Auth/REST Supabase sobre ese reset: PASS para autenticación, ocho categorías, POST→GET, replay `200`, conflicto `409`, sede ajena `403`, inexistente `400`, lectura cruzada `404`, `expectedDraftVersion` obsoleta `409`, 1 candidato elegible, 1 `unknown` y Piura con cero. El script falla si la URL no es loopback y borra por ID los borradores que crea.

## Pendientes antes de In Review/Done

1. Revisar/aceptar PR #90 y, una vez integrado al ciclo, añadir la migración HAC-12 al `supabase-v2/migration-manifest.json` y su prueba al perfil V2. La combinación actual se probó en un checkout desacoplado; `gate.py manifest` aún rechaza el delta HAC-12 no registrado. El gate completo local de #90 se bloqueó por el puerto Windows `59322` reservado; sus tres jobs CI sí pasaron. Véase [FL-03](./friction-logs/FL-03.md).
2. Ejecutar la suite de release completa sobre la combinación publicada, repetir advisors en el gate y obtener revisión independiente de HAC-12. Publicar PR HAC-12; no mezclar directo a la rama base ni a `main`.
3. Conectar el mismo servicio de aplicación a HAC-11 (MCP) y las vistas HAC-14/15, y pasar QA HAC-13 sobre el corte integrado.
4. Resolver con HAC-27/HAC-29 la proyección de fixture que espera `serviceClass: FTL_DEDICATED` y canales `API/MANUAL`: el catálogo físico actual acredita `FTL` y **ningún canal V2 publicado**. La API devuelve `FTL` y `responseChannels: []`; no inventa capacidades comerciales.
5. Alinear HAC-14 con el DTO real de cinco grupos: `facilities[].id` se envía como `facilityId`, `cargoCategories[].code` como `categoryCode`, y los selectores usan los códigos de `equipmentOptions`, `packagingOptions` y `requirementOptions`. El fallback al fixture no debe ocultar errores de autenticación ni de contrato. HAC-27 ya contiene el contrato maestro actualizado; seguimiento en [FL-04](./friction-logs/FL-04.md).

Límite funcional: `packaging` se valida como dato de captura y se persiste, pero el evaluador ROAD aún no verifica si el recurso puede manipular ese embalaje. Por ello, un `eligible` en este corte describe los filtros ROAD implementados; no es una confirmación de compatibilidad de embalaje, oferta, reserva ni autorización de booking. Registrar la regla/evidencia de embalaje antes de afirmar esa capacidad como verificada.

Este corte no persiste las 57 clases UML ni implementa ofertas, reservas de booking, otros modos o Alexa+ live. Reutiliza tablas V1 seleccionadas como estructura, no sus carriers ni su flujo WebMCP.
