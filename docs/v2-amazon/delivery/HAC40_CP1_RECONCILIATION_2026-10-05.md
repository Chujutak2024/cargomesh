# HAC-40 / HAC-27 — correcciones CP-1, 5 oct 2026

Estado: **Draft de implementación; medios abiertos hasta reprueba**.
Rama: `codex/v2-full-backend`. Target directo: `codex/v2-amazon-contracts`, por instrucción vigente de Cristhian.
Base: `038d861980e0dda99f19205c8a923bca361235dc`. El corte independiente de QA sigue siendo `abba805`.

## Hallazgos y cambios

| Hallazgo | Corrección entregada en el incremento | Pendiente |
|---|---|---|
| F-01 / HAC-27 | Diccionario sustituido por 397 filas observadas; matriz de las 57 clases sin diferidos; 93 relaciones enlazadas. | Revisión documental independiente. No cambia los estados QA para fingir cierre. |
| F-02 / HAC-40 | DER generado separa destino observado, objetivo previo y estado QA; `Booking.selectionDecisionId` observa `decision_id`; valores comerciales muestran sus rutas JSON reales. | Refrescar observación física al nuevo SHA con QA. |
| F-04 / HAC-40 | Placa/carrocería obligatorias en Zod y RPC nativa; capacidad auxiliar explícita cero, sin capacidad de carga; lecturas de campos obligatorios ya no admiten NULL. Catálogo incompleto devuelve `409 CATALOG_DATA_INCOMPLETE` y permite revisión válida. Creación de plan rechaza equipo ausente con `409 RESOURCE_EQUIPMENT_REQUIRED`. | Prueba PostgreSQL/HTTP del nuevo corte y reprueba de QA de las 18 filas. |
| F-05 / HAC-40 | Decisión expresa de Cristhian: conservar UML. Nueva migración 20261005192012: ruta exclusiva por plan, asignación canónica 1..N recursos, reservas con FK directa al recurso; DTO agrupado y compatibilidad del DTO plano. | pgTAP/HTTP del nuevo SHA y reprueba independiente; implementación publicada no equivale a aprobación. |
| F-07 / HAC-40 | Ruta devuelve `planner.algorithmVersion`, `graphVersion` SHA-256 y `source`; snapshot derivado de revisiones originales del itinerario y política. | Prueba PostgreSQL de generación, lectura, variación y replay; reprueba QA. No implementa búsqueda automática de red. |
| F-08 / HAC-40 | `value.version` de categoría es string; `record.version` sigue siendo contador numérico para concurrencia. Recibos antiguos proyectan la revisión desde su versión original sin reescribirlos. | Prueba RPC/GET y reprueba QA. |

## Contratos de compatibilidad

- `CargoSpecification.availableDocuments` siempre es array en la lectura canónica. La omisión en entradas anteriores sigue significando que no se presentaron documentos; la normalización se realiza al leer y no altera el payload ni su huella de creación.
- `AUXILIARY.usefulCapacityKg = 0` es una proyección de su rol, no una estimación de capacidad desconocida. En almacenamiento se conserva NULL para ESCORT, compatible con los filtros existentes que impiden usarlo como portador. El portador exige capacidad positiva; el auxiliar no admite volumen útil.
- Filas importadas incompletas requieren una revisión con la versión esperada y datos válidos; no se rellenan fuente, ventana, placa ni evidencia ficticias.
- Planner: `PUBLISHED_ITINERARY_VALIDATOR_V1`, fuente `PUBLISHED_CORRIDORS`, alcance `SELECTED_ITINERARY_SNAPSHOT`. La huella usa IDs/revisiones de corredores, nodos y política guardados en la ruta. No indica exploración automática del grafo ni cobertura live.
- Recibos antiguos de rutas conservan payload/resultado original; al responder se proyecta metadata desde ese snapshot, sin reemplazarlo por datos actuales ni modificar la huella o consumir otra clave.
- Las 57 clases siguen en alcance. Los resultados de QA son 2 completas, 43 parciales, 2 faltantes y 10 divergentes en `abba805`; no constituyen un porcentaje de producto terminado ni certificación del nuevo incremento.

## Migración y validación

Migración aditiva: `20261005181940_hac40_cp1_contract_reconciliation.sql`, registrada por SHA-256 en el manifiesto; pasa la verificación estática de procedencia, dependencias e inventario.

Comprobaciones locales del incremento:

- Typecheck PASS.
- HAC-12 59/59 y HAC-40 56/56 PASS.
- Release 570/570 PASS.
- Arquitectura PASS: 304 módulos, 36 entradas cliente.
- Build PASS.
- Inventario y DER generado PASS: 57 / 397 / 93; hash original UML intacto.
- PostgreSQL, pgTAP, carreras y HTTP del nuevo corte **pendientes**. Las pruebas SQL añadidas no se cuentan como ejecutadas.

Friction log: Docker no expone `dockerDesktopLinuxEngine`; el intento de abrir Docker Desktop no dejó el motor disponible. Se solicitó al usuario iniciar el motor. La invocación del gate con sandbox alcanzó procedencia PASS y falló en la descarga del CLI por ENOTFOUND; la comprobación estática del manifiesto se ejecutó directamente sin red y pasó. No se declara el gate completo aprobado. La CI del Draft debe aportar evidencia adicional por SHA.

## Dependencias y límites

F-03 y F-06 son de HAC-41/Axel: identidad y emisor de oferta como CarrierOperator. `workflow_offer` conserva el defecto reportado; ninguna prueba de esta entrega lo declara resuelto. QA conserva cobertura/dataset F-09/F-10. Antes de integrar se requiere reprueba del corte y autorización de merge.

No hubo DDL/seeds alojados, modificación de V1, main, Vercel ni despliegue. No se cierra HAC-40, HAC-27, HAC-44 ni el gate completo.

## Incremento F-05 autorizado — 5 oct 2026

- `PlanLegAssignment` es la cabecera persistente en `plan_leg_assignments`. `plan_resource_bindings` conserva las filas por recurso del corte anterior; cada vínculo pertenece a una cabecera y cada PlanResource tiene un vínculo exclusivo. El mínimo de un recurso se verifica mediante constraint triggers diferidos.
- `POST /api/v2/freight/requests/:id/plans`: acepta `assignments[].resources[]` con ventana/servicio/lane en la cabecera. Cada recurso identifica calendario, activo o cupo, combinación, rol y allocations. Se conserva la entrada plana anterior.
- `GET` y `POST` de planes agregan `data.legAssignments`: cabeceras con sus recursos. `data.assignments` conserva los vínculos anteriores y agrega `legAssignmentId`; `resourceAssessments.assignmentId` identifica esos vínculos por recurso. No confundirlo con la cabecera.
- Oportunidades, ofertas y ranking usan IDs de cabecera en sus arrays públicos. Los snapshots de oportunidad conservan el detalle por vínculo para auditar cada recurso.
- `POST /api/v2/capacity/holds` agrega `planResourceId`. Es obligatorio cuando la asignación tiene varios recursos: su omisión devuelve `409 PLAN_RESOURCE_REQUIRED`; un recurso ajeno devuelve `400 RESOURCE_ASSIGNMENT_MISMATCH`. Una reserva identifica directamente recurso y cabecera. Confirmar solo uno no habilita el booking completo.
- `UNIQUE(route_plan_id)` impide que dos planes posean la misma ruta. Reutilizar una ruta como plantilla crea otro snapshot con `copiedFromRouteId`, legs y waypoints propios. La huella de idempotencia conserva la petición original; un replay devuelve el snapshot creado. En el backfill de alternativas antiguas, el GET muestra la ruta propia y el recibo histórico conserva el resultado original.
- Migración aditiva sin escenarios nuevos en DDL; el escenario sintético de prueba vive en el test transaccional 32, con rollback.
- HAC-40 **57/57**, typecheck, arquitectura y manifiesto PASS local. Release del incremento de schemas previo al nuevo test: **570/570** PASS. CI/pgTAP/HTTP nuevos todavía pendientes: los jobs del corte `975c307` están en cola sin runner asignado. La CI 3/3 de `0358f99` no acredita F-05.
- Se añadió HTTP autenticado al job V2: stack local efímero, dos actores sintéticos, creación agrupada, replay, rutas propias, negativos y flujo hold/booking/cancelación. No se usan credenciales alojadas; no se afirma ejecución hasta obtener el resultado.

### Reprueba solicitada a HAC-44

Actualizar el corte a la cabeza final de #102, reconstruir sus 19 migraciones desde cero, ejecutar perfiles/HTTP y contrastar F-05 con las tres cardinalidades UML, RLS/FK/no bypass, recurso ajeno, asignación vacía, confirmación parcial y replay. Reobservar F-01/F-02/F-04/F-07/F-08. Mantener F-03/F-06 en HAC-41. Informar por SHA resultados y medios pendientes antes de autorizar el merge.
