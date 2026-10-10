# Entrada cinematográfica a CargoMesh

## Solicitud y entrega

La raíz `/` abre una pantalla completa con una única acción visible: **Ir a CargoMesh**. El enlace lleva a `/v2-workspace#/dashboard`, conservando la aplicación y el almacenamiento existentes. El lanzador local `D:\Documents\hackaton 2\Abrir CargoMesh V2 local.ps1` ahora abre esta entrada por defecto; `-View dashboard` y las demás vistas explícitas siguen funcionando.

El fondo es una escena original y decorativa, renderizada con Three.js en el navegador. Reutiliza el camión articulado detallado del catálogo, con ventanas abiertas geométricamente, cristales, cabina interior, herrajes, neumáticos, suspensión y giro de ruedas. Una cámara en tres cuartos acompaña al vehículo. La carretera continúa sin reiniciar el recorrido, con cuatro secciones de 320 m que se reciclan y cambian su origen de coordenadas.

El paisaje incluye asfalto y suelo con grano, marcas viales, barreras, reflectores, viviendas, ventanas, cercas, luminarias, arbustos, rocas, flores, hierba y árboles con ramas y copas de hojas instanciadas. El cielo tiene nubes procedurales, halo solar, luna con relieve visual y estrellas. Las sombras, reflejos y materiales se iluminan según el reloj local. Los faros y luces del vehículo se intensifican de noche.

## Reloj, accesibilidad y recursos

- Hora del dispositivo mediante `new Date()`, actualizada cada 30 segundos. Fases nominales: día 06–16 h, tarde 16–19 h y noche el resto. La paleta se mezcla gradualmente al amanecer y anochecer mediante el modelo existente de iluminación.
- Sin selector de hora, controles de reproducción, cabeceras, estadísticas ni textos visibles adicionales en la entrada.
- Enlace semántico, foco de teclado visible y acceso independiente de la carga del motor 3D. Fondo SVG original durante la carga o si WebGL falla.
- `prefers-reduced-motion` deja la escena quieta y mantiene las actualizaciones del reloj. Una pestaña oculta suspende el bucle de renderizado y el avance.
- Renderizador cargado dinámicamente; ninguna generación 3D, geolocalización, meteorología o servicio de pago. Escenario sin relación con GPS, cobertura, itinerarios o estados de solicitudes.
- Sombras de 2048 px en escritorio y 1024 px en móvil; DPR limitado a 1.5 y 1.25. Al cambiar el tamaño se libera el destino anterior de sombras.
- Desmontaje libera intervalos, observadores, listeners, tareas de terreno, geometrías, texturas, materiales, buffers de instancias, reflejos y contexto WebGL. Las pruebas de reciclaje cubren específicamente hojas y hierba instanciadas.

## Botones de flota y datos

Se retiraron **Flota operativa** y **Datos del servicio**, sin modificar inventarios, conductores, solicitudes, revisión, fotografías o modelos subidos. El adaptador de consulta autorizada sigue disponible mediante `/v2-workspace#/fleet/service`; sus secciones conservan ese prefijo. No se envió ninguna consulta ni se modificaron registros del servicio durante la comprobación.

La entrada abrió el panel con **7 solicitudes**, **74,600 kg** en total y **SOL-0005** seleccionada con sus cinco pasos revisados. La flota conserva **12 camiones**; ambos botones retirados tienen cero coincidencias en el DOM. La pestaña anterior se recargó para que no conservara la interfaz vieja.

## Verificación y evidencia

- 20 pruebas: uniones de carretera después de cambiar coordenadas, continuidad hasta un millón de metros, posición en el carril, cuatro secciones acotadas, reciclaje de buffers/textura, reloj local y regresiones del recorrido y de revisión.
- Arquitectura: 386 módulos y 73 entradas cliente, sin dependencias de servidor en el motor del navegador.
- Compilación de producción con lint y tipos. La raíz sirve 1.49 kB de código de página y 108 kB de primera carga; el motor se descarga aparte.
- Navegador nativo Opera: una sola acción en la entrada, activación con Enter hacia el panel, 7 solicitudes recuperadas y 12 vehículos conservados. Sin errores de consola en la entrada observada.
- Móvil 412 × 915: sin desbordamiento horizontal, vehículo completo y acción de 210 × 59 px. Captura de escritorio y captura móvil, con movimiento real entre lecturas del cursor y del ángulo de ruedas. La captura observó la fase diurna del reloj; las tres fases y sus transiciones se validaron mediante pruebas del modelo. No se cambió el reloj del sistema. Las muestras de la sesión de captura no constituyen un benchmark de FPS.

Evidencia local: `D:\Documents\hackaton 2\cargomesh-v2-entrance-20261010\`.

Archivos principales: `entrance-desktop.png`, `entrance-mobile.png`, `mobile.json`, `fleet-without-source-buttons.png`, `fleet-preserved.json`, `dashboard-preserved.txt`, `service-adapter-retained.txt`, `tests.log`, `architecture.log`, `build.log` y `entrance-final.json`.

Skill principal: `frontend-design`, seleccionada mediante `professional-project-orchestrator`; planificación local y verificación nativa como auxiliares. Sin despliegue, mutación de base de datos, commit, rama o PR.
