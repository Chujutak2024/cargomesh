# HAC-15 — Catálogo multirregional, exclusivamente terrestre

Fecha: 1 octubre 2026. Rama `feat/fe2-v2-route-map`, PR #92. Petición directa de Juan: ampliar orígenes/destinos a otros continentes conservando transporte por tierra.

## Alcance y catálogo

34 ciudades, 18 países, agrupadas en ambos selectores por seis regiones. Son coordenadas locales de referencia de ciudad: **no instalaciones comerciales verificadas, ni fixtures canónicos nuevos de serviceability**. El borrador continúa siendo `V2-LOCAL-01`, guardado sólo en este navegador. Se conservan Callao/Arequipa como valores iniciales.

| Región | Referencias disponibles |
| --- | --- |
| Sudamérica | Callao, Arequipa, Piura, Lima (PE); Santiago (CL); Buenos Aires (AR); Bogotá (CO); São Paulo (BR). |
| Norteamérica | Ciudad de México, Monterrey (MX); Los Angeles, Las Vegas, Houston (US); Toronto (CA). |
| Europa | Madrid, Barcelona (ES); París, Lyon (FR); Berlín, Hamburgo (DE). |
| Asia | Nueva Delhi, Mumbai (IN); Bangkok, Chiang Mai (TH); Kuala Lumpur (MY); Singapur (SG). |
| África | Johannesburgo, Durban (ZA); Nairobi, Mombasa (KE). |
| Oceanía | Sídney, Melbourne, Brisbane, Adelaide (AU). |

`road-locations.ts` es la única fuente para selectores, restauración del borrador y coordenadas del adaptador local. Los países/ciudades se muestran en ES/EN, también en Panel y tabla; ya no aparece Perú para cualquier ciudad.

## Política ROAD

1. Un ID desconocido o dos extremos iguales son inválidos; no generan consultas.
2. Redes del catálogo: Sudamérica, Norteamérica, Afroeurasia y Australia. Son un prefiltro geográfico, **no una afirmación de que cada par tenga una carretera abierta ni permisos**. Europa/Asia/África pueden compartir red; Google debe devolver un trazado válido.
3. No se permite cruzar océanos ni enlazar las dos Américas como un trayecto vial continuo. [La fuente oficial de FCDO](https://www.gov.uk/foreign-travel-advice/colombia/regional-risks) confirma que no hay paso por carretera entre Colombia y Panamá. El formulario explica el bloqueo y no deja completar ese contexto; tracking conserva sólo los dos puntos y UNKNOWN.
4. Google recibe `travelMode:DRIVE` y `routeModifiers.avoidFerries:true`. [Google documenta](https://developers.google.com/maps/documentation/routes/route-modifiers) que evitar ferris es sólo una preferencia. Por eso se inspeccionan **todos los pasos de todas las legs**, solicitando modo y maniobra: se rechazan `FERRY`, `FERRY_TRAIN`, WALK/TRANSIT/otros modos y metadatos ausentes. [Referencia de maniobras y pasos](https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRoutes).
5. Fallo del proveedor, falta de ruta o respuesta incompleta → `routePreview:null`, sin métricas ni interpolación. Nunca se reemplaza con una línea recta. Los rechazos por ferry se prueban con respuestas controladas; no se atribuyen a una consulta real no ejecutada.
6. Una geometría aceptada sigue siendo `GOOGLE_ROUTES_API / ESTIMATED`. El camión/empresa identifican extremos. No se validan altura, ejes, peso, mercancías, aduanas, permisos, cobertura, capacidad ni booking.

La entrada sigue limitada al servidor local autorizado 127.0.0.1:8080 y apagada por defecto fuera de la configuración local. IDs → coordenadas resueltas en servidor; sin coordenadas arbitrarias en POST. Llamadas simultáneas se deduplican **por par**; distintos pares nunca comparten una respuesta. Límite de 20 consultas/minuto por proceso; debounce/cancelación y memoria del hook para resultados exitosos durante el montaje, sin geometría persistida en localStorage ni caché persistente del servidor. No se cambia ninguna clave ni configuración cloud.

## Verificación fresca

| Comprobación | Resultado / evidencia |
| --- | --- |
| Modelos de mapa, workspace, catálogo y adaptador | **PASS 33/33**: 10 mapa + 7 workspace + 3 catálogo + 13 adaptador. Incluye ferry en una segunda leg, falta de metadatos, cruces desconectados sin llamada, rutas inversas, restauración/invalidación y concurrencia de pares distintos. |
| `pnpm typecheck` | PASS. |
| `pnpm check:architecture` | PASS: 237 módulos / 30 client entry points. |
| `pnpm build` | PASS: compilación, tipos y generación de páginas. |
| Clave Routes de servidor en build cliente | 80 archivos JS/map examinados por igualdad del valor; ninguna coincidencia. El valor no se imprimió. `.env.local` continúa ignorado. |
| ES/EN | Sídney→Melbourne mantiene la misma ruta, métricas y hora al pasar a EN. Nombres/países/chips y nota de CargoMesh se traducen; controles nativos de Google conservan el idioma cargado por su SDK. |
| Teclado | En Origen, Home/ArrowDown seleccionan Piura al saltar Arequipa deshabilitada por ser destino. Después se restaura Callao. |
| Móvil | Viewport 390×844; ancho de documento 375, sin desbordamiento horizontal. Controles nativos etiquetados y regiones en varias filas. |
| Borrador | Se restauraron Callao→Arequipa, ES, progreso 0/5; carga/fechas no se editaron. |

Smoke real en navegador integrado sobre build de producción local. Valores son observaciones de esa ejecución, pueden variar:

| Región / caso | Resultado visible | Captura |
| --- | --- | --- |
| Catálogo ES | 34 opciones de origen y 34 de destino, seis optgroups; Madrid/Barcelona seleccionados. | [14](./evidence/hac15-handoff/14-multicontinent-catalog-es.png) |
| Europa: Madrid→Barcelona | Google Maps + Google Routes, ESTIMATED; 627 km / 6,33 h. | [15](./evidence/hac15-handoff/15-google-madrid-barcelona-es.png) |
| Norteamérica: Los Angeles→Las Vegas | Google Maps + Google Routes, ESTIMATED; 435 km / 4,11 h. | [16](./evidence/hac15-handoff/16-google-los-angeles-las-vegas-es.png) |
| Asia: Bangkok→Chiang Mai | Google Maps + Google Routes, ESTIMATED; 686,8 km / 9,31 h. | [17](./evidence/hac15-handoff/17-google-bangkok-chiang-mai-es.png) |
| África: Johannesburgo→Durban | Google Maps + Google Routes, ESTIMATED; 567,3 km / 6,2 h. | [18](./evidence/hac15-handoff/18-google-johannesburg-durban-es.png) |
| Oceanía: Sídney→Melbourne | Google Maps + Google Routes, ESTIMATED; 877,7 km / 8,97 h; EN conserva resultado. | [19](./evidence/hac15-handoff/19-google-sydney-melbourne-en.png) |
| Callao→Madrid: formulario EN | Bloqueo visible, Continue no avanza. | [20](./evidence/hac15-handoff/20-cross-ocean-blocked-en.png) |
| Callao→Madrid: tracking EN | Sólo puntos en Google Maps, sin candidato/ruta, fuente/métricas no disponibles y cobertura UNKNOWN. | [21](./evidence/hac15-handoff/21-no-cross-ocean-geometry-en.png) |
| Catálogo ES móvil | Callao/Arequipa restaurados; sin overflow. | [22](./evidence/hac15-handoff/22-multicontinent-catalog-mobile-es.png) |

Consola durante el smoke: ningún error nuevo observado; permanece el aviso de deprecación de `google.maps.Marker` ya documentado. No se presenta la suite release completa ni DB/pgTAP como reejecutada. No se afirma que los 1 122 pares dirigidos del catálogo hayan sido verificados: sólo los cinco pares nuevos anteriores; Sudamérica tiene la evidencia previa Callao/Arequipa.

## Handoff HAC-14 y límites

Las seis props de HAC-27 y el mapper/controller de Luis no cambian. Esta ampliación sólo afecta el **adaptador de escenario local**; no debe usarse como catálogo operativo ni fallback de un error de HAC-12. Al conectar `/v2-workspace`, sedes/coords y borrador proceden de HAC-14 y la geometría de la evaluación de ese ID/versión, con una única selección compartida. [Handoff](./HAC15_HAC14_INTEGRATION_HANDOFF.md).

Sin integración de código ajeno, merge, despliegue ni cambios de Vercel, producción, Supabase remoto o Google Cloud. El piloto de rutas aptas para camión y el smoke conjunto QA siguen pendientes. Skills aplicadas: `professional-project-orchestrator` y `verification-before-completion`.
