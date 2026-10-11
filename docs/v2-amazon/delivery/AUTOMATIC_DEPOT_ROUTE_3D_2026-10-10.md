> Actualización posterior: la ruta 3D ahora usa escenografía original y carretera, manteniendo Google en el mapa geográfico separado. Véase [Seguimiento, revisión y paisaje 3D](SCENIC_TRACKING_REVIEW_2026-10-10.md).

> Aclaración posterior del usuario: la reproducción sigue siendo automática, pero la cámara permite giro, desplazamiento, zoom y vista interior. Véase [Exploración de la sede](INTERACTIVE_DEPOT_VIEW_2026-10-10.md).

# Operación automática de sede y vista de ruta 3D — 2026-10-10

## Cambios

- Visor de sede exclusivamente de visualización: sin reproducción, pausa, velocidad, barra de tiempo, saltos de etapa, giro o controles de cámara. La operación se reproduce automáticamente durante 72 segundos, mantiene el resultado siete segundos y vuelve a empezar. El cierre y regreso pertenecen al diálogo.
- Nave con fachada continua entre los tres muelles, dintel, paredes laterales/trasera y techo. Solo abre el muelle activo; los otros permanecen cerrados. Preparación exterior visible, cámara automática más cercana, material de pavimento/hormigón con grano, sombras y luz nocturna.
- El maderero recibe tres capas de troncos de longitud completa y conserva la carga durante revisión y salida. Carga adecuada al tipo de carrocería: palés, granel o manguera, con puertas cuando corresponde. No se presume el compartimento de un GLB subido por el usuario.
- Botón **Vista 3D** tanto en Ruta como en el mapa ampliado de la ficha del camión. Google Maps/Routes mantiene su geometría y atribución. El mapa se presenta en perspectiva; un camión Three.js detallado sigue el recorrido con cámara automática, giro suavizado y ruedas animadas.
- Contenido de navegación compacto: destino, camión seleccionado, origen/destino, distancia y tiempo estimado. Regreso al mapa y cierre con restauración de foco. Sin controles de reproducción ni cifras de GPS inventadas.

## Implementación

`depot-arrival.tsx`, `depot-model.ts`, `depot-actors.ts`, `depot.module.css`; `route-track.ts`, `route-navigation-3d.tsx`, `route-navigation.module.css`; `route-navigation-dialog.tsx`, `truck-inspection.tsx`, `local-draft-controls.tsx` y sus estilos.

La ruta interpola posiciones por distancia acumulada sobre la polilínea recibida. Rechaza coordenadas inválidas, rutas vacías y discontinuidades; no dibuja trayectos alternativos inventados. La animación representa el recorrido, sin confirmar una entrega, una carga operativa o una posición GPS.

## Compatibilidad

El navegador Opera de la sesión rechazó el mapa vectorial/WebGLOverlayView de Google. Se utiliza el mismo mapa Google raster con perspectiva y un renderizador Three.js independiente. Es un mapa en perspectiva con un camión 3D, no edificios/terreno reconstruidos en tres dimensiones. El motivo y el selector de capa visual se documentan en `friction-logs/ROUTE_3D_VECTOR_SUPPORT_2026-10-10.md`.

La sede y navegación respetan movimiento reducido y detienen su avance al ocultarse el documento. Canvas, materiales, texturas, modelos, listeners, observers y contextos propios se liberan al cerrar. La geometría del catálogo habitual conserva su estado original.

## Verificación

- Typecheck aprobado.
- 19 pruebas de contexto, camiones, ciclo/carga/fachada y geometría de ruta aprobadas.
- Arquitectura: 374 módulos / 69 entradas cliente, aprobada.
- Build de producción completo: compilación, lint, tipos, páginas y trazas aprobados. Servidores locales 8080 y 8083 reiniciados con la versión actual.
- Navegador: Google en perspectiva y camión Maderero visibles. Distancia de animación avanza de 345.39 a 721.34 metros con cambios de latitud/longitud y orientación sobre la ruta; sin errores nuevos de carga vectorial. Google conserva logo y condiciones legibles.
- Diálogo móvil 412 × 915: ancho cliente y scroll 394 px, sin desbordamiento horizontal. La vista vuelve al mapa y la ficha conserva SOL-0001, Callao–Piura, Maquinaria industrial, 8,000 kg, 10 unidades, fechas y preferencia Maderero.
- Sede: cero botones/inputs/selectores dentro del visor, techo persistente, cuatro trabajadores. Carga completa observada a 59 s y salida a 71.62 s con tres capas/100%. En móvil el diálogo mide 394 px de ancho cliente y scroll, sin desbordamiento.
- Solicitudes: 7 de 7 conservadas, SOL-0001 con Maderero y sus campos originales. Viewport temporal restablecido.

## Evidencia

`D:/Documents/hackaton 2/cargomesh-v2-automatic-route-3d-20261010/route-3d-desktop.png`

`D:/Documents/hackaton 2/cargomesh-v2-automatic-route-3d-20261010/route-3d-mobile.png`

`D:/Documents/hackaton 2/cargomesh-v2-automatic-route-3d-20261010/depot-loaded-exit.png`

Solo cambios locales. Sin despliegue, cambios en base de datos, asignaciones, Git/PR o sistemas externos.

Capturas adicionales: depot-loaded-detail.png, depot-mobile.png y requests-preserved.png en la misma carpeta de evidencia.
