# Recuperación por incidencia — prueba local aislada

No es un catálogo para activar en el alojado. `verify-flow.sql` extiende la transacción sintética C01 y termina en rollback. El controlador crea y elimina su propia base temporal en Docker; no modifica el catálogo del contenedor de origen ni C01 alojado.

Desde la raíz del checkout:

```powershell
python supabase/scenarios/v2-c01-sim-v1/verify-local.py --repo-root . --container supabase_db_hac45-carrier-local --local-only --output C:/Users/HP/Documents/cargomesh/salida/incident-recovery-20261022 --extra-flow supabase/scenarios/v2-incident-recovery/verify-flow.sql --extra-check supabase/tests/47_v2_incident_recovery.test.sql
```

El contenedor debe tener un ledger coherente con su esquema. El contenedor compartido `supabase_db_cargomesh-v2-local` observado el 22 de octubre contenía cambios adelantados a su ledger; por ello se utilizó una copia temporal de HAC45. No se reparó ni reseteó ese entorno compartido. El controlador normaliza LF para comprobar la huella aprobada del JSON C01 en Windows.

Cobertura transaccional:

- C01 original: 12 t, dos cajones indivisibles de 6 t y dos camiones, un booking confirmado.
- Primera incidencia: un camión; nueva solicitud de 6 t, política del Carrier de reemplazo, oferta, autorización Cliente y confirmación Carrier. Se conserva el camión no afectado y su reserva; se resuelve solo tras la confirmación.
- Segunda incidencia controlada sobre la carga restante en una ejecución simulada en curso: exige confirmación explícita de carga pendiente. Al confirmar el último reemplazo, cancela la ejecución/booking originales y libera la tripulación.
- La tarifa normal de reemplazo supera la anterior en este fixture para demostrar que **no hay tope**, mientras el recargo por urgencia permanece cero.
- RLS/grants, consentimiento, versión obsoleta, reserva ajena, clave reintentada y huella diferente, exclusión nativa del Carrier que falló, bloqueo del calendario accidentado y resolución prematura rechazada.

La ejecución en curso de la segunda parte es una manipulación **controlada del fixture temporal**. No acredita inicio físico ni seguimiento real. No hay solicitudes, incidencias, reservas ni cambios de operación alojados por ejecutar esta prueba. Las fechas y tarifas son sintéticas y se conservan como fixture C01; fuera de sus ventanas debe prepararse otro fixture explícito.

Para comprobar concurrencia real, ejecutar el mismo controlador con `--recovery-race` y **sin** `--extra-flow`. Ese modo confirma exclusivamente el fixture dentro de su base temporal, abre dos sesiones simultáneas y elimina la base al terminar. La misma clave devuelve el mismo caso; con claves diferentes solo una sesión puede crear la recuperación del incidente. Resultado: `LOCAL-RECOVERY-RACE.log`. No cambia la transacción de prueba ni los datos alojados.

Resultado local del 22 de octubre de 2026: 66 assertions del flujo (incluyen 21 de regresión C01), 14 del contrato SQL, 4 pruebas TypeScript y ambos casos concurrentes correctos. Typecheck, arquitectura y procedencia del manifiesto correctos. Sin revisión visual ni validación humana de este nuevo panel, y sin rollout alojado.
