# Panel local: recorrido y ficha compacta — 8 octubre 2026

## Alcance

Implementación en `cargomesh/src/features/carrier-portal/local-dashboard.tsx` y su CSS Module, montada por `LocalDraftWorkspace` en el panel del coordinador. URL de revisión: `http://127.0.0.1:8080/v2-workspace#/dashboard`.

- El recorrido horizontal usa la referencia visual facilitada por el usuario: salida, controles de paso, camión, tramo destacado y comparación de llegada con una alternativa.
- Las tarjetas anteriores «Datos del borrador» y «Tu carga en cifras» se sustituyen por una ficha compacta: origen/destino, descripción, unidades y peso unitario, recogida, entrega y camión preferido.
- Se conserva el visual 3D seleccionado, su giro 360°, el formulario por pasos y el acceso al mapa.
- El selector del panel reutiliza `useLocalRequestExamples.select`: las siete solicitudes comparten la selección con ficha, revisión y ruta. No introduce un segundo borrador ni copia de los campos.
- El contexto de selección se integra en la barra del panel para evitar una fila adicional. Las demás pantallas conservan su contexto existente.
- Móvil: recorrido vertical, indicadores en dos columnas y ficha apilada; controles de comparación y navegación de al menos 44 px.

## Datos y procedencia

La ficha muestra los valores guardados de la entrada seleccionada. El borrador original y los seis ejemplos mantienen sus almacenes separados. No se cambian los campos ni el payload original de recuperación. Los campos pendientes se indican como pendientes, sin sustituirlos por datos inventados.

**El recorrido es un esquema de demostración, no geometría cartográfica ni seguimiento operativo.** Las ciudades proceden de la solicitud seleccionada; controles intermedios, posición, variación de velocidad y horarios son ilustrativos. Las horas 09:48, 10:41, 12:55, 15:49 y la alternativa 15:18 (31 minutos) son un fixture visual compartido, no un cálculo desde las fechas, distancia o condiciones de la solicitud. La UI lo identifica como «Simulación de recorrido» y «Posición, tráfico y horarios simulados. Sin seguimiento GPS».

La comparación cambia solamente la presentación; no reserva un camión, modifica una ruta, registra una solicitud ni inicia una asignación. Una pareja de ciudades que no sea `previewable` no muestra posición, horarios ni línea de recorrido de demo; ofrece revisar origen/destino.

El mapa Google existente continúa en la pantalla Ruta con su proveedor y procedencia propios. Este esquema no se presenta como Google Routes ni se utiliza como reemplazo de `routePreview: null`.

## Validación

- TypeScript sin errores; build Next.js y arquitectura correctos.
- 17 pruebas existentes de borrador, flujo y colección local aprobadas: conservación de campos/foto/raw, invalidación de pasos, aislamiento de ejemplos, payloads inválidos, fechas pendientes, cruce marítimo y ausencia de geometría de reemplazo.
- Navegador: selección compartida, datos de la ficha, comparación accesible por teclado, enlaces a fechas/ruta/revisión, escritorio y móvil sin desbordamiento horizontal.
- Capturas y registro de smoke en `D:\Documents\hackaton 2\cargomesh-v2-dashboard-journey-20261008`: `dashboard-desktop.png`, `dashboard-mobile.png`, `browser-smoke.json` y `build.log`.

Trabajo local de demo. No modifica contratos/API, no publica, no mergea ni despliega.
