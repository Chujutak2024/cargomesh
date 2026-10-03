# HAC-15 / PR #92 — respuesta a revisión del 2 octubre

Owner: Juan. Handoff: Luis/HAC-14, Cristhian/HAC-16 y QA/HAC-13. Revisión recibida sobre `51ed9a5939bb0b4f31a52949b5df5da2d3cc5df5`.

**Corrección entregada para reprueba; R-MAP-02 abierto y smoke conjunto pendiente. No aprobado ni Done. Sin merge/despliegue.** El SHA nuevo se registra en cuerpo/comentario de [#92](https://github.com/Chujutak2024/cargomesh/pull/92), evitando autorreferencia imposible dentro del propio commit.

## Hallazgos

| Hallazgo | Respuesta | Estado |
| --- | --- | --- |
| R-MAP-01 · P1 · XSS Leaflet | `road-map-canvas.tsx`: HTMLElement con `textContent` → `bindTooltip`. Nombres intactos en ambos extremos y cada actualización. Reproducción antes/corrección después con Leaflet real. | Verificado localmente; reprueba del integrador pendiente. |
| R-MAP-02 · ADR/piloto | [ADR](../HAC15_MAP_PROVIDER_ADR.md) separado por renderer/lugares/routing, costos/cuotas/términos/Perú. [Plan truck/MTC](./HAC15_TRUCK_PILOT_PLAN.md); faltan acceso TomTom, perfil y licencia. | PARTIAL / piloto BLOCKED / decisión de Cristhian pendiente. No PASS. |
| R-MAP-03 · SHA antiguo en descripción | Cuerpo/comentario de #92 enlazan la entrega y evidencia nueva, separando resultados históricos. | Actualización externa verificable en #92. |

El documento recibido es evidencia de revisión, no permiso para integrar ramas/modificar infraestructura. Los archivos del ordenador del revisor no están aquí: se produjo evidencia propia y no se atribuyen sus capturas a Juan.

## Seguridad: causa y prueba DOM

Leaflet inserta strings de Tooltip como HTML (`DivOverlay.js` instalado); [referencia oficial](https://leafletjs.com/reference.html#tooltip). El schema real admite esos nombres; React no escapa ese DOM externo.

Fixture de desarrollo: imagen inexistente y handler inofensivo que únicamente fija `data-hac15xss`. No lee cookies/tokens/storage/solicitudes ni transmite información. Antes: atributo `executed`, un `img` real en cada tooltip. Después: dos spans con texto literal, cero imágenes/handlers y sin atributo ejecutado. Se conservaron también `Sede <Norte> & "Callao"`, `Empresa <Sur> & 'Arequipa'` y nombres normales.

`/hac15-preview` responde **solo en desarrollo**. `?scenario=label-markup` y `label-characters` reproducen carga inicial; botones prueban cambios de datos, Tarjeta A/B la selección del padre. No cambia las seis props del componente ni incorpora fixtures en sus datos operativos.

[JSON DOM](./evidence/hac15-handoff/review-2026-10-02-leaflet-dom.json): **18/18 PASS**. Carga inicial de las tres categorías y de cero candidatos/preview null; actualización de nombres/selección; Enter/Space; UNKNOWN con puntos, legs vacíos, nulos por extremo/ambos y cero candidatos `ineligible`; móvil 390×844 y conservación de nombres al cambiar ES/EN. El JSON conserva dos observaciones corregidas del harness: espera de retiro durante fade Leaflet y expectativa equivocada al recargar una URL con markup. No son fallos de producto ocultos.

| Captura directa | Demuestra |
| --- | --- |
| [31 antes](./evidence/hac15-handoff/31-leaflet-markup-before.png) | Reproducción previa; ejecución corroborada por DOM, no solo screenshot. |
| [32 markup literal](./evidence/hac15-handoff/32-leaflet-markup-literal.png) | Corrección de la interpretación HTML. |
| [33 caracteres](./evidence/hac15-handoff/33-leaflet-characters.png) | Nombres legítimos intactos. |
| [34 cero/móvil](./evidence/hac15-handoff/34-leaflet-zero-mobile.png) | Pines sin ruta, cero candidatos móvil. |
| [35 etiquetas/móvil](./evidence/hac15-handoff/35-leaflet-labels-mobile.png) | Texto literal sin overflow de página. |
| [36 ES](./evidence/hac15-handoff/36-leaflet-labels-es.png) | Nombres canónicos conservados con ES. |

Navegador integrado Codex, `127.0.0.1:3093`, clave de Maps desactivada **solo en el proceso QA**. `.env.local` y Cloud intactos. Geometría SIMULATED; datos/condiciones locales. No se reejecutó Google live ni se indujo fallo Google en esta ronda; sus evidencias anteriores conservan fecha. Esto no prueba HTTP/DB integrado.

### Reproducción integrador/QA

1. Arrancar `next dev` local sin clave pública de Maps en el proceso QA, sin tocar cuenta. Abrir `/hac15-preview?scenario=label-markup` y esperar dos tooltips.
2. Texto igual al fixture; cero `.leaflet-tooltip img`/`[onerror]`; atributo `data-hac15xss` nulo. Repetir inicio con `label-characters` y sin query.
3. Cambiar datos con controles; esperar que el tercer tooltip se retire para no confundir el fade con overlays activos. Tarjeta B con Enter → B, preview null/cero paths; A con Space → A, solo geometría SIMULATED declarada. Ambos nombres literales.
4. UNKNOWN/legs vacíos/nulos/cero → ninguna traza inventada. Móvil 390×844 → sin overflow y atribución visible. Repetir con controller/tarjetas reales de Luis en el corte integrado.

## Validación fresca

| Comando/alcance | Resultado |
| --- | --- |
| `pnpm exec tsx --test src/features/v2-road-map/road-map-model.test.ts src/features/v2-workspace/workspace-model.test.ts src/features/v2-workspace/road-locations.test.ts src/server/maps/local-road-preview.test.ts` | PASS 33/33; no seguridad DOM por sí solos. |
| `pnpm exec tsx scripts/verify-hac15-contract.ts` | PASS 7: tipos/mapper/Zod reales, nulos/UNKNOWN/cero y nombres intactos admitidos por schema. [JSON de la ejecución directa de tsx](./evidence/hac15-handoff/review-2026-10-02-contract-labels.json). No HTTP/DB. |
| `pnpm typecheck` | PASS |
| `pnpm check:architecture` | PASS: 238 módulos / 30 entradas cliente |
| `pnpm build` | PASS compilación/tipos/generación |
| `git diff --check` | PASS |
| Leaflet real, navegador Codex | PASS 18/18; JSON/capturas 31–36 |

No se reejecutaron release completo, pgTAP ni QA-13-20 integrado; conteos históricos no son nueva evidencia. Vercel no se usó como prueba local.

## Snapshot / handoff Luis

- Backend leído sin integrar: `origin/feat/be2-v2-road-serviceability` @ `3cf966fa95e0ee315454b1950815b229497a8c7e`.
- Intake/mapper: `origin/feat/fe1-v2-intake-eligibility` @ `226624e3bcf4c7856c7aa21fcbeed9eaaf93ab18`, confirmado por `git ls-remote`. El revisor cita `f515e01`, ausente en refs remotos consultados: no se afirma validar ese snapshot; reprobar contra el HEAD que entregue Luis.
- Target #92: `feat/cycle-2-integration` @ `f2a8e3eb441e7bdd35718e7c69192256c6aaf553`. Base contractual `codex/v2-amazon-contracts` @ `66a195207379f6f6be3eafd7ace02d254e7cf1c8`.
- Fetch de refs para lectura, sin pull/merge/integración manual ajena. [Montaje exacto](./HAC15_HAC14_INTEGRATION_HANDOFF.md): `v2-intake-prototype.tsx:346`, interior de `RoadCandidateMapBoundary`, conservar mapper/controller/selección únicos. Esta corrección no cambia las props ni crea estados de solicitud.
- `/v2-workspace` guarda solo en navegador; Google local no sustituye serviceability ni DRAFT persistido. Preview null real → pines conocidos/UNKNOWN, nunca cálculo por iniciativa del mapa.

## Pendientes de aceptación

Integrador reproduce R-MAP-01 sobre nuevo SHA. Cristhian decide acceso/perfil/licencia o cambio escrito de alcance truck/MTC (R-MAP-02 abierto). Luis monta el componente; QA valida POST→GET→serviceability→tarjetas/mapa, proveedor y pruebas humanas teclado/móvil (`QA-13-20`). No se mueven issues a Done.

Sin merge/despliegue, cambios de Vercel/Cloud/Supabase remoto/permisos/producción. Skills: `professional-project-orchestrator` delimita alcance/owner y `verification-before-completion` exige evidencia nueva antes de entrega.
