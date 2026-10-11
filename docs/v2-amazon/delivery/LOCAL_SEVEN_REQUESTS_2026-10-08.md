# Siete solicitudes locales — 8 oct 2026

## Alcance solicitado
La vista local muestra siete solicitudes: el borrador existente (`CM-LOCAL-01`) y seis ejemplos (`CM-DEMO-02` a `CM-DEMO-07`). Los ejemplos tienen cargas, camiones preferidos, fechas, rutas y avances distintos. Las rutas pertenecen a redes terrestres conectadas; no se añade geometría inventada ni se afirma disponibilidad comercial.

## UI y navegación
- Directorio con tarjetas compactas, búsqueda por código/ciudad/carga y filtro de revisión.
- Indicadores calculados sobre la colección: cantidad, suma de peso y solicitudes revisadas localmente.
- Abrir solicitud lleva a su ficha con visual 3D y avance; el detalle completo y la edición reutilizan el wizard de cinco pantallas.
- Ver ruta utiliza la solicitud seleccionada con Google Maps / Google Routes cuando el proveedor entrega una estimación. Los ejemplos no tienen una ruta sintética de respaldo.
- Panel, ficha, wizard y Ruta comparten la selección. Un contexto visible distingue Tu borrador / Ejemplo con datos simulados. La ficha tiene enlace para volver a la lista.

## Persistencia e integración
El borrador original conserva sus claves y payload de recuperación. Los seis ejemplos se almacenan aparte en `cargomesh-v2-local-request-examples-v1`, y la selección en `cargomesh-v2-active-local-request-v1`. Las ediciones de un ejemplo no llaman al guardado del original. Las claves solo se habilitan en la URL local autorizada. La API nativa y la pestaña Solicitudes del servicio conservan su flujo y no reciben fixtures.

Los seis ejemplos son escenarios de demostración, incluidos sus avances iniciales. No son solicitudes comerciales registradas, asignaciones, cotizaciones ni despachos. La selección también se restaura al abrir una URL de ficha válida.

## Verificación ejecutada
- Tipos y build de producción correctos.
- Arquitectura: 338 módulos, 53 entradas cliente.
- 17 pruebas: modelos locales, avance por pasos y colección de ejemplos. Cubren edición aislada, round trip, protección del original, colecciones inválidas y ausencia de trazas inventadas.
- Smoke en escritorio: siete tarjetas, siete imágenes cargadas, total inicial de 74.600 kg para este borrador, filtro Madrid y Revisado localmente → CM-DEMO-05.
- Abrir CM-DEMO-02 mediante Enter → ficha Lima/Arequipa, 18 unidades, 10.800 kg, avance 2/5. Continuar → Carga. Editar unidades a 19, recargar y confirmar persistencia; restaurar a 18.
- Ver ruta de CM-DEMO-02 → Lima/Arequipa; nota real Google Maps Platform / Google Routes / Datos estimados.
- Volver al original → Callao/Piura, Maquinaria industrial, 8.000 kg, fecha y avance 1/5 conservados. El navegador del usuario conserva Refrigerado; el navegador de pruebas conserva Mi camión.
- Móvil 390 × 844: siete tarjetas, sin desplazamiento horizontal y acciones de tarjeta de 44 px como mínimo. Se restauró el tamaño normal del navegador.

Evidencia externa: `D:\Documents\hackaton 2\cargomesh-v2-seven-requests-20261008` — capturas de escritorio/móvil, browser-smoke.json y build.log. El local se recompiló, se inició y se recargó en el navegador del usuario. Trabajo local solicitado.
