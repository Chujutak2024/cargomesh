# HAC-43 — cinco arquitecturas nuevas de sedes

Entrega de Juan, 19-oct-2026. **Referencias visuales / SIMULATED**: no registra sedes empresariales ni acredita cobertura, capacidad, ocupación o disponibilidad.

## Rama y coordinación

- Rama de entrega: `codex/v2-full-carrier-operations`.
- Destino exclusivo de integración: `codex/unified-workspaces-demo-boundary`; nunca `main`.
- Base compartida consultada e incorporada: `03463f8ab52c1fbe0d82428299c0dcdbaa46be70`.
- Merge de coordinación previo al cambio: `007396b665c65e64d18d3eb4548d39f084ce4462`.
- Antes de publicar se cotejaron de nuevo ambos heads remotos: base `03463f8`, feature `b71dcf6`, sin avances concurrentes.
- No se abre/reabre el PR #128 ya integrado por el equipo. Esta ampliación queda disponible para la integración del responsable. Sin merge a main ni cambios de despliegue.

## Catálogo: diez sedes, veintitrés camiones

| Diseño nuevo / ID | Diferencia física |
|---|---|
| Centro de distribución / `cross-dock` | Seis muelles en fachadas opuestas, nave con cubierta de dientes de sierra, entrepiso/clasificación y control de dos niveles. |
| Patio de transporte / `service-yard` | Estacionamientos cubiertos separados, administración independiente, taller de tres puestos con fosas, elevadores y herramientas. |
| Sede refrigerada / `cold-campus` | Tres cámaras aisladas con puertas interiores, muelles con abrigos cerrados, planta frigorífica y ventiladores/tuberías de cubierta. |
| Terminal a granel / `silo-terminal` | Seis silos elevados con conos de descarga, escaleras, puente transportador, torre y marquesina de ensacado. |
| Base urbana / `urban-courtyard` | Edificio en L, oficinas de dos niveles con escalera, terraza verde y patio de distribución compacto. |

Los cinco originales (`compact`, `distribution`, `cold`, `workshop`, `transfer`) mantienen exactamente sus geometrías; una prueba congela sus hashes SHA-256. Los diez diseños se distinguen también con un solo color. El catálogo de 23 camiones no cambia.

Se reutilizan Three.js, materiales, agrupación de geometría, controles y guion de cinco vehículos. Se mantiene el acceso al muelle 02 para ese guion ilustrativo. No se incorporan dependencias, modelos remotos ni texturas descargadas.

## Estado, encuadre y fallos

- El coordinador, fuera del canvas, conserva selección, reloj, pausa, plantilla e interior. Ahora conserva también posición/objetivo/zoom de cámara y si el usuario la controla manualmente.
- Guardar la cámara no publica renders React por frame. Se guarda antes del desmontaje diferido de R3F para evitar que una escena vieja sobrescriba la restaurada.
- La vista general calcula el encuadre desde los límites reales del edificio y vial, incluyendo los silos altos; el usuario conserva órbita, zoom y controles de interior.
- Los contadores del estudio y enlace de flota derivan de los catálogos. Selector con diez opciones; nueva pestaña identificada como **Depot designs**.
- La carga se asocia a la plantilla actual. Pérdida WebGL muestra lista HTML y reintento; Retry restaura cámara, selección, reloj y pausa.
- El guion y los diseños no consultan APIs empresariales. No se alteran autenticación, rutas, contratos, desplegables empresariales o consultas Supabase.

## Verificación ejecutada

Ejecutados en `cargomesh/` con las dependencias ya instaladas:

```powershell
node -e "require('node:child_process').execSync(require('./package.json').scripts['test:logistics'],{stdio:'inherit'})"
node -e "require('node:child_process').execSync(require('./package.json').scripts['test:connected-fleet'],{stdio:'inherit'})"
node node_modules/typescript/bin/tsc --noEmit --incremental false
node scripts/check-architecture.mjs
node node_modules/next/dist/bin/next build
```

| Gate | Resultado |
|---|---|
| Logística | **143/143 PASS**; incluye geometrías originales, diez diseños distintos en monocromo, estructuras reales, acceso al muelle, encuadre escritorio/móvil y disposal de geometría/material/textura compartida exactamente una vez. |
| Flota conectada | **45/45 PASS** después de actualizar una expectativa obsoleta del menú de la base a `Commercial`. No cambió el menú. |
| TypeScript | PASS. Se eliminó el import duplicado de `truckDesigns` producido por la combinación de cambios del enlace de flota. |
| Arquitectura | PASS: 591 módulos y 176 entradas cliente. |
| Build Next.js | PASS, compilación, tipos y generación de páginas. |
| Navegador: diseños | **12 comprobaciones PASS**: cinco diseños × escritorio/móvil, ciclos de catálogo y fallo/reintento. Carga observada, cero errores JS y cero peticiones API/externas. |
| Navegador: continuidad | **7 comprobaciones PASS**: tres cambios de pestaña y dos ciclos del diálogo real conservan reloj, selección, pausa y cámara; reanudar avanza; cerrar diálogo conserva el estudio. |

Navegador Chromium 156 / ANGLE RTX 2060, DPR 1; escritorio 1440×1100, móvil emulado 390×844. Capturas de arquitectura con hora de equipo fijada a mediodía para legibilidad, no cambio del reloj del producto.

Dos ciclos completos de las diez sedes vuelven a **208 geometrías / 9 texturas** en `cross-dock`, sin crecimiento observado. Es un contador de recursos WebGL, no una medición de VRAM ni una promesa de FPS. La prueba induce pérdida real de contexto y verifica el estado tras Retry.

La continuidad se reproduce con el script versionado y una instalación existente de Playwright:

```powershell
$env:CARGOMESH_PLAYWRIGHT_MODULE = '<ruta absoluta a playwright/index.mjs>'
$env:CARGOMESH_CHROMIUM_EXECUTABLE = '<ruta absoluta a chrome.exe>'
$env:CARGOMESH_PREVIEW_URL = 'http://127.0.0.1:8091'
$env:CARGOMESH_EVIDENCE_DIR = '<carpeta local para evidencia>'
node scripts/verify-depot-preview.mjs
```

## Preview y revisión visual

Desde `cargomesh/`:

```powershell
node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 8091
```

Abrir [estudio público local](http://127.0.0.1:8091/vehicle-designs) → **Depot designs** → selector **Depot design**. Elegir las cinco nuevas arquitecturas. [depot-preview](http://127.0.0.1:8091/depot-preview) conserva el guion de desarrollo; no es una ruta pública de producción. El puerto 8080 mantiene el runtime anterior, no acredita esta entrega.

Para inspeccionar los interiores: **Interior**, órbita y zoom. Para retención: seleccionar C, pausar, mover/zoom de cámara, cambiar a Truck designs y volver a Depot designs. El reloj, vehículo y cámara deben ser los mismos. Repetir en Summary/Depot del diálogo de inspección. Para fallos: perder contexto WebGL desde DevTools, comprobar lista de cinco vehículos y pulsar Retry.

### Evidencia saneada

- [Cinco arquitecturas, render real](evidence/HAC43-five-depots-2026-10-19/five-new-depots.png).
- [Base urbana en móvil](evidence/HAC43-five-depots-2026-10-19/urban-courtyard-390.png).
- [Diseños, encuadre, carga, recursos y reintento](evidence/HAC43-five-depots-2026-10-19/browser-results.json).
- [Estado y cámara entre vistas](evidence/HAC43-five-depots-2026-10-19/retained-state.json).

## Archivos y solapamientos

Rutas relativas al repositorio:

- `cargomesh/src/features/logistics-3d/depot-templates.ts`: catálogo de diez.
- `cargomesh/src/features/logistics-3d/depot-model.ts`: cinco arquitecturas nuevas; cinco originales intactas.
- `cargomesh/src/features/logistics-3d/depot-camera.ts` (nuevo): estado y encuadre.
- `cargomesh/src/features/logistics-3d/depot-coordinator.ts`: cámara retenida fuera del canvas.
- `cargomesh/src/features/logistics-3d/depot-yard-scene.tsx`: restauración/captura de cámara, encuadre y métricas.
- `cargomesh/src/features/logistics-3d/depot-arrival.tsx`: selector/conteo/carga/reintento.
- `cargomesh/src/features/logistics-3d/depot-preview.tsx`: pestaña de sedes y contador desde catálogo; vista inicial del patio nuevo.
- `cargomesh/src/features/logistics-3d/{depot-model,depot-coordinator,visual-catalog}.test.ts`: pruebas de modelos, estado, límites y recursos.
- `cargomesh/scripts/verify-depot-preview.mjs`: comprobación de cámara en las pruebas de continuidad existentes y selector del diálogo bilingüe conservado de la sincronización.
- `cargomesh/src/features/carrier-portal/fleet-workspace.tsx`: **único solapamiento de UI de flota**, import del catálogo de sedes/conteo y eliminación del import duplicado. Conservadas las fichas compartidas del equipo.
- `cargomesh/src/features/carrier-portal/carrier-workspace-model.test.ts`: expectativa alineada con el menú Commercial ya existente en la base; ningún cambio de navegación.
- Este informe y cuatro archivos de evidencia.

`truck-inspection.tsx` y las fichas compartidas no se modificaron para esta ampliación. Ningún cambio en migraciones, endpoints, configuración, credenciales, dependencias ni registros Supabase.

## Pendiente independiente

La configuración privada de Supabase V2 aún no se recibió. Faltan `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`; solo se necesitan para frontend/login, no administración de base. El último mensaje reenviado no incluye un archivo ni su ruta. Esta entrega visual no acredita login, datos empresariales compartidos ni conectividad alojada; no usa datos de otro proyecto.
