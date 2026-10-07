# HAC-40 — socio por tramo, incidentes y RoutePlanner

Incremento sobre `fe12d41e474c2c12d9dcd8e77047a0f2b7f0bd66`, rama `codex/v2-full-backend`, target `codex/v2-amazon-contracts`. Dos migraciones aditivas: `20261007083000` y `20261007084000`. Contrato implementado y probado localmente; requiere reprueba independiente y aprobación de integración. No certifica Supabase alojado ni el UML completo.

## API para frontend y MCP

Prefijo `/api/v2`. Sesión autenticada; identidad y tenant derivados por servidor. Cada POST exige `Idempotency-Key` UUID. Un replay autorizado devuelve el resultado original; payload distinto con la misma clave devuelve `409 IDEMPOTENCY_CONFLICT`. Cada mutación existente exige versión esperada; `409 STALE_DRAFT` para una obsoleta.

| Método | Ruta | Payload y resultado |
|---|---|---|
| POST | `/plans/:id/assignments/:assignmentId/partner` | `{schemaVersion:"2.0",expectedVersion,note,evidence,partnerId}`; plan actualizado, `200` |
| GET | `/plans/:id` | `data.data.legAssignments[].fulfilmentPartnerId`; nullable |
| POST | `/carriers/:carrierId/incidents/:id/conditions` | `{schemaVersion:"2.0",expectedVersion,note,evidence,conditionIds:[UUID]}`; reemplaza la asociación, incidente actualizado, `200` |
| GET | `/carriers/:carrierId/executions/:executionId/incidents/:id` | `data.data.routeConditionIds`; array vacío si no hay asociaciones |
| POST | `/freight/requests/:requestId/route-alternatives` | `{schemaVersion:"2.0",policyId,expectedDraftVersion,maxLegs,maxAlternatives}`; `{data:{alternatives,search,decision:null},meta:{idempotentReplay}}`; `201` o replay `200` |
| POST | `/routes/:id/replans` | `{schemaVersion:"2.0",expectedVersion,conditionId,maxLegs,maxAlternatives}`; alternativas nuevas y decisión explicada, `201` o replay `200` |
| GET | `/routes/:id/explanation` | Snapshot persistido: versión, status, planner, reasons, confidence, distancias/duración y legs/fuentes; `currentAvailabilityConfirmed:false` |

`evidence` sigue el schema V2 común: `reference`, `provider`, `observedAt`, `validUntil` nullable y `provenanceStatus`. La explicación tiene alcance `PERSISTED_ROUTE_SNAPSHOT`; no vuelve a verificar disponibilidad actual.

## Socio ejecutor por tramo — relación UML 66

FK nullable e indexada `plan_leg_assignments.fulfilment_partner_id → fulfilment_partners.id`, preservando 0..1 por asignación y 0..N por socio. `partnerId:null` elimina la asignación antes del corte comercial. La responsabilidad carrier/servicio se conserva; el socio tiene que pertenecer al carrier dueño de ese servicio, estar ACTIVE y tener acuerdo conocido que cubra toda la ventana del tramo.

OWNER/SUPERVISOR del tenant puede asignar, con actor/fecha/evidencia persistidos y versión del plan incrementada. Después de oportunidad u oferta el snapshot comercial se bloquea (`409 PLAN_COMMERCIAL_SNAPSHOT_LOCKED`). Una revisión posterior del acuerdo se revalida al emitir oferta, crear/confirmar booking, crear/confirmar hold e iniciar ejecución; un acuerdo inválido revierte la transacción completa. Se bloquea la fila de socio al validar para coordinar revisiones concurrentes.

Errores: `400 PARTNER_SERVICE_MISMATCH`, `409 PARTNER_AGREEMENT_REQUIRED`, `404 WORKFLOW_NOT_FOUND` para recurso ajeno/ausente. No concede cobertura espacial ni capacidad extra por registrar un socio.

## Incidente ↔ condición — relación UML 48

Puente `incident_route_conditions(incident_id,condition_id)`, PK compuesta, dos FK, índice inverso, RLS habilitada y acceso directo revocado a clientes. La operación nativa exige tenant autorizado y permiso de edición carrier. Lectura mediante el agregado autorizado de incidentes; nunca por una tabla pública sin ámbito.

Cada condición debe pertenecer a un corredor del servicio ejecutado por el booking del incidente, estar ACTIVE y ser vigente en `occurredAt`. Las referencias no válidas rechazan todo el reemplazo (`400 INCIDENT_CONDITION_ROUTE_MISMATCH` o `INCIDENT_CONDITION_PERIOD_MISMATCH`) sin perder asociaciones previas ni consumir la clave. Lista sin duplicados, máximo 100; `[]` desasocia. La mutación conserva actor/fecha/evidencia y receipt. No crea ni publica condiciones automáticamente a partir de un incidente.

## RoutePlanner.findAlternatives / replan / explain

`BOUNDED_SIMPLE_PATHS_V1` enumera todos los caminos simples dirigidos dentro de límites explícitos: `maxLegs` 1..8, red de hasta 64 corredores ACTIVE con nodos ACTIVE y modos aceptados por la solicitud; máximo 1000 caminos intermedios. Si excede esos límites, `409 ROUTE_SEARCH_LIMIT` sin snapshots o receipts parciales. No presenta una heurística truncada como búsqueda exhaustiva.

El origen/destino coincide por país y ciudad con el contrato del validador existente. No calcula un conector vial de última milla desde coordenadas; esos datos conservan UNKNOWN. Cada alternativa usa el validador persistente existente para restricciones, fuentes, vigencias, condiciones y reglas de frontera/carga. Orden: eligible, unknown, ineligible; después objetivo SHORTEST/FASTEST/WEIGHTED con pesos publicados, distancia/duración y empate lexical por IDs de corredores. WEIGHTED normaliza por el máximo de cada dimensión en el universo evaluado. Dimensiones ausentes quedan detrás de las conocidas, sin inventar cero.

`maxAlternatives` 1..20 limita la presentación después de evaluar todos los caminos permitidos. `search` distingue `evaluatedPaths`, `returnedPaths`, `completeWithinBounds` y `presentationTruncated`. Universo vacío devuelve `[]`, no una ruta inventada. Los snapshots evaluados se conservan como historial inmutable, incluso si no se presentan. Una nueva búsqueda exige `expectedDraftVersion` vigente y responde `409 STALE_DRAFT` si cambió la solicitud; el replay idéntico conserva el resultado original. Los corredores con carga superior a `payloadLimitKg` quedan `ineligible` (`ROUTE_PAYLOAD_LIMIT_EXCEEDED`); límite ausente, sin evidencia vigente o vencido queda `unknown` (`ROUTE_PAYLOAD_LIMIT_UNKNOWN`).

Cada ruta automática conserva `planner.search`: algoritmo, SHA-256 de grafo/política/condiciones, versión de política, versiones de corredores/nodos y fuentes/versiones de condiciones. La metadata del validador por itinerario sigue separada. El receipt conserva el resultado completo y la hora de evaluación. Cambios de red, política o condiciones producen una nueva huella.

`replan` exige una condición actual del itinerario original, versión esperada y autorización de tenant. Crea snapshots nuevos; no cambia el plan, booking, reservas ni ruta originales. Devuelve `PROPOSE_ALTERNATIVE`, `REQUIRES_REVIEW` o `NO_ALTERNATIVE`, con `requiresSelection:true`. Frontend muestra causas/fuentes, solicita selección y vuelve a verificar recursos/capacidad por los comandos existentes. Un itinerario eligible no es un compromiso comercial ni disponibilidad confirmada.

## Reproducción y entrega

- Cadena nativa: `supabase-v2/supabase/migrations/`, manifiesto actualizado; escenarios sintéticos externos a migraciones.
- BD: perfil V2 de `supabase-v2/test-profiles.json`, incluido test 32 bajo authenticated y verificación diferida sin reset role previo.
- HTTP: `pnpm --dir cargomesh test:hac40:model-closure-http`; exige URL localhost, usuarios sintéticos A/B, banco local dedicado y `HAC40_PYTHON`. Fixture prepara/limpia por IDs, sin editar el harness HAC-44. Integrado en el smoke CI de workflow.
- Aplicación: `pnpm --dir cargomesh release:verify`; contrato de salida estricto y negativos de ámbito/metadatos.
- [Evidencia y pendientes](./evidence/hac-40/MODEL_CLOSURE_LOCAL_2026-10-07.md).

HAC-44 reevalúa relaciones 48/66 y RoutePlanner por SHA. Los estados históricos QA no se sobrescriben como COMPLETO. F-02 documental, faltantes de identidad/MCP de HAC-41, conexión UI de HAC-42/43 y validación alojada siguen sus propios gates.
