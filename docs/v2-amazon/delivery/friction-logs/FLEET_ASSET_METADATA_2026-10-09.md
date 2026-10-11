# Obtención de imágenes de referencia — 9 de octubre de 2026

## Situación
La descarga directa de páginas de Unsplash devolvió HTTP 429. Las consultas repetidas por archivo al API de Wikimedia Commons también alcanzaron un límite de solicitudes durante la investigación.

## Resolución
Se usó una consulta agrupada de metadatos de Commons y una caché local de resultados. Se seleccionaron retratos CC0 y fotografías de camiones con licencia explícita. Las imágenes se alojan como WebP en la aplicación; el uso de la flota no necesita solicitudes a esos proveedores externos.

## Evidencia
- Metadatos y scripts locales en cargomesh/.planning/2026-10-09-fleet-scene-expansion/.
- Atribución de retratos: cargomesh/public/v2-workspace/drivers/CREDITS.md y fleet-portrait-photos.ts.
- Atribución de camiones: fleet-photos.ts y la sección desplegable de créditos.

No se ejecutaron acciones sobre cuentas externas ni se enviaron datos de usuarios. Las fotos son referencias visuales; los perfiles locales no identifican a las personas fotografiadas.
