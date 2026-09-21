# CargoMesh V2 — Especificación de Dominio, Clases y Persistencia del Backend
## Arquitectura Hexagonal, Máquina de Estados y Mapeo Objeto-Relacional (TypeScript ⟷ Supabase)

---

## 🧭 1. Visión General de la Arquitectura de Persistencia

CargoMesh V2 adopta un enfoque de **Diseño Guiado por el Dominio (DDD) y Arquitectura Hexagonal (Ports & Adapters)**. La lógica de negocio, las reglas comerciales de flete, la tarificación paramétrica y los algoritmos MCDA residen en el **Núcleo de Dominio (Domain Core)**, completamente desacoplados de los adaptadores de transporte (Hono V2 y Servidor MCP de Alexa) y del motor de persistencia (Supabase / PostgreSQL 15).

```mermaid
graph TD
    subgraph "Adaptadores Primarios (Transports / Inbound Ports)"
        ALEXA_MCP["🎙️ Alexa Streamable HTTP Adapter (/mcp)"]
        HONO_REST["💻 Hono V2 REST Adapter (/api/v2/*)"]
    end

    subgraph "Capa de Aplicación & Casos de Uso (Application Services)"
        SVC_INTAKE["FreightIntakeService"]
        SVC_ROUTE["RouteOptimizationService"]
        SVC_MCDA["MCDAEvaluationService"]
        SVC_BOOKING["BookingOrchestrationService"]
    end

    subgraph "Capa de Dominio (Domain Model & Aggregates)"
        AGG_FR["FreightRequest Aggregate<br>(Root Entity + State Machine)"]
        AGG_ORG["Organization & Facilities Aggregate"]
        AGG_CARRIER["Carrier & Fleet Aggregate"]
        VO_ROUTE["RouteCorridor (Value Object)"]
        VO_MCDA["CommercialPolicy (Value Object)"]
    end

    subgraph "Adaptadores Secundarios (Outbound Ports / Infrastructure)"
        REPO_DB[("🗄️ Supabase Postgres Repositories<br>(RLS, Idempotencia SHA-256, draft_version)")]
        CLIENT_GMAPS["🗺️ Google Maps Routes & Places API Client"]
        CLIENT_BEDROCK["🧠 Amazon Bedrock (Claude 3 Haiku) Client"]
    end

    ALEXA_MCP --> SVC_INTAKE
    ALEXA_MCP --> SVC_ROUTE
    ALEXA_MCP --> SVC_BOOKING
    HONO_REST --> SVC_INTAKE
    HONO_REST --> SVC_ROUTE
    HONO_REST --> SVC_BOOKING

    SVC_INTAKE --> AGG_FR
    SVC_ROUTE --> VO_ROUTE
    SVC_MCDA --> VO_MCDA
    SVC_BOOKING --> AGG_CARRIER

    AGG_FR --> REPO_DB
    VO_ROUTE --> CLIENT_GMAPS
    AGG_CARRIER --> REPO_DB
    SVC_BOOKING --> CLIENT_BEDROCK
```

---

## 🧱 2. Diagrama de Clases del Dominio (Domain Class Diagram)

Este diagrama modela las entidades de negocio, sus atributos, métodos operativos y relaciones en TypeScript:

```mermaid
classDiagram
    class Organization {
        +UUID id
        +String legalName
        +String code
        +IndustrySector industrySector
        +LoyaltyTier loyaltyTier
        +Number creditLimitUsd
        +Number maxAutoApprovalBudgetUsd
        +addFacility(facility: Facility)
        +verifyCreditLimit(amountUsd: number): boolean
    }

    class Facility {
        +UUID id
        +String facilityCode
        +String name
        +FacilityType facilityType
        +GeoCoordinates coordinates
        +DockCapabilities dockCapabilities
        +String accessProtocol
        +isAccessibleFor(vehicleAsset: VehicleAsset): boolean
    }

    class OrganizationMember {
        +UUID id
        +UUID authUserId
        +String displayName
        +MemberRole role
        +MemberStatus status
        +canApproveBudget(amountUsd: number): boolean
    }

    class FreightRequest {
        +UUID id
        +String requestCode
        +UUID organizationId
        +FreightFlowType flowType
        +FreightStatus status
        +Number draftVersion
        +String creationIdempotencyKey
        +String creationPayloadHash
        +CargoSpecification cargo
        +RouteCorridor route
        +PreferredTransportMode preferredMode
        +Number budgetMaxUsd
        +submitDraft(): void
        +transitionTo(newStatus: FreightStatus): void
        +requiresSupervisorApproval(): boolean
        +assignOffers(offers: CarrierOffer[]): void
    }

    class RouteCorridor {
        +String corridorCode
        +GeoLocation origin
        +GeoLocation destination
        +Number roadDistanceKm
        +Number nauticalMiles
        +Number estimatedHours
        +String[] borderCrossings
        +Number maxElevationMeters
        +calculateEstimatedTolls(): number
    }

    class Carrier {
        +UUID id
        +String name
        +String code
        +TransportMode[] transportModes
        +Number baseRatePerKmUsd
        +Number terminalHandlingFeeUsd
        +Number reliabilityRate
        +calculateDynamicPrice(route: RouteCorridor, cargo: CargoSpecification): number
    }

    class CarrierDepot {
        +UUID id
        +String depotCode
        +String city
        +String countryCode
        +GeoCoordinates coordinates
        +Number assignedFleetCapacity
        +calculateDeadheadDistance(targetLocation: GeoLocation): number
    }

    class VehicleAsset {
        +UUID id
        +String plateOrRegistration
        +AssetMode assetMode
        +Number maxPayloadKg
        +Number maxTeuCapacity
        +TelemetryProtocol telemetryProtocol
        +GeoCoordinates lastKnownLocation
    }

    class CarrierOffer {
        +UUID id
        +UUID carrierId
        +Number quotedPriceUsd
        +Number transitTimeHours
        +Number reliabilityScore
        +Number mcdaFinalScore
        +Boolean isWinnerRecommendation
    }

    class CommercialScoringPolicy {
        +UUID id
        +Number costWeight
        +Number slaWeight
        +Number timeWeight
        +Number availabilityWeight
        +Number routeExperienceWeight
        +Number orgHistoryWeight
        +evaluateOffers(offers: CarrierOffer[]): CarrierOffer[]
    }

    Organization "1" *-- "many" Facility : posee
    Organization "1" *-- "many" OrganizationMember : tiene
    Organization "1" *-- "1" CommercialScoringPolicy : define
    Organization "1" *-- "many" FreightRequest : emite

    FreightRequest "many" o-- "1" Facility : originFacility
    FreightRequest "many" o-- "1" Facility : destinationFacility
    FreightRequest "1" *-- "1" RouteCorridor : recorre
    FreightRequest "1" *-- "many" CarrierOffer : recibe

    Carrier "1" *-- "many" CarrierDepot : opera
    Carrier "1" *-- "many" VehicleAsset : dispone
    Carrier "1" *-- "many" CarrierOffer : genera
    CarrierDepot "1" o-- "many" VehicleAsset : estaciona
```

---

## ⚙️ 3. Diagrama de Máquina de Estados (Lifecycle de `FreightRequest`)

El ciclo de vida de una solicitud de carga está estrictamente gobernado para evitar estados inconsistentes, garantizando la concurrencia optimista (`draft_version`):

```mermaid
stateDiagram-v2
    [*] --> DRAFT : create_freight_request (Idempotente SHA-256)

    DRAFT --> DRAFT : Edición de borrador (Incrementa draft_version)
    DRAFT --> PENDING : submitDraft() (Validación de campos mínimos)

    PENDING --> ORCHESTRATING : find_freight_options() (Disparo a Carriers)
    
    ORCHESTRATING --> OPTIONS_READY : Cotizaciones recibidas y rankeadas con MCDA

    OPTIONS_READY --> AWAITING_SELECTION : Presentación inDrive (Web / Alexa)

    state SelectionDecision <<choice>>
    AWAITING_SELECTION --> SelectionDecision : Selección de oferta ganadora

    SelectionDecision --> PENDING_SUPERVISOR_APPROVAL : Si Cotización > $5,000 USD y rol = REQUESTER
    SelectionDecision --> BOOKING : Si Cotización <= $5,000 USD o rol = OWNER/SUPERVISOR

    PENDING_SUPERVISOR_APPROVAL --> BOOKING : Supervisor aprueba en portal Web
    PENDING_SUPERVISOR_APPROVAL --> CANCELLED : Supervisor rechaza cotización

    BOOKING --> BOOKED : authorize_and_book (confirmationReference emitido)
    
    state BookingEvaluation <<choice>>
    BOOKING --> BookingEvaluation : Verificación del transportista
    BookingEvaluation --> BOOKED : Carrier CONFIRMED
    BookingEvaluation --> RECOVERING : Carrier REJECTED (Simulación Andes)

    RECOVERING --> BOOKED : Auto-Recovery a Inca Logistics CONFIRMED
    RECOVERING --> FAILED : Sin capacidad alternativa disponible

    BOOKED --> IN_TRANSIT : Telemetría activa en ruta
    IN_TRANSIT --> DELIVERED : Confirmación de entrega (POD firmado)

    DELIVERED --> [*]
    CANCELLED --> [*]
    FAILED --> [*]
```

---

## 🔄 4. Diagrama de Secuencia de Persistencia (Flujo Dual: Alexa ➔ Backend ➔ DB)

Este diagrama detalla cómo se ejecuta una solicitud por comando de voz en Alexa, pasando por las validaciones criptográficas de base de datos hasta el motor MCDA:

```mermaid
sequenceDiagram
    autonumber
    actor User as Usuario (Voz Alexa)
    participant Alexa as Alexa Skill (Echo Device)
    participant MCP as Servidor /mcp (Streamable HTTP)
    participant IntakeSvc as FreightIntakeService
    participant RouteSvc as RouteOptimizationService
    participant GMaps as Google Maps API / Cache
    participant DB as PostgreSQL (Supabase RLS)
    participant MCDA as MCDAEvaluationService
    participant Bedrock as Amazon Bedrock (Haiku)

    User->>Alexa: "Alexa, cotiza envío de 10 pallets de Callao a Santiago"
    Alexa->>MCP: POST /mcp tools/call resolve_freight_route
    MCP->>RouteSvc: resolveRoute("Callao", "Santiago")
    RouteSvc->>GMaps: Consulta matriz O-D (Distance Matrix)
    GMaps-->>RouteSvc: 3,450 km | 48 horas | Peajes: $120
    RouteSvc-->>MCP: RouteAnalysis + VoiceSummarySSML
    MCP-->>Alexa: <speak>Ruta de 3,450 km calculada. ¿Deseas crear la solicitud?</speak>
    Alexa-->>User: Respuesta de voz inmediata (< 600 ms)

    User->>Alexa: "Sí, créala con presupuesto de 4,000 dólares"
    Alexa->>MCP: POST /mcp tools/call create_freight_request (idempotencyKey)
    MCP->>IntakeSvc: createIdempotentDraft(input)
    IntakeSvc->>DB: INSERT INTO freight_requests (hash, draft_version=1)
    DB-->>IntakeSvc: Request Creado (Status: DRAFT)
    IntakeSvc->>DB: UPDATE freight_requests SET status='PENDING' (submit)
    
    IntakeSvc->>MCDA: evaluateCarriers(route, cargo)
    Note over MCDA: Aplica Tarifa Dinámica por Km<br>Andes: $3,200 | Pacific: $2,400 | Inca: $3,800<br>MCDA Scores: Andes (89), Inca (84), Pacific (72)
    MCDA->>DB: INSERT INTO carrier_offers (offers)
    MCDA-->>IntakeSvc: Ranked Offers List
    
    IntakeSvc->>Bedrock: generateVoiceExplanation(Top 1 Winner)
    Bedrock-->>IntakeSvc: "La mejor opción es Andes Express por $3,200 con score de 89%..."
    IntakeSvc-->>MCP: Structured Data + SSML
    MCP-->>Alexa: Voice Output
    Alexa-->>User: "La mejor opción es Andes Express por $3,200. ¿Deseas reservarla?"
```

---

## 🗺️ 5. Mapeo Objeto-Relacional (TypeScript ⟷ Tablas de PostgreSQL)

Para que el equipo mantenga tipado estricto de extremo a extremo, este es el contrato de correspondencia:

| Clase / Tipo en TypeScript | Tabla en Supabase | Llave Primaria / Única | Invariante de Negocio |
|---|---|---|---|
| `Organization` | `public.organizations` | `id (UUID)` / `code (UNIQUE)` | Moneda base `USD` o `PEN`. Tiers: `STANDARD`, `GOLD`, `PLATINUM`. |
| `Facility` | `public.facilities` | `id (UUID)` / `(organization_id, facility_code)` | Coordenadas GPS válidas (`numeric(10,7)`). Vinculada a Google Maps Place ID. |
| `OrganizationMember` | `public.organization_members` | `id (UUID)` / `(organization_id, auth_user_id)` | Roles estrictos: `OWNER`, `SUPERVISOR`, `REQUESTER`. |
| `FreightRequest` | `public.freight_requests` | `id (UUID)` / `code (UNIQUE)` | Deduplicación SHA-256 (`creation_idempotency_key`), control optimista (`draft_version`). |
| `RouteCorridor` | `public.route_corridors` | `id (UUID)` / `corridor_code (UNIQUE)` | Distancia carretera en km, millas náuticas, peajes y polilínea GeoJSON. |
| `Carrier` | `public.carriers` | `id (UUID)` / `code (UNIQUE)` | Modos `['ROAD', 'MARITIME', 'RAIL', 'AIR']`, tarifa paramétrica por km. |
| `CarrierDepot` | `public.carrier_depots` | `id (UUID)` / `(carrier_id, depot_code)` | Patios físicos en Perú y Chile para cálculo de *deadhead*. |
| `VehicleAsset` | `public.vehicles` | `id (UUID)` / `code (UNIQUE)` | Activos terrestres, marítimos, ferroviarios y telemetría activa. |
| `CommercialScoringPolicy` | `public.commercial_scoring_policies` | `id (UUID)` | Suma de los 6 pesos de ponderación = exactamente `1.000`. |
| `CarrierOffer` | `public.carrier_offers` | `id (UUID)` | Ofertas rankeadas estilo inDrive con desglose MCDA. |

---

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
