# Cotización sintética Cliente–Carrier

Receta de demo guardada en `seed.sql`. Ejecutarla como SQL solo devuelve la receta. El runner `scripts/activate-quote-demo.mjs` crea los datos mediante sesión Auth genuina y RPCs nativos; no modifica JWT, grants, cuentas ni los fixtures existentes.

Scope: `cargomesh-v2` (`yhimeajpzicjbxpbzsyh`), Carrier sintético existente, un servicio FTL Lima → Arequipa, camión seco de 10 t / 30 m³, capacidad del 21 al 25 de octubre de 2026 y requisito KEEP_DRY simulado. Reutiliza el corredor HAC44 **SIMULATED de 100 km**: esa distancia no representa una medición real Lima–Arequipa. No crea geometría de Google ni confirma acceso vial real.

La tarifa propuesta es **USD 500 por viaje, SIMULATED**, válida hasta el 26-oct-2026 00:00 UTC. La oferta dura como máximo dos horas; el booking tiene 30 minutos para confirmación, acotados al vencimiento de la oferta. Se requiere aprobación explícita del administrador del Carrier para activar esta tarifa.

## Preparación y activación

1. Aplicar la migración `20261020234155` y sus dependencias autorizadas tras comparar el ledger real.
2. Desde `cargomesh/`, ejecutar `node --conditions=react-server --import tsx scripts/check-quote-scenario.ts`. Comprueba los contratos sin escribir en DB.
3. Desde la raíz, ejecutar `node scripts/activate-quote-demo.mjs` para ver el plan sin autenticarse ni escribir.
4. Solo con autorización de activación: añadir `--apply-synthetic --approve-tariff --private-config RUTA_PRIVADA --private-login RUTA_PRIVADA --evidence RUTA_DE_EVIDENCIA`. Los archivos privados proporcionan la URL/anon key y el acceso demo existente; no se pasan claves como argumentos ni se imprimen.

El runner comprueba proyecto, Carrier sintético y ADMIN verificado. Cada comando conserva una clave idempotente. Ante drift de recursos o tarifa, se detiene para revisión y conserva los IDs ya creados; no sobrescribe cambios de otro usuario. La evidencia contiene IDs/versiones y procedencia, sin tokens ni credenciales.

No crea pedidos, ofertas, bookings, reservas ni asignaciones de conductor. Se crean cuando una persona realiza las acciones correspondientes en el flujo. Un solo Carrier de demo puede producir una opción: «hasta tres» no obliga a fabricar otros proveedores.
