# CargoMesh V2 — refinamiento local de producto y HAC-43
> **Informe histórico del 7 de octubre.** La continuación del 8 de octubre implementa Three.js/R3F y Motion reales. Consultar [informe vigente](HAC43_VISUAL_CORRECTION_2026-10-08.md) y sección B2 del restore map; no interpretar los NO/NOT USED anteriores como estado actual.


Fecha: 8 de octubre de 2026, America/Lima. Responsable FE: Juan Antonio Coronado Palacios.

## 1. Resultado y límites de esta entrega

**IMPLEMENTACIÓN LOCAL PARCIAL; HAC-43 NO COMPLETADO.** Hay frontend conectado al contrato V2, build y pruebas verdes. No existe evidencia positiva de persistencia, oferta atribuible recuperada por el shipper, permisos entre tenants ni aceptación del flujo integral entre roles. Hay QA visual sintético de las 13 vistas implementadas y del formulario compartido. Este documento no autoriza cerrar la issue ni abrir/publicar un PR.

La implementación incluye dos entradas reales: `/v2-workspace` para coordinación y `/carrier-portal` para transportista. La API es la fuente de datos empresariales. Se retiró del montaje del nuevo workspace el controlador anterior de borrador empresarial en localStorage; no se borró ese controlador histórico ni se lo reutiliza para superar un fallo de API. Las preferencias de idioma permanecen en el proveedor existente de i18n.

No se modificaron handlers, schemas compartidos, servicios de dominio, migraciones ni RLS. No se utilizaron servicios alojados de Supabase para probar. El trabajo anterior se conserva fuera de esta copia para comparación.

## 2. Snapshot, Linear y jerarquía

| Elemento | Verificación |
| --- | --- |
| Base y HEAD local | `codex/v2-amazon-contracts@50c12d115dd9b2171d9375acd215593de29e8f34` |
| Estado Git | Worktree separado, HEAD detached, modificaciones locales sin commit |
| Revalidación remota final | Fetch de la base; el SHA remoto sigue siendo `50c12d1…` |
| Rama HAC-43 propuesta | `codex/v2-full-carrier-operations`; aprobación de manifiesto no encontrada; NO creada |
| Target propuesto | `codex/v2-amazon-contracts`, nunca `main` |
| HAC-43 | **Pendiente**; relectura final conserva actualización `2026-10-04T22:32:33.515Z` |
| HAC-41 | **Pendiente**; relectura final conserva actualización `2026-10-05T04:01:16.279Z` |
| HAC-42 | Pendiente en lectura de esta ejecución; Luis es dueño del flujo shipper |
| HAC-44 | In Progress en lectura de esta ejecución; QA/dataset integral no certificado localmente |
| HAC-39 / HAC-40 / HAC-27 | Done en Linear leído; no se convierte ese estado en certificación de las 57 clases ni del entorno local |

Fuentes: [HAC-43](https://linear.app/hackatonteamcargomesh/issue/HAC-43/fe-2-completar-portal-carrier-operacion-y-mapa-conectado), [documento de recuperación V2](https://linear.app/hackatonteamcargomesh/document/recuperacion-cargomesh-v2-backend-der-endpoints-y-flujo-completo-3-oct-304a0877544b), `AGENTS.md`, `CURRENT_DELIVERY_STATE.md`, `HAC40_FULL_API_AND_CLOSURE.md`, `HAC40_API_ENDPOINTS.md`, `HAC40_WORKFLOW_API.md`, inventarios completos del modelo y schemas/routers actuales.

Se distinguió el estado live de Linear de documentos de gates anteriores. La promoción a main comunicada por el líder y PR #108 es contexto de otro actor; no es autorización para modificar main. Se descartaron como instrucciones vigentes: la base V1 `codex/c-mcp-contracts`, la limitación anterior a un mapa aislado HAC-15, la exclusión de 21 clases del modelo completo y la interpretación de fixtures V1 como capacidades V2.

## 3. DoD y dependencias

| Requisito actual | Código FE | Tests / runtime | Estado de aceptación |
| --- | --- | --- | --- |
| Carrier, servicios, cobertura, lanes, depots | Recursos y schemas nativos, alta/revisión/detalle | Contratos; interacción de depot con harness explícito; sin DB | PARTIAL |
| Activos, conductores, combinaciones, cupos, calendarios, asignaciones | Formularios cerrados y colecciones del carrier | Build/typecheck; sin datos reales persistidos | PARTIAL |
| Oportunidades / respuesta | Endpoint atribuible del carrier y versión esperada | Tests del cliente y backend en la base; positivo local autenticado pendiente | PARTIAL |
| Oferta propia, revisión y retiro | MANUAL; desglose/moneda/vigencia/evidencia; sustitución mediante `supersedesOfferId` | Sin oferta positiva real recuperada por shipper | BLOCKED |
| Booking / reservas / ejecución / consolidación LTL | Comandos nativos, sin setters arbitrarios de estado | Contratos; positivo completo sin demostrar | PARTIAL |
| Incidentes e historial | Contexto de ejecución/incident y commands nativos | Sin persistencia real de incidente | PARTIAL |
| Mapa conectado | Sedes, posiciones, nodos, condiciones y áreas publicadas; Google real cuando carga | Modelo de geometría probado; Capas/selección/nulos/procedencia verificados en QA explícito; render Google positivo bloqueado por origen no autorizado | PARTIAL |
| Rutas, recursos y eventos sobre el mapa | Ruta ROAD reutiliza mapper; posiciones e historias separadas; sin unir nodos con trazas inventadas | No hay adaptador verificado para dibujar trayectorias de ejecución / eventos sin coordenadas | PARTIAL |
| Persistencia en API, no localStorage empresarial | Cliente mismo origen, sesión, envelope V2, sin fallback | API real devuelve 401 sin sesión; no escritura positiva | BLOCKED RUNTIME |
| Permisos carrier y aislamiento entre tenants | Scope explícito, parse de carrierId; backend decide cada comando | 401 real; 403/409 del cliente probados; no prueba de grants/RLS real local | BLOCKED |
| UX/UI producto completo | 6 vistas coordinación, 7 carrier; formulario del shipper existente embebido | 196 muestras QA: 156 de vistas, 16 de pasos, 20 de edges y 4 de regresión del rail. Shipper/comercial completo y QA autenticado pendientes | PARTIAL |
| Handoff / trazabilidad / reversión | Reporte, inventario de 57 clases, manifest, snapshots y mapa de restore | Restoration no aplicada al producto; grupos compartidos requieren selección de hunks | PARTIAL para restauración semántica por pantalla |

Bloqueos externos: HAC-41 debe proveer la sesión V2, grants y discovery de carrier; HAC-42 conserva decisiones/ranking y el flujo comercial del shipper; HAC-44 provee datos del modelo y QA real. No se modificaron esas tareas para cerrar el alcance artificialmente.

## 4. Arquitectura de información y datos compartidos

Antes: workspace con escenario local, tabla y mapa repetidos, controlador empresarial de navegador y gran contenido visual en el Panel. La copia anterior tuvo refinamiento de sus pantallas; sigue siendo evidencia de trabajo local, no prueba de conexión al backend actual.

Después: coordinación separa resumen, directorio, captura, revisión, ruta y ayuda. Carrier separa red, flota, comercial, operación y mapa. La vista no ofrece cambiar de rol como si concediera autorización. Los enlaces entre portales solamente navegan; la API verifica la sesión y permisos.

`ConnectedCoordinator` mantiene una solicitud persistida, `draftVersion`, evaluación correlacionada y `selectedCandidateId`. `V2IntakePrototype` se reutiliza con `embedded`, `onPersisted` y `onEvaluation`, sin modificar su payload ni su mapper. `onPersisted` se emite después del GET de round trip; la evaluación se acepta cuando coinciden solicitud y versión. Cambiar solicitud o refrescar limpia selección/evaluación anterior. Consultas tardías no deben contaminar el registro nuevo.

El enlace “saltar al contenido” no cambia de sección al cambiar el hash de ancla. La sidebar se amplía al hover o foco en escritorio; móvil usa navegación inferior con nombres cortos visibles y nombres accesibles completos.

## 5. Inventario de pantallas

En todas las vistas carrier hay datos consultados, loading, error, vacío y validación; no hay métricas ficticias. Las tablas buscan solo en la página recibida y muestran paginación explícita. Todas las vistas nuevas comparten foco visible, landmarks, controles nativos y estilo responsive. Se verificaron seis anchos y ES/EN de las 13 vistas nuevas. Esto no cubre todos los formularios/commands ni la superficie comercial completa del shipper.

| Pantalla | Trabajo principal / cambio | Información eliminada o movida | Alineación / visual / motion / restore |
| --- | --- | --- | --- |
| Coordinación / Panel | Continuar una solicitud recibida; gráfico de distribución de la página y ventanas reales | Mapa completo pasa a Ruta; no hay analítica histórica inventada | API freight; donut SVG, ilustración decorativa; `RESTORE-COORDINATION-PANEL` |
| Solicitudes | Buscar, filtrar y seleccionar | Formulario y mapa no se repiten | Tabla semántica; scroll contenido en móvil; `RESTORE-COORDINATION-REQUESTS` |
| Nueva solicitud | Origen/carga/fechas/revisión del formulario existente | Ejemplo local oculto en montaje embebido; header técnico reducido | HAC-14/HAC-42, cuatro pasos del contrato actual; no se inventa un quinto estado de dominio; `RESTORE-NEW-SHIPMENT` |
| Revisión | Registro persistido y checks de cobertura de su versión | Decisión comercial permanece en flujo shipper | Detalles progresivos; no dice que revisión equivale a booking; `RESTORE-COORDINATION-REVIEW` |
| Ruta | Candidatos y mapa del mismo registro | No toma un borrador paralelo ni simula GPS | Props canónicas, Google según renderer; `RESTORE-COORDINATION-TRACKING` |
| Ayuda coordinación | Estados, fuentes, permisos y continuidad | Explicaciones recurrentes se reúnen aquí | Texto accesible sin modal obligatorio; `RESTORE-COORDINATION-HELP` |
| Carrier / Resumen | Volumen de la página y perfil autorizado | No confunde cuenta de resultados ni KPIs operativos con conteos parciales | Barras SVG/CSS y siguiente área; revisión de perfil vuelve a consultar; `RESTORE-CARRIER-OVERVIEW` |
| Red y servicios | Depots, servicios, áreas, lanes, socios y límites | Cobertura se edita bajo su servicio; una sede no concede cobertura | Tabs/tabla/diálogo de revisión; `RESTORE-CARRIER-NETWORK`, `RESTORE-CARRIER-DEPOTS` |
| Flota y agenda | Activos, conductores, combinaciones, capacidades, calendarios y asignaciones | No se crea “disponibilidad” desde capacidad declarada | Formularios por schema, ventanas y estados nativos; `RESTORE-CARRIER-RESOURCES`, `RESTORE-CARRIER-CAPACITY` |
| Oportunidades / Ofertas | Responder, emitir, sustituir y retirar con evidencia | No se fabrica precio ni fuente API/MCP al registrar manualmente | Formularios de confirmación, sin fallback; `RESTORE-CARRIER-OPPORTUNITIES`, `RESTORE-CARRIER-OFFERS` |
| Operación | Bookings, holds, ejecución, posiciones, incidentes, eventos y LTL | Seguimiento manual no se denomina GPS live | Acciones versionadas, parent explícito; `RESTORE-CARRIER-BOOKINGS`, `RESTORE-CARRIER-OPERATIONS`, `RESTORE-CARRIER-INCIDENTS` |
| Mapa carrier | Capas recibidas, selección y procedencia | No dibuja lanes/corridors como líneas rectas ni recursos sin posición | Google con atribución, proporciones adaptativas; `RESTORE-CARRIER-MAP` |
| Ayuda carrier | Guía por trabajo, estado y fuente | Explicaciones de permisos centralizadas | Texto real, navegación teclado; mismo target ayuda/global |
| Shipper restante | Implementación vigente de Luis; no duplicada ni reemplazada | No se inventó dashboard comercial, decisiones ni nuevas mutaciones fuera de su ownership | `RESTORE-CLIENT-*`: sin cambio nuevo; aceptación product-wide pendiente |

La cola “Mesa de carga” de la copia anterior no se presenta como implementación comercial completa en el nuevo coordinador. Un gráfico resume datos consultados; no prueba cobertura ni capacidad disponible.

## 6. Handoff de componentes y contratos

- Montaje: `src/app/v2-workspace/page.tsx` → `ConnectedCoordinator`. `src/app/carrier-portal/page.tsx` → `CarrierPortal`.
- Mapa ROAD: `mapServiceabilityToMapViewProps(request,evaluation,selectedCandidateId,onSelectCandidate)` produce las props de `RoadCandidateMapView`. No mapear otra solicitud, no usar una evaluación de otra `draftVersion` ni seleccionar el primer candidato si el anterior ya no existe.
- `routePreview:null`, `legs:[]`, coordenadas ausentes/invalidas, cero candidatos o fuente UNKNOWN no crean geometría. Tramos separados no se unen con un puente inventado. SIMULATED conserva su etiqueta; el proveedor visual y el proveedor de ruta se comunican por separado.
- Mapa carrier: API → records validados → puntos o geometría de áreas validada. Un área por país/ciudad sin polígono permanece textual; no se geocodifica para inventar un área. Polygon/MultiPoint se dibujan como registro publicado, no como elegibilidad confirmada.
- Asset sin coordenadas se administra en Flota, no se sitúa arbitrariamente en el mapa. Eventos sin posición siguen en el historial. Corredores sin geometría no se presentan como carreteras exactas.
- La geometría ROAD, incluso con Google Routes, no certifica restricciones de camión, capacidad, frontera, booking ni despacho.
- Nota de provider adicional, pequeña, debajo del mapa; el logo/terms/atribución obligatoria de Google permanecen visibles. Nunca se menciona Google Routes si no suministró el resultado.

## 7. Formularios, tablas, errores y permisos

Los formularios usan `CatalogInputsV2` y `WorkflowInputsV2`. Las revisiones eliminan campos calculados del output y envían `{expectedVersion,value}` cuando el router lo requiere. Comandos auditados mantienen la versión esperada del registro. Una sustitución de oferta es una nueva oferta bajo su oportunidad, con `supersedesOfferId`, no un endpoint de edición inventado.

Antes de POST hay revisión legible de datos; no se envía un JSON editable como formulario normal. Fechas usan datetime-local y conservan timezone explícito en el payload. Campos no disponibles se mantienen null/ausentes según el schema. Foco va al primer control inválido o al resumen de coherencia. Diálogo nativo usa Escape, foco y confirmación; Escape se bloquea mientras existe envío activo para no abandonar una petición sin resultado.

Idempotency-Key se conserva únicamente para reintentar el mismo comando y payload. Un cambio real produce una nueva clave. 401 pide sesión, 403 conserva denegación, 409 pide volver a consultar; no se convierten en éxito con fixtures. El error visible no expone claves, endpoint, SQL, project ID, quota ni variables internas.

El directorio usa límites 25; map/pickers hasta 100. Son subconjuntos explícitos, no catálogos completos. Buscar filtra lo recibido. Identificadores de relación todavía necesitan UX de discovery/selección más rica y datos reales para el smoke integral; no se simula esa disponibilidad.

## 8. Diseño visual y movimiento

Paleta nueva: canvas `#F3F6F9`, tinta `#163349`, secundario `#566D81`, bordes `#D9E4EC`, azul acción `#185BE7`, teal `#00747C`, acentos violeta y ámbar en resúmenes. Surfaces blancas, sombra suave y radios 8–12px; jerarquía de trabajo, no efecto de neón dominante. Texto 14px, auxiliares 12px, títulos 25–32px; controles 42–44px. Tipografía Arial del sistema en shell nuevo, con familia heredada del intake actual. No se declara que se descargó una fuente nueva.

Desktop: rail 72px y expansión por foco/hover a 240px; content fluido con padding 20–44px. Mapa 4:3, móvil cuadrado y límite de altura en escritorio ancho. Mobile no oculta el peso/carga para evitar perder un dato relevante; tabla puede desplazarse dentro de su contenedor.

Movimiento nuevo: rail 160ms, etiquetas visibles sin desvanecimiento para mantener contraste, feedback 140ms y entrada del cuerpo embebido 180ms/5px. El cuerpo se desplaza sin reducir opacidad del texto, para conservar contraste durante la entrada. La entrada del cuerpo ocurre al montar la región; no se certifica que todas las transiciones entre pasos midan 180ms. `prefers-reduced-motion` elimina animación/transición. No se anima el mapa ni un camión como señal falsa de GPS.

Visual propio: ilustración SVG logística de profundidad 2.5D, decorativa y sin coordenadas ni vehículo asignado. No es un modelo 3D interactivo ni un render producido en Blender. El logo es el activo suministrado por el usuario/base; no se atribuye una licencia stock externa. Se usa Next/Image para evitar servir el PNG de aproximadamente 1.48 MB como icono de 42px; la optimización no altera el archivo original.

## 9. Investigación y decisiones de tecnología

Se estudió [FleetFlowAI](https://x.com/iliasconfidency/status/2107184046220738959?s=20): detalle de vehículo (10.1s), reasignación (20.18s), contexto de conductor (26.37s), tabla operacional (38.48s). Esos puntos son evidencia de revisión; no se afirma haber realizado siete pasadas completas del video. [Keystone en Dribbble](https://dribbble.com/shots/27773468-Keystone-CRM-Morning-Brief-for-Real-Estate-Agents) quedó limitado por CAPTCHA; no se inventó una revisión de su video ni se eludió el control.

[21st.dev Stepper / Origin UI](https://21st.dev/@originui/components/stepper) aportó patrones de progreso y jerarquía; [ReactBits Status Mark](https://reactbits.dev/c/micro/status-mark) aportó feedback corto. Se adaptaron principios a controles y estado existente; no se instaló un paquete o se pegó un componente que requiriera otro framework. La metadata MIT del ejemplo 21st se distinguió de un permiso general para cualquier asset de la plataforma.

La foto de almacén de Unsplash estudiada se rechazó por orientación/composición; no se descargó ni incorporó. Se consultó su licencia, sin atribuirla a otras imágenes. Kenney fue descartado por lenguaje visual de videojuegos; no se verificó una licencia de un pack individual. Motion/R3F y glTF se consideraron, pero no se incorporaron. Blender no está disponible y su referencia de exportación no se pudo verificar en la consulta; no se instaló ni se ejecutó.

| Tecnología | Decisión / motivo |
| --- | --- |
| Tailwind | EXISTING / REJECTED como migración; no activar pipeline global para reemplazar CSS Modules |
| CSS Modules | USED; aislamiento y tokens semánticos |
| shadcn / Radix | EXISTING patrones revisados; diálogos nuevos nativos, sin dependencia nueva |
| React Aria | REJECTED; controles nativos y semántica, no duplicar framework de accesibilidad |
| TanStack Table / Query | NOT USED; paginación API simple, AbortController y tablas semánticas actuales |
| React Hook Form | NOT USED; no introducir otro controlador de dominio |
| Zod 3.25.76 | USED / EXISTING; payload y output según contratos actuales |
| Motion / GSAP / Rive / Lottie | NOT USED; feedback corto CSS, sin animaciones continuas |
| Three.js / R3F / Drei / WebGL | NOT USED; no hay interacción 3D operacional que justifique coste o contexto |
| SVG | USED; gráficos derivados e ilustración original, no GPS ficticio |
| Canvas | EXISTING Google Maps renderer; no se desarrolló motor gráfico propio |
| Blender / herramientas glTF | NOT USED; no existe GLB, render Blender ni certificación de 60 FPS |
| Next/Image | USED / EXISTING; optimización del logo local conservando fuente original |
| Lucide | USED / EXISTING; iconos funcionales y decorativos aria-hidden |

Dependencias nuevas de aplicación: **NINGUNA**. package.json y lockfile sin cambios. Axe 4.14.0 fue herramienta externa de QA (MPL-2.0), no dependencia de producto; harness y asset se mantienen exclusivamente en una copia externa de QA; la app entregada no los incluye y responde 404 en /qa-hac43. Tamaños de build no equivalen a Core Web Vitals.

## 10. Verificación y evidencia

| Comprobación | Resultado | Alcance / limitación |
| --- | --- | --- |
| Cliente carrier + geometría + mapa + mapper | PASS 29/29 | Sesión mismo origen, deny/error, idempotencia, scope, formas, fecha, coordenadas y mapa honesto |
| Suite v2-intake | PASS 40/40 | Modelo/client/provenance/mapper y correlación de request/version/selección |
| Test release — hojas del script vigente | PASS 572/572 | Ejecutadas con npm equivalente; no se suman con otras suites como si no existiera solapamiento |
| pnpm test:release literal | BLOCKED antes de tests | pnpm rechaza node_modules junction; no es fallo del código ni un PASS literal |
| Typecheck | PASS | `tsc --noEmit`, fuente final |
| Architecture | PASS | 316 módulos, 41 entradas cliente; comprobación final posterior a los cambios TSX |
| Build | PASS | Next 15.5.24; sin rutas/harness QA en build entregado |
| Lint | NOT AVAILABLE como script | package.json no define lint; no se inventó comando ni sustituyó por typecheck |
| git diff --check | PASS | Sin errores de whitespace; CRLF configurado en Windows puede emitir avisos |
| Smoke HTTP real local | PASS | Páginas 200, harness 404, APIs protegidas 401; no prueba hidratación, teclado ni persistencia |
| Docker / Supabase / pgTAP | BLOCKED | Docker no disponible; no instalación ni ejecución remota |
| E2E oferta propia → shipper | BLOCKED | Falta entorno/grant autenticado y dataset completo |

Evidencia local externa conservada: logs de comandos, JSON de lectura Linear, capturas antes/después, pruebas de mapa, fuente del harness sintético y snapshots de archivos. El índice local indica los nombres exactos; no se incorporan claves ni .env a los snapshots.

### Browser QA: evidencia final y sus límites

Se recuperó el control del navegador integrado de Codex y se completó QA en una copia externa con **QA EXPLÍCITO — DATOS SINTÉTICOS EN MEMORIA — SIN PERSISTENCIA**. Se usó build de producción local para evitar confundir el overlay de desarrollo con el producto. No se automatizó un navegador externo ni se inyectaron evaluaciones/credenciales en la app real. El adaptador sintético intercepta únicamente /api/v2 dentro de esa copia y no escribe en DB.

| Muestra | Cantidad | Resultado observado |
| --- | --- | --- |
| 6 vistas coordinador × 6 anchos × ES/EN | 72 | Datos sintéticos recibidos, navegación, revisión y selección; Axe sin infracciones y sin overflow raíz |
| 7 vistas internas carrier × 6 anchos × ES/EN | 84 | Carrier sintético validado antes de recorrer tablas/acciones/vacíos/mapa/ayuda; Axe sin infracciones y sin overflow raíz |
| 4 pasos del formulario × 1440/390 × ES/EN | 16 | Campos/revisión, retroceso, fechas y peso conservados; Axe sin infracciones |
| 5 edges mapa × 1440/390 × ES/EN | 20 | null, cero/ineligible, legs vacíos, coordenadas nulas, selección de dos candidatos; 20 assertions PASS |
| Regresión rail carrier × 1920/390 × ES/EN | 4 | Nombre completo por foco, móvil legible, sin desvanecimiento que reduzca contraste |

**196 muestras con cero infracciones reportadas por Axe y cero desbordamientos de raíz.** Anchos: 1920, 1600, 1440, 1280, 1024 y 390. No es una certificación completa WCAG: Axe dejó comprobaciones incompletas de gradientes/números; se calculó la paleta y 14 pares de endpoints reales, mínimo 4.88:1. Diálogos nativos se comprobaron por interacción/teclado, no mediante una ejecución Axe desde el botón exterior mientras el diálogo está modal.

La primera matriz carrier de esta continuación correspondía a la compuerta de acceso (salvo Ayuda); se archivó en after/access-gate y verification/access-gate. **No se cuenta como evidencia del contenido carrier.** Los 84 archivos finales de carrier se reemplazaron con capturas del contenido autorizado por el harness. La captura overview desktop antigua que mostraba Network y la evidencia anterior de la copia B0 tampoco se cuentan en esta matriz.

Se observaron validación con foco en el primer campo inválido carrier y resumen inválido intake; revisión legible antes de envío; respuesta 409 sintética con formulario abierto y código conservado; Escape con retorno de foco al botón de apertura. Se usó Enter para navegar/seleccionar y confirmar el comando sintético. El botón flotante ya no tapa la navegación inferior. Los datetime-local se ingresaron con cambios nativos de teclado porque fill aislado no actualizaba el valor controlado en el adaptador del navegador. No se modificó el controlador de fechas para el test.

Mapa: se observaron listas, capas, selección, área de servicio recibida y condición SIMULATED; el nodo sin coordenadas sigue en la lista y no se coloca en un centro de ciudad. Google rechazó el origen QA 8084 con RefererNotAllowedMapError; es evidencia directa del fallo en esa copia, no un PASS del renderer positivo. Se retiró la sustitución automática por OSM que la prueba detectó en el canvas ROAD. Ambos mapas conservan contexto/listas ante fallo; no se generan trazas, distancia ni tiempos desde endpoints. No se cambió la restricción de la clave en Cloud.

El montaje compartido pasa ES/EN en las vistas muestreadas. Los textos de entidades retornadas por la API y códigos del contrato se preservan; no son prueba de traducción del catálogo. El asistente conversacional existente conserva contenido mixto y su interpretación/mensajería pertenece al flujo HAC-42; se corrigieron únicamente el launcher accesible y su integración móvil. No se declara una demo completamente traducida del producto comercial.

En la app real, HTTP confirma páginas 200, QA 404 y APIs 401 sin sesión; el navegador confirma el error de acceso sin activar ejemplos. Pendiente: permisos revocados/otro tenant, round trip DB, oferta propia/sustitución/retiro recuperada por shipper, booking/operación/incidentes completos y render Google positivo bajo un origen autorizado. Reduced motion se verificó por reglas de código; no se afirma medición de la preferencia del sistema ni FPS, LCP/INP/CLS, p95 o SLA.

## 11. Skills efectivamente utilizadas

| Skill | Motivo | Resultado |
| --- | --- | --- |
| professional-project-orchestrator | Enrutar trabajo amplio y limitar carga de skills | Selección por fase, sin instalar tecnologías por disponibilidad |
| planning-with-files | Alcance largo, baseline y dependencias | Plan y progreso locales no publicados |
| frontend-design | Arquitectura y presentación del producto | Vistas por trabajo, jerarquía y estados honestos |
| design-system | Paleta, tamaños, superficies y estados | CSS Modules y tokens, sin framework nuevo |
| react-best-practices | Estado compartido, lecturas cancelables e imagen | Callbacks de round trip, cancelación y Next/Image |
| a11y-audit | Semántica, teclado y contraste | Contraste/transiciones/etiquetas y teclado corregidos; 196 muestras Axe, comprobación de paleta y límites de certificación explícitos |
| verification-before-completion | Comparar afirmaciones con pruebas y DoD | Se conserva PARTIAL/BLOCKED y evidencia por entorno |

El runtime de browser se usó durante la etapa de QA. La documentación de computer-use se consultó para recuperar capacidades al cambiar el runtime, pero no se automatizó una aplicación Windows y no se cuenta como skill de implementación. No se usaron Blender, Three, Supabase remoto ni skills de deployment. Las skills cargomesh-* nombradas por AGENTS no aparecieron en la búsqueda acotada de skills instaladas; se usaron los contratos locales y Linear, no skills inventadas.

## 12. Riesgos y acciones para el equipo

| Nivel | Riesgo / owner | Acción |
| --- | --- | --- |
| ALTO | Entorno positivo no validado — Axel / QA / Juan | Proveer cuenta V2/grant y datos locales autorizados; ejecutar round trip y carrier→shipper |
| ALTO | Contratos de identidad/issuer aún pendientes — HAC-41 | Resolver CarrierOperator vs Member y discovery de carrier; no inventar un endpoint FE |
| MEDIO | Cobertura de UI y QA integral incompleta — Juan / Luis / QA | Smoke visual sintético cerrado para 13 vistas; terminar smoke autenticado conjunto y flujo shipper/comercial sin clonar controladores |
| MEDIO | Referencias de relaciones requieren entrada/pickers parciales — Juan | Añadir discovery autorizado y paginación completa donde el contrato/entorno lo permitan |
| MEDIO | Rutas/recursos/eventos del mapa no todos tienen geometría — backend / Juan | Consumir geometría real publicada; mantener desconocido cuando falte |
| MEDIO | Restauración por pantalla comparte controladores/styles — Juan | Seleccionar hunks y preservar API/bindings; no restaurar localStorage empresarial como rollback visual |
| BAJO | Junction local de dependencies — entorno | Usar checkout/dependencias normales al preparar PR; preservar la otra copia |
| BAJO | Estado de docs de gate no coincide con Linear live — Tech Lead | Reconciliar evidencia por SHA/entorno antes de declarar aceptación completa |

## 13. Restauración, Git y próximos pasos

Ver `UX_UI_REDESIGN_RESTORE_MAP.md`, `HAC43_MODEL_TRACEABILITY.md` y `HAC43_FRONTEND_ENDPOINT_MATRIX.md` (28 grupos y paths nativos). Snapshots de antes/después y SHA permiten revertir archivos concretos sin reset, sin perder el trabajo previo y sin borrar ramas. Restaurar una apariencia dentro de un controlador compartido exige seleccionar hunks; no se promete independencia automática de todos los targets. No se ejecutó ninguna restauración del producto como “prueba” destructiva.

El acceso local inicia el servidor después de reiniciar Windows y espera a que responda. No se abre `index.html` mediante file:// para esta app Next. No se instaló un servicio de inicio ni una tarea programada.

Commits nuevos: NINGUNO. Push: NO. PR nuevo: NO. Merge: NO. Main: NO modificado. Linear: READ ONLY. Hosted Supabase: NO modificado. Vercel/producción: NO modificado. Drive: NO modificado. No se transmitió un comentario al líder: el handoff está documentado para revisión local.

**El producto completo y HAC-43 todavía requieren la evidencia y alcance pendientes de las matrices. No hay autorización ni evidencia para marcar Done, Ready for merge o producción.**

## 14. Cambios exactos y evidencia local

El manifest final conserva hashes/bytes/patches por archivo. Este inventario enumera el estado local observado; no es un commit ni un diff publicado.

```text
 M cargomesh/src/app/v2-workspace/page.tsx
 M cargomesh/src/features/v2-intake/conversation-chat.module.css
 M cargomesh/src/features/v2-intake/conversation-chat.tsx
 M cargomesh/src/features/v2-intake/v2-intake-prototype.module.css
 M cargomesh/src/features/v2-intake/v2-intake-prototype.tsx
 M cargomesh/src/features/v2-road-map/road-candidate-map-view.module.css
 M cargomesh/src/features/v2-road-map/road-candidate-map-view.tsx
 M cargomesh/src/features/v2-road-map/road-map-canvas.tsx
?? LOCAL_FRONTEND.md
?? Start-CargoMeshV2.ps1
?? UX_UI_REDESIGN_RESTORE_MAP.md
?? cargomesh/src/app/carrier-portal/page.tsx
?? cargomesh/src/features/carrier-portal/api.test.ts
?? cargomesh/src/features/carrier-portal/api.ts
?? cargomesh/src/features/carrier-portal/carrier-map.tsx
?? cargomesh/src/features/carrier-portal/contract-form.tsx
?? cargomesh/src/features/carrier-portal/coordinator.tsx
?? cargomesh/src/features/carrier-portal/form-model.ts
?? cargomesh/src/features/carrier-portal/map-model.test.ts
?? cargomesh/src/features/carrier-portal/map-model.ts
?? cargomesh/src/features/carrier-portal/portal.module.css
?? cargomesh/src/features/carrier-portal/portal.tsx
?? cargomesh/src/features/carrier-portal/records.ts
?? cargomesh/src/features/carrier-portal/request-summary.tsx
?? cargomesh/src/features/carrier-portal/resources.ts
?? cargomesh/src/features/v2-workspace/workspace-logistics-visual.tsx
?? docs/v2-amazon/delivery/HAC43_FRONTEND_ENDPOINT_MATRIX.md
?? docs/v2-amazon/delivery/HAC43_LOCAL_PRODUCT_REFINEMENT.md
?? docs/v2-amazon/delivery/HAC43_MODEL_TRACEABILITY.md
?? docs/v2-amazon/delivery/friction-logs/HAC43_LOCAL_ENVIRONMENT_2026-10-07.md
```

Evidencia: final-browser-matrix.json, final-map-edges.json, final-dialog-keyboard-conflict.json, gradient-token-contrast.json, final-gates.json, final-renderer-gates.json, build-final.log, connected-client-tests-final.log, v2-intake-final.log, current-base-release-equivalent.log, architecture-final.log y http-smoke-final.json en el repositorio local de evidencia externo. Capturas y DOM asociados en after/. No se incluyen secretos ni .env en el manifest.
