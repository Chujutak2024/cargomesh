# Fixtures de contrato HAC-27 — Sprint 2 ROAD

Estos archivos JSON son **datos sintéticos de interfaz**, no seeds SQL ni respuestas capturadas de Supabase. Sirven para que HAC-14 (Luis) y HAC-15 (Juan) desarrollen y prueben en paralelo; HAC-12 sustituye el mock por Hono/Zod `v2.0` y HAC-29 por el escenario `v2-road-baseline` antes del gate.

| Archivo | Uso |
|---|---|
| `intake-options.json` | Cinco grupos: sedes del tenant sintético, categoría/guía, equipo ROAD, embalaje y requisitos. `verification` distingue captura, evidencia de recurso y revisión pendiente. |
| `create-request.json` | Body completo de `POST /api/v2/freight/requests`; enviar además `Idempotency-Key` UUID estable por intento. |
| `request-response.json` | Respuesta `201` y posterior `GET /:id` para reconstruir el intake. |
| `serviceability-eligible.json` | Un candidato elegible, con traza **SIMULATED** explícita. |
| `serviceability-ineligible.json` | Un candidato rechazado por cobertura/lane, sin traza. |
| `serviceability-unknown.json` | Capacidad y geometría desconocidas; `routePreview: null`. |
| `serviceability-empty.json` | `200` con `candidates: []`, no `404`. |
| `error-idempotency-conflict.json` | Error versionado `409`; nunca renderizarlo como creación exitosa. |

Los fixtures deliberadamente **no** declaran precio, oferta o booking. `REFRIGERATED_TRUCK` es un código de recomendación heredado en la guía de categoría; `REEFER_TRUCK` es el valor de `requiredEquipment` del ejemplo V2. HAC-12 debe publicar el mapeo canónico o impedir esa selección, no asumir equivalencia implícita.

`packagingOptions` sirve para capturar el código de embalaje, sin certificar manipulación por el carrier. `TEMP_CONTROLLED` y `SECURITY_SEAL` requieren evidencia del mismo recurso portador; `FRAGILE` y `HAZARDOUS` necesitan revisión y producen `unknown` en el evaluador ROAD actual. La presencia de una opción en el JSON no confirma capacidad ni habilitaciones legales.

Las respuestas de serviceability son casos **independientes**, no una misma evaluación con conteos acumulados. Para el mapper de Luis, use `request-response.json` junto con una de ellas. El backend debe validar y producir las mismas formas, incluyendo `schemaVersion`, estados y `null`; no tomar estos ejemplos como prueba de que el servicio ya corre. Fuente normativa: [contrato HAC-27](../../SPRINT2_HAC27_CLASS_DB_API_CONTRACT.md).

Corte 2 oct: ejemplos `FTL` y `responseChannels: []`; no hay canal de respuesta V2 publicado. Geometría SIMULATED en estos casos independientes; HAC-12 devuelve routePreview:null en el escenario ejecutable actual. `meta.environmentProfile: v2-clean` conserva la forma literal del DTO canónico; estos archivos siguen siendo fixtures estáticos explícitos, no capturas de un servicio alojado.
