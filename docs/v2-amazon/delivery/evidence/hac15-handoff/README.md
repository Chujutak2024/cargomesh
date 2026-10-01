# HAC-15 — Evidencia local para el smoke conjunto

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

[interaction-results.json](./interaction-results.json) registra **19/19 comprobaciones PASS** mediante interacciones y lecturas DOM en CUA. Es un registro de esta ejecución; no un script de CI. [console-summary.json](./console-summary.json) conserva la evidencia sanitizada del error de autorización del proveedor y del aviso de deprecación de `google.maps.Marker`.

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
- Renderer Google en un origen ya autorizado, y fallo de proveedor en el entorno conjunto. El PASS del fallback local no certifica ese renderer allí.
- Aceptación humana QA con fecha, entorno y SHAs. El piloto de proveedor/ruta para camión del ADR continúa pendiente.

Skills utilizadas en esta revisión: `professional-project-orchestrator` (alcance y fronteras de owner) y `a11y-audit` (teclado, controles y reflujo). No se declara una auditoría WCAG completa ni una prueba con lector de pantalla/dispositivo físico.
