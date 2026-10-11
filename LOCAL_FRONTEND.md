# CargoMesh V2 — ejecución local conectada

Los avances de interfaz se desarrollaron desde `50c12d115dd9b2171d9375acd215593de29e8f34` y se integran con `origin/main` para su publicación por autorización del usuario del 10 de octubre de 2026. La aplicación Next.js reside en `cargomesh/`.

En una copia nueva, desde `cargomesh/`, ejecuta `pnpm install --frozen-lockfile` y `pnpm dev`. Configura únicamente las variables que necesites tomando `.env.example` como referencia. La portada funciona sin servicios remotos; los mapas requieren la configuración de Google Maps y las operaciones del servicio requieren una sesión autorizada.

## Abrir después de reiniciar Windows

Ejecuta `Start-CargoMeshV2.ps1`, o el acceso **Abrir CargoMesh V2 conectado** situado junto a las carpetas locales. El acceso inicia el servidor y espera su respuesta antes de abrir la página. Un enlace HTTP por sí solo no inicia un servidor después de apagar la PC.

- Entrada con camión animado: `http://127.0.0.1:8080/`
- Coordinador actual, con camión 3D: `http://127.0.0.1:8080/v2-workspace#/dashboard`
- Transportista actual: `http://127.0.0.1:8080/carrier-portal`
- Alias 8083: `/v2-workspace` redirige al coordinador actual en 8080, conservando el fragmento de navegación.
- El puerto 8080 sirve **esta copia nueva**, no la UI anterior. El origen conserva el almacenamiento del navegador y la restricción existente de Google Maps. La copia HAC-15 se conserva en disco y no es la aplicación de trabajo.

El lanzador usa Node.js 22+ y Next ya instalado; escucha únicamente en `127.0.0.1`. Abre la entrada por defecto; `-View dashboard` y `-View carrier` permiten otros destinos. Usa el último build cuando existe. Después de editar, reconstruye con el script `build` del package.json, o inicia `dev` manualmente. No instala servicios, tareas programadas ni software. Los logs quedan en `%LOCALAPPDATA%/CargoMeshV2Local`.

## Datos y permisos

Por autorización expresa del usuario del 8 de octubre, la pantalla actual recupera su borrador local anterior. Comparte un único estado local entre Panel, Solicitud local, Solicitudes, Revisión y Ruta; permite editar carga, ciudades, fechas, camión y foto. Guarda una copia original y los cambios en claves versionadas del mismo navegador. Recupera primero cualquier borrador ya editado en 8083 y después el borrador anterior de 8080. Las siguientes aperturas conservan el estado actual y no lo sobrescriben desde la copia anterior. Un navegador distinto puede importar el JSON mediante la sección de transferencia.

**Una solicitud guardada en el navegador no es un FreightRequestV2 persistido**: no tiene UUID del servicio, versión empresarial, cobertura, reserva ni candidato carrier ficticio. Las ciudades son referencias y las fechas aún no son ventanas horarias. Las vistas del servicio consultan la API V2 con la sesión del usuario; su creación reutiliza HAC-14 sin convertir automáticamente datos locales en registros. Los antiguos botones para elegir el origen de datos se retiraron de la interfaz. Sin sesión, la API responde 401. Las mutaciones conservan permisos, idempotencia y versión esperada.

La referencia del carrier debe corresponder a un registro autorizado. El formulario de referencia no crea carriers ni concede acceso. No existe todavía un endpoint de discovery del carrier de la sesión que permita sustituir esa entrada manual de manera verificada.

Las claves locales de Google Maps no se incluyen en Git ni en este documento. La ausencia de mapa o de geometría no se oculta con líneas rectas ni con un proveedor distinto presentado como Google.

## Dependencias de esta máquina

El `node_modules` está vinculado al stage de dependencias aislado de la corrección visual del 8 de octubre. pnpm rechaza esa disposición antes de ejecutar scripts (`ERR_PNPM_UNSAFE_MODULES_DIR`). La verificación usa los binarios instalados. En un checkout normal, instala las dependencias mediante el lockfile de la base. No elimines el vínculo recursivamente.

Docker/Supabase local no están disponibles en esta máquina. No se aplicaron migraciones remotas. El informe distingue pruebas de contrato, capturas sintéticas y evidencia de persistencia real.
