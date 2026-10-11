# Activación del visor tras navegación y captura

Durante la validación del catálogo, una escena nueva permaneció en `poster` después de navegar por hash y enfocar el enlace junto al camión. El elemento estaba dentro del viewport (y≈226, alto 220, viewport 1280×720), `document.hidden=false`, pero el estado de intersección seguía inactivo. La captura anterior también había hecho reaparecer el póster de una escena ya preparada.

Se conserva la escena preparada y se oculta su póster aunque el loop esté pausado. La visibilidad se vuelve a medir por bounds en la notificación del observer, scroll, resize y retorno a la pestaña, agrupando mediciones con requestAnimationFrame. Los listeners y el frame pendiente se liberan al desmontar.

QA: navegar Ruta → Panel, enfocar/scroll hasta el camión, cambiar tipo y comprobar canvas/controles; volver a hacer la prueba en móvil y tras recarga. Los renderizadores permanecen bajo demanda, sin giro automático obligatorio. No se alteran los datos de la solicitud.

Los pósteres del catálogo se exportan con la función de descarga PNG del propio renderer, que vuelve a dibujar la escena antes de capturarla. No se usan capturas del póster anterior como si fueran el nuevo modelo.
