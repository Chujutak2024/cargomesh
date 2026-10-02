# HAC-15 — plan de piloto truck Callao → Arequipa

2 octubre 2026. **BLOCKED / NO EJECUTADO.** Plan para R-MAP-02; no adaptador operativo ni autorización de gasto.

## Acceso y decisión pendientes

No hay clave TomTom específica en `.env.local`. Se requiere acceso autorizado a Calculate Route v1, plan/costo/cuota y derechos de almacenamiento/publicación confirmados, además del perfil aprobado por Cristhian. Las claves Google existentes no habilitan TomTom ni ruteo truck Perú. No crear cuentas/credenciales ni ampliar permisos por esta revisión.

Owner: Juan/HAC-15. Aprobación de perfil, gasto y alcance: Cristhian. QA reproduce resultados; registrar el bloqueo no satisface el DoD.

## Entrada reproducible propuesta

Coordenadas **sintéticas** de `road-map-qa-fixtures.ts`: Callao `(-12.0464, -77.1181)` → Arequipa `(-16.409, -71.5375)`. No son sedes verificadas. El seed SQL `v2-road-baseline` no acredita esas coordenadas ni restricciones del vehículo.

Perfil propuesto **SIMULATED**, pendiente de aprobación: carga no peligrosa, peso bruto 20 000 kg, peso por eje 10 000 kg, 2 ejes, largo 12 m, ancho 2.5 m, alto 4 m, velocidad máxima 80 km/h, uso comercial. No se atribuye a una flota real ni confirma cumplimiento normativo. Para un vehículo real reemplazar los valores por datos autorizados y preservar su fuente.

[Calculate Route v1](https://docs.tomtom.com/routing-api/documentation/tomtom-maps/v1/calculate-route). Petición preparada, **no enviada**:

```text
GET https://api.tomtom.com/routing/1/calculateRoute/-12.0464,-77.1181:-16.409,-71.5375/json
travelMode=truck
routeType=fastest
traffic=false
avoid=ferries
vehicleCommercial=true
vehicleWeight=20000
vehicleAxleWeight=10000
vehicleNumberOfAxles=2
vehicleLength=12
vehicleWidth=2.5
vehicleHeight=4
vehicleMaxSpeed=80
routeRepresentation=polyline
sectionType=travelMode
sectionType=importantRoadStretch
report=effectiveSettings
key=<solo desde servidor autorizado; nunca registrar URL completa>
```

`avoid` es una preferencia, no prueba ausencia de ferris. Revisar secciones/avisos: si no permiten establecer recorrido terrestre, conservar UNKNOWN. No asumir mercancía peligrosa ni restricciones no devueltas.

## Ejecución cuando exista acceso autorizado

1. Registrar aprobación de perfil/plan/licencia. Clave solo local/servidor, fuera de Git, consola y capturas.
2. Enviar una consulta; guardar hora UTC de inicio/fin, versión API y parámetros sin clave. Sin reintentos automáticos de pago ni consulta por pulsación.
3. Preservar respuesta saneada: configuración efectiva, geometría/legs sin añadir segmentos, distancia/duración, secciones y advertencias originales; también no-route/fallo. No registrar URL con key ni texto upstream que la exponga.
4. Ruta calculada → ESTIMATED; perfil sintético → SIMULATED. Restricciones incompletas → UNKNOWN. No afirmar camión apto, disponibilidad, precio, reserva ni permiso fronterizo.
5. Contrastar MTC y registrar discrepancias. Reproducir fallo/ausencia de respuesta en prueba documentada, sin inventar geometría. Google DRIVE histórico no sustituye el piloto truck. No existe fallback TomTom implementado.

## Contraste MTC

[Capa 10 RED VIAL NACIONAL](https://www.idep.gob.pe/geoportal/rest/services/INSTITUCIONALES/MTC/MapServer/10). Se consultaron **solo metadatos**, con hora en [JSON](./evidence/hac15-handoff/review-2026-10-02-mtc-metadata.json): polilíneas EPSG:4326, máximo 1 000 registros, campos `OBJECTID`, `RUTA`, `FECHA_ACT`, `Fecha_GPS`, `Trayectori`, `Tramo`, `CAT_VIAL`, `ESTADO`. La existencia del layer no demuestra coincidencia de una ruta.

Con geometría autorizada, consultar `/query` por envelope, `geometryType=esriGeometryEnvelope`, `inSR=4326`, `outSR=4326`, `spatialRel=esriSpatialRelIntersects`, esos campos y `returnGeometry=true`. Paginar sin truncar ni descargar toda la red; guardar fecha/versión del tramo y consulta pública.

Comparar segmentos con distancias geodésicas o proyección métrica adecuada. Registrar proporción coincidente, gaps y accesos urbanos; acordar el criterio con QA/Cristhian **antes** de fijar umbral PASS. La ausencia en la red nacional no prueba que una calle local sea ilegal. Revisar antigüedad/desvíos. Esta capa no certifica altura de puente, permisos ni disponibilidad actual.

No publicar superposición TomTom/Google ni almacenar fuera de licencia: combinación/atribución/retención pendientes en el [ADR](../HAC15_MAP_PROVIDER_ADR.md).

## Estado de artefactos

| Artefacto | Estado |
| --- | --- |
| Entrada/API/parámetros sintéticos | PREPARADO; pendiente aprobación |
| Consulta truck/hora/configuración efectiva | NOT AVAILABLE |
| Geometría/distancia/duración/warnings truck | NOT AVAILABLE |
| Metadatos MTC | Lectura pública directa disponible |
| Segmentos MTC/comparación | NOT AVAILABLE |
| Fallo/fallback TomTom/capturas/evaluación QA | NOT AVAILABLE |

**Criterio abierto:** ejecutar el piloto conforme al DoD, o recibir decisión escrita de Cristhian que modifique alcance y asigne seguimiento. No se recibió esa decisión al redactar. Siguiente experimento propuesto: Perú/país vecino y paso SUNAT, sin afirmar autorización fronteriza ni ampliar esta corrección.
