# HAC-15 — proveedor del mapa ROAD V2

Fecha inicial: 27 de septiembre de 2026. Revisión de fuentes y alcance: 2 octubre 2026.

Estado: implementación del renderer entregada; ADR ampliado PARTIAL. Piloto de camión BLOCKED por acceso TomTom; decisión de alcance de Cristhian y smoke integrado pendientes. Documentar el bloqueo no satisface el criterio ni autoriza cerrar HAC-15.

## Decisión

`RoadCandidateMapView` recibe datos del contrato HAC-27 y los presenta mediante un adaptador cartográfico. Prefiere Google Maps JavaScript API cuando hay una clave de **navegador** válida para el origen autorizado. En ausencia de esa clave o si falla la carga, usa Leaflet con teselas de OpenStreetMap para datos que no proceden de Google Routes. Si no hay proveedor utilizable, muestra un estado de mapa no disponible y conserva los datos textuales del contrato.

El componente **no consulta Google Routes**. Dibuja únicamente los `legs[].waypoints` que entrega `routePreview`; nunca calcula, interpola ni invierte una ruta. Sin preview, con `UNKNOWN`, `legs: []` o con coordenadas necesarias inválidas, no dibuja línea. Los marcadores canónicos solo aparecen con coordenadas válidas. La distancia y el tiempo se muestran únicamente si hay geometría utilizable y valores explícitos en el contrato.

**Actualización local, 1 octubre 2026:** el workspace puede alimentar esas props desde un adaptador de servidor Google Routes **opcional y deshabilitado por defecto**, restringido al origen autorizado 127.0.0.1:8080 y a IDs del catálogo local. Juan amplió el catálogo a 34 ciudades de 18 países; se filtran redes terrestres desconectadas y se rechazan ferris/pasos no ROAD. La línea sintética de tres puntos se retiró del workspace; el componente de presentación mantiene sus invariantes. La geometría del proveedor se rotula ESTIMATED/GOOGLE_ROUTES_API; no verifica un camión ni instalaciones comerciales y no reemplaza serviceability/HAC-14. [Código, evidencia y límites](./delivery/HAC15_GOOGLE_ROAD_PREVIEW_LOCAL.md), [catálogo multirregional](./delivery/HAC15_MULTICONTINENT_ROAD_CATALOG.md). La clave de servidor es independiente de la clave de navegador y no se publica.

La nota secundaria debajo del mapa toma su texto del renderer activo y de `geometrySource`/`provenanceStatus`. Menciona Google Routes solo si `geometrySource` es `GOOGLE_ROUTES` o `GOOGLE_ROUTES_API` y se dibuja esa geometría. Para `SIMULATED` dice «Geometría simulada»; sin geometría dice «Geometría de ruta no disponible». La nota se suma a la atribución obligatoria dentro del mapa y no la reemplaza.

## Opciones evaluadas

| Opción | Ventaja | Coste, límite y condición |
| --- | --- | --- |
| Google Maps JavaScript API | Mapa interactivo oficial; atribución integrada; permite mostrar contenido de Google Routes en un mapa de Google. | Facturación por carga de mapa dinámico y clave de navegador restringida. La [lista oficial de precios](https://developers.google.com/maps/billing-and-pricing/pricing) reconsultada el 2 octubre indica 10 000 eventos Dynamic Maps gratuitos al mes y US$7 por 1 000 para el siguiente tramo. Google Routes es un SKU distinto: Compute Routes Essentials figura con 10 000 eventos gratuitos y US$5 por 1 000 en el siguiente tramo. El componente no consulta Routes; el adaptador opcional del workspace sí puede hacerlo. |
| Leaflet + teselas de OpenStreetMap | Renderiza marcadores y geometría declarada sin clave de Google. Útil como alternativa local para datos propios o simulados. | La [política del servidor público](https://operations.osmfoundation.org/policies/tiles/) exige atribución visible, `Referer` válido, caché normal y prohíbe descargas masivas; no ofrece SLA y no debe tratarse como servicio garantizado para alto tráfico comercial. |

La [documentación de facturación de Maps JavaScript](https://developers.google.com/maps/documentation/javascript/usage-and-billing) explica que las cargas del mapa generan eventos Dynamic Maps. Por ello el adaptador conserva el mismo mapa base al cambiar de candidato y actualiza solo marcadores y líneas.
El cargador espera el `callback` oficial de Maps JavaScript: con `loading=async`, el evento `load` del script no indica que la API esté lista, según la [guía de carga de Google](https://developers.google.com/maps/documentation/javascript/load-maps-js-api).

## Restricciones de uso y seguridad

- Los [términos específicos de Google Maps Platform, sección 19.2](https://cloud.google.com/maps-platform/terms/maps-service-terms) impiden combinar contenido de Routes API con un mapa ajeno a Google. El fallback no renderiza una geometría declarada como `GOOGLE_ROUTES` o `GOOGLE_ROUTES_API` en OpenStreetMap. No se ocultan el logo ni los avisos de atribución que Google coloca dentro del mapa.
- La clave `NEXT_PUBLIC_GOOGLE_MAPS_JS_API_KEY` es solo para Maps JavaScript en navegador. Debe restringirse por API y por *HTTP referrer* de cada origen HTTPS autorizado para Preview/producción; un origen HTTP de desarrollo puede autorizarse por separado. Una clave de servidor para Routes API jamás debe ir en `NEXT_PUBLIC_*`, en este componente o en el repositorio. La [guía oficial de claves](https://developers.google.com/maps/documentation/javascript/get-api-key) describe estas restricciones.
- En la comprobación inicial del 27 de septiembre la key se usó temporalmente en 8080 y se retiró después. Para las verificaciones posteriores del workspace React se configuró de nuevo la key de navegador existente en `.env.local` ignorado. El 1 de octubre se revalidó Google Maps en el origen autorizado `127.0.0.1:8080`, con logo, atribución y marcadores; se dejó la app React local ejecutándose allí. El puerto 3093 usado para el smoke de interacción fue rechazado por referrer y mostró el fallback OSM. No se cambió Google Cloud ni las restricciones de la key. [Evidencia actual](./delivery/evidence/hac15-handoff/README.md).
- No se envían datos de carga, cliente ni identidad a ningún proveedor desde este componente. Los mapas reciben las coordenadas que ya entrega el contrato. La app deberá revisar la política de privacidad antes de exponer ubicaciones sensibles.
- El fallback público de OpenStreetMap es adecuado para esta comprobación local. Antes de usarlo en una operación comercial de alto tráfico, se debe contratar un proveedor de teselas o alojarlas bajo una política apropiada.
- Las etiquetas canónicas se pasan a Leaflet mediante un HTMLElement con `textContent`. Una cadena de `bindTooltip` se interpreta como HTML, según la [documentación de Tooltip](https://leafletjs.com/reference.html#tooltip). El 2 octubre se reprodujo y corrigió R-MAP-01 con prueba DOM del renderer, no solo tests del modelo. Los SVG de camión/empresa son estáticos; no incorporan etiquetas del usuario como HTML. [Respuesta y evidencia](./delivery/HAC15_REVIEW_RESPONSE_2026_10_02.md).

## Contrato e integración pendiente

HAC-27 define `RoadCandidateMapViewProps` con `origin`, `destination`, `overallStatus`, `candidates`, `selectedCandidateId` y `onSelectCandidate`, además de `RoadRoutePreviewDto`. La rama base `codex/v2-amazon-contracts` aún no contiene el tipo ejecutable de HAC-12 en `src/shared/schemas/v2` ni el mapper/página de HAC-14. Por ello `src/features/v2-road-map/road-map-contract.ts` es **solo un espejo de tipos** del contrato HAC-27; no añade schema, validación ni reglas de negocio. Cuando HAC-12 llegue a la base de integración, se debe reemplazar su import por el tipo canónico. HAC-14 conectará el componente a `mapServiceabilityToMapViewProps`, conservará la selección en el parent y pasará las props reales. Esta rama no edita su página ni su mapper.

Superficie de prueba: `/hac15-preview`. Usa datos sintéticos explícitamente marcados y no representa solicitudes persistidas. Solo responde en desarrollo; en producción devuelve 404. Permite probar candidato elegible Callao → Arequipa, candidato sin preview, cero candidatos Piura → Arequipa `ineligible`, coordenadas nulas, ES/EN y nombres con caracteres especiales/markup. No es una demo de cobertura, capacidad, precio ni reserva.

## Comparación ampliada por función — 2 octubre 2026

Las alternativas siguientes son investigación documental. No se instalaron SDK adicionales, crearon cuentas ni habilitaron APIs. Buscar un lugar no confirma una sede; calcular una ruta no demuestra aptitud del vehículo.

### 1. Renderizador

| Alternativa | Encaje y límite | Decisión |
| --- | --- | --- |
| Google Maps JavaScript | Ya implementado, atribución oficial, recibe las coordenadas del contrato. La carga del mapa se factura independientemente del ruteo. | Renderer principal con la clave de navegador existente; conservar la instancia durante cambios de selección. |
| Amazon Location Maps | La [tabla de cobertura](https://docs.aws.amazon.com/location/latest/developerguide/data-quality.html) clasifica Maps en Perú como Good. Cuenta, autorización y atribuciones de sus datos requieren validación antes de adoptarlo. | Alternativa documental; no integración ejecutada. No elegirla por afinidad AWS. |
| Leaflet / OSM | Leaflet es el renderer; OSM aporta teselas, no un servicio de rutas. Atribución y caché HTTP según [política OSM](https://operations.osmfoundation.org/policies/tiles/); sin SLA ni descargas masivas. | Fallback existente para geometría propia/simulada. No mostrar contenido Routes de Google sobre OSM. |

### 2. Búsqueda y confirmación de lugares

| Alternativa | Función y límite | Situación |
| --- | --- | --- |
| Google Places / Geocoding | Texto → resultados/identificador/coordenadas; después el usuario y el dominio confirman ubicación. [Places exige atribución y restringe almacenamiento; el place ID tiene una excepción](https://developers.google.com/maps/documentation/places/web-service/policies). | Propuesta futura, no llamada ni API habilitada por esta revisión. No sustituye coordenadas canónicas de HAC-12/14. |
| Amazon Location Places | Direcciones Perú Comprehensive y POI Good en la [tabla oficial](https://docs.aws.amazon.com/location/latest/developerguide/data-quality.html). Calidad publicada no prueba la precisión de una instalación concreta. | Alternativa documental; no credencial específica local ni comparación de lugares ejecutada. |
| Catálogo local actual | 34 coordenadas de referencia; no autocomplete, geocodificación ni sedes confirmadas. | Evidencia de UI únicamente. La confirmación avanzada permanece en HAC-33/34/35, no se implementa para cerrar HAC-15. |

### 3. Ruteo ROAD y restricciones de camión en Perú

| Alternativa | Evidencia documental y límite | Decisión de piloto |
| --- | --- | --- |
| TomTom Routing v1 | [Calculate Route admite Perú](https://docs.tomtom.com/routing-api/documentation/tomtom-maps/v1/product-information/market-coverage). [La API admite truck y parámetros de peso/ejes/dimensiones, pero advierte cobertura incompleta de restricciones](https://docs.tomtom.com/routing-api/documentation/tomtom-maps/v1/calculate-route). | Candidato al piloto exigido en HAC-15; acceso local ausente. No afirmar restricciones completas ni aptitud del camión. |
| Google Routes | El adaptador existente usa DRIVE: geometría/ETA ESTIMATED. [Large Vehicle Routing está disponible en EE. UU. continental y Japón, con acceso provisionado](https://developers.google.com/maps/documentation/routes/lvr). Perú no está cubierto por esa función. | Conservar estimación de auto como tal; no usarla para cumplir el piloto truck Perú. |
| Amazon Location Routes | Perú: ruteo general Good, Truck Routing Unsupported en la [tabla oficial](https://docs.aws.amazon.com/location/latest/developerguide/data-quality.html). | No seleccionarlo para acreditar restricciones de camión en Perú. |
| HERE Routing v8 | Perú no figura en los listados de restricciones completas ni de autopistas de la [cobertura truck](https://docs.here.com/routing/docs/routing-v8-truck-routing-coverage). Sin esos datos puede producir una ruta que no considere dimensiones/peso/carga peligrosa. | No interpretar una respuesta truck como cumplimiento de restricciones peruanas. No prueba local. |

### Costos y cuotas: presupuesto separado por adaptador

Valores documentales consultados el 2 octubre, en USD y sin impuestos; no son costos medidos de la cuenta ni autorización para gastar.

| Servicio | Presupuesto/cuota publicados y limitación |
| --- | --- |
| Google Maps / Routes | Precios arriba. [Routes publica 3 000 consultas/minuto; funciones avanzadas cambian el SKU](https://developers.google.com/maps/documentation/routes/usage-and-billing). El adaptador local limita a 20/minuto y comparte llamadas simultáneas idénticas; esto no cambia la cuota de Cloud. |
| Google Places / Geocoding | [Tarifas](https://developers.google.com/maps/billing-and-pricing/pricing): Geocoding 10 000 gratis/mes, después US$5/1 000 en primer tramo; Text Search Pro 5 000 y US$32/1 000. IDs Only no es equivalente a pedir coordenadas/detalles. Field mask y sesiones afectan facturación. |
| TomTom | [Pricing](https://docs.tomtom.com/pricing) muestra 20 000 solicitudes Routing/mes gratuitas y 20 000 Geocoding. La tarifa del tramo de pago no quedó verificable en la extracción estática: confirmar el plan antes de ejecutar. [QPS de Routing: 5 por defecto](https://docs.tomtom.com/platform/documentation/api-best-practices/qps-limits); límites reales dependen de la clave/plan. |
| Amazon Location | [Pago por solicitudes y categorías](https://aws.amazon.com/location/pricing/); parámetros pueden cambiar el nivel de [Routes](https://docs.aws.amazon.com/location/latest/developerguide/routes-pricing.html). No se verificó una factura/tarifa de cuenta para este piloto. [Cuotas publicadas](https://docs.aws.amazon.com/location/latest/developerguide/manage-quotas.html) dependen de API/región; no se solicitaron aumentos. |
| HERE | No se consiguió verificar la tabla comercial [Pricing](https://www.here.com/get-started/pricing) desde este entorno (403). Precio, cuota y licencia de cuenta NOT AVAILABLE; no asumir gratuidad. |

### Licencia, retención y combinación de proveedores

La prohibición Google Routes → mapa ajeno a Google se confirmó en [19.2](https://cloud.google.com/maps-platform/terms/maps-service-terms); 19.3 permite caché temporal de coordenadas hasta 30 días. El caché local en memoria no autoriza redistribuir respuestas completas. Places tiene reglas propias de atribución/retención.

**TomTom → Google no está aprobado.** La página pública de [términos TomTom](https://docs.tomtom.com/legal/terms-and-conditions) no permitió acreditar una licencia de cuenta y sus derechos de combinación/caché. El piloto deberá revisarse como datos separados; antes de pintar o publicar su geometría, verificar términos de ambos proveedores, atribución, retención y derechos de evidencia. No hay un adaptador TomTom integrado ni fallback hacia él. La lectura documental no implica aceptar términos ni crear una cuenta.

No intercambiar resultados de auto/camión bajo la misma procedencia. Fallo, falta de permisos o respuesta sin geometría utilizable → UNKNOWN/pines conocidos; no una recta ni una respuesta de otro proveedor presentada como equivalente.

## Piloto Callao → Arequipa: bloqueo y criterio de salida

[Plan reproducible, parámetros, artefactos esperados y contraste MTC](./delivery/HAC15_TRUCK_PILOT_PLAN.md).

- **Acceso faltante:** clave TomTom habilitada para Calculate Route v1, plan/cuota/costo autorizados, perfil del vehículo aprobado y permiso de conservar evidencia conforme a la licencia. `.env.local` tiene configuración Google; no claves específicas TomTom/HERE/Amazon Location. Se verificó presencia, nunca se registraron valores. Esto solo describe esta configuración local, no cuentas de otros miembros ni todos los secretos del equipo.
- **Preparación comprobada:** endpoint público MTC capa 10 disponible, RED VIAL NACIONAL, EPSG:4326 y campos de ruta/fecha. [Metadatos leídos y fecha](./delivery/evidence/hac15-handoff/review-2026-10-02-mtc-metadata.json). No se descargó una red completa ni se contrastó una ruta calculada en esta revisión.
- **Faltante:** consulta truck, geometría, distancia/duración, warnings/condiciones, hora real y comparación con segmentos MTC. Todos son NOT AVAILABLE para este piloto; no reutilizar capturas DRIVE ni catálogo como PASS.
- **Decisión requerida de Cristhian:** proporcionar acceso/perfil/condiciones para ejecutar el piloto antes de aceptar HAC-15, o aprobar por escrito una modificación explícita del alcance con owner y gate del piloto. Hasta esa decisión y la reprueba, R-MAP-02 sigue abierto; HAC-15 no está aprobado ni Done.
- **Siguiente experimento:** corredor Perú → país vecino y paso [SUNAT](https://www.sunat.gob.pe/legislacion/procedim/despacho/transitoInt/procGeneral/despa-pg.27.htm). No ejecutado; no convertirlo en requisito operativo implícito del mapa base ni prometer autorización fronteriza.

## Evidencia y límites

- Pruebas de modelo: selección, `SIMULATED`, preview nulo, `UNKNOWN`, legs vacíos, coordenadas inválidas y nota por proveedor/fuente.
- Navegador integrado local: mapa OpenStreetMap con atribución visible en el puerto 3090; al seleccionar otro candidato desaparece la línea sin recargar las teselas y la nota cambia a «Geometría de ruta no disponible».
- Navegador integrado local, prueba temporal en el puerto 8080: Google Maps con atribución visible y nota «Mapa: Google Maps Platform · Geometría simulada». La selección de otro candidato conserva el mapa y actualiza la nota a «Geometría de ruta no disponible». No se observó un nuevo error de consola en esta prueba. La vista móvil estrecha no tuvo desbordamiento horizontal y mantuvo la atribución visible. Captura: `HAC15_GOOGLE_LOCAL_QA.png`.
- Google se puede comprobar localmente en el origen ya autorizado 8080. Cualquier puerto o entorno adicional requiere autorización de su responsable; esta entrega no amplía referrers. Siguen pendientes la integración con HAC-12/HAC-14 y la validación de datos reales de serviceability y flujos persistidos.

Referencias de diseño revisadas: [21st.dev, colección de mapas](https://21st.dev/community/components/s/map) y su [MarkerTooltip](https://21st.dev/@mapcn/components/mapcn-marker-tooltip), [React Bits, Status Mark](https://reactbits.dev/c/micro/status-mark) y [SupplyMesh](https://supplymesh-webmcp.vercel.app/). Se tomó la idea de mantener contexto y selección visibles; no se copió código porque aquellos componentes utilizan otras dependencias o estados distintos del contrato ROAD.
