# Cierre base y casos ordenados Cliente–Carrier

## Publicado

PR137 fusionado en main `e6fbf279f285ffaf1d5afe5393c69e72671ee2a3`. Gate39535869604 SUCCESS3/3. Production Vercel `dpl_DCv5rgefbNV4ypzGZvh8cpQLFy6t` READY y alias asignado al mismo SHA. Entrada Cliente nativa200, tres sedes, pedido existente DRAFTv1, dos servicios evaluados y uno elegible. Historial propio vacío y grant de voz Nova200; no se inventó precio histórico ni se creó una reserva alojada para comprobarlo. No es evidencia de micrófono humano o venta completa en producción.

Cliente confirma el pedido y busca ofertas; autoriza la selección; la aplicación crea PLANNED y retenciones HELD idempotentes de los recursos cotizados. Carrier confirma capacidad y booking, y asigna vehículo/conductor antes de salir dentro de la ventana válida. Confirmar una reserva no inicia por sí solo el viaje.

## Validación posterior, en orden

| Etapa | Evidencia | Resultado real |
|---|---|---|
| 1. FTL básico | test40, CI y lecturas alojadas | 40 aserciones SQL controladas; publicación disponible |
| 2. Varias reservas | test41 nuevo | 23 aserciones: dos ofertas complementarias, dos bookings del mismo pedido, idempotencia y dos holds de tramos adyacentes |
| 3. Varios camiones | test42 nuevo | 14 aserciones: dos bultos de4t en vehículos de5t; vigencia y capacidad independientes; fracciones de bulto rechazadas; bloqueo agregado de ruta identificado |
| 4. Rutas y restricciones | tests32/26 existentes | 71+17 aserciones: ruta dirigida, fuentes/versiones, límites físicos y evidencia desconocida/vencida |
| 5. Seeds por caso | v2-client-carrier-flow-cases | nueve recetas tipadas LOCAL_ONLY, sin activación comercial |

Las 125 aserciones de las etapas2–4 se ejecutaron en una base local nueva con esquema/ACLs originales y escenario LOCAL_ONLY. Cada archivo revierte su transacción; la base temporal se eliminó. No se resetearon bases compartidas ni se migró el alojado en esta validación.

## Límites encontrados

- El adaptador de cotización automática implementado sigue limitado a FTL directo de un recurso. Los planes nativos explícitos permiten varios portadores; no hay generación automática de reparto de carga por Nova.
- El ruteador rechaza un pedido total de12t ante un corredor limitado a10t, incluso si el plan potencial pudiera distribuir6t en cada vehículo. Se conserva como KNOWN_LIMITATION, nunca como seed operativa. Ver friction log asociado.
- Una solicitud con dos ofertas complementarias no equivale a autorizar dos alternativas competidoras para transportar la misma carga.
- Una reserva comercial puede involucrar varios holds, y un booking tiene una ejecución por servicio: no hay equivalencia uno-a-uno entre camión, booking y pedido.
- Las rutas de fixtures son SIMULATED, 100km directo/200km con transferencia. No representan distancias reales Lima–Arequipa ni acceso vial confirmado; Maps aún depende del administrador de la clave.
- Captura de categorías/temperaturas por línea y reparto urbano siguen fuera de este cierre.

## Activación de casos

La receta conserva carga, ventanas22–23oct, asignaciones, ruta y resultado esperado por caso. No es un activador alojado. Antes de crear datos de demostración persistentes se confirmará el esquema de seeds anunciado por el usuario, se resolverán IDs existentes y se usarán actores reales, recibos idempotentes y versiones. No crear automáticamente casos en tránsito antes de la ventana, ni volver a aplicar el paquete de cinco migraciones y tarifaUSD500 ya activo.
