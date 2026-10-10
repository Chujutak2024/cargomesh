> Los controles descritos en este registro histórico fueron retirados por la solicitud del 10 de octubre. La versión vigente es [Operación automática y ruta 3D](AUTOMATIC_DEPOT_ROUTE_3D_2026-10-10.md).

# Ciclo completo de operación en sede 3D

## Solicitud y alcance

Ampliar la animación anterior, que terminaba al llegar al muelle: llegada del camión, preparación del pedido por trabajadores, carga y salida. Trabajo exclusivo en la web local activa; conserva solicitudes, flota, preferencias, asignaciones, fotos y GLB.

## Secuencia visual

| Tiempo | Operación |
|---|---|
| 0–6 s | Aproximación por carretera con desaceleración |
| 6–9 s | Parada en control de acceso y apertura de barrera |
| 9–18 s | Entrada al patio |
| 18–26 s | Reversa al muelle, apertura de persiana y puertas del furgón |
| 26–36 s | Trabajadores preparan paquetes y lotes |
| 36–57 s | Tres movimientos de carga con montacargas y elevación |
| 57–62 s | Revisión y cierre de puertas |
| 62–72 s | Avance, giro hacia otro acceso y salida del recinto |

El tiempo es el de una animación de presentación. No crea una orden, carga registrada, disponibilidad ni telemetría. La asignación del carrier continúa respetando las lanes explícitas del contexto anterior.

## Acabado y equipos

- Cuatro trabajadores con casco, chaleco reflectante, guantes, botas y extremidades articuladas; operador del montacargas sentado.
- Cajas transportadas y embaladas, palés preparados, paquetes sobre cinta de rodillos y señales en el muelle.
- Montacargas con ruedas, cabina, baliza, mástil, horquillas móviles, traslado de palés y retorno por el pasillo.
- Almacén con interior visible por defecto, persianas móviles, rótulos, mesas de preparación, estanterías, pasillos libres, equipos de seguridad, drenaje y barrera de salida.
- Furgones cerrados: carcasa hueca y puertas traseras con bisagras, habilitadas únicamente en el visor de sede. Los modelos normales y sus imágenes no cambian.
- Mezclador y volquete: tolva/chute y partículas de material; cisterna: manguera; plataformas: carga sobre el equipo. No se introducen cajas dentro del tambor del mezclador. El maderero llega vacío y recibe lotes de madera, conservando la carga habitual en el visor del catálogo.
- Sombras de 2048 px, reflejos existentes y luz de patio. Hora automática del equipo y previsualización día/tarde/noche conservadas.

## Controles

Pausa/reanudación, repetición, techo/interior, cámara que sigue la operación, vista general, seis etapas seleccionables, barra de tiempo y velocidades 0.75×/1×/1.5×/2×. El arrastre manual desactiva el seguimiento de cámara. La vista se acerca suavemente durante la preparación y carga y vuelve a abrirse al salir.

Renderizado por demanda durante la reproducción y ajuste de cámara; pausa al ocultarse la pestaña. La escena se calcula desde el tiempo para que saltar o repetir restaure trabajadores, puertas, palés y posición. Movimiento reducido muestra una vista estática y permite consultar etapas manualmente.

## Archivos

`depot-cycle.ts`: fases y trayectoria deterministas. `depot-actors.ts`: personal, equipos y carga. `depot-model.ts`: edificio y recinto. `depot-arrival.tsx` y `depot.module.css`: visor y controles. `truck-model.ts`: puertas de carga opcionales. `truck-inspection.tsx`: acceso al ciclo desde el resumen.

## Verificación

- Typecheck aprobado.
- 14 pruebas aprobadas: parada, reversa, carga antes de salida, gates, trayectoria continua, rewind de actores/carga, geometría, disposición de recursos, puertas opcionales, catálogo de diez tipos de camiones y conservación del contexto.
- Arquitectura aprobada: 371 módulos, 67 entradas cliente.
- Build de producción aprobado, con comprobación de tipos, lint y generación de páginas. Web local reiniciada en 8080/8083.
- Acercamiento final de cámara comprobado en el navegador: centra muelle, personal, equipo y carga; la llegada y la salida mantienen la vista general. La captura de escritorio corresponde a esta compilación final.
- Navegador: salto a carga, pausa/reanudación, velocidad 2× y navegación por teclado en la barra de tiempo; estado intermedio a 43.2 s, carga 34 %, un lote. Final a 72 s: tres lotes, 100 %, camión fuera de la sede en (18, 9).
- Vista móvil 412×915: ventana de 379 px, sin desbordamiento horizontal; etapas desplazables y controles accesibles mediante desplazamiento vertical. Viewport restablecido al terminar.
- Barra de tiempo corregida frente a estilos globales de formulario: 6 px, sin padding ni altura mínima de campo de texto.
- Se conservaron las siete solicitudes, SOL-0001, 10×800 kg, fechas y la preferencia Maderero que el usuario tenía seleccionada al revisar.
- No se observaron errores del visor en consola. Sigue presente el aviso de deprecación de THREE.Clock emitido por las dependencias del renderizador.

Evidencia local: `D:\Documents\hackaton 2\cargomesh-v2-depot-cycle-20261009\`.

Capturas: `carga-maderero-desktop.png`, `carga-mobile.png`, `salida-completa.png`; registro de compilación: `final-build.log`. La comprobación visual del furgón CM-231 confirmó el contexto independiente de flota, interior y montacargas.
