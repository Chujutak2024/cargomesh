# Intake: recorte y reflow responsive — 19 oct 2026

## Causa reproducida

El footer del intake usaba `position: sticky` con un `bottom` de 5.5rem
(espacio para el launcher), dentro de `.card { overflow: hidden }`.
En la reproducción de escritorio se desplazaba 88px sobre el cuerpo de
sedes: `footer.top = 767.2`, `cardBody.bottom = 855.2`. Quedaba espacio vacío
debajo y opciones cubiertas. No era un error de datos ni del endpoint.

## Corrección

- Acciones en flujo normal, después del cuerpo de la tarjeta. El padding del
  shell sigue reservando espacio inferior para el launcher. Abrir/cerrar el
  chat ya no desplaza el footer sobre los campos.
- Queries con contenedores nombrados `intake` y `facility`, basadas en el ancho
  disponible real. Resumen, sedes, carga, fechas y contactos se reorganizan
  también al acoplar el asistente o usar el intake embebido.
- Nombres/códigos de sedes y etiquetas de pasos pueden envolver su texto.
  Cabeceras móviles conservan la alineación de icono y título; la acción única
  del primer paso ocupa el ancho completo.
- El grupo de acciones del header cliente no se comprime a un ancho menor que
  sus controles. Esto corrige el botón de cerrar sesión recortado a 320px.
- No se cambiaron contratos, endpoints, permisos, validaciones ni estado del
  borrador. No se modificó el shell carrier ni se instaló una dependencia.

## Verificación real

Navegador local autenticado, catálogo QA sintético ya existente. No se crearon
solicitudes persistidas ni bookings.

- Paso 1 con chat cerrado y sidebar abierto: 320, 390, 768, 1024, 1366,
  1440 y 1920px; además 844×390 en horizontal y ventana desacoplada a 1440px.
- Pasos 2, 3 y 4: 320, 390, 768 y 1366px. Carga con requisitos, dimensiones,
  temperatura, ventanas, contactos y resumen de revisión.
- Todas las mediciones: cero overflow horizontal del documento, campos dentro
  del cuerpo, footer sin solapamiento, 1px inferior correspondiente al borde.
  Controles del encabezado dentro del viewport después de la corrección.
- Validación vacía visible, búsqueda sin resultados, avance y retroceso
  conservando los datos. No se pulsó «Crear DRAFT y evaluar».
- Capturas y mediciones locales: carpeta del chat
  `evidence/intake-responsive-2026-10-19/`, incluido `layout-results.json`.
  Se revisaron capturas representativas de escritorio y móvil. Esta evidencia
  no acredita todos los navegadores/zoom/dispositivos posibles.

Pruebas: `pnpm test:v2-intake` PASS (49, dos nuevas guardas de layout),
`pnpm test:v2-chat-workflow` PASS (15), `pnpm typecheck` PASS,
`pnpm check:architecture` PASS y `pnpm build` PASS.

Trabajo local en `main` por autorización del usuario. Sin push ni despliegue.
