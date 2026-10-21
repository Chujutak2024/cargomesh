# C-01-SIM v1 preparado para revisión y rollout

21 de octubre de 2026. Alcance A+C, sin ampliar el motor. **Preparado localmente; no aplicado al alojado.**

## Entregables

- Manifiesto versionado: `supabase/scenarios/v2-c01-sim-v1/C01-SIM-v1.json`.
- Activación: `seed.sql`, transacción protegida con SHA, comandos nativos y claves de idempotencia estables.
- `activate-reviewed.py`: PREVIEW por defecto sin acceso de red; escritura alojada requiere aprobación registrada, hash y reconocimiento de autoridad Carrier de emisión.
- [Preview exacto de operaciones](./c01-sim-v1/C01-SIM-SEED-PREVIEW.md).
- [Orden de rollout y recuperación](./c01-sim-v1/C01-ROLLOUT-PLAN.md).

## Dataset

Pacific Produce y HAC44 ROAD se reutilizan como identidades existentes. Se preparan un servicio20t/60m³, dos camiones10t/28m³, dos conductores, calendarios coincidentes, puntos virtualesA/B y corredor100kmsimulado. Dos cajones6t,240×180×180cm, indivisibles y no apilables. Recojo2nov08–10PET y recepción14–18PET.

Los perfiles de costo son los del fixture probado: consumos30/20L100km y conductoresUSD6/8h, no los de la propuesta hipotética previa. Con recojo08:00, entrega14:00 y operación hasta14:30, el cálculo nativo devuelve **USD361.20**. El fixture previoUSD310.80 tenía3horasmenos pagadas: no se fijó artificialmente el precio.

La política tiene `autoIssue=true` solo para el nuevo servicio/lane cuando se apruebe activarla. **autoConfirm=false**: el Carrier confirma los dos recursos y el booking expresamente. Las cuatro plantillas de asignación de conductores/vehículos solo se usan después de conocer los IDs y ventanas reales del booking.

## Verificación focal ejecutada

- Schemas Zod reales:23operaciones de catálogo/workflow, cuatro plantillas posteriores y el request PASS.
- Dos activaciones locales conservan todos los IDs y no duplican registros.
- **21 comprobaciones nativas PASS:** una oferta COST_PLUS atribuible, un booking, dos reservasCONFIRMED, dos camiones distintos,12tconservadas, dos conductores y vehículos asignados, ejecuciónPLANNED. autoConfirm siguefalse.
- Snapshots de filas preexistentes en las tablas inspeccionadas sin cambios. La base temporal se eliminó.
- No repetición de los cuatro gates previos ni pruebas amplias sin necesidad.

Es una prueba local con candidato explícito y RPC nativas, no un login ni una demostración visual alojada. Los IDs de prueba no son IDs reutilizables en producción. Evidencia local en `salida/c01-sim-v1-20261021/final-local/` del workspace de preparación.

## Prerrequisitos alojados renovados

Consulta READ ONLY21oct22:58UTC: identidades referenciadas válidas, administrador técnico existente congrantvigente, siete límiteslegacy sinadmission, cero activos/sedes/políticasC01previos. Sigue aplicada154000;175507costos y203000admisión pendientes. No hubo escrituras alojadas. Los siete límites se revisaron antes y no incumplen el CHECK propuesto; volver a comprobarlo justo antes de aplicar.

## Pendiente de aprobación

El documento del usuario exige revisión de los tres entregables antes del rollout, y el AGENTS aportado congela main. Falta autorización específica para publicar el corte, aplicar ambas DDL y activar el dataset/política de emisión. La activación del catálogo extendido de Nova en Vercel y la prueba humana van después de ese rollout aprobado. El gateway AWS ya pasó handshake5007bytesready; no cambiarlo por este corte.

No se ejecutaron commit, PR, push, merge, despliegue, DDL o seeds alojadas durante esta preparación.
