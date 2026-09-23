# CargoMesh V2 — Amazon Developer Hackathon

Esta carpeta es la fuente de verdad documental de CargoMesh V2. V2 transforma el demo anterior en una plataforma empresarial de discovery, oferta y selección de transporte multimodal, operable desde Web y Alexa+ mediante MCP.

La [documentación de entrega en inglés](./en/README.md) traduce y consolida los contratos centrales para el concurso. No sustituye la gobernanza interna en español ni implica que todo el repositorio esté traducido.

## Documentos autoritativos

1. [PRODUCT_SCOPE.md](./PRODUCT_SCOPE.md): problema, usuarios, propuesta de valor y alcance.
2. [ARCHITECTURE.md](./ARCHITECTURE.md): componentes, límites y flujo end-to-end.
3. [DOMAIN_CONTRACTS.md](./DOMAIN_CONTRACTS.md): entidades e invariantes comerciales.
4. [CARRIER_COVERAGE_AND_SERVICEABILITY.md](./CARRIER_COVERAGE_AND_SERVICEABILITY.md): sedes, zonas, rutas comerciales, socios y capacidad por fecha.
5. [CARRIER_DISCOVERY_AND_RANKING.md](./CARRIER_DISCOVERY_AND_RANKING.md): elegibilidad, rutas, ofertas y optimización explicable.
6. [TRANSPORT_PLANS_AND_FLEET.md](./TRANSPORT_PLANS_AND_FLEET.md): modos, equipos, flota, planes de una o varias unidades, costos y repetición.
7. [ALEXA_MCP_AWS.md](./ALEXA_MCP_AWS.md): canal Alexa+, servidor MCP, AWS y medición de tokens.
8. [V1_BOUNDARY_AND_MIGRATION.md](./V1_BOUNDARY_AND_MIGRATION.md): qué se conserva, qué se reemplaza y cómo se evita mezclar seeds.
9. [CODE_REVIEW_GUIDELINES.md](./CODE_REVIEW_GUIDELINES.md): calidad e integración.
10. [LINEAR_ISSUE_TEMPLATE.md](./LINEAR_ISSUE_TEMPLATE.md): plantilla de issues nuevas.
11. [LINEAR_REBASE_PLAN.md](./LINEAR_REBASE_PLAN.md): propuesta para reconstruir Linear sin perder historia.
12. [SPRINT_ROADMAP.md](./SPRINT_ROADMAP.md): modelo 1+1+N, gates semanales y propuesta concreta para Sprint 1.
13. [linear_sprint1_v2_rebase_proposal.md](./linear_sprint1_v2_rebase_proposal.md): fichas HAC-21…26 cargadas en Linear, con único dueño, ramas declaradas, DoD y evidencias.
14. [cargomesh_v2_milestones_architecture_roadmap.md](./cargomesh_v2_milestones_architecture_roadmap.md): estado de Hitos 0–5 y límites de lo implementado.
15. [QUALITY_AND_VALIDATION_PLAN.md](./QUALITY_AND_VALIDATION_PLAN.md): verificación, validación humana selectiva, métricas y mejora continua proporcionadas al plazo.
16. [SPRINT2_EXECUTION_PLAN.md](./SPRINT2_EXECUTION_PLAN.md): refinamiento propuesto de HAC-11…16, DoD, dependencias y Gate-2; pendiente de sincronizar con Linear.
17. [MODEL_DIAGRAMS_REVIEW.md](./MODEL_DIAGRAMS_REVIEW.md): paquete para el jueves con dominio UML conceptual, clases técnicas, estados, secuencias y contenedores editables. El DER V2 sigue pendiente de aprobación conceptual.
18. [DOMAIN_UML_MODEL.md](./DOMAIN_UML_MODEL.md): inventario de clases conceptuales, atributos y multiplicidades del modelo de dominio corregido; propuesta para aprobación, no DER.
19. [DATA_MODEL_REVIEW.md](./DATA_MODEL_REVIEW.md): auditoría previa del esquema Git/Supabase y decisiones de persistencia; sus diagramas exploratorios fueron sustituidos por el paquete nuevo.

## Implementación incremental

- [SPRINT1_DATA_MAPPING.md](./SPRINT1_DATA_MAPPING.md): mapeo aditivo HAC-21 para sedes, áreas y lanes ROAD; no supone cobertura ni disponibilidad live.
- [SPRINT1_ALEXA_SECURITY_AND_BEDROCK.md](./SPRINT1_ALEXA_SECURITY_AND_BEDROCK.md): corte HAC-22 de transporte MCP, seguridad, narración y bloqueos; no equivale a Alexa+ live.
- [SPRINT1_GATE_V2.md](../04-execution/SPRINT1_GATE_V2.md): acta provisional del gate con matriz issue→PR→evidencia; no es aprobación del hito.

## Estado

- **Approved baseline:** estos contratos reemplazan como gobernanza activa a `docs/v1-webmcp/`.
- **Review input:** las propuestas del equipo se consolidaron en los contratos superiores. Los borradores de revisión no forman parte de esta rama base pública.
- **Material transicional mergeado:** `docs/architecture-v2/` y el código de PR #80 son inventario de reutilización, no contrato vigente ni prueba de Alexa+ live. Resolver contradicciones a favor de esta carpeta y `AGENTS.md` corregido.
- La implementación existente se migra incrementalmente. Una capacidad documentada no se considera live hasta tener código, datos, pruebas y evidencia.
- PR #83 (HAC-21) y PR #85 (HAC-22) ya están mergeados en `codex/v2-amazon-contracts`; la aceptación de cada issue sigue su DoD y el gate. `mcp_account_links` y tools comerciales V2 permanecen pendientes, aunque el esquema ROAD de HAC-21 ya está integrado.
- El 23 de septiembre de 2026 se aplicaron al proyecto Supabase enlazado las migraciones estructurales de idempotencia y ROAD; las cuatro tablas ROAD tienen RLS pero aún no contienen catálogo V2 remoto. Véase [FL-02](../04-execution/friction-logs/FL-02.md). Esto no convierte discovery ni Alexa+ en capacidades live.

## Principios

- `0..N` carriers, sin nombres hardcodeados en reglas de dominio.
- Una sede no prueba cobertura: cada servicio declara áreas, lanes y capacidad por fecha.
- Se recomienda un plan carrier + servicio + ruta + equipo/cupo + fecha; el peso y volumen del activo son restricciones, no puntos de ranking.
- Distintos medios, sedes, patios, corredores y combinaciones multimodales.
- Separación entre candidate discovery, oferta comercial, ranking y booking.
- Políticas versionadas y explicables.
- Alexa+ como canal MCP sobre servicios compartidos.
- V1 preservada como regresión, no como catálogo V2.
