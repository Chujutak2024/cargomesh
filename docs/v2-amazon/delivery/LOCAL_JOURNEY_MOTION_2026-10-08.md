# Movimiento del recorrido y limpieza de rótulos — 8 octubre 2026

## Cambios

- Camión animado por la línea del recorrido en un ciclo de 16 segundos, con una fase de avance más lenta en el tramo intermedio y reinicio suave.
- Flujo luminoso en la carretera y movimiento de los trazos del desvío.
- Control de pausa y reanudación, disponible con teclado. La comparación del desvío conserva su funcionamiento.
- En móvil, el movimiento sigue el recorrido vertical. La preferencia `prefers-reduced-motion: reduce` muestra una vista estática y elimina las animaciones.
- Se retiraron de las pantallas del coordinador los rótulos y notas de «datos simulados», «datos de prueba» y sus repeticiones, por solicitud expresa del usuario. La identificación del almacenamiento local, las fuentes del servicio y la conexión GPS siguen siendo precisas.

La animación es una presentación del recorrido: no actualiza coordenadas, posición GPS, horas de llegada, estados de solicitud o asignaciones. Los valores y la procedencia de las colecciones permanecen en sus modelos y almacenamiento; los registros del servicio siguen separados. La atribución del proveedor del mapa no se modifica.

## Validación local

- TypeScript y compilación de Next.js.
- Verificación de arquitectura: 343 módulos y 56 entradas de cliente.
- Comprobación visual y de posición del marcador durante el avance y la pausa.
- Teclado para pausa/reanudación y comparación del desvío.
- Escritorio y móvil, sin desbordamiento horizontal.
- Revisión de los textos visibles en Panel, ficha de solicitud y Flota.

Evidencia: `D:\Documents\hackaton 2\cargomesh-v2-journey-motion-20261008`.

Vista: `http://127.0.0.1:8080/v2-workspace#/dashboard`.
