# Camión del Panel — selección y vista 360°

Fecha: 2026-10-08. Cambio local solicitado por el usuario.

## Implementación

- El visual del Panel recibe `record.draft.truckPreference` del mismo borrador que usa el selector de camión. Ya no muestra siempre la variante articulada.
- Rígido, articulado, refrigerado, plataforma y volquete utilizan sus geometrías propias. El nombre del tipo seleccionado aparece junto al visual.
- La cámara admite giro horizontal completo y elevación limitada para mantener el camión sobre el suelo. Se controla arrastrando con ratón o un dedo, con los botones de giro, o con las flechas del teclado. `Home`/Inicio y el botón de centrar recuperan la vista inicial.
- El giro automático es opcional, se inicia y pausa con un botón y se detiene al tomar control manual. No gira las ruedas ni representa un desplazamiento operativo.
- La vista principal permite WebGL también en móvil. Las miniaturas del selector conservan el comportamiento anterior y no contienen controles interactivos dentro de sus botones.
- La foto de «Mi camión» se muestra como foto cuando existe. Sin foto, el visual se identifica como genérico; no se afirma que se reconstruyó su modelo 3D.
- Carga diferida de la escena, render bajo demanda, pausa fuera de vista/pestaña oculta, límites de resolución y liberación de recursos/eventos. La preferencia de movimiento reducido desactiva el giro automático y la inercia, conservando el giro manual. Si falla WebGL queda el póster y un mensaje de vista estática.
- ES/EN, instrucciones de teclado, foco visible, nombres accesibles y controles de 44 px en móvil.

Los modelos son ilustrativos y no identifican un activo asignado, capacidad disponible ni posición GPS. La selección local no cambia contratos ni registros del servicio. La Flota conserva sus fotografías reales de referencia y las fichas que abren al pulsar.

## Verificación ejecutada

- `tsc --noEmit`: OK.
- `next build`: OK, con lint y tipos; servidores locales recompilados y reiniciados mediante el acceso existente.
- `check-architecture.mjs`: OK, 332 módulos / 49 entradas cliente.
- Pruebas existentes del modelo 3D y del borrador local: 12/12. Comprueban geometrías distintas, presupuesto de geometría, liberación de recursos y conservación de datos/foto/recuperación original.
- Navegador de Codex: se eligieron las cinco variantes mediante el selector real y se comprobó la geometría renderizada en el Panel. Volquete permanece tras recargar.
- Arrastre real con ratón: la cámara cambia de `(-6.510, 3.604, 7.611)` a `(1.024, 8.498, -7.196)`. Inicio recupera la posición inicial; ArrowRight modifica el ángulo.
- Doce pulsaciones de giro de 30° completan una vuelta y regresan a la cámara original, pasando por ambos lados y la parte trasera. Giro automático avanza frames/ángulo y se puede pausar.
- Móvil 390×844: escena WebGL, controles visibles y sin desbordamiento horizontal (`scrollWidth 375`, `innerWidth 390`). El canvas usa `touch-action: none` para OrbitControls; el gesto táctil físico queda para el smoke en dispositivo.
- Sin errores WebGL observados en el navegador de Codex. El movimiento reducido y la pérdida del contexto no se forzaron mediante herramientas; esos caminos están implementados y quedan disponibles para el smoke manual.
- Se restauró la preferencia inicial del navegador de prueba («Mi camión», modelo vacío, sin foto). Se conservaron origen, destino, peso, fechas y progreso del borrador. En Opera se recargó la aplicación compilada y se verificó el Volquete seleccionado y sus controles habilitados, sin cambiar la selección del usuario.

## Evidencia local

Carpeta: `D:/Documents/hackaton 2/cargomesh-v2-truck-360-20261008`.

- `flatbed-dashboard.png`, `tipper-dashboard.png`, `tipper-rear-180.png`.
- `truck-360-mobile.png`.
- `interaction-results.json` con las variantes y posiciones de cámara de la vuelta completa.
- `build.log` y copias de los cuatro archivos antes del cambio.

Referencias del control y del render: [Three.js OrbitControls](https://threejs.org/docs/pages/OrbitControls.html), [React Three Fiber — render bajo demanda](https://r3f.docs.pmnd.rs/advanced/scaling-performance).

## Comentario para el líder

Se corrigió el visual del camión en el Panel para que use la preferencia guardada del borrador. Las cinco carrocerías ya se reflejan en su modelo 3D. Se incorporaron giro de 360° por arrastre, botones y teclado, centrado y giro automático opcional, con render bajo demanda y soporte móvil. Se conserva la foto de camión propio y se identifica el visual genérico cuando no existe su modelo. Se validaron las cinco selecciones, persistencia, vuelta completa, interacción y viewport móvil; tipos, arquitectura, build y 12 pruebas pasaron. Evidencia y límites del smoke manual documentados. La versión local 8080 está actualizada; la entrega permanece local, sin publicación en GitHub.
