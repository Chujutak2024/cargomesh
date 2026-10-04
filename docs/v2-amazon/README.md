# CargoMesh V2 — Amazon Developer Hackathon

Esta carpeta es la fuente de verdad documental de CargoMesh V2. V2 transforma el demo anterior en una plataforma empresarial de discovery, oferta y selección de transporte multimodal, operable desde Web y Alexa+ mediante MCP.

La [documentación de entrega en inglés](./en/README.md) traduce y consolida los contratos centrales para el concurso. No sustituye la gobernanza interna en español ni implica que todo el repositorio esté traducido.

## Base compartida e integración directa — 4 oct 2026

Por decisión expresa de Cristhian, `codex/v2-amazon-contracts` es la base compartida de desarrollo e integración V2. Cada integrante conserva su rama registrada y entrega PR directamente a esa base, con pruebas, revisión y autorización. Se elimina la etapa de ramas `feat/cycle-*-integration` para entregas nuevas; sus commits y actas se conservan como historia. Esta decisión sustituye los targets de ciclo en planes anteriores y skills que describan ese flujo.

El gate valida un SHA de la base compartida; no exige rama o PR agregado. Integrar un incremento no acredita el DoD completo, schema alojado, frontend conectado ni Alexa live. `main` conserva la versión estable existente y permanece congelada para V2. Las autorizaciones de Supabase alojado y despliegue se mantienen separadas. Véase [AGENTS.md](../../AGENTS.md).

## Dónde empezar

| Carpeta | Uso y autoridad |
|---|---|
| [contracts/](./contracts/README.md) | **Contratos normativos V2**: alcance, arquitectura, dominio, cobertura, discovery/ranking, flota, Alexa/MCP y límite V1/V2. Comienza aquí para tomar decisiones de producto. |
| [models/](./models/README.md) | Modelos conceptuales y de diseño **en revisión**, comparación con datos y guía de diagramas. Un dibujo no prueba implementación ni reemplaza los contratos. |
| [delivery/](./delivery/README.md) | Roadmaps, Linear, sprints, calidad, revisión y preparación de gates. Una propuesta o acta no modifica por sí sola Linear ni aprueba un hito. |
| [references/](./references/README.md) | Estudios externos y material comparativo; no son fuente de verdad del producto. |
| `diagrams/` | Diagramas del repositorio. El UML `07` de HAC-27 se publica con su hash original y diccionario de trazabilidad; otros editables locales y vistas previas permanecen fuera de esta entrega. |
| [en/](./en/README.md) | Traducción y consolidación para materiales de entrega; requiere auditoría final contra el commit presentado. |

El [índice general de `docs/`](../README.md) explica qué material fuera de V1/V2 es histórico, transicional o sigue siendo consumido por pruebas. `AGENTS.md` y los archivos de `contracts/` gobiernan V2; ante una contradicción con un borrador o documento V1, prevalecen estos contratos.

## Trazabilidad Sprint 2

El [contrato HAC-27](./delivery/SPRINT2_HAC27_CLASS_DB_API_CONTRACT.md) y su [diccionario de 57 clases / 397 atributos](./delivery/HAC27_UML_ATTRIBUTE_DICTIONARY_2026-10-02.md) acompañan el [UML 07 original](./diagrams/review-2026-09-24/07-complete-classes-sprint2-reviewed.drawio). Identifican representación física, alias y ausencias; la revisión/aceptación del PR no se presume. La [evidencia HAC-12](./delivery/HAC12_ROAD_VERTICAL_LOCAL_EVIDENCE.md) distingue esquema local de aplicación al Supabase V2 alojado.

## Estado

- **Approved baseline:** `contracts/` reemplaza como gobernanza activa a `docs/v1-webmcp/`.
- **Review input:** las propuestas del equipo se consolidaron en los contratos superiores. Los borradores de revisión no forman parte de esta rama base pública.
- **Material transicional mergeado:** `docs/architecture-v2/` y el código de PR #80 son inventario de reutilización, no contrato vigente ni prueba de Alexa+ live. Esa carpeta también contiene un fixture JSON consumido por pruebas; no se mueve sin actualizar esos consumidores.
- La implementación existente se migra incrementalmente. Una capacidad documentada no se considera live hasta tener código, datos, pruebas y evidencia.
- PR #83 (HAC-21) y PR #85 (HAC-22) ya están mergeados en `codex/v2-amazon-contracts`; la aceptación de cada issue sigue su DoD y el gate. `mcp_account_links` y tools comerciales V2 permanecen pendientes, aunque el esquema ROAD de HAC-21 ya está integrado.
- El 23 de septiembre de 2026 se aplicaron al proyecto Supabase enlazado las migraciones estructurales de idempotencia y ROAD; las cuatro tablas ROAD tienen RLS pero aún no contienen catálogo V2 remoto. Véase [FL-02](./delivery/friction-logs/FL-02.md). Esto no convierte discovery ni Alexa+ en capacidades live.

## Principios

- `0..N` carriers, sin nombres hardcodeados en reglas de dominio.
- La recuperación autorizada HAC-40 incorpora el modelo completo y decisiones con `1..*` ofertas atribuibles, sin doble cobertura. ROAD y USD conservan la evidencia ejecutable actual; otros modos/adaptadores no se declaran operativos por estar modelados. [Contrato integral y límites actuales](./delivery/HAC40_FULL_API_AND_CLOSURE.md), [workflow persistente](./delivery/HAC40_WORKFLOW_API.md) e [inventario de APIs implementadas](./delivery/HAC40_API_ENDPOINTS.md) actualizan la cardinalidad del corte inicial.
- Una sede no prueba cobertura: cada servicio declara áreas, lanes y capacidad por fecha.
- Se recomienda un plan carrier + servicio + ruta + equipo/cupo + fecha; el peso y volumen del activo son restricciones, no puntos de ranking.
- Distintos medios, sedes, patios, corredores y combinaciones multimodales.
- Separación entre candidate discovery, oferta comercial, ranking y booking.
- Políticas versionadas y explicables.
- Alexa+ como canal MCP sobre servicios compartidos.
- V1 preservada como regresión, no como catálogo V2.

## Local V2 database bootstrap

See [Clean V2 bootstrap and QA profiles](./delivery/HAC29_CLEAN_BOOTSTRAP.md) for the isolated migration chain, provenance, scenario commands and read-only hosted preflight.
