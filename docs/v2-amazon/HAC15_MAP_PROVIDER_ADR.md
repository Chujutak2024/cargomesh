# HAC-15 — proveedor del mapa ROAD V2

Fecha: 27 de septiembre de 2026

Estado: decisión de implementación HAC-15; pendiente de integración por HAC-14/HAC-12

## Decisión

`RoadCandidateMapView` recibe datos del contrato HAC-27 y los presenta mediante un adaptador cartográfico. Prefiere Google Maps JavaScript API cuando hay una clave de **navegador** válida para el origen autorizado. En ausencia de esa clave o si falla la carga, usa Leaflet con teselas de OpenStreetMap para datos que no proceden de Google Routes. Si no hay proveedor utilizable, muestra un estado de mapa no disponible y conserva los datos textuales del contrato.

El componente **no consulta Google Routes**. Dibuja únicamente los `legs[].waypoints` que entrega `routePreview`; nunca calcula, interpola ni invierte una ruta. Sin preview, con `UNKNOWN`, `legs: []` o con coordenadas necesarias inválidas, no dibuja línea. Los marcadores canónicos solo aparecen con coordenadas válidas. La distancia y el tiempo se muestran únicamente si hay geometría utilizable y valores explícitos en el contrato.

La nota secundaria debajo del mapa toma su texto del renderer activo y de `geometrySource`/`provenanceStatus`. Menciona Google Routes solo si `geometrySource` es `GOOGLE_ROUTES` o `GOOGLE_ROUTES_API` y se dibuja esa geometría. Para `SIMULATED` dice «Geometría simulada»; sin geometría dice «Geometría de ruta no disponible». La nota se suma a la atribución obligatoria dentro del mapa y no la reemplaza.

## Opciones evaluadas

| Opción | Ventaja | Coste, límite y condición |
| --- | --- | --- |
| Google Maps JavaScript API | Mapa interactivo oficial; atribución integrada; permite mostrar contenido de Google Routes en un mapa de Google. | Facturación por carga de mapa dinámico y clave de navegador restringida. La [lista oficial de precios](https://developers.google.com/maps/billing-and-pricing/pricing) indica 10 000 eventos Dynamic Maps gratuitos al mes y US$7 por 1 000 para el siguiente tramo, a fecha de esta decisión. Google Routes es un SKU distinto: Compute Routes Essentials figura con 10 000 eventos gratuitos y US$5 por 1 000 en el siguiente tramo. HAC-15 no realiza estas consultas. |
| Leaflet + teselas de OpenStreetMap | Renderiza marcadores y geometría declarada sin clave de Google. Útil como alternativa local para datos propios o simulados. | La [política del servidor público](https://operations.osmfoundation.org/policies/tiles/) exige atribución visible, `Referer` válido, caché normal y prohíbe descargas masivas; no ofrece SLA y no debe tratarse como servicio garantizado para alto tráfico comercial. |

La [documentación de facturación de Maps JavaScript](https://developers.google.com/maps/documentation/javascript/usage-and-billing) explica que las cargas del mapa generan eventos Dynamic Maps. Por ello el adaptador conserva el mismo mapa base al cambiar de candidato y actualiza solo marcadores y líneas.
El cargador espera el `callback` oficial de Maps JavaScript: con `loading=async`, el evento `load` del script no indica que la API esté lista, según la [guía de carga de Google](https://developers.google.com/maps/documentation/javascript/load-maps-js-api).

## Restricciones de uso y seguridad

- Los [términos específicos de Google Maps Platform, sección 19.2](https://cloud.google.com/maps-platform/terms/maps-service-terms) impiden combinar contenido de Routes API con un mapa ajeno a Google. El fallback no renderiza una geometría declarada como `GOOGLE_ROUTES` o `GOOGLE_ROUTES_API` en OpenStreetMap. No se ocultan el logo ni los avisos de atribución que Google coloca dentro del mapa.
- La clave `NEXT_PUBLIC_GOOGLE_MAPS_JS_API_KEY` es solo para Maps JavaScript en navegador. Debe restringirse por API y por *HTTP referrer* de cada origen HTTPS autorizado para Preview/producción; un origen HTTP de desarrollo puede autorizarse por separado. Una clave de servidor para Routes API jamás debe ir en `NEXT_PUBLIC_*`, en este componente o en el repositorio. La [guía oficial de claves](https://developers.google.com/maps/documentation/javascript/get-api-key) describe estas restricciones.
- En la comprobación inicial del 27 de septiembre la key se usó temporalmente en 8080 y se retiró después. Para las verificaciones posteriores del workspace React se configuró de nuevo la key de navegador existente en `.env.local` ignorado. El 1 de octubre se revalidó Google Maps en el origen autorizado `127.0.0.1:8080`, con logo, atribución y marcadores; se dejó la app React local ejecutándose allí. El puerto 3093 usado para el smoke de interacción fue rechazado por referrer y mostró el fallback OSM. No se cambió Google Cloud ni las restricciones de la key. [Evidencia actual](./delivery/evidence/hac15-handoff/README.md).
- No se envían datos de carga, cliente ni identidad a ningún proveedor desde este componente. Los mapas reciben las coordenadas que ya entrega el contrato. La app deberá revisar la política de privacidad antes de exponer ubicaciones sensibles.
- El fallback público de OpenStreetMap es adecuado para esta comprobación local. Antes de usarlo en una operación comercial de alto tráfico, se debe contratar un proveedor de teselas o alojarlas bajo una política apropiada.

## Contrato e integración pendiente

HAC-27 define `RoadCandidateMapViewProps` con `origin`, `destination`, `overallStatus`, `candidates`, `selectedCandidateId` y `onSelectCandidate`, además de `RoadRoutePreviewDto`. La rama base `codex/v2-amazon-contracts` aún no contiene el tipo ejecutable de HAC-12 en `src/shared/schemas/v2` ni el mapper/página de HAC-14. Por ello `src/features/v2-road-map/road-map-contract.ts` es **solo un espejo de tipos** del contrato HAC-27; no añade schema, validación ni reglas de negocio. Cuando HAC-12 llegue a la base de integración, se debe reemplazar su import por el tipo canónico. HAC-14 conectará el componente a `mapServiceabilityToMapViewProps`, conservará la selección en el parent y pasará las props reales. Esta rama no edita su página ni su mapper.

Superficie de prueba: `/hac15-preview`. Usa datos sintéticos explícitamente marcados y no representa solicitudes persistidas. Está incluida en el build para QA de la rama; no debe presentarse como una pantalla operativa de producción. Permite probar candidato elegible Callao → Arequipa, candidato sin preview, cero candidatos, coordenada faltante e idiomas ES/EN. No es una demo de cobertura, capacidad, precio ni reserva.

## Evidencia y límites

- Pruebas de modelo: selección, `SIMULATED`, preview nulo, `UNKNOWN`, legs vacíos, coordenadas inválidas y nota por proveedor/fuente.
- Navegador integrado local: mapa OpenStreetMap con atribución visible en el puerto 3090; al seleccionar otro candidato desaparece la línea sin recargar las teselas y la nota cambia a «Geometría de ruta no disponible».
- Navegador integrado local, prueba temporal en el puerto 8080: Google Maps con atribución visible y nota «Mapa: Google Maps Platform · Geometría simulada». La selección de otro candidato conserva el mapa y actualiza la nota a «Geometría de ruta no disponible». No se observó un nuevo error de consola en esta prueba. La vista móvil estrecha no tuvo desbordamiento horizontal y mantuvo la atribución visible. Captura: `HAC15_GOOGLE_LOCAL_QA.png`.
- Google se puede comprobar localmente en el origen ya autorizado 8080. Cualquier puerto o entorno adicional requiere autorización de su responsable; esta entrega no amplía referrers. Siguen pendientes la integración con HAC-12/HAC-14 y la validación de datos reales de serviceability y flujos persistidos.

Referencias de diseño revisadas: [21st.dev, colección de mapas](https://21st.dev/community/components/s/map) y su [MarkerTooltip](https://21st.dev/@mapcn/components/mapcn-marker-tooltip), [React Bits, Status Mark](https://reactbits.dev/c/micro/status-mark) y [SupplyMesh](https://supplymesh-webmcp.vercel.app/). Se tomó la idea de mantener contexto y selección visibles; no se copió código porque aquellos componentes utilizan otras dependencias o estados distintos del contrato ROAD.
