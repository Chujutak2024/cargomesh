# Exploración de la sede 3D — 2026-10-10

## Solicitud
Permitir girar, desplazar, hacer zoom y ver el interior de la empresa. La reproducción de la operación continúa siendo automática.

## Cambios
- OrbitControls sobre el canvas: giro con arrastre, desplazamiento con botón derecho/gesto de dos dedos y zoom con rueda/pinza.
- Acercar, alejar y centrar como acciones de cámara. Al interactuar se detiene solo el seguimiento de cámara; el camión, personal y carga siguen su secuencia.
- Ver interior retira el techo y enfoca el almacén desde arriba, mostrando estanterías, palés y la preparación. Ver exterior restaura el techo y seguimiento. Las paredes permanecen completas.
- Teclado en el visor: flechas giran, +/− cambian zoom e Inicio centra. Foco visible y botones con nombres accesibles. Límites para evitar pasar por debajo del recinto o perder el zoom útil.
- Controles de cámara compactos con ajuste móvil, separados de cualquier control de reproducción.

## Verificación
Typecheck, seis pruebas existentes de fachada/carga/ciclo/recursos, arquitectura y build de producción aprobados. Servidores 8080/8083 reiniciados. Browser verificó arrastre (cámara pasa de guiada a manual), rueda (zoom de 18.85 a 26.06), botones de zoom, giro por teclado, interior sin techo con racks visibles y exterior con techo restaurado. La carga alcanza 100% y la salida continúa mientras la cámara está en modo manual. En móvil 412×915 el diálogo mide 394 px de ancho cliente/scroll; controles utilizables y sin desbordamiento. Viewport temporal restablecido.

## Alcance
Solo visor y estilos de la sede local. Sin cambios en solicitudes, datos persistidos, flota, reproducción, mapa, despliegue o Git.

Evidencia: D:/Documents/hackaton 2/cargomesh-v2-depot-interactive-20261010/interior-desktop.png e interior-mobile.png. Página local dejada en la sede con interior abierto.
