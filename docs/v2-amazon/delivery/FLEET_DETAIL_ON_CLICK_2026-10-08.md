# Flota — tarjetas compactas y ficha al pulsar

Fecha: 2026-10-08. Refinamiento local solicitado por el usuario con dos referencias visuales.

## Cambio aplicado

El directorio muestra foto real de referencia, estado, condición, código, modelo y acceso a detalles. Se retiraron de las tarjetas los bloques extensos de placa, capacidad, fechas, descripción, estado/motivo, combustible, odómetro, mantenimiento, autonomía, conductor, zonas y destino. Estos datos siguen disponibles en la ficha del camión.

Toda la superficie de la tarjeta abre la ficha mediante un único botón accesible: fotografía, código y pie responden a la misma acción. El botón tiene nombre y modelo asociados, funciona con Enter y permite recuperar el foco al volver. No hay botones anidados ni zonas que dependan solo del ratón.

La ficha sigue el orden de la referencia:

1. Identificación del camión y descarga de ficha.
2. Foto grande y datos principales: estado, condición, actualización, conductor, posición, velocidad, placa, carrocería y base.
3. Cinco indicadores: odómetro, combustible/autonomía, utilización de 30 días, costo por km y próximo servicio. Combustible y utilización muestran medidores.
4. Gráfico interactivo de horas de motor con conducción/ralentí, selector de 7 o 14 días y lectura diaria con teclado.
5. Registro y estado, descripción, capacidad, fechas, zonas/destino y mantenimiento.

Se conservan los escenarios y la persistencia de la demo, los KPIs generales, las vistas Zonas y destinos / Asignación, búsqueda, filtros, lista y descarga. El contexto simulado permanece visible. No se cambió el mapper del servicio, los contratos ni el borrador de carga.

## Verificación

- `tsc --noEmit`: OK.
- `next build`: OK, incluyendo lint y tipos.
- Arquitectura: OK (332 módulos, 49 entradas cliente).
- Navegador: seis tarjetas compactas, un botón por tarjeta, ningún bloque `dl` de datos extensos en el directorio; seis fotografías cargadas.
- CM-204 abre la ficha con todos sus campos, medidores y gráfico. Cambio 7/14 días: 48.2 h / 85.9 h; lectura del 8 de octubre: 6.4 h conducción y 0.8 h ralentí, simuladas.
- Enter abre y vuelve; el foco regresa al botón del camión. La búsqueda CM-204 y el modo lista sobreviven al regreso.
- Móvil 390×844: apertura y detalle sin desbordamiento horizontal de página; gráfico con desplazamiento interno.
- Se reinició la compilación local y se actualizó la pestaña del usuario en 8080, dejando abierta la ficha de CM-204.

Evidencia en `D:/Documents/hackaton 2/cargomesh-v2-fleet-detail-20261008`:

- `fleet-compact-desktop.png`, `fleet-compact-list.png`, `fleet-compact-mobile.png`.
- `fleet-detail-desktop.png`, `fleet-detail-mobile.png`.
- `build.log` y copias de los dos archivos antes del cambio.

La captura de la pestaña de Opera excedió el tiempo de respuesta de su herramienta; la ficha quedó verificada en su árbol accesible. Se usó la captura del navegador de Codex para la evidencia visual de la misma aplicación local. No es un fallo de la página.

## Comentario para el líder

Se simplificó el directorio de Flota para evitar tarjetas largas. Ahora toda la tarjeta abre una ficha individual con los datos completos, fotografía, indicadores y gráfico interactivo de horas de motor, siguiendo la referencia enviada. Se conservaron datos y funciones de la demo; validado en escritorio, móvil, teclado, búsqueda y lista. Compilación local actualizada y evidencia documentada.
