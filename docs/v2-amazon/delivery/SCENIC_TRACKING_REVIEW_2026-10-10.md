# Seguimiento útil, revisión final y recorrido con paisaje 3D — 2026-10-10

## Alcance

- Panel: avance propio de cada solicitud, tiempos de recorrido, hitos seleccionables con descripción, comparación de horarios y acceso al mapa.
- Revisión: ficha de transporte con origen/destino, carga, distribución del peso, ventana de fechas y equipo preferido. Lista de comprobaciones con enlaces a cada paso. La integridad de los campos no verifica pasos omitidos ni realiza una asignación.
- Ruta: selector de los siete pedidos guardados, estados iniciales distintos (12%–94%) y posición visual del camión interpolada sobre la ruta calculada. Los datos, preferencias y fotos siguen perteneciendo a la misma solicitud.
- Vista 3D: carretera y paisaje originales en 3D, guía luminosa con flechas animadas, vegetación, edificios con ventanas, señalización, arcén, costa o montañas. El camión está orientado a la tangente del carril y la cámara lo sigue. Sin controles de reproducción. La luz consulta la hora del equipo al abrir y cada 30 segundos.

## Datos y límites

Los avances, checkpoints y horarios son fixtures de presentación autorizados para esta demo. Viven en journey-model.ts y estado transitorio, no en tablas de producción ni en los registros originales. No son GPS ni confirman viajes, entregas, reservas o disponibilidad. La comparación es de horarios de planificación; no aplica una nueva ruta ni altera la geometría de Google.

Google Maps y Google Routes continúan en el mapa geográfico de dos dimensiones, con su atribución. La vista 3D independiente comprime la escala de la polilínea válida a una carretera ilustrativa y añade escenografía propia: los edificios, montañas, vegetación y litoral no son una reconstrucción geográfica del trayecto. Si falta geometría no se fabrica una ruta; si falta un GLB solicitado no se sustituye silenciosamente por otro vehículo.

No se modificaron esquemas de datos, almacenamiento de solicitudes, clave de recuperación original, fotos, modelos subidos o reglas de asignación. No hubo escrituras en Supabase, despliegues en Vercel, operaciones de Git o cambios en trackers externos.

## Verificación

- 14 pruebas de perfiles de recorrido, preservación del formulario, pasos, rutas discontinuas, orientación del carril y normales de la carretera: aprobadas.
- Arquitectura: 380 módulos / 72 entradas cliente, aprobada.
- Producción: compilación, lint, tipos, páginas y trazas aprobados; reinicio local 8080/8083.
- Opera nativo: hitos seleccionables, comparación de tiempos y botón de mapa funcional (enfoca y desplaza a la región del mapa).
- Cambios entre pedidos: SOL-0001 Lona lateral/costa/87%, SOL-0002 refrigerado/montaña/48%, SOL-0005 rígido/ciudad/94%. La posición, orientación y porcentaje de la escena avanzan; 61–70 draw calls observados durante el día. Edificios con ventanas, nubes y ruta luminosa visibles.
- Revisión: enlace de checklist abre Carga; volver a Revisión conserva todos los campos y no confirma pasos omitidos. Ficha original Callao–Piura, Maquinaria industrial, 10×800kg, 8,000kg, 12/7/2026–12/9/2026 y preferencia Lona lateral conservadas.
- Móvil 412×915: diálogo 394/394px, selector363/363px, ficha329/329px, seguimiento363/363px (ancho cliente/scroll). Camión centrado completo, etiqueta arriba, sin desbordamiento horizontal. Viewport restablecido.
- Directorio: 7 de 7 solicitudes, peso total74,600kg y datos propios conservados, incluida la preferencia Mi camión de SOL-0007. Sin errores de consola en la verificación final. La pestaña del usuario queda abierta en la nueva vista3D de SOL-0001.

## Archivos principales

carrier-portal: journey-model, use-journey, local-request-journey, journey.module.css, route-request-picker, request-review, local-draft-wizard, local-route-workspace, local-draft-controls, local-draft-workspace, truck-inspection.

logistics-3d: scenic-route-model, scenic-route-world, route-navigation-3d, route-navigation.module.css.

## Evidencia local

D:/Documents/hackaton 2/cargomesh-v2-scenic-tracking-20261010/

Capturas: tracking-desktop.png, tracking-mobile.png, review-desktop.png, review-mobile.png, route-city-desktop.png, route-coast-desktop.png, route-coast-mobile.png, requests-preserved.png. build.log y tests.log en el mismo directorio.
