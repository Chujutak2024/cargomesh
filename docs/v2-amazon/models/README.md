# UML, DER y modelos V2

## Entradas actuales

- [UML 08 derivado vigente](../diagrams/review-2026-09-24/08-complete-classes-contract-reconciled-2026-10-09.drawio): reconcilia únicamente las relaciones 35/40/73/83/90 con los contratos en `main @ 42a4fde`. [Acta y límites](../delivery/HAC40_MODEL_QA_CLOSURE_2026-10-09.md).
- [UML 07 histórico inmutable](../diagrams/review-2026-09-24/07-complete-classes-sprint2-reviewed.drawio): origen trazable de 57 clases, 397 atributos y 93 relaciones; conserva su hash. El inventario histórico y sus estados QA permanecen intactos.
- [Contrato HAC-27](../delivery/SPRINT2_HAC27_CLASS_DB_API_CONTRACT.md) y [diccionario fechado](../delivery/HAC27_UML_ATTRIBUTE_DICTIONARY_2026-10-02.md): atributos, alias y trazabilidad; contrastar estados con la matriz del SHA revisado.
- [DER integral](./FULL_MODEL_DER.md), [diseño físico](./FULL_MODEL_PHYSICAL_DESIGN.json) y [reconciliación de relaciones](./FULL_MODEL_CURRENT_RELATIONS.json): distinguen baseline histórico y decisiones posteriores. #106 es reconciliación documental, no cierre de F-02 ni certificado alojado.
- [Reconciliación actual de atributos](./FULL_MODEL_CURRENT_ATTRIBUTES.json) y [corte del 7-oct](../delivery/HAC40_RECONCILIATION_2026-10-07.md): metadata RoutePlanner y corrección documental de reservas; el [incremento de asociaciones/búsqueda](../delivery/HAC40_MODEL_CLOSURE_API.md) implementa los tres huecos locales, pendientes de QA; no certifican el modelo completo.
- [Flujo de entrega vigente](../delivery/CURRENT_DELIVERY_STATE.md): revisión e integración.
- [Reconciliación de identidad HAC-41](./FULL_MODEL_CURRENT_IDENTITY.json): cuatro clases, 28 atributos y emisor CarrierOperator de la relación 74; implementación local y evidencia, pendientes de QA independiente. La [revisión UML/diccionario de McpAccountLink del 9-oct](./MCP_ACCOUNT_LINK_UML_DICTIONARY_REV_2026-10-09.md) separa vínculos históricos y verificados sin alterar el UML original.

## Antecedentes de diseño

El modelo conceptual, CLASS_DIAGRAM_DESIGN, V2_LOGICAL_ERD, MODEL_DIAGRAMS_REVIEW, ROAD_UML_AND_SIMULATION_REVIEW y DATA_MODEL_REVIEW conservan propuestas/revisiones anteriores. Sus referencias a UML 06 o ajustes pendientes del XML pertenecen a ese corte; no sustituyen la revisión derivada vigente ni el DER integral; UML 07 conserva la procedencia histórica.

Un diagrama no prueba implementación. La matriz UML → BD → API debe identificar SHA, entorno, casos ejecutados y faltantes; las afirmaciones de esquema alojado necesitan evidencia independiente.
