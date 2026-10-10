# Flujo de entrega vigente — CargoMesh V2

Actualizado el 9 de octubre de 2026. Este documento organiza la lectura; los contratos de dominio y el DoD de cada issue conservan su autoridad.

## Trabajo e integración

1. Leer [AGENTS.md](../../../AGENTS.md) y [contratos V2](../contracts/README.md).
2. Consultar la issue vigente en Linear: dueño, alcance, dependencias, rama registrada y DoD. Usar la [plantilla](./LINEAR_ISSUE_TEMPLATE.md).
3. Trabajar en la rama del responsable desde `origin/main`; entregar PR a `main`. La decisión autorizada del 9 de octubre sustituye la base anterior y el flujo por ramas de ciclo.
4. Ejecutar las comprobaciones pertinentes y entregar evidencia por SHA, entorno y dataset. Los defectos funcionales medios/altos regresan al dueño.
5. Revisar y obtener autorización antes del merge. El gate verifica un SHA de la base; cada incremento integrado puede dejar pendientes del DoD.
6. Aplicación alojada y cambios de infraestructura requieren autorizaciones separadas. Un merge a `main` puede activar el despliegue automático configurado. Véase el [acta vigente](./MAIN_V2_INTEGRATION_2026-10-09.md).

## Lectura del backend y los modelos

- [UML, modelos y DER](../models/README.md).
- [Contrato integral y límites de HAC-40](./HAC40_FULL_API_AND_CLOSURE.md).
- [Catálogo de endpoints](./HAC40_API_ENDPOINTS.md).
- [Workflow persistente](./HAC40_WORKFLOW_API.md).
- [Reconstrucción V2 local](./HAC29_CLEAN_BOOTSTRAP.md).
- [Calidad, revisión y aceptación](./QUALITY_AND_VALIDATION_PLAN.md).

## Reconciliación documental posterior a main @ 42a4fde

HAC-40 actualiza cinco relaciones en un UML derivado y en el DER reproducible; conserva el original y los estados QA históricos. La suite 22 añade un boundary autenticado de creaciones antes de la inspección privilegiada; el boundary final ya estaba autenticado en este corte. Véase el [acta del incremento](./HAC40_MODEL_QA_CLOSURE_2026-10-09.md). F-02 sigue parcial; la medición restante pertenece a HAC-44 y la actualización de identidad a HAC-41.

## Revisión vigente UML → BD/API e identidad

La [revisión única de d3a80eb y su integración](./uml-bd-api-2026-10-09/README.md) incorpora los mappings actuales de HAC-41 y clasifica todas las filas sin certificación. La base auditada incorpora #111, #112, #113 y #114; no usar el corte de 23 migraciones ni el mapping anterior de OrganizationMember como evidencia del emisor CarrierOperator.

El incremento agrega una migración de lectura: RouteWaypoint.sequence y Booking.data.decisionId. La cadena del repositorio pasa de 26 a 27; los hashes de las 26 anteriores se conservan. Los gates locales del incremento pasan. La actualización alojada ya pasó: 27/27 migraciones, cuatro respaldos restaurados y smoke 21/21 hasta IN_PROGRESS. Véase el [resultado vigente](./uml-bd-api-2026-10-09/DEPLOY_Y_REPRUEBA_29c385f.md). La reprueba independiente de QA sigue separada.

F-02 permanece parcial: la medición actual certifica 225 endpoints y 297 atributos; quedan 97 atributos parciales, tres divergencias documentales legacy, 42 relaciones y semántica de 146 métodos por probar. La clasificación vigente está en `uml-bd-api-2026-10-09/29c385f/`; los CSV del nivel superior conservan el corte original d3a80eb y no sustituyen los resultados posteriores. Axel puede continuar MCP desde la base compartida; los fallos nuevos requieren reproducción antes de cambiar dominio.

## Antecedente del corte de limpieza — 7 octubre

La base de esta limpieza es `50c12d115dd9b2171d9375acd215593de29e8f34`: incorpora #104 (correcciones F-05/calendars), #105 (harness QA), #106 (reconciliación documental DER F-02) y #107 (retiro de planes superados). El PR #108 promovió ese árbol a `main` con autorización expresa (merge `feef2419fa5f786c9a6063f85aeee452dd9eb84b`). La limpieza del runtime V1 y su prueba local se documentan en [esta evidencia](./V1_RUNTIME_RETIREMENT_LOCAL_EVIDENCE_2026-10-07.md); no se presumen integradas por estar documentadas.

HAC-40 conserva pendientes del modelo completo. La integración documental de #106 no sustituye su revisión independiente de F-02. La matriz debe distinguir implementación, cobertura parcial y faltantes por dueño; el número de rutas existentes no demuestra que todas las clases o relaciones estén completas.

Este corte no certifica esquema Supabase alojado, flujo Web completo ni Alexa+ live. El estado operativo posterior se consulta en Linear y en la evidencia del SHA que se evalúe; no se deduce de fechas o conteos históricos.

## Historia

Los planes superados están en [el archivo de septiembre](./archive/2026-09-plans/README.md). Las actas, diccionarios y evidencias fechadas conservan sus ubicaciones para trazabilidad y consumidores; sus estados pertenecen al corte indicado, no al presente.
