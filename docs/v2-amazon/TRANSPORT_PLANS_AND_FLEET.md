# Planes de transporte, equipos y costos V2

## Decisión

La unidad recomendada al shipper es un **plan de transporte**, no un carrier aislado ni un vehículo escogido solo por proximidad. Un `TransportPlanCandidate` enlaza `FreightRequest`, uno o varios `CarrierService` por tramo, ruta y fecha, recursos necesarios, capacidad comprobada y requisitos pendientes. Solo pasa a plan cotizado al recibir una o varias ofertas comerciales atribuibles y comparables. Puede haber `0..N` alternativas; “mejor” significa mejor entre las alternativas y ofertas conocidas bajo el objetivo elegido.

Este documento define el contrato objetivo V2. No declara que la gestión de flota, la cotización multimodal o las autorizaciones fronterizas ya estén implementadas.

## Taxonomía y propiedad

- `TransportMode` identifica el medio de cada tramo: `ROAD`, `RAIL`, `SEA` o `AIR`. Un plan puede combinar tramos si existen servicios y conexiones verificables.
- `EquipmentType` define la función y restricciones: camión rígido, tracto, semirremolque, plataforma, refrigerado, contenedor, vagón u otro. El modo y el tipo de equipo son conceptos distintos.
- `TransportAsset` representa una unidad física identificable cuando el carrier la gestiona: propiedad, capacidad contratada o socio autorizado, sede/base, estado, características, fuente y vigencia. No se inventa la identidad de un avión, barco o vagón cuando solo se conoce cupo contratado; en ese caso se registra `CapacityPool`/cupo por servicio, tramo y fecha.
- `VehicleCombination` agrupa activos que operan juntos (por ejemplo, tracto + semirremolque). No se cuenta automáticamente como dos camiones de carga ni se suman capacidades nominales incompatibles.
- `TransportPlan` contiene `1..N` tramos y asignaciones de carga a recursos por tramo. Distingue **dos camiones que reparten la carga**, **tracto + remolque** y **vehículo de escolta**, que cumple una función de seguridad pero no aporta capacidad de carga.
- `FulfilmentSource` conserva qué carrier o socio ejecuta cada tramo. Un plan entre varios carriers requiere responsabilidades, ofertas y condiciones por tramo; CargoMesh no presenta una cotización contractual unificada sin acuerdo explícito.

Una distribuidora/shipper puede usar flota propia o contratar carriers. La titularidad del activo no prueba que esté disponible ni habilitado para una lane: esas condiciones se evalúan por servicio y fecha según el [contrato de cobertura](./CARRIER_COVERAGE_AND_SERVICEABILITY.md).

## Capacidad y elegibilidad

Para ROAD, el catálogo diferencia tara, capacidad útil declarada, peso bruto máximo aplicable, configuración de ejes, volumen y dimensiones útiles, tipo de carrocería, sujeción y equipos especiales. La capacidad **efectiva** para una solicitud no excede el menor límite verificable del fabricante, la configuración, la vía/jurisdicción y el servicio; carga, embalaje y equipo auxiliar consumen capacidad. Si faltan datos necesarios para comprobar un límite, el resultado es `requires_review`/`unknown`, no elegible confirmado. No se codifica un límite legal universal en el dominio.

El plan solo compite si **todos** sus tramos y recursos satisfacen peso, volumen, dimensiones, tipo de carga, temperatura, cobertura, ventana, reservas, mantenimiento y reposicionamiento. Una reserva en otra fecha no resta capacidad a este viaje; una asignación compatible al **mismo** viaje puede consumir capacidad residual si el servicio permite consolidación. No se divide automáticamente una pieza indivisible entre dos vehículos.

Para carga sobredimensionada o especial, el sistema distingue: un recurso portador, recursos de apoyo/escolta y permisos. Mostrar un vehículo técnicamente capaz no equivale a autorizar el recorrido. Para cruces internacionales, se verifican como requisitos el transportista/vehículo habilitado, paso de frontera, documentos y eventuales permisos de la mercancía; la autorización o liberación aduanera solo se marca confirmada con evidencia de la autoridad o del operador responsable.

## Construcción y selección de alternativas

1. Normalizar unidades de carga, peso, dimensiones, indivisibilidad y condiciones especiales; solicitar datos faltantes.
2. Generar planes con servicios y recursos realmente publicados: una unidad, reparto entre varias unidades compatibles o varios tramos. Un recurso auxiliar no aumenta la capacidad portadora.
3. Aplicar restricciones duras y conservar motivos por plan (`OVER_CAPACITY`, `EQUIPMENT_MISMATCH`, `NO_ASSET_WINDOW`, `PERMIT_REQUIRED`, `BORDER_DOCS_UNKNOWN`, etc.).
4. Pedir o recuperar ofertas del carrier para planes elegibles o sujetos a revisión; una estimación de CargoMesh no se convierte en `CarrierOffer`.
5. Comparar planes elegibles con costo total comparable, ETA/SLA y preferencias mediante una `ScoringPolicy` versionada. Los planes con requisitos duros sin resolver se muestran aparte como condicionales, no se mezclan en un ranking de opciones confirmadas. Mostrar la cantidad de recursos, restricciones y procedencia de cada dimensión.

La preferencia de vehículo expresada por el cliente es un filtro o preferencia explícita: si pide refrigerado, es restricción dura; si prefiere un tipo por conveniencia, puede ponderarse sin ocultar alternativas mejores ni superar restricciones de seguridad.

## Costos, fronteras y descuentos

Una `CarrierOffer` conserva moneda, vigencia y desglose de **tarifa de transporte**, recargo de combustible, peajes, manejo, equipo especial/escolta, cargos de cruce/agente, impuestos y descuentos cuando correspondan. Cada componente indica `included`, `quoted`, `estimated`, `excluded` o `unknown`, fuente y fecha. Se evita contar dos veces combustible o peajes si ya están incluidos en la tarifa. El precio de una gasolinera concreta no es necesario para el MVP ni sustituye la tarifa del carrier.

Los derechos/tributos aduaneros dependen de la mercancía y del régimen y no se confunden con el flete o con honorarios de agente. Si falta un componente material, no se anuncia “costo total confirmado” ni se ordenan ofertas incomparables como si lo fueran. Descuentos del carrier requieren su política/aceptación; CargoMesh solo puede descontar su propia comisión sin autorización adicional.

## Historial y repetición

El shipper puede guardar una plantilla de solicitud o partir de envíos propios similares: sedes, carga, equipos y preferencias se precargan con procedencia visible. La similitud y las métricas se calculan **dentro de la organización autorizada**; no se exponen precios, rutas ni historiales de otro cliente. Repetir nunca reutiliza automáticamente precio, permiso, capacidad o disponibilidad antiguos: se vuelven a consultar fecha, cobertura, reglas, oferta y política de scoring. Una calificación solo aparece si existen reseñas verificadas.

Web y Alexa+ consumen el mismo resultado. Alexa resume pocas alternativas y puede preguntar por peso, dimensiones, fecha o temperatura faltantes: “A necesita dos camiones; B tiene una unidad compatible, pero falta confirmar el permiso”. No declara una reserva, tarifa o cruce fronterizo como confirmado si solo es preliminar.

## Corte incremental y pruebas

El primer corte puede limitarse a ROAD, capacidades en kg/m³, equipos relevantes, agenda y alternativas de una o dos unidades con ofertas trazables. La plataforma conserva la taxonomía multimodal sin afirmar ejecución de RAIL/SEA/AIR hasta tener adaptadores, cupos, pruebas y evidencia. Peajes, combustible y frontera entran como componentes citados o `unknown`; automatizar tarifas y trámites completos no es requisito del primer corte.

Probar: pieza indivisible que no cabe, dos vehículos disponibles en la misma ventana, tracto + remolque sin doble conteo, escolta sin capacidad de carga, límite legal/fabricante más estricto, reserva solapada, oferta con combustible incluido, costo material ausente, permiso no confirmado y repetición histórica con tarifa/capacidad vencidas. En el flujo de V1 solo se reutilizan técnicas de idempotencia y pruebas; sus tres carriers y capacidades no validan V2.

## Referencias operativas

- [Maersk Intermodal – Multi Carrier](https://www.maersk.com/support/faqs/which-modes-are-used-in-intermodal-multi-carrier): carretera, ferrocarril y barcaza pueden combinarse por servicio.
- [FedEx Freight Truckload Rates](https://www.fedexfreight.fedex.com/truckloadReq.do): la cotización solicita peso, dimensiones, unidades y fechas; distingue combustible incluido de cargos adicionales.
- [Reglamento Nacional de Vehículos de Perú](https://www.sutran.gob.pe/wp-content/uploads/2017/05/DS-058-2003-MTC-RNV.pdf): diferencia tara, capacidad de carga, peso bruto y ejes; verificar vigencia y corredor antes de usar cifras legales.
- [Provías Nacional: autorizaciones especiales](https://www.gob.pe/institucion/pvn/pages/26690-registrarse-en-el-sistema-de-autorizaciones-especiales-de-provias-nacional): cargas especiales pueden requerir autorización.
- [SUNAT: tránsito aduanero internacional CAN–ALADI](https://www.sunat.gob.pe/legislacion/procedim/despacho/transitoInt/procGeneral/despa-pg.27.htm): transportistas, unidades, pasos y documentación se verifican por régimen.
