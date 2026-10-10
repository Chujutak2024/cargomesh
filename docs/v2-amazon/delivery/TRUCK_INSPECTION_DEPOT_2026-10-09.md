# Resumen del camión, mapa ampliado y llegada a sede 3D

## Alcance local

Solicitud: pulsar un camión para abrir su resumen, con dos acciones: mapa grande y una sede 3D con animación de llegada. Referencia visual: [publicación proporcionada por el usuario](https://x.com/Jomolos/status/2107063284230701075?s=20), consultada en el navegador. Se tomó la organización isométrica de patio, almacén y muelles; la geometría de CargoMesh es original.

Aplicación activa: `D:\Documents\hackaton 2\cargomesh-v2-current-local\cargomesh`, página `http://127.0.0.1:8080/v2-workspace#/dashboard`.

## Interacción y datos

- El clic sobre el modelo 3D abre el resumen; arrastrar conserva el giro 360°. También se puede abrir con el botón Resumen o con Enter/Espacio sobre el visor.
- En Flota, la tarjeta abre el resumen de esa unidad. La ficha completa con gráficos sigue accesible desde el resumen.
- Solicitudes utiliza la preferencia o unidad programada de la solicitud seleccionada. El diálogo no cambia la preferencia, la carga, fechas, pasos, asignaciones, fotos ni archivos GLB guardados.
- Resumen, ruta y llegada son tres vistas del mismo diálogo nativo. Atrás vuelve al resumen; Escape, cerrar o pulsar fuera cierran y restauran el foco. El resto de la página permanece inerte y el visor anterior se suspende mientras el diálogo está abierto.
- El mapa conserva el adaptador Google Maps/Google Routes existente y su procedencia. Los puntos de ciudad por sí solos no crean líneas, distancias ni posiciones de GPS.
- La sede de destino solo se vincula a un carrier cuando existe cobertura explícita de la lane dirigida. Si faltan cobertura o sede coincidente, se muestra un centro de llegada genérico. La visualización no reserva capacidad ni concede elegibilidad. Registros SERVICE no se enlazan a carriers de fixtures por IDs supuestos.

## Sede 3D

React Three Fiber y Three.js ya presentes en el proyecto, carga diferida en el navegador. Patio isométrico con almacén, tres muelles, oficina acristalada, entrada con barrera, señalización, árboles, luminarias, contenedor, palés, montacargas, paneles solares y estanterías interiores.

La llegada dura 22 segundos: aproximación, parada en acceso, entrada, maniobra en reversa y estacionamiento en Muelle 02. La cabina mantiene su orientación durante la reversa; las ruedas invierten su giro. Se puede pausar/reanudar, repetir, retirar el techo para ver el interior y centrar la cámara. El ambiente inicial sigue el reloj del equipo; el icono permite una vista previa de día/tarde/noche.

Se utiliza el mismo tipo de camión del resumen. Los GLB personalizados se leen del almacenamiento existente; una foto sin GLB no se presenta como reconstrucción 3D. La escena tiene un estado de error si el archivo o WebGL no está disponible.

Renderizado por demanda a un máximo solicitado de 30 FPS durante la llegada; deja de pedir cuadros al terminar o cuando la pestaña está oculta. Geometrías combinadas por material, sombras de 1024 px y recursos liberados al cerrar. Con movimiento reducido se muestra el camión ya estacionado y no se reproduce automáticamente.

## Referencias de ciudad

Se añadieron Trujillo, Chiclayo, Cusco, Ica, Huancayo, Pucallpa, Huánuco y Lurín para resolver los destinos ya usados por Flota. Son centros de ciudad, no coordenadas de sedes ni GPS.

Fuentes: [SimpleMaps, datos de ciudades de Perú](https://simplemaps.com/static/data/country-cities/pe/pe.json), [GeoNames, Lurín](https://www.geonames.org/3935720/lurin.html). La procedencia queda indicada también junto a los puntos del catálogo.

## Verificación

- 21 pruebas finales: contexto seleccionado/conservación de datos, cobertura dirigida, aislamiento de SERVICE, los 12 recorridos de Flota, trayectoria continua/parada/reversa/muelle, geometría y liberación de recursos, y contrato de ruta local. Todas aprobadas.
- Arquitectura: 369 módulos y 67 entradas cliente, aprobada.
- Navegador de escritorio: clic real sobre el modelo, giro sin apertura accidental, resumen correcto del Mezclador de SOL-0001, ruta Callao–Piura de 985.9 km/15.53 h, pausa y vista interior, cierre con Escape, resumen de CM-231 y acceso a su ficha completa.
- Pantalla de 412 × 915: resumen, mapa y sede caben sin desbordamiento horizontal del diálogo; controles y cierre accesibles. La tira de etapas se desplaza horizontalmente por diseño.
- Compilación final Next 15.5.24 aprobada (compilación, lint, tipos, páginas y trazas). Servidores locales 8080/8083 reiniciados sobre ese build.
- Llegada final verificada en navegador: `variant=mixer`, `phase=docked`, progreso `1.000`, posición del muelle `(3.000, 3.700)`; 68 draw calls. Repetir devuelve a Aproximación y pausar conserva el estado. Vista interior y día/noche operativas.
- Ruta propia de CM-077 verificada: Trujillo–Piura, 426.7 km/7.09 h de Google Routes. Apertura con Enter verificada. Panel termina con SOL-0001, sus 7 solicitudes y el Mezclador intactos; resumen abierto para el usuario y viewport normal restaurado.

Evidencia local: `D:\Documents\hackaton 2\cargomesh-v2-truck-inspection-20261009\` (`truck-summary-final.png`, `route-expanded.png`, `fleet-summary.png`, `fleet-route-expanded.png`, `summary-mobile.png`, `depot-mobile.png`, `depot-arrival.png`, `depot-interior-final.png`, `final-build.log`).

Fricción resuelta: [recompilación y chunks de Next](friction-logs/TRUCK_INSPECTION_BUILD_2026-10-09.md).

## Límites

Esta entrega local no modifica Supabase, Linear, ramas, PR ni despliegues. La animación es una presentación del destino previsto y no telemetría ni una confirmación de recepción. Los planos y medidas de la sede son visuales, sin levantamiento físico de la instalación.
