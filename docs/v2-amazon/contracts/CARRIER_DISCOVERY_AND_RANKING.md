# Descubrimiento y ranking de carriers V2

## Objetivo

CargoMesh V2 no elige entre una lista fija de tres carriers. Evalúa los servicios publicados para una solicitud, una ruta y una fecha concretas; construye planes carrier + servicio + equipos/cupos, obtiene ofertas atribuibles y selecciona la mejor alternativa **según un objetivo declarado**. La búsqueda no excluye candidatos con una heurística opaca. Los contratos están en [cobertura y capacidad de atención](./CARRIER_COVERAGE_AND_SERVICEABILITY.md) y [planes de transporte y flota](./TRANSPORT_PLANS_AND_FLEET.md).

## Pipeline canónico

1. Resolver origen, destino, sedes y restricciones de ruta.
2. Calcular rutas y combinaciones modales soportadas, con distancia, duración y costos estimados trazables.
3. Construir planes de una o varias unidades/tramos publicados; evaluar `ServiceArea`, `ServiceLane`, capacidad por recurso y fecha.
4. Aplicar filtros duros de carga, equipo, seguridad, cobertura y documentación; registrar exclusiones o incertidumbre por plan.
5. Solicitar o recuperar ofertas comerciales para planes factibles o sujetos a revisión explícita, sin presentarlas como confirmadas antes de la aceptación del carrier.
6. Normalizar y comparar los planes elegibles con ofertas atribuibles según una `ScoringPolicy` versionada o un objetivo explícito (por ejemplo, menor costo total o menor tiempo); mostrar aparte los planes condicionales con requisitos duros pendientes.
7. Devolver alternativas, razones, restricciones y procedencia de cada dato.

## Filtros duros

Como mínimo, la elegibilidad debe poder considerar:

- zona de recojo y entrega, lane dirigida, corredor y modo de transporte;
- clase de servicio y ventanas de recojo/entrega;
- peso, volumen, unidades y tipo de embalaje;
- temperatura, materiales peligrosos, fragilidad y sobredimensión;
- documentación o certificaciones obligatorias;
- activos o cupos compatibles para toda la ventana, incluyendo reservas y reposicionamiento; la capacidad efectiva se comprueba por recurso/tramo, no sumando nominales incompatibles;
- permisos y habilitaciones requeridos, sin equiparar una alerta de requisito con autorización concedida.

Un carrier que no supere un filtro duro no debe entrar al ranking.

## Búsqueda y decisión algorítmica

La consulta evalúa todos los servicios del universo soportado por los datos V2; no descarta por una lista fija, radio arbitrario o puntaje previo. El ruteo calcula alternativas sobre la red disponible y aplica restricciones de modo, carga y ventana. Si se optimiza una sola magnitud no negativa puede usarse un algoritmo exacto de camino mínimo; para costo/tiempo se conservan alternativas no dominadas y se aplica la política elegida. “Óptimo” significa mejor **entre las alternativas y ofertas conocidas** bajo esa política, no mejor de un mercado desconocido.

La distancia del depot o activo al recojo (*deadhead*) influye en factibilidad, ETA y costo, pero no da cobertura por sí misma. Peajes y aduana pueden contribuir a costo y duración como estimaciones con fuente y nivel de confianza; no se inventan tarifas, liberaciones aduaneras ni ofertas. Si no existe una oferta comercial, el resultado se etiqueta como oportunidad o estimación y nunca como cotización confirmada.

## Política de scoring

Los objetivos, pesos de ranking cuando correspondan, normalización, desempates y tratamiento de valores faltantes viven en una `ScoringPolicy` persistida y versionada. El peso **físico** de carga/vehículo es una restricción anterior al score, no una ponderación. La respuesta explica cantidad y función de recursos, cada dimensión y qué componentes de precio están incluidos, cotizados, estimados o desconocidos (combustible, peajes, frontera, descuentos). Un descuento sobre la tarifa del carrier requiere su política o autorización; un descuento de CargoMesh afecta solo su propia comisión. Las métricas de puntualidad, entregas exitosas y reseñas muestran período y tamaño de muestra; una calificación inexistente queda sin dato, no como cero ni como cinco estrellas. El historial del shipper puede sugerir un plan similar, pero se revalidan capacidad, ruta, tarifa y requisitos antes de recomendarlo.

La política BALANCED de V1 (25/25/20/10/10/10) y los resultados 89/84/72 del flujo FR-1042 se conservan únicamente como regresión histórica. No son el contrato universal de V2.

## Propiedades verificables

- misma entrada, mismo conjunto de ofertas y misma versión de política producen el mismo orden;
- cambios de política no alteran resultados históricos ya materializados;
- los empates se resuelven de forma estable;
- datos faltantes no reciben una ventaja silenciosa;
- cada recomendación conserva trazabilidad hasta servicios, capacidad, oferta y política.
- una sede sin área/lane no vuelve elegible a un carrier; un socio vigente puede servir una zona sin sede propia;
- reservas solapadas o mantenimiento impiden ofrecer el mismo activo para la fecha solicitada.
