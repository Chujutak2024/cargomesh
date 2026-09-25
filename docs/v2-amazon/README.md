# CargoMesh V2 — Amazon Developer Hackathon

Esta carpeta es la fuente de verdad documental de CargoMesh V2. V2 transforma el demo anterior en una plataforma empresarial de discovery, oferta y selección de transporte multimodal, operable desde Web y Alexa+ mediante MCP.

La [documentación de entrega en inglés](./en/README.md) traduce y consolida los contratos centrales para el concurso. No sustituye la gobernanza interna en español ni implica que todo el repositorio esté traducido.

## Dónde empezar

| Carpeta | Uso y autoridad |
|---|---|
| [contracts/](./contracts/README.md) | **Contratos normativos V2**: alcance, arquitectura, dominio, cobertura, discovery/ranking, flota, Alexa/MCP y límite V1/V2. Comienza aquí para tomar decisiones de producto. |
| [models/](./models/README.md) | Modelos conceptuales y de diseño **en revisión**, comparación con datos y guía de diagramas. Un dibujo no prueba implementación ni reemplaza los contratos. |
| [delivery/](./delivery/README.md) | Roadmaps, Linear, sprints, calidad, revisión y preparación de gates. Una propuesta o acta no modifica por sí sola Linear ni aprueba un hito. |
| [references/](./references/README.md) | Estudios externos y material comparativo; no son fuente de verdad del producto. |
| [diagrams/](./diagrams/README.md) | Índice por tipo, editables, vistas previas y antecedentes. El `06` de clases sigue siendo la última revisión versionada; el XML manual más reciente aún no la reemplaza. |
| [en/](./en/README.md) | Traducción y consolidación para materiales de entrega; requiere auditoría final contra el commit presentado. |

El [índice general de `docs/`](../README.md) explica qué material fuera de V1/V2 es histórico, transicional o sigue siendo consumido por pruebas. `AGENTS.md` y los archivos de `contracts/` gobiernan V2; ante una contradicción con un borrador o documento V1, prevalecen estos contratos.

## Estado

- **Approved baseline:** `contracts/` reemplaza como gobernanza activa a `docs/v1-webmcp/`.
- **Review input:** las propuestas del equipo se consolidaron en los contratos superiores. Los borradores de revisión no forman parte de esta rama base pública.
- **Material transicional mergeado:** `docs/architecture-v2/` y el código de PR #80 son inventario de reutilización, no contrato vigente ni prueba de Alexa+ live. Esa carpeta también contiene un fixture JSON consumido por pruebas; no se mueve sin actualizar esos consumidores.
- La implementación existente se migra incrementalmente. Una capacidad documentada no se considera live hasta tener código, datos, pruebas y evidencia.
- PR #83 (HAC-21) y PR #85 (HAC-22) ya están mergeados en `codex/v2-amazon-contracts`; la aceptación de cada issue sigue su DoD y el gate. `mcp_account_links` y tools comerciales V2 permanecen pendientes, aunque el esquema ROAD de HAC-21 ya está integrado.
- El 23 de septiembre de 2026 se aplicaron al proyecto Supabase enlazado las migraciones estructurales de idempotencia y ROAD; las cuatro tablas ROAD tienen RLS pero aún no contienen catálogo V2 remoto. Véase [FL-02](./delivery/friction-logs/FL-02.md). Esto no convierte discovery ni Alexa+ en capacidades live.

## Principios

- `0..N` carriers, sin nombres hardcodeados en reglas de dominio.
- El corte demostrable ratificado es ROAD y USD, con disponibilidad sí/no/desconocida y una oferta atribuible por decisión comercial; [alcance exacto](./contracts/PRODUCT_SCOPE.md#corte-de-mvp) y [DER lógico propuesto](./models/V2_LOGICAL_ERD.md).
- Una sede no prueba cobertura: cada servicio declara áreas, lanes y capacidad por fecha.
- Se recomienda un plan carrier + servicio + ruta + equipo/cupo + fecha; el peso y volumen del activo son restricciones, no puntos de ranking.
- Distintos medios, sedes, patios, corredores y combinaciones multimodales.
- Separación entre candidate discovery, oferta comercial, ranking y booking.
- Políticas versionadas y explicables.
- Alexa+ como canal MCP sobre servicios compartidos.
- V1 preservada como regresión, no como catálogo V2.
