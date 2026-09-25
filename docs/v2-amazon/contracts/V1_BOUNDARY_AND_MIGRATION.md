# Límite entre V1 y V2

V2 es una nueva línea de producto. Reutilizar código o aprendizajes no convierte automáticamente un comportamiento V1 en parte del contrato V2.

## Se conserva

- patrones útiles de idempotencia, concurrencia y RLS;
- código WebMCP solo como regresión o referencia histórica; V2 no depende de él para stepper, Alexa ni selección de carriers;
- escenarios y el Golden Flow FR-1042 como regresión histórica;
- evidencia y decisiones arquitectónicas que sigan siendo válidas.

## Se reemplaza

- el universo fijo de Andes, Inca y Pacific;
- la obligación universal de cinco tools WebMCP por carrier;
- el descubrimiento basado exclusivamente en fixtures o sedes como sustituto de áreas/lanes de servicio;
- una única fórmula de ranking rígida;
- supuestos globales ROAD/FTL/PALLETS;
- elegir solo un carrier sin validar equipo, cantidad de recursos, capacidad física, costo comparable y condiciones de ruta;
- definiciones de terminado ligadas a cantidades fijas de pruebas.

## Estrategia de transición

1. Inventariar qué código es reutilizable, adaptador, fixture o deuda de V1.
2. Introducir de forma aditiva entidades V2 para sedes, áreas y lanes de servicio, corredores, tipos de equipo, activos/cupos y capacidad por fecha, planes de transporte, oportunidades, ofertas y políticas.
3. Crear escenarios V2 independientes en `supabase/scenarios/v2-*`.
4. Encapsular integraciones detrás de adaptadores de carrier.
5. Versionar APIs, eventos y MCP cuando cambie el contrato observable.
6. Retirar compatibilidad solo después de ejecutar las regresiones y documentar el impacto.

Los seeds V1 no se renombran como V2 ni se usan como prueba de amplitud del nuevo producto.
