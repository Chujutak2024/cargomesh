# CargoMesh V2 — Especificación de Dominio, Clases y Persistencia del Backend
## Arquitectura Hexagonal, Máquina de Estados y Mapeo Objeto-Relacional (TypeScript ⟷ Supabase)

> **Estado documental:** este archivo describe la **arquitectura objetivo V2**. Las capacidades que aún no existen en el código deben tratarse como `TARGET/PLANNED`; el flujo MCP ya validado y los componentes existentes no deben reescribirse solo para coincidir con este documento.

> 📚 **Suite Documental de Arquitectura V2:**  
> • **Blueprint Maestro:** [CARGOMESH_V2_EVOLUTION_BLUEPRINT.md](./CARGOMESH_V2_EVOLUTION_BLUEPRINT.md)  
> • **Esquema de Base de Datos:** [DATABASE_SCHEMA_V2_PROPOSAL.md](./DATABASE_SCHEMA_V2_PROPOSAL.md)  
> • **Diagramas de Dominio y Persistencia:** [BACKEND_DOMAIN_AND_PERSISTENCE_DIAGRAMS.md](./BACKEND_DOMAIN_AND_PERSISTENCE_DIAGRAMS.md) *(Este documento)*  
> • **Taxonomía de Carga y Precios USD:** [CARGO_DIMENSIONS_AND_TAXONOMY_V2.md](./CARGO_DIMENSIONS_AND_TAXONOMY_V2.md)  
> • **Plan Operativo y Sprints:** [MASTER_BACKLOG.md](./MASTER_BACKLOG.md)

---

## 🧭 1. Arquitectura de Dominio Corregida

CargoMesh V2 usa DDD + Ports & Adapters. El principio fundamental es separar:

- **canales de entrada:** Hono REST y MCP/Alexa+;
- **casos de uso:** intake, matching, oportunidades, ofertas, ranking y booking;
- **dominio:** FreightRequest, FreightOpportunity, CarrierOffer, Carrier, Route;
- **infraestructura:** Supabase, geocodificación/ruteo, portal carrier y WebMCP.

```mermaid
graph TD
    ALEXA["Alexa+ MCP"] --> MCP["/mcp Adapter"]
    WEB["Shipper Web"] --> HONO["Hono REST"]
    CARRIER_WEB["Carrier Portal"] --> HONO

    MCP --> INTAKE["FreightIntakeService"]
    HONO --> INTAKE
    MCP --> MATCH["CarrierMatchingService"]
    HONO --> MATCH

    MATCH --> OPP["FreightOpportunityService"]
    OPP --> MANUAL["ManualOfferService"]
    OPP --> AUTO["AutoOfferExecutionPort"]

    AUTO --> BROWSER["Chrome headless WebMCP Adapter"]
    BROWSER --> PROVIDER["Provider WebMCP Page"]

    MANUAL --> OFFER["CarrierOfferService"]
    BROWSER --> OFFER
    OFFER --> MCDA["DecisionEngine / BALANCED"]

    INTAKE --> DB[("Supabase / PostgreSQL")]
    MATCH --> DB
    OPP --> DB
    OFFER --> DB
    MCDA --> DB

    MCDA --> BEDROCK["Bedrock explanation (optional)"]
```

El browser worker es un **adaptador de infraestructura** para carriers `AUTO/HYBRID`; no forma parte de Alexa+ ni del núcleo de dominio.

## 🧱 2. Modelo de Dominio

```mermaid
classDiagram
    class Organization {
        +UUID id
        +String legalName
        +CommercialScoringPolicy policy
    }

    class Facility {
        +UUID id
        +String name
        +GeoCoordinates coordinates
        +FacilityType type
    }

    class FreightRequest {
        +UUID id
        +String requestCode
        +FreightStatus status
        +CargoSpecification cargo
        +GeoLocation origin
        +GeoLocation destination
        +Number budgetMaxUsd
        +submitDraft()
        +startMatching()
    }

    class Carrier {
        +UUID id
        +String name
        +TransportMode[] modes
        +OfferMode offerMode
        +ReliabilityHistory reliability
    }

    class CarrierDepot {
        +UUID id
        +GeoCoordinates coordinates
        +DepotType type
        +Number fleetCapacity
        +calculateDeadheadDistance()
    }

    class LogisticsNode {
        +UUID id
        +LogisticsNodeType type
        +GeoCoordinates coordinates
        +Boolean customsEnabled
    }

    class FreightOpportunity {
        +UUID id
        +UUID freightRequestId
        +UUID carrierId
        +OpportunityStatus status
        +OfferMode responseMode
        +Number deadheadDistanceKm
        +acceptAutoEvaluation()
        +submitManualOffer()
        +reject()
    }

    class CarrierOffer {
        +UUID id
        +UUID opportunityId
        +UUID carrierId
        +OfferSource source
        +Number quotedPriceUsd
        +Number transitTimeHours
        +Number reliabilityScore
        +Number mcdaFinalScore
    }

    class CommercialScoringPolicy {
        +Number costWeight
        +Number slaWeight
        +Number timeWeight
        +Number availabilityWeight
        +Number routeExperienceWeight
        +Number orgHistoryWeight
        +evaluateOffers()
    }

    Organization "1" *-- "many" Facility
    Organization "1" *-- "many" FreightRequest
    Organization "1" *-- "1" CommercialScoringPolicy

    Carrier "1" *-- "many" CarrierDepot
    Carrier "1" *-- "many" FreightOpportunity
    Carrier "1" *-- "many" CarrierOffer

    FreightRequest "1" *-- "many" FreightOpportunity
    FreightRequest "1" *-- "many" CarrierOffer
    FreightOpportunity "1" --> "0..1" CarrierOffer : response
```

### Regla de ownership comercial

`CarrierOffer` pertenece al carrier:

- `MANUAL_PORTAL`: una persona del carrier envía el precio.
- `WEBMCP_AUTO`: la política automática del sistema carrier lo calcula y envía.

CargoMesh puede calcular benchmarks y elegibilidad, pero **no crea una oferta comercial final unilateralmente**.

## ⚙️ 3. Máquinas de Estado

### `FreightRequest`

Se conserva la máquina compatible con el flujo actual:

```mermaid
stateDiagram-v2
    [*] --> DRAFT
    DRAFT --> PENDING : submit_freight_request
    PENDING --> ORCHESTRATING : find_freight_options
    ORCHESTRATING --> OPTIONS_READY : ofertas suficientes / ventana cerrada
    ORCHESTRATING --> PENDING : no_match / retryable
    OPTIONS_READY --> AWAITING_SELECTION : presentar ranking
    AWAITING_SELECTION --> BOOKING : selección autorizada
    BOOKING --> BOOKED : carrier confirma
    BOOKING --> RECOVERING : carrier rechaza
    RECOVERING --> BOOKED : alternativa confirmada
    RECOVERING --> FAILED : sin alternativa
    BOOKED --> IN_TRANSIT
    IN_TRANSIT --> DELIVERED
```

`ORCHESTRATING` significa que CargoMesh está identificando carriers, publicando oportunidades y recolectando respuestas. No implica que CargoMesh calcule por sí mismo todas las ofertas.

### `FreightOpportunity`

```mermaid
stateDiagram-v2
    [*] --> INVITED
    INVITED --> AUTO_EVALUATING : carrier AUTO/HYBRID elegible
    INVITED --> AWAITING_RESPONSE : carrier MANUAL o revisión
    AUTO_EVALUATING --> OFFERED : WebMCP auto-oferta
    AUTO_EVALUATING --> AWAITING_RESPONSE : manual review required
    AWAITING_RESPONSE --> OFFERED : carrier envía oferta
    AWAITING_RESPONSE --> REJECTED : carrier rechaza
    INVITED --> EXPIRED : timeout
    AWAITING_RESPONSE --> EXPIRED : timeout
```

Esta segunda máquina captura el comportamiento estilo inDrive sin contaminar el lifecycle principal del FreightRequest.

## 🔄 4. Secuencia End-to-End: Alexa+ / Web → Marketplace → Ranking

```mermaid
sequenceDiagram
    autonumber
    actor User as Shipper
    participant Alexa as Alexa+
    participant MCP as CargoMesh /mcp
    participant Intake as FreightIntakeService
    participant Match as CarrierMatchingService
    participant DB as Supabase
    participant Auto as AutoOffer Browser Worker
    participant Carrier as Carrier Portal/WebMCP
    participant Decision as Decision Engine
    participant Bedrock as Bedrock (optional)

    User->>Alexa: "Necesito mover 10 pallets de Callao a Santiago"
    Alexa->>MCP: create_freight_request
    MCP->>Intake: create draft
    Intake->>DB: DRAFT

    User->>Alexa: "Envíala a cotizar"
    Alexa->>MCP: submit_freight_request
    MCP->>Intake: DRAFT -> PENDING

    Alexa->>MCP: find_freight_options
    MCP->>Match: match carriers
    Match->>DB: FreightOpportunity por carrier compatible

    par Carrier AUTO/HYBRID
        Match->>Auto: execute opportunity
        Auto->>Carrier: WebMCP check coverage/capacity/quote
        Carrier-->>Auto: CarrierOffer o MANUAL_REVIEW_REQUIRED
        Auto->>DB: persiste respuesta/oferta
    and Carrier MANUAL
        Carrier->>DB: revisa oportunidad y envía/rechaza oferta desde portal
    end

    Decision->>DB: lee CarrierOffer válidas
    Decision->>Decision: ranking determinista BALANCED
    Decision->>DB: persiste ranking

    Alexa->>MCP: get_freight_options
    MCP->>DB: lee ranking
    opt explicación natural
        MCP->>Bedrock: explicar trade-offs
        Bedrock-->>MCP: texto breve
    end
    MCP-->>Alexa: opciones estructuradas
    Alexa-->>User: "Recibiste tres ofertas..."
```

### Distancia y recomendación

El carrier más cercano no gana automáticamente. La proximidad/deadhead afecta:

- costo;
- ETA;
- disponibilidad;
- probabilidad de aceptar;
- experiencia/presencia en el corredor.

El Decision Engine combina esas consecuencias con las demás dimensiones de la política.

## 🗺️ 5. Mapeo Objeto-Relacional Corregido

| Tipo de dominio | Persistencia | Rol |
|---|---|---|
| `Organization` | `organizations` | Shipper / tenant |
| `Facility` | `facilities` | Sedes del shipper |
| `FreightRequest` | `freight_requests` | Necesidad logística publicada |
| `Carrier` | `carriers` | Empresa transportista |
| `CarrierDepot` | `carrier_depots` | Base/patio propio; deadhead |
| `LogisticsNode` | `logistics_nodes` | Puerto, aeropuerto, terminal, aduana, cross-dock |
| `FreightOpportunity` | `freight_opportunities` | Invitación de un request a un carrier |
| `CarrierOffer` | `carrier_offers` | Respuesta comercial manual o WebMCP auto |
| `CommercialScoringPolicy` | `commercial_scoring_policies` | Pesos del Decision Engine |
| `RouteCorridor` / legs | `route_corridors` / `route_legs` | Ruta nacional/internacional/multimodal |

### Invariante principal

```text
FreightRequest ≠ CarrierOffer
```

Una solicitud expresa la necesidad del shipper. Una oferta expresa la propuesta del carrier. `FreightOpportunity` es el puente entre ambas.

## 🛡️ 6. Reglas de Transaccionalidad e Idempotencia en Base de Datos

1. **Concurrencia Optimista Estricta:**  
   Toda actualización de estado en `freight_requests` exige comprobar:
   ```sql
   WHERE id = $target_id AND draft_version = $expected_draft_version
   ```
   Si no coincide, la base de datos aborta y Hono/MCP devuelve `409 STALE_DRAFT`.
2. **Deduplicación Criptográfica:**  
   La llave única `(organization_id, requested_by_member_id, creation_idempotency_key)` garantiza que llamadas duplicadas de Alexa ante reconexiones de red no generen fletes duplicados; devuelven el registro existente con `replayed: true`.
3. **Compuerta Financiera:**  
   Si el campo `quoted_price_usd > 5000.00` y el `requested_by_member_id` tiene rol `REQUESTER`, la transacción marca automáticamente `approval_status = 'PENDING_SUPERVISOR_APPROVAL'`, impidiendo la emisión del `confirmationReference` hasta que el supervisor firme en la web.