# Camiones detallados, importación GLB y generación desde fotos

Cambio en la aplicación local actual del coordinador. No se publicó, mergeó ni desplegó.

## Implementado

- Cinco carrocerías propias: rígido, articulado, refrigerado, plataforma y volquete. Pintura y cristales PBR, reflejos de estudio, sombras, accesorios de cabina, neumáticos con perfil/banda de rodadura y tornillería.
- Modelo articulado exportado: 1.474.804 bytes, 36.032 triángulos, nueve mallas/materiales. Se mantiene el presupuesto previo de 50.000 triángulos por modelo del catálogo.
- Vista 360° con arrastre, flechas, Inicio, botones, giro automático opcional y descarga PNG de la vista. Pausa fuera de pantalla y respeta movimiento reducido.
- «Mi camión» conserva un cuadro para la foto y el campo de modelo. Permite importar un GLB real; el archivo importado se renderiza con su geometría y materiales, normalizado al encuadre.
- Modelo guardado como Blob en IndexedDB, con `modelAssetId` opcional en la preferencia de la solicitud. El formato previo, claves de las siete solicitudes y copia original permanecen compatibles.
- GLB máximo 12 MB, texturas raster incluidas, 200.000 triángulos/64 primitivas. Se rechazan archivos externos, SVG, compresión sin decodificador, dimensiones no finitas y modelos excesivos. Un fallo conserva la selección previa.

## Foto → 3D: preparada, todavía sin validación live

Three.js muestra el modelo; la reconstrucción la realiza un motor de IA separado. Se preparó un adaptador del protocolo oficial Tripo v3:

1. Envío de la foto solo tras pulsar el botón y autorizar su transmisión a Tripo. No ocurre automáticamente al subir la foto al cuadro.
2. Upload `/files`, generación `/generation/image-to-model` y consulta `/tasks/:id`.
3. Progreso del proveedor, descarga del GLB, validación y guardado en el navegador.
4. Clave privada exclusivamente del servidor. No aparece en JavaScript, UI, respuestas ni documentación.
5. Token firmado con caducidad para consultar la tarea. La URL firmada del proveedor tampoco se devuelve a la UI.
6. Idempotencia de la sesión local y máximo tres envíos por proceso. Los fallos ambiguos no reenvían una operación que pueda consumir créditos.
7. Token/tarea persistidos por solicitud y huella de la foto para retomar una consulta sin generar de nuevo. Ninguna respuesta tardía se aplica a otra solicitud o foto.
8. Descarga HTTPS con dirección pública comprobada y fijada, sin redirecciones, credenciales ni destinos internos, y tamaño limitado.

No hay una clave/cuenta de Tripo configurada. El botón de creación desde fotos permanece desactivado con una explicación; importar un GLB funciona. **No se ejecutó ninguna reconstrucción real, ni se consumieron créditos.** Las pruebas del protocolo usan respuestas controladas y no son evidencia de calidad de la IA. Una única foto solo puede aproximar las caras ocultas.

Para una prueba local con cuenta y créditos se configuran `CARGOMESH_LOCAL_3D_ENABLED=true` y `TRIPO_API_KEY` de forma privada en el servidor y se reinicia. No pegar la clave en el chat ni guardarla en Git. El adaptador local acepta exclusivamente el host/origen `127.0.0.1:8080`; una copia desplegada no habilita un endpoint anónimo de generación.

## Vercel y Supabase

- El render se ejecuta en el navegador. Vercel sirve la aplicación y los modelos estáticos; no necesita ejecutar reconstrucción 3D pesada.
- Los planes gratuitos dependen de las cuotas vigentes, y la generación de IA depende además de créditos/licencia de su proveedor.
- La persistencia implementada aquí es **del navegador**, no de Supabase. Subir el código o el JSON de una solicitud no sube los Blob de IndexedDB.
- Para compartir modelos entre dispositivos, migrar los Blob a Supabase Storage y persistir la referencia del objeto en el registro autorizado. Fotos/modelos propios requieren bucket privado, RLS y URLs firmadas según organización/usuario; no hacerlos públicos por defecto.
- Para habilitar generación en Vercel faltan autenticación y ownership de tareas del servicio V2, cuota/idempotencia persistentes, descarga/almacenamiento duradero y validación live. El límite en memoria de la demo local no es una cuota distribuida.
- El modelo o la foto no confirman asignación, disponibilidad, capacidad ni ubicación operativa.

## Verificación y evidencia

- Suite pertinente: 29 pruebas. Incluye presupuesto/liberación de recursos, GLB real, rechazo de externos/archivos corruptos, compatibilidad de solicitudes, origen/capacidad del adaptador, idempotencia y reanudación sin doble envío.
- Compilación de producción con lint/tipos y comprobación de arquitectura.
- Navegador: importación del GLB real del proyecto en SOL-0007, giro con teclado, recuperación tras recarga y conservación al intentar importar un archivo inválido.
- Móvil 390×844: `scrollWidth=375`, controles accesibles y cámara actualizada con flechas. El gesto táctil físico queda para QA en dispositivo.
- Las pruebas locales se hicieron en una solicitud auxiliar. Se restaura su preferencia inicial articulada y la selección del navegador de prueba. La solicitud del usuario y la selección de Opera se conservan.
- Evidencia: `D:/Documents/hackaton 2/cargomesh-v2-truck-models-20261008/` (`tests.log`, `build-final.log`, `imported-route.png`, `imported-after-reload.png`, `imported-mobile.png` y vista final).

Referencias: [Tripo JS SDK oficial](https://github.com/VAST-AI-Research/tripo-js-sdk), [Vercel Hobby](https://vercel.com/docs/plans/hobby), [Supabase Pricing](https://supabase.com/pricing), [Supabase Storage](https://supabase.com/docs/guides/storage/buckets/fundamentals), [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html).

## Comentario para el líder

Se mejoró el catálogo 3D del coordinador y se agregó importación GLB por solicitud con vista 360°, guardado local y validación de archivos. Las siete solicitudes y sus formatos previos se mantienen compatibles. El flujo de reconstrucción desde fotos está preparado con Tripo y envío explícito, pero permanece desactivado hasta configurar una cuenta con créditos y validar una generación real. La publicación con Supabase/Vercel requiere trasladar los modelos del navegador a Storage y conectar la generación al control de acceso V2. La entrega continúa local; no se hizo merge ni despliegue.
