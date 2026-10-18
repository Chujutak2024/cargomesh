# HAC-43 — entrega para revisión, 18 de octubre de 2026

## Rama y alcance

- Rama: `codex/v2-full-carrier-operations`.
- Base de origen y target del PR en borrador: `codex/unified-workspaces-demo-boundary` @ `0e6986c057c9bcec75be792e9b56f193268e182b`.
- La instrucción expresa del usuario para esta entrega prevalece sobre el target genérico de las instrucciones del repositorio. No se integra ni publica en `main`.
- El PR registra el SHA exacto de la entrega y los enlaces permanentes a su evidencia. Este documento y los artefactos se versionan junto al código verificado.

El incremento contiene una sede con cinco camiones coordinados fuera del canvas: A carga y sale, B espera y ocupa el muelle después de A, C permanece estacionado/reservado, D sale cargado y E permanece en mantenimiento. Reloj, selección, pausa y eventos pertenecen al coordinador conservado sobre las vistas. Incluye el catálogo de 18 diseños sobre diez familias existentes, cinco plantillas de sede y el recorrido escénico original del trabajo local pendiente.

**Es una simulación identificada**, con fuente `SIMULATED` y escenario `depot-five-trucks-v1`. No consulta ni escribe Supabase, no demuestra presencia/capacidad real y no representa GPS ni geometría de Google. Las seis fichas adicionales pertenecen exclusivamente a la presentación local; los registros guardados por el usuario tienen precedencia al combinarse con los defaults. El lector de flota conectada no recibe estos fixtures.

Los informes del 17 de octubre describen cortes previos; sus conteos y notas «sin commit/push» son históricos. Este informe registra la verificación de la entrega actual. No cierra el DoD integral de operación conectada de HAC-43.

## Preview reproducible

Desde un checkout de la rama/commit del PR, con Node >= 22 y las dependencias del lockfile instaladas:

```powershell
cd cargomesh
pnpm install --frozen-lockfile
node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 8091
```

- QA de la sede: <http://127.0.0.1:8091/depot-preview>. Comienza en Yard; muestra simultáneamente las cinco identidades en escena/lista. Con reduced motion comienza pausado; usar Resume visualization.
- Catálogo/presentación: <http://127.0.0.1:8091/vehicle-designs>. Elegir Yard para ver la misma sede o Truck designs para consultar los 18 diseños.
- `/depot-preview` se limita al modo development y responde 404 en producción. `/vehicle-designs` es una presentación pública, sin datos empresariales.
- Dev utiliza `.next-dev`; build/start utiliza `.next`, evitando que la compilación reemplace los chunks del servidor de desarrollo.
- El preview sintético no necesita credenciales. El portal conectado mantiene su autenticación y requiere la configuración privada de Supabase habitual. Este entorno carece de URL/anon de Supabase: no se certificó una sesión conectada real ni se añadió un bypass.

No hay un despliegue nuevo como parte de esta entrega. El proceso local anterior de 8080 se conserva y no se usa como evidencia del código de esta rama. Para comparar los nuevos diseños debe usarse 8091 iniciado desde este checkout.

## Verificación ejecutada sobre el código de esta entrega

Desde `cargomesh/`:

```powershell
node -e "require('node:child_process').execSync(require('./package.json').scripts['test:logistics'],{stdio:'inherit'})"
node -e "require('node:child_process').execSync(require('./package.json').scripts['test:connected-fleet'],{stdio:'inherit'})"
node -e "require('node:child_process').execSync(require('./package.json').scripts['test:workspace-modes'],{stdio:'inherit'})"
node -e "require('node:child_process').execSync(require('./package.json').scripts['test:road-routing'],{stdio:'inherit'})"
node node_modules/typescript/bin/tsc --noEmit --incremental false
node scripts/check-architecture.mjs
node node_modules/next/dist/bin/next build
```

| Comprobación | Resultado del 18-oct |
|---|---|
| Logística, coordinador, catálogo y demo local | 136/136 PASS |
| Flota conectada | 45/45 PASS |
| Límites de demo y rutas de workspace | 28/28 PASS |
| Enrutamiento por carretera | 39/39 PASS |
| TypeScript | PASS |
| Arquitectura | PASS: 410 módulos / 112 entradas cliente |
| Build Next.js | PASS |
| Navegador, persistencia real al desmontar vistas | 8 comprobaciones PASS; sin errores no capturados ni solicitudes empresariales/externas |

Los conteos corresponden a cada comando, con posible cobertura compartida; no se presentan como un total de tests únicos. [Logs y resultados](./evidence/HAC43-2026-10-18/) se incluyen con la entrega.

### Prueba de continuidad entre vistas

`cargomesh/scripts/verify-depot-preview.mjs` abre Chromium en un contexto nuevo, sin cookies ni almacenamiento del usuario. Bloquea y registra intentos a `/api/**` o hosts externos. Usa Playwright ya instalado; no instala paquetes ni modifica las dependencias del producto.

```powershell
# Servidor de preview iniciado en otra terminal.
# Si Playwright no está en la resolución de módulos, indicar su index.mjs existente.
$env:CARGOMESH_PLAYWRIGHT_MODULE = '<ruta absoluta a playwright/index.mjs>'
# Solo si se usa un Chromium instalado fuera del cache esperado por Playwright:
$env:CARGOMESH_CHROMIUM_EXECUTABLE = '<ruta absoluta a chrome.exe>'
$env:CARGOMESH_PREVIEW_URL = 'http://127.0.0.1:8091'
$env:CARGOMESH_EVIDENCE_DIR = '../.planning/depot-browser-evidence'
node scripts/verify-depot-preview.mjs

# Para repetir la grabación: FFmpeg existente con encoder libvpx-vp9.
$env:CARGOMESH_FFMPEG_EXECUTABLE = '<ruta absoluta a ffmpeg>'
node scripts/verify-depot-preview.mjs --record
```

La prueba selecciona C, avanza el reloj y pausa. Compara los mismos valores antes y después de Yard → Scenario summary → Yard, Yard → Truck designs → Yard y Yard → Scenic trip → Yard: **826 ms / visual-truck-c / paused=true** en esta ejecución. Tras reanudar, el reloj avanza a **1391 ms** conservando C. El diálogo compartido real de inspección conserva **832 ms / C / pausa** durante dos ciclos Summary ↔ Depot; cerrarlo conserva los **1391 ms / C / pausa** del estudio independiente. Los valores temporales varían entre ejecuciones; las igualdades antes/después son las aserciones.

El caso Scenic trip usa C sin viaje asignado y verifica su estado vacío; no prueba navegación geográfica conectada. La suite del coordinador recorre además el ciclo completo de 90 s sin doble ocupación, con C/E inmóviles, eventos deduplicados y carga conservada al salir.

## Video y capturas

- [Video del escenario y cambios de vista](./evidence/HAC43-2026-10-18/five-trucks.webm): **40.07 s**, WebM/VP9, 1440×1100, 15 fps de captura, sin audio. La frecuencia de captura no es una medición de FPS de la aplicación.
- [Inicio con los cinco camiones](./evidence/HAC43-2026-10-18/five-trucks.png).
- [Diálogo con estado conservado](./evidence/HAC43-2026-10-18/inspection-retained.png).
- [Carga y salida](./evidence/HAC43-2026-10-18/loading-to-departure.png).
- [Resultado estructurado del navegador](./evidence/HAC43-2026-10-18/browser-results.json).

La grabación observa tiempo natural, sin inyectar reloj ni velocidad. Incluye los cambios de vista y los primeros 23.535 s del escenario: A pasa de cargar a salir, D sale cargado, B espera, C/E permanecen. No muestra el ciclo completo de carga de B; ese ciclo está cubierto por la prueba determinista de 90 s.

Navegador: Chromium 156.0.8078.4, ANGLE/RTX 2060/D3D11, DPR 1. El resultado registra geometrías, texturas y draw calls del último frame; no es una garantía de rendimiento en otros equipos. Se usó captura CDP y FFmpeg existente por una incompatibilidad de revisiones del grabador nativo; véase el friction log de esta fecha.

## Solapamientos para quien integra la presentación restaurada

La otra restauración local indicada por el usuario **no está disponible como diff en este checkout**. Se identifican superficies de solapamiento por los archivos de esta entrega, sin afirmar que se hayan comparado líneas contra ese trabajo. El usuario realizará la integración conservando su presentación.

| Archivo o grupo | Delta de esta entrega y criterio de integración |
|---|---|
| `carrier-portal/fleet-workspace.tsx` | Solo añade el enlace al estudio sobre las ramas existentes. Conservar la presentación restaurada, el parser de rutas, el desplegable y la separación conectado/demo; trasladar únicamente el enlace si corresponde. |
| `carrier-portal/truck-inspection.tsx` | Añade un coordinador `useState(createDepotCoordinator)` sobre las vistas, lo pasa a DepotArrival y añade enlace al estudio. Conservar las fichas, datos, mapa y acciones restauradas; portar la propiedad del coordinador sin reemplazar su UI. |
| `carrier-portal/fleet-model.ts`, `fleet-local-additions.ts`, `use-operations.ts` y tests | Seis defaults de demo local y combinación por ID/código/placa sin duplicados ni reescritura del almacenamiento. Mantenerlos fuera del lector conectado y conservar los registros reales del backend. |
| `logistics-3d/logistics-truck.tsx`, `truck-model.ts`, `truck-scene.tsx` | Props opcionales de diseño/acabados, conservando defaults existentes. Revisar usos de las fichas compartidas al integrar; no cambia el contrato empresarial de equipo/capacidad. |
| `logistics-3d/depot-arrival.tsx` y nuevos archivos `depot-*` | Sede de cinco vehículos y coordinador externo. Los nuevos módulos contienen la lógica principal; no deben reemplazar las fichas restauradas de flota. |

`truck-inspection-model.ts`, estilos y componentes de fichas existentes fuera de los archivos listados, schemas V2, autenticación, lectores de servicio, API/server, migraciones y claves **no cambian**. Solo cambia su archivo de test donde el número de registros de demo pasa a 18. El recorrido Google existente se conserva; el nuevo circuito escénico no consume su geometría.

Se entrega PR en borrador para revisar estas superficies. No se hace merge, cherry-pick de la restauración ajena ni cambio de base.
