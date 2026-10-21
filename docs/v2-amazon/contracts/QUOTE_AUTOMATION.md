# Cotización Cliente–Carrier

Alcance aceptado por Cristhian el 20 de octubre de 2026. Extiende el workflow nativo V2; no cambia V1 ni autoriza desplegar a producción por documentarlo.

## Secuencia

1. El Cliente revisa el pedido preparado con Nova o por escrito. Confirma explícitamente su presentación y el plazo para recibir ofertas.
2. Se evalúa el universo ROAD soportado: cobertura y lane dirigida, compatibilidad de carga/equipo y calendario completo. Datos desconocidos no confirman elegibilidad.
3. El adaptador automático inicial admite FTL directo de un tramo, un recurso portador y un corredor publicado inequívoco con límites del recurso/servicio asociados. El plan nativo vuelve a comprobar capacidad efectiva, reservas, mantenimiento, reposicionamiento, límites y requisitos. Otros planes conservan su flujo nativo/manual; no se inventa un reparto de carga entre camiones.
4. Se crea una oportunidad atribuida al Carrier. Si tiene una política vigente aprobada por un ADMIN verificado, con permisos de catálogo vigentes, el adaptador emite una oferta con desglose, moneda USD, vigencia y evidencia. En otro caso espera la oferta manual del Carrier.
5. El ranking conserva todas las alternativas conocidas. La comparación presenta hasta tres; no se limita el discovery a tres proveedores. Se usa una ScoringPolicy LOWEST_COST publicada, elegida determinísticamente por ID si existen varias. Sin esa política no se inventa un ranking.
6. El Cliente selecciona y autoriza mediante los comandos nativos auditados. La cotización por sí sola no crea booking ni reserva capacidad.
7. El Carrier confirma compromisos y booking. Confirmado significa programado; la salida registrada activa En curso/En camino.

## Política del Carrier

Scope exacto Carrier + servicio + lane, control de versión esperada y recibo idempotente SHA-256. Se configuran base por viaje o base + USD/km, mínimo de transporte, combustible, peajes, manipulación e impuestos; todos con precisión de centavos. USD/km requiere distancia de un corredor persistido. No se calcula un precio a partir de una ciudad o un historial sin fuente.

La política incluye vencimiento, vigencia de cada oferta, minutos de confirmación, términos, procedencia VERIFIED/SIMULATED y consentimiento explícito para emisión automática. El snapshot y versión aprobados quedan ligados a cada oferta. El Cliente no suplanta al emisor: la delegación privada está limitada a una transacción, una política y un ID de oferta. No se modifican JWT ni se concede un rol Carrier al Cliente.

## Historial de Nova

Solo solicitudes de la organización autenticada. Hasta cinco casos anteriores con ruta dirigida y países iguales, categoría, requisitos y equipo iguales y peso/volumen entre la mitad y el doble. Se devuelven precios de ofertas realmente persistidas, con fecha y estado. Son referencias históricas, no una oferta actual, capacidad reservada ni predicción estadística. Sin casos con precio no se estima uno. La voz utiliza el contexto autorizado del pedido; el canal escrito determinista no se presenta como una nueva integración Bedrock.

## Confirmación y prórroga

Las ofertas automáticas generan un plazo de confirmación al autorizar el booking: el menor entre los minutos aprobados y el vencimiento de la oferta. Se rechaza confirmar después del plazo y las retenciones temporales quedan acotadas a él.

El Carrier puede proponer una sola prórroga, dentro de la vigencia original. Proponerla no cambia el plazo. Solo un Cliente autorizado puede aprobarla; se conserva motivo, actor, versión y fecha. No revive capacidad ya vencida: se debe revalidar y volver a retener recursos.

El vencimiento se muestra y bloquea confirmaciones tardías. La acción explícita «Cerrar por vencimiento y liberar recursos» usa la cancelación nativa, sin cambiar silenciosamente de Carrier. Este corte no instala un proceso periódico de cancelación automática: los compromisos ya confirmados se liberan al cerrar la autorización vencida.

## Activación

Migración aditiva `20261020234155_hac50_quote_automation.sql`, dependencia `20261019202113`. No contiene organizaciones, usuarios, tarifas ni escenarios sintéticos. Los RPC requieren sesión nativa y scope real. El paquete alojado debe revisar su ledger, dependencias y datos de capacidad antes de activarse; un merge no aplica migraciones ni tarifas.

La entrega debe distinguir comprobación SQL aislada, lecturas alojadas y una prueba comercial real. No declarar el flujo publicado u operativo en Vercel sin su migración, política aprobada, datos actuales y evidencia del recorrido.

La evaluación previa ROAD puede comprobar un requisito de manipulación declarado por una definición de la misma categoría, con evidencia vigente del recurso y definición activa. No convierte un certificado de otra categoría/recurso en cumplimiento. La evaluación nativa del plan revalida también vencimiento y evidencia de la definición antes de emitir la oferta. Temperatura sin rango sigue desconocida. Se conservan los permisos de columnas del catálogo; no se exponen referencias privadas para esta comprobación.

## Preparación posterior al consentimiento

Autorizar una reserva en Cliente solicita una operación PLANNED por servicio y una retención HELD por recurso cotizado, mediante los comandos nativos existentes. `POST /bookings/:id/preparations` requiere miembro autorizado, versión esperada, origen de sesión e intención explícita. Copia la evidencia de capacidad del plan; no la reemplaza por el consentimiento del Cliente. El vencimiento se limita por oferta, plazo de confirmación y ventana del recurso.

La composición es recuperable: relee hijos existentes, reutiliza referencias y cada escritura mantiene su recibo SHA-256 nativo. La unicidad de ejecución y la exclusión de capacidad resuelven carreras; una colisión solo se recupera si la relectura demuestra el mismo hijo esperado. Un fallo parcial no elimina reservas ni autoriza confirmaciones: la pantalla conserva el booking y ofrece recuperar la preparación. Retenciones vencidas o canceladas exigen revalidación, no renovación silenciosa.

Carrier confirma cada retención y el booking; después asigna vehículo/conductor mediante Fleet. La UI identifica compromisos SIMULATED como simulados y admite la transición que ya valida el backend; no los etiqueta VERIFIED. La salida exige ventana actual y recursos/tripulación confirmados. Reservas, ejecución y solicitud conservan estados independientes; el seguimiento deriva el avance de los hechos operativos.


## Extensión de agenda y prioridad

[DISPATCH_DELEGATION.md](./DISPATCH_DELEGATION.md) define las preferencias opcionales de fechas, la propuesta de horario, la delegación independiente de confirmación y el ranking explícito por llegada. Mantiene atribución Carrier, autorización Cliente e idempotencia nativa.


## Cost-based quotation

[COST_PLUS operating costs](./CARRIER_OPERATING_COSTS.md) adds consumption, driver time, rest locations/durations, vehicle wear, shared/per-resource charges, markup and tax. This is a local additive implementation pending rollout and joint synthetic parameter approval; existing fixed tariffs are not converted automatically.


### Cost-aware direct FTL dispatch

Optional truck profiles and resource overrides, exact endpoint correlation, bounded subset search and private native comparison are specified in [CARRIER_OPERATING_COSTS.md](CARRIER_OPERATING_COSTS.md). `preview_v2_dispatch_costs` is read-only and organization scoped; it cannot issue an offer or reserve capacity. The final native quote persists the selected individual cost snapshot. This extension is locally prepared and does not activate existing Carrier policies.
