# Cielo del visor — defecto detectado en validación local

- Fecha: 9 oct 2026.
- Síntoma: carretera y camión visibles, pero el cielo 3D no se compilaba; el fondo CSS ocultaba parcialmente el defecto.
- Causa: un atributo JSX de texto conservaba `\\n` literales en el shader GLSL.
- Corrección: shader en una expresión JavaScript con líneas reales, incluidas las directivas de Three.js. No se oculta el error ni se declara el fallback como render 3D completo.
- Verificación realizada: compilación final aprobada; cielo y luna visibles, consola sin errores nuevos en los tres modos. Capturas en `cargomesh-v2-road-environment-20261009`.
- Alcance: solo visor decorativo local; no se modificaron datos ni proveedor cartográfico.

## Revisión del ambiente automático y movimiento

- Síntoma: al cambiar el reloj en la escena aislada de revisión, el gradiente cambiaba pero las nubes seguían claras y el sol/luna no aparecían en la composición.
- Corrección: actualizar los uniforms numéricos y vectoriales mediante la referencia a la instancia real de `ShaderMaterial`. Se ajustó la elevación y posición del disco para situarlo por encima de la cabina en la vista inicial.
- Resultado observado: día con sol y nubes; noche con luna, estrellas y nubes oscuras. Consola sin errores; capturas `automatic-drive-day.png` y `automatic-drive-night.png`.
- Acabado: filtrado con mipmaps y anisotropía del asfalto para evitar patrones de moiré en vistas oblicuas.
