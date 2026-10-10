# Pantallas y stepper del borrador local — 8 oct 2026

## Distribución
- Panel: próxima acción, vista del camión y gráficos resumidos del borrador.
- Solicitudes: ficha compacta; abre el detalle en la revisión final.
- Solicitud local: Origen → Ruta y camión → Carga → Fechas → Revisión final.
- Revisión: abre la ficha final; los enlaces Editar llevan al paso correspondiente.
- Ruta: mapa, origen/destino y datos viales; no repite toda la carga y las fechas.
- Flota: mantiene listado compacto y ficha completa al abrir un vehículo.
- Ayuda: transferencia del borrador entre navegadores e información sobre fuentes.

## Navegación
Cada paso tiene URL propia (#/request/origin, route, cargo, dates, review). El stepper permite consultar cualquier paso. Consultarlo no equivale a comprobarlo: para avanzar la revisión deben comprobarse los pasos anteriores. Anterior y el historial del navegador conservan los datos. La validación usa el mismo borrador persistido y la copia original importada.

Al editar un campo se invalida únicamente la revisión desde el paso afectado. Guardar revisión local no crea ni registra una solicitud del servicio. El flujo del servicio conserva su formulario, permisos y mapper existentes.

## Accesibilidad y movimiento
Botones de stepper accesibles mediante Tab y Enter, aria-current="step", foco en título al cambiar de paso, error con foco y aviso textual. Transición de 200 ms respetando movimiento reducido. Controles de al menos 44 px y stepper compacto en móvil. Selección, foto propia y modelos 3D se conservan; la vista del camión sigue usando la preferencia del borrador.

## Evidencia
Build de producción local, lint y tipos correctos. Architecture check correcto (335 módulos / 51 entradas cliente). 17 tests pertinentes pasan. Smoke ejecutado con teclado/Enter, error con foco, pasos saltados, selección de camión, cantidad cero, fecha vacía y entrega anterior a recogida, guardado local, Anterior, historial y recarga. Vista móvil 390 × 844 sin desbordamiento horizontal y targets de stepper de 60 × 80 px. Se confirmó Google Maps Platform + Google Routes con datos estimados en el navegador del usuario. Evidencia externa: D:\Documents\hackaton 2\cargomesh-v2-stepper-screens-20261008.

## Alcance
Copia local únicamente. Los datos se guardan en este dispositivo. La geometría y su atribución continúan mostrando la fuente real; una revisión local no certifica cobertura, reserva ni disponibilidad. No se publica, mergea ni despliega.

Capturas: origin-desktop.png, cargo-desktop.png, review-desktop.png, route-truck-desktop.png, cargo-mobile.png y route-mobile-full.png. Resultados: browser-evidence.json, tests.log y build.log. Los campos y la preferencia del navegador de prueba se restauraron después del smoke. La pestaña del usuario se recargó sin modificar su preferencia Refrigerado. Movimiento reducido y gesto táctil físico mantienen los caminos existentes, sin prueba física nueva en esta entrega.
