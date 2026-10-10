# Arquitectura CargoMesh V2

## Alcance integral vigente — recuperación HAC-27/HAC-40

El [contrato integral y catálogo de ejecución](../delivery/HAC40_FULL_API_AND_CLOSURE.md) incorpora las 57 clases y reemplaza las exclusiones del corte ROAD descrito debajo. La separación modular y los límites de identidad/atomicidad se conservan. La selección multi-oferta, su persistencia, bookings separados y endpoints están implementados en el workflow V2. La coordinación con carriers externos no queda certificada por esos resultados; consultar el [estado de integraciones](../delivery/INTEGRATION_CERTIFICATION_2026-10-09.md).

## Capas

1. **Canales:** Web, Alexa+ y futuras integraciones.
2. **Application API/MCP:** autenticación, validación, idempotencia y orquestación.
3. **Dominio:** FreightRequest, RoutePlan, TransportPlanCandidate, CarrierService, TransportAsset/CapacityPool, CarrierOpportunity, CarrierOffer, ScoringPolicy, SelectionDecision, Booking y CapacityReservation. `TransportPlan` en prosa no es un segundo agregado.
4. **Elegibilidad y ruteo:** geocodificación, áreas y lanes de servicio, nodos, modos, planes de equipo/cupo por fecha y restricciones de carga/ruta.
5. **Adapters V2:** portal manual, API o MCP de terceros cuando exista una integración real. WebMCP permanece como legado V1; no es dependencia del flujo V2.
6. **Persistencia:** Supabase/PostgreSQL con RLS, auditoría y escenarios versionados.

## Flujo end-to-end

```text
Intake Web/Alexa
  -> canonical FreightRequest DRAFT
  -> route resolution and serviceability by origin/destination/date
  -> transport plans: carrier/service + legs + compatible assets/capacity
  -> eligibility and requirement explanations
  -> opportunities sent to compatible carriers
  -> manual/automatic CarrierOffers
  -> normalized offer set
  -> deterministic ScoringPolicy
  -> shipper SelectionDecision (plan + 1..* attributable offers, exact coverage)
  -> per-offer Booking authorization and adapter execution
  -> capacity reservation or verified external carrier commitment
  -> tracking and evidence
```

## Límites obligatorios

- Los canales no calculan scores ni fabrican ofertas.
- La elegibilidad no se infiere de sedes ni produce precios comerciales; produce planes candidatos, recursos necesarios y motivos.
- La planificación puede combinar recursos propios y socios documentados, pero no inventa una oferta unificada de varios carriers ni autorizaciones de ruta/frontera.
- Web y Alexa+ reciben el mismo resultado del servicio de aplicación; el stepper no necesita WebMCP.
- Una oferta siempre pertenece a un carrier/service y request concretos.
- La identidad de oferta, oportunidad, plan y asignaciones debe coincidir; una selección de varias ofertas no se convierte automáticamente en un contrato/booking único. El workflow ROAD admite `1..*` ofertas vigentes por decisión, con cobertura exacta de las asignaciones y bookings separados por oferta/emisor.
- El ranking opera sobre ofertas normalizadas y elegibles.
- La ejecución externa ocurre detrás de adapters; el dominio no importa browser, SDKs de voz ni clientes de terceros.
- Todo resultado remoto conserva correlation ID, fuente, timestamps y estado técnico/comercial separado.
- Autorizar booking no prueba capacidad confirmada: se requiere reserva interna vigente o evidencia verificable de compromiso del carrier por recurso portador. El estado técnico del adaptador no se mezcla con autorización del shipper ni confirmación comercial del carrier.

## Estructura de implementación preferida

- `*-policy.ts`: reglas puras y determinísticas.
- `*-server.ts`: autenticación, Supabase y adapters.
- Hono routes y MCP tools: validación y mapping de transporte.
- Schemas Zod compartidos: contratos cerrados y versionados.

La documentación histórica de V1 se identifica desde [el índice V1](https://github.com/Chujutak2024/cargomesh/blob/feef2419fa5f786c9a6063f85aeee452dd9eb84b/docs/v1-webmcp/README.md) para comparar y migrar, no para limitar V2.
