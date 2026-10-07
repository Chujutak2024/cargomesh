# Flujo de entrega vigente — CargoMesh V2

Actualizado el 7 de octubre de 2026. Este documento organiza la lectura; los contratos de dominio y el DoD de cada issue conservan su autoridad.

## Trabajo e integración

1. Leer [AGENTS.md](../../../AGENTS.md) y [contratos V2](../contracts/README.md).
2. Consultar la issue vigente en Linear: dueño, alcance, dependencias, rama registrada y DoD. Usar la [plantilla](./LINEAR_ISSUE_TEMPLATE.md).
3. Trabajar en la rama del responsable desde `codex/v2-amazon-contracts`; entregar PR directamente a esa base. La decisión del 4 de octubre sustituye el flujo por ramas de ciclo.
4. Ejecutar las comprobaciones pertinentes y entregar evidencia por SHA, entorno y dataset. Los defectos funcionales medios/altos regresan al dueño.
5. Revisar y obtener autorización antes del merge. El gate verifica un SHA de la base; cada incremento integrado puede dejar pendientes del DoD.
6. Aplicación alojada y despliegue requieren autorizaciones separadas. `main` permanece congelada.

## Lectura del backend y los modelos

- [UML, modelos y DER](../models/README.md).
- [Contrato integral y límites de HAC-40](./HAC40_FULL_API_AND_CLOSURE.md).
- [Catálogo de endpoints](./HAC40_API_ENDPOINTS.md).
- [Workflow persistente](./HAC40_WORKFLOW_API.md).
- [Reconstrucción V2 local](./HAC29_CLEAN_BOOTSTRAP.md).
- [Calidad, revisión y aceptación](./QUALITY_AND_VALIDATION_PLAN.md).

## Corte documentado, no certificado de cierre

La base de esta limpieza es `50c12d115dd9b2171d9375acd215593de29e8f34`: incorpora #104 (correcciones F-05/calendars), #105 (harness QA), #106 (reconciliación documental DER F-02) y #107 (retiro de planes superados). El PR #108 promovió ese árbol a `main` con autorización expresa (merge `feef2419fa5f786c9a6063f85aeee452dd9eb84b`). La limpieza del runtime V1 y su prueba local se documentan en [esta evidencia](./V1_RUNTIME_RETIREMENT_LOCAL_EVIDENCE_2026-10-07.md); no se presumen integradas por estar documentadas.

HAC-40 conserva pendientes del modelo completo. La integración documental de #106 no sustituye su revisión independiente de F-02. La matriz debe distinguir implementación, cobertura parcial y faltantes por dueño; el número de rutas existentes no demuestra que todas las clases o relaciones estén completas.

Este corte no certifica esquema Supabase alojado, flujo Web completo ni Alexa+ live. El estado operativo posterior se consulta en Linear y en la evidencia del SHA que se evalúe; no se deduce de fechas o conteos históricos.

## Historia

Los planes superados están en [el archivo de septiembre](./archive/2026-09-plans/README.md). Las actas, diccionarios y evidencias fechadas conservan sus ubicaciones para trazabilidad y consumidores; sus estados pertenecen al corte indicado, no al presente.
