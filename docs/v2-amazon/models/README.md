# Modelos y revisiones V2

**En revisión, no DER aprobado ni prueba de funcionalidad.** El equipo está ajustando los editables; evita citar una versión anterior como contrato vigente.

- [Modelo de dominio conceptual](./DOMAIN_UML_MODEL.md): conceptos, atributos esenciales y cardinalidades de negocio.
- [Diseño de clases](./CLASS_DIAGRAM_DESIGN.md) e [índice de editables](../diagrams/README.md): atributos, operaciones, asociaciones e interfaces. El `06` es la última revisión versionada; el XML manual posterior aún tiene conectores sin corregir y no es una aprobación definitiva.
- [DER lógico V2 y contraste físico](./V2_LOGICAL_ERD.md): relaciones/keys propuestas por fase, tablas existentes en migraciones, resultados derivados y delta con RLS pendiente. **No** certifica el Supabase V2 remoto ni autoriza migraciones.
- [Paquete de diagramas](./MODEL_DIAGRAMS_REVIEW.md): dominio, clases, estados, secuencias y contenedores; distingue lo comprobado de lo propuesto.
- [Decisiones ROAD/simulación](./ROAD_UML_AND_SIMULATION_REVIEW.md): procedencia del escenario cartográfico y límites de las cotizaciones sintéticas.
- [Auditoría previa de datos](./DATA_MODEL_REVIEW.md): fotografía histórica superada por migraciones posteriores; **no usarla como DER ni estado remoto actual**.

Los editables y generadores permanecen en [diagrams/](../diagrams/). El DER lógico es una **propuesta derivada** para esa sincronización, no su aprobación final: antes de fijar el físico se deben ratificar concepto, clases, estados y secuencias con los [contratos](../contracts/README.md).
