# CargoMesh — Plan Maestro FINAL para WebMCP Challenge 2026

> **Versión:** FINAL v5.5.0 — B2B Organization + Cargo Profile Alignment
> **Estado:** lógica de producto y contrato técnico congelados para implementación y validación E2E  
> **MVP:** B2B · ROAD · FTL · Domestic + Cross-Border · Golden Flow Callao/Lima, Perú → Santiago, Chile  
> **Moneda operativa del MVP:** USD, mostrada al usuario como `$`  
> **North Star:** una empresa autenticada crea una `FreightRequest`; el agente navega páginas de carriers mediante WebMCP, obtiene resultados estructurados reales desde fixtures deterministas de cada provider, CargoMesh persiste y evalúa esos resultados, el cliente selecciona una alternativa, el carrier confirma o rechaza el booking y el sistema mantiene continuidad mediante tracking o recovery.

> **Regla de causalidad:** los datos base pueden ser deterministas, pero `CarrierOffer`, `FreightDecision`, selección, `Booking` y `BookingEvent` deben nacer por la ejecución real del flujo. El seed prepara el escenario; no ejecuta la demo.

> **Regla de cierre:** desde esta versión no se agregan nuevas funcionalidades de negocio antes de completar el vertical slice E2E. Los cambios posteriores solo corrigen bloqueadores técnicos o inconsistencias verificadas.


---

# 0. Baseline ejecutivo

CargoMesh es una plataforma B2B de **orquestación agent-native de transporte de carga**. La lógica comercial está congelada; esta baseline define cómo demostrarla sin preconstruir los resultados que WebMCP debe producir.

## 0.1 Lifecycle principal

```text
Authenticated Organization
        ↓
Confirmed FreightRequest
        ↓
Start Orchestration Run
        ↓
Agent navigates provider pages
        ↓
WebMCP provider tools
        ↓
Structured provider result
        ↓
CargoMesh validates + records result
        ↓
CarrierOffers persisted
        ↓
Deterministic Decision Engine
        ↓
OPTIONS_READY
        ↓
Human Selection / authorized Smart Auto
        ↓
Booking Request
        ↓
PENDING_PROVIDER_CONFIRMATION
   ┌──────────┼───────────┐
   ▼          ▼           ▼
CONFIRMED   REJECTED    EXPIRED
   │          └────┬──────┘
   ▼               ▼
Tracking        Recovery Run
   │               │
   ▼               ▼
DELIVERED     Fresh provider checks
```

## 0.2 Cuatro clases de datos

CargoMesh separa explícitamente:

```text
BOOTSTRAP DATA
= organización, miembros, perfiles de carga, catálogos, carriers, services, metrics

DEMO SCENARIO
= estado inicial controlado de FR-1042

PROVIDER FIXTURES
= respuestas deterministas propias de Andes / Inca / Pacific

RUNTIME DATA
= offers, decisions, selection, bookings, events, orchestration trace
```

Regla:

```text
Provider fixture may know that Andes quotes $1,760.
CargoMesh database must not contain that CarrierOffer
until quote_freight actually returns it and CargoMesh records it.
```

## 0.3 Transparencia de la demo

Declaración canónica:

> **Carrier data and responses are deterministic demo fixtures. WebMCP execution, result transfer, ranking, human selection, persistence, booking lifecycle and recovery are real.**

Esto permite una demo reproducible sin presentar datos simulados como integración con carriers reales.

## 0.4 Recommendation ≠ Selection ≠ Booking ≠ Confirmation

```text
recommended_offer_id
≠
selected_offer_id
≠
booking request
≠
provider confirmation
```

`recommended_offer_id` proviene del Decision Engine.

`selected_offer_id` proviene del cliente o de una política autorizada.

`book_freight` envía la solicitud al provider.

Solo `get_provider_booking_status → CONFIRMED` confirma el transporte.

## 0.5 Result Bridge

WebMCP devuelve datos al agente. CargoMesh necesita una operación explícita para incorporarlos a su estado:

```text
provider quote_freight
        ↓
agent receives structured output
        ↓
CargoMesh record_provider_result
        ↓
validate provider + request + schema
        ↓
CarrierOffer INSERT
        ↓
orchestration_event INSERT
```

No existe una actualización “mágica” desde la página provider hacia CargoMesh.

## 0.6 Observabilidad

Cada ejecución pertenece a un:

```text
orchestration_run
```

y cada interacción relevante registra un:

```text
orchestration_event
```

El Judge/Tool Inspector lee estos eventos reales. No reconstruye una animación ficticia.

## 0.7 Scoring

`BALANCED` conserva:

```text
25% Cost
25% Reliability
20% ETA
10% Availability
10% Route Experience
10% Organization History
```

v5.4 congela también las funciones de normalización, por lo que los resultados son reproducibles a partir de datos de entrada.

## 0.8 Golden Flow

```text
Organization:
ACME Mining

FreightRequest:
FR-1042

Route:
Callao, Lima, Peru
→ Santiago, Chile

ROAD · FTL
10 pallets × 800 kg
= 8,000 kg

Budget:
$2,000

Strategy:
BALANCED
```

Golden provider fixtures:

```text
Andes Freight
$1,760 · 31h · reliability 96
availability score 90
route operations 100

Inca Logistics
$1,920 · 29h · reliability 98
availability score 90
route operations 50

Pacific Cargo
$1,590 · 60h · reliability 86
availability score 60
route operations 50
```

No existe historial previo ACME ↔ carrier en el Golden Flow:

```text
organization_history_score = 50
```

para todos los candidatos.

Scores calculados:

```text
Andes   ≈ 89.29 → 89
Inca    ≈ 84.20 → 84
Pacific ≈ 72.17 → 72
```

## 0.9 Seed inicial

Antes de orquestar:

```text
carrier_offers      = empty for FR-1042
freight_decisions   = empty for FR-1042
bookings            = empty for FR-1042
booking_events      = empty for FR-1042
orchestration_runs  = empty for FR-1042
orchestration_events= empty for FR-1042
```

Esas entidades nacen durante el flujo.

## 0.10 Seguridad

```text
Supabase Auth
→ organization_members
→ organization-scoped RLS
```

La demo puede comenzar con una sesión ya iniciada, pero la cuenta y membership son reales.

## 0.11 Navigation contract

Para la demo se utiliza **full document navigation** entre páginas provider.

Esto garantiza que cada página registra únicamente sus propias tools WebMCP y evita depender de la persistencia del mismo `document` durante navegación SPA.

## 0.12 North Star

> **One real WebMCP trace from freight intent to persisted provider results, explainable selection, provider acknowledgement and recoverable execution.**

# 1. Aclaración técnica crítica: WebMCP no es el motor de decisión

WebMCP y el agente cumplen funciones diferentes.

## WebMCP

WebMCP permite que una aplicación web exponga capacidades estructuradas como herramientas:

```javascript
document.modelContext.registerTool({
  name: "quote_freight",
  description: "Quote a freight request for this logistics provider",
  inputSchema: { /* ... */ },
  execute: async (input) => { /* ... */ }
});
```

WebMCP responde a la pregunta:

> **¿Qué puede hacer esta aplicación web y cómo puede un agente utilizarla de forma estructurada?**

## Agente

El agente se encarga de:

- comprender la intención del cliente;
- pedir aclaraciones cuando falten datos;
- decidir qué tools utilizar;
- combinar información de múltiples proveedores;
- interpretar resultados;
- aplicar políticas y contexto;
- explicar la decisión;
- ejecutar acciones cuando las reglas lo permiten.

## Motor heurístico

Para que la decisión no sea una “caja negra”, CargoMesh tendrá un **motor heurístico determinista y explicable**.

El agente recopila la información mediante WebMCP y el motor heurístico ayuda a rankear alternativas.

```text
WebMCP = acceso estructurado a capacidades
Agent  = razonamiento y orquestación
Heuristic Engine = evaluación transparente de candidatos
```

Esta separación fortalece la arquitectura y permite demostrar código no trivial.

---

# 2. Resumen ejecutivo y contrato de producto

**CargoMesh** es una plataforma B2B de **orquestación agent-native de transporte de carga**.

La empresa posee una necesidad logística; CargoMesh estructura esa intención, consulta capacidades externas, normaliza ofertas y coordina el lifecycle comercial del transporte.

## 2.1 Organization Account

La organización conserva:

```text
legal_name
country_code
business_identifier_type
business_identifier_value
verified_corporate_email
corporate_phone
```

El identificador empresarial se resuelve por país.

## 2.2 Autenticación y autorización

```text
Supabase Auth
→ auth.uid()
→ organization_members
→ organization_id
→ role / status
```

Un correo escrito manualmente en un formulario no concede autorización.

Un miembro autorizado debe:

```text
have verified identity
belong to organization
status = ACTIVE
```

Roles mínimos:

```text
OWNER
REQUESTER
SUPERVISOR
```

## 2.3 Corporate email

El `verified_corporate_email` de la organización:

- se verifica durante onboarding;
- se muestra como protegido;
- requiere re-verificación para cambiar;
- recibe confirmaciones y alertas corporativas.

No sustituye la autenticación individual de miembros.

### 2.3.1 Organización B2B, miembros e invitaciones

La organización es el cliente contractual y el tenant de datos. No es una identidad que inicia sesión. Las identidades humanas son sus miembros:

```text
Organization / tenant
└── OWNER
    ├── REQUESTER
    └── SUPERVISOR
```

Flujo mínimo de onboarding:

```text
persona registra empresa
→ organization INSERT
→ Supabase Auth identity
→ organization_members OWNER + ACTIVE
→ OWNER invita por correo
→ Supabase Auth invite
→ organization_members INVITED
→ aceptación
→ organization_members ACTIVE
```

La invitación se ejecuta únicamente desde servidor. Para la hackathon no se requiere una entidad adicional de invitaciones: Supabase Auth mantiene la identidad invitada y `organization_members.status` mantiene el estado empresarial.

## 2.4 FreightRequest Intake

La solicitud contiene:

### Organization context

```text
organization
requester
verified corporate email
```

### Pickup

```text
origin_country
origin_city
origin_address
pickup_contact_name
pickup_contact_phone
```

### Delivery

```text
destination_country
destination_city
destination_address
receiver_name
receiver_company
receiver_phone
```

### Cargo

```text
cargo_profile_id optional
cargo_category
cargo_description

cargo_entry_method =
TOTAL_WEIGHT | UNITS | PACKAGES | PALLETS | LOTS | SACKS

entry_quantity
entry_unit_weight_kg
units_per_entry
entry_length_cm
entry_width_cm
entry_height_cm
cargo_specifications
```

La entrada se normaliza a:

```text
cargo_weight_kg
cargo_volume_m3
package_count
```

Reglas de normalización:

```text
normalized weight
= entry_quantity × entry_unit_weight_kg × units_per_entry

normalized volume m³
= entry_quantity × units_per_entry
  × length_cm × width_cm × height_cm / 1,000,000
```

Los campos normalizados alimentan las hard constraints de los carriers. `cargo_specifications` conserva requisitos variables de categoría sin convertir el MVP en un modelo EAV complejo.

Separación semántica:

```text
cargo category   = qué se transporta
entry method     = cómo se cuenta o agrupa
requirements     = cómo debe manipularse
```

`cargo_categories` aporta orientación dinámica de intake: métodos recomendados, campos sugeridos, requisitos a consultar y clases de vehículo candidatas. Estas últimas son recomendaciones internas sujetas a validación WebMCP.

### Organization Cargo Profile

Durante onboarding la empresa puede registrar uno o más tipos habituales de carga. Esto es un **perfil logístico**, no una skill WebMCP:

```text
cargo category
default entry method
typical quantity / weight / dimensions
default requirements
preferred vehicle classes
priority
```

Al crear una solicitud, CargoMesh puede sugerir una plantilla y una clase de flota. El miembro siempre puede revisar los valores antes de confirmar.

### Schedule

```text
pickup_mode =
ASAP | SCHEDULED
```

`ASAP` busca el pickup factible más cercano.

`SCHEDULED` valida capacidad en una ventana futura.

### Policy

```text
budget_max
optimization_strategy
available_documents
special requirements
soft preferences
```

## 2.5 Corporate request confirmation

```text
DRAFT
→ SUBMITTED
→ AWAITING_CONFIRMATION
→ PENDING
```

La confirmación corporativa autoriza que CargoMesh empiece la orquestación.

No selecciona un carrier ni autoriza por sí sola un pago.

## 2.6 Discovery y cotización

El agente obtiene páginas candidatas y visita cada carrier:

```text
check_service_coverage
check_capacity
quote_freight
```

Los resultados se normalizan como `CarrierOffer`.

## 2.7 Recommendation vs Selection

El Decision Engine produce una recomendación:

```text
recommended_offer_id
```

Luego existe una decisión comercial distinta:

```text
selected_offer_id
```

### Assisted

```text
agent ranks
→ UI shows cards
→ human selects
→ booking request
```

### Smart Auto

```text
agent ranks
→ policy checks authorization
→ recommended offer becomes selected offer
→ booking request
```

La demo puede priorizar `ASSISTED` para hacer visible la colaboración humano-agente.

## 2.8 Booking Request

Al seleccionar una opción:

```text
selected CarrierOffer
→ book_freight
→ provider-side booking request
```

Respuesta inicial válida:

```text
PENDING_PROVIDER_CONFIRMATION
```

La tool conserva:

```text
idempotency_key
authorization_context
selection_mode
selected_by_member_id
provider_response_deadline
```

## 2.9 Provider acknowledgement

El carrier puede responder:

```text
CONFIRMED
REJECTED
EXPIRED
```

### CONFIRMED

```text
FreightRequest → BOOKED
Booking → CONFIRMED
Tracking begins
```

### REJECTED

```text
Booking → REJECTED
FreightRequest → RECOVERY_REQUIRED
notify organization
start recovery
```

### EXPIRED / NO RESPONSE

Cuando se alcanza `provider_response_deadline`:

```text
Booking → EXPIRED
FreightRequest → RECOVERY_REQUIRED
notify organization
start recovery
```

## 2.10 Recovery Contract

El agente no reutiliza ciegamente el segundo lugar anterior.

Debe:

```text
1. exclude rejected / expired attempt
2. check remaining provider coverage
3. check capacity again
4. verify quote validity
5. refresh quote when expired/stale
6. apply hard constraints again
7. rerun ranking
8. evaluate policy again
9. propose or submit replacement
```

### Assisted recovery

```text
carrier failed
→ notify user
→ show best refreshed alternative
→ human confirms replacement
```

### Smart Auto recovery

Solo se permite si:

```text
allow_auto_recovery == true
AND replacement satisfies all hard constraints
AND confidence >= threshold
AND anomaly == false
AND budget policy passes
```

Si no:

```text
→ human review
```

## 2.11 Notifications

CargoMesh —no WebMCP— envía notificaciones.

Eventos mínimos:

```text
REQUEST_CONFIRMED
BOOKING_SUBMITTED
PROVIDER_CONFIRMED
PROVIDER_REJECTED
PROVIDER_EXPIRED
RECOVERY_OPTION_READY
BOOKING_CANCELLED
SECURITY_REVIEW
DELIVERED
```

Canal P0:

```text
verified corporate email
```

## 2.12 Cancellation and Booking Change Contract

La cancelación depende del estado.

### Before booking request

```text
FreightRequest PENDING / EVALUATING
→ CargoMesh cancels internally
→ no provider tool required
```

### After booking request

CargoMesh consulta al carrier:

```text
get_booking_change_options(
  booking_id,
  reason_code
)
```

Puede devolver:

```text
CANCEL_NOW
RESCHEDULE
HOLD
CHANGE_PICKUP_WINDOW
```

con:

```text
fee
new_price
new_eta
conditions
option_id
```

El agente puede recomendar la opción más favorable, pero no inventa condiciones.

La ejecución usa:

```text
apply_booking_change(
  booking_id,
  option_id,
  idempotency_key
)
```

## 2.13 Cancellation reasons

Catálogo mínimo:

```text
CUSTOMER_CHANGED_MIND
RECEIVER_UNAVAILABLE
WRONG_CARGO_DATA
DUPLICATE_REQUEST
DELIVERY_DATE_CHANGED
PRICE_CONCERN
OTHER
```

`UNRECOGNIZED_REQUEST` no pertenece a este catálogo normal; activa seguridad.

## 2.14 Unrecognized Request / Security Review

Si un miembro o contacto corporativo indica:

```text
"I do not recognize this request"
```

CargoMesh:

```text
FreightRequest → SECURITY_REVIEW
freeze Smart Auto
freeze recovery automation
notify OWNER / SUPERVISOR
notify verified corporate email
preserve request / session context
```

Si existe un booking:

```text
query safe booking change/cancellation options
→ require authorized security action
```

WebMCP solo participa para interactuar con el carrier; la investigación de identidad y sesión pertenece a CargoMesh.

## 2.15 Billing and Payment Contract

La lógica de transporte no depende de almacenar credenciales de pago.

Modos:

```text
CORPORATE_ACCOUNT
INVOICE
EXTERNAL_CHECKOUT
TOKENIZED_PAYMENT_METHOD
```

### P0

```text
billing_mode = CORPORATE_ACCOUNT or INVOICE
```

### External checkout

Si el carrier exige pago:

```text
booking/payment metadata
→ payment_required = true
→ payment_url
```

El usuario completa el pago en una página segura del PSP/provider.

CargoMesh puede persistir:

```text
payment_mode
payment_status
payment_provider_reference
payment_url
```

Nunca persiste:

```text
raw card number
CVV
```

## 2.16 Pricing contract

FTL utiliza:

```text
carrier quote
= total price for dedicated transport operation
```

Analytics derivados:

```text
cost_per_kg
cost_per_ton
cost_per_handling_unit
cost_per_item
```

no reemplazan el precio total.

## 2.17 Functional Contract

```text
Verified Organization
      ↓
Authenticated Member
      ↓
Confirmed FreightRequest
      ↓
Carrier WebMCP Discovery
      ↓
Coverage / Capacity / Quotes
      ↓
Decision Engine
      ↓
Recommendation
      ↓
Human Selection / Smart Auto
      ↓
Booking Request
      ↓
Provider Acknowledgement
  ┌───────┼───────────┐
  ▼       ▼           ▼
CONFIRMED REJECTED  EXPIRED
  │       └────┬──────┘
  │            ▼
  │         Recovery
  │            │
  ▼            ▼
Tracking   New Attempt
  │
  ├── Booking Change / Cancellation
  ├── Security Exception
  └── Billing / External Payment when required
      ↓
DELIVERED / CANCELLED
```

# 3. Posicionamiento: “Rappi para carga” como experiencia, no como marketplace tradicional

La analogía con Rappi se utiliza únicamente para describir la **simplicidad de la experiencia**:

```text
Cliente
   ↓
"Necesito mover esta carga de A a B"
   ↓
Sistema resuelve quién, cómo y cuándo
```

CargoMesh **no busca copiar un marketplace de delivery**, Amazon, AliExpress o Alibaba.

## Diferencia con e-commerce

Un marketplace de comercio electrónico parte de:

```text
Product
  ↓
Purchase
  ↓
Order
  ↓
Fulfillment
  ↓
Delivery
```

CargoMesh parte de:

```text
Cargo already exists
       ↓
Freight Request
       ↓
Discover logistics capacity
       ↓
Evaluate carrier offers
       ↓
Book transportation
```

Por tanto:

```text
Amazon / Alibaba
Buyer ↔ Seller

CargoMesh
Shipper ↔ Logistics Capacity
```

La innovación tampoco es que el usuario pueda escoger un transportista. Esa funcionalidad existe en marketplaces y brokers tradicionales.

La propuesta central es:

> **El cliente no tiene que saber qué proveedor elegir. Expresa el resultado logístico que necesita y CargoMesh descubre, valida, evalúa y coordina automáticamente la capacidad apropiada mediante agentes y WebMCP.**

---

# 4. Actores del sistema

## 4.1 Organization / Cliente corporativo

Representa la empresa que contrata transporte.

Mantiene datos persistentes:

```text
legal name
country
business identifier
verified corporate email
corporate phone
business policies
```

La organización define:

- política de auto-book;
- presupuesto por defecto;
- strategy por defecto;
- transportistas preferidos o restringidos;
- prioridades por costo, rapidez o confiabilidad;
- límites de riesgo;
- canal corporativo de confirmación;
- perfiles habituales de carga;
- requisitos recurrentes por categoría;
- clases de vehículo preferidas como preferencias blandas.

## 4.2 Organization Member

Usuario autenticado asociado a una organización.

Puede:

- crear drafts;
- quedar como responsable de una FreightRequest;
- seleccionar otro miembro autorizado como responsable;
- revisar resultados;
- recibir contexto operacional según su organización;
- aceptar una invitación corporativa y operar con su rol.

Roles mínimos:

```text
OWNER
REQUESTER
SUPERVISOR
```

El MVP no requiere un sistema complejo de permisos; los roles solo delimitan las acciones principales.

## 4.3 Requester / Encargado

Es el miembro responsable de una FreightRequest específica.

```text
requested_by_member_id
```

Por defecto es el usuario autenticado que inicia el draft.

Puede cambiarse antes de la confirmación por otro miembro activo de la organización.

## 4.4 Pickup Contact

Persona disponible en el punto donde se entrega la carga al carrier.

```text
name
phone
location notes
```

No necesita una cuenta CargoMesh.

## 4.5 Receiver

Persona o entidad que recibe la carga en destino.

```text
receiver_name
receiver_company
receiver_phone
destination_address
```

No necesita una cuenta CargoMesh.

## 4.6 CargoMesh Agent

Responsable de:

- interpretar la solicitud;
- normalizar la carga;
- derivar `DOMESTIC` o `CROSS_BORDER`;
- obtener páginas candidatas;
- navegar aplicaciones proveedoras;
- consultar cobertura;
- validar capacidad;
- consultar disponibilidad ASAP o programada;
- solicitar ofertas;
- consultar históricos;
- evaluar candidatos;
- explicar decisiones;
- reservar automáticamente o escalar.

## 4.7 Carrier / Proveedor logístico

Empresa que ofrece capacidad de transporte y expone capacidades mediante una aplicación compatible con WebMCP.

El carrier responde sobre:

```text
service coverage
available capacity
earliest / scheduled pickup
vehicle or capacity class
ETA
total freight price
cross-border capability
booking
tracking
```

CargoMesh no necesita administrar conductores individuales.

La asignación concreta de un conductor permanece dentro de la operación del carrier.

## 4.8 Supervisor de excepciones

Interviene cuando:

- ninguna alternativa satisface restricciones obligatorias;
- la cotización activa el anomaly guard;
- la confianza queda bajo el umbral;
- una acción supera la política;
- falta confirmación corporativa;
- una disrupción requiere decisión humana.

Principio:

```text
Routine + confirmed + authorized + high confidence → Agent
Ambiguous / risky / unauthorized                  → Human
```

# 4.9 Dominio internacional y transport-mode extensible

CargoMesh se define como una plataforma de **freight orchestration**, no como un sistema exclusivo de camiones.

El dominio admite conceptualmente:

```text
ROAD
AIR
SEA
RAIL
```

## MVP de la hackathon

```text
ROAD ✅
FTL  ✅

AIR  → Future
SEA  → Future
RAIL → Future
LTL  → Future
```

### Golden Corridor

La ejecución demostrable se concentra en:

```text
Lima, Peru
    ↓
Santiago, Chile

ROAD · FTL · Cross-Border
```

No se pretende implementar una red continental durante la hackathon.

## Responsabilidades cross-border

### Cliente / Shipper

Proporciona la información comercial necesaria para que el proveedor pueda evaluar la operación, por ejemplo:

```text
cargo description
commercial invoice availability
packing list availability
special cargo requirements
```

### Carrier / proveedor autorizado

Declara mediante sus capacidades WebMCP si:

```text
cross_border_supported
customs_coordination_included
required_documents
border_handling_notes
```

El carrier o sus socios autorizados son responsables de la coordinación operacional/documental que realmente ofrezcan.

### CargoMesh

CargoMesh:

- consulta y compara esas capacidades;
- verifica si satisfacen la `FreightRequest`;
- conserva la respuesta como parte de la oferta;
- utiliza el **precio total cotizado por el carrier** para el scoring;
- muestra eventos de tracking reportados por el proveedor.

CargoMesh **no**:

- presenta declaraciones ante SUNAT o Aduanas de Chile;
- determina la liberación aduanera;
- calcula aranceles;
- sustituye a un agente de aduanas;
- certifica que una mercancía fue legalmente nacionalizada.

Por tanto:

```text
CUSTOMS_CLEARED
```

es un **evento reportado por el carrier**, no una decisión emitida por CargoMesh.

## Tratamiento comercial y tributario

CargoMesh no actúa como motor tributario internacional.

La oferta conserva:

```text
price
currency
price_breakdown
customs_coordination_included
required_documents
customs_notes
```

y el motor compara el precio total informado por el proveedor.

Si el carrier entrega información tributaria adicional, esta se trata como:

```text
carrier_reported
```

y no como una determinación fiscal independiente de CargoMesh.

## Futuro multimodal

La misma abstracción puede evolucionar hacia:

```text
Warehouse
   │ ROAD
   ▼
Port / Airport / Rail Terminal
   │ SEA / AIR / RAIL
   ▼
International Hub
   │ ROAD
   ▼
Destination
```

Pero `transport_plans`, `transport_legs`, consolidación y optimización multimodal permanecen fuera del MVP.

# 5. Dos formas de interacción agente ↔ cliente

Una pieza central del nuevo diseño será que el agente pueda enriquecer la solicitud de dos maneras.

---

## 5.1 Modo A — Preferencias explícitas del cliente

El cliente puede expresar restricciones o prioridades directamente.

### Ejemplos

```text
"Necesito que llegue antes de las 18:00."
```

```text
"No quiero esperar más de 2 horas para el recojo."
```

```text
"Prefiero Volvo si existe disponibilidad."
```

```text
"Prioriza confiabilidad sobre precio."
```

```text
"Mi presupuesto máximo es $900."
```

### UX sugerida

La aplicación puede ofrecer opciones fáciles de entender:

```text
Optimization policy

● Balanced
○ Lowest cost
○ Fastest delivery
○ Most reliable
○ Custom
```

Y preferencias avanzadas opcionales:

```text
Maximum pickup wait:  2 h
Delivery deadline:    Tomorrow 18:00
Preferred carrier:    No preference
Vehicle preference:   Volvo
Budget ceiling:       $900
```

### Preferencia flexible

Una preferencia no siempre debe actuar como restricción absoluta.

Ejemplo:

```text
Cliente prefiere Volvo
        ↓
No existe Volvo disponible
        ↓
Agente encuentra Scania con capacidad/SLA equivalentes
        ↓
"No encontré Volvo disponible. Existe una unidad Scania
con capacidad equivalente, 97% de confiabilidad del proveedor
y llegada dentro de tu plazo. ¿La consideramos?"
```

Esto permite distinguir:

```text
HARD REQUIREMENT
≠
SOFT PREFERENCE
```

---

## 5.2 Modo B — Contexto histórico del cliente

CargoMesh también puede utilizar información previa del propio cliente, siempre dentro de datos empresariales autorizados y visibles para explicar la decisión.

### Contexto posible

```text
client_profile

preferred_optimization_mode
usual_budget_range
preferred_carriers
avoided_carriers
frequent_routes
usual_cargo_type
historical_sla_preference
```

### Historial de operaciones

Ejemplo:

```text
Cliente ACME
Lima, Peru → Santiago, Chile

12 envíos anteriores
9 con Andes Freight
8 entregados sin retrasos
promedio pagado: $1,732
```

El agente podría utilizar esta información así:

> Andes Freight vuelve a ser una opción competitiva. Este cliente ya completó 9 operaciones con el proveedor y su cotización actual está 1.6% por encima del promedio histórico del mismo corredor.

### Regla importante

El agente debe diferenciar claramente entre:

- requisito informado por el cliente;
- preferencia aprendida del historial;
- inferencia;
- regla empresarial.

No se debe ocultar al usuario por qué se utilizó determinado contexto.

---

# 6. Modelo logístico de la carga

CargoMesh no trabaja únicamente con peso y ruta. Una `FreightRequest` debe describir las **características logísticas de la carga** necesarias para determinar qué proveedores son realmente compatibles.

## 6.1 Tipo de operación: FTL vs. LTL

Un vehículo puede transportar una sola carga o consolidar cargas de diferentes clientes.

```text
FTL — Full Truckload
Una FreightRequest reserva capacidad dedicada de transporte.

LTL — Less Than Truckload
Varias FreightRequests compatibles comparten capacidad.
```

### Decisión MVP

Para la hackathon:

```text
service_type = FTL
```

El Golden Flow utilizará:

```text
1 FreightRequest
→ 1 CarrierOffer
→ 1 Booking
```

Esto evita introducir durante el MVP problemas de consolidación, bin packing, compatibilidad entre múltiples cargas y optimización de rutas.

### Futuro

```text
LTL
multi-load consolidation
capacity sharing
empty-mile matching
```

serán extensiones posteriores.

---

## 6.2 Catálogo de categorías de carga

Se utiliza un catálogo controlado para evitar textos libres inconsistentes.

Catálogo inicial:

```text
GENERAL
FOOD
PHARMA
CHEMICAL
MACHINERY
CONSTRUCTION
AGRICULTURAL
LIQUID
```

El catálogo describe la **naturaleza general** de la carga, pero no sustituye sus requisitos logísticos.

Ejemplo:

```text
FOOD
├── arroz          → no refrigerado
└── pescado        → refrigerado / temperatura controlada
```

Por ello, la compatibilidad se determina utilizando:

```text
cargo category
+
physical dimensions
+
special requirements
```

---

## 6.3 Requisitos logísticos de una FreightRequest

Campos núcleo:

```text
cargo_weight_kg
cargo_volume_m3
package_count
cargo_category
```

Requisitos especiales:

```text
requires_refrigeration
temperature_min_c
temperature_max_c

is_hazardous
is_fragile
is_oversized
is_high_value
is_stackable

special_instructions
```

No todos son obligatorios para el MVP. Los valores por defecto deben representar una carga general estándar.

Ejemplo:

```text
FR-1042

Category:
GENERAL

Weight:
8,000 kg

Volume:
18 m³

Service:
FTL

Requirements:
refrigeration = false
hazardous = false
fragile = false
oversized = false
stackable = true
```

---

## 6.4 Compatibilidad del proveedor

Un proveedor no expone únicamente:

```text
"tengo capacidad"
```

Debe exponer qué clase de operación puede atender.

Ejemplo:

```text
Andes Freight

Mode:
ROAD

Supported cargo:
GENERAL
FOOD
MACHINERY

Capabilities:
Refrigerated     YES
Hazardous        NO
Fragile handling YES
Oversized        NO

Max capacity:
20,000 kg
```

Antes del scoring, CargoMesh debe validar:

```text
coverage
transport mode
cargo category
capacity
availability
special requirements
```

Solo las ofertas compatibles pasan al Decision Engine.

---

## 6.5 Tipos de proveedor

El dominio debe permitir que la oferta de transporte provenga tanto de empresas grandes como de operadores pequeños.

```text
OWNER_OPERATOR
SMALL_FLEET
CARRIER
ENTERPRISE_CARRIER
```

Esto permite una evolución futura donde CargoMesh conecte:

```text
Freight demand
      ↕
CargoMesh
      ↕
Logistics capacity

Owner-operators
Small fleets
Regional carriers
Enterprise carriers
```

Para el MVP, los tres proveedores simulados se comportan como carriers gestionados dentro de una sola codebase.

---

## 6.6 Principio de matching logístico

La pregunta ya no es:

> "¿Qué camión tiene suficiente peso disponible?"

La pregunta es:

> **"¿Qué proveedor tiene una capacidad logística compatible con todas las condiciones relevantes de esta FreightRequest?"**

Pipeline:

```text
FreightRequest
     ↓
Route coverage?
     ↓
Mode supported?
     ↓
Cargo category supported?
     ↓
Requirements supported?
     ↓
Capacity available?
     ↓
Schedule compatible?
     ↓
ELIGIBLE OFFER
     ↓
Heuristic scoring
```

Esto evita reducir CargoMesh a un simple filtro de vehículos.

---

# 7. Proceso de enriquecimiento de una solicitud

Una solicitud puede entrar incompleta.

Ejemplo:

```text
"Necesito llevar 8 toneladas de Lima a Santiago dentro del plazo requerido."
```

El agente transforma esto en un objeto operacional:

```text
FreightRequest

origin: Lima
destination: Santiago
cargo_weight_kg: 8000
cargo_volume_m3: undefined
cargo_category: GENERAL
service_type: FTL
requires_refrigeration: false
is_hazardous: false
is_fragile: false
is_oversized: false
pickup_date: tomorrow
delivery_deadline: undefined
optimization_mode: inferred/default balanced
budget_max: undefined
vehicle_preference: none
```

## Reglas de aclaración

El agente solo debe preguntar cuando el dato faltante cambie materialmente la decisión.

### Preguntar

```text
"¿Tienes una hora límite de entrega?"
```

si existen opciones que llegan en horarios muy diferentes.

### No preguntar innecesariamente

Si todos los candidatos cumplen ampliamente el plazo, puede continuar con una política por defecto.

La UX debe evitar convertir al agente en un formulario conversacional interminable.

---

# 8. Validación en dos etapas

La evaluación se divide estrictamente en:

```text
1. HARD CONSTRAINTS
2. SOFT SCORING
```

Una condición obligatoria nunca se compensa mediante un score alto.

## 8.1 Hard constraints — Elegibilidad

Un carrier queda eliminado si incumple una condición obligatoria.

```text
freight_request.confirmation_status == CONFIRMED
carrier.status == ACTIVE

coverage(origin, destination) == true
transport_mode_supported == true
service_type_supported == true
cargo_category_supported == true

available_capacity_kg >= cargo_weight_kg
pickup_requirement_feasible == true
delivery_deadline_feasible == true

refrigeration_requirement_satisfied == true
hazardous_requirement_satisfied == true
fragile_handling_requirement_satisfied == true
oversized_requirement_satisfied == true

budget_hard_limit_satisfied == true
```

Para `CROSS_BORDER`:

```text
requested country pair covered
customs coordination requirement satisfied
required documents available or explicitly resolved before booking
```

Solo candidatos `ELIGIBLE` pasan al scoring.

## 8.2 Soft scoring — dimensiones canónicas

```text
cost_score
reliability_score
eta_score
availability_score
route_experience_score
organization_history_score
```

Cada dimensión utiliza escala `0–100`.

Las preferencias blandas permanecen fuera del score base P0.

## 8.3 Normalizaciones P0

### Cost

```text
cost_score =
lowest_eligible_price / candidate_price × 100
```

El candidato más barato obtiene `100`.

### Reliability

```text
reliability_score =
success_rate
```

`success_rate` se calcula de manera coherente desde históricos o se consulta como métrica derivada; no puede contradecir los conteos utilizados como fuente.

### ETA

```text
eta_score =
best_eligible_transit_hours / candidate_transit_hours × 100
```

El menor tiempo obtiene `100`.

### Availability

La respuesta provider normaliza la certeza operacional:

```text
EXACT_CONFIRMED_SLOT     = 100
AVAILABLE_IN_WINDOW      = 90
LIMITED_WINDOW           = 60
WAITLIST                 = 30
UNAVAILABLE              = INELIGIBLE
```

Para el Golden Flow:

```text
Andes   = AVAILABLE_IN_WINDOW = 90
Inca    = AVAILABLE_IN_WINDOW = 90
Pacific = LIMITED_WINDOW      = 60
```

### Route Experience

Para P0:

```text
route_experience_score =
min(100, completed_route_operations)
```

La baseline utiliza un punto por operación completada y satura en 100. Es deliberadamente simple y reproducible para la hackathon.

### Organization History

CargoMesh consulta una métrica específica `organization_id + carrier + corridor` cuando existe.

```text
if organization-specific history exists:
    organization_history_score = organization_success_rate

if no organization-specific history exists:
    organization_history_score = 50
```

`50` es un valor neutral; no recompensa ni penaliza a un carrier nuevo para esa organización.

## 8.4 Fórmula base

```text
BASE_SCORE =
    0.25 × cost_score
  + 0.25 × reliability_score
  + 0.20 × eta_score
  + 0.10 × availability_score
  + 0.10 × route_experience_score
  + 0.10 × organization_history_score
```

```text
FINAL_SCORE =
round(BASE_SCORE, 0)
```

Los cálculos completos permanecen en `candidate_snapshot`.

## 8.5 Preference Fit — P1

```text
preference_adjustment ∈ [-2, +2]
FINAL_SCORE = clamp(BASE_SCORE + preference_adjustment, 0, 100)
```

Nunca puede volver elegible una alternativa que falló una hard constraint.

# 9. Políticas heurísticas

## 9.1 Balanced — fórmula canónica P0

```text
Cost                           25%
Reliability                    25%
ETA / Transit                  20%
Availability                   10%
Route Experience               10%
Organization / Client History  10%
──────────────────────────────────
                              100%
```

Las seis dimensiones usan exclusivamente las normalizaciones definidas en la Sección 8.

## 9.2 Lowest Cost — P1

```text
Cost                           50%
Reliability                    15%
ETA / Transit                  10%
Availability                   10%
Route Experience                5%
Organization / Client History  10%
```

## 9.3 Most Reliable — P1

```text
Reliability                    45%
Route Experience               15%
Organization / Client History  15%
ETA / Transit                  10%
Availability                    5%
Cost                           10%
```

## 9.4 Fastest — P1

```text
ETA / Transit                  50%
Availability                   20%
Reliability                    15%
Route Experience                5%
Cost                            5%
Organization / Client History   5%
```

## 9.5 Custom — P1

Un hard limit sigue siendo hard constraint.

Ejemplo:

```text
price <= $1,800
```

Una preferencia como `Volvo` puede relajarse; el presupuesto no.

# 10. Comparación contra históricos y anomaly guard

CargoMesh compara ofertas actuales con contexto histórico para detectar cotizaciones económicamente atípicas.

Fórmula P0:

```text
price_deviation_pct =
(current_price - historical_avg)
──────────────────────────────── × 100
historical_avg
```

## Ejemplo de anomalía

```text
Corridor:
Lima, Peru → Santiago, Chile

Historical average:
$1,700

Current quote:
$2,250
```

```text
price_deviation_pct
= (2250 - 1700) / 1700 * 100
≈ +32.35%
```

Regla P0:

```text
price_deviation_pct > +30%
→ anomaly = true
→ requires_review = true
→ auto_book = false
```

El anomaly guard **bloquea la acción vinculante**; no intenta arreglar la anomalía reduciendo algunos puntos del score.

## Históricos utilizados

```text
success_rate
avg_delay_hours
cancellation_rate
completed_freight_requests
route_completed_freight_requests
average_route_cost
cargo_category performance
```

## Histórico coherente del Golden Flow

Para Andes Freight:

```text
Current quote:
$1,760

Historical corridor average:
~$1,732
```

La oferta actual está aproximadamente:

```text
+1.6%
```

por encima del histórico y no activa el guard.

# 11. Decision Confidence y niveles de autonomía

`confidence_score` es un **Decision Confidence Score**, no una probabilidad estadística.

La finalidad de esta métrica es responder:

> **¿Qué tan sólida es la evidencia disponible para permitir que CargoMesh actúe con autonomía sobre la decisión ganadora?**

## 11.1 Fórmula P0

```text
Decision Confidence =
25% Data Completeness
20% Constraint Certainty
20% Historical Evidence
15% Candidate Separation
20% Anomaly Safety
─────────────────────────
100%
```

Todos los componentes usan escala `0–100`.

## 11.2 Data Completeness

Mide si CargoMesh posee todos los datos obligatorios necesarios para evaluar y ejecutar la decisión.

```text
data_completeness =
present_required_fields
────────────────────── × 100
total_required_fields
```

Los campos requeridos se determinan por el tipo de `FreightRequest` y el scope de operación.

Para el Golden Flow incluyen, como mínimo:

```text
request identity
organization context
origin / destination
cargo category
normalized cargo weight
transport mode
service type
pickup requirement
delivery deadline
budget
available documents
provider coverage result
provider capacity result
provider quote
provider validity
```

Golden Flow:

```text
all required fields present
→ Data Completeness = 100
```

Si falta un dato obligatorio:

```text
Data Completeness < 100
```

y CargoMesh puede continuar en `ASSISTED` cuando sea seguro, pero Smart Auto se bloquea si el dato faltante afecta una hard constraint o autorización.

## 11.3 Constraint Certainty

Mide cuántas restricciones aplicables fueron verificadas explícitamente.

```text
constraint_certainty =
verified_applicable_constraints
─────────────────────────────── × 100
applicable_constraints
```

Estados por constraint:

```text
PASS
FAIL
UNKNOWN
NOT_APPLICABLE
```

Reglas:

```text
FAIL
→ candidate INELIGIBLE

UNKNOWN on a hard constraint
→ Smart Auto blocked

NOT_APPLICABLE
→ excluded from denominator
```

Golden Flow Andes:

```text
all applicable hard constraints verified PASS
→ Constraint Certainty = 100
```

## 11.4 Historical Evidence

Mide cuánta evidencia operacional respalda la confiabilidad observada.

```text
historical_evidence =
min(100, completed_route_operations)
×
success_rate / 100
```

Ejemplo Andes:

```text
completed_route_operations = 100
success_rate = 96

min(100,100) × 0.96
= 96
```

Por tanto:

```text
Historical Evidence = 96
```

Esto evita confundir:

```text
Reliability
```

con:

```text
Evidence Strength
```

Ejemplo:

```text
10 operaciones
100% exitosas

Reliability = 100
Historical Evidence = 10
```

## 11.5 Candidate Separation

Mide cuánto se separa la mejor alternativa de la segunda.

```text
candidate_separation =
min(
  100,
  max(
    0,
    (top_raw_score - second_raw_score) / 20 × 100
  )
)
```

Se usan scores sin redondear.

Ejemplos:

```text
gap 20 → 100
gap 10 → 50
gap  5 → 25
gap  0 → 0
```

## 11.6 Anomaly Safety

Mide si existe evidencia suficiente para afirmar que el precio no activa el anomaly guard.

```text
historical comparison available
AND anomaly == false
→ 100

anomaly == true
→ 0

anomaly cannot be evaluated
→ 0 for Smart Auto eligibility
```

Un valor `0` por falta de histórico no declara que la oferta sea fraudulenta; declara que CargoMesh **no tiene evidencia suficiente para auto-actuar**.

La oferta puede seguir mostrándose en `ASSISTED`.

## 11.7 Golden Flow reproducible

Subscores BALANCED:

```text
                 Andes      Inca      Pacific
Cost             90.3409    82.8125   100.0000
Reliability      96.0000    98.0000    86.0000
ETA              93.5484   100.0000    48.3333
Availability     90.0000    90.0000    60.0000
Route Exp.      100.0000    50.0000    50.0000
Org History      50.0000    50.0000    50.0000
```

Raw BALANCED:

```text
Andes   = 89.2949
Inca    = 84.2031
Pacific = 72.1667
```

Display scores:

```text
Andes   = 89
Inca    = 84
Pacific = 72
```

El fixture canónico de Pacific conserva:

```text
transit_hours = 60
```

No existe ajuste artificial del fixture para forzar el score.

## 11.8 Golden Flow — Decision Confidence

```text
top raw score       = 89.2949
second raw score    = 84.2031

gap
= 5.0918
```

```text
Candidate Separation
= 5.0918 / 20 × 100
≈ 25.4589
```

Componentes Andes:

```text
Data Completeness      = 100
Constraint Certainty   = 100
Historical Evidence    = 96
Candidate Separation   = 25.4589
Anomaly Safety         = 100
```

```text
Decision Confidence
=
100 × 0.25
+100 × 0.20
+ 96 × 0.20
+25.4589 × 0.15
+100 × 0.20

≈ 88.0188
→ 88/100
```

## 11.9 Casos límite

### 0 candidatos elegibles

```text
no winning FreightDecision
→ NO_MATCH / REVIEW
→ no Smart Auto
```

### 1 candidato elegible

```text
candidate_separation = 0
→ Smart Auto blocked in P0
→ Assisted review
```

### Empate

```text
candidate_separation = 0
```

Desempate determinístico:

```text
1. reliability DESC
2. price ASC
3. transit_hours ASC
4. carrier_id ASC
```

El desempate decide un orden reproducible, pero no convierte automáticamente el caso en alta confianza.

## 11.10 Organization History neutral

Cuando no existe historial específico organización-carrier:

```text
organization_history_score = 50
```

Esto es neutral **para el orden relativo cuando todos carecen de historial**, pero reduce `5` puntos frente al máximo posible de esa dimensión.

No debe describirse como neutral para el score absoluto.

## 11.11 Auto-book

```text
confidence >= organization.confidence_threshold
AND anomaly == false
AND policy authorization == true
AND eligible_candidate_count >= 2
AND no hard constraint UNKNOWN
→ Smart Auto allowed
```

`ASSISTED` permanece como modo principal de demo.

# 12. Modelo de autonomía configurable

CargoMesh separa **recomendación** de **autorización comercial**.

## Assisted — modo principal de interacción

```text
Agent evaluates
→ recommends
→ shows cards
→ human selects
→ CargoMesh submits booking request
```

El usuario puede seleccionar una oferta distinta de la recomendada siempre que siga siendo elegible.

La decisión conserva:

```text
recommended_offer_id
selected_offer_id
selected_by_member_id
selection_mode = ASSISTED
```

## Smart Auto

```text
Agent evaluates
→ recommendation passes policy
→ recommended offer is selected
→ booking request submitted automatically
```

Condiciones:

```text
allow_auto_booking == true
confidence >= threshold
anomaly == false
budget policy passes
hard constraints pass
```

## Smart Auto Recovery

La recuperación automática requiere autorización independiente:

```text
allow_auto_recovery == true
```

y vuelve a evaluar completamente al carrier reemplazo.

## Enterprise Policy

Ejemplo:

```text
Auto-submit only if:

price <= budget
reliability >= policy floor
confidence >= 85
no anomaly
no security hold
```

La política nunca convierte un `REJECTED` o `EXPIRED` en `CONFIRMED`.

# 13. WebMCP — contrato de capacidades

WebMCP expone capacidades accionables de las páginas provider. CargoMesh mantiene persistencia, decisión, autorización, seguridad y observabilidad.

## 13.1 Response envelope común

Todas las tools provider utilizan un envelope común.

### Ejecución correcta

```json
{
  "ok": true,
  "data": {}
}
```

### Error técnico

```json
{
  "ok": false,
  "error": {
    "code": "PROVIDER_TIMEOUT",
    "message": "Provider did not answer",
    "retryable": true
  }
}
```

Un error técnico describe un fallo de ejecución.

No debe utilizarse para representar una respuesta comercial como:

```text
REJECTED
EXPIRED
UNAVAILABLE
```

Esos estados son respuestas válidas con:

```text
ok = true
```

## 13.2 `check_service_coverage`

```text
INPUT
origin
destination
transport_mode
service_type
cargo_category

OUTPUT data
supported
cross_border_supported
corridor
customs_coordination_available
service_notes
```

## 13.3 `check_capacity`

```text
INPUT
origin
destination
cargo_weight_kg
cargo_volume_m3
cargo_category
pickup_mode
pickup_window_start
pickup_window_end
delivery_deadline
special_requirements

OUTPUT data
available
availability_class
available_capacity_kg
available_volume_m3
earliest_pickup
requested_window_available
reported_vehicle_type
estimated_delivery
capability_notes
```

`availability_class`:

```text
EXACT_CONFIRMED_SLOT
AVAILABLE_IN_WINDOW
LIMITED_WINDOW
WAITLIST
UNAVAILABLE
```

## 13.4 `quote_freight`

```text
INPUT
freight_request_id
origin
destination
cargo_weight_kg
cargo_volume_m3
cargo_category
pickup_mode
pickup_window_start
pickup_window_end
delivery_deadline
available_documents

OUTPUT data
provider_offer_reference
price
currency
price_breakdown
estimated_pickup
estimated_delivery
transit_hours
available_capacity_kg
availability_class
cross_border_supported
customs_coordination_included
required_documents
border_handling_notes
valid_until
```

La respuesta proviene del fixture determinista del provider, no de `carrier_offers`.

## 13.5 `book_freight`

Envía una solicitud comercial al carrier.

```text
INPUT
freight_request_id
provider_offer_reference
idempotency_key
authorization_context
selection_mode
```

```text
OUTPUT data
provider_reference
provider_booking_status
provider_response_deadline
payment_required
payment_url
idempotent_replay
```

Estado inicial esperado:

```text
provider_booking_status =
PENDING_PROVIDER_CONFIRMATION
```

`provider_reference` pertenece al carrier:

```text
AND-BOOK-8821
```

No es el UUID interno de CargoMesh.

## 13.6 `get_provider_booking_status`

```text
INPUT
provider_reference
```

```text
OUTPUT data
provider_booking_status
provider_status_reason
current_location
updated_eta
provider_response_deadline
payment_status
events[]
```

Enum provider:

```text
PENDING_PROVIDER_CONFIRMATION
CONFIRMED
REJECTED
EXPIRED
IN_TRANSIT
DELIVERED
CANCELLED
```

Mapping mínimo:

```text
provider PENDING_PROVIDER_CONFIRMATION
→ internal PENDING_PROVIDER_CONFIRMATION

provider CONFIRMED
→ internal CONFIRMED

provider REJECTED
→ internal REJECTED

provider EXPIRED
→ internal EXPIRED

provider IN_TRANSIT
→ internal IN_TRANSIT

provider DELIVERED
→ internal COMPLETED

provider CANCELLED
→ internal CANCELLED
```

## 13.7 Regla de NO_RESPONSE

`NO_RESPONSE` no es un estado comercial del provider.

Antes de `provider_response_deadline`:

```text
provider_booking_status =
PENDING_PROVIDER_CONFIRMATION
```

Cuando se supera el deadline y no existe una respuesta terminal:

```text
CargoMesh derives internal EXPIRED
```

Autoridad P0:

```text
CargoMesh clock + stored provider_response_deadline
```

En Demo Mode, `Set Provider Fixture: NO_RESPONSE` significa:

```text
provider keeps returning PENDING_PROVIDER_CONFIRMATION
```

y el reloj controlado de demo puede avanzar hasta superar el deadline.

No existe:

```text
provider_booking_status = NO_RESPONSE
```

## 13.8 Tracking event identity

Cada evento provider debe incluir una identidad estable:

```text
provider_event_id
event_type
occurred_at
country_code
city
description
```

CargoMesh persiste:

```text
UNIQUE (booking_id, provider_event_id)
```

Por tanto, hacer polling repetido de `get_provider_booking_status` no duplica eventos históricos.

## 13.9 `get_booking_change_options` — P1

Consulta opciones reales del carrier.

## 13.10 `apply_booking_change` — P1

Ejecuta una opción autorizada de modificación/cancelación.

## 13.11 Capacidades internas de CargoMesh

### `get_candidate_provider_pages`

Devuelve identificación + URL.

Nunca devuelve quotes precalculados.

### `get_organization_context`

Obtiene policies, billing mode y thresholds.

### `get_freight_request`

Obtiene y normaliza la solicitud.

### `record_provider_result`

Puente idempotente entre una ejecución WebMCP y CargoMesh.

```text
INPUT
tool_call_id
orchestration_run_id
freight_request_id
carrier_id
provider_url
tool_name
tool_input
tool_output
started_at
completed_at
schema_version
```

Validaciones:

```text
run belongs to freight_request
carrier belongs to candidate set
provider_url matches carrier
tool_name allowed
tool_output matches expected schema_version
request correlation valid
```

Persistencia:

```text
orchestration_event
+
commercial runtime entity when applicable
```

Para:

```text
tool_name = quote_freight
```

crea:

```text
CarrierOffer
```

Respuesta:

```text
OUTPUT
event_id
record_id
record_type
status
deduplicated
```

Idempotencia:

```text
tool_call_id UNIQUE
```

y para quote:

```text
UNIQUE (
  orchestration_run_id,
  carrier_id,
  provider_offer_reference
)
```

Un retry del agente no puede crear dos `CarrierOffer` equivalentes.

### `get_carrier_metrics`

Consulta históricos globales y específicos de organización.

### `evaluate_offers`

Lee `CarrierOffer` persistidas durante el orchestration run.

Aplica:

```text
hard constraints
normalizations
BALANCED
Decision Confidence
price anomaly guard
organization policy
```

Produce una nueva `FreightDecision`.

### `record_selection`

Persiste selección humana:

```text
decision_id
selected_offer_id
selected_by_member_id
selection_mode = ASSISTED
```

### `flag_for_review`

Activa revisión humana.

### `start_recovery`

Crea un nuevo orchestration run:

```text
run_type = RECOVERY
```

## 13.12 Candidate snapshot

Cada `FreightDecision.candidate_snapshot` debe conservar como mínimo:

```text
scoring_version
weights

eligible candidates
ineligible candidates
eligibility reasons

raw component values
normalized subscores

raw_score
display_score

historical inputs
organization-history inputs

price anomaly inputs
anomaly result

tie-break inputs when applicable
```

Cost y ETA son relativos al conjunto de candidatos elegibles.

Por tanto, agregar o retirar un carrier puede cambiar los subscores de los demás; el snapshot conserva el contexto exacto utilizado.

## 13.13 Observabilidad

```text
orchestration_runs
orchestration_events
```

son la fuente del Judge / Agent Activity Inspector.

El inspector no inventa tool calls.

## 13.14 Lo que NO pertenece a WebMCP

```text
login
email verification
organization authorization
RLS
send email
heuristic calculation
database mutation without CargoMesh validation
raw payment credential storage
```

# 14. Arquitectura conceptual

```text
Organization Member
        │
        ▼
CargoMesh
Confirmed FreightRequest
        │
        │ create orchestration_run
        ▼
Browser / AI Agent
        │
        │ FULL DOCUMENT NAVIGATION
        ├───────────────┬───────────────┐
        ▼               ▼               ▼
/providers/andes  /providers/inca  /providers/pacific
        │               │               │
     WebMCP           WebMCP           WebMCP
        │               │               │
        └──── structured results ───────┘
                        │
                        ▼
                 Agent returns
                   to CargoMesh
                        │
                        ▼
              record_provider_result
                        │
          ┌─────────────┴──────────────┐
          ▼                            ▼
  carrier_offers                orchestration_events
          │
          ▼
     evaluate_offers
          │
          ▼
   freight_decisions
          │
          ▼
      OPTIONS_READY
          │
          ▼
      Human selects
          │
          ▼
     record_selection
          │
          ▼
 selected provider page
          │
          ▼
      book_freight
          │
          ▼
 provider_reference returned
          │
          ▼
   CargoMesh Booking UUID
          │
          ▼
 get_provider_booking_status(provider_reference)
       ┌──┴─────────────┐
       ▼                ▼
  CONFIRMED      REJECTED / EXPIRED
       │                │
       ▼                ▼
    Tracking      RECOVERY orchestration_run
```

Las páginas provider no escriben directamente las tablas comerciales de CargoMesh.

CargoMesh valida y persiste los resultados obtenidos por el agente.

# 15. Navegación multi-provider para la demo

Provider pages:

```text
/providers/andes
/providers/inca
/providers/pacific
```

## 15.1 Full document navigation

La demo fuerza navegación de documento completa al entrar/salir de provider pages.

Objetivo:

```text
new document
→ provider-specific modelContext
→ provider-specific tools only
```

Esto evita depender de una transición SPA donde tools de un provider anterior pudieran permanecer registradas.

## 15.2 Initial orchestration

```text
1. CargoMesh creates INITIAL orchestration_run
2. Agent obtains provider URLs

3. Full navigate Andes
4. coverage / capacity / quote
5. Full navigate back CargoMesh
6. record_provider_result

7. Full navigate Inca
8. coverage / capacity / quote
9. Full navigate back
10. record_provider_result

11. Full navigate Pacific
12. coverage / capacity / quote
13. Full navigate back
14. record_provider_result

15. evaluate_offers
16. persist INITIAL FreightDecision
17. FreightRequest → OPTIONS_READY
```

## 15.3 Human selection

`Start Orchestration` **se detiene en `OPTIONS_READY`**.

La persona debe hacer click sobre una card.

```text
recommended_offer_id = engine result
selected_offer_id = NULL
```

antes del click.

Después:

```text
record_selection
→ selected_offer_id
→ selected_by_member_id
```

Un control de Demo Mode no debe seleccionar Andes automáticamente.

## 15.4 Booking

```text
full navigate selected provider
→ book_freight
→ provider_reference
→ CargoMesh creates booking UUID
→ PENDING_PROVIDER_CONFIRMATION
```

## 15.5 Provider fixture controls

Judge Mode puede cambiar la respuesta futura del provider:

```text
Set Andes Fixture:
ACCEPT
REJECT
NO_RESPONSE

`NO_RESPONSE` mantiene al provider en
`PENDING_PROVIDER_CONFIRMATION`; CargoMesh deriva
`EXPIRED` al superar `provider_response_deadline`.
```

El control solo modifica el **fixture/provider state**.

No ejecuta:

```text
UPDATE bookings SET status = ...
```

Después debe ocurrir:

```text
real get_provider_booking_status(provider_reference)
→ WebMCP response
→ CargoMesh persistence
```

## 15.6 Recovery

```text
REJECTED / EXPIRED
→ create RECOVERY orchestration_run
→ revisit remaining providers
→ record fresh results
→ create RECOVERY FreightDecision
→ OPTIONS_READY
```

No se sobrescribe la decisión inicial.

## 15.7 Causality rule

La evidencia mínima es:

```text
provider page visited
→ WebMCP tool executed
→ orchestration_event persisted
→ CarrierOffer persisted
→ decision calculated
→ selection persisted
→ provider action executed
```

# 16. Modelo de datos — Executable Orchestration + Booking Lifecycle

La identidad técnica se gestiona mediante Supabase Auth.

Tablas de negocio:

```text
organizations
organization_members
organization_preferences
cargo_categories
organization_cargo_profiles
freight_requests
carriers
carrier_services
carrier_service_cargo_categories
vehicles
carrier_metrics
carrier_offers
freight_decisions
bookings
booking_events
```

Observabilidad técnica:

```text
orchestration_runs
orchestration_events
```

Total público:

```text
15 business-domain tables
+ 2 technical observability tables
+ auth.users managed by Supabase Auth
```

## 16.1 `organizations`

```text
id UUID PK
legal_name TEXT
display_name TEXT NULL

country_code CHAR(2)
business_identifier_type TEXT
business_identifier_value TEXT

verified_corporate_email TEXT
corporate_email_verified_at TIMESTAMPTZ
corporate_phone TEXT

status TEXT
default_currency TEXT DEFAULT 'USD'

created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

El identificador comercial depende del país.

## 16.2 `organization_members`

```text
id UUID PK
organization_id UUID FK → organizations
auth_user_id UUID NOT NULL FK → auth.users(id)

display_name TEXT
business_email TEXT NULL
phone TEXT NULL

role TEXT
status TEXT
created_at TIMESTAMPTZ

UNIQUE (organization_id, auth_user_id)
```

Demo:

```text
real Supabase Auth demo user
→ organization_members
→ ACME Mining
```

El video puede comenzar con la sesión ya iniciada.

## 16.3 `organization_preferences`

```text
id UUID PK
organization_id UUID FK

default_strategy TEXT
max_pickup_wait_hours NUMERIC

preferred_carrier_id UUID FK NULL
preferred_vehicle_brand TEXT NULL

budget_default NUMERIC NULL

allow_auto_booking BOOLEAN
allow_auto_recovery BOOLEAN DEFAULT FALSE
confidence_threshold NUMERIC

billing_mode TEXT DEFAULT 'CORPORATE_ACCOUNT'
require_request_email_confirmation BOOLEAN DEFAULT TRUE

created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

## 16.4 `cargo_categories`

```text
id UUID PK
code TEXT UNIQUE
name TEXT
description TEXT NULL
active BOOLEAN
recommended_entry_methods JSONB
intake_specification_schema JSONB
suggested_requirements JSONB
recommended_vehicle_classes JSONB
updated_at TIMESTAMPTZ
```

## 16.4.1 `organization_cargo_profiles`

Plantillas de carga habituales de una organización. Son contexto interno de CargoMesh y no tools WebMCP.

```text
id UUID PK
organization_id UUID FK → organizations
cargo_category_id UUID FK → cargo_categories
profile_name TEXT
default_entry_method TEXT

typical_entry_quantity NUMERIC NULL
typical_unit_weight_kg NUMERIC NULL
typical_units_per_entry INTEGER
typical_length_cm NUMERIC NULL
typical_width_cm NUMERIC NULL
typical_height_cm NUMERIC NULL

default_requirements JSONB
preferred_vehicle_classes JSONB
priority SMALLINT
active BOOLEAN
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ

UNIQUE (organization_id, profile_name)
```

Acceso:

```text
ACTIVE member      → SELECT
OWNER / SUPERVISOR → INSERT / UPDATE
anon               → no privileges
```

## 16.5 `freight_requests`

```text
id UUID PK
organization_id UUID FK
requested_by_member_id UUID FK → organization_members

cargo_category_id UUID FK
cargo_profile_id UUID NULL
code TEXT UNIQUE

status TEXT
confirmation_status TEXT
security_status TEXT DEFAULT 'CLEAR'
cancellation_reason_code TEXT NULL

origin_country TEXT
origin_city TEXT
origin_address TEXT
pickup_contact_name TEXT
pickup_contact_phone TEXT
pickup_notes TEXT NULL

destination_country TEXT
destination_city TEXT
destination_address TEXT
receiver_name TEXT
receiver_company TEXT NULL
receiver_phone TEXT
delivery_notes TEXT NULL

cargo_description TEXT

cargo_entry_method TEXT
entry_quantity NUMERIC NULL
entry_unit_weight_kg NUMERIC NULL
units_per_entry INTEGER NULL
entry_length_cm NUMERIC NULL
entry_width_cm NUMERIC NULL
entry_height_cm NUMERIC NULL
cargo_specifications JSONB NOT NULL DEFAULT '{}'::jsonb

cargo_weight_kg NUMERIC
cargo_volume_m3 NUMERIC NULL
package_count INTEGER NULL

service_type TEXT
transport_mode TEXT

pickup_mode TEXT
pickup_window_start TIMESTAMPTZ NULL
pickup_window_end TIMESTAMPTZ NULL
delivery_deadline TIMESTAMPTZ NULL

requires_refrigeration BOOLEAN
temperature_min_c NUMERIC NULL
temperature_max_c NUMERIC NULL
is_hazardous BOOLEAN
is_fragile BOOLEAN
is_oversized BOOLEAN
is_high_value BOOLEAN
is_stackable BOOLEAN

special_instructions TEXT NULL
available_documents JSONB NOT NULL DEFAULT '[]'::jsonb

budget_max NUMERIC NULL
optimization_strategy TEXT

submitted_at TIMESTAMPTZ NULL
confirmed_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

Checks mínimos:

```text
cargo_weight_kg > 0
cargo_volume_m3 IS NULL OR cargo_volume_m3 > 0
package_count IS NULL OR package_count > 0
budget_max IS NULL OR budget_max >= 0

pickup_mode IN ('ASAP','SCHEDULED')

pickup_mode = 'SCHEDULED'
→ pickup_window_start IS NOT NULL
→ pickup_window_end IS NOT NULL

pickup_window_end > pickup_window_start
delivery_deadline IS NULL OR delivery_deadline > pickup_window_start

unitized entries require quantity + unit weight + units per entry
normalized weight must match cargo_weight_kg
dimensions, when present, must match cargo_volume_m3
cargo profile must belong to the same organization as the request
```

Golden Flow documents:

```json
["commercial_invoice", "packing_list"]
```

## 16.6 `carriers`

```text
id UUID PK
name TEXT
code TEXT UNIQUE
provider_type TEXT
status TEXT
created_at TIMESTAMPTZ
```

## 16.7 `carrier_services`

```text
id UUID PK
carrier_id UUID FK

transport_mode TEXT
service_type TEXT

origin_country TEXT
origin_region TEXT NULL
destination_country TEXT
destination_region TEXT NULL

max_capacity_kg NUMERIC
max_volume_m3 NUMERIC NULL

supports_refrigerated BOOLEAN
temperature_min_c NUMERIC NULL
temperature_max_c NUMERIC NULL

supports_hazardous BOOLEAN
supports_fragile BOOLEAN
supports_oversized BOOLEAN

customs_coordination_available BOOLEAN
active BOOLEAN
```

## 16.8 `carrier_service_cargo_categories`

```text
carrier_service_id UUID FK
cargo_category_id UUID FK

PK (carrier_service_id, cargo_category_id)
```

## 16.9 `vehicles`

```text
id UUID PK
carrier_id UUID FK
code TEXT UNIQUE
brand TEXT
model TEXT NULL
vehicle_type TEXT
capacity_kg NUMERIC
volume_m3 NUMERIC NULL
location TEXT NULL
status TEXT
```

Golden matrix:

```text
Andes Freight   → Scania R450  → 18,000 kg
Inca Logistics  → Volvo FH     → 24,000 kg
Pacific Cargo   → Freightliner → 15,000 kg
```

CargoMesh no administra conductores.

## 16.10 `carrier_metrics`

La tabla soporta métricas globales y específicas de organización.

```text
id UUID PK
carrier_id UUID FK
organization_id UUID FK → organizations NULL
cargo_category_id UUID FK NULL

transport_mode TEXT

origin_country TEXT
origin_city TEXT
destination_country TEXT
destination_city TEXT

completed_freight_requests INTEGER
successful_freight_requests INTEGER

avg_cost NUMERIC NULL
avg_delay_hours NUMERIC NULL
cancellation_rate NUMERIC

updated_at TIMESTAMPTZ
```

`success_rate` se deriva:

```text
successful_freight_requests
──────────────────────────── × 100
completed_freight_requests
```

No se persiste una tercera cifra contradictoria.

Interpretación:

```text
organization_id IS NULL
→ global corridor metric

organization_id = ACME
→ organization-carrier corridor metric
```

Golden global metrics:

```text
Andes:
100 completed / 96 successful
→ reliability 96
→ route_experience_score 100

Inca:
50 completed / 49 successful
→ reliability 98
→ route_experience_score 50

Pacific:
50 completed / 43 successful
→ reliability 86
→ route_experience_score 50
```

No existen filas específicas de ACME para el Golden Flow:

```text
organization_history_score = 50
```

## 16.11 `orchestration_runs`

Tabla técnica.

```text
id UUID PK
freight_request_id UUID FK

run_type TEXT
status TEXT

started_at TIMESTAMPTZ
completed_at TIMESTAMPTZ NULL

created_by_member_id UUID FK NULL
failed_booking_id UUID NULL

metadata JSONB NULL
```

```text
run_type =
INITIAL
RECOVERY
```

```text
status =
RUNNING
OPTIONS_READY
COMPLETED
FAILED
CANCELLED
```

## 16.12 `orchestration_events`

Tabla técnica para evidencia WebMCP e idempotencia de ingestión.

```text
id UUID PK

tool_call_id TEXT UNIQUE

run_id UUID FK → orchestration_runs
freight_request_id UUID FK
carrier_id UUID FK NULL

provider_url TEXT
tool_name TEXT

tool_input JSONB
tool_output JSONB

schema_version TEXT

status TEXT
duration_ms INTEGER

started_at TIMESTAMPTZ
completed_at TIMESTAMPTZ
occurred_at TIMESTAMPTZ
```

Regla:

```text
same tool_call_id
→ same logical event
→ no duplicated runtime mutation
```

El Judge Inspector lee esta tabla.

## 16.13 `carrier_offers`

Estas filas **no existen en el seed inicial**.

Nacen de:

```text
quote_freight
→ record_provider_result
```

```text
id UUID PK

freight_request_id UUID FK
carrier_id UUID FK
vehicle_id UUID FK NULL
orchestration_run_id UUID FK → orchestration_runs

supersedes_offer_id UUID FK → carrier_offers NULL

provider_offer_reference TEXT
transport_mode TEXT
service_type TEXT

price NUMERIC
currency TEXT DEFAULT 'USD'
price_breakdown JSONB NULL

estimated_pickup TIMESTAMPTZ
estimated_delivery TIMESTAMPTZ
transit_hours NUMERIC

availability_class TEXT
available_capacity_kg NUMERIC
available_volume_m3 NUMERIC NULL

customs_coordination_included BOOLEAN
required_documents JSONB
customs_notes TEXT NULL

valid_until TIMESTAMPTZ

compatibility_status TEXT
compatibility_notes JSONB NULL

status TEXT
created_at TIMESTAMPTZ
```

Offer lifecycle only:

```text
QUOTED
EXPIRED
WITHDRAWN
ACCEPTED
REJECTED
```

No se usa:

```text
RECOMMENDED
SELECTED
```

como `CarrierOffer.status`.

Constraints:

```text
provider_offer_reference NOT NULL

UNIQUE (
  orchestration_run_id,
  carrier_id,
  provider_offer_reference
)
```

Esto permite reintentos idempotentes sin impedir que un `RECOVERY` run produzca una nueva versión de una oferta.


## 16.14 `freight_decisions`

Cada evaluación crea una fila nueva.

```text
id UUID PK
freight_request_id UUID FK
orchestration_run_id UUID FK

decision_type TEXT
decision_version INTEGER

supersedes_decision_id UUID FK → freight_decisions NULL
failed_booking_id UUID FK → bookings NULL

recommended_offer_id UUID FK → carrier_offers
selected_offer_id UUID FK → carrier_offers NULL

selection_mode TEXT NULL
selected_by_member_id UUID FK → organization_members NULL

optimization_strategy TEXT
heuristic_score NUMERIC
confidence_score NUMERIC

decision_reason TEXT
selection_reason TEXT NULL
candidate_snapshot JSONB
scoring_version TEXT
authorization_snapshot JSONB NULL

requires_review BOOLEAN
created_at TIMESTAMPTZ
```

```text
decision_type =
INITIAL
RECOVERY
```

Antes del click humano:

```text
recommended_offer_id = Andes
selected_offer_id = NULL
```

Recovery crea:

```text
decision_version = previous + 1
supersedes_decision_id = previous decision
failed_booking_id = rejected / expired booking
```

No se sobrescribe la decisión histórica.

`candidate_snapshot` debe permitir reproducir el ranking:

```text
weights
raw component values
normalized subscores
raw_score
display_score
eligibility reasons
historical inputs
anomaly result
tie-break inputs
```


## 16.15 `bookings`

```text
id UUID PK

freight_request_id UUID FK
carrier_id UUID FK
offer_id UUID FK

replaces_booking_id UUID FK → bookings NULL

provider_reference TEXT UNIQUE
provider_response_deadline TIMESTAMPTZ NULL
provider_status_reason TEXT NULL

idempotency_key TEXT UNIQUE
authorization_snapshot JSONB

selection_mode TEXT
selected_by_member_id UUID FK NULL

status TEXT
booked_at TIMESTAMPTZ

payment_mode TEXT
payment_status TEXT
payment_provider_reference TEXT NULL
payment_url TEXT NULL

current_location TEXT NULL
updated_eta TIMESTAMPTZ NULL
updated_at TIMESTAMPTZ
```

CargoMesh identifier:

```text
bookings.id = UUID
```

Carrier identifier:

```text
provider_reference = AND-BOOK-8821
```

Un índice único parcial debe impedir más de un booking activo por `FreightRequest`.

Estados activos:

```text
PENDING_PROVIDER_CONFIRMATION
CONFIRMED
IN_TRANSIT
CANCELLATION_REQUESTED
```

No activos:

```text
REJECTED
EXPIRED
CANCELLED
COMPLETED
```

Los no activos permiten un nuevo intento.

## 16.16 `booking_events`

```text
id UUID PK
booking_id UUID FK

provider_event_id TEXT NULL

event_type TEXT
occurred_at TIMESTAMPTZ

country_code TEXT NULL
city TEXT NULL
description TEXT NULL

source TEXT
metadata JSONB
created_at TIMESTAMPTZ
```

Para eventos provenientes de provider:

```text
provider_event_id NOT NULL

UNIQUE (
  booking_id,
  provider_event_id
)
```

Esto hace idempotente el polling de tracking.

Eventos permitidos incluyen:

```text
BOOKING_SUBMITTED
PROVIDER_CONFIRMED
PROVIDER_REJECTED
PROVIDER_EXPIRED
RECOVERY_STARTED
REPLACEMENT_SELECTED
PICKUP_SCHEDULED
PICKED_UP
IN_TRANSIT
BORDER_PROCESSING
CUSTOMS_CLEARED
CANCELLATION_REQUESTED
CANCELLED
DELIVERED
```

Eventos puramente internos pueden usar:

```text
provider_event_id = NULL
source = SYSTEM
```

## 16.17 RLS, grants e índices

### RLS

```text
auth.uid()
→ organization_members
→ organization_id
```

Un miembro autenticado puede leer únicamente entidades comerciales de su organización.

Catálogos de carriers/services pueden ser lectura `authenticated`.

Mutaciones críticas:

```text
record provider results
create decisions
create bookings
reset demo
```

son server-side.

`service_role` nunca llega al navegador.

### Grants

RLS y grants son capas diferentes.

La migración debe conceder explícitamente solo las operaciones requeridas por el frontend autenticado y mantener writes críticos fuera del cliente.

### Índices mínimos

```text
organization_members(auth_user_id)
organization_members(organization_id)

freight_requests(organization_id, status)

carrier_services(
  origin_country,
  destination_country,
  transport_mode,
  service_type
)

carrier_metrics(
  carrier_id,
  organization_id,
  origin_country,
  destination_country,
  cargo_category_id
)

orchestration_runs(freight_request_id, started_at)
orchestration_events(run_id, occurred_at)
orchestration_events(tool_call_id)

carrier_offers(freight_request_id, orchestration_run_id)
freight_decisions(freight_request_id, created_at)

bookings(freight_request_id, status)
booking_events(booking_id, occurred_at)
booking_events(booking_id, provider_event_id)
```

## 16.18 Migration contract

El Plan Maestro no congela un número de migración sin inspeccionar primero el repositorio real.

Regla:

```text
read current migration state
→ determine next sequence N
→ create N_v5_4_contract_alignment.sql
```

La migración debe declarar precondiciones y alinear nombres reales de columnas existentes.

No deben coexistir dos nombres para un mismo concepto, por ejemplo:

```text
legal_name vs name
default_strategy vs default_optimization_strategy
```

La implementación elige una convención única y la documentación refleja el schema desplegado.

## 16.19 Demo Reset

`Reset Demo` no ejecuta deletes globales.

Debe ser:

```text
server-only
demo-scenario-only
organization-scoped
FR-1042-scoped
```

El cliente no suministra libremente un `organization_id` a borrar.

El reset:

```text
clears runtime data for demo scenario
restores provider fixture state
creates fresh relative dates
restores confirmed FreightRequest baseline
```

Fechas relativas:

```text
pickup_start               = now + 24h
pickup_end                 = now + 28h
delivery_deadline          = now + 72h
provider quote valid_until = now + 6h
provider_response_deadline = booking time + 15m
```

El reset no preinserta offers, decisions, bookings ni events.

# 17. Estados principales

## FreightRequest

```text
DRAFT
→ SUBMITTED
→ AWAITING_CONFIRMATION
→ PENDING
→ EVALUATING
→ OPTIONS_READY
→ BOOKING_PENDING
→ BOOKED
→ IN_TRANSIT
→ DELIVERED
```

Branches:

```text
BOOKING_PENDING
→ RECOVERY_REQUIRED
→ EVALUATING
→ OPTIONS_READY

ANY PRE-DELIVERY STATE
→ SECURITY_REVIEW

PENDING / EVALUATING / OPTIONS_READY
→ CANCELLED
```

## OrchestrationRun

```text
RUNNING
→ OPTIONS_READY
→ COMPLETED
```

Alternatives:

```text
RUNNING → FAILED
RUNNING → CANCELLED
```

## CarrierOffer

```text
QUOTED
→ ACCEPTED
```

Alternatives:

```text
QUOTED → EXPIRED
QUOTED → WITHDRAWN
QUOTED → REJECTED
```

Recommendation and selection are stored only in `freight_decisions`.

## FreightDecision

```text
INITIAL v1
```

Recovery:

```text
INITIAL v1
→ RECOVERY v2
→ RECOVERY v3 ...
```

Cada versión conserva su snapshot completo.

## Provider Booking Status

Enum externo:

```text
PENDING_PROVIDER_CONFIRMATION
CONFIRMED
REJECTED
EXPIRED
IN_TRANSIT
DELIVERED
CANCELLED
```

No existe:

```text
NO_RESPONSE
```

como estado provider.

## Internal Booking

```text
PENDING_PROVIDER_CONFIRMATION
       │
       ├→ CONFIRMED
       │     ↓
       │  IN_TRANSIT
       │     ↓
       │  COMPLETED
       │
       ├→ REJECTED
       └→ EXPIRED
```

Mapping:

```text
provider DELIVERED
→ internal COMPLETED
```

Timeout:

```text
current_time > provider_response_deadline
AND provider still PENDING_PROVIDER_CONFIRMATION
→ CargoMesh derives EXPIRED
```

Cancellation:

```text
PENDING_PROVIDER_CONFIRMATION / CONFIRMED
→ CANCELLATION_REQUESTED
→ CANCELLED
```

## BookingEvent

Los eventos son append-only.

Provider events se deduplican mediante:

```text
booking_id + provider_event_id
```

# 18. Golden Flow 1 — International Assisted Freight Orchestration

## Baseline

```text
ACME Mining
Authenticated Demo Logistics Member

FR-1042
Callao, Lima, Peru
→ Santiago, Chile

ROAD · FTL
10 pallets × 800 kg
= 8,000 kg

SCHEDULED
Budget: $2,000
BALANCED

Available documents:
commercial_invoice
packing_list
```

Before orchestration:

```text
CarrierOffers = 0
FreightDecisions = 0
Bookings = 0
BookingEvents = 0
```

## Paso 1 — Start orchestration

CargoMesh crea:

```text
orchestration_run
type = INITIAL
status = RUNNING
```

FreightRequest:

```text
PENDING → EVALUATING
```

## Paso 2 — Andes

Full document navigation:

```text
/providers/andes
```

WebMCP:

```text
check_service_coverage
check_capacity
quote_freight
```

Provider fixture returns:

```text
price = $1,760
transit_hours = 31
availability_class = AVAILABLE_IN_WINDOW
reported vehicle = Scania R450
capacity = 18,000 kg
```

Agent returns to CargoMesh:

```text
record_provider_result
→ orchestration_events
→ CarrierOffer Andes INSERT
```

## Paso 3 — Inca

Fixture:

```text
price = $1,920
transit_hours = 29
availability_class = AVAILABLE_IN_WINDOW
vehicle = Volvo FH
capacity = 24,000 kg
```

Result is recorded by CargoMesh.

## Paso 4 — Pacific

Fixture:

```text
price = $1,590
transit_hours = 60
availability_class = LIMITED_WINDOW
vehicle = Freightliner
capacity = 15,000 kg
```

Result is recorded by CargoMesh.

## Paso 5 — Reproducible scoring

### Cost

```text
lowest = $1,590

Andes   = 1590 / 1760 × 100 = 90.34
Inca    = 1590 / 1920 × 100 = 82.81
Pacific = 1590 / 1590 × 100 = 100
```

### Reliability

```text
Andes   = 96
Inca    = 98
Pacific = 86
```

### ETA

Best transit:

```text
29h
```

```text
Andes   = 29 / 31 × 100 = 93.55
Inca    = 29 / 29 × 100 = 100
Pacific = 29 / 60 × 100 = 48.33
```

### Availability

```text
Andes   = 90
Inca    = 90
Pacific = 60
```

### Route Experience

```text
Andes   = min(100,100) = 100
Inca    = min(100,50)  = 50
Pacific = min(100,50)  = 50
```

### Organization History

No specific ACME history:

```text
Andes   = 50
Inca    = 50
Pacific = 50
```

### BALANCED

```text
Andes
= .25(90.34)+.25(96)+.20(93.55)+.10(90)+.10(100)+.10(50)
≈ 89.29
→ 89

Inca
= .25(82.81)+.25(98)+.20(100)+.10(90)+.10(50)+.10(50)
≈ 84.20
→ 84

Pacific
= .25(100)+.25(86)+.20(48.33)+.10(60)+.10(50)+.10(50)
≈ 72.17
→ 72
```

CargoMesh persiste:

```text
FreightDecision INITIAL v1
recommended_offer_id = Andes
selected_offer_id = NULL
```

FreightRequest:

```text
EVALUATING → OPTIONS_READY
```

## Paso 6 — Decision Confidence

Raw gap:

```text
89.2949 - 84.2031 ≈ 5.0918
```

```text
Candidate Separation ≈ 25.46
Decision Confidence ≈ 88.02
→ 88/100
```

## Paso 7 — Human selection

Las cards aparecen.

La persona hace click:

```text
Select Andes Freight
```

CargoMesh ejecuta:

```text
record_selection
```

y persiste:

```text
selected_offer_id = Andes
selected_by_member_id = current member
selection_mode = ASSISTED
```

## Paso 8 — Booking Request

Full navigate:

```text
/providers/andes
```

```text
book_freight(provider_offer_reference, ...)
```

Provider returns:

```text
provider_reference = AND-BOOK-8821
provider_booking_status = PENDING_PROVIDER_CONFIRMATION
```

CargoMesh crea su UUID interno:

```text
bookings.id = UUID
provider_reference = AND-BOOK-8821
```

FreightRequest:

```text
OPTIONS_READY → BOOKING_PENDING
```

## Paso 9A — Provider accepts

```text
get_provider_booking_status(AND-BOOK-8821)
→ provider_booking_status = CONFIRMED
```

CargoMesh actualiza:

```text
Booking → CONFIRMED
FreightRequest → BOOKED
BookingEvent → PROVIDER_CONFIRMED
```

Tracking se habilita.

## Paso 9B — Provider rejects

Judge fixture state:

```text
Andes = REJECT
```

Después:

```text
real get_provider_booking_status(AND-BOOK-8821)
→ provider_booking_status = REJECTED
```

CargoMesh:

```text
Booking → REJECTED
FreightRequest → RECOVERY_REQUIRED
```

y crea:

```text
orchestration_run
type = RECOVERY
```

## Paso 10 — Recovery

El agente vuelve a Inca/Pacific.

Crea ofertas nuevas cuando:

```text
old quote expired
capacity changed
provider response changed
```

Las nuevas ofertas usan:

```text
supersedes_offer_id
orchestration_run_id = RECOVERY
```

Se crea:

```text
FreightDecision RECOVERY v2
supersedes_decision_id = INITIAL v1
failed_booking_id = Andes booking
```

La decisión inicial no se modifica.

# 19. Golden Flow 2 — Preference negotiation (P1)

Objetivo: demostrar que CargoMesh distingue una **preferencia blanda** de una **restricción dura**.

## Intención

```text
"Necesito enviar 8t a Santiago dentro del plazo requerido.
Prefiero un Volvo y mi presupuesto máximo es $1,800."
```

Interpretación:

```text
Hard:
price <= $1,800

Soft:
preferred_vehicle_brand = Volvo
```

## Resultado

```text
Inca Logistics
Volvo FH
$1,920
→ FAIL hard budget

Andes Freight
Scania R450
$1,760
→ PASS hard budget
→ misses soft brand preference
```

El agente no puede relajar `$1,800`.

Sí puede solicitar autorización para relajar `Volvo`:

> No existe una opción Volvo que cumpla el presupuesto máximo de $1,800. Andes Freight ofrece una Scania compatible por $1,760 y cumple las restricciones obligatorias. ¿Autorizas relajar únicamente la preferencia de marca?

Si el cliente acepta:

```text
brand preference relaxed
budget unchanged
```

CargoMesh vuelve a evaluar candidatos válidos. Bajo `BALANCED`, Andes puede permanecer como la alternativa mejor rankeada.

La autorización de relajación se registra como contexto de la decisión, no como modificación silenciosa del requisito original.

# 20. Golden Flow 3 — Provider Rejection & Recovery

Objetivo: demostrar resiliencia antes de iniciar el transporte.

## Situación

El cliente selecciona Andes Freight.

```text
book_freight
→ PENDING_PROVIDER_CONFIRMATION
```

Andes responde:

```text
REJECTED
reason = capacity changed
```

## Acción

CargoMesh:

```text
1. persists rejection
2. notifies verified corporate email
3. excludes Andes from current recovery attempt
4. refreshes Inca and Pacific
5. requests fresh capacity / quote when needed
6. reruns hard constraints
7. reruns ranking
```

Resultado:

```text
Inca Logistics
$1,920
best refreshed eligible option
```

En `ASSISTED`:

```text
human confirms replacement
```

En `SMART_AUTO_RECOVERY`:

```text
policy must explicitly authorize replacement
```

El nuevo booking conserva:

```text
replaces_booking_id = rejected Andes booking
```

Esto crea una cadena auditable de intentos sin borrar el historial.

# 21. UI propuesta

## 21.1 Register Organization

```text
Legal company name
Country
Business identifier
Corporate email
Corporate phone
Member account
```

## 21.2 Organization Profile

```text
Company
Country
Business identifier
Verified corporate email 🔒
Corporate phone
Members
Policies
Billing mode
```

## 21.3 Home

Muestra:

```text
Drafts
Requests awaiting confirmation
Options ready
Bookings awaiting carrier confirmation
Confirmed transports
Recovery required
Tracking
Exceptions
```

## 21.4 Nueva FreightRequest

Stepper:

```text
1. Organization & Requester
2. Pickup & Delivery
3. Cargo
4. Schedule & Policy
5. Review & Confirm
```

## 21.5 Smart Dispatch Status

```text
Start Orchestration
→ create orchestration_run
→ Navigate WebMCP
→ record provider results
→ Coverage
→ Capacity
→ Quotes
→ History
→ Ranking
→ OPTIONS_READY
```

El flujo se detiene en `OPTIONS_READY`.

La selección humana ocurre después mediante las cards.

## 21.6 Carrier Offer Cards

Cada card:

```text
Carrier
Total price
Reported vehicle / capacity
Pickup
ETA
Reliability
Cross-border capability
Derived cost analytics
Score
Recommendation badge
```

CTA:

```text
Seleccionar esta opción
```

La mejor opción recibe:

```text
Recommended by CargoMesh
```

pero las demás elegibles siguen disponibles.

## 21.7 Booking Request Status

Después de seleccionar:

```text
Solicitud enviada
Andes Freight

Status:
Esperando confirmación del carrier

Response deadline:
10:15
```

Estados UI:

```text
PENDING
CONFIRMED
REJECTED
NO RESPONSE
```

## 21.8 Recovery UI

Ante rechazo/no respuesta:

```text
Andes Freight no confirmó la solicitud.

CargoMesh volvió a validar las alternativas.
```

Card:

```text
Recommended replacement
Inca Logistics
$1,920
Updated availability
```

CTA Assisted:

```text
Enviar nueva solicitud
```

## 21.9 Tracking

Solo después de `CONFIRMED`.

```text
CONFIRMED
→ PICKUP
→ IN_TRANSIT
→ BORDER
→ DELIVERED
```

## 21.10 Booking Changes / Cancel

Botón:

```text
Modificar o cancelar
```

Primero solicita motivo.

Luego:

```text
CargoMesh consulta opciones del carrier
```

Ejemplo:

```text
Reprogramar mañana     $0
Cancelar ahora         $120
Mantener en espera     $0
```

El agente puede marcar:

```text
Recommended
```

sobre la alternativa favorable.

## 21.11 Unrecognized Request

Acción visible:

```text
No reconozco esta solicitud
```

No abre un modal de cancelación normal.

Activa:

```text
SECURITY_REVIEW
```

y muestra:

```text
Las acciones automáticas fueron suspendidas.
El equipo autorizado de la organización fue notificado.
```

## 21.12 Payment

P0:

```text
Corporate Account / Invoice
```

Si un provider requiere checkout:

```text
Pago requerido
→ Abrir checkout seguro
```

CargoMesh no captura datos de tarjeta.

## 21.13 Supervisor — Exception Queue

Incluye:

```text
provider rejection
provider no-response
price anomaly
low confidence
policy violation
security review
disruption
```

## 21.14 Provider Demo Pages

Carrier tools:

```text
check_service_coverage
check_capacity
quote_freight
book_freight
get_provider_booking_status
get_booking_change_options
apply_booking_change
```

Cada provider mantiene fixtures deterministas propios.

## 21.15 Judge / Agent Activity Drawer

El modo demo puede abrir un drawer técnico alimentado por:

```text
orchestration_runs
orchestration_events
```

Muestra:

```text
timestamp
provider_url
tool_name
status
duration_ms
input/output expandable
```

No construye eventos falsos del lado cliente.

Controles:

```text
Start Orchestration
Set Provider Fixture: ACCEPT / REJECT / NO_RESPONSE
Reset Demo
```

`Start Orchestration` se detiene en `OPTIONS_READY`.

El control del fixture modifica la respuesta provider; el estado comercial de CargoMesh solo cambia después de una tool WebMCP real.

# 22. Elementos de innovación

## 22.1 Intent-driven freight orchestration

El usuario no busca transportistas uno por uno.

Expresa un resultado:

```text
"Move 8 tons from Lima to Santiago
before Friday, prioritizing reliability."
```

CargoMesh transforma esa intención en una operación logística.

### 22.1.1 Organization-aware cargo intake

CargoMesh reutiliza el contexto empresarial sin obligar al usuario a reconstruir cada solicitud desde cero:

```text
organization cargo profile
+ current request changes
→ suggested unitization and vehicle class
→ human-reviewed FreightRequest
```

La sugerencia reduce fricción, pero no reemplaza la validación WebMCP. La capacidad real solo se conoce al ejecutar las tools de los carriers.

## 22.2 Agent-native discovery through WebMCP

Las aplicaciones de carriers exponen capacidades estructuradas que el agente puede descubrir y ejecutar.

CargoMesh no se limita a una lista precargada de botones o filtros.

## 22.2.1 Capability-aware freight matching

CargoMesh no descubre únicamente disponibilidad. El agente puede consultar si una capacidad logística es compatible con:

```text
cargo category
weight / volume
temperature control
hazardous handling
fragility
oversized cargo
pickup schedule
```

Esto convierte la selección en un problema de compatibilidad operacional antes de convertirse en un problema de ranking.

## 22.3 Diferencia frente a marketplaces tradicionales

CargoMesh no conecta:

```text
Buyer ↔ Seller
```

ni se centra en:

```text
Product → Order → Delivery
```

Orquesta:

```text
Shipper ↔ Logistics Capacity
```

La carga existe antes de entrar al sistema.

## 22.4 Context-aware procurement

La decisión puede combinar:

```text
current carrier offers
+
historical route performance
+
organization preferences
+
organization cargo profiles
+
business constraints
```

Esto permite que la opción más barata no sea automáticamente la mejor.

## 22.5 Explainable heuristic decisions

Cada decisión muestra:

```text
what was required
what was considered
what was rejected
why the winner was selected
confidence
```

## 22.6 Exception-driven human involvement

Human-in-the-loop no significa aprobar todo.

```text
Routine / high confidence → Agent
Ambiguous / risky → Human
```

## 22.7 Adaptive preference relaxation

Si una preferencia blanda no está disponible —por ejemplo una marca de vehículo— el agente puede proponer una alternativa equivalente sin relajar restricciones críticas.

## 22.8 Historical price anomaly detection

Una oferta puede ser técnicamente válida pero económicamente atípica.

Comparar contra históricos permite impedir auto-booking cuando el precio se desvía demasiado.

## 22.9 Transport-mode extensible domain

La `FreightRequest` utiliza un campo `transport_mode` que permite extender el dominio hacia:

```text
ROAD
AIR
SEA
RAIL
```

Esto significa que el **modelo de solicitud es extensible a otros modos**. No significa que CargoMesh ya pueda orquestar operaciones multimodales.

La orquestación multimodal requerirá, entre otras entidades:

```text
transport_plans
transport_legs
handoffs
terminal constraints
```

y permanece fuera del MVP.

## 22.10 Capacity utilization / empty-mile opportunity — futuro

CargoMesh puede generar valor también para carriers.

Ejemplo:

```text
Truck:
Lima, Peru → Santiago, Chile  FULL
Santiago, Chile → Lima, Peru EMPTY
```

Una `FreightRequest` compatible:

```text
Santiago, Chile → Lima, Peru
5 tons
```

puede aprovechar capacidad de retorno.

Esto abre una futura línea de optimización:

```text
client cost efficiency
+
carrier capacity utilization
+
empty-mile reduction
```

## 22.11 Post-operation learning — P2

Después de completar una operación pueden recalcularse:

```text
success_rate
avg_delay
avg_cost
route_experience
```

No requiere ML para el MVP; basta agregación histórica reproducible.

---

# 23. Ideas adicionales opcionales

Estas ideas fortalecen la narrativa, pero NO pertenecen a P0.

## 23.1 Counterfactual explanation

Mostrar:

> Si hubieras seleccionado “Lowest Cost”, Pacific Cargo habría sido elegido por $1,590, pero con un historial de retraso promedio superior.

Esto demuestra que la política realmente cambia la decisión.

## 23.2 Advanced anomaly analysis UI — P1

El **guard lógico** `current quote > historical avg * 1.30` pertenece a P0.

Esta sección opcional se limita a una experiencia avanzada:

```text
historical trend
current deviation
reason for review
counterfactual without anomaly
supervisor visualization
```

La UI avanzada no es necesaria para que el guard P0 funcione.

## 23.3 Reliability floor by cargo type

Ejemplo:

```text
fragile cargo
→ provider success_rate >= 95%
```

## 23.4 Dynamic fallback

Si ningún proveedor cumple todas las preferencias:

```text
relax soft preferences
→ never relax hard constraints automatically
```

## 23.5 Provider diversity rule

Para clientes empresariales podría existir:

```text
avoid concentration > 70% in one carrier
```

P2, no MVP.

## 23.6 SLA-aware rebooking

Ante una falla, priorizar conservar el deadline original aunque aumente moderadamente el precio.

---

# 24. Qué NO hacer durante la hackathon

No implementar:

- pagos reales;
- GPS en tiempo real;
- aplicación de conductor;
- facturación;
- RRHH;
- ML complejo;
- optimizador matemático avanzado;
- integración con transportistas reales;
- ejecución real de AIR / SEA / RAIL;
- construcción de rutas multimodales en el MVP;
- presentación de declaraciones aduaneras;
- cálculo de aranceles / motor tributario;
- integración directa con SUNAT o Aduanas de Chile;
- marketplace financiero;
- chat interno;
- autenticación empresarial compleja;
- mapas avanzados antes de completar WebMCP.

---

# 25. MVP

## P0 Intake

- Supabase Auth demo user real;
- organization membership real;
- FreightRequest;
- cargo normalization;
- confirmed request;
- relative schedule dates;
- USD.

## P0 Orchestration

- create `INITIAL orchestration_run`;
- full document navigation to 3 providers;
- real WebMCP tool execution;
- deterministic provider fixtures;
- `record_provider_result`;
- runtime `CarrierOffer` persistence;
- orchestration event persistence;
- reproducible BALANCED normalization;
- `FreightDecision INITIAL v1`;
- `OPTIONS_READY`.

## P0 Assisted Selection

- recommended carrier card;
- alternatives visible;
- human click;
- `selected_offer_id`;
- `selected_by_member_id`.

## P0 Booking

- full navigate selected provider;
- idempotent `book_freight`;
- carrier `provider_reference`;
- CargoMesh booking UUID;
- `PENDING_PROVIDER_CONFIRMATION`;
- one-active-booking DB guard.

## P0 Provider Acknowledgement

- real `get_provider_booking_status(provider_reference)`;
- `CONFIRMED | REJECTED | EXPIRED`;
- persistent booking event.

## P0 Recovery

- `RECOVERY orchestration_run`;
- fresh provider calls;
- new/stale offer versioning;
- `FreightDecision RECOVERY v2`;
- historical decision preserved;
- Assisted replacement proposal.

## P0 Tracking

- persisted `booking_events`;
- carrier-reported status;
- Tracking UI.

## P0 Judge Evidence

- Tool/Agent Activity Drawer;
- data sourced from `orchestration_events`;
- safe Reset Demo;
- provider fixture controls.

## P1

- Smart Auto;
- Smart Auto Recovery;
- cancellation/change options;
- security review;
- external checkout;
- advanced analytics.

## Future

- open load board;
- LTL;
- driver management;
- GPS;
- AIR / SEA / RAIL;
- multimodal;
- tax engine.

# 26. Modelo de carpetas sugerido

```text
cargomesh/
│
├── README.md
├── LICENSE
├── .env.example
│
├── docs/
│   ├── PLANNING.md
│   ├── ARCHITECTURE.md
│   └── DEMO.md
│
├── src/
│   ├── app/
│   │   ├── freight-request/
│   │   ├── freight/
│   │   ├── exceptions/
│   │   └── providers/
│   │       ├── andes/
│   │       ├── pacific/
│   │       └── inca/
│   │
│   ├── features/
│   │   ├── orchestration/
│   │   ├── decision-engine/
│   │   ├── freight/
│   │   └── providers/
│   │
│   ├── webmcp/
│   │   ├── provider-tools/
│   │   └── cargomesh-tools/
│   │
│   └── lib/
│       └── supabase/
│
└── supabase/
    ├── migrations/
    ├── current_public_schema.sql
    ├── database.types.ts
    └── seed.sql
```

---

# 27. Demo Data Contract — Bootstrap Seed, Scenario and Provider Fixtures

El término `seed` se reserva para preparar el mundo de la demo.

No debe preconstruir los resultados que WebMCP tiene que producir.

## 27.1 Bootstrap Seed

Puede crear:

```text
ACME Mining
Demo Auth User + organization_members
organization_preferences
organization_cargo_profiles

cargo_categories

Andes / Inca / Pacific
carrier_services
carrier-service cargo compatibility
vehicles

global carrier_metrics
```

Matriz congelada:

```text
Andes Freight
Scania R450
18,000 kg
100 corridor operations
96 successful
reliability 96

Inca Logistics
Volvo FH
24,000 kg
50 corridor operations
49 successful
reliability 98

Pacific Cargo
Freightliner
15,000 kg
50 corridor operations
43 successful
reliability 86
```

## 27.2 Demo Scenario

`Reset Demo` restaura FR-1042 como:

```text
organization = ACME Mining
requester = Demo Logistics Member

Callao, Lima, Peru
→ Santiago, Chile

10 PALLETS × 800 kg
= 8,000 kg

ROAD · FTL
SCHEDULED

available_documents =
commercial_invoice
packing_list

Budget = $2,000
Strategy = BALANCED

confirmation_status = CONFIRMED
status = PENDING
```

Las fechas se generan relativamente al reset.

## 27.3 Provider Fixtures

### Andes

```text
quote:
$1,760

transit:
31h

availability:
AVAILABLE_IN_WINDOW

vehicle:
Scania R450 · 18t

booking fixture:
ACCEPT by default
```

### Inca

```text
quote:
$1,920

transit:
29h

availability:
AVAILABLE_IN_WINDOW

vehicle:
Volvo FH · 24t
```

### Pacific

```text
quote:
$1,590

transit:
60h

availability:
LIMITED_WINDOW

vehicle:
Freightliner · 15t
```

Los fixtures pertenecen a la aplicación provider.

No son filas `carrier_offers`.

## 27.4 Runtime starts empty

Después del seed/reset:

```text
carrier_offers       → no FR-1042 rows
freight_decisions    → no FR-1042 rows
bookings             → no FR-1042 rows
booking_events       → no FR-1042 rows
orchestration_runs   → no FR-1042 rows
orchestration_events → no FR-1042 rows
```

## 27.5 Runtime creation

```text
quote_freight
→ record_provider_result
→ CarrierOffer

evaluate_offers
→ FreightDecision

human click
→ selected_offer_id

book_freight
→ Booking

get_provider_booking_status
→ BookingEvent
```

## 27.6 Reset Demo

El reset:

```text
server-only
hard-scoped to demo scenario
restores provider fixture state
removes runtime demo artifacts only
generates fresh future dates
```

Nunca borra globalmente todas las organizations/carriers.

## 27.7 Transparency statement

> **Carrier data and responses are deterministic demo fixtures. WebMCP execution, ranking, selection, persistence, booking lifecycle and recovery are real.**

# 28. Product Contract Freeze

## Canonical Spanish definition

> **CargoMesh es una plataforma B2B de orquestación agent-native de transporte de carga. Una organización autenticada crea una FreightRequest y CargoMesh utiliza un agente para navegar páginas de carriers participantes mediante WebMCP. Los carriers de la demo responden con fixtures deterministas, pero cada ejecución de tools, transferencia de resultados, persistencia de ofertas, cálculo de ranking, selección humana, booking, confirmación y recovery ocurre realmente. CargoMesh mantiene una separación explícita entre recomendación, selección, solicitud de booking y aceptación del provider.**

## Canonical English definition

> **CargoMesh is an agent-native B2B freight orchestration platform. An authenticated organization creates a FreightRequest and CargoMesh uses an agent to navigate participating carrier websites through WebMCP. Demo carriers use deterministic fixtures, while tool execution, result transfer, offer persistence, ranking, human selection, booking, provider acknowledgement and recovery are executed for real. CargoMesh explicitly separates recommendation, commercial selection, booking request and provider confirmation.**

## Contrato congelado

```text
Auth                     = real Supabase Auth demo user
Authorization            = organization_members + RLS

Seed                     = baseline only
Provider prices          = provider-side deterministic fixtures
Runtime offers           = generated by WebMCP flow

WebMCP result bridge     = record_provider_result
Observability            = orchestration_runs + orchestration_events
Tool ingestion idempotency  = tool_call_id UNIQUE
Tracking deduplication      = booking_id + provider_event_id
Judge Inspector          = reads real orchestration events

Navigation               = full document navigation for providers

Decision                 = reproducible normalization + BALANCED
Recommended              = recommended_offer_id
Selected                 = selected_offer_id nullable until human click
Default UX               = ASSISTED

CarrierOffer status      = offer lifecycle only
Recovery offers          = versioned via supersedes_offer_id
Recovery decisions       = versioned, never overwrite initial decision

CargoMesh booking ID     = UUID
Carrier booking ID       = provider_reference
Status lookup            = get_provider_booking_status(provider_reference)

Idempotency              = idempotency_key
Duplicate guard          = one active booking / FreightRequest

Reset                    = server-only + demo scoped + relative dates

RLS + grants             = both required
Critical writes          = server-side

Payment P0               = CORPORATE_ACCOUNT / INVOICE
Customs status           = carrier-reported
Driver management        = carrier responsibility
LTL / multimodal         = Future
```

# 29. Roles del equipo


## Integrante A — WebMCP / Agent Integration

Ownership:

- provider tool contracts;
- `document.modelContext.registerTool(...)`;
- agent ↔ web flow;
- tool schemas;
- orchestration integration;
- `docs/ARCHITECTURE.md`.

## Integrante B — Product / Frontend

Ownership:

- Request UX;
- preferences;
- Smart Dispatch status;
- explanation panel;
- result screen;
- exception UX;
- `docs/DEMO.md`.

## Integrante C — Backend / Decision Data

Ownership:

- Supabase;
- schema/migrations;
- carrier metrics;
- quotes;
- seed;
- heuristic engine support;
- deployment data.

Todos participan en integración.

---

# 30. Roadmap de implementación

## Fase 1 — Schema real

```text
inspect deployed schema
→ determine next migration number
→ create v5.4 alignment migration
→ constraints
→ RLS
→ grants
→ indexes
```

## Fase 2 — Bootstrap + fixtures

```text
real demo auth user
bootstrap seed
FR-1042 reset scenario
provider fixtures
runtime tables empty
```

## Fase 3 — One-provider vertical slice

```text
CargoMesh
→ Andes page
→ real WebMCP quote
→ record_provider_result
→ CarrierOffer persisted
→ orchestration_event persisted
```

No avanzar a tres providers hasta probar esta cadena.

## Fase 4 — Multi-provider decision

```text
Andes + Inca + Pacific
→ persistent offers
→ exact normalizations
→ FreightDecision
→ OPTIONS_READY
```

## Fase 5 — Human selection + booking

```text
human click
→ selected_offer_id
→ book_freight
→ provider_reference
→ PENDING_PROVIDER_CONFIRMATION
```

## Fase 6 — Acknowledgement + recovery

```text
get_provider_booking_status
→ CONFIRMED
or
→ REJECTED
→ RECOVERY run
```

## Fase 7 — Judge evidence

```text
Agent Activity Drawer
Reset Demo
Provider fixture control
Tracking
```

Solo después se dedica tiempo a pulido visual/video.

# 31. Definition of Done

## 31.1 Bootstrap

- Auth demo real.
- Membership real.
- RLS validado.
- Runtime FR-1042 vacío después del reset.

## 31.2 One Provider

```text
full navigate Andes
→ WebMCP quote
→ record_provider_result
→ CarrierOffer
→ orchestration_event
```

Todo debe ser verificable en BD.

## 31.3 Multi-provider

Tres provider results nacen por tres ejecuciones reales.

## 31.4 Decision

Los subscores se calculan con las fórmulas documentadas.

```text
candidate_snapshot
```

debe permitir recomputar el resultado.

## 31.5 Selection

Antes del click:

```text
selected_offer_id = NULL
```

Después:

```text
selected_offer_id = chosen offer
```

## 31.6 Booking

CargoMesh almacena UUID interno y provider reference separadamente.

Un retry no duplica booking.

Dos idempotency keys distintas tampoco pueden producir dos bookings activos simultáneos.

## 31.7 Provider acknowledgement

El estado de CargoMesh cambia solo después de una respuesta real de `get_provider_booking_status`.

## 31.8 Recovery

Recovery crea nuevas ofertas/decisión cuando corresponde y conserva las anteriores.

## 31.9 Observability

El Judge Inspector puede reconstruir la ejecución desde `orchestration_events`.

## 31.10 Reset

Reset deja el escenario listo y runtime vacío con fechas futuras.

# 32. Acceptance Test principal — Golden Flow E2E

Precondiciones de identidad e intake:

- [ ] La organización es el tenant y no una identidad de login.
- [ ] El usuario demo pertenece a ACME mediante `organization_members`.
- [ ] El dashboard solo muestra solicitudes de la organización activa.
- [ ] ACME posee el perfil `Repuestos y maquinaria minera`.
- [ ] La UI propone 10 pallets × 800 kg desde el perfil y permite edición humana.
- [ ] Peso y volumen normalizados coinciden con los valores persistidos.
- [ ] La sugerencia de `TRACTOR_TRAILER` no sustituye `check_capacity` WebMCP.

- [ ] 1. Existe usuario demo real en Supabase Auth.
- [ ] 2. `organization_members.auth_user_id` referencia ese usuario.
- [ ] 3. RLS permite leer solo la organización demo correspondiente.
- [ ] 4. Reset deja FR-1042 `CONFIRMED + PENDING`.
- [ ] 5. Reset genera pickup/deadline futuros.
- [ ] 6. Reset deja runtime FR-1042 vacío.
- [ ] 7. Andes fixture existe solo del lado provider.
- [ ] 8. Inca fixture existe solo del lado provider.
- [ ] 9. Pacific fixture existe solo del lado provider.
- [ ] 10. `Start Orchestration` crea `INITIAL orchestration_run`.
- [ ] 11. Agent full-navigates `/providers/andes`.
- [ ] 12. Andes WebMCP tools ejecutan realmente.
- [ ] 13. Cada provider tool retorna envelope `ok/data` o `ok/error`.
- [ ] 14. Un rechazo comercial usa `ok=true`, no error técnico.
- [ ] 15. `record_provider_result` recibe `tool_call_id`, input/output y timestamps.
- [ ] 16. Retry del mismo `tool_call_id` se deduplica.
- [ ] 17. `record_provider_result` inserta Andes `CarrierOffer`.
- [ ] 18. Se registra un `orchestration_event` Andes real.
- [ ] 19. Se repite la cadena para Inca.
- [ ] 20. Se repite la cadena para Pacific.
- [ ] 21. No existían las tres ofertas antes de las tools.
- [ ] 22. Hard constraints corren sobre ofertas persistidas.
- [ ] 23. `cost_score` coincide con fórmula documentada.
- [ ] 24. `reliability_score` coincide con históricos.
- [ ] 25. `eta_score` coincide con transit hours.
- [ ] 26. `availability_score` coincide con availability class.
- [ ] 27. `route_experience_score` coincide con completed route operations.
- [ ] 28. `organization_history_score = 50` cuando no hay historial ACME-carrier.
- [ ] 29. BALANCED produce Andes `89.2949 → 89`.
- [ ] 30. BALANCED produce Inca `84.2031 → 84`.
- [ ] 31. BALANCED produce Pacific `72.1667 → 72`.
- [ ] 32. `data_completeness` se calcula con required fields.
- [ ] 33. `constraint_certainty` se calcula con constraints aplicables.
- [ ] 34. `historical_evidence` se calcula desde volumen × success rate.
- [ ] 35. `candidate_separation` usa raw scores.
- [ ] 36. `anomaly_safety` sigue la regla documentada.
- [ ] 37. Decision Confidence produce `88.0188 → 88/100`.
- [ ] 38. `candidate_snapshot` permite recomputar scoring y confidence.
- [ ] 39. `FreightDecision INITIAL v1` se inserta.
- [ ] 40. Antes del click `selected_offer_id IS NULL`.
- [ ] 41. FreightRequest queda `OPTIONS_READY`.
- [ ] 42. Judge/Agent Drawer muestra eventos desde BD.
- [ ] 43. Usuario hace click en Andes.
- [ ] 44. `record_selection` persiste Andes + member.
- [ ] 45. Agent full-navigates Andes para booking.
- [ ] 46. `book_freight` devuelve `provider_reference`.
- [ ] 47. `book_freight` usa `provider_booking_status`.
- [ ] 48. CargoMesh crea un booking UUID distinto de `provider_reference`.
- [ ] 49. Booking queda `PENDING_PROVIDER_CONFIRMATION`.
- [ ] 50. Retry con misma idempotency key no duplica.
- [ ] 51. DB impide un segundo booking activo con otra key.
- [ ] 52. Fixture `ACCEPT` no actualiza directamente CargoMesh.
- [ ] 53. `get_provider_booking_status(provider_reference)` devuelve `provider_booking_status=CONFIRMED`.
- [ ] 54. Solo entonces Booking pasa a `CONFIRMED`.
- [ ] 55. Solo entonces FreightRequest pasa a `BOOKED`.
- [ ] 56. Provider `DELIVERED` mapea a Booking `COMPLETED`.
- [ ] 57. Tracking persiste `provider_event_id`.
- [ ] 58. Polling repetido no duplica `booking_events`.
- [ ] 59. Caso alterno: fixture Andes = `REJECT`.
- [ ] 60. Real `get_provider_booking_status` devuelve `provider_booking_status=REJECTED`.
- [ ] 61. CargoMesh crea `RECOVERY orchestration_run`.
- [ ] 62. Recovery vuelve a consultar providers restantes.
- [ ] 63. Recovery no sobrescribe offers/decision iniciales.
- [ ] 64. Nueva offer puede usar `supersedes_offer_id`.
- [ ] 65. `FreightDecision RECOVERY v2` referencia v1.
- [ ] 66. Fixture `NO_RESPONSE` mantiene provider en `PENDING_PROVIDER_CONFIRMATION`.
- [ ] 67. CargoMesh deriva `EXPIRED` únicamente al superar el deadline.
- [ ] 68. 0 candidatos elegibles produce `NO_MATCH / REVIEW`.
- [ ] 69. 1 candidato elegible bloquea Smart Auto.
- [ ] 70. Empate usa tie-break determinístico documentado.
- [ ] 71. Reset Demo actúa solo sobre escenario demo.
- [ ] 72. Reset no ejecuta deletes globales.
- [ ] 73. `service_role` no aparece en browser/bundle.

Resultado:

```text
73/73
→ Golden Flow technically VERIFIED
```

# 33. Narrativa de innovación para jueces

CargoMesh no debe presentarse como:

> "AI that chooses a truck."

Debe presentarse como:

> **CargoMesh demonstrates an agent-native freight orchestration platform where logistics websites expose structured capabilities through WebMCP. A customer submits intent instead of manually choosing a carrier; the agent discovers providers, validates eligibility, combines live quotes with historical reliability and customer preferences, then executes the booking autonomously when business policy allows it. Humans are involved only when the decision is ambiguous or risky.**

La innovación se apoya en cuatro pilares:

```text
1. Web-native provider discovery
2. Context-aware autonomous dispatch
3. Explainable multi-criteria decision policy
4. Exception-driven human oversight
```

---

# 34. Decisiones congeladas y verificaciones pendientes

## 34.1 FINAL FROZEN CONTRACT

```text
Product lifecycle           = frozen
Default user mode           = ASSISTED

Seed                        = baseline only
Runtime commercial results  = empty initially
Provider responses          = deterministic provider fixtures

WebMCP causality            = required
Result bridge               = record_provider_result
Result ingestion key        = tool_call_id UNIQUE
Observability               = orchestration_runs/events

Provider navigation         = full document
Tool inspector              = real event source

Provider response envelope  = ok/data | ok/error
Business rejection          = ok=true + REJECTED
Technical failure           = ok=false + structured error

Provider booking field      = provider_booking_status
NO_RESPONSE                 = not a provider status
Timeout authority           = CargoMesh deadline → EXPIRED
Provider DELIVERED          = internal COMPLETED

Tracking event identity     = provider_event_id
Tracking dedupe             = booking_id + provider_event_id

Balanced weights            = 25/25/20/10/10/10
Scoring normalizations      = frozen
Golden raw scores           = 89.2949 / 84.2031 / 72.1667
Golden display scores       = 89 / 84 / 72

Data Completeness           = formula-defined
Constraint Certainty        = formula-defined
Historical Evidence         = formula-defined
Candidate Separation        = formula-defined
Anomaly Safety              = formula-defined
Golden Confidence           = 88.0188 → 88/100

0 eligible                  = NO_MATCH / REVIEW
1 eligible                  = no Smart Auto
tie-break                   = reliability, price, transit, carrier_id

Organization history        = 50 fallback when absent
Fallback 50                 = relative-rank neutral, not absolute-score neutral
Success rate                = derived from counts

Candidate snapshot          = full reproducibility evidence

Recommendation              = freight_decision
Selection                   = freight_decision
CarrierOffer status         = offer lifecycle only

Recovery                    = versioned offers + decisions
Historical results          = append/preserve

Booking internal ID         = UUID
Provider reference          = provider-owned string
Status query                = provider_reference

Duplicate guard             = idempotency + partial unique active booking

Auth                        = real Supabase Auth
RLS                         = organization scoped
Grants                      = explicit
Critical writes             = server-side

Tenant                      = organization
Human identity              = auth.users + organization_members
Member invitation           = server-side Supabase Auth invite
Cargo templates             = organization_cargo_profiles
Unitized intake             = quantity × unit weight × units per entry
Variable cargo detail       = cargo_specifications JSONB

Dates                       = relative on reset
Reset                       = server-only + demo scoped

Migration number            = derived from actual repo state
```

## 34.2 Únicos pendientes permitidos

A partir de este freeze, solo se aceptan cambios por:

```text
implementation blocker
schema incompatibility verified in repo
WebMCP API requirement
security defect
mathematical inconsistency
judge-facing evidence defect
```

No se agregan nuevas features de negocio antes de completar el E2E.

# 35. Próximo paso inmediato

No construir más lógica de negocio.

Orden:

```text
1. Create real Supabase Auth demo user + OWNER membership
2. Implement organization registration and server-side member invitation
3. Implement cargo profile suggestion in the intake form
4. Move quotes/accept-reject behavior to provider fixtures
5. Implement one Andes WebMCP vertical slice
6. Implement record_provider_result
7. Verify CarrierOffer appears only after tool execution
8. Extend to Inca + Pacific
9. Implement exact scoring and persist INITIAL decision
10. Implement human selection and booking pending
11. Implement provider confirmation/rejection and recovery versioning
12. Implement tracking and Judge evidence drawer
13. Run Acceptance Test
```

Milestone crítico:

> **Si `carrier_offers`, `freight_decisions` o `bookings` existen antes de que el flujo correspondiente ocurra, la demo todavía no está alineada.**

# 36. Regla final contra scope creep

Antes de implementar cualquier nueva feature, preguntar:

> **¿Esta funcionalidad demuestra mejor que WebMCP permite que un agente convierta la intención del cliente en una operación logística autónoma, explicable y ejecutable?**

Si la respuesta es **no**, no es prioridad para esta hackathon.
