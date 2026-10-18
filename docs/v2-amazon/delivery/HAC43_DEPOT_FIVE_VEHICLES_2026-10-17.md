# HAC-43 — primer corte de sede con cinco vehículos

17-oct-2026. Implementación local de Juan sobre `0e6986c057c9bcec75be792e9b56f193268e182b` más cambios del working tree. No es una entrega alojada, catálogo real ni cierre de HAC-43.

## Registro vigente

| Responsable / issue | Rama registrada | Base autorizada | Target PR |
|---|---|---|---|
| Juan / HAC-43 | `codex/v2-full-carrier-operations` | `origin/codex/unified-workspaces-demo-boundary` @ `0e6986c` | `codex/unified-workspaces-demo-boundary` |

El usuario autorizó expresamente este registro y destino el 17 de octubre, antes de crear la rama. HAC-43 se actualizó a In Progress. Para este corte esa instrucción sustituye bases/targets históricos: **nunca main**. No se hizo commit, push, PR, merge o despliegue por esta implementación.

## Resultado

Una sede reutiliza el edificio, cinco familias de camión y el equipo de carga existentes. Todos los IDs y movimientos pertenecen a un escenario `SIMULATED` explícito, sin llamadas de negocio.

| Vehículo | Estado inicial | Comportamiento |
|---|---|---|
| A / articulated | Loading, BAY_02 | Finaliza carga a los 18 s, verifica y sale desde los 22 s; libera el recurso a los 40 s |
| B / refrigerated | Waiting | Espera la salida de A, entra a los 44 s, ocupa BAY_02 a los 54 s y carga desde los 68 s |
| C / rigid | Parked / Reserved | Permanece estacionado sin tarea de carga |
| D / flatbed | Departing | Sale con pallets explícitos, conserva visual-trip-d y queda fuera del patio a los 8 s |
| E / tipper | Maintenance, BAY_03 | Permanece inmóvil y bloqueado |

La operación visual termina a los 90 s; no reinicia ni teletransporta los vehículos a su posición inicial. A y D conservan carga en la salida. Un slot es coherencia del dibujo, no una reserva backend.

## Estado y presentación

- `depot-coordinator.ts` es un coordinador puro fuera de Three/R3F: reloj, identidad, eventos deduplicados, proyección de actividades, exclusión de muelle, selección, interior y preferencia de reproducción.
- `truck-inspection.tsx` posee la instancia por encima de las vistas condicionales. Ir al resumen y volver a Sede conserva reloj, selección, interior y pausa. Seleccionar un camión dentro de Sede no reconstruye el edificio.
- El temporizador de `DepotArrival` avanza únicamente cuando la vista está visible, cargada y reproduciéndose. Las poses del renderer leen ese reloj; no actualizan React por vehículo/frame.
- Poses de patio propias, sin lat/lng ni consumo de Google Routes. assetId/siteId/tripId del escenario permanecen estables; no se promueven a IDs persistidos.
- Lista HTML accesible paralela, selección por teclado/clic, controles de cámara, interior, pausa y reintento. Toda interfaz nueva está en inglés. `unknown` no se coloca en patio y no se deduce presencia desde una base administrativa.
- Reduced motion inicia pausado; Resume requiere una acción expresa. El escenario no avanza oculto o desmontado. Los recursos propios se liberan; clones de payload comparten recursos únicamente durante la vida de esta escena y se separan antes de disponerlos.
- El estado es de la instancia abierta en memoria. Recargar o cerrar la inspección crea otra simulación. No hay persistencia de negocios en localStorage ni sincronización entre sesiones.

## Archivos

Dentro de `cargomesh/`:

- Nuevos: `src/features/logistics-3d/depot-coordinator.ts`, `.test.ts`, `depot-yard-pose.ts`, `depot-yard-scene.tsx`, `depot-preview.tsx`, `depot-preview.module.css`.
- Actualizados: `depot-arrival.tsx`, `depot.module.css` y el punto mínimo de integración `src/features/carrier-portal/truck-inspection.tsx`.
- `src/app/depot-preview/page.tsx`: entrada QA exclusivamente en development; en producción devuelve notFound.
- `package.json`: añade el test del coordinador a `test:logistics`; no cambia dependencias.

## Preview reproducible

Desde `cargomesh/`, con las dependencias ya instaladas:

```powershell
node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 8091
```

Abrir `http://127.0.0.1:8091/depot-preview`. Yard / Scenario summary desmonta la vista y conserva el coordinador. Open inspection dialog permite comprobar el componente real de inspección y su acción existente Ver sede 3D.

El portal conectado necesita sus variables privadas de Supabase. No se modificó identidad/configuración para sortear su ausencia en este proceso. Véase el friction log de este corte. El preview QA no expone ni consulta datos empresariales.

## Verificación ejecutada

| Requisito / caso | Resultado comprobado |
|---|---|
| Estados iniciales A/B/C/D/E | Test del coordinador: cinco fases distintas, C reservado, fuente SIMULATED |
| A libera / B ocupa | Proyección completa de 0–90 s en pasos de 250 ms, sin doble recurso; C/E inmóviles |
| Continuidad y carga de salida | Trayectorias finitas/continuas en pasos de 50 ms; A/D retienen pallets |
| Duplicados / mantenimiento / visitante | Duplicado idéntico deduplicado; ocupación conflictiva, movimiento de mantenimiento y visitante no autorizado rechazados |
| Vacío / ubicación desconocida | Colección vacía permitida; UNKNOWN no tiene pose visible; final no reinicia |
| Selección | Navegador: mismo depotInstance antes/después de seleccionar C |
| Cambio real de vista | Diálogo inspección: 925 ms antes/después de Summary ↔ Depot; selección C e interior conservados |
| Pérdida WebGL / Retry | Cinco filas HTML disponibles durante el fallo; reintento conserva 925 ms y selección |
| Reduced motion | Reloj 0 y frames 2→2 sin reproducción solicitada |
| Fuera de pantalla | Con canvas completamente fuera del viewport: 32750→32750 ms y 0 canvas montados; al volver continúa |
| Desmontajes repetidos | Tres remounts pausados: 32966 ms, 170 geometrías y 7 texturas en cada vista enfocada; no crecimiento observado en esta muestra |
| Móvil / escritorio | 390×844 y 1440×1100, sin overflow horizontal; reproducción ocupa una fila en móvil; cámara/techo y lista disponibles |

Comandos ejecutados desde `cargomesh/`:

```powershell
node node_modules/typescript/bin/tsc --noEmit --incremental false
node scripts/check-architecture.mjs
node -e "require('node:child_process').execSync(require('./package.json').scripts['test:logistics'],{stdio:'inherit'})"
node node_modules/next/dist/bin/next build
```

Tipos y arquitectura: PASS (403 módulos / 110 entradas cliente en este corte). Logística: **130/130 PASS**, incluidos seis nuevos tests del coordinador. Build Next: **PASS**, con `/depot-preview` compilado y guardado en `build.txt`. Detector Impeccable sobre los nuevos targets UI: `[]`.

Evidencia local excluida de Git: `.planning/2026-10-17-depot-fleet-threejs/`: `logistics-tests.txt`, `typecheck.txt`, `build.txt`, `design-detect.json`, capturas desktop/mobile y manifiesto SHA-256 del working tree. Los tests certifican este working tree, no solo el HEAD base sin estos archivos. No se presenta esta prueba técnica como validación de una persona ajena a la implementación.

## Medición del renderer

Windows, HeadlessChrome 155, ANGLE / NVIDIA GeForce RTX 2060 / Direct3D11, DPR 1, viewport 1440×1100, cinco vehículos, cámara general, exterior, frame pausado inicial. `renderer.info` del último frame completado: **384 draw calls, 397558 triángulos (incluye pases de sombra), 199 geometrías y 9 texturas**. Es una muestra de ese estado, no un máximo universal ni una medida de VRAM en bytes.

Los tres remounts comparables enfocados en C dieron 242 draw calls, 240300 triángulos, 170 geometrías y 7 texturas. La variación frente al encuadre general se debe al frustum/estado representado. No se publica una promesa de FPS. R3F todavía usa THREE.Clock, que emite una advertencia de deprecación con la versión instalada; no se actualizó la dependencia.

## Revisión del incremento

| Before | After | Why |
|---|---|---|
| Ciclo dentro de la escena de un camión | Coordinador de cinco vehículos sobre las vistas | Mantener identidad y tiempo al navegar |
| Selección ligada a reconstrucción de contexto | Foco de cámara sobre modelos ya montados | Evitar reiniciar las tareas al inspeccionar |
| Información disponible solo en el dibujo | Lista HTML con actividad, recurso y reserva | Acceso mediante teclado y durante fallo de WebGL |
| Tiempo de visualización y avance del camión unidos | Reloj visual explícito, pausado fuera de vista | No aparentar GPS ni acciones de negocio |

## Límites del primer corte

La sede es ilustrativa; no prueba ocupación, capacidad, citas, permisos, conservación refrigerada, GPS o disponibilidad real. No se conecta una proyección de presencia que el backend aún no ha entregado. Los catálogos de cinco templates / dieciocho variantes, varias llegadas y continuidad conectada Sede→Ruta siguen siendo cortes posteriores al incremento de una sede/cinco camiones solicitado por el usuario. No hubo cambios a backend, schemas V2, migraciones, seeds, Supabase, auth, claves, geografía Google o despliegue.
