# HAC-40 — cierre documental UML → BD/API y boundaries de la suite 22

## Corte y alcance

Base auditada: `main @ 42a4fde4ac2e9242d8f0ed46029101a4e44d90ed`. Rama registrada en HAC-40: `codex/v2-model-qa-closure`; target: `main`. Responsable: Cristhian. Incremento autorizado después de la reprueba independiente de HAC-44 del 9 de octubre.

Este incremento reconcilia cinco relaciones documentales y refuerza la evaluación de constraints de la suite 22. No cambia servicios, endpoints, DTO, migraciones ni configuración alojada. Los 27 archivos de migración conservan sus hashes. El backend sigue en TypeScript/Hono; Python se usa en los generadores y herramientas de verificación existentes.

## Cinco relaciones reconciliadas

La numeración corresponde al inventario histórico, con índice desde cero. Los extremos se escriben en orden **origen / destino**, igual que las etiquetas del XML; no significan dos columnas físicas.

| Nº | Relación | UML histórico | UML derivado vigente | Persistencia y API |
|---|---|---|---|---|
| 35 | PlanResource → CapacitySource | 0..* / 0..1 | 0..* / 1 | `plan_resources.asset_id XOR capacity_pool_id`; exactamente una fuente. El comando de plan exige exactamente uno de `assetId` o `capacityPoolId`; disponibilidad UNKNOWN no permite ausencia de fuente. |
| 40 | CarrierOffer → RankedOption | 1 / 0..* | 1..* / 0..* | `ranked_options.offer_id` conserva la oferta representativa; `data.offerIds` guarda el conjunto de ofertas atribuibles que cubre todas las asignaciones sin duplicarlas. GET/POST de ranking exponen ambos campos. |
| 73 | FreightRequest → ShipmentContact RECIPIENT | 1 / 0..1 | 1 / 1 | `v2_snapshot.contacts.recipient` es un valor obligatorio del agregado V2; POST valida `contacts.recipient` y GET lo devuelve. |
| 83 | SelectionDecision → Booking | 1 / 0..1 | 1 / 0..* | `v2_bookings.decision_id`; unicidad `(decision_id, offer_id)`. Una decisión selecciona 1..* ofertas y puede tener varios bookings, uno por oferta/emisor. GET conserva `data.decisionId`. |
| 90 | FreightRequest → ShipmentContact PICKUP | 1 / 0..1 | 1 / 1 | `v2_snapshot.contacts.pickup` es un valor obligatorio del agregado V2; POST valida `contacts.pickup` y GET lo devuelve. |

Estas reglas describen los comandos nativos V2. No convierten snapshots V1 incompletos en válidos, no introducen CRUD independiente de contactos ni fabrican una oferta global. Booking AUTHORIZED y confirmación del carrier son estados distintos. No se promete atomicidad entre proveedores externos.

### Procedencia y reproducción

- El [UML 07](../diagrams/review-2026-09-24/07-complete-classes-sprint2-reviewed.drawio) permanece intacto; SHA-256 UTF-8/LF: `104b126cc17565b57064fca0c6a8efd5cf43a076c1cb041355e5174cbe68dc88`.
- El [UML 08 derivado](../diagrams/review-2026-09-24/08-complete-classes-contract-reconciled-2026-10-09.drawio) cambia únicamente cinco etiquetas de multiplicidad y el nombre de la página. Conserva 57 clases, 397 atributos, 93 relaciones, operaciones, IDs y geometría.
- [Reconciliación de relaciones](../models/FULL_MODEL_CURRENT_RELATIONS.json): contrato actual y evidencia por relación. Los estados QA originales no se sobrescriben.
- [DER reproducible](../models/FULL_MODEL_DER.md): muestra por separado baseline histórico y revisión derivada; su JSON incluye ambos hashes.
- [PRODUCT_SCOPE](../contracts/PRODUCT_SCOPE.md#corte-de-mvp) ya establece 1..* ofertas por decisión; se alinea el párrafo desactualizado de [TRANSPORT_PLANS_AND_FLEET](../contracts/TRANSPORT_PLANS_AND_FLEET.md).

Desde la raíz del checkout:

```text
python scripts/check-v2-full-model.py
python scripts/build-v2-current-uml.py --check
python scripts/build-v2-full-der.py --check
```

Para regenerar: ejecutar primero `build-v2-current-uml.py` y después `build-v2-full-der.py`, sin `--check`. El gate del DER verifica también el XML derivado; un cambio adicional o una multiplicidad distinta falla. El inventario histórico sigue leyendo UML 07 para conservar la identidad de las filas del harness.

## D-04 — evaluación autenticada de constraints

El reporte de HAC-44 señaló `RESET ROLE` en la línea 66 de la suite 22, antes del boundary final. En `42a4fde`, la línea 68 ya restablece `authenticated`; además, antes de `SET CONSTRAINTS ALL IMMEDIATE` se comprueban `current_user` y `auth.uid()`. Por eso **D-04 no se reproduce como boundary final privilegiado en este corte**.

Sí existía una cobertura menos explícita: los eventos diferidos de las creaciones iniciales cruzaban una inspección privilegiada intermedia. Se agrega un boundary inmediato antes del primer `RESET ROLE`, con aserciones de rol y actor antes de ejecutarlo y de rol después. Se vuelve a diferir mientras se conserva el actor, para que las transiciones posteriores lleguen al boundary final ya existente. El `RESET ROLE` sigue limitado a inspecciones que necesitan permisos de tabla.

La prueba debe fallar ante un error de permisos de un trigger diferido bajo el actor. No se permite resolverlo evaluando las constraints después de elevar privilegios.

## Verificación del incremento

Ejecutado localmente en el banco propio `hac40-model09-v2` (puertos 64600+), separado de los bancos activos de QA: **27/27 migraciones** con historial exacto y hashes verificados; suite 22 original de `42a4fde` **43/43**; suite 22 reforzada **46/46**; perfil V2 completo **988/988 pgTAP**. Después se reconstruyó el banco, se comprobaron cero usuarios/organizaciones/carriers/facilities y se dejó detenido. El generador verifica el hash histórico, conserva todos los demás cells y rechaza una modificación ajena de clase. Los logs externos están en `salida/hac40-model-qa-closure-20261009/`; no son mediciones nuevas del harness HAC-44. El CI de este incremento debe pasar sus tres jobs antes de integrar. La reprueba de QA sobre el SHA final sigue siendo independiente.

## Clasificación y entrega

| Pendiente del reporte de QA | Clasificación | Dueño / siguiente acción |
|---|---|---|
| Cinco multiplicidades anteriores | Documentación desactualizada | HAC-40 actualiza UML derivado, DER y contrato; HAC-44 relee el resultado por SHA. |
| D-04 de la suite 22 | Observación no reproducida en el boundary final del corte; fortalecimiento de cobertura inicial | HAC-40 ejecuta original y suite reforzada como authenticated; HAC-44 revalida ambos boundaries. |
| 189 filas: 97 atributos, 55 clases con 144 métodos, 37 relaciones | Evidencia pendiente según reporte de main @ 42a4fde | HAC-44 mide desde el catálogo/HTTP y casos reales; no promover matrices manualmente. Estos conteos son del reporte, no una medición nueva de este incremento. |
| McpAccountLink histórico frente a verificado | Documentación de identidad pendiente | HAC-41 / Axel. |
| C-01, C-02, C-03 y comandos comerciales faltantes del chat | Hallazgos o alcance de interfaz | Axel; distinguir comandos implementados de flujos disponibles por API. |
| Optimización y adaptadores reales | Límites explícitos del producto | No afirmar óptimo global ni integración live sin datos y evidencia. |
| Proveedor OAuth real, Alexa+ live y Bedrock | Certificación de integración pendiente | HAC-41; OAuth PKCE local no certifica el proveedor alojado. |

**F-02 sigue parcial.** No se ha confirmado un defecto funcional nuevo en el backend con esta revisión. El cierre de nuestro incremento documental no equivale a certificar todas las filas del modelo ni a ejecutar un despliegue.
