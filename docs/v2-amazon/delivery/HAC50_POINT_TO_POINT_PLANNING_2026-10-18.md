> Actualización posterior del 18-oct: Geocoding ya fue importado y se validó localmente el flujo por direcciones con Google real. Véase [validación live](HAC50_GEOCODING_LIVE_VALIDATION_2026-10-18.md). El flujo de pines ambiguos continúa pendiente.

# HAC-50 — planificación entre puntos reales, 18-oct-2026

## Estado y alcance

Implementado localmente sobre `codex/unified-workspaces-demo-boundary`, HEAD observado `0e6986c057c9bcec75be792e9b56f193268e182b`. Se conserva `/carriers/control-tower`, la navegación y la composición existente. Sin commit, push, merge, despliegue, migración ni escrituras de negocio. Los cambios concurrentes permanecen conservados; los 16 archivos del incremento tienen respaldo inicial y manifiestos de hashes bajo esta carpeta.

**No se certifica todavía una ruta live entre direcciones:** falta `GOOGLE_GEOCODING_API_KEY` y la única sede visible de la cuenta de prueba no tiene coordenadas. El usuario confirmó que ese acceso falta y solicitó el prompt para Juan.

## Implementado

- Modo por puntos añadido al planificador existente; el modo anterior de ciudades sigue disponible.
- Extremos mediante sede activa del Carrier con versión y coordenadas, dirección completa o coordenadas decimales con etiqueta. Confirmación por extremo, invalidada al editarlo. No se permite aportar país/ciudad como evidencia libre para un pin.
- Endpoint privado aditivo `POST /api/v2/carrier-portal/carriers/:carrierId/road-point-assessments`: autenticación, origen de sesión, feature gate y cuerpo JSON hasta 4 KiB, mismo criterio de seguridad que el endpoint anterior. Lectura/planificación, no mutación comercial.
- Sedes resueltas desde el catálogo autorizado y releídas para detectar cambios. No son ubicaciones actuales de un vehículo ni otorgan cobertura automáticamente. No se consulta el API privado de pedidos del Cliente.
- Direcciones/pines se resuelven en el servidor mediante Geocoding. Resultado de dirección único, no parcial, de propiedad y precisión `ROOFTOP` o `RANGE_INTERPOLATED`; resultados amplios o ambiguos se rechazan. Para un pin se exige una dirección precisa a <=100 m y se conserva el pin original. Son umbrales de esta política de planificación, no garantías de Google.
- Metadatos de país, localidad, región y postal provienen del proveedor o del registro de sede. Sin localidad, una cobertura CITY permanece desconocida. No hay equivalencias geográficas inventadas ni búsqueda aproximada de nombres.
- Cobertura por servicio, sentido, exclusiones, vigencia y evidencia antes de **Google Routes**. Geocoding es una consulta separada que puede ser necesaria antes de conocer la cobertura y también puede tener coste. Servicio inactivo, versión obsoleta y catálogo incompleto detienen incluso esa consulta.
- POLYGON admite interior, exterior, bordes y huecos; una exclusión evidenciada prevalece. Polígonos degenerados, auto-intersectados, anillos cruzados, antimeridiano y geometrías con >256 coordenadas totales quedan desconocidos. POINTS permanece desconocido: el catálogo no publica radio de atención. El modo antiguo sin coordenadas conserva su comportamiento conservador.
- Dos puntos distintos de la misma ciudad pueden calcular una ruta cuando exista cobertura y lane dirigida compatibles. Dos extremos a menos de 1 m devuelven `SAME_STOP` sin cálculo.
- Google recibe el Place ID de una dirección resuelta o las coordenadas exactas del pin/sede. Conserva la geometría ordenada devuelta; no interpola ni añade segmentos. Rechaza extremos del recorrido a más de 200 m de los puntos solicitados. El pin, la aproximación vial y el acceso de carga son conceptos distintos; acceso de camiones sigue `UNVERIFIED`.
- La UI muestra procedencia, precisión, dirección y coordenadas resueltas. Pines A/B identifican los extremos solicitados, separados de los vehículos. Elegir otra alternativa conserva la evidencia de los extremos.
- Correlación por SHA-256 del input validado, Carrier, servicio/versión, ventanas, objetivo, tráfico y referencias de sede. Se descarta una respuesta obsoleta o fuera de scope. La cobertura y sedes se revalidan tras resolver ubicaciones y después del proveedor.
- Geocoding tiene presupuesto local de 30 llamadas globales/10 por Carrier por minuto, timeout 10 s y errores saneados. Routes conserva su presupuesto existente compartido; no hay retry automático pagado ni filtración de respuesta de proveedor o secretos.

## Verificaciones

- **115 pruebas aprobadas**, 0 fallidas. `tests.tap` conserva la salida reproducible. Incluye el nuevo contrato de puntos, Geocoding y polígonos; regresiones de ciudades, proveedor, Tower y evaluación operativa.
- TypeScript `--noEmit --incremental false`: aprobado.
- Arquitectura: aprobada, 551 módulos/166 entradas cliente.
- API local real con cuenta de prueba existente: opciones habilitadas; Geocoding no configurado; 1 sede, 0 activas con coordenadas; dirección devuelve `503 GEOCODING_NOT_CONFIGURED`; sede sin posición devuelve `422 LOCATION_COORDINATES_REQUIRED`; anónimo `401`; página `200`. Cero escrituras comerciales y cero consultas Google Routes en ese smoke. Sesión temporal del script revocada de forma local, sin cerrar la del navegador. Ver `NATIVE_RESULTS.json`.
- Navegador real autenticado: apertura del planificador, modos de puntos y ciudades, cambio entre dirección/coordenadas, bloqueo sin ambas confirmaciones, aviso real de configuración pendiente, liberación de controles tras el error y reconfirmación tras editar un punto.
- Escritorio 1280×720 y móvil 390×844. En móvil `document.scrollWidth=390`, ambos paneles de ubicación de 286 px, apilados y dentro del viewport. Capturas `points-fields-desktop.png`, `points-mobile.png`. Los ejemplos públicos usados para probar el formulario no se guardan como pedidos.
- No se ha comprobado visualmente la polilínea A/B live del nuevo modo, por el faltante de configuración/datos. Los positivos con stubs de dos puntos son pruebas sintéticas del contrato, nunca rutas de producción. No se ejecutó build de producción sobre el `.next` compartido.

## Pendientes explícitos

1. Juan entrega acceso de servidor a Geocoding; reinicio y smoke live desde la red autorizada. Prompt: `PROMPT_JUAN_GEOCODING.md`.
2. Si se desea probar por sedes, registrar coordenadas reales de sus accesos mediante el flujo de gestión autorizado. No se generaron posiciones ni se sembraron registros para forzar un positivo.
3. Autocomplete/arrastre de pin son siguientes mejoras de UX. Este corte admite dirección enviada y coordenadas decimales, no ofrece todavía esas interacciones.
4. Enlazar la ubicación autorizada/versionada del pedido de Cliente a la evaluación y persistir la asociación pedido → recorrido: coordinación con la proyección C6. La pantalla actual sigue siendo planificación del operador.
5. La evaluación conjunta de vehículo/conductor para estos extremos precisos, acceso legal del camión y GPS siguen su siguiente incremento. El endpoint operativo existente de ciudades permanece compatible.
6. Normalización de identificadores administrativos internacionales y geometrías complejas necesitan un adaptador espacial/catálogo acordado. No se resuelven por etiquetas parecidas.

Las consultas abortadas en el frontend invalidan la respuesta para esa pantalla; no se garantiza cancelar una solicitud pagada ya recibida por el proveedor. Los presupuestos son por proceso, no cuotas distribuidas de producción.

## Referencias verificadas

- Google Routes, ubicaciones y ajuste a la carretera: https://developers.google.com/maps/documentation/routes/specify_location
- Geocoding, precisión, ambigüedad y componentes: https://developers.google.com/maps/documentation/geocoding/guides-v3/requests-geocoding

## Fricción material

`GOOGLE_GEOCODING_API_KEY` no existe en la configuración revisada y la sede de la cuenta autorizada no tiene coordenadas. Se implementaron errores visibles y verificables; no se amplió ninguna restricción de claves, no se usó una clave de navegador en el servidor y no se inventó una ubicación. La activación depende del paquete privado de Juan.
