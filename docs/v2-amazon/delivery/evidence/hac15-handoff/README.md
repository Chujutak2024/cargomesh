# HAC-15 — Evidencia local para el smoke conjunto

## Respuesta posterior a revisión independiente — 2 octubre 2026

[R-MAP-01/02/03, comandos frescos, límites y handoff](../../HAC15_REVIEW_RESPONSE_2026_10_02.md). Seguridad Leaflet: [JSON DOM](./review-2026-10-02-leaflet-dom.json), 18/18 PASS y capturas 31–36. Contrato real: [7 checks](./review-2026-10-02-contract-labels.json) con HAC-12 `3cf966f` / mapper Luis `226624e`. Suite 33/33, typecheck, arquitectura 238/30 y build PASS. R-MAP-02 sigue abierto: [plan truck/MTC](../../HAC15_TRUCK_PILOT_PLAN.md), sin consulta truck ni comparación de geometría ejecutadas. [Metadatos MTC](./review-2026-10-02-mtc-metadata.json) son preparación, no evidencia de ruta coincidente. Google live y sus fallos anteriores no se reejecutaron para esta corrección.

Las secciones siguientes conservan resultados históricos con sus snapshots; no acreditan nuevas ejecuciones ni sustituyen QA-13-20 integrado.

## Primera revisión contractual — 2 octubre 2026 (snapshot histórico)

[Contrato y correcciones actuales](../../HAC15_CONTRACT_REVIEW_2026_10_02.md). [Schemas/mapper reales: PASS 6 comprobaciones](./review-2026-10-02-contract.json) · [Interacción nueva: PASS 12/12 y consola sanitizada](./review-2026-10-02-interaction.json). Las evidencias anteriores siguen siendo históricas; en particular, **04 usa el fixture anterior unknown y no representa el negativo API corregido**.

| Captura nueva | Qué muestra |
| --- | --- |
| [23 — Google / SIMULATED](./23-contract-simulated-google-es.png) | Basemap Google y tres puntos de escenario expresamente simulados; sin consultas Routes. |
| [24 — Cero candidatos ineligible](./24-zero-candidates-ineligible-es.png) | Piura → Arequipa, selección null, sin opción elegible; dos pines, ninguna línea/métrica. |
| [25 — Enter / null preview](./25-keyboard-null-preview-es.png) | Selección B compartida, foco de 3 px, UNKNOWN sin traza. |
| [26 — Origen nulo](./26-null-origin-coordinates-es.png) | Sólo pin conocido del destino; sin geometría. |
| [27 — Ambos extremos nulos](./27-null-both-coordinates-es.png) | Estado vacío sin pins ni renderer. |
| [28 — Cero candidatos EN móvil](./28-zero-candidates-mobile-390-en.png) | Ineligible a 390×844, sin overflow horizontal. |
| [29 — Null EN móvil](./29-null-preview-mobile-390-en.png) | Selección por teclado, atribución y nota Google sin línea. |
| [30 — Null ES móvil](./30-null-preview-mobile-320-es.png) | Reflujo a 320×740, sin overflow horizontal. |

Datos: fixtures locales en `/hac15-preview`, habilitado sólo en `next dev`; no controller HAC-14, request persistido, API/DB ni smoke conjunto. Conditions del fixture: `[]`, sin clima/tráfico simulado. UNKNOWN con puntos es una entrada deliberadamente inválida, rechazada por Zod. No se reejecutaron las 19 comprobaciones históricas; se registraron 12 nuevas. No se indujo un nuevo fallo de proveedor.

## Evidencia histórica

Fecha: 1 octubre 2026. [Handoff a Luis](../../HAC15_HAC14_INTEGRATION_HANDOFF.md) · [PR #92](https://github.com/Chujutak2024/cargomesh/pull/92).

Código: `2c5cc8de7005b1cc5531296f64e56ba4920ebb49`, rama `feat/fe2-v2-route-map`. Navegador integrado de Codex; Next local en `127.0.0.1:3093`. Datos de contrato **fixtures**, sin integración del controller de HAC-14, API freight ni DB. No es una certificación QA-13-20 ni una prueba de routing para camión.

## Capturas reales

| Archivo | Evidencia | Límite |
| --- | --- | --- |
| [01 — Escritorio ES](./01-desktop-simulated-es.jpg) | Selección A, línea del fixture SIMULATED, atribución y nota OpenStreetMap | Medidas sintéticas 1 015 km / 18,5 h; no Google Routes. |
| [02 — Teclado / null](./02-keyboard-null-preview-es.jpg) | Enter en candidato B, foco visible, `UNKNOWN`, dos pines sin línea | Control padre de QA, no tarjetas reales de Luis. |
| [03 — Coordenadas ausentes](./03-no-coordinates-es.jpg) | Estado vacío y métricas no disponibles | No intenta geocodificar ni completar la ruta. |
| [04 — Cero candidatos](./04-zero-candidates-es.jpg) | Selección null y pines conocidos sin línea | Empty state de presentación; no valida el negativo API/tenant. |
| [05 — Proveedor no disponible](./05-provider-unavailable-es.jpg) | Guard al pasar del fallback a fuente Google declarada | Fuente fixture `UNKNOWN/legs:[]`; no se ejecutó Google Routes. |
| [06 — Escritorio EN](./06-desktop-simulated-en.jpg) | UI/nota en inglés, selección preservada | Labels de sedes/carriers son valores del fixture. |
| [07 — Móvil 390 px EN](./07-mobile-390-en.jpg) | Layout apilado, interacción A/B, datos debajo del mapa | Viewport responsive; no dispositivo físico. |
| [08 — Móvil 320 px ES](./08-mobile-320-es.jpg) | Reflujo sin overflow horizontal y cambio de idioma | No prueba lector de pantalla. |
| [09 — Workspace local](./09-workspace-local-tracking-es.jpg) | Draft de navegador, candidato sin transportista, SIMULATED y cobertura UNKNOWN | Sin GPS, dispatch, oferta, persistencia V2 ni ETA medida. |
| [10 — Google Maps / workspace](./10-google-workspace-8080-es.jpg) | Google Maps JavaScript con teselas, dos pines, logo, términos, atribución y nota Google Maps Platform | Origen local autorizado `127.0.0.1:8080`; geometría SIMULATED, sin consulta Google Routes. |
| [11 — Ruta vial Google ES](./11-google-road-route-truck-company-es.jpg) | Geometría real Google Routes, camión / empresa y métricas ESTIMATED | Coordenadas de escenario; no valida un camión ni una instalación comercial. |
| [12 — Ruta vial Google EN](./12-google-road-route-en-desktop.jpg) | Fuente, leyenda y estado en inglés; ruta conservada al cambiar idioma | Misma consulta local, sin evaluación API de carrier. |
| [13 — Ruta vial Google móvil](./13-google-road-route-mobile-390-es.jpg) | Viewport 390 px, ruta, iconos y atribución visibles, sin overflow horizontal de página | Viewport responsive; no GPS ni dispositivo físico. |

Las capturas 11–13 corresponden a la [mejora local posterior de Google Routes](../../HAC15_GOOGLE_ROAD_PREVIEW_LOCAL.md). Las capturas 01–10 conservan su contexto histórico: no se reclasifican como evidencia de routing real. Los fixtures de `/hac15-preview` y las 19 comprobaciones anteriores permanecen separados de esta nueva consulta del workspace.

[interaction-results.json](./interaction-results.json) registra **19/19 comprobaciones PASS** mediante interacciones y lecturas DOM en CUA. Es un registro de esta ejecución; no un script de CI. [console-summary.json](./console-summary.json) conserva la evidencia sanitizada del error de autorización del proveedor y del aviso de deprecación de `google.maps.Marker`.

## Revalidación del proveedor principal — 1 octubre 2026

Sobre el HEAD `4cc7db3629187c9bae2d1a4abc7c3dbf194505cd`, se inició el build existente de la app React/Next en el origen ya autorizado `http://127.0.0.1:8080/v2-workspace#/tracking`. Google Maps cargó correctamente: teselas, marcadores, logo, términos y atribución nativos visibles, además de la nota «Mapa: Google Maps Platform · Geometría simulada». La captura 10 es evidencia directa de este renderer Google, adicional a las nueve capturas de fallback en 3093.

La consola de esta comprobación no registró errores; sólo el aviso de deprecación de `google.maps.Marker`. No se cambió código, key, autorización de referrers ni Google Cloud. Se detuvo el servidor HTML anterior que ocupaba 8080 y se inició allí la app React actual. No se reejecutaron las 19 comprobaciones ni las suites por este cambio de puerto. La geometría sigue procediendo del escenario local; Google Maps como renderer no acredita Google Routes, evaluación API ni ruta vial real.

Para reproducir con la configuración local ignorada y el puerto libre, desde `cargomesh/`: `pnpm start --hostname 127.0.0.1 --port 8080` después de `pnpm build`. Abrir `/v2-workspace`, sección Seguimiento. En otro entorno, usar una clave de navegador y un origen autorizados por su responsable; no copiar credenciales al repositorio.

## Reproducir la presentación

Desde `cargomesh/`:

```sh
pnpm install --frozen-lockfile
pnpm dev --hostname 127.0.0.1 --port 3093
```

Abrir `/hac15-preview`. No copiar keys al PR ni modificar Google Cloud para repetir el caso. Con una key no autorizada en 3093, Google falla y se usa el fallback OSM para contenido sintético. Con otra configuración válida el renderer puede ser Google: registrar el proveedor **observado**, no asumir que será el de estas capturas.

1. A → **Tarjeta B**: ambos controles reflejan `road-b`, dos pines, sin línea ni métricas. Volver a A desde el mapa: el output del padre cambia a `road-a` y sólo se dibujan los waypoints declarados.
2. Tab desde candidato A a B; Enter para seleccionarlo. Shift+Tab y Space para A. Seguir Tab: región del mapa → zoom → atribución → salida. Foco de 3 px; sin paradas en overlays informativos ni trap.
3. Probar `routePreview:null`, `legs:[]`, `UNKNOWN con puntos`: cero líneas, `UNKNOWN`, métricas no disponibles. `Sin coordenada`: un pin. `Sin coordenadas`: cero pines/renderer. `Sin candidatos`: dos pines y selección `null`.
4. Con el fallback ya cargado, elegir **Fuente Google / sin traza**: renderer no disponible, cero líneas. Volver a Elegible: fallback simulado restaurado. La fuente Google es un fixture sin waypoints ni métricas; **no** representa una respuesta real de Routes.
5. **Quitar selección**: ningún candidato elegido automáticamente. Alternar rápidamente A/B y comprobar que el output y el mapa terminan en el mismo ID.
6. Cambiar ES↔EN. Viewports 390×844 y 320×740: seleccionar A/B, verificar que no hay overflow horizontal y que no se pierde la selección. Restaurar viewport al finalizar.
7. En `/v2-workspace`, abrir Seguimiento: debe seguir rotulado escenario local/SIMULATED, métricas no disponibles y cobertura UNKNOWN.

En esta ejecución el error del proveedor fue **real**: `RefererNotAllowedMapError` para 3093. Las capturas muestran el fallback efectivo. No se alteró la autorización del puerto ni se inició un deployment. La atribución del mapa sigue visible. El indicador de issues de Next dev en capturas corresponde al error del proveedor registrado; no se ocultó para la evidencia.

## Tests locales

| Comando | Resultado |
| --- | --- |
| `pnpm typecheck` | PASS |
| `pnpm test:v2-road-map` | PASS 10/10 |
| `pnpm exec tsx --test src/features/v2-workspace/workspace-model.test.ts` | PASS 4/4 |
| `pnpm test:i18n` | PASS 13/13 |
| `pnpm check:architecture` | PASS: 232 módulos, 29 client entry points |
| `pnpm build` | PASS: compilación, chequeo de tipos y generación de páginas |
| `git diff --check` | PASS |

El build se repitió tras la última corrección de la etiqueta `UNKNOWN`. La suite release completa de la entrega anterior no se presenta aquí como una ejecución nueva. No se ejecutaron pgTAP ni un smoke de DB para este handoff. No se aplicaron migraciones.

## Lo que falta para QA-13-20

- Montaje real en el snapshot integrado de Luis; controller y mapper de HAC-14, sin draft ni selección independientes en el workspace conectado.
- POST/GET/evaluación local autenticados: ID, versión, procedencia y fecha de la respuesta reales; errores/negativos con fixtures publicados HAC-12/29.
- Verificar fecha y clase FTL/LTL/UNKNOWN como datos de evaluación/servicio, no inferencias del mapa.
- Repetir teclado/móvil/selección con las tarjetas reales y confirmar navegación/edición/restauración sin respuestas obsoletas.
- Repetir renderer Google y fallo de proveedor en el entorno conjunto. La captura 10 certifica la presentación Google local en 8080; no su autorización ni integración en otro entorno.
- Aceptación humana QA con fecha, entorno y SHAs. El piloto de proveedor/ruta para camión del ADR continúa pendiente.

Skills utilizadas en esta revisión: `professional-project-orchestrator` (alcance y fronteras de owner) y `a11y-audit` (teclado, controles y reflujo). No se declara una auditoría WCAG completa ni una prueba con lector de pantalla/dispositivo físico.

## Ampliación multirregional posterior — 1 octubre 2026

Las capturas 01–10 y su matriz anterior son históricas. Las 11–13 documentan la primera ruta Google Callao/Arequipa; 14–22 documentan la ampliación solicitada después por Juan. No son evidencia de integración HAC-14/DB ni aptitud de camión.

| Captura | Evidencia directa local |
| --- | --- |
| [14-multicontinent-catalog-es.png](./14-multicontinent-catalog-es.png) | Catálogo ES: 34 ciudades, 18 países, seis regiones; Madrid/Barcelona. |
| [15-google-madrid-barcelona-es.png](./15-google-madrid-barcelona-es.png) | Google Maps + Google Routes: 627 km / 6,33 h, ESTIMATED. |
| [16-google-los-angeles-las-vegas-es.png](./16-google-los-angeles-las-vegas-es.png) | Norteamérica: 435 km / 4,11 h, ESTIMATED. |
| [17-google-bangkok-chiang-mai-es.png](./17-google-bangkok-chiang-mai-es.png) | Asia: 686,8 km / 9,31 h, ESTIMATED. |
| [18-google-johannesburg-durban-es.png](./18-google-johannesburg-durban-es.png) | África: 567,3 km / 6,2 h, ESTIMATED. |
| [19-google-sydney-melbourne-en.png](./19-google-sydney-melbourne-en.png) | Oceanía: 877,7 km / 8,97 h; idioma EN conserva resultado/hora. |
| [20-cross-ocean-blocked-en.png](./20-cross-ocean-blocked-en.png) | Callao/Madrid bloqueado en formulario, Continue no avanza. |
| [21-no-cross-ocean-geometry-en.png](./21-no-cross-ocean-geometry-en.png) | Mapa Google sólo con pines: sin ruta, fuente/métricas no disponibles, UNKNOWN. |
| [22-multicontinent-catalog-mobile-es.png](./22-multicontinent-catalog-mobile-es.png) | Catálogo ES, 390×844, sin overflow; extremos iniciales restaurados. |

Ver [catálogo/política ROAD y matriz de pruebas](../../HAC15_MULTICONTINENT_ROAD_CATALOG.md): 33/33 pruebas dirigidas, typecheck, arquitectura (237 módulos / 30 client entry points) y build. Ferris y metadatos incompletos se probaron con respuestas controladas, sin presentarlos como consultas reales. Las restricciones de altura/peso/aduanas y el smoke conjunto QA siguen pendientes.
