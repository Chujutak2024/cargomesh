# HAC-15 — Ruta vial Google y marcadores logísticos locales

Fecha: 1 octubre 2026. Rama: `feat/fe2-v2-route-map`, PR #92. Solicitud de Juan: sustituir la línea del escenario por una ruta vial calculada y usar camión en el origen / empresa en el destino.

## Resultado y alcance

La web React `/v2-workspace#/tracking` obtiene una geometría real de **Google Routes API** para las coordenadas locales Callao → Arequipa y la dibuja sobre **Google Maps**. La línea anterior de tres puntos sintéticos se retiró del workspace. No hay una línea de sustitución cuando faltan datos o falla la consulta.

El resultado se etiqueta **ESTIMATED**, no VERIFIED. Los extremos siguen siendo coordenadas del escenario, no instalaciones comerciales confirmadas. El icono de camión indica origen, no vehículo asignado, GPS, capacidad ni cumplimiento de restricciones de camión. No se creó candidato comercial, oferta, booking ni evaluación de serviceability.

`/hac15-preview` conserva sus fixtures explícitos SIMULATED para comprobar el contrato. Las capturas 01–10 del handoff corresponden a esos estados históricos; las capturas 11–13 acreditan el comportamiento nuevo del workspace.

## Implementación

| Archivo | Responsabilidad |
| --- | --- |
| `cargomesh/src/app/api/local/road-preview/route.ts` | Entrada local opcional; configuración de servidor, sin secreto público. |
| `cargomesh/src/server/maps/local-road-preview.ts` | Consulta Compute Routes por coordenadas; decodifica la polyline declarada, valida métricas y devuelve preview ESTIMATED. |
| `cargomesh/src/features/v2-workspace/use-local-road-preview.ts` | Consulta automática al abrir el mapa; debounce y cancelación; nunca muestra una respuesta para otro par. No persiste geometría en localStorage. |
| `cargomesh/src/features/v2-workspace/workspace-model.ts` | Recibe el preview como dato explícito; sin generar tres puntos de escenario para reemplazar errores. Elegibilidad y estado comercial permanecen unknown. |
| `cargomesh/src/features/v2-road-map/map-marker-icon.ts` | SVG estático de camión y empresa; sin texto ni HTML externo. |
| `RoadMapCanvas` / `RoadCandidateMapView` | Marcadores, contorno blanco de la ruta, leyenda textual bilingüe y nota del proveedor real. No realizan consultas de routing. |

La entrada local está **deshabilitada por defecto**. Requiere `CARGOMESH_LOCAL_ROUTES_ENABLED=true` y una clave de servidor Routes en `.env.local` ignorado. Acepta únicamente `Host: 127.0.0.1:8080`, `Origin: http://127.0.0.1:8080`, POST JSON y el par `callao/arequipa` del escenario existente. No acepta coordenadas arbitrarias ni crea opciones para otros pares. Comparte llamadas simultáneas y limita repeticiones rápidas; no guarda una caché persistente de contenido Google.

La validación usa Host/Origin reales porque Next puede reconstruir `request.url` con un host interno. El test cubre esa reconstrucción conservando la restricción al origen autorizado. No se relajaron las restricciones de la key ni se cambió Google Cloud.

Solicitud al proveedor: `DRIVE`, `TRAFFIC_UNAWARE`, `HIGH_QUALITY`, sin alternativas ni puntos intermedios impuestos. Field mask limitado a distancia, duración y polyline. Se enviaron sólo las coordenadas de escenario, sin carga, usuario ni datos comerciales. Fuente técnica: [Compute Routes](https://developers.google.com/maps/documentation/routes/compute_route_directions), [polylines](https://developers.google.com/maps/documentation/routes/traffic_on_polylines).

## Evidencia real

Coordenadas consultadas:

- Origen Callao: `-12.0464, -77.1181`.
- Destino Arequipa: `-16.409, -71.5375`.
- Respuesta observada: HTTP 200, una ruta, **27 326 puntos**, distancia original **1 019 924 m**, duración **61 345 s**. UI: **1 019,9 km / 17,04 h**; puede variar en futuras consultas.
- Procedencia: `GOOGLE_ROUTES_API / ESTIMATED`; hora de consulta visible. Sin segmentos añadidos entre el marcador canónico y un punto que Google ajuste a la carretera.

| Evidencia | Verificación |
| --- | --- |
| [Escritorio ES](./evidence/hac15-handoff/11-google-road-route-truck-company-es.jpg) | Ruta por carreteras, icono camión / empresa, leyenda, fuente, métricas y atribución Google. Viewport 1366×900. |
| [Escritorio EN](./evidence/hac15-handoff/12-google-road-route-en-desktop.jpg) | Misma ruta y hora de consulta conservadas al cambiar idioma; nota y leyenda en inglés. |
| [Móvil ES](./evidence/hac15-handoff/13-google-road-route-mobile-390-es.jpg) | Viewport 390×844, iconos y atribución visibles; sin overflow horizontal de la página. |
| Consola | Ningún error observado en el smoke exitoso; aviso de deprecación de `google.maps.Marker`. |
| Clave de servidor | Configurada localmente; no se muestra en UI, respuesta ni captura. `.env.local` ignorado. Búsqueda por igualdad de su valor en los 80 archivos JS/map del build cliente: ninguna coincidencia; el valor no se imprimió. |

Pruebas frescas: mapa 10/10, workspace 5/5, adaptador local 8/8, total **23/23**. Cubren decoder, errores/incompletos → null, no key → ninguna llamada, restricciones de origen/par, reconstrucción de URL de Next, llamadas simultáneas y repetición rápida. TypeScript, arquitectura (236 módulos / 30 client entry points), build y `git diff --check` pasan. La suite release completa no se presenta como reejecutada por este cambio.

## Handoff y límites pendientes

El montaje de Luis continúa consumiendo **el mapper y controller HAC-14**, con las mismas seis props HAC-27. No debe llamar automáticamente a este endpoint de escenario ni usar sus coordenadas como instalaciones persistidas. `RoadCandidateMapView` mantiene su frontera de presentación: null/UNKNOWN/legs vacíos no crean líneas, y contenido Google Routes no se dibuja sobre OSM.

Esta mejora local no sustituye la integración HAC-12/14 ni el piloto de ruteo para camión/TomTom del ADR. Otros pares, búsqueda y confirmación de instalaciones, reevaluación de coordenadas operativas, restricciones de camión y smoke conjunto QA siguen pendientes de su alcance/owner. No se modificaron la rama de Luis, Vercel, producción, Supabase remoto ni infraestructura. Sin merge ni despliegue.

Reproducir: configuración local autorizada en `.env.local`, `pnpm build`, `pnpm start --hostname 127.0.0.1 --port 8080`, abrir `/v2-workspace#/tracking`. La configuración opcional permanece apagada en otros entornos.

Skills utilizadas: `professional-project-orchestrator` (frontera entre vista, adaptador local y dominio) y `verification-before-completion` (tests, build y resultado real en navegador antes de cerrar).
