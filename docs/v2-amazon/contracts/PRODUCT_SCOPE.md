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

En el corte comercial inicial, una `SelectionDecision` elige **un plan y exactamente una oferta USD atribuible a un carrier responsable**. La oferta debe provenir del carrier o de su operador/integración verificable, cubrir el plan y estar vigente. CargoMesh no la fabrica a partir de distancia, odómetro ni heurística. El booking autorizado y la confirmación de capacidad son pasos posteriores, no efectos automáticos del ranking.

El vertical ROAD se valida con datos V2 reproducibles, al menos un caso elegible y casos negativos/desconocidos por carga, cobertura y ventana. Varias rutas o estrategias —por ejemplo una unidad frente a dos— se demuestran **solo si** existen datos, ofertas y pruebas de ambas; no son condición para llamar operativo a un único camino ROAD validado. El mapa o una heurística sobre coordenadas sintéticas puede formar parte de un **escenario de simulación rotulado**, con reloj, grafo y política versionados; no se presenta como ruteo externo live ni como óptimo global. Multimodal ROAD/RAIL/SEA/AIR y decisiones de varios responsables/ofertas permanecen en diseño hasta contar con adaptadores, datos y pruebas propios.

La secuencia de entregas sigue siendo incremental: HITO 2 demuestra elegibilidad/capacidad ROAD y paridad Web/MCP sin oferta; HITO 3 añade oportunidad, oferta atribuible y ranking versionado; HITO 4 aborda selección auditada, autorización, booking y compromiso de capacidad. El [DER lógico V2](../models/V2_LOGICAL_ERD.md) separa estas fases de las tablas heredadas existentes. Ningún párrafo anterior cambia por sí solo el DoD o estado de una issue en Linear.
