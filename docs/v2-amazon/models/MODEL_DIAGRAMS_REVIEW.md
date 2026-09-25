# CargoMesh V2 — paquete de modelos para revisión del 24 sep 2026

**Estado:** propuesta de análisis, no contrato aprobado ni evidencia de flujo implementado. Los cinco archivos originales `.drawio` siguen editables en diagrams.net: `01` se genera con [generate-domain-uml.mjs](../diagrams/review-2026-09-24/tools/generate-domain-uml.mjs), `02` con [generate-classes-uml.mjs](../diagrams/review-2026-09-24/tools/generate-classes-uml.mjs) y `03`–`05` con [generate.mjs](../diagrams/review-2026-09-24/tools/generate.mjs). **Para revisar el diagrama de clases completo actual, usa el [06 de clases](../diagrams/review-2026-09-24/06-complete-classes-commercial-reviewed.drawio)**; el `02` es un antecedente selectivo. El `06` se reproduce desde el `05` de clases versionado mediante [refine-commercial-class-diagram.ps1](../diagrams/review-2026-09-24/tools/refine-commercial-class-diagram.ps1) y conserva las cinco páginas de detalle. Las exportaciones SVG antiguas son auxiliares, no sustituyen el editable completo. El despliegue de migraciones ROAD/idempotencia fue una operación separada; esta revisión no modificó esquema, código de producto ni Linear.

| Vista | Archivo | Qué valida |
|---|---|---|
| Dominio conceptual UML | [01-domain-conceptual.drawio](../diagrams/review-2026-09-24/01-domain-conceptual.drawio) | Seis páginas: solicitud/carga, carrier/cobertura, ruta/recursos y agenda, mercado/selección, preferencias/perfiles/historial y visión general. Se separó identificación fiscal tipo/valor, se ubicó el canal en el servicio, se corrigió Servicio→Cupo y se modelaron reservas/mantenimiento sin afirmar persistencia actual. Véase [inventario y contraste de datos](./DOMAIN_UML_MODEL.md). No es DER ni flujo de pasos. |
| Clases de diseño UML | [06-complete-classes-commercial-reviewed.drawio](../diagrams/review-2026-09-24/06-complete-classes-commercial-reviewed.drawio) | Seis páginas: cinco detalles preservados y una visión completa de 57 clases/96 relaciones. Corrige trazabilidad de ofertas, selección de plan, vínculo booking–capacidad, cardinalidad de miembros y límites de integración/fixtures. Véase [guía de lectura y límites](./CLASS_DIAGRAM_DESIGN.md). React no tiene que implementarlas como clases JavaScript. El `02` sigue como antecedente. |
| Máquinas de estado | [03-state-machines.drawio](../diagrams/review-2026-09-24/03-state-machines.drawio) | Cuatro ciclos separados: `FreightRequest`, `CarrierOpportunity`, `CarrierOffer`, `Booking`. La transición DRAFT→PENDING está verificada; las otras máquinas son propuestas. |
| Secuencias | [04-sequences.drawio](../diagrams/review-2026-09-24/04-sequences.drawio) | Dos recorridos objetivo: intake/discovery y oferta/ranking/booking. Web y Alexa+ son canales alternativos sobre servicios compartidos. |
| Arquitectura | [05-container-architecture.drawio](../diagrams/review-2026-09-24/05-container-architecture.drawio) | Contenedores y dependencias: Web, Alexa+, Hono/MCP, servicios, dominio, Supabase, geodatos y adaptadores de carrier. Una conexión dibujada no prueba integración live. |
| DER lógico V2 | [V2_LOGICAL_ERD.md](./V2_LOGICAL_ERD.md) | Propuesta de entidades/relaciones por HITO 2–4 y contraste con migraciones versionadas. No certifica el Supabase V2 remoto ni sustituye la revisión de conectores del UML. |

## Cómo leer el paquete

- En clases técnicas y arquitectura, **verde** indica algo con base en código o migración del repositorio; las tablas ROAD también están desplegadas en el proyecto Supabase enlazado desde el 23 sep, pero siguen vacías. **Ámbar discontinuo** indica concepto objetivo sin entrega V2 completa; **violeta** indica sistema externo, no integración certificada. El modelo UML conceptual usa un color uniforme porque habla de significado, no de estado de desarrollo.
- En el `01`, una línea es una **asociación**, no un paso ni un flujo de datos; cada extremo indica cuántas instancias de esa clase pueden corresponder a una de la otra. Las clases repetidas entre páginas son referencias al mismo concepto. Los atributos esenciales preceden a las decisiones de cardinalidad en [DOMAIN_UML_MODEL.md](./DOMAIN_UML_MODEL.md).
- Las asociaciones de clases son de dominio. No son FKs finales ni obligan a materializar cada clase como tabla. En la página 1, la sede participa por separado como origen `0..1` y destino `0..1`; las dos FK compuestas del esquema garantizan el mismo tenant. `CargoSpecification` puede continuar como columnas/JSONB tipado mientras el contrato lo permita; `RankedOption` es un resultado derivado, no tabla propuesta.
- El `02` es un **diagrama de clases de diseño**, distinto del modelo conceptual `01`: separa atributos de métodos y usa rombo para composición y triángulo blanco discontinuo para realización de interfaz. Las firmas son propuestas verificables, no prueba de métodos ya implementados; las subclases solo se emplean donde el contrato de capacidad lo justifica.
- `ServiceArea` y `ServiceLane` constituyen cobertura declarada. `CarrierDepot` no concede cobertura. `TransportAsset` y `CapacityPool` son **alternativas de fuente de capacidad**, no una relación de composición. La página 3 añade `CalendarioDeCapacidad`, `ReservaDeCapacidad` y `MantenimientoProgramado` como propuestas: no existen todavía tablas V2 equivalentes, y un calendario pertenece a activo **o** cupo.
- El `01` tiene una página 6 **selectiva** del dominio conceptual. El `06` de clases muestra en su página 6 el diseño completo con atributos, operaciones y relaciones; no debe sustituirse por la antigua página selectiva de `02`. Las clases repetidas entre páginas son referencias, no entidades duplicadas.
- En estados, solo el primer corte de `FreightRequest` tiene una transición verificada. `STALE_DRAFT`, replay idempotente, `eligible/ineligible/unknown` y errores remotos son resultados técnicos/evaluaciones, no estados persistidos de solicitud. Los estados comerciales propuestos necesitan eventos, guardas, actor y pruebas antes de convertirse en enums SQL.
- Las secuencias describen intención V2. No garantizan que Alexa+ remota, ruteo, carriers ni booking estén operativos. Un precio estimado por CargoMesh no es `CarrierOffer`.

## Decisiones que debe tomar el equipo

1. **Agregados y vocabulario:** `TransportPlanCandidate` es el único plan concreto del diseño y `TransportPlan` queda como término general; ratificar límites de `FreightRequest`, `CarrierOpportunity`, `CarrierOffer`, `SelectionDecision` y `Booking`, y si `RankedOption` es el nombre correcto del resultado de ranking.
2. **Solicitud:** acordar únicamente las transiciones posteriores a `PENDING` necesarias para V2. No reutilizar automáticamente `ORCHESTRATING` o `AWAITING_SELECTION` del runtime V1.
3. **Oportunidad y oferta:** actor emisor, plazo, retiro, versión, validez y si una oportunidad admite más de una oferta revisada. Ninguna transición debe fabricar una cotización.
4. **Capacidad:** confirmar recurso físico vs cupo contratado, granularidad de reserva, disponibilidad simultánea de varias unidades, reposicionamiento y tratamiento `unknown`. Una escolta no suma capacidad de carga.
5. **Booking:** definir autorización explícita, revalidación de oferta/capacidad, vínculo a `CapacityReservation` o evidencia de compromiso externo, confirmación del carrier, cancelación/liberación y estados terminales. Ranking por sí solo no autoriza la reserva; el corte ROAD exige una oferta por decisión.
6. **Canales:** confirmar qué tools MCP V2 expondrán los servicios compartidos y qué tramo del flujo tendrá evidencia Alexa+ real; mantener WebMCP fuera del camino principal.
7. **Persistencia:** revisar el [DER lógico V2 propuesto](./V2_LOGICAL_ERD.md), derivado de los contratos y contrastado con migraciones versionadas, y ratificar entidades/keys/cardinalidades antes del físico. Falta aún comprobar el **as-is del Supabase V2 remoto** cuando haya acceso, y resolver los conectores del XML manual. El DER no está aprobado ni hay migraciones comerciales autorizadas. La [auditoría anterior de datos](./DATA_MODEL_REVIEW.md) es historia, no diseño aprobado.

## Criterio de aceptación de la revisión

- Cada flecha tiene significado definido; no hay alias de V1 para carriers, scoring o WebMCP en el dominio V2.
- Cada estado propuesto registra evento, actor, guarda, efecto, rechazo/reintento y caso de prueba antes de implementarse.
- El equipo puede recorrer por ambos canales: sede sin cobertura, lane inversa, capacidad ocupada/desconocida, oferta ausente/vencida y booking sin autorización, con respuestas consistentes.
- Se registran decisiones abiertas con responsable e issue antes de crear migraciones, ramas o prometer el flujo en la demo.

Fuentes normativas: [ARCHITECTURE](../contracts/ARCHITECTURE.md), [DOMAIN_CONTRACTS](../contracts/DOMAIN_CONTRACTS.md), [CARRIER_COVERAGE_AND_SERVICEABILITY](../contracts/CARRIER_COVERAGE_AND_SERVICEABILITY.md), [CARRIER_DISCOVERY_AND_RANKING](../contracts/CARRIER_DISCOVERY_AND_RANKING.md), [TRANSPORT_PLANS_AND_FLEET](../contracts/TRANSPORT_PLANS_AND_FLEET.md), [ALEXA_MCP_AWS](../contracts/ALEXA_MCP_AWS.md) y [V1_BOUNDARY_AND_MIGRATION](../contracts/V1_BOUNDARY_AND_MIGRATION.md). Los Mermaid de `docs/architecture-v2/` son antecedentes transicionales, no autoridad sobre V2.

## Acta del jueves

| Decisión | Aprobado/cambio | Responsable e issue | Prueba o evidencia |
|---|---|---|---|
| Dominio y nombres | Pendiente | Pendiente | Pendiente |
| Clases y límites de agregado | Pendiente | Pendiente | Pendiente |
| Estados y guardas | Pendiente | Pendiente | Pendiente |
| Secuencias Web/Alexa y carrier | Pendiente | Pendiente | Pendiente |
| Paso al DER lógico | Pendiente | Pendiente | Pendiente |
