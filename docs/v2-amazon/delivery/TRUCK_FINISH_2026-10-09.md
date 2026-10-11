# Acabados del catálogo de camiones 3D — 9 de octubre de 2026

## Entrega local

Cambios en el generador original de las diez carrocerías de `cargomesh/src/features/logistics-3d/truck-model.ts` y en las luces del visor `truck-scene.tsx`.

- Sustituida la cabina maciza por paredes con huecos reales para las ventanas. El parabrisas anterior estaba cubierto por la carrocería.
- Parabrisas y ventanas laterales de vidrio azul humo, transparentes y reflectantes, con juntas y marcos simétricos. Vidrio sin sombras opacas ni pase adicional de transmisión.
- Interior visible: asientos, reposacabezas, paneles de puerta, tablero, volante y columna de dirección.
- Espejos unidos mediante brazos y superficies metálicas orientadas hacia atrás; manijas, uniones de puertas, escotilla y limpiaparabrisas sobre el plano del cristal.
- Guardabarros, faldillas, escalones detrás del eje delantero, tapones de combustible, alojamientos de faros, luces auxiliares, luces ámbar y pilotos traseros. Las luces del catálogo ajustan su emisión al ambiente nocturno.
- Puertas de furgones con bisagras, juntas y cierres; sin herrajes flotando sobre carrocerías abiertas. Paredes del volquete colocadas simétricamente, con bisagras y cierres.
- Cisterna con apoyos, escalera completa y tuberías; mezclador con remates del tambor, escalera y apoyos; plataforma con líneas del piso y anclajes; cama baja con bisagras y anclajes; maderero con extremos de madera, anillos y sujeciones.
- Diez PNG de 840 × 540 regenerados desde los modelos y GLB original actualizado. El GLB es estático; la animación del catálogo sigue ejecutándose en el visor mediante el uniforme de las ruedas.

## Verificación

- 11 pruebas aprobadas: geometría, recursos GPU, catálogo distinto por carrocería, continuidad del chasis, ventanas abiertas y simétricas, importación GLB, compatibilidad de preferencias y ambiente según reloj local.
- Nueva prueba mediante rayos en ambos laterales y frente: el cristal no está oculto por pintura y deja ver el interior. Cristales y tapicería no participan en la rotación de las ruedas.
- TypeScript aprobado; arquitectura aprobada: 365 módulos y 65 entradas cliente.
- Compilación Next.js de producción aprobada y servidores de esta aplicación reiniciados en 8080/8083. `/v2-workspace`: 174 kB, primera carga 406 kB; visor cargado de forma dinámica.
- Catálogo con 11 mallas/materiales por modelo y menos de 50 000 triángulos. Mayor modelo: tracto articulado, 45 706 triángulos.
- GLB exportado: 2 275 376 bytes, 45 706 triángulos, 49 592 vértices, sin texturas externas. Carga, normalización y liberación de recursos verificadas.
- Diez PNG completos verificados mediante cabecera, dimensiones, fin de archivo y descompresión de los bloques de imagen.
- Inspección visual del catálogo desde frente, ambos laterales, perspectiva y parte trasera.
- Verificación en Opera, página del usuario: siete solicitudes, SOL-0001 y Mezclador conservados; Callao → Piura, 10 × 800 kg y fechas anteriores. El visor declara `cab-finished`, cambia la cámara con el giro manual y conserva giro automático, avance y pausa. Ambiente día/tarde/noche comprobado; recarga final restablece modo automático según reloj y avance activo.

## Evidencia

Carpeta `D:\Documents\hackaton 2\cargomesh-v2-truck-finish-20261009`:

- `before-perspective.png`, `after-perspective.png`, `after-front.png`, `after-left.png`, `after-rear.png`.
- `posters.json`: dimensiones y tamaño de las diez miniaturas completas.
- `build.log`: compilación de producción.
- `dashboard-day.png`, `dashboard-night.png`, `browser-checks.json`: evidencia de la aplicación activa, controles y datos conservados.

El catálogo de revisión usa un origen local separado, sin datos de solicitudes ni almacenamiento de la aplicación.

## Alcance

Se conservan las fotos y GLB subidos por el usuario, sus materiales y geometría, la selección de camión, las solicitudes y sus fechas. Los acabados corresponden al catálogo original; no reconstruyen ni retocan automáticamente modelos importados. Sin nuevas dependencias, publicaciones o cambios en servicios remotos.
