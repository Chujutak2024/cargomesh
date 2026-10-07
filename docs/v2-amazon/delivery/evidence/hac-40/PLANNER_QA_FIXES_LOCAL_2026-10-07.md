# HAC-40 — correcciones de reprueba #111

Fecha: 7-oct-2026 (America/Lima). Rama `codex/v2-full-backend`, PR #111 hacia `codex/v2-amazon-contracts`. El SHA es el commit que contiene este informe. La reprueba independiente de `58f32ee` detectó B01/B02; sus resultados anteriores no certifican este corte.

## Correcciones

- B01: `maxAlternatives` limita exclusivamente la respuesta. Se conservan los snapshots evaluados; no se elimina historia ni se relaja el guard. La búsqueda sigue acotada a 64 corredores / 1000 walks / 8 tramos.
- B02: el validador compartido de rutas aplica `payloadLimitKg` con evidencia y vigencia para la ventana de la solicitud. Exceso: `ineligible / ROUTE_PAYLOAD_LIMIT_EXCEEDED`. Límite faltante, sin evidencia o vencido: `unknown / ROUTE_PAYLOAD_LIMIT_UNKNOWN`, salvo otro bloqueo duro que mantiene `ineligible`. Peso exactamente en el límite tiene control positivo elegible sobre un corredor aislado.
- Búsqueda: `expectedDraftVersion` obligatorio, coherente con el contrato de solicitudes. Después de resolver un replay idéntico, una creación nueva rechaza versión obsoleta con `409 STALE_DRAFT`. Replan conserva `expectedVersion` de ruta.
- Migración aditiva `20261007170000_hac40_planner_qa_fixes.sql`; se conservan intactas las 22 migraciones anteriores. Manifiesto actualizado a 23. No se cambia el harness HAC-44.

## Evidencia local

| Gate | Resultado |
|---|---|
| Reconstrucción desde cero | 23/23, historial exacto |
| Drift public/private | 0 |
| pgTAP V2 | 940/940, 26 archivos |
| Test 32, rerun con control aislado | 69/69, authenticated al evaluar constraints |
| HTTP modelo | 54/54, Auth local real, tenants A/B, concurrencia, truncación con 2 caminos, carga excedida/igual/desconocida/vencida/sin evidencia |
| HTTP workflow | PASS, 14 colecciones y flujo reserva/confirmación/booking/cancelación |
| HAC-40 aplicación | 64/64 |
| Gate aplicación completo | typecheck, arquitectura, release 286/286 y build PASS |
| UML/DER | PASS 57/397/93; UML intacto |

Comandos: `pnpm --dir cargomesh release:verify`, `pnpm --dir cargomesh test:hac40`, `pnpm --dir cargomesh test:hac40:model-closure-http`; Supabase CLI 2.117.0 `db reset --local`, `test db --local` con perfil V2 y `db diff --local --schema public,private`. Reconstrucción en el proyecto desechable `hac40-model-closure-replay`. El smoke utiliza exclusivamente `cargomesh-v2-local` y limpia sus fixtures y sesiones; las funciones aplicadas allí no certifican su historial manual.

## Entrega y límites

Solicitar reprueba independiente HAC-44 sobre el nuevo SHA de #111, con actualización del body de búsqueda a `expectedDraftVersion`. Revisar B01 con más caminos que alternativas, retención de snapshots e idempotencia; B02 en BD/HTTP con controles positivos, límites ausentes/vencidos y tenants. El lint independiente reportado por QA necesita su comando y diagnóstico exactos: el build local pasó su fase de lint/tipos, lo que no sustituye otro gate.

CI se verifica por SHA en el PR. Supabase alojado, merge, main y despliegue no forman parte de esta corrección. El paquete alojado necesita manifiesto actualizado a 23 migraciones y SHA aprobado después de QA.
