# Cobertura y capacidad de atención de carriers V2

## Decisión

Un carrier puede tener `0..N` sedes propias, activos y socios operativos. **Tener una sede en un país o provincia no implica cobertura total de ese territorio; no tenerla tampoco implica incapacidad de atenderlo.** La cobertura es una propiedad de cada `CarrierService` y de sus rutas comerciales, no una bandera global del carrier.

Los operadores reales distinguen códigos postales o zonas atendidas, rutas origen–destino, tipo de servicio, compromiso de entrega y restricciones de carga. También pueden operar con nodos y socios en lugar de una sede propia en cada destino. Este contrato adopta ese patrón sin copiar las tarifas o áreas de ninguna empresa.

## Entidades separadas

- `CarrierDepot`: sede, patio o base **propia**; ubicación, horario, capacidades de manipulación y activos asociados. No representa automáticamente una provincia atendida.
- `LogisticsNode`: puerto, terminal, paso fronterizo u otra infraestructura que puede ser compartida y no pertenecer al carrier.
- `CarrierService`: producto operativo concreto del carrier (modo, clase de servicio, carga admitida, límites, condiciones y estado).
- `ServiceArea`: zona de recojo o entrega publicada para un servicio. Puede expresarse por país, división administrativa, código postal, polígono o conjunto de puntos. Las zonas de recojo y entrega son distintas y admiten exclusiones explícitas.
- `ServiceLane`: conexión **dirigida** entre áreas o nodos de origen y destino, con modo, ventanas, frecuencia, condiciones transfronterizas y fechas de vigencia. Puede declarar explícitamente cobertura `within-area` para un servicio local, sin enumerar cada par de puntos. Una ruta A→B no autoriza inferir B→A.
- `FulfilmentSource`: capacidad propia o de un socio identificado. Una alianza debe estar registrada y vigente; no se infiere por proximidad.
- `TransportAsset` y `CapacityCalendar`: vehículo/equipo o capacidad contratada por modo, con agenda, reservas, mantenimiento y tiempo de reposicionamiento. Su composición en planes de una o varias unidades se rige por [planes de transporte y flota](./TRANSPORT_PLANS_AND_FLEET.md).

## Regla de elegibilidad

Para una solicitud y una fecha concretas, un servicio es elegible solo si:

1. origen y destino se resuelven a ubicaciones y zonas de servicio suficientemente precisas;
2. el servicio acepta recojo y entrega en esas zonas y existe una `ServiceLane` compatible, directa o en un plan de tramos explícito;
3. modo, carga, peso, volumen, embalaje y condiciones especiales cumplen sus límites;
4. hay permisos, documentación y nodos requeridos para el corredor; para cruce internacional, el estado de aduana se presenta como requisito o estimación, no como autorización concedida;
5. existe capacidad portadora y auxiliar compatible para toda la ventana solicitada, considerando reservas previas, mantenimiento, tiempos de viaje y reposicionamiento; si hay varios recursos, todos deben estar disponibles;
6. la cobertura y la disponibilidad tienen fuente, vigencia y estado verificable.

Un dato faltante produce `COVERAGE_UNKNOWN` o `AVAILABILITY_UNKNOWN`, nunca “sí cubre” por defecto. Un dato negativo vigente produce `ineligible`, no `unknown`. Si no hay servicio elegible se explica el motivo y, cuando exista una agenda confiable, se ofrece la próxima ventana posible. No se fabrica una oferta ni se promete una reserva.

## País, provincia y sede

El país puede ser un filtro preliminar; provincia, localidad, código postal o geometría refinan el alcance. Una exclusión específica prevalece sobre una inclusión amplia. Un `CarrierDepot` puede apoyar el recojo o el reposicionamiento desde otra provincia o país, pero solo dentro de una zona y una ruta que el servicio declare o que un socio contratado cubra.

Ejemplos:

- Sede en Lima + servicio declarado para Lima–Arequipa: puede competir en esa ruta si la fecha y la carga son compatibles; no se infiere cobertura de todo el Perú.
- Sin sede en Chile + socio registrado para última milla en Santiago: puede competir en un tramo hacia Santiago si la lane y las condiciones transfronterizas lo permiten.
- Sede en Santiago, pero sin servicio de recojo en Valparaíso: no se muestra como elegible solo por estar en Chile.

## Resultado compartido por Web y Alexa+

El servicio de aplicación devuelve `eligible`, `ineligible` o `unknown`, motivos codificados, área y lane utilizadas, fuente/fecha de los datos, tipo de capacidad y ventana consultada. El stepper puede mostrar sugerencias preliminares mientras se completa la solicitud; Alexa+ puede explicar lo mismo en lenguaje natural. Ningún canal altera la decisión ni presenta una sugerencia preliminar como oferta confirmada.

## Implementación incremental y pruebas

Primero definir catálogo de servicios, áreas y lanes para escenarios V2; luego enlazar activos y calendario, y finalmente socios y corredores multimodales. Las migraciones serán aditivas y sin seeds sintéticos. Las tablas expuestas deberán tener RLS y políticas por organización/rol.

Probar al menos: sede sin cobertura, cobertura sin sede propia por socio, exclusión postal/provincial, lane inversa inexistente, activo ocupado o en mantenimiento, ventana parcialmente solapada, cruce internacional sin requisito cumplido, dato vencido y ausencia de carriers elegibles.

## Referencias de mercado

- [FedEx Express Freight Service Area Locator](https://images.fedex.com/us/ExpressFreight/SALocator/): disponibilidad y compromiso por código postal y rampa.
- [DHL Freight API Farm Product Manual](https://developer.dhl.com/sites/default/files/2024-10/DHL%20FREIGHT%20GLOBAL%20-%20Freight%20API%20Farm%20Product%20Manual%20-%20v1.17.pdf): productos con países de origen/destino válidos, trade lanes, restricciones y exclusiones.
- [Maersk Inland Services](https://www.maersk.com/transportation-services/inland-services): conexiones por modo, nodos, corredores y socios locales.
- [Maersk Inland Services México](https://www.maersk.com/es-mx/local-information/latin-america/mexico/local-solutions/inland-services): diferencias operativas por zona y tipo de carga.
