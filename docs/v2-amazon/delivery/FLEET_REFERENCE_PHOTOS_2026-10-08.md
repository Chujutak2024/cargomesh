# Flota — fotografías reales de referencia

Fecha: 8 octubre 2026. Web actual: `D:\Documents\hackaton 2\cargomesh-v2-current-local`.

Vista local: `http://127.0.0.1:8080/v2-workspace#/fleet`.

## Cambio

Por petición del usuario, Flota utiliza seis fotografías reales en lugar de los renders 3D. Tarjetas y ficha comparten la misma fotografía por vehículo/tipo; la vista de lista conserva su encuadre. El selector de camión del borrador y las otras vistas 3D no forman parte de este cambio.

Las imágenes son **referencias visuales del tipo de camión**. No acreditan la identidad, marca, matrícula, propiedad, estado, ubicación o asignación del activo mostrado. La etiqueta «Foto de referencia» aparece sobre cada fotografía y una nota textual explica su alcance. Los datos EXAMPLE siguen identificados como simulados; los datos SERVICE conservan sus permisos, nulos y procedencia.

Las imágenes se sirven como archivos locales WebP de 1200 px de ancho, con carga diferida en tarjetas y carga inmediata en la ficha. El encuadre CSS no deforma la fotografía. No se introduce una dependencia de imágenes externas en tiempo de ejecución. Los créditos y las licencias están disponibles desde «Créditos de las fotografías» y en `public/v2-workspace/fleet-photos/credits.json`.

## Créditos de las fotografías

Las fotografías reducidas y convertidas a WebP conservan su licencia original. Su visualización se encuadra mediante CSS; no se añaden objetos, no se alteran las marcas ni se transforma el contenido en una ilustración.

| Referencia | Autor | Fuente original | Licencia |
| --- | --- | --- | --- |
| Camión rígido · DAF LF | DeFacto | [DAF LF 2005](https://commons.wikimedia.org/wiki/File:DAF_LF_2005.jpg) | [CC BY-SA 2.5](https://creativecommons.org/licenses/by-sa/2.5/) |
| Tracto con remolque · Volvo | Oto Zapletal | [Volvo en Levoča](https://commons.wikimedia.org/wiki/File:A_VOLVO_truck_tractor_with_a_semi-trailer_on_the_road_in_Levo%C4%8Da,_Slovakia.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| Tracto refrigerado · Scania / Chéreau | Rundvald | [Chéreau semirremolque](https://commons.wikimedia.org/wiki/File:Chereau-semiremorque-byRundvald.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| Camión plataforma · MAN | Secret Coach Park | [MAN en A40, Monmouth](https://commons.wikimedia.org/wiki/File:MAN_flatbed_truck_on_the_A40_in_Monmouth,_Wales.jpg) | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/) |
| Volquete · Scania | Barry Lewis | [Campbell’s artic tipper](https://commons.wikimedia.org/wiki/File:Campbell%27s_artic_tipper_truck,_Teignmouth_Dock,_14_May_2013.jpg) | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) |
| Tracto con semirremolque · Freightliner | Jason Lawrence | [Freightliner Cascadia / McLane](https://commons.wikimedia.org/wiki/File:Freightliner_Cascadia_hauling_a_McLane_trailer.jpg) | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) |

La selección se comprobó visualmente desde las fotografías descargadas; no se usan imágenes generadas ni diagramas como fotografías. Los modelos fotografiados no se copian a los campos del registro del vehículo.

## Archivos y evidencia

Implementación: `fleet-workspace.tsx`, `fleet.module.css`, `fleet-photos.ts` y `public/v2-workspace/fleet-photos/`.

Evidencia y copias previas: `D:\Documents\hackaton 2\cargomesh-v2-fleet-photos-20261008`. Los archivos `candidate-*.jpg` conservan los thumbnails originales y `selected-sources.json` registra la consulta a Wikimedia Commons. Las fotografías locales incluyen un manifiesto de fuentes completo.

No se modifican datos del borrador, filtros, contratos, autenticación, consultas ni telemetría. No se publican cambios en GitHub ni se realiza merge o despliegue.

## Verificación de esta actualización

- Build Next, compilación, lint y validación de tipos: **PASS**, `build.log`. Servidores 8080/8083 reiniciados mediante el launcher local del proyecto actual.
- Escritorio 1280 px: seis fotografías locales distintas cargadas; marcos uniformes de 338 × 211 px; cero canvas en Flota. `fleet-photos-desktop.png`.
- Filtro «Combustible bajo»: un resultado, CM-231; «Todos» restituye seis. Vista de lista conserva fotos y datos. `fleet-photos-list.png`.
- Enter abre CM-204 con `flatbed.webp`; al volver, el foco retorna a «Ver camión CM-204». La ficha muestra la fotografía de referencia y conserva los indicadores y el gráfico. `fleet-photo-detail-desktop.png`.
- Créditos: Enter abre/cierra la sección; seis referencias con autor, fuente y licencia enlazados, doce enlaces en total.
- Móvil 390 × 844: scrollWidth 375, sin overflow de página, seis fotos cargadas en marcos de 319 × 213 px. `fleet-photos-mobile.png`.
- Ficha móvil CM-212 utiliza `articulated-alternate.webp`, marco 311 × 207 px y scrollWidth 375. `fleet-photo-detail-mobile.png`.
- Se restablece el viewport de prueba y se recarga la pestaña local del usuario para mostrar la versión actual.

Esta modificación no altera lógica de negocio. La validación se concentra en compilación y comportamiento visual real; las pruebas de flota anteriores están documentadas en la entrega original.
