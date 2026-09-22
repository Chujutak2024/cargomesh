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

El MVP debe demostrar un vertical slice con al menos dos rutas, más de un modo o estrategia de transporte, carriers obtenidos desde datos V2 y variación real de elegibilidad por carga, equipo, capacidad y ventana. ROAD con un plan de una unidad frente a otro de dos unidades puede ser la segunda estrategia si ambos están sustentados por datos y ofertas; no exige multimodalidad live. El número exacto de carriers no es un contrato.
