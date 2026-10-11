# Gráficos de carga, recorrido y revisión de textos — 8 octubre 2026

## Producto local

Vista actual: `http://127.0.0.1:8080/v2-workspace#/dashboard`.

- Panel: dos gráficos dentro del resumen de la solicitud seleccionada. El anillo muestra su participación en el peso de las siete solicitudes; las barras comparan el peso unitario con el promedio ponderado por unidades.
- Ficha de solicitud: recorrido con origen, controles, camión, destino, incidencia de velocidad, desvío alternativo y comparación de llegada. La ficha comparte el componente del Panel y conserva el acceso al mapa, a la carga y al recorrido de revisión.
- Textos revisados en Panel, Solicitudes, formulario, Revisión, Ruta, Flota y Ayuda. Se retiraron etiquetas repetidas de borrador/ejemplo y frases internas sin una acción clara para el usuario.
- Estados de revisión: **Pendiente de revisión**, **En revisión**, **Revisada**. Estar en el último paso no equivale a confirmar la revisión.
- Referencias visibles: `SOL-0001` a `SOL-0007`. Los identificadores internos, enlaces existentes, claves de almacenamiento y copia original recuperable conservan sus valores anteriores.

## Cálculos y procedencia

Los gráficos usan `quantity × unitWeightKg` de la colección guardada. Participación = peso de la solicitud / peso total. Promedio unitario = peso total / número total de unidades. La colección inicial contiene **74 600 kg y 144 unidades**; su promedio es **518,1 kg por unidad**. SOL-0001 aporta 8 000 kg (11 % redondeado), SOL-0006 aporta 20 000 kg (27 % redondeado).

Los cálculos describen cargas; no representan capacidad disponible, ocupación de un vehículo ni reserva. No se utiliza una biblioteca de gráficos adicional: SVG accesible acompañado de texto y medidores HTML.

La posición, controles intermedios, incidencia, horarios y ahorro del recorrido son **simulados**, identificados en el propio componente. El componente no infiere GPS, restricciones del camión ni geometría vial. Cuando las ciudades no pertenecen a una red terrestre conectada se presenta el estado sin recorrido, sin fabricar una traza. El mapa vial existente conserva su fuente y atribución independientes.

La fuente del servicio se identifica como **Datos del servicio**. No se sustituyen errores o resultados vacíos del API por solicitudes locales. La flota simulada conserva un indicador de procedencia y las fotografías de referencia.

## Validación

- TypeScript y compilación de Next.js correctos.
- Arquitectura: 343 módulos y 56 entradas de cliente revisados.
- 21 pruebas de carga, referencias/estados, conservación de datos, colección y flujo de revisión.
- 23 pruebas de flota, asignación, persistencia y separación de registros del servicio.
- Navegador: selector, búsqueda por SOL-0006, filtro pendiente, detalle, comparación de desvío mediante Enter y navegación del stepper. Se revisaron campos y textos sin guardar modificaciones sobre los datos del usuario.
- Escritorio de 1600 px y móvil de 390 px: gráficos y recorrido adaptables, sin desbordamiento horizontal.

Evidencia local: `D:\Documents\hackaton 2\cargomesh-v2-content-charts-20261008`.

- `dashboard-desktop.png`
- `request-detail-desktop.png`
- `dashboard-mobile.png`
- `request-detail-mobile.png`
- `browser-smoke.json`
- `build.log`

Esta entrega corresponde a la web local actual.
