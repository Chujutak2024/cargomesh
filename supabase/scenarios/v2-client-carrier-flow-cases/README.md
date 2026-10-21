# Casos ordenados Cliente–Carrier

Receta sintética **LOCAL_ONLY**, preparada para acordar los datos definitivos. Ejecutar `seed.sql` devuelve JSON y no crea pedidos, ofertas, bookings, usuarios ni reservas. No existe activador alojado de este paquete. Los nueve casos no se presentan como activos en Vercel.

## Orden

1. FTL de una oferta/un camión y autorización explícita.
2. Reservas complementarias de una solicitud y reintento sin duplicación.
3. Dos camiones portadores, pieza indivisible, conflicto de agenda y límite agregado de ruta.
4. Dirección, versiones, evidencia y vigencia de las rutas.
5. Activación de datos cuando se confirme el esquema final y el entorno.

Cada caso incluye carga, resultado esperado y evidencia ejecutable. La ventana de demo es fija: 22–23 de octubre de 2026; no se redatan casos vencidos ni se adelantan salidas. El runner deberá resolver IDs reales y usar Auth/RPC nativos, idempotencia y versiones; las claves descriptivas de este JSON no son IDs existentes.

## Validación de la receta

Desde `cargomesh/`: `node --conditions=react-server --import tsx scripts/check-ordered-flow-cases.ts`.

Las comprobaciones de base de datos están en tests `40`, `41`, `42`, `32` y `26`. Son transacciones controladas que revierten sus fixtures; no constituyen una conversación humana ni un recorrido visual. El caso 06 registra un bloqueo conocido y no acredita soporte de 12 t sobre una vía de 10 t por vehículo.

Los 100 km directos / 200 km con transferencia son geometría sintética de pruebas, no distancia real Lima–Arequipa. El servicio automático sigue siendo FTL directo con un recurso. Dos camiones necesitan un plan nativo explícito y cotización que cubra todos sus recursos. No reutilizar este paquete para afirmar consolidación automática o distribución urbana.
