# CargoMesh V2 — Blueprint Maestro de Evolución Multimodal y Enterprise
## Plataforma de Orquestación Logística Autónoma (Voz Alexa+, WebMCP y Gobernanza Determinista)

---

## 🧭 1. Resumen Ejecutivo y Nueva Visión del Proyecto
CargoMesh evoluciona de un despachador local de camiones a un **Sistema Operativo Logístico Multimodal Empresarial**. La plataforma conecta a generadores de carga industrial (**Shippers** con múltiples sedes y gobernanza estricta) con redes de transportistas (**Carriers** con flotas de camiones, barcos, trenes y aviones), orquestados mediante agentes de voz (**Alexa Skills Kit + Amazon Bedrock**) y ejecutados por protocolos de herramientas web (**WebMCP**).

```mermaid
graph TD
    subgraph "Canales de Entrada (Dual Intake)"
        ALEXA["🎙️ Alexa Skill / Echo Device<br>(Operador en Campo / Despachador)"]
        WEB["💻 Enterprise Shipper Web<br>(Workspace Next.js / Stepper V2)"]
    end

    subgraph "Capa de Orquestación & Inteligencia"
        MCP["⚡ Servidor CargoMesh MCP (/mcp)<br>Streamable HTTP (Spec 2025-11-25+)"]
        TOKEN_OPT["🎯 Token Optimizer & SSML Engine<br>(Ahorro 85% Tokens / <700ms Latencia)"]
        ROUTING_MCP["📍 Route & Geocoding MCP Tool<br>(Google Maps API + Geocodificación)"]
        SUGGEST_API["💡 Suggestions Engine (/api/v2/freight/suggestions)<br>(Autocompletado & Recomendación en Vivo)"]
        MCDA["⚖️ Motor Determinista MCDA / TOPSIS<br>(Política ACME Mining 6D)"]
        BEDROCK["🧠 Amazon Bedrock (Claude 3 Haiku)<br>(Síntesis Explicativa de Voz)"]
    end

    subgraph "Capa de Ejecución de Carriers (WebMCP)"
        ANDES["🚛 Andes Express (Road / Camiones)"]
        PACIFIC["🚢 Pacific Lines (Maritime / Cabotaje)"]
        INCA["🚆 Inca Logistics (Rail / Intermodal)"]
        AIR["✈️ SouthAir Cargo (Air / Repuestos Críticos)"]
    end

    subgraph "Capa de Persistencia & Gobernanza"
        DB[("🗄️ PostgreSQL + RLS (Supabase)<br>Multi-Sede, Idempotencia SHA-256, Concurrencia")]
    end

    ALEXA --> MCP
    WEB --> MCP
    MCP --> TOKEN_OPT
    TOKEN_OPT --> BEDROCK
    MCP --> ROUTING_MCP
    WEB --> SUGGEST_API
    ROUTING_MCP --> MCDA
    SUGGEST_API --> DB
    MCDA --> ANDES
    MCDA --> PACIFIC
    MCDA --> INCA
    MCDA --> AIR
    MCDA --> DB
```

---

## 🚢 2. Modelo Multimodal de Carriers (Tierra, Mar, Riel y Aire)

En la logística industrial (especialmente minería y manufactura), los fletes rara vez son 100% en camión. CargoMesh modela los carriers como entidades de transporte multimodal:

### Modos de Transporte Soportados (`transport_mode`):
1. **`ROAD` (Camiones):** FTL (Full Truckload) y LTL (Less than Truckload), plataformas cama-baja, tolvas mineraleras y furgones refrigerados.
2. **`MARITIME` (Embarcaciones / Cabotaje):** Transporte marítimo de contenedores secos (`20GP`, `40HC`) y carga refrigerada entre puertos costeros (ej. Callao ➔ San Antonio / Valparaíso).
3. **`RAIL` (Trenes de Carga):** Transporte masivo a granel desde depósitos andinos hacia terminales portuarios.
4. **`AIR` (Carga Aérea):** Envíos express de alta urgencia (repuestos de maquinaria detenida, insumos médicos y electrónicos).

### Perfil Extendido de Carrier en Base de Datos:
```typescript
interface CarrierProfile {
  id: string;
  name: string;
  slug: string;
  transport_modes: ('ROAD' | 'MARITIME' | 'RAIL' | 'AIR')[];
  coverage_geofences: {
    origin_regions: string[];
    destination_regions: string[];
    licensed_corridors: string[];
  };
  fleet_capabilities: {
    max_payload_kg: number;
    specializations: ('HAZMAT' | 'COLD_CHAIN' | 'OVERSIZED' | 'HEAVY_HAUL')[];
    containers_supported: ('20GP' | '40HC' | 'REEFER' | 'FLATRACK')[];
  };
  webmcp_endpoint: string;
  reliability_history: {
    on_time_delivery_rate: number; // 0.0 a 1.0
    claims_ratio: number;
    completed_runs: number;
  };
}
```

---

## 🗺️ 3. Ruteo Inteligente con Google Maps API y Corredores Multimodales

La búsqueda de fletes deja de ser una comparación de distancia lineal para convertirse en un **Optimizador de Ruta por Carrier**:

1. **Ruteo Terrestre Dinámico (Google Maps Routes & Distance Matrix API):**
   * Calcula distancia real por carretera, tiempos de tránsito considerando restricciones de tráfico pesado, peajes y curvas topográficas en cruces cordilleranos (ej. Paso Los Libertadores).
2. **Corredores Multimodales (Hub-and-Spoke):**
   * Si una carga va de una mina en Apurímac a una fundición en Santiago:
     * **Tramo 1 (Carretera):** Mina Las Bambas ➔ Puerto del Callao (Google Maps API: 950 km).
     * **Tramo 2 (Marítimo):** Terminal Portuario Callao ➔ Puerto San Antonio (Ruta Náutica: 1,350 MN).
     * **Tramo 3 (Riel / Carretera):** Puerto San Antonio ➔ Parque Industrial Santiago (Google Maps API: 110 km).
3. **Búsqueda y Segmentación por Carrier:**
   * El motor evalúa si un solo carrier multimodal cubre el servicio completo ("End-to-End") o si se orquestan carriers complementarios con transbordo en Hubs certificados.

---

## 📍 4. Nuevo MCP de Ruteo y Búsqueda Geográfica: `resolve_freight_route`

Para que el usuario pueda interactuar con Alexa mencionando cualquier dirección o sede de forma natural, creamos una tool MCP especializada en geocodificación y análisis de ruta con Google Maps.

### ¿Cómo interactúa el usuario por voz con Alexa?
> **Usuario:** *"Alexa, pídele a CargoMesh que calcule la ruta desde Minera Las Bambas hasta el Puerto de San Antonio para 25 toneladas de concentrado."*

### Contrato de la Tool MCP:
```typescript
export const ResolveFreightRouteInputSchema = z.object({
  originQuery: z.string().min(3).describe("Nombre de sede registrada o dirección libre (ej. 'Mina Las Bambas' o 'Av. Argentina 1234, Callao')"),
  destinationQuery: z.string().min(3).describe("Nombre de sede de destino o ciudad (ej. 'Puerto San Antonio, Chile')"),
  cargoWeightKg: z.number().positive().optional(),
  preferredMode: z.enum(['ROAD', 'MARITIME', 'RAIL', 'AIR', 'MULTIMODAL_OPTIMAL']).default('MULTIMODAL_OPTIMAL'),
});

export const ResolveFreightRouteOutputSchema = z.object({
  ok: z.literal(true),
  data: z.object({
    origin: z.object({
      formattedAddress: z.string(),
      latitude: z.number(),
      longitude: z.number(),
      matchedFacilityId: z.string().uuid().nullable(),
      matchedFacilityName: z.string().nullable(),
    }),
    destination: z.object({
      formattedAddress: z.string(),
      latitude: z.number(),
      longitude: z.number(),
      matchedFacilityId: z.string().uuid().nullable(),
      matchedFacilityName: z.string().nullable(),
    }),
    routeAnalysis: z.object({
      roadDistanceKm: z.number(),
      estimatedDriveHours: z.number(),
      borderCrossings: z.array(z.string()),
      elevationProfileMaxMeters: z.number(),
      suggestedMode: z.enum(['ROAD', 'MARITIME', 'RAIL', 'AIR', 'MULTIMODAL_INTERMODAL']),
      multimodalLegs: z.array(z.object({
        legIndex: z.number(),
        mode: z.enum(['ROAD', 'MARITIME', 'RAIL', 'AIR']),
        fromHub: z.string(),
        toHub: z.string(),
        distanceKm: z.number(),
      })),
    }),
    voiceSummarySsml: z.string().describe("Texto en formato SSML listo para que Alexa lo pronuncie sin procesar tokens adicionales"),
  }),
});
```

### Respuesta generada para Alexa (Cero latencia):
```xml
<speak>
  Ruta calculada de 2,410 kilómetros desde la sede <emphasis level="moderate">Mina Las Bambas</emphasis> 
  hasta el <emphasis level="moderate">Puerto de San Antonio</emphasis>. 
  Por el peso de 25 toneladas, el motor recomienda una estrategia <emphasis level="strong">Multimodal</emphasis>: 
  camión hasta el Callao y cabotaje marítimo por Pacific Cargo. 
  ¿Deseas que solicite cotizaciones para este corredor?
</speak>
```

---

## ⚖️ 5. Algoritmo Determinista de Consolidación (MCDA / TOPSIS)
Abandonamos aproximaciones heurísticas aleatorias en favor de un **Análisis de Decisión Multicriterio (MCDA)** estrictamente auditable, formal y matemático.

### Política Canónica de Evaluación (ACME Mining Perú):
* **25% Costo Financiero:** Minimización del precio cotizado total.
* **25% SLA & Confiabilidad:** Maximización del récord histórico de cumplimiento del transportista.
* **20% Tiempo de Tránsito:** Minimización de horas estimadas de entrega.
* **10% Disponibilidad de Flota:** Capacidad de respuesta y margen de camiones/contenedores en fecha solicitada.
* **10% Experiencia en Ruta:** Horas de tránsito del carrier en ese corredor geográfico específico.
* **10% Historial con la Organización:** Relación contractual previa y desempeño acumulado con ACME Mining.

### Formulación Matemática (Normalización Min-Max & Ponderación WSM/TOPSIS):
Para cada cotización $i$ en el criterio $j$:

$$\text{Para criterios de Minimización (Costo, Tiempo): } \quad R_{ij} = \frac{\max_k(x_{kj}) - x_{ij}}{\max_k(x_{kj}) - \min_k(x_{kj})}$$

$$\text{Para criterios de Maximización (SLA, Disponibilidad, Exp, Historial): } \quad R_{ij} = \frac{x_{ij} - \min_k(x_{kj})}{\max_k(x_{kj}) - \min_k(x_{kj})}$$

$$\text{Puntaje Final } S_i = \sum_{j=1}^{6} w_j \cdot R_{ij} \times 100 \quad \text{donde } \sum w_j = 1.0$$

* **Ventaja Innegociable:** El resultado es 100% determinista (mismos inputs = mismos scores exactos). **Amazon Bedrock no calcula ni altera los puntajes**, únicamente los recibe y genera la locución natural explicativa.

---

## 🏢 6. Definición del Cliente Empresarial (Shipper) y Gobernanza RBAC

El cliente es una organización corporativa con sedes y niveles de autorización:

### Estructura de Sedes (`facilities`):
Una empresa como **ACME Mining Perú** posee sedes diferenciadas:
* **Sede Mina (Apurímac):** Requiere vehículos con tracción 6x4, choferes con SCTR y pases mineros activos.
* **Sede Puerto (Callao):** Depósito fiscal con muelles de carga, montacargas y báscula electrónica.
* **Sede Destino (Santiago de Chile):** Planta de refinación con ventanas horarias estrictas de descarga.

### Jerarquía de Roles y Aprobación Financiera:
```mermaid
graph TD
    OWNER["👑 OWNER (Dueño Original)"]
    SUPERVISOR["🛡️ SUPERVISOR (Jefe de Logística)"]
    OPERATOR["👷 OPERATOR / REQUESTER (Despachador)"]

    OWNER -->|Define Sedes, Políticas MCDA y Límite de Crédito| SUPERVISOR
    SUPERVISOR -->|Aprueba bookings > $5,000 USD y excepciones| OPERATOR
    OPERATOR -->|Crea solicitudes por Voz o Web| DRAFT[Borrador DRAFT]
    DRAFT -->|Si presupuesto <= $5,000 USD| AUTO_APP[Auto-Aprobación]
    DRAFT -->|Si presupuesto > $5,000 USD| PEND_APP[Requiere Aprobación de Supervisor]
```

---

## 🔍 7. Auditoría de Adaptación de los MCPs Actuales (Gaps y Evolución)

Al auditar `cargomesh/src/server/mcp/tools/create-freight-request.ts` y `src/shared/schemas/freight-creation.ts`, detectamos los siguientes puntos a evolucionar:

| Campo / Funcionalidad | Estado Actual (V1 - Inicial) | Evolución Requerida (V2 - Multimodal) | Acción Técnica |
|---|---|---|---|
| **Método de Carga** | `cargoEntryMethod: z.literal("PALLETS")` | Soportar Contenedores, Tolvas y Carga Aérea | Ampliar a `z.enum(["PALLETS", "CONTAINER_20GP", "CONTAINER_40HC", "BULK_HOPPER", "AIR_CRATE"])`. |
| **Modo de Transporte** | No existe (asume camión por defecto) | Seleccionar carretera, mar, riel o multimodal | Agregar `transportModePreferred: z.enum(["ROAD", "MARITIME", "RAIL", "AIR", "MULTIMODAL_OPTIMAL"])`. |
| **Sedes de Origen/Destino** | Solo texto libre (`originCity`, `destinationCity`) | Identificadores de sedes de la empresa | Agregar `originFacilityId: z.string().uuid().nullable()` y `destinationFacilityId`. |
| **Geocodificación** | Sin coordenadas GPS | Integración con Google Maps API | Campos `originLatitude`, `originLongitude`, `destinationLatitude`, `destinationLongitude`. |
| **Búsqueda de Opciones** | `find_freight_options` solo busca camiones | Despacho a providers multimodales | El runner consulta en paralelo a Andes (Road), Pacific (Sea) e Inca (Rail). |

> **Principio de Compatibilidad:** La evolución es **aditiva**. Si un cliente o test antiguo envía únicamente `PALLETS` sin `facilityId`, el sistema asume los defaults de carretera sin fallar.

---

## 💡 8. Autocompletado y Motor de Sugerencias en Tiempo Real (`/api/v2/freight/suggestions`)

Para evitar que el usuario se equivoque al crear un flete y para acelerar la toma de decisiones, la interfaz web y el backend se comunican reactivamente:

### A. Autocompletado en Frontend:
1. **Google Places Autocomplete:** El campo de dirección ofrece predicciones geográficas en vivo mientras el usuario tipea.
2. **Facility Quick-Picker:** Menú desplegable con las sedes oficiales registradas de la empresa (ej. *"Sede Central Callao"*, *"Mina Las Bambas"*), cargando en 1 clic sus coordenadas, requisitos de muelle y horarios de atención.

### B. Motor de Sugerencias Inteligentes (`POST /api/v2/freight/suggestions`):
Mientras el usuario llena el formulario, una llamada debounced consulta al backend para devolver recomendaciones contextuales:

```typescript
// Payload de consulta mientras se llena el formulario:
POST /api/v2/freight/suggestions
{
  "originCity": "Callao",
  "destinationCity": "Santiago",
  "cargoWeightKg": 26000,
  "requiresRefrigeration": false
}

// Respuesta en tiempo real (<150ms):
{
  "ok": true,
  "data": {
    "recommendedTransportMode": "MARITIME",
    "modeJustification": "Por superar los 25,000 kg, el cabotaje marítimo Callao-San Antonio reduce el costo en 38% respecto al flete terrestre por carretera.",
    "benchmarkRate": {
      "estimatedMinUsd": 2800,
      "estimatedMaxUsd": 3400,
      "currency": "USD"
    },
    "availableCarriersCount": 3,
    "fastestOptionHours": 48,
    "greenestOptionCo2SavingsPercent": 42
  }
}
```

---

## 📋 9. Rediseño del Flujo de Rellenado Manual (Stepper V2 Enterprise)

El formulario manual en `/freight-request/new` evoluciona de un intake plano a un asistente guiado de 4 pasos optimizado para grandes empresas y para la demostración ante el jurado:

### Comparativa: Flujo V1 vs. Flujo V2
* **En V1:** El usuario debía tipear manualmente ciudad, país, dimensiones individuales de cada bulto y fechas ficticias, con riesgo de errores de validación.
* **En V2:** Flujo visual estructurado, autocompletado en cada paso y botón de escenario de 1 clic garantizado.

```mermaid
graph LR
    P1["1. Sedes & Ruteo<br>(Selector de Sede / Google Maps)"] --> P2["2. Activo & Carga<br>(Pallet, Contenedor, Tolva + HAZMAT)"]
    P2 --> P3["3. Modo & Política<br>(Recomendado / Road / Sea / Rail)"]
    P3 --> P4["4. Ventanas & Resumen<br>(Horarios, Presupuesto y Enviar)"]
```

### Los 4 Pasos del Stepper V2:

#### Paso 1: Sedes y Corredor Geográfico
* Selector rápido de **Sedes de la Empresa** (autocompleta dirección, país, región y coordenadas).
* Campo con **Google Places Autocomplete** para orígenes/destinos libres fuera de sedes.
* Mapa interactivo previo que traza el corredor vial/marítimo.

#### Paso 2: Especificación del Activo de Carga
* Selector visual mediante tarjetas ilustradas:
  * 📦 **Pallets Estándar** (120x100 cm).
  * 🚢 **Contenedor Marítimo** (`20GP` o `40HC`).
  * 🚜 **Tolva / Granel Minero** (Mineral bulk).
  * ✈️ **Paquetería Aérea Express**.
* Toggles rápidos con badges:
  * ❄️ **Cadena de Frío:** Despliega selector de rango térmico (-20°C a +4°C).
  * ☣️ **Carga Peligrosa (HAZMAT):** Despliega clase IMO (1 a 9).
  * 🛡️ **Escolta de Seguridad / Carga Valiosa**.

#### Paso 3: Modo de Transporte y Política Comercial
* Selección de Modo:
  * 🌟 **Recomendado por Motor (Multimodal Óptimo)**.
  * 🚛 Solo Carretera (Road).
  * 🚢 Cabotaje Marítimo (Maritime).
  * 🚆 Tren Intermodal (Rail).
* Selección de Política de Decisión:
  * ⚖️ **BALANCED (ACME Mining 6D - Canónica)**.
  * 💰 **Enfoque en Costo (Cost-First: 50% costo)**.
  * ⏱️ **Enfoque en Rapidez (Time-Critical: 50% tiempo)**.

#### Paso 4: Ventanas Operativas y Envío
* Selector de fecha de recojo respetando los horarios de la sede seleccionada.
* Campo de presupuesto máximo objetivo (opcional).
* Resumen consolidado con el indicador de **Deduplicación Criptográfica (SHA-256)** y concurrencia optimista (`draft_version: 1`).

#### ⭐ Invariante del Jurado: Botón Canónico de 1 Clic
* En la parte superior del formulario se mantiene el botón dorado:  
  **`[⚡ Cargar Escenario Canónico (Callao ➔ Santiago)]`**
* Al pulsarlo, el Stepper se auto-rellena en menos de 100 ms con los datos exactos del Golden Flow (`FR-1042`), permitiendo a los evaluadores probar el sistema sin fricción.

---

## 🎙️ 10. Arquitectura MCP para Alexa: Servidores en Uso y Estrategias de Ahorro de Tokens

Para que la experiencia por voz sea instantánea y económica en tokens de LLM, el diseño separa el cómputo pesado de la síntesis de voz.

### A. Herramientas MCP en Uso Actual (Competencia Alexa):
Implementadas con `@modelcontextprotocol/sdk: 1.30.0` sobre Streamable HTTP en `/mcp`:
1. **`create_freight_request`:** Inicializa la solicitud con deduplicación criptográfica (SHA-256) e idempotencia en estado `DRAFT`.
2. **`find_freight_options`:** Dispara la orquestación hacia los carriers y recopila las cotizaciones en tiempo real.
3. **`get_freight_options`:** Retorna las ofertas rankeadas por el motor determinista BALANCED.
4. **`authorize_and_book`:** Ejecuta la reserva con compuerta humana vinculando el `confirmationReference`.
5. **`get_booking_status`:** Consulta el tracking y telemetría del flete activo.
6. **`recover_booking`:** Protocolo automático de recuperación ante rechazo simulado.

---

### B. Nuevos MCPs y Patrones de Optimización de Tokens para Alexa:

El envío masivo de JSON crudo a un modelo de lenguaje en Alexa causa latencia (2 a 4 segundos de silencio) y desperdicio de tokens. Diseñamos 4 patrones de optimización:

#### 1. Patrón "Pre-Formatted Voice SSML" (`get_voice_briefing`):
* **Problema:** Enviar 3 cotizaciones completas con JSON anidado gasta ~800 tokens de contexto y fuerza al LLM a leer todo para responder un párrafo.
* **Solución:** El backend genera un string SSML ultra-compacto listo para ser sintetizado por Alexa sin pasar por razonamientos redundantes:
  ```xml
  <speak>
    Encontré 3 cotizaciones para Callao a Santiago. 
    La mejor opción es <emphasis level="strong">Andes Express</emphasis> por 3,200 dólares, 
    con 89% de score por su récord de puntualidad. 
    ¿Deseas reservar Andes o escuchar la siguiente opción?
  </speak>
  ```
* **Ahorro:** Reduce el consumo de tokens de entrada en un **85%** y la latencia a menos de 700 ms.

#### 2. Patrón "Progressive Disclosure" (Divulgación Progresiva):
* Alexa **solo entrega la recomendación Top 1** por defecto.
* Las opciones 2 y 3 permanecen en el estado de sesión del backend.
* Solo si el usuario pregunta: *"¿Por qué no Inca?"* o *"¿Cuál es la segunda opción?"*, Alexa llama a `get_option_drilldown(rank: 2)`, cargando solo los datos necesarios en ese turno conversacional.

#### 3. Herramienta de Pre-Validación de Slots (`validate_freight_intent_slots`):
* Antes de crear una solicitud, valida si las ciudades de origen y destino tienen puertos o terminales activos.
* Evita fallos de base de datos y conversaciones truncadas en Alexa cuando el usuario pronuncia mal un destino.

#### 4. Caché de Matrices de Distancia (Geohash Caching):
* Almacena en memoria las distancias entre las sedes corporativas frecuentes (`Callao ➔ Santiago`, `Apurímac ➔ Callao`).
* Evita consultar repetidamente a Google Maps API y no inyecta coordenadas GPS crudas al contexto de Alexa.

---

## 🌐 11. Red de Providers WebMCP para Carriers Multimodales

| Carrier | Modo Principal | Flota Típica | Tools WebMCP Expuestas en `/providers/[slug]` |
|---|---|---|---|
| **Andes Express** | `ROAD` (Terrestre) | 45 Tractocamiones Volvo FH, furgones secos y reefer | `quote_freight`, `reserve_capacity`, `confirm_booking`, `get_fleet_telemetry`, `submit_pod` |
| **Pacific Cargo Lines** | `MARITIME` (Cabotaje) | 4 Buques portacontenedores costeros (Feeder) | `quote_container_voyage`, `check_berth_availability`, `reserve_container_slot`, `issue_bill_of_lading`, `get_vessel_eta` |
| **Inca Logistics & Rail** | `RAIL` + `ROAD` (Intermodal) | 12 Locomotoras GE, vagones tolva y flota capilar | `quote_intermodal_freight`, `check_terminal_ramp`, `reserve_rail_car`, `dispatch_first_mile`, `track_waybill` |
| **SouthAir Cargo (Roadmap)** | `AIR` (Carga Aérea) | 2 Boeing 737-800BCF (Freighters) | `quote_air_cargo`, `check_pallet_space`, `book_airway_bill`, `track_flight_status`, `confirm_customs_clearance` |

---

## 🗄️ 12. Roadmap de Base de Datos (Evolución Aditiva en Supabase)

Para no alterar las 147 pruebas pgTAP ni la concurrencia optimista existente, las nuevas entidades se introducen mediante migraciones DDL aditivas:

```sql
-- 1. Enumeradores Multimodales
CREATE TYPE transport_mode_enum AS ENUM ('ROAD', 'MARITIME', 'RAIL', 'AIR', 'MULTIMODAL_OPTIMAL');
CREATE TYPE user_role_enum AS ENUM ('OWNER', 'SUPERVISOR', 'REQUESTER');
CREATE TYPE cargo_category_enum AS ENUM ('PALLETS', 'CONTAINER_20GP', 'CONTAINER_40HC', 'BULK_HOPPER', 'AIR_CRATE');

-- 2. Sedes de la Organización (Facilities)
CREATE TABLE facilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    facility_code TEXT NOT NULL,
    address TEXT NOT NULL,
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    has_dock BOOLEAN DEFAULT TRUE,
    has_rail_spur BOOLEAN DEFAULT FALSE,
    special_requirements TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, facility_code)
);

-- 3. Políticas de Decisión Personalizadas por Organización
CREATE TABLE commercial_scoring_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'ACME Balanced Policy',
    cost_weight NUMERIC(4, 3) DEFAULT 0.250,
    sla_weight NUMERIC(4, 3) DEFAULT 0.250,
    time_weight NUMERIC(4, 3) DEFAULT 0.200,
    availability_weight NUMERIC(4, 3) DEFAULT 0.100,
    route_experience_weight NUMERIC(4, 3) DEFAULT 0.100,
    org_history_weight NUMERIC(4, 3) DEFAULT 0.100,
    max_auto_approval_budget_cents BIGINT DEFAULT 500000, -- $5,000 USD
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Extensión de freight_requests (Aditiva)
ALTER TABLE freight_requests 
    ADD COLUMN IF NOT EXISTS origin_facility_id UUID REFERENCES facilities(id),
    ADD COLUMN IF NOT EXISTS destination_facility_id UUID REFERENCES facilities(id),
    ADD COLUMN IF NOT EXISTS transport_mode_preferred transport_mode_enum DEFAULT 'ROAD',
    ADD COLUMN IF NOT EXISTS cargo_category cargo_category_enum DEFAULT 'PALLETS',
    ADD COLUMN IF NOT EXISTS required_approver_role user_role_enum DEFAULT 'REQUESTER',
    ADD COLUMN IF NOT EXISTS approved_by_user_id UUID REFERENCES auth.users(id);
```

---

## 📅 13. Plan de Implementación Progresiva (Fases de Desarrollo)

| Ciclo | Enfoque | Entregables Principales |
|---|---|---|
| **Sprint 1 (Actual)** | **Cimientos V2 & Creación Dual** | Idempotencia SHA-256 (`HAC-6`), Hono V2, Alexa Skill base (`HAC-5`), componentes UI y setup de evidencias. |
| **Sprint 2** | **Orquestación & Ruteo Google Maps** | Motor de Ruteo con Google Maps API (`resolve_freight_route`), normalización MCDA/TOPSIS y despacho multimodal (Andes, Pacific, Inca). |
| **Sprint 3** | **Gobernanza RBAC & Aprobación de Voz** | Roles Owner/Supervisor, compuerta humana `authorize_and_book` con límites de crédito y auto-recovery. |
| **Sprint 4** | **Token Optimizer & Amazon Bedrock** | Payloads SSML compactos (`get_voice_briefing`), síntesis natural con Claude 3 Haiku, paquete open source `cargomesh-mcp`. |
| **Sprint 5** | **Grabación Video Demo & Devpost** | Video oficial exhibiendo el flujo multimodal Callao ➔ Santiago por voz y web con jurados de Amazon. |
