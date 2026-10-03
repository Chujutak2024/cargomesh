# HAC-33 · contrato preparatorio de lugares (sin implementación)

El usuario lo llamó HAC-31, pero Linear asigna la resolución/confirmación a **HAC-33** y reserva HAC-31 para Gate-3. A 2026-10-02 ambos están `Pendiente`; el manifiesto de `feat/be1-v2-location-resolution` sigue propuesto. Este documento no registra una tool live ni crea la rama.

## Interfaz propuesta para acordar con HAC-27, Juan y Luis

Schemas Zod versionados `2.0` pendientes de publicación en `cargomesh/src/shared/schemas/v2/location.ts` después del gate:

- `SearchLocationsInput`: `query`, `role: origin | destination`, `organizationId` solo como aserción opcional, `language`, `region`, límite máximo de candidatos.
- `DescribeLocationInput`: referencia tipada `FACILITY | EXTERNAL_PLACE | COORDINATE`; coordenadas finitas y dentro de rango.
- `LocationCandidate`: referencia tipada, nombre, dirección/área, lat/lng opcional, `precision: exact | area | unknown`, `provider`, `observedAt`, `operationalEntrance: known | unknown`, `schemaVersion: "2.0"`.
- `ConfirmLocationInput`: `requestId`, `role`, referencia exacta elegida de una respuesta previa, `expectedDraftVersion` y confirmación humana vinculada a esa elección. El booleano aislado `approved=true` no basta como evidencia.
- `LocationError`: `VALIDATION_ERROR | FORBIDDEN_TENANT | LINK_REVOKED | STALE_DRAFT | PROVIDER_UNAVAILABLE | LOCATION_AMBIGUOUS | LOCATION_NOT_FOUND`, con correlation ID y sin datos internos.

`LocationResolutionService.search/describe/confirm` debe recibir un actor resuelto por servidor y repositorios/adaptador, no un `organizationId` autorizante del navegador o del modelo de voz. Sedes autorizadas preceden lugares externos. El adaptador externo debe documentar idioma/región, cuota, licencia, atribución y política de caída. Un `EXTERNAL_PLACE` nunca se convierte implícitamente en `facilityId`; un pin impreciso conserva entrada operativa `unknown`. Geocodificación no certifica cobertura, ruta apta, horarios, precio ni ETA.

## Pruebas de contrato antes de integración

| Caso | Salida esperada |
| --- | --- |
| Sede propia y lugar externo con el mismo texto | Sede propia primero; ambos con fuente y precisión, sin acceso a sede ajena |
| Dos lugares plausibles | 2 candidatos; no confirmar automáticamente |
| Cero resultados | Lista vacía y solicitud de mayor precisión; no candidato inventado |
| Proveedor externo caído | `PROVIDER_UNAVAILABLE` o fallback de sedes propias claramente atribuido |
| Pin sin entrada operativa verificable | Descripción aproximada, `operationalEntrance=unknown` |
| Referencia de otro tenant o vínculo revocado | Rechazo antes de mutar el borrador |
| `expectedDraftVersion` obsoleto | `409 STALE_DRAFT`, sin escritura parcial |
| Confirmación explícita sobre versión válida | Una mutación auditada, versión incrementada; Web y MCP leen la misma referencia |
| Misma búsqueda por Web y MCP | Mismos candidatos, fuente, precisión y orden desde el mismo servicio |

El servicio y estas pruebas ejecutables esperan la aprobación del manifiesto HAC-31, el cierre de Gate-2, el ADR del proveedor con Juan y el contrato de borrador de HAC-12. No se añade proveedor externo ni clave en este corte.
