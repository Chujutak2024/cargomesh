# HAC-43 — grabación reproducible del preview

- Fecha: 18-oct-2026.
- Alcance: evidencia local del escenario sintético; no afecta al runtime de producción.
- Síntoma: Playwright 1.62.1 esperaba Chromium/FFmpeg de revisiones ausentes. Al reutilizar el Chromium y FFmpeg ya instalados, el grabador nativo solicitaba VP8, que el binario disponible no incluía; no se generaba el WebM.
- Diagnóstico: Chromium existente 156.0.8078.4 funcionó con executablePath explícito. FFmpeg existente disponía de libvpx-vp9; el fallo era del encoder pedido por el grabador, no de Three.js.
- Resolución: `scripts/verify-depot-preview.mjs` permite indicar instalaciones existentes mediante variables de entorno. `--record` captura JPEGs con CDP y los codifica con FFmpeg/libvpx-vp9 a 15 fps. Sin descargar software, añadir dependencias ni cambiar configuración/credenciales del producto.
- Evidencia: video decodificado e inspeccionado, 40.07 s / 1440×1100 / 601 frames / 9,192,007 bytes; ocho comprobaciones de navegador PASS, cero errores no capturados o intentos de llamadas empresariales/externas en el contexto medido.
- Corrección de la prueba durante el diagnóstico: la lectura de tiempo de Scenario summary incluía el sufijo `ms`; se cambió Number por parseFloat. Los cambios de vista se comparan ahora contra el tiempo del canvas y vuelven a ejecutarse en un contexto nuevo. No fue un reinicio del coordinador.
- Límite: la frecuencia del video no mide FPS del renderer. Sin FFmpeg disponible se puede ejecutar la misma prueba sin `--record`; la grabación requiere un encoder libvpx-vp9 instalado por el entorno.

Ver [informe de entrega](https://github.com/Chujutak2024/cargomesh/blob/a6a41fdb78a9e7fea5e01d553cb604e104e1ed74/docs/v2-amazon/delivery/HAC43_DRAFT_DELIVERY_2026-10-18.md) y [resultados](../evidence/HAC43-2026-10-18/browser-results.json).
