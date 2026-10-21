# C-01: cierre local de los cuatro gates transaccionales

21 de octubre de 2026. Alcance A + C; consolidación B y ruteo avanzado siguen separados.

## Resultado observado

| Gate | Evidencia ejecutada | Resultado |
|---|---|---|
| G-01 Concurrencia | Dos conexiones PostgreSQL y dos pedidos/decisiones/bookings independientes compiten por los mismos dos activos en ventanas superpuestas. Se observa mediante `pg_blocking_pids` que B espera el bloqueo de A antes del commit. A confirma; B recibe `PT409 PLAN_OR_OFFER_NOT_CURRENT`. | PASS, 5 comprobaciones |
| G-02 Atomicidad | Se provoca un error de persistencia en la segunda inserción, después de comprobar dentro de la transacción que la primera existe. La llamada nativa revierte ambas; no hay confirmación, auditoría ni recibo de éxito. Además, un mantenimiento real publicado mediante el comando nativo después de cotizar impide confirmar la combinación. | PASS, 9 comprobaciones |
| G-03 Integridad comercial | Oferta vencida, escritura directa de precio por Cliente/Carrier, revisión nativa del precio ya seleccionado, versión de booking obsoleta, cambio versionado del corredor y cambio de parámetros de tarifa. | PASS, 14 comprobaciones |
| G-04 Aislamiento | Cliente extranjero y Carrier distinto con identidades activas válidas: no leen booking/oferta/costos ajenos, no suplantan la membresía y no confirman la contratación ajena. | PASS, 10 comprobaciones |

**38 comprobaciones focales PASS.** El reproductor también reutiliza y comprueba el setup canónico del caso de costos/admisión existente; no se suman esos positivos como cobertura nueva. No fueron necesarias correcciones nuevas a la lógica del producto para superar estos cuatro gates.

La confirmación probada es `prepare_v2_delegated_booking`: una sola transacción nativa, bajo autorización Carrier previamente configurada y consentimiento Cliente explícito. No se hizo un UPDATE privilegiado de booking para fingir el positivo.

El ganador conserva **12 t, una oferta COST_PLUS de USD 310.80, un booking, dos reservas CONFIRMED y ejecución PLANNED**. Los identificadores sintéticos y los dos PIDs se guardan en `c01-gates-final/C01-GATES.json`; no corresponden al alojado.

## Límites precisos de la evidencia

- G-01 es una contención controlada real de dos transacciones, no una prueba de estrés ni una medición de throughput. El backend utiliza actualmente un bloqueo amplio y ordenado de servicios para privilegiar corrección.
- G-02 combina un mantenimiento publicado por el API nativo con una inyección de fallo exclusiva de la base de prueba durante la segunda inserción. No afirma que el mantenimiento pueda atravesar arbitrariamente el bloqueo de la transacción.
- El negativo de expiración prepara con el dueño de la base temporal una oferta ya vencida y llama la confirmación nativa autenticada. No se esperó una hora real ni se habilitó que un usuario cambie ofertas publicadas.
- Un cambio de política comercial devuelve `null` en la preparación delegada, deja el booking AUTHORIZED y requiere revisión manual; no genera una confirmación automática con el precio nuevo.
- USD 310.80 y el corredor de 100 km son sintéticos. No constituyen una tarifa ni certifican distancia, accesos o plazo Lima–Arequipa.
- Esta etapa no inició viajes, asignó conductores, validó puertas/ejes, probó voz o certificó una ruta real.
- No hubo nuevas pruebas de UI, build completo o CI. No hubo escrituras comerciales alojadas, seeds, commits, push, merge, Vercel ni AWS.

## Reproducción local

Desde el checkout activo, con Docker y una base Supabase local inicializada:

```powershell
python scripts/verify_c01_transaction_gates.py --local-only --container supabase_db_hac45-carrier-local --output C:/Users/HP/Documents/cargomesh/salida/costos-prs-20261021/c01-gates-replay
```

El script copia solo el esquema local y las dos tablas normativas de categorías/equipos. No copia usuarios, pedidos ni secretos existentes. Aplica las migraciones pendientes y el baseline guardado `LOCAL_ONLY` en una base propia; cada gate usa una copia de ese fixture. Borra únicamente las bases aleatorias que creó, verificando su prefijo/formato. La ejecución final eliminó sus cinco bases temporales.

Salida final: `c01-gates-final/C01-GATES.json`, `G01-sessions.log`, `G01-concurrency.log`, `G02-atomicity.log`, cinco logs `G03-*` y `G04-organization-isolation.log`. El JSON incluye SHA-256 del reproductor para correlacionar código y resultados.

## Revisión de las DDL pendientes y orden

1. `20261021175507_carrier_operating_costs.sql`, depende de `20261021154000`.
2. `20261021203000_resource_route_admission.sql`, depende de la anterior.

Ambas se aplicaron en las bases temporales de esta ejecución; las dependencias e integridad de los hashes se registran en `DDL-C01-REVISION.json`.

- Costos añade validación/cálculo y lectura privada por identidad Carrier; no introduce datos de demo ni permite al Cliente leer parámetros internos.
- Admisión amplía la tabla existente `route_resource_limits` con un CHECK sobre datos opcionales. Conserva RLS, índices, versiones y recibos existentes. No crea otra tabla de permisos ni concede ejecución directa de los helpers privados.
- Los registros históricos sin `admission` siguen siendo estructuralmente válidos. `compatibilityConfirmed=true` solo permite operar con evidencia vigente; `false` se interpreta como UNKNOWN. Esto puede impedir nuevas confirmaciones sobre evidencia antigua incompleta y exige revisar los registros afectados antes del rollout.
- La RPC de lectura anterior permanece disponible con su forma original; el nuevo frontend utiliza `read_v2_dispatch_options_with_admission`. Aplicar DDL antes de publicar ese frontend evita llamadas a una función inexistente.
- No deshacer DDL borrando a ciegas funciones renombradas o historial. Un rollback del frontend no debe retirar las guardas de seguridad; un cambio de esquema posterior debe ser aditivo y revisado.

Esta revisión local **no certifica el historial actual del Supabase alojado**. Antes de aplicar se debe comparar su ledger y los registros afectados, con autorización específica del corte y la activación del escenario.

## Siguiente hito conjunto

El catálogo continúa DRAFT en `CONTRATO-DATOS-A-C.md`: empresa e identidades autorizadas, sedes/coordenadas, dos cajones de 6 t, dos camiones de 10 t, 28 m³ útiles propuestos por camión, dos conductores, ventanas, corredor y costos. Acordar esos datos y versionarlos antes de materializar seeds o tarifas. Después, con rollout autorizado, repetir C-01 en el alojado y registrar sus IDs reales.
