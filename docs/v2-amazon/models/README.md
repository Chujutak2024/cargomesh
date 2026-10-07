# UML, DER y modelos V2

## Entradas actuales

- [UML 07 original](../diagrams/review-2026-09-24/07-complete-classes-sprint2-reviewed.drawio): fuente trazable de 57 clases, 397 atributos y 93 relaciones.
- [Contrato HAC-27](../delivery/SPRINT2_HAC27_CLASS_DB_API_CONTRACT.md) y [diccionario fechado](../delivery/HAC27_UML_ATTRIBUTE_DICTIONARY_2026-10-02.md): atributos, alias y trazabilidad; contrastar estados con la matriz del SHA revisado.
- [DER integral](./FULL_MODEL_DER.md), [diseño físico](./FULL_MODEL_PHYSICAL_DESIGN.json) y [reconciliación de relaciones](./FULL_MODEL_CURRENT_RELATIONS.json): distinguen baseline histórico y decisiones posteriores. #106 es reconciliación documental, no cierre de F-02 ni certificado alojado.
- [Reconciliación actual de atributos](./FULL_MODEL_CURRENT_ATTRIBUTES.json) y [corte del 7-oct](../delivery/HAC40_RECONCILIATION_2026-10-07.md): metadata RoutePlanner y corrección documental de reservas; el [incremento de asociaciones/búsqueda](../delivery/HAC40_MODEL_CLOSURE_API.md) implementa los tres huecos locales, pendientes de QA; no certifican el modelo completo.
- [Flujo de entrega vigente](../delivery/CURRENT_DELIVERY_STATE.md): revisión e integración.

## Antecedentes de diseño

El modelo conceptual, CLASS_DIAGRAM_DESIGN, V2_LOGICAL_ERD, MODEL_DIAGRAMS_REVIEW, ROAD_UML_AND_SIMULATION_REVIEW y DATA_MODEL_REVIEW conservan propuestas/revisiones anteriores. Sus referencias a UML 06 o ajustes pendientes del XML pertenecen a ese corte; no sustituyen UML 07 ni el DER integral.

Un diagrama no prueba implementación. La matriz UML → BD → API debe identificar SHA, entorno, casos ejecutados y faltantes; las afirmaciones de esquema alojado necesitan evidencia independiente.
