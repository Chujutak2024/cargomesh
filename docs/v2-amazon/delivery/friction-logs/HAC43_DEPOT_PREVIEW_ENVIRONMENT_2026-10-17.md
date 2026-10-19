# HAC-43 — preview visual independiente del entorno conectado

17-oct-2026. Base `0e6986c`, rama `codex/v2-full-carrier-operations`.

## Fallo observado

El proceso Next dev iniciado en 8091 no encuentra `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`. `/v2-workspace?demo=1` falla al construir el cliente de servidor antes de renderizar el portal. No se imprimieron valores privados ni se alteró configuración para resolverlo.

## Resolución para este corte

Se añadió `/depot-preview`, solo development, con fixtures de presentación explícitos y sin llamadas de negocio. Permite verificar DepotArrival y el diálogo real TruckInspection sin cambiar autenticación, grants o Supabase. La ruta devuelve notFound en producción. El backend conectado no se certifica mediante este preview.

## Estado

Visor, lista, navegación entre vistas, reduced motion, reintento WebGL y recursos probados en preview. Para verificar la pantalla conectada se requiere el entorno privado correcto del responsable y la futura proyección autorizada de presencia; no se fabrica una identidad ni se hace fallback silencioso a fixtures desde un error del servicio.

## Regresión posterior: panel sin CSS por salida compartida

Tras iniciar Next dev/build en el checkout donde seguían abiertos next start de 8080/8083, se sobrescribió `.next`. Los procesos antiguos devolvían HTML con assets de su compilación anterior: cinco CSS y chunks JS respondían HTTP 400. El navegador reprodujo el panel sin estilos.

Corrección del entorno local:

- `next.config.ts` separa `.next-dev` en development y `.next` en producción; salida dev excluida de Git. TypeScript incluye ambos directorios de tipos generados por Next.
- Se reconstruyó el runtime estable 9d5f681 fuera del checkout activo y se comprobó antes de sustituir los dos procesos antiguos. Se sirven 8080/8083 desde esa copia local independiente, conservando orígenes y almacenamiento del navegador. El código nuevo permanece en la rama de Juan y en 8091; no hubo checkout a una versión antigua ni cambios de backend/auth/credenciales.
- El primer build del runtime en C: falló porque las dependencias enlazadas viven en D: y Webpack produjo rutas entre volúmenes no válidas. La reconstrucción en D:, junto al volumen de dependencias, pasó. No se reinstalaron paquetes ni se copió la clave al repositorio.
- Smoke HTTP después de la restauración: 24 CSS/JS HTTP 200 para cada panel 8080/8083; ocho CSS/JS HTTP 200 para el preview 8091. Recarga de navegador sin caché HTTP, cinco hojas de estilos, sin assets estáticos fallidos; captura del panel conservada localmente.

Los paths/PIDs/comando de arranque del runtime estable son evidencia local en la bóveda; no son otro entorno compartido ni un despliegue. La corrección no reinterpreta el panel estable de presentación como portal conectado V2.

## Catalog template resource ownership — 17 Oct
Browser sampling exposed growth from199 to1341 geometries and9 to39 textures after template/design changes. Cause: effect-driven setWorld disposed the old primitives while React still rendered them, triggering re-upload. World creation now uses memoization; passive cleanup releases resources after the old primitives are removed. Two full compact/distribution/cold/workshop/transfer cycles return to191–193 geometries and9 textures per corresponding template in the paused interior sample. TypeScript/build and 134 logistics tests pass; screenshot/evidence remain local. No shared asset cache was disposed.
