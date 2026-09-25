# CargoMesh V2 — paquete de modelos para revisión del 24 sep 2026

**Estado:** propuesta de análisis, no contrato aprobado ni evidencia de flujo implementado. Los cinco archivos `.drawio` son editables en diagrams.net. El `01` se genera con [generate-domain-uml.mjs](./diagrams/review-2026-09-24/generate-domain-uml.mjs); `02`–`05` con [generate.mjs](./diagrams/review-2026-09-24/generate.mjs). Se retiraron las previsualizaciones obsoletas del antiguo `01`; para revisar el UML abre el `.drawio`. Las exportaciones `.svg` de `02`–`05` siguen siendo vistas auxiliares. El despliegue de las migraciones ROAD/idempotencia del 23 sep fue una operación separada; este paquete no modificó esquema, código de producto ni Linear.

| Vista | Archivo | Qué valida |
|---|---|---|
| Dominio conceptual UML | [01-domain-conceptual.drawio](./diagrams/review-2026-09-24/01-domain-conceptual.drawio) | Cinco páginas: solicitud/carga, carrier/cobertura, ruta/recursos, mercado/selección y preferencias/perfiles/historial. La revisión del 23 sep incorpora las sedes de origen/destino como dos roles opcionales, los atributos ROAD efectivamente migrados y un contraste actualizado con el remoto. Véase [inventario y contraste de datos](./DOMAIN_UML_MODEL.md). No es DER ni flujo de pasos. |
| Clases de dominio | [02-domain-classes.drawio](./diagrams/review-2026-09-24/02-domain-classes.drawio) | Cuatro páginas: solicitud, cobertura/capacidad, ruta/recursos y planes/mercado. Son tipos y responsabilidades de dominio; React no tiene que implementarlos como clases JavaScript. |
| Máquinas de estado | [03-state-machines.drawio](./diagrams/review-2026-09-24/03-state-machines.drawio) | Cuatro ciclos separados: `FreightRequest`, `CarrierOpportunity`, `CarrierOffer`, `Booking`. La transición DRAFT→PENDING está verificada; las otras máquinas son propuestas. |
| Secuencias | [04-sequences.drawio](./diagrams/review-2026-09-24/04-sequences.drawio) | Dos recorridos objetivo: intake/discovery y oferta/ranking/booking. Web y Alexa+ son canales alternativos sobre servicios compartidos. |
| Arquitectura | [05-container-architecture.drawio](./diagrams/review-2026-09-24/05-container-architecture.drawio) | Contenedores y dependencias: Web, Alexa+, Hono/MCP, servicios, dominio, Supabase, geodatos y adaptadores de carrier. Una conexión dibujada no prueba integración live. |

## Cómo leer el paquete

- En clases técnicas y arquitectura, **verde** indica algo con base en código o migración del repositorio; las tablas ROAD también están desplegadas en el proyecto Supabase enlazado desde el 23 sep, pero siguen vacías. **Ámbar discontinuo** indica concepto objetivo sin entrega V2 completa; **violeta** indica sistema externo, no integración certificada. El modelo UML conceptual usa un color uniforme porque habla de significado, no de estado de desarrollo.
- En el `01`, una línea es una **asociación**, no un paso ni un flujo de datos; cada extremo indica cuántas instancias de esa clase pueden corresponder a una de la otra. Las clases repetidas entre páginas son referencias al mismo concepto. Los atributos esenciales preceden a las decisiones de cardinalidad en [DOMAIN_UML_MODEL.md](./DOMAIN_UML_MODEL.md).
- Las asociaciones de clases son de dominio. No son FKs finales ni obligan a materializar cada clase como tabla. En la página 1, la sede participa por separado como origen `0..1` y destino `0..1`; las dos FK compuestas del esquema garantizan el mismo tenant. `CargoSpecification` puede continuar como columnas/JSONB tipado mientras el contrato lo permita; `RankedOption` es un resultado derivado, no tabla propuesta.
- `ServiceArea` y `ServiceLane` constituyen cobertura declarada. `CarrierDepot` no concede cobertura. `TransportAsset` y `CapacityPool` son **alternativas de fuente de capacidad**, no una relación de composición. Ambos requieren evaluación de agenda por ventana.
- En estados, solo el primer corte de `FreightRequest` tiene una transición verificada. `STALE_DRAFT`, replay idempotente, `eligible/ineligible/unknown` y errores remotos son resultados técnicos/evaluaciones, no estados persistidos de solicitud. Los estados comerciales propuestos necesitan eventos, guardas, actor y pruebas antes de convertirse en enums SQL.
- Las secuencias describen intención V2. No garantizan que Alexa+ remota, ruteo, carriers ni booking estén operativos. Un precio estimado por CargoMesh no es `CarrierOffer`.

## Decisiones que debe tomar el equipo

1. **Agregados y vocabulario:** confirmar límites de `FreightRequest`, `TransportPlanCandidate`, `CarrierOpportunity`, `CarrierOffer` y `Booking`; decidir si `RankedOption` es el nombre correcto del resultado de ranking.
2. **Solicitud:** acordar únicamente las transiciones posteriores a `PENDING` necesarias para V2. No reutilizar automáticamente `ORCHESTRATING` o `AWAITING_SELECTION` del runtime V1.
3. **Oportunidad y oferta:** actor emisor, plazo, retiro, versión, validez y si una oportunidad admite más de una oferta revisada. Ninguna transición debe fabricar una cotización.
4. **Capacidad:** confirmar recurso físico vs cupo contratado, granularidad de reserva, disponibilidad simultánea de varias unidades, reposicionamiento y tratamiento `unknown`. Una escolta no suma capacidad de carga.
5. **Booking:** definir autorización explícita, revalidación de oferta/capacidad, confirmación del carrier, cancelación y estados terminales. Ranking por sí solo no autoriza la reserva.
6. **Canales:** confirmar qué tools MCP V2 expondrán los servicios compartidos y qué tramo del flujo tendrá evidencia Alexa+ real; mantener WebMCP fuera del camino principal.
7. **Persistencia:** después de aprobar el dominio y estados, elaborar un **DER lógico V2** (entidades/keys/cardinalidades) y cotejarlo con un **DER físico as-is** generado de migraciones y del proyecto Supabase de destino. Todavía no hay un DER V2 fijo. El [auditoría anterior de datos](./DATA_MODEL_REVIEW.md) queda como inventario histórico del desfase entre Git y remoto, no como diseño aprobado.

## Criterio de aceptación de la revisión

- Cada flecha tiene significado definido; no hay alias de V1 para carriers, scoring o WebMCP en el dominio V2.
- Cada estado propuesto registra evento, actor, guarda, efecto, rechazo/reintento y caso de prueba antes de implementarse.
- El equipo puede recorrer por ambos canales: sede sin cobertura, lane inversa, capacidad ocupada/desconocida, oferta ausente/vencida y booking sin autorización, con respuestas consistentes.
- Se registran decisiones abiertas con responsable e issue antes de crear migraciones, ramas o prometer el flujo en la demo.

Fuentes normativas: [ARCHITECTURE](./ARCHITECTURE.md), [DOMAIN_CONTRACTS](./DOMAIN_CONTRACTS.md), [CARRIER_COVERAGE_AND_SERVICEABILITY](./CARRIER_COVERAGE_AND_SERVICEABILITY.md), [CARRIER_DISCOVERY_AND_RANKING](./CARRIER_DISCOVERY_AND_RANKING.md), [TRANSPORT_PLANS_AND_FLEET](./TRANSPORT_PLANS_AND_FLEET.md), [ALEXA_MCP_AWS](./ALEXA_MCP_AWS.md) y [V1_BOUNDARY_AND_MIGRATION](./V1_BOUNDARY_AND_MIGRATION.md). Los Mermaid de `docs/architecture-v2/` son antecedentes transicionales, no autoridad sobre V2.

## Acta del jueves

| Decisión | Aprobado/cambio | Responsable e issue | Prueba o evidencia |
|---|---|---|---|
| Dominio y nombres | Pendiente | Pendiente | Pendiente |
| Clases y límites de agregado | Pendiente | Pendiente | Pendiente |
| Estados y guardas | Pendiente | Pendiente | Pendiente |
| Secuencias Web/Alexa y carrier | Pendiente | Pendiente | Pendiente |
| Paso al DER lógico | Pendiente | Pendiente | Pendiente |
