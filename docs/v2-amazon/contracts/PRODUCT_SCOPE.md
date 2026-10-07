# Alcance de producto CargoMesh V2

## Problema

Los equipos de logística necesitan encontrar opciones viables para cargas empresariales sin depender de un directorio fijo ni comparar manualmente transportistas, modos, sedes, capacidades y restricciones incompatibles.

## Usuarios

- Shipper requester: describe la necesidad y conserva la decisión final.
- Supervisor de operaciones: controla políticas, excepciones y booking.
- Carrier operator: administra capacidades, cobertura y ofertas.
- Auditor/jurado: verifica que recomendaciones y afirmaciones sean reproducibles.

## Propuesta V2

CargoMesh recibe una necesidad logística, normaliza su carga y ruta, descubre `0..N` servicios elegibles, construye planes de transporte con equipo/capacidad por fecha, solicita o recibe ofertas, las rankea con una política explicable y permite seleccionar y auditar una alternativa. La misma lógica sirve a Web y Alexa+.

## Capacidades objetivo

- Perfiles empresariales, sedes y preferencias reutilizables.
- Taxonomía de carga, unidades, embalajes y requisitos especiales.
- Rutas geográficas, corredores y nodos logísticos.
- Transporte ROAD, SEA, RAIL, AIR y segmentos multimodales cuando estén implementados.
- Carriers manuales, automáticos o híbridos mediante adaptadores desacoplados.
- Cobertura por servicio y ruta, no por mera presencia de una sede en un país o provincia.
- Disponibilidad por fechas de flota propia o capacidad contratada, con reservas y mantenimiento.
- Selección de tipo de equipo y planes de una o varias unidades/tramos según peso, volumen, indivisibilidad, ruta y fecha; no se equipara escolta con capacidad de carga.
- Cálculo de rutas y elección algorítmica entre alternativas elegibles según objetivos explícitos.
- Desglose de tarifa y costos/recargos conocidos o estimados; permisos de carga especial y frontera como requisitos verificables, no autorizaciones asumidas.
- Repetición de envíos de la misma organización con datos históricos precargados y oferta/disponibilidad recalculadas.
- Descuentos autorizados por carrier o por CargoMesh, separados en el desglose comercial.
- Historial de entregas y puntualidad medido; reseñas solo si existen verificadas.
- Evidencia de costo, SLA, tránsito, capacidad, disponibilidad y sostenibilidad cuando existan datos verificables.

## Fuera de alcance de la baseline

- Afirmar cobertura mundial sin datos.
- Auto-booking irreversible sin autorización humana y trazabilidad.
- Tratar fixtures V1 como oferta V2 live.
- Introducir Bedrock u otro servicio AWS solo para cumplir una casilla.
- Prometer reducciones de tokens o latencia sin benchmark.
- Calcular precio final desde gasolineras, peajes, tributos y permisos sin fuentes vigentes ni aceptación del carrier.
- Presentar gestión de barcos, aviones o trenes individuales como operativa por tener el modo en la taxonomía.

## Corte de MVP

**Decisión de alcance ratificada el 24 sep 2026:** el corte demostrable es **ROAD y USD**. USD se valida en presupuesto, `CarrierOffer.price` y componentes de precio de la demo; no se reinterpretan importes PEN heredados ni se hace conversión FX. La moneda sigue dentro del valor `Money`, sin duplicarla en otro atributo de la oferta. El catálogo no fija un número de carriers: la consulta puede devolver `0..N` servicios.

La disponibilidad por ventana se expresa como `available / unavailable / unknown` (presentada al usuario como **sí / no / desconocida**) con fuente, vigencia y motivo. Cobertura, ruta geográfica, disponibilidad, estimación de costo, oferta y autorización de booking son hechos diferentes. Un `unknown` nunca se promociona a `available`; una ruta dibujada no demuestra cobertura o cupo.

La recuperación integral HAC-40 autorizada el 3–4 de octubre sustituye la cardinalidad del corte comercial inicial: una `SelectionDecision` elige **un plan y `1..*` ofertas USD atribuibles** que cubren exactamente todas sus asignaciones, sin huecos ni doble cobertura. Cada oferta proviene de su carrier/operador verificable y permanece vigente. Cada emisor conserva su booking y confirmación; CargoMesh no fabrica una oferta global ni afirma atomicidad entre proveedores externos. [Contrato integral](../delivery/HAC40_FULL_API_AND_CLOSURE.md) y [implementación/ límites](../delivery/HAC40_WORKFLOW_API.md).

El vertical ROAD se valida con datos V2 reproducibles, casos elegibles y negativos/desconocidos por carga, cobertura y ventana. Varias rutas o estrategias se acreditan con datos, ofertas y pruebas propios. El mapa sobre coordenadas sintéticas pertenece a un **escenario de simulación rotulado**, con reloj, grafo y política versionados; no acredita ruteo externo live ni un óptimo global. El workflow persistente ya prueba selección de varias ofertas y rutas de dos tramos en un escenario ROAD. Adaptadores multimodales y coordinación con varios emisores externos siguen requiriendo evidencia ejecutable propia; no se certifican por esos positivos locales.

La recuperación autorizada reúne catálogo, flota, solicitudes/planes, comercial, compromisos y operación en HAC-40; sus paquetes B1–B6 no difieren esos flujos a otro sprint. El [DER integral objetivo](../models/FULL_MODEL_DER.md) conserva las 57 clases, 397 atributos y 93 relaciones. Su inventario no certifica implementación: se exige contraste real del esquema, permisos, dataset aprobado y consumo por los canales. Los hitos del corte anterior son historia; el estado de las issues depende del DoD y evidencia actuales.
