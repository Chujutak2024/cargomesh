# CargoMesh V2 — ejecución local conectada

Los avances de interfaz se publicaron en `main` mediante `a8a8044` y `9d0c3ee`. La corrección del 11 de octubre parte de `main` @ `21992a2` y hace reproducible el panel en otros navegadores y puertos. La aplicación Next.js reside en `cargomesh/`.

En una copia nueva, desde `cargomesh/`, ejecuta `pnpm install --frozen-lockfile` y `pnpm dev`. Configura únicamente las variables que necesites tomando `.env.example` como referencia. La portada funciona sin servicios remotos; los mapas requieren la configuración de Google Maps y las operaciones del servicio requieren una sesión autorizada.

## Comparar la misma pantalla con el equipo

El panel de las capturas corresponde a **`/v2-workspace#/dashboard`**, y su flota a **`/v2-workspace#/fleet`**. **`/carrier-portal` muestra el portal operativo del transportista**, con sesión y permisos propios; abrirlo no es una comparación del panel de coordinación.

Para el servidor del equipo en el puerto 3907, desde `cargomesh/`:

```sh
pnpm install --frozen-lockfile
pnpm exec next dev --hostname 127.0.0.1 --port 3907
```

Abre `http://127.0.0.1:3907/v2-workspace#/dashboard`. En un navegador nuevo aparecerán siete solicitudes, los gráficos de carga y el camión 3D. Selecciona `SOL-0004` para comparar la captura Ciudad de México → Monterrey: 18,000 kg, 24 × 750 kg y revisión 4/5. El total inicial de las siete cargas es 74,600 kg. La selección y las ediciones se conservan en ese navegador; los porcentajes animados pueden variar mientras avanza el recorrido.

Si utilizas `next start`, ejecuta primero `pnpm build` y reinicia el servidor: un pull no actualiza una compilación que ya está ejecutándose. Puedes contrastar la revisión con `git rev-parse HEAD` y los cambios pendientes con `git status --short`.

### Salidas de compilación locales

Next dev usa `.next-dev/` y build/start usan `.next/`. Así un preview de desarrollo no sobrescribe los assets de un servidor de producción local. No reconstruyas `.next/` mientras un `next start` de otra revisión siga sirviendo esa misma carpeta: usa un runtime independiente o reinícialo coordinadamente con el build correspondiente. La reparación del 17 de octubre separó el panel estable de 8080/8083 y el preview Three.js de 8091; detalles en `docs/v2-amazon/delivery/friction-logs/HAC43_DEPOT_PREVIEW_ENVIRONMENT_2026-10-17.md`.

## Abrir después de reiniciar Windows

Ejecuta `Start-CargoMeshV2.ps1`, o el acceso **Abrir CargoMesh V2 conectado** situado junto a las carpetas locales. El acceso inicia el servidor y espera su respuesta antes de abrir la página. Un enlace HTTP por sí solo no inicia un servidor después de apagar la PC.

- Entrada con camión animado: `http://127.0.0.1:8080/`
- Coordinador actual, con camión 3D: `http://127.0.0.1:8080/v2-workspace#/dashboard`
- Transportista actual: `http://127.0.0.1:8080/carrier-portal`
- Alias 8083: `/v2-workspace` redirige al coordinador actual en 8080, conservando el fragmento de navegación.
- El puerto 8080 sirve **esta copia nueva**, no la UI anterior. El origen conserva el almacenamiento del navegador y la restricción existente de Google Maps. La copia HAC-15 se conserva en disco y no es la aplicación de trabajo.

El lanzador usa Node.js 22+ y Next ya instalado; escucha únicamente en `127.0.0.1`. Abre la entrada por defecto; `-View dashboard` y `-View carrier` permiten otros destinos. Usa el último build cuando existe. Después de editar, reconstruye con el script `build` del package.json, o inicia `dev` manualmente. No instala servicios, tareas programadas ni software. Los logs quedan en `%LOCALAPPDATA%/CargoMeshV2Local`.

## Datos y permisos

Por autorización expresa del usuario del 8 de octubre, la pantalla actual recupera su solicitud local anterior. Comparte un único estado local entre Panel, Solicitudes, Revisión y Ruta; permite editar carga, ciudades, fechas, camión y foto. Guarda una copia original y los cambios en las mismas claves versionadas del navegador. Solo el origen histórico `http://127.0.0.1:8080` utiliza el puente de recuperación de 8083. Otros puertos y los orígenes HTTPS usan exclusivamente su propio almacenamiento y no intentan contactar el equipo local.

En cualquier origen, los datos ya guardados tienen prioridad. Solo la ausencia de datos inicializa la solicitud Callao → Piura y las otras seis cargas de presentación incluidas en el código; ningún registro malformado se sustituye automáticamente. Esta inicialización permite reproducir la demo del frontend sin subir datos privados del navegador a GitHub. No escribe en Supabase ni registra solicitudes empresariales. Los cambios personales entre equipos requieren una transferencia explícita; Git no sincroniza localStorage.

**Una solicitud guardada en el navegador no es un FreightRequestV2 persistido**: no tiene UUID del servicio, versión empresarial, cobertura, reserva ni candidato carrier ficticio. Las ciudades son referencias y las fechas aún no son ventanas horarias. Las vistas del servicio consultan la API V2 con la sesión del usuario; su creación reutiliza HAC-14 sin convertir automáticamente datos locales en registros. Los antiguos botones para elegir el origen de datos se retiraron de la interfaz. Sin sesión, la API responde 401. Las mutaciones conservan permisos, idempotencia y versión esperada.

El portal del transportista usa el descubrimiento de identidad y permisos incorporado en HAC-45. La referencia del carrier debe corresponder a un registro autorizado; un formulario o el estado de presentación del coordinador no conceden acceso al servicio.

Las claves locales de Google Maps no se incluyen en Git ni en este documento. La ausencia de mapa o de geometría no se oculta con líneas rectas ni con un proveedor distinto presentado como Google.

## Dependencias de esta máquina

El `node_modules` está vinculado al stage de dependencias aislado de la corrección visual del 8 de octubre. pnpm rechaza esa disposición antes de ejecutar scripts (`ERR_PNPM_UNSAFE_MODULES_DIR`). La verificación usa los binarios instalados. En un checkout normal, instala las dependencias mediante el lockfile de la base. No elimines el vínculo recursivamente.

Docker/Supabase local no están disponibles en esta máquina. No se aplicaron migraciones remotas. El informe distingue pruebas de contrato, capturas sintéticas y evidencia de persistencia real.
