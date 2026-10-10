# CargoMesh V2 — mapa de restauración selectiva

> **Estado vigente: B2 / 8 octubre 2026.** Hay Three.js/R3F, WebGL y Motion reales. Los targets B2 al final de este documento sustituyen los targets 3D/motion/imagery históricos. B0/B1 y sus ejemplos se conservan como historia; no son instrucciones para borrar la implementación conectada actual.

## Historial B0/B1 — 7 octubre


## Alcance y baseline

Esta entrega conserva archivos exactos antes y después, hashes SHA-256 y patches fuera del repositorio. No se ejecutó una restauración sobre el producto. El índice local de evidencia identifica la ubicación de `final-snapshot/manifest.json`, `before/`, `after/`, `patches/`, `tracked.patch` y `restore-file.cjs`; esta documentación no publica rutas personales, variables ni secretos.

Hay dos baselines distintos:

- **B0, web anterior:** HEAD `3fd924cf45f2370e36514434b5859cfec6a75a3a` más los archivos modificados/no rastreados que existían en disco. El snapshot inicial y `master-intake-baseline` conservan ese trabajo. Git HEAD por sí solo no reproduce esa apariencia.
- **B1, copia conectada:** HEAD `50c12d115dd9b2171d9375acd215593de29e8f34`, base `codex/v2-amazon-contracts`. `current-base-baseline` conserva los seis archivos existentes antes de editarlos; el manifest final usa esos bytes o los de HEAD para cada archivo existente. Los componentes carrier nuevos tienen baseline **ABSENT**, no una UI carrier anterior inventada.

Restaurar todo `v2-workspace/page.tsx` desde B1 volvería a montar el controlador histórico de localStorage. **Eso no es una restauración solo visual** y perdería la conexión actual. Para mantener funcionalidad nueva se restauran presentación y styles por hunks/componentes, conservando `ConnectedCoordinator`, callbacks, cliente API, versiones y mapper.

## Archivos y componentes

Todos los paths de esta sección son relativos al repositorio:

| Alias | Archivo(s) / responsabilidad |
| --- | --- |
| S | `cargomesh/src/features/carrier-portal/portal.module.css`: paleta, rail, navegación móvil, cards, tablas, forms, diálogo, métricas, Panel y mapa carrier |
| C | `cargomesh/src/features/carrier-portal/coordinator.tsx`: `ConnectedCoordinator`; montaje en `cargomesh/src/app/v2-workspace/page.tsx` |
| P | `cargomesh/src/features/carrier-portal/portal.tsx`: `CarrierPortal`, `Overview`, `ResourceWorkspace`, `Help`, `EditorDialog`; montaje en `cargomesh/src/app/carrier-portal/page.tsx` |
| H | `cargomesh/src/features/carrier-portal/request-summary.tsx`: `RequestSummary`, resumen, distribución y ventanas del registro consultado |
| F | `cargomesh/src/features/carrier-portal/contract-form.tsx` y `form-model.ts`: campos/revisión y traducción; payloads nativos, validación y fechas no son decoración |
| M | `cargomesh/src/features/carrier-portal/carrier-map.tsx` y `map-model.ts`: capas recibidas, selección, proveedor y geometría validada |
| R | `cargomesh/src/features/v2-road-map/road-candidate-map-view.tsx`, `road-candidate-map-view.module.css`, `road-map-canvas.tsx`: mapa ROAD, notas, controles y marcadores |
| I | `cargomesh/src/features/v2-intake/v2-intake-prototype.tsx` y `v2-intake-prototype.module.css`: formulario existente, montaje embebido, callbacks y styles; `conversation-chat.tsx`/`.module.css`: nombre accesible y separación del menú móvil, sin cambiar interpretación ni envío |
| V | `cargomesh/src/features/v2-workspace/workspace-logistics-visual.tsx`: ilustración SVG decorativa propia; clases `.logisticsVisual`, `.hubDepth`, `.cargoDepth` de S |
| D | `cargomesh/src/features/carrier-portal/api.ts`, `records.ts`, `resources.ts`, schemas y mappers vigentes: dependencias funcionales; **no revertir para cambiar apariencia** |
| B0 UI | `cargomesh/src/features/v2-workspace/v2-workspace.tsx`, `v2-workspace.module.css`, `workspace-dashboard-*`, `workspace-step-transition.tsx` y `workspace-zero-click-route.tsx` conservados en el snapshot B0 |

## Procedimiento seguro

1. Buscar el target de las matrices siguientes. Elegir baseline B0/B1/ABSENT y leer sus límites.
2. Guardar los cambios posteriores a esta entrega. Comparar el hash actual con `after` del manifest antes de sobrescribir; el helper rechaza diferencias posteriores.
3. Revisar el patch del archivo. Para un target visual, seleccionar únicamente JSX de presentación/reglas CSS indicadas, sin tocar D, mapper, correlation, idempotencia, permisos ni callbacks I.
4. `node restore-file.cjs <path-relativo>` muestra la operación sin aplicarla. `--apply` restaura bytes exactos de un archivo existente o elimina **ese archivo nuevo concreto**. El helper exige `--allow-functional-rollback` para restaurar un `.ts/.tsx` completo: no usar ese modo para una petición solo visual.
5. Si se retira un componente nuevo, quitar primero sus imports/montaje y mantener un destino de navegación accesible. Nunca dejar un módulo requerido ausente. No hay eliminación recursiva ni `git reset`.
6. Ejecutar typecheck, suite pertinente, architecture y build; comprobar la pantalla, teclado, móvil, selección y errores. Confirmar que la API sigue siendo la fuente de datos y no se activó fallback empresarial.

Los patches exactos hacen reproducible el cambio por archivo; **no automatizan la independencia semántica** de 39 targets que comparten C/P/S. No se debe prometer que restaurar un archivo compartido afectará solo una pantalla.

## Targets globales

| Target | Antes → después / baseline | Componente y styles / dependencias | Procedimiento y verificación | Independencia |
| --- | --- | --- | --- | --- |
| RESTORE-COLORS | B0 CSS → S tokens/gradientes; B1 styles R/I → refinamiento | S `--ink`, `--muted`, `--line`, `--ocean`, `--teal`, superficies; R/I colors | Trasladar tokens seleccionados de B0 y/o hunks B1; conservar foco/contraste. Axe y revisión de gradientes ES/EN | Global; no requiere revertir datos |
| RESTORE-TYPOGRAPHY | B0/B1 fuentes/tamaños → S jerarquía y I embedded | S h1/h2/h3/texto; R/I headings | Revertir reglas tipográficas; revisar zoom, tablas y etiquetas móviles | Global compartida |
| RESTORE-SIDEBAR | B0 sidebar → P/C rail expandible | S `.rail`, `.brand`, `.railFooter`; JSX P/C; navegación D intacta | Recuperar solo presentación B0; mantener URLs y aria-current. Hover, foco y clic desde rail contraído | Compartida entre portales |
| RESTORE-NAVIGATION | B0 roles/rutas → P/C secciones propias | P/C nav y S media móvil; D define colecciones | Reordenar/envolver links conservando destinos actuales y permisos; probar deep link/back/skip/teclado | Compartida; no restaurar role switch como permiso |
| RESTORE-STEPPER | B1 I → I embedded; B0 stepper distinto | I `.embedded`/stepper; callbacks + estado HAC-14 intactos | Revertir styles de pasos, sin volver al borrador B0 independiente. Editar/retroceder y conservar valores | Visual sí; no equivalencia de contratos B0/B1 |
| RESTORE-BUTTONS | B0/B1 buttons → S primario/secondary/foco y R/I | S `.primary`, button, actions; R/I controles | Restaurar solo skins/tamaños; mantener type, disabled, busy y acciones. Teclado/contraste | Global compartida |
| RESTORE-MOTION | B0/B1 movimiento → rail/foco/entrada I breves | S transition; I `intake-enter`; V sin motor 3D | Revertir animation/transition únicamente. Conservar reduced-motion y estado. No hay benchmark FPS | Visual independiente de API |
| RESTORE-IMAGES | Logo existente → Next/Image P/C; SVG V decorativo | P/C brand + V; asset original sin modificar | Restaurar renderer/tamaño sin modificar el archivo original; retirar referencia V si se solicita. Alt, carga y proporción | Por componente |
| RESTORE-3D | No Blender/GLB previo/nuevo → SVG 2.5D V | V + S clases de profundidad; sin Three/Rive/WebGL | Retirar V/import en H y styles de profundidad, mantener resumen textual/acciones. No hay GLB que borrar | Visual sí |
| RESTORE-TRUCK | Imagen ilustrativa B0 → escena logística SVG nueva | B0 truck asset conservado; V/H | Si se recupera ilustración B0, mantener etiqueta decorativa y no vehículo asignado; comprobar composición/mobile | Visual sí; no asignación de dominio |
| RESTORE-TABLES | Tabla B0/B1 → C/P tablas semánticas/paginadas | S table/tableWrap/pagination; renderTable C; ResourceWorkspace P | Reaplicar presentación B0 sobre filas recibidas actuales; conservar search/paging/API y scope. Scroll y foco | Styles compartidos; markup por vista |
| RESTORE-FORMS | I B1 y carrier ABSENT → I embebido + F nativo | F/I/S fields/editor; D y schemas intactos | Revertir layout/labels seleccionados; no quitar schema/version/idempotencia. Validación, review, 409, busy/Escape | Presentación por hunk; F es compartido |
| RESTORE-MAP-LAYOUT | R B1 → R/M proporción adaptativa | S mapSurface/mapLayout; R CSS | Revertir solo proporción/alto/grids; mantener geometría/procedencia y atribución. Desktop/móvil, null/UNKNOWN | Layout sí |

## Targets coordinación

| Target | Antes → después / baseline | Componentes / styles / dependencias | Procedimiento y verificación | Independencia |
| --- | --- | --- | --- | --- |
| RESTORE-COORDINATION-PANEL | Panel B0 → H + dashboard C, datos API B1 | H/C; S metrics/requestHero/dashboardGrid/distribution; V/D | Reproducir presentación B0 usando requests actuales, sin KPI inventado ni controlador B0. Revisar acciones/donut/vacío/error | H separable; S compartido |
| RESTORE-COORDINATION-REQUESTS | Lista B0 → renderTable C | C shipments; S table/toolbar/pagination; D | Revertir JSX/styles de tabla únicamente. Search sin perder foco, página25, fila/selección | JSX local; styles compartidos |
| RESTORE-COORDINATION-REVIEW | Revisión B0 → C desk con registro/evaluación correlacionada | C desk; S details/card; mapper D | Recuperar layout manteniendo requestId/draftVersion. Editar/cambiar selección, sin booking falso | Por sección; controller compartido |
| RESTORE-COORDINATION-FREIGHT-DESK | Mesa B0 → C desk, comercial no duplicado | C desk; I callbacks; HAC-42 externo | No restaurar cálculo comercial B0 como función carrier/shipper real. Solo composición; decisiones/ranking mantienen ownership | Parcial; no mesa comercial completa nueva |
| RESTORE-COORDINATION-TRACKING | Tracking B0 → C tracking + R | C select/mapProps; R/S; mapper D | Restaurar layout R, mantener props del mapper actual. Null/legs[]/coords ausentes/zero/provider fail | Layout separable; selección compartida |
| RESTORE-COORDINATION-HELP | Ayuda B0 → C help por trabajo y fuente | C help; S grid/card | Recuperar composición/textos compatibles; enlaces y reglas actuales. Teclado y EN/ES | Por sección |

## Targets shipper

No se sustituyó el portal comercial de Luis. Sus pantallas sin cambios nuevos se conservan en la base. El formulario de creación I tiene únicamente presentación embebida y callbacks de integración; no se reemplazó el mapper ni el dominio del shipper.

| Target | Antes → después / baseline | Archivos/components/styles/dependencias | Procedimiento y verificación | Independencia |
| --- | --- | --- | --- | --- |
| RESTORE-CLIENT-DASHBOARD | Sin cambio nuevo del dashboard shipper | Base vigente; no equivale a H coordinación | No-op en esta entrega; no borrar H pensando que es dashboard shipper. Smoke del portal del dueño | No cambio que revertir |
| RESTORE-NEW-SHIPMENT | I B1 → I embebido en C | I TSX/CSS; C request; callbacks/D | Revertir presentación embedded conservando callbacks y mapper; cuatro pasos del contrato vigente | Styles sí; montaje compartido |
| RESTORE-CONTEXT | I B1 context → skin embedded | I origen/contexto y R; D opciones autorizadas | Restaurar styles de contexto B1, conservar valores y carga API. Validaciones/back/errores | Hunk de presentación |
| RESTORE-ROUTE | I/R B1 → mapa y contexto ROAD pulido | R CSS/TSX/canvas; mapper D | Seleccionar presentación/marcadores; no devolver recta inventada ni Google Routes falso. Edge suite + UI | Compartido con tracking |
| RESTORE-CARGO | I B1 cargo → skin embedded | I campos/carga; S intakeSurface; schema D | Hunk CSS; mantener peso/volumen/unidades. Revisión coherente sin capacidad inferida | Styles embebidos compartidos |
| RESTORE-SCHEDULE | I B1 fechas → skin embedded | I stepper/fechas; D UTC/window schema | Hunk visual; mantener timezone, ventanas y validación. Back/edición | Styles embebidos compartidos |
| RESTORE-REVIEW | I B1 revisión → callbacks y skin embedded | I review + C receivePersisted/receiveEvaluation; D | Restaurar composición, conservar GET de round trip y correlación de evaluación | Controller/callbacks no revertibles como decoración |
| RESTORE-MY-SHIPMENTS | Sin cambio nuevo del flujo comercial shipper | Base vigente del owner HAC-42 | No-op; C shipments es directorio de coordinación, no sustituto comercial | No cambio que revertir |
| RESTORE-CLIENT-TRACKING | Sin cambio nuevo específico shipper; R compartido sí cambió | R, mapper de HAC-14/15; ownership HAC-42 | Hunk R si afecta su montaje; no tocar handlers/request state. Coordenadas/null/selección | Compartido |
| RESTORE-SUPPORT | Sin cambio nuevo específico shipper | Base vigente; C help/P Help independientes | No-op para soporte shipper; no confundir ayudas nuevas | No cambio que revertir |

## Targets carrier

Antes no existían P/F/M en B1. **ABSENT significa que no hay un diseño carrier anterior que pueda recuperarse.** Retirar una nueva sección es rollback funcional y exige retirar su navegación/montaje; cambiar solo su diseño conserva ResourceWorkspace, schemas y cliente API.

| Target | Antes → después / baseline | Componentes/styles/dependencias | Procedimiento y verificación | Independencia |
| --- | --- | --- | --- | --- |
| RESTORE-CARRIER-OVERVIEW | ABSENT → Overview P | P Overview; S metrics/chart/grid; D perfil y conteos | Revertir solo composición/styles propios; retirar sección completa exige nav segura. Perfil/recarga/version/vacío/error | JSX local; styles compartidos; no UI anterior |
| RESTORE-CARRIER-NETWORK | ABSENT → ResourceWorkspace network | P; S tabs/table/F; resources D | Ajustar presentación de grupo sin borrar catálogos ni permisos. Tabs/padres/paging/revisión | Controller/styles compartidos |
| RESTORE-CARRIER-DEPOTS | ABSENT → depots dentro network | P ResourceWorkspace/F; CatalogInputs depots D | Cambiar skin de depósito por hunk/variant, no form-model global indiscriminado. Coordenadas en pareja/nullable/review | Compartido con otros recursos |
| RESTORE-CARRIER-RESOURCES | ABSENT → fleet | P ResourceWorkspace/F; S; fleet/crew D | Recuperar presentación por grupo; mantener asset/driver/combo y scope. Arrays/uniones/revisión | Compartido |
| RESTORE-CARRIER-CAPACITY | ABSENT → pools/calendars/assignments | P/F/S; native fleet D | Solo layout; no convertir capacidad declarada en disponible ni eliminar evidencia. Ventanas/refs | Compartido |
| RESTORE-CARRIER-OPPORTUNITIES | ABSENT → commercial/opportunities | P selected/actions; F/S; workflow D | Cambiar lista/detalle, conservar respuesta y parent oportunidad. Review, permisos, conflicto | Compartido |
| RESTORE-CARRIER-OFFERS | ABSENT → MANUAL/create/supersede/withdraw | P acciones/editor + F; workflow D | Revertir apariencia, conservar evidence/currency/expiry/supersedesOfferId/idempotencia. No edit endpoint inventado | Función inseparable de contratos; visual por hunk |
| RESTORE-CARRIER-BOOKINGS | ABSENT → bookings/holds | P ResourceWorkspace/F/S; commands D | Solo styles/layout; no setters arbitrarios de status. expectedVersion/conflict/confirm/release | Compartido |
| RESTORE-CARRIER-OPERATIONS | ABSENT → executions/events/consolidations | P/F/S; workflow D | Cambiar composición manteniendo commands y parent; posiciones manuales no GPS. Start/complete/position/empty | Compartido |
| RESTORE-CARRIER-INCIDENTS | ABSENT → incidents/updates | P/F/S; native incident path D | Mantener relación execution/incident y versión; solo presentación. Parentpicker/historial/conflicto | Compartido |
| RESTORE-CARRIER-MAP | ABSENT → M cinco capas + listas | M/map-model; S mapLayout/Surface/Note; API routing D | Layout/hunks sin tocar source/UNKNOWN/coords o fallback. Capas/selección/no trace/atribución/provider failure | M separable del editor; S compartido |

## Ejemplos soportados y límites

- **“Colores nuevos, Panel anterior”**: H/composición C desde B0, dejando S tokens actuales y fuente API. Requiere adaptación, no sustitución completa de C.
- **“Funciones nuevas, animación anterior”**: solamente reglas motion de S/I; contratos y controladores intactos.
- **“Quita solo 3D/camión”**: retirar V/import de H y clases decorativas. No se modifican solicitud, flota o capacidad.
- **“Mapa anterior”**: restore de hunks CSS R/S, dejando mapper, geometría validada, proveedor y nota honesta.
- **“Carrier anterior”**: no existe ese baseline. Se puede rediseñar o retirar la sección de forma coordinada; no se atribuye un estado inexistente al snapshot.

## Resultado de preservación

El snapshot final registra todos los archivos modificados/no rastreados de esta entrega, incluidos documentos y launcher, y excluye `.env*`. El helper fue comprobado en dry run y con su protección contra rollback completo de código; no se aplicó una restauración al producto. Después de cualquier restauración futura, repetir los gates correspondientes; un hash exacto no garantiza compatibilidad entre una UI antigua y los contratos nuevos.

## B2 — continuación vigente del 8 octubre

**B2 = CURRENT-VISUAL-BASELINE**, la UI real antes de esta pasada, con 36 archivos dirty/no rastreados preservados y HEAD `50c12d115dd9b2171d9375acd215593de29e8f34`. Incluye el carrier conectado del 7 de octubre. No confundir ABSENT de B1 con ausencia de carrier en B2.

Evidencia local externa: carpeta `cargomesh-v2-visual-correction-2026-10-08`, al lado de la copia actual. `CURRENT-VISUAL-BASELINE/manifest.json` conserva bytes previos; `final-snapshot/manifest.json` conserva hashes before/after y origen del baseline, patches por archivo, inventario delta y diff Git. Los nuevos módulos/GLB/foto/poster son ABSENT en B2. No se preservan .env/credenciales en esos archivos.

El helper **nuevo** `restore-file.cjs`, en esa carpeta de evidencia, usa B2 y compara hash actual con after antes de actuar. Por defecto solo muestra dry-run. Restaurar un archivo de código completo exige `--allow-functional-rollback` junto con `--apply`; seleccionar hunks sigue siendo el procedimiento para archivos compartidos. No usar el helper viejo B1 para restaurar esta pasada.

Aliases adicionales, relativos a `cargomesh/`:

- **T:** `src/features/logistics-3d/{logistics-truck.tsx,truck-scene.tsx,truck-model.ts,truck.module.css,truck-model.test.ts}`.
- **A:** `public/v2-workspace/{cargomesh-truck.glb,cargomesh-truck.meta.json,cargomesh-truck-poster.webp,logistics-yard.webp}`; `scripts/export-logistics-truck.mjs`.
- **Q:** `src/features/product-motion/content-motion.tsx`.
- **G:** `src/features/carrier-portal/guidance-image.tsx`.
- **L:** `package.json`, `pnpm-lock.yaml`; Three/R3F/Motion/@types/three. No revertir paquetes si quedan consumidores.
- **C/P/H/S/I:** los mismos componentes/controladores de la tabla histórica, **ahora con baseline B2**.

### Targets B2 que prevalecen

| Target | Cambio / baseline | Retirada selectiva y dependencias | Verificación |
| --- | --- | --- | --- |
| RESTORE-X-REFERENCE-ADAPTATIONS | B2 → jerarquía Overview/Panel, fila seleccionada, panel lateral/inferior, diálogo | Hunks P/C/H/S de composición/feedback; conservar schemas, API, versiones, idempotencia, returnButton/detailHeading y demás foco útil | Lista/detalle/Close/Escape, móvil y contratos |
| RESTORE-3D | SVG B2 → Canvas original real | Sustituir consumidores LogisticsTruck de C/P/H por visual B2 o poster/texto. Mantener API/acciones. Luego retirar T/import dinámico/export/GLB opcionales. No quitar Motion si aún se usa en páginas | Sin imports huérfanos, build, estado real sin datos |
| RESTORE-3D-TRUCK | Modelo nuevo ABSENT B2 | Sustituir solo modelo/poster por otro asset compatible u original SVG conservado; adaptar renderer/imports/test/export. No borrar truck-model mientras truck-scene lo importa | Silueta, licencia, volumen/budget, mobile, no vehículo asignado |
| RESTORE-3D-SCENE | Canvas/luces/sombra nuevos | Mantener LogisticsTruck y reemplazar hijo dinámico por poster, preservando caption/espacio. O revertir únicamente luces/cámara. Cleanup/disposal deben mantenerse mientras haya WebGL | Fallback, resize, móvil, fuera de vista/reentrada |
| RESTORE-TRUCK-MOTION | Parallax demand nuevo | Dejar T/modelo/WebGL, poner objetivo cámara fijo y retirar pointer invalidation. Conservar render inicial/resize/visibilidad y liberación. No tocar mapas | Cámara inmóvil, model visible, reduced, no bucle continuo |
| RESTORE-STEP-MOTION | I B2 → wrapper Q + indicador | Cambiar wrapper por div estable y recuperar solo CSS/indicador B2. Conservar cuatro pasos, aria-current, h2/foco/errorRef y datos de intake. No recuperar CSS anterior además de Motion: produciría dos entradas | Sedes/carga/fechas/review, back/edit, valores/409 |
| RESTORE-PAGE-MOTION | C/P B2 → wrapper Q | Sustituir wrapper por contenedor estable manteniendo niños, identity/state y foco. No añadir key del view al controlador. Mantener intake montado/hidden al cambiar vistas: es conservación de estado | Navegación/URL/back, estado del borrador y foco |
| RESTORE-PANEL-VISUAL | H/C/S B2 → camión + superficies | Restaurar composición H y hunks de Panel C/S desde B2; mantener requests recibidos y callbacks; retirar su import T solo si no queda consumidor en ese archivo | Counts de página, vacío/auth/error, CTA, móvil |
| RESTORE-CARRIER-OVERVIEW-VISUAL | P/S B2 → hero y paleta métricas | Hunks Overview/carrierHero/metrics; conservar profile, lecturas, autorización y comandos. No revertir P completo: comparte ResourceWorkspace | Perfil/counts/CTA/vacío/permiso |
| RESTORE-IMAGERY | Ayudas B2 → G + foto licenciada | Retirar G de Help C/P y foto solo cuando no queden consumidores. Mantener logo/poster/3D; retirar únicamente fotografía si se pide | Caption/enlace/autores, ausencia de referencias huérfanas |
| RESTORE-R3F | Paquete/scene nuevos | Equivale a retirar renderer Canvas, conservando poster. Primero consumidores, luego dependency y @types solo si no queda Three. No reinstalar deps en la copia antigua enlazada | Typecheck/build y assets disponibles |
| RESTORE-MOTION-LIBRARY | Q + useReducedMotion nuevos | Q → div con lógica de foco propia; LogisticsTruck → hook matchMedia equivalente; quitar imports motion antes del paquete. Conservar reduced CSS y datos | Page/step/list/keyboard/reduced y build |
| RESTORE-RIVE | No se instaló ni implementó | **NO-OP**, no hay paquete/asset/renderer que retirar | Comprobar ausencia sin borrar otros visuales |

RESTORE-3D/IMAGES/MOTION históricos quedan supersedidos por esta tabla para la continuación actual. Los demás targets B0/B1 siguen describiendo cambios anteriores y no se borran.

### Ejemplos vigentes

- **3D sin animación:** RESTORE-TRUCK-MOTION; mantener Canvas, iluminación y modelo.
- **Camión anterior:** sustituir consumidores T por `workspace-logistics-visual.tsx` B2 conservado, sin restaurar controladores de localStorage B0.
- **Panel anterior, carrier nuevo:** hunks H/Panel C/S B2; no restaurar S global ni P.
- **Nueva UI sin Motion:** RESTORE-MOTION-LIBRARY manteniendo foco/estado/preferencia; Three es separable de Motion después de sustituir su hook.
- **Quitar solo transición de pasos:** RESTORE-STEP-MOTION; preservar Q en páginas.
- **Quitar foto y mantener 3D:** RESTORE-IMAGERY, sin tocar T/A poster/modelo.

No se promete independencia automática de los componentes que comparten CSS/controladores. Guardar cualquier trabajo posterior, comprobar hashes, elegir hunks y verificar antes de aplicar. El dry-run se realiza sin restaurar/borrar el producto. La carpeta de dependencias externa no es un restore target de UI; una instalación futura debe conservar la otra copia local y seguir el package/lock elegido.
