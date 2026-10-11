# CargoMesh V2 — corrección visual, continuidad y 3D real

Fecha: 8 octubre 2026. Entrega **LOCAL ONLY** sobre el trabajo existente. Este informe sustituye las afirmaciones sobre ausencia de 3D/Motion del informe del 7 de octubre; sus resultados anteriores siguen siendo históricos.

## 1. Alcance y estado

Se conserva la implementación conectada, los catálogos y workflows carrier, los formularios nativos, los contratos, la selección de candidatos y el mapa honesto. No se reinició el producto.

- Base: `codex/v2-amazon-contracts`; HEAD local detached `50c12d115dd9b2171d9375acd215593de29e8f34`.
- Antes de editar se congeló **B2 / CURRENT-VISUAL-BASELINE**: 36 archivos existentes con SHA-256, estado/diff Git y 13 capturas previas. HEAD solo no reproduce ese trabajo sin commit.
- Producto real: puerto **8083**, `/v2-workspace` y `/carrier-portal`.
- QA visual: puerto **8085**, `/qa-hac43`, en una copia externa, con banner **DATOS SINTÉTICOS EN MEMORIA — SIN PERSISTENCIA**. No existe esta ruta en el producto final.
- No se escribió en GitHub, Linear, Drive, Vercel ni Supabase remoto. No hay nuevos commits, push, PR, merges ni despliegues.

**Resultado:** implementación visual local y 3D ejecutable, con verificaciones de UI y código. La aceptación integral de HAC-43 y el runtime autenticado siguen **BLOCKED/PARTIAL** por entorno y dependencias de equipo. Una captura QA no demuestra persistencia ni permisos reales.

## 2. Identidad de la referencia X

Fuente original: [post de Ilias Miah](https://x.com/iliasconfidency/status/2107184046220738959?s=20), `@iliasconfidency`, 5 octubre 2026.

Identidad verificada directamente: **FleetFlow AI**, kit de UI para CRM logístico. La respuesta del propio autor enlaza ese producto y el video muestra camiones, mantenimiento, conductores y asignación de cargas. La descripción indexada sobre Keystone/inmobiliaria no coincide con este post accesible; no se utilizó para identificar el video.

Texto del post, **paráfrasis**: un camión recibe una alerta anticipada de servicio, se agenda el mantenimiento y se reorganiza el conductor para regresar a operación sin llamadas telefónicas. No se interpreta esa publicidad como prueba de un backend funcionando.

Duración leída del reproductor: **42,299999 s**, resolución del video 960 × 720. Evidencia directa nueva: `reference/post-identity.json`, `original-post.dom.txt`, `video-passes.json` y 120 capturas de reproducción. Se completaron **8 pasadas**: experiencia, arquitectura, información, flujo, movimiento, profundidad, microinteracciones y adaptación. Cada pasada conserva 15 muestras con tiempo real y el retorno al inicio del bucle. No se reutilizaron cuatro timestamps antiguos como sustituto.

### Secuencia completa observada

Los intervalos son aproximados a partir de reproducción completa y muestras cada ~3 s; no son límites de frames ni mediciones de easing. La inspección adicional pausó el video mediante su control visible. El archivo `paused-reassignment.png` está a ~15,1 s y muestra **servicio**, no reasignación: su nombre no identifica el contenido. `paused-30.80.png` captura una entrada transitoria del diálogo, no un formulario ausente.

| Tiempo aprox. | Pantalla y acción → siguiente contexto | Trabajo e información que entra/sale | Navegación, layout y jerarquía | Movimiento observado / dirección / duración / easing | Imagen y adaptación CargoMesh |
| --- | --- | --- | --- | --- | --- |
| 0–2 s | Detalle V204 → directorio de vehículos | Pasar del vehículo a la flota; sale el detalle completo | Rail retenido; área central cambia | Cambio del contenido; sin duración exacta demostrable | Foto del camión; conservar contexto de navegación |
| 3–6 s | Directorio, filtros y tarjetas de vehículos | Explorar unidades y estados; no aparece el formulario entero | Cabecera/filtros/lista; selección visible | Feedback breve; dirección/timing no medidos | Fotografías pequeñas, no hero por fila; listas carrier primero |
| 7–9 s | Selección V204 → detalle | Foto, conductor y métricas del registro | Identidad del registro domina; acciones en contexto | Entrada del detalle, shell estable; easing percibido suave, sin curva demostrada | CargoMesh: fila seleccionada + detalle y retorno de foco |
| 10–13 s | Gráfico/contexto de servicio → agendar | Se muestra contexto de motor/servicio y acción pertinente | Detalle conserva información alrededor del gráfico | Tooltip/feedback; no se demostró una predicción ejecutable | Mantener gráficos provenientes de registros; rechazar salud/predicción inventada |
| 14–17 s | Diálogo de servicio → confirmar cita | Opciones de fecha, servicio y taller; se oculta trabajo de lista | Modal centrado, tres opciones de fecha y un CTA | Capa sobre contexto; entrada breve, vector/duración exactos no disponibles | Diálogo nativo existente, entrada 240 ms; no inventar agenda nueva |
| 18 s | Retorno al detalle → reasignar | Confirmación y próxima acción | Misma identidad/rail, continuidad de trabajo | Cierre del diálogo y recuperación de contexto; timing no medido | Mensajes de resultado y conflicto fieles a API |
| 19–22 s | Diálogo de reasignación → elegir/confirmar | Tarjetas de conductores, fecha y motivo | Selección clara antes de CTA único | Estado seleccionado + capa/modal; no medición frame a frame completa | Selección carrier, foco y acciones del contrato; no mantenimiento ficticio |
| 23–25 s | Detalle del conductor | Contexto de la persona; sale formulario de reasignación | Identidad y contenido separados de navegación | Cambio del área de trabajo; breve, sin cifras verificables | Un trabajo principal por pantalla; preservar permisos y ownership |
| 26–29 s | Marcus Johnson / contexto de ruta → nueva carga | Datos de conductor, ruta/ETA de la referencia | Detalle contextual, acción relacionada | Feedback del CTA; tiempo/easing no cuantificados | CargoMesh conserva rutas/estados recibidos; no inventa ETA/GPS |
| 30–33 s | Diálogo para asignar carga → buscar/elegir/confirmar | Búsqueda y alternativas de carga | Panel de decisión breve; lista sigue de fondo | Entrada observada; frame pausado 30,8 s está a mitad de transición | Lista → detalle → acción; no atribuir asignaciones sin respuesta backend |
| 34–38 s | Tabla de conductores y estados | Vista general tras la acción; detalle ya no domina | Tabla operativa con estados/acciones | Feedback de fila/contexto; sin benchmark de animación | Filas, búsqueda, paginación y estados nativos en ResourceWorkspace |
| 39–42,3 s | Presentación final del detalle de vehículo → bucle | Cierre visual de la demostración | Perspectiva/zoom del encuadre del video | Transformación cinematográfica de presentación; no prueba de animación WebGL dentro de la app | Rechazar inclinación de toda la UI; usar cámara 3D pequeña solo en visual decorativo |

**Clasificación:** la secuencia y las imágenes anteriores son DIRECT VIDEO OBSERVATION; las capturas pausadas, DIRECT SCREENSHOT OBSERVATION. Inferir que todo ello persiste, usa IA o 3D en runtime sería REASONABLE INFERENCE no verificada, y no se afirma. Las fechas del diálogo son tarjetas de opciones, no un calendario completo. No se descargó el kit propietario ni se copiaron sus assets o su código.

### Patrones aplicados / descartados

| Patrón | Beneficio → equivalente implementado | Decisión |
| --- | --- | --- |
| Contexto estable | Rail/topbar permanecen montados; movimiento solo del contenido | Adaptado |
| Directorio → detalle → acción | Fila resaltada, panel lateral ≥1280, abajo en móvil, foco en heading y regreso a botón origen | Implementado |
| Una acción siguiente dominante | Overview carrier y Panel separan contexto/visual/CTA de tablas y formularios | Adaptado |
| Superficies con profundidad | Navy/teal, acentos violeta, iluminación del modelo y fotografía en ayuda | Adaptado a marca propia |
| Transiciones cortas | Motion 200 ms, panel/diálogo 240 ms, botones 120–160 ms | Implementado con contraste continuo |
| Predicción, salud, automatización, GPS/ETA de referencia | El contrato/dataset CargoMesh no demuestra esas capacidades | Rechazado |
| Inclinación/zoom de toda la UI al final del video | Dificulta lectura y trabajo operativo | Rechazado |

## 3. 3D real en el producto

`LogisticsTruck` se monta en Panel/resumen de solicitud y sus estados sin datos; en carrier Resumen y su acceso sin sesión. Estos son **dos contextos de producto**, no WebGL en todas las pantallas. Canvas ejecutable confirmado en el producto real a 8083, sin fixtures. El visual nunca se coloca en el mapa como GPS ni es un activo asignado.

| Aspecto | Implementación / evidencia |
| --- | --- |
| Motor | Three.js **0.186.1** + React Three Fiber **9.8.1**, React 19 existente |
| Modelado | Original procedural en `src/features/logistics-3d/truck-model.ts`; licencia MIT del proyecto. Sin modelo externo |
| Apariencia | Cabina navy, acento teal, vidrio, espejos, parrilla, faros, depósito/escalones, neumáticos/bujes, remolque acanalado, puertas y luces traseras |
| Geometría | 147 componentes fusionados en **9 meshes/materiales**; **35.444 triángulos**, **25.828 vértices** |
| Texturas | **0**; materiales MeshStandardMaterial con metalness/roughness; sin mapas PBR de textura ni HDRI descargado |
| Exportación | `scripts/export-logistics-truck.mjs`; GLB **1.049.616 bytes** + metadata en `public/v2-workspace/`. El runtime usa el modelo procedural, no descarga el GLB |
| Blender / Drei | Blender comprobado otra vez, no instalado. Drei evaluado, **no instalado**: no se necesitan sus controles/assets/helpers para esta escena |
| Cámara | FOV 31°, perspectiva de producto; leve parallax ±0,28/±0,12 sobre cámara, camión estacionario |
| Luces | Ambiente/hemisferio, luz principal con sombra 512², luz lateral/rim teal; sin HDRI |
| Runtime medido | **19 draw calls / 70.890 triángulos de render** incluyendo shadow pass y plano; difiere del total del modelo. DPR observado **1**, límite configurado **1–1,25** |
| Carga | Next dynamic, SSR desactivado solo para Canvas; render on demand, importación condicionada a escritorio y visibilidad |
| Pausa/liberación | Canvas desmontado fuera de pantalla; frameloop never con documento oculto; liberación de geometrías/materiales y listener de contexto |
| Móvil | Menos de 768 px: poster WebP del mismo modelo; **sin Canvas**. Poster **10.932 bytes**, origen registrado en `assets-research/poster-provenance.json` |
| Fallo | ErrorBoundary, fallo WebGL y timeout 12 s → poster; evento sintético de pérdida de contexto probado explícitamente |
| Reduced motion | Cámara fija; no parallax. QA emula la preferencia en una copia externa; no cambia configuración del sistema |

Prueba de parallax: cámara X observada de -6,6657 a -6,4278 al cambiar el puntero. Con preferencia reducida permanece -6,5. No hay desplazamiento del camión ni ruedas animadas, así que no se insinúa movimiento operacional.

Se corrigió un defecto encontrado en QA: la liberación normal del Canvas podía disparar el listener de fallo. Se elimina el listener antes del desmontaje. Evidencia final: fuera de vista `active=false`, `state=poster`, cero canvases; al volver, `state=webgl`, un canvas. El fallo explícito sigue produciendo fallback.

**Límite de performance:** se midieron tamaño de chunks/assets, draw calls y comportamiento de pausa. No se midieron FPS sostenidos, memoria GPU, Core Web Vitals ni p95 en hardware diverso. No se afirma una mejora numérica de performance. Fiber todavía genera un warning de deprecación de Three.Clock; no es un error del producto ni se parcheó código de terceros.

## 4. Motion y stepper

| Interacción | Comportamiento final | Tiempo / curva | Reduced motion |
| --- | --- | --- | --- |
| Página y paso | `ContentMotion`: y=6 px → 0; **opacity siempre 1**; hijos sin key/remount de controlador | 200 ms, cubic-bezier(.2,.8,.2,1) | Cancela animación y pone y=0 inmediatamente |
| Shell | Rail/topbar fuera del wrapper de contenido; expansión existente por hover/foco conservada | Feedback CSS existente | CSS desactiva motion no esencial |
| Stepper | Indicador de posición de 3 px, estado del paso y título enfocable | 200 ms; posición no equivale a tarea aprobada | Sin transición |
| Lista/detalle | Estado seleccionado; detalle lateral o inferior, traslado/retorno de foco | Entrada de panel 240 ms, translate/scale pequeño | Sin animación |
| Dialog | `<dialog>` modal existente, foco nativo, Escape sujeto a busy; backdrop discreto | 240 ms en superficie; fade solo del backdrop | Sin animación |
| Botones/fila | Hover, pressed, focus-visible y selected diferenciados | 120–160 ms | Sin transformación no esencial |
| Camión | Cámara suave solo al puntero, render demand | Easing exponencial dependiente de delta; sin auto-spin | Cámara fija |

Hallazgo corregido: el fade del contenedor reducía temporalmente el contraste de textos/botones. Se retiró del contenido, panel y diálogo; se conserva el desplazamiento y el fade del backdrop. Las capturas/violaciones iniciales se conservaron como evidencia del defecto, no como resultados finales verdes.

Se retiró además la antigua animación CSS `intake-enter` del cuerpo del formulario: el paso ahora tiene un único motor de entrada y conserva su altura mínima, campos, validaciones y foco.

El flujo **real tiene cuatro pasos**, no cinco estados inventados: **Sedes → Carga y unidades → Ventanas y contactos → Crear y evaluar**. Contexto/ruta están en Sedes; calendario/contactos en el tercero. Los schemas, validación, fechas, mapper e idempotencia siguen siendo los actuales.

QA nueva ejecutó: campos inválidos con foco al resumen; sedes → carga → fechas/contactos → revisión; volver/editar desde revisión; salir al Panel y volver conservando descripción/valores; conflicto 409 con valores intactos y persistencia desconocida. Fechas introducidas mediante controles nativos del navegador después de que fill de datetime-local no disparara correctamente el cambio; no se alteró el DOM ni se modificaron valores de contrato para eludir validación. El envío positivo autenticado no se afirma.

## 5. Revisión de todas las pantallas

Todas las vistas: ES/EN, seis tamaños solicitados; una tarea principal por sección. WebGL e imagen solo donde se indican. Las pantallas de datos usan contratos/controladores existentes, no estados empresariales visuales independientes.

| Pantalla | Cambio / inspiración X / jerarquía | 3D / imagen | Motion / interacción | Responsive / accesibilidad | Restore target |
| --- | --- | --- | --- | --- | --- |
| Coordinador Panel | Resumen actual, siguiente acción y datos de página; visual separado del CTA | Camión compacto real | Cambio de contenido 200 ms | Grid → columna; títulos/gráfico semántico | RESTORE-PANEL-VISUAL |
| Solicitudes | Cola mantiene búsqueda, estado y acciones; sin repetir formulario | Ninguno | Página/hover/focus; selección existente | Tabla con scroll interno, sin overflow raíz | RESTORE-X-REFERENCE-ADAPTATIONS |
| Nueva solicitud | Formulario nativo mantenido; pasos y resumen local | Ninguno | Step motion/indicador; valores sobreviven vistas | Campos/grupos, error/foco, navegación por teclado | RESTORE-STEP-MOTION |
| Revisión | Registro, versión y checks; sin formulario duplicado | Ninguno | Page motion y CTA contextual | Grupos legibles; estado y fuente explícitos | RESTORE-PAGE-MOTION |
| Ruta / seguimiento | Mapa y candidatos mantienen el contexto geográfico | Sin visual decorativo/GPS ficticio | Selección y movimiento de página | Null/legs[]/coords/zero/provider fallbacks | RESTORE-PAGE-MOTION |
| Ayuda coordinador | Guía por trabajo/fuentes en lugar de duplicar detalle | Patio logístico Pexels | Page motion | Imagen separada del texto, caption/enlace real | RESTORE-IMAGERY |
| Carrier Resumen | Contexto carrier, siguiente acción, perfil y conteos consultados | Camión real en hero equilibrado | Page motion/parallax pequeño | Hero → columna/poster; datos siempre visibles | RESTORE-CARRIER-OVERVIEW-VISUAL |
| Red y servicios | Catálogos por área; lista → detalle → revisión | Ninguno | Selección/foco/panel lateral | Panel inferior móvil; tabla/controls | RESTORE-X-REFERENCE-ADAPTATIONS |
| Flota y agenda | Recursos y ventanas por contrato; vacío honesto si no hay activos | No inventar foto de una unidad no registrada | Panel/dialog/botón | Teclado y relación padre conservados | RESTORE-X-REFERENCE-ADAPTATIONS |
| Oportunidades / ofertas | Acción desde oportunidad/registro seleccionado | Ninguno | Selección y dialog contextual | Precio/evidencia/versionado nativos | RESTORE-X-REFERENCE-ADAPTATIONS |
| Operación | Bookings/incidentes/posiciones manuales; datos primero | Ninguno | Panel/action/dialog; sin efecto de movimiento real | Permisos/errors conservados | RESTORE-X-REFERENCE-ADAPTATIONS |
| Mapa carrier | Capas recibidas/selección; no geometría inferida | Sin 3D decorativo | Page motion | Coordenadas ausentes y fuentes visibles | RESTORE-PAGE-MOTION |
| Ayuda carrier | Red/flota/comercial/operación y límites claros | Patio logístico Pexels | Page motion | Figure/caption, texto real, ningún tooltip obligatorio | RESTORE-IMAGERY |
| Flujo shipper existente | No se reemplazó dominio, auth ni mapper de otro owner; formulario compartido recibe el mismo motion | Ninguno | Los cuatro pasos compartidos | Tests vigentes pasan; ruta real bloqueada por configuración auth | RESTORE-STEP-MOTION |

La expansión del rail por hover/foco es un estado transitorio existente: las capturas con rail abierto no representan un nuevo ancho permanente. Las capturas de métricas muestran únicamente filas consultadas; no son KPIs históricos ni capacidad disponible.

## 6. Imágenes, licencias y librerías

Se buscaron alternativas y se descargaron/inspeccionaron tres fotos: [Diego F. Parra](https://www.pexels.com/photo/containers-in-warehouse-24244230/), [Robert So](https://www.pexels.com/photo/trucks-by-warehouse-18468444/), [Juan R. Real](https://www.pexels.com/photo/warehouse-with-delivery-truck-exiting-the-loading-dock-29786116/).

Se seleccionó la vista aérea de Diego por composición y relación con navy/teal. La foto de Robert se descartó por encuadre vertical/identidad corporativa; la de Juan por oscuridad y vista posterior. [Licencia Pexels](https://www.pexels.com/license/) consultada directamente. Foto optimizada localmente a 1200×600 WebP, **137.908 bytes**, sin EXIF, cargada con Next/Image. Caption y enlace al autor; no representa una sede registrada. Hash del original y decisiones en `assets-research/manifest.json`.

| Paquete nuevo | Versión | Uso / pantallas | Impacto / licencia / motivo | Retirada segura |
| --- | --- | --- | --- | --- |
| three | 0.186.1 | Geometría, materiales, renderer; Panel/Resumen | MIT; verdadero 3D propio. Impacto medido del grupo lazy, no de esta lib aislada | Quitar consumidores Canvas/modelo/export, conservar poster/texto; después dependencia |
| @react-three/fiber | 9.8.1 | Canvas React y lifecycle de escena | MIT; compatibilidad React19, carga/pausa/contexto declarativo | Retirar truck-scene/import dinámico antes del paquete |
| motion | 14.0.0 | ContentMotion y preferencia reducida; páginas/pasos | MIT; un motor común, sin tres librerías de animación | Cambiar wrapper por div preservando hijos/foco y preferencia en truck; luego paquete |
| @types/three | 0.186.0 (dev) | Typecheck del modelo/escena/export | MIT; sin runtime/bundle cliente | Quitar solo tras quitar consumidores TypeScript de Three |

Medición local final: el grupo lazy de la escena suma **947.665 bytes minificados / 252.902 bytes gzip**, repartidos en cinco chunks (`verification/bundle.json`). No se atribuye ese total a cada paquete ni se suma cinco veces. Build First Load JS: carrier **202 kB**, workspace **225 kB**; log histórico B2 anterior: **155 / 180 kB**, diferencia **47 / 45 kB**. Es una comparación de build local, no un benchmark de carga percibida. Three se importa cuando la escena es elegible/visible; móvil permanece con poster.

No se instalaron Drei, Rive, Lottie, GSAP, AutoAnimate, otro framework de tablas ni otro sistema de primitives. CSS Modules sigue vigente; no se migró a Tailwind. Dependencias instaladas en un árbol local aislado para no modificar las de la copia antigua enlazada. Package/lock incluyen únicamente las nuevas dependencias/resoluciones necesarias. Las licencias instaladas se comprobaron.

## 7. Verificación nueva y límites

| Gate | Resultado | Evidencia nueva |
| --- | --- | --- |
| Typecheck | PASS | `verification/typecheck.log`, Node/tsc actual, exit 0 |
| Tests | PASS **648**, 0 fallos, 24 suites | `test-results.json`, TAP/log de cada suite; 21 leaf scripts release (572), intake40, mapa10, foco carrier/workspace/3D26 |
| Architecture | PASS **321 módulos / 44 entradas cliente** | `architecture.log` |
| Build producto | PASS | `product-build.log`; build final después de fixes, servido a 8083 |
| Git diff --check | PASS | `diff-check.log`; no commit/publicación |
| Matriz responsive/i18n/Axe | PASS local visual | 156 combinaciones =13×6×2, más 13 rechecks después del ajuste de preferencia; 0 violaciones automatizadas/overflow raíz en resultados finales |
| QA visual/manual | PASS en copia explícita | 26 capturas adicionales de vistas desktop/móvil, DOM, teclado, detalle/cierre/Escape, stepper/409 |
| 3D real / lifecycle | PASS | Producto 8083 y harness: Canvas, parallax, poster móvil, contexto perdido, pausa y reentrada |
| Reduced motion | PASS bajo emulación QA | `reduced-motion-final`, cámara fija -6,5; wrapper y=0/opacity1. No se cambió preferencia OS |
| Mapas negativos | PASS | routePreview null, cero `ineligible`, legs[] SIMULATED, coords nulas, selección de segundo candidato, proveedor indisponible; sin trazas inventadas |
| Persistencia / Google positivo / cross-team | BLOCKED | Sin sesión/grants/dataset local autorizado; no es PASS por usar fixtures |

Viewports reales leídos del DOM: **1920×1080, 1600×900, 1440×900, 1280×800, 1024×768, 390×844**, ES y EN. Las capturas nativas finales complementan capturas fullPage; estas últimas pueden reflejar el estado de hover o un frame de transición. No se certifica WCAG completo con Axe: lectura humana, zoom/AT completos y hardware real adicional siguen siendo trabajo de QA.

Los comandos se descubrieron en package.json. El pnpm global rechazaba ejecutar scripts sobre la junction de otro árbol; se invocaron los **mismos comandos leaf**, con Node/tsx y argumentos estructurados. No se afirma que `pnpm test:release` como comando agregado pasó. `run-gates.cjs` conserva la expansión exacta. Un intento inicial de runner Windows y una ruta equivocada de script architecture fueron corregidos y no se cuentan como pruebas verdes.

### Limitaciones de entorno observadas

- El producto real devuelve 401/datos no disponibles sin sesión; no se insertan filas QA en su lugar.
- `/freight-request/new` real produce una excepción SSR por ausencia de configuración local de Supabase. Se verificó la causa en log de servidor sin publicar valores. No se modificó auth/SSR de otro owner para ocultarla. El formulario compartido se verificó en la copia QA y con tests; el runtime shipper positivo sigue BLOCKED.
- La copia QA no lleva .env ni claves. El mapa declara proveedor no disponible y conserva datos. El botón de fallo Google no demuestra conexión Google exitosa.
- Sin Docker/Supabase/grants locales útiles, no se confirma escritura/round trip E2E; no se aplicaron migraciones/seed remotos.
- Un error de hidratación al añadir CSS de preferencia reducida al **harness** fue corregido sincronizando su primera renderización SSR/client. Se conservaron logs históricos; no es un defecto nuevo desplegado en el producto.
- Warning Three.Clock de Fiber presente; sin errores nuevos de WebGL/hidratación en las vistas públicas de producto revisadas. El error de entorno shipper se documenta aparte, no se borra del resultado.

## 8. Reversibilidad y archivos

Consultar `UX_UI_REDESIGN_RESTORE_MAP.md`, sección **B2 / 8 octubre**. Se guardan archivos exactos antes/después, hashes, patches binarios, inventario y helper de dry-run. B0/B1 son históricos y no deben reemplazar controladores conectados para deshacer únicamente apariencia.

Archivos de esta pasada: package/lock; `features/logistics-3d/*`; `features/product-motion/content-motion.tsx`; exportador; GLB/metadata/poster/foto; `carrier-portal/{coordinator,portal,request-summary,guidance-image}` y CSS; intake TSX/CSS; este informe, aviso histórico, friction log y restore map. Inventario exacto delta B2 y patches en `final-snapshot/manifest.json`. API, schemas, mappers, migraciones y lógica de ranking/comercial no se cambiaron por esta pasada visual.

Targets nuevos: RESTORE-X-REFERENCE-ADAPTATIONS, RESTORE-3D, RESTORE-3D-TRUCK, RESTORE-3D-SCENE, RESTORE-TRUCK-MOTION, RESTORE-STEP-MOTION, RESTORE-PAGE-MOTION, RESTORE-PANEL-VISUAL, RESTORE-CARRIER-OVERVIEW-VISUAL, RESTORE-IMAGERY, RESTORE-R3F, RESTORE-MOTION-LIBRARY. RESTORE-RIVE es no-op explícito porque no se instaló.

## 9. Skills usadas y cierre

| Skill | Motivo | Resultado |
| --- | --- | --- |
| professional-project-orchestrator | Enrutar continuación amplia y elegir especialidades necesarias | Skills limitadas por fase |
| frontend-design | Composición, jerarquía y adaptación del video | Pantallas por tarea y visual original |
| planning-with-files | Baseline y trabajo largo | Plan/progreso externos, no incluidos en commit |
| react-best-practices | Lazy Canvas, estado estable y ciclo de vida | Sin remount del formulario, imagen y escena condicionadas |
| a11y-audit | Contraste, foco/teclado y responsive | Defecto de fade corregido, matriz y límites documentados |

Se usó el navegador integrado de Codex; su documentación de computer-use fue consultada. No hubo automatización de otra aplicación Windows ni se inventó una skill verification ausente.

APPLICATION: **LOCAL ONLY**.

3D: **IMPLEMENTED IN ACTUAL LOCAL PRODUCT**.

X REFERENCE: **RE-ANALYZED**, identidad directa, ocho pasadas.

MOTION: **IMPROVED AND VERIFIED** en producto/QA documentado.

STEPPER: **IMPROVED AND VERIFIED** para UI/estado/errores con cuatro pasos reales; runtime autenticado BLOCKED.

INTERNET: usado para referencia, documentación, assets/licencias y npm oficial.

HOSTED SUPABASE / VERCEL / PRODUCTION / MAIN: **NOT MODIFIED**.

PUSH: **NO**. PR: **NO**. MERGE: **NO**. Commits: **NINGUNO**.
