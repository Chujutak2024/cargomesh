# Entorno del visor de camiones — 9 oct 2026

## Entrega local

- Visor principal de `LogisticsTruck`: carretera 3D, señalización, arcenes, relieve, árboles, barrera, farolas y cielo. Los tipos del catálogo y los GLB propios usan la misma escena.
- Ambiente siempre automático: lee la hora local del dispositivo cada 30 segundos y al recuperar foco/visibilidad. Se eliminaron los selectores de día, tarde y noche. La etiqueta muestra `Hora de tu equipo · HH:mm`.
- Día: 06:00–15:59; tarde: 16:00–18:59; noche: 19:00–05:59. La iluminación se mezcla gradualmente al amanecer (05:00–07:00) y al anochecer (16:00–20:00).
- Cielo con nubes procedurales en capas, sol con halo, luna sombreada y estrellas. Las transiciones conservan la cámara y el modelo. La posición de los astros compone el visor; no es una efeméride astronómica.
- Carretera con textura de asfalto y filtrado para evitar aliasing, marcas, árboles, postes y farolas en movimiento. Las ruedas del catálogo giran y la suspensión tiene una vibración leve. El avance empieza automáticamente y puede pausarse o reanudarse sin saltar el recorrido acumulado.
- Los thumbnails conservan su composición limpia. Las fotos sin un GLB continúan siendo fotos.
- Luces de farolas y mayor emisión de las luces del catálogo por la noche; no se cambian los materiales del GLB subido.
- Animación limitada a 30 fps mediante invalidación del render bajo demanda. Se detiene al pausar, salir del viewport, esconder la pestaña o activar la preferencia de movimiento reducido. DPR limitado a 1.5 (1.25 en thumbnails), controles 360° con teclado y botones móviles de 44px.
- Se corrigió el hueco entre chasis de cabina y carrocería en los cinco tipos. Rígido y volquete tienen largueros continuos y la carrocería más cerca de la cabina; los tipos articulados muestran bastidor, quinta rueda y conexiones. Se regeneraron el GLB y los cinco PNG de respaldo desde la geometría real.

## Datos y alcance

El entorno es visual. No representa ubicación, meteorología, movimiento GPS, asignación ni disponibilidad del vehículo. No modifica los siete registros, las fotos ni las referencias a GLB persistidas. Usa siempre la hora del dispositivo, incluida la recarga. No se despliega ni publica esta entrega.

## Validación

- Once pruebas pertinentes aprobadas: reloj y transiciones durante los 1.440 minutos del día, continuidad del chasis en los cinco tipos, geometría finita y presupuesto, disposición de recursos, GLB y repetición de elementos de carretera.
- TypeScript y arquitectura aprobados: 355 módulos, 58 entradas cliente. Cada modelo conserva nueve meshes y menos de 50.000 triángulos. GLB exportado: 1.813.268 bytes, 36.628 triángulos; la animación del visor no forma parte de este GLB estático.
- Navegador: avance real de `roadDistance`, giro por ArrowRight, pausa que mantiene distancia y frames estables, y preferencia de movimiento reducido que detiene el avance. Una escena de revisión separada comprobó día/tarde/noche sin cambiar la hora del equipo ni añadir controles manuales a la aplicación.
- Reloj visible `12:23`, cotejado con PowerShell `Get-Date` a las 12:23:09 del 9 oct 2026. La iluminación del producto sigue siendo automática.
- Móvil 390×844: sin desbordamiento horizontal (scrollWidth 375), controles de 44px. El tamaño temporal se restauró.
- Pestaña del usuario conserva CM-LOCAL-01 y siete solicitudes. Pestaña IAB de validación conserva CM-DEMO-06. No se editaron solicitudes, fotos ni preferencias durante estas comprobaciones.
- Consolas de la página principal y escena de revisión: sin errores. Capturas `automatic-drive-day.png`, `automatic-drive-afternoon.png`, `automatic-drive-night.png`, `automatic-drive-dashboard.png`, `automatic-drive-mobile.png`, `automatic-drive-user-page.png`; comprobaciones en `automatic-drive-checks.json` y pruebas en `tests-automatic-drive.log`.
- Compilación de producción local y evidencia de acabado final: `build-automatic-drive-final.log`.

Evidencia local: `D:/Documents/hackaton 2/cargomesh-v2-road-environment-20261009/`.

## Comentario para el líder

Se dejó el entorno del visor siempre sincronizado con la hora del equipo. Se añadieron nubes, sol, luna y estrellas, movimiento de carretera y ruedas, vibración leve y un control de pausa. Se corrigieron las uniones del chasis de los cinco camiones y se regeneraron sus recursos visuales. Se comprobó teclado, móvil, conservación de las siete solicitudes y render sin errores; la implementación queda disponible en local para revisión.
