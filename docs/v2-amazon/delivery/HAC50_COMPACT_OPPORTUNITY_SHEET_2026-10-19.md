# HAC-50 — Ficha compacta de oportunidad Carrier

19-oct-2026. Checkout activo: `C:/Users/HP/.codex/worktrees/unified-workspaces/cargomesh`, rama `codex/unified-workspaces-demo-boundary`.

## Alcance autorizado

Compactar la ficha existente siguiendo la referencia de orden de trabajo del usuario; usar Motion y HyperFrames. No cambia las rutas ni las reglas de respuesta/oferta. La ficha es de lectura: el Carrier no edita el pedido del Cliente.

## Entregado

- Indicadores, aviso general y navegación List/Board/Offers permanecen en el directorio; no preceden a la ficha.
- Cabecera con referencia breve y estado; ciudades, ventanas UTC, contexto, carga, totales, tabla de bultos y requisitos agrupados.
- Respuesta y preparación de oferta en un panel lateral compacto en escritorio. Guardas, formulario de respuesta, permisos y versionado existentes conservados.
- Mensajes humanos para los controles operativos pendientes. La cobertura/capacidad desconocida sigue sin confirmarse; códigos originales consultables.
- El encabezado `REQ · 219DFC89` es un alias visual derivado del código actual; no es un nuevo identificador persistido ni una garantía de unicidad. IDs, código canónico y revisiones completos dentro de Referencias técnicas.
- Sin inventar identidad, contacto o dirección del Cliente; el snapshot solo comparte ciudades y referencia de organización.
- Disclosures con Motion 14 y preferencia de movimiento reducido, sin remount del workspace/formularios para animar. Camión 3D se monta únicamente al abrir su sección opcional.
- HyperFrames: composición editable y MP4 de 6 s / 1280×480 / 30 fps, 195173 bytes. Reproducción manual, sin autoplay, controles nativos, poster y explicación textual; carga tras abrir el panel opcional. No se añadió runtime HyperFrames a la aplicación.

## Archivos

- `cargomesh/src/features/carrier-juan/connected-opportunities.tsx`
- `cargomesh/src/features/carrier-juan/commercial-workspace.tsx`
- `cargomesh/src/features/carrier-juan/opportunity-record.tsx`
- `cargomesh/src/features/carrier-juan/opportunity-record.module.css`
- `cargomesh/motion/carrier-request-flow/` (fuente, identidad, versión CLI, GSAP local con atribución original)
- `cargomesh/public/carrier-media/request-review-flow.mp4` y poster PNG

## Verificación focal

- `node node_modules/typescript/bin/tsc --noEmit`: PASS. El wrapper `pnpm typecheck` intentó reconciliar un node_modules enlazado a otro checkout y se negó; se ejecutó el compilador instalado directamente, sin instalar ni reemplazar dependencias de la app.
- HyperFrames 0.8.154 `check`: PASS; runtime 0 errores, layout 0 incidencias en 9 muestras, motion 0 errores, contraste 53/53. Aviso de organización Studio por usar una escena con divs anidados, aceptado para una pieza de una sola escena.
- Render HyperFrames completado; frame 4 s inspeccionado. Sin datos privados en el asset.
- Navegador integrado, viewport móvil: ficha real cargada con Lima Local, datos visibles, indicadores/pestañas ausentes, desplegable y video abiertos. Reproducción manual: duración 6 s, readyState 4, paused false, error null. Capturas locales en salida/client-carrier-connection-20261019/.
- No acciones comerciales ni cambios de base de datos, autenticación, Vercel o main. Sin build/suites generales nuevas. Escritorio, teclado, movimiento reducido real, navegación y regresión comercial completos quedan para la revisión del 21.

## Continuidad

El flujo funcional siguiente sigue siendo oferta → selección Cliente → booking → compromisos/asignaciones → ejecución, coordinado con Luis. Este incremento visual no declara cerrado HAC-50 ni resuelto el acceso al Supabase alojado.


# Ajuste de proporciones de la ficha — 19-oct-2026

Usuario aporta una nueva imagen de referencia y pide redimensionar la ficha actual.

- Cabecera autónoma: referencia, estado, recepción registrada y trayecto con puntos de origen/destino.
- Horario y contexto separados en dos superficies; contexto en filas etiqueta/valor.
- Resumen de carga separado de bultos/requisitos; totales con iconos y separadores.
- Panel lateral con título Carrier response y dos bloques internos: revisión y preparación de oferta. Botones apilados de ancho completo.
- Aviso operativo, privacidad, desplegables y actualización agrupados bajo la tabla.
- Márgenes del contenido reducidos solo cuando existe esta ficha; fondo más claro, bordes sutiles, radios y densidad alineados con la referencia. Sidebar y rutas actuales conservados; no se añaden los destinos ficticios del ejemplo.
- Motion y la pieza de HyperFrames anterior se conservan; no hay nuevo render ni cambio de dominio.

Archivos: opportunity-record.tsx, opportunity-record.module.css, connected-opportunities.tsx y portal.module.css, todos dentro de cargomesh/src/features/carrier-juan/ del checkout activo.

Comprobación focal: compilador TypeScript instalado PASS tras el cambio de estructura. Navegador integrado móvil muestra la ficha reagrupada; escritorio y uso general siguen para el usuario/el 21. Sin suites generales, acciones comerciales, DDL ni cambios de autenticación. Captura: request-sheet-proportions.png. Respaldo: before-sheet-proportions/.

No se reintenta push en este ajuste: las dos subidas del corte e6c7646 fallaron por curl 55 y HTTP 408. Conservar los commits locales para compartir cuando se recupere la conexión; nunca force push.
