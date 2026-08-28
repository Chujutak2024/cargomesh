# CargoMesh — Plan Maestro v4 para WebMCP Challenge 2026

> **Versión:** v2.0 — Autonomous Agentic Freight Dispatch  
> **Estado:** Pivot aprobado para implementación  
> **Objetivo:** construir una experiencia tipo *Rappi para carga B2B*, donde una solicitud logística pueda ser interpretada, enriquecida, validada y despachada por un agente utilizando capacidades WebMCP expuestas por proveedores, con intervención humana solo cuando exista una excepción o una decisión de baja confianza.

> **Estado conceptual:** PRODUCT CONTRACT FROZEN — listo para iniciar implementación. Cambios posteriores requieren un bloqueo técnico o evidencia clara de que el Golden Flow no representa bien el reto.

---

# 0. Qué cambió respecto a la versión anterior

La primera versión de CargoMesh estaba centrada en un **operador logístico** que pedía al agente buscar camiones y luego aprobaba una recomendación.

Ese flujo era funcional, pero demasiado cercano a un sistema tradicional de filtros:

```text
Operador
   ↓
Buscar vehículos disponibles
   ↓
Filtrar capacidad / costo / ETA
   ↓
Agente recomienda
   ↓
Operador aprueba
```

El nuevo enfoque mueve el centro del producto hacia una **orquestación logística autónoma orientada al cliente**:

```text
Cliente / Sistema cliente
        ↓
Solicitud de envío
        ↓
Agente interpreta y completa contexto
        ↓
WebMCP descubre capacidades de proveedores
        ↓
Valida restricciones duras
        ↓
Obtiene cotizaciones + desempeño histórico
        ↓
Motor heurístico multicriterio
        ↓
Decisión explicable
        ↓
Auto-reserva si existe alta confianza
        ↓
Escalamiento solo si hay excepción
```

## Cambio de North Star

### Antes

> ¿Cómo puede un agente ayudar a un operador a seleccionar el mejor camión?

### Ahora

> **¿Cómo puede WebMCP permitir que una solicitud logística sea resuelta de extremo a extremo por un agente que descubre proveedores, interpreta preferencias, valida políticas, compara desempeño histórico y ejecuta la asignación sin obligar al cliente a comprender la complejidad operativa?**

---

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

La entidad central del producto **no es un pedido de e-commerce (`Order`)**. CargoMesh trabaja con una **solicitud de transporte de carga (`FreightRequest`)**: una empresa expresa qué carga necesita mover, desde dónde, hacia dónde, cuándo debe llegar y bajo qué restricciones o preferencias.

Ejemplo:

```text
FreightRequest FR-1042

Organization:
ACME Mining

Origin:
Lima, Peru

Destination:
Santiago, Chile

Cargo:
8 tons

Cargo type:
General Cargo

Required pickup:
31 Aug, 08:00

Delivery deadline:
02 Sep, 18:00

Transport mode:
ROAD

Optimization strategy:
BALANCED
```

CargoMesh no necesita conocer qué producto vendió la empresa ni administrar una compra comercial. Parte de una premisa distinta:

> **La carga ya existe. El problema de CargoMesh es encontrar y coordinar cómo transportarla.**

El agente utiliza WebMCP para descubrir y consultar capacidades de proveedores logísticos, obtener ofertas vigentes y validar restricciones. Después combina esta información con contexto histórico, preferencias autorizadas del cliente y reglas de negocio para seleccionar una alternativa de manera explicable.

> **El cliente expresa la intención logística. CargoMesh resuelve la complejidad operacional.**

## Contrato funcional congelado

```text
Freight Request
      ↓
Interpret intent
      ↓
Retrieve organization/client context
      ↓
Discover carrier capabilities through WebMCP
      ↓
Validate hard constraints
      ↓
Request carrier offers
      ↓
Historical + operational evaluation
      ↓
Heuristic scoring
      ↓
Confidence / policy validation
      ↓
 ┌─────────────┴─────────────┐
 ▼                           ▼
AUTO BOOK              CLARIFY / ESCALATE
```

---

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

El MVP estará orientado a **empresas y PyME con necesidades recurrentes de transporte de carga**.

Una organización puede contener varios usuarios:

```text
Organization
    │
    ├── Logistics Manager
    ├── Operations User
    └── Supervisor
```

La organización puede definir:

- políticas de auto-book;
- presupuesto;
- transportistas permitidos o bloqueados;
- prioridades por costo, rapidez o confiabilidad;
- preferencias frecuentes;
- límites de riesgo;
- contexto histórico de operaciones.

Para la hackathon no se requiere construir un sistema empresarial complejo de RBAC. La estructura debe estar prevista en el dominio, aunque la autenticación pueda mantenerse simple.

## 4.2 User / Shipper

Persona autorizada dentro de una organización —o, a futuro, un sistema externo— que crea una `FreightRequest`.

Puede indicar:

- origen;
- destino;
- peso;
- volumen opcional;
- tipo de carga;
- fecha de recojo;
- deadline;
- tiempo máximo de espera;
- presupuesto máximo;
- modo de transporte;
- estrategia de optimización;
- requisitos especiales;
- preferencia de transportista;
- preferencia de vehículo o marca.

## 4.3 CargoMesh Agent

Responsable de:

- interpretar la intención;
- detectar información faltante;
- consultar contexto autorizado del cliente;
- descubrir proveedores;
- validar cobertura;
- validar capacidad;
- solicitar ofertas;
- consultar desempeño histórico;
- evaluar candidatos;
- explicar decisiones;
- reservar automáticamente o escalar.

## 4.4 Carrier / Proveedor logístico

Empresa que ofrece capacidad de transporte y expone capacidades operativas mediante una aplicación web compatible con WebMCP.

Ejemplos demo:

- Andes Freight;
- Pacific Cargo;
- Inca Logistics.

CargoMesh opera principalmente sobre **ofertas de capacidad del carrier**, no sobre la administración interna completa de su flota.

## 4.5 Supervisor de excepciones

No asigna operaciones rutinarias.

Interviene cuando:

- ninguna alternativa satisface restricciones obligatorias;
- la cotización es anómala;
- la confianza es baja;
- el envío es crítico;
- existe una preferencia contradictoria;
- una decisión supera una política empresarial;
- una reasignación tiene impacto significativo.

La filosofía es:

```text
Routine decisions → Agent
Uncertain / risky decisions → Human
```

---

# 4.6 Dominio internacional y multimodal

CargoMesh se diseña como una plataforma de **freight orchestration**, no como un sistema exclusivo de camiones.

El dominio debe admitir:

```text
TransportMode

ROAD
AIR
SEA
RAIL
```

### MVP de la hackathon

```text
ROAD ✅
AIR  → Future
SEA  → Future
RAIL → Future
```

El MVP demostrará transporte terrestre, pero las entidades principales no deben quedar acopladas exclusivamente a camiones.

## Internacionalización

Una `FreightRequest` puede expresar:

```text
origin_country
origin_city

destination_country
destination_city

currency

transport_mode
```

Y un carrier puede declarar corredores o regiones soportadas:

```text
Peru → Peru
Peru → Chile
Peru → Bolivia
```

La consulta conceptual:

```text
check_service_coverage(
    origin="Lima, Peru",
    destination="Santiago, Chile",
    transport_mode="ROAD"
)
```

permite verificar si el proveedor puede atender la operación.

### Fuera de alcance del MVP internacional

CargoMesh puede modelar una ruta internacional sin implementar todavía:

- aduanas;
- aranceles;
- documentación de importación/exportación;
- permisos fronterizos;
- agentes aduaneros;
- seguros internacionales;
- clasificación de mercancías restringidas.

Estos procesos se abstraen en la demo para mantener el foco en WebMCP.

## Futuro multimodal

La misma `FreightRequest` podría resolverse mediante uno o varios modos:

```text
Warehouse
   │
   │ ROAD
   ▼
Port of Callao
   │
   │ SEA
   ▼
Rotterdam
   │
   │ ROAD
   ▼
Destination
```

La evolución futura de CargoMesh sería pasar de:

```text
Select the best carrier offer
```

a:

```text
Build the best multimodal transport plan
```

sin cambiar la intención principal del cliente.

---

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
Lima, Peru → Arequipa, Peru

12 envíos anteriores
9 con Andes Freight
8 entregados sin retrasos
promedio pagado: $748
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
"Necesito llevar 8 toneladas de Lima a Arequipa mañana."
```

El agente transforma esto en un objeto operacional:

```text
FreightRequest

origin: Lima
destination: Arequipa
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

La evaluación se divide en:

```text
1. HARD CONSTRAINTS
2. SOFT SCORING
```

---

## 8.1 Hard constraints — Elegibilidad

Un proveedor/unidad queda eliminado si incumple una condición obligatoria.

Ejemplos:

```text
coverage(origin, destination) == true
transport_mode_supported == true
cargo_category_supported == true
capacity_kg >= freight_request.cargo_weight_kg
available_at <= pickup_deadline
refrigeration_requirement_satisfied == true
hazardous_requirement_satisfied == true
fragile_handling_requirement_satisfied == true
oversized_requirement_satisfied == true
carrier.status == ACTIVE
```

Opcional:

```text
vehicle_type_required
special_handling_supported
insurance_required
```

### Resultado

```text
5 proveedores descubiertos
        ↓
3 elegibles
        ↓
2 eliminados por restricciones duras
```

---

## 8.2 Soft scoring — Función heurística

Los candidatos elegibles reciben una puntuación.

### Variables iniciales

- competitividad de precio;
- confiabilidad histórica;
- cumplimiento de ETA/SLA;
- disponibilidad;
- experiencia en la ruta;
- afinidad con preferencias del cliente;
- experiencia histórica cliente–proveedor;
- riesgo de cancelación.

### Función conceptual

```text
SCORE =
    w_cost        * cost_score
  + w_reliability * reliability_score
  + w_eta         * eta_score
  + w_availability* availability_score
  + w_route       * route_experience_score
  + w_preference  * preference_fit_score
  + w_history     * client_history_score
  - penalties
```

Cada componente se normaliza inicialmente en un rango 0–100.

La fórmula debe permanecer simple, reproducible y explicable durante la hackathon.

---

# 9. Políticas heurísticas dinámicas

Los pesos cambian según la intención del cliente.

## 9.1 Balanced

Ejemplo inicial:

```text
Cost             25%
Reliability      25%
ETA / SLA        20%
Availability     10%
Route Experience 10%
Preference Fit    5%
Client History    5%
```

## 9.2 Lowest Cost

```text
Cost             50%
Reliability      15%
ETA              10%
Availability     10%
Route Experience  5%
Preference Fit    5%
Client History    5%
```

## 9.3 Most Reliable

```text
Reliability      45%
Route Experience 15%
Client History   15%
ETA              10%
Availability      5%
Cost              5%
Preference Fit    5%
```

## 9.4 Fastest

```text
ETA              50%
Availability     20%
Reliability      15%
Route Experience  5%
Cost              5%
Preference Fit    5%
```

## 9.5 Custom

El cliente puede especificar una prioridad textual:

> "Necesito confiabilidad, pero no quiero pagar más de $850."

El sistema interpreta:

```text
Hard constraint:
price <= $850

Soft policy:
Most Reliable
```

---

# 10. Comparación contra históricos

Una de las partes más importantes para evitar que CargoMesh sea solo un filtro será comparar cada oferta con contexto histórico.

## Ejemplo

Ruta:

```text
Lima, Peru → Arequipa, Peru
8 toneladas
```

Proveedor actual:

```text
Pacific Cargo
Quote actual: $890
Promedio histórico: $690
```

CargoMesh puede detectar:

```text
price_deviation = +28.9%
```

Esto genera una penalización o una excepción.

### Otros históricos

```text
success_rate
avg_delay_hours
cancellation_rate
completed_freight_requests
route_completed_freight_requests
average_route_cost
```

---

# 11. Confianza y niveles de autonomía

No todas las decisiones deben tratarse igual.

CargoMesh tendrá un concepto de **decision confidence**.

## 11.1 Alta confianza

Ejemplo:

```text
Top candidate score: 91
Second candidate:     77
All hard rules:       PASS
Price anomaly:        NO
Reliability:          96%
```

Resultado:

```text
AUTO-BOOK
```

## 11.2 Confianza media

```text
Top score:     82
Second score:  80
```

Opciones muy similares.

Resultado:

```text
ASK CLIENT / PRESENT TOP 2
```

## 11.3 Baja confianza / excepción

Ejemplo:

```text
No provider meets requested SLA
```

o:

```text
Cheapest valid quote is 55% above historical average
```

Resultado:

```text
ESCALATE
```

---

# 12. Modelo de autonomía configurable

Esto puede convertirse en una característica muy fuerte de producto.

## Assisted

```text
Agent evaluates
→ recommends
→ client confirms
```

## Smart Auto

```text
Agent evaluates
→ auto-books if confidence >= threshold
→ asks only on exception
```

## Enterprise Policy

```text
Auto-book only if:

price <= budget
reliability >= 90%
confidence >= 85
no policy violations
```

El MVP debe implementar **Smart Auto** con reglas simples.

---

# 13. WebMCP — contrato de capacidades

WebMCP funciona como la interfaz que hace a las aplicaciones logísticas **descubribles y accionables por agentes**.

El agente toma decisiones; WebMCP permite consultar y ejecutar capacidades reales sobre las aplicaciones participantes.

---

## 13.1 Tools del proveedor / Carrier Web App

Cada carrier debería exponer un contrato conceptual equivalente, aunque su implementación interna sea diferente.

### `check_service_coverage`

```text
INPUT
origin
destination
transport_mode
cargo_category
service_type

OUTPUT
supported
service_notes
```

### `check_capacity`

```text
INPUT
origin
destination
transport_mode
cargo_weight_kg
cargo_volume_m3
cargo_category
requires_refrigeration
is_hazardous
is_fragile
is_oversized
required_pickup

OUTPUT
available
available_capacity
earliest_pickup
```

### `quote_freight`

```text
INPUT
freight_request_id
origin
destination
cargo_weight_kg
cargo_volume_m3
cargo_category
service_type
requires_refrigeration
is_hazardous
is_fragile
is_oversized
required_pickup
delivery_deadline

OUTPUT
offer_id
price
currency
estimated_pickup
estimated_delivery
capacity
valid_until
```

### `book_freight`

```text
INPUT
freight_request_id
offer_id

OUTPUT
booking_id
booking_status
provider_reference
```

Efecto:

```text
CarrierOffer → ACCEPTED
FreightRequest → BOOKED
Booking → CONFIRMED
```

Esta tool es transaccional y debe respetar la política de autonomía de CargoMesh.

### `get_booking_status`

```text
INPUT
booking_id

OUTPUT
status
updated_eta
operational_notes
```

---

## 13.2 Tools / capacidades internas de CargoMesh

### `get_organization_context`

Obtiene políticas y preferencias autorizadas de la empresa.

### `get_freight_request`

Obtiene la intención logística normalizada.

### `get_carrier_metrics`

Consulta histórico relevante del proveedor:

```text
route experience
success rate
average delay
historical average cost
cancellation rate
client-specific history
```

### `evaluate_offers`

Aplica:

```text
hard constraints
optimization strategy
heuristic scoring
business policy
confidence
```

Devuelve una decisión explicable.

### `record_decision`

Persiste el ranking, la oferta seleccionada y la razón.

### `flag_for_review`

Crea una excepción cuando CargoMesh no debería ejecutar automáticamente.

---

# 14. Arquitectura conceptual

```text
                     ┌──────────────────────┐
                     │ Organization / User  │
                     └──────────┬───────────┘
                                │
                        FreightRequest
                                │
                                ▼
                     ┌──────────────────────┐
                     │    CargoMesh Web     │
                     └──────────┬───────────┘
                                │
                                ▼
                     ┌──────────────────────┐
                     │      AI Agent        │
                     └──────────┬───────────┘
                                │
                   WebMCP discovery/actions
               ┌────────────────┼────────────────┐
               ▼                ▼                ▼
        ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
        │ Andes Web   │  │Pacific Web  │  │ Inca Web    │
        │ Carrier     │  │ Carrier     │  │ Carrier     │
        │ WebMCP      │  │ WebMCP      │  │ WebMCP      │
        └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
               │                │                │
               └──────────────offers────────────┘
                                │
                                ▼
                     ┌──────────────────────┐
                     │ Heuristic + Policies│
                     │ + Historical Context│
                     └──────────┬───────────┘
                                │
                       score + confidence
                                │
                   ┌────────────┴────────────┐
                   ▼                         ▼
               AUTO BOOK               CLARIFY /
                   │                    ESCALATE
                   ▼                         ▼
               Booking                  Supervisor
```

La arquitectura del dominio es **transport-mode agnostic**. En el MVP todos los providers demo ofrecen `ROAD`.

---

# 15. Cómo simular múltiples proveedores sin construir tres productos completos

Para el MVP se puede utilizar una sola codebase:

```text
/app
  /client
  /cargomesh
  /providers
      /andes
      /pacific
      /inca
```

Cada provider registra el mismo contrato conceptual WebMCP pero responde con:

- cobertura diferente;
- capacidad diferente;
- ofertas diferentes;
- métricas históricas diferentes.

Esto demuestra aplicaciones/proveedores independientes desde el punto de vista del agente sin construir tres plataformas empresariales completas.

Si sobra tiempo, P2 puede separar providers en despliegues/origins diferentes.

---

# 16. Modelo de datos v4 — Freight, cargo compatibility & provider capacity

No existe una entidad `orders` en el núcleo.

La entidad raíz es:

```text
freight_requests
```

---

## 16.1 `organizations`

```text
id
name
code
status
default_currency
created_at
```

## 16.2 `users`

Simplificado para el MVP.

```text
id
organization_id
name
email
role
status
```

## 16.3 `organization_preferences`

```text
id
organization_id
default_optimization_strategy
max_pickup_wait_hours
preferred_carrier_id
preferred_vehicle_brand
budget_default
allow_auto_booking
confidence_threshold
```

## 16.4 `cargo_categories`

Catálogo controlado.

```text
id
code
name
description
active
```

Seed inicial:

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

## 16.5 `freight_requests`

```text
id
organization_id
requested_by_user_id
cargo_category_id
code

origin_country
origin_city

destination_country
destination_city

cargo_weight_kg
cargo_volume_m3
package_count

service_type
transport_mode

requires_refrigeration
temperature_min_c
temperature_max_c

is_hazardous
is_fragile
is_oversized
is_high_value
is_stackable

special_instructions

required_pickup
delivery_deadline

budget_max
optimization_strategy

status
created_at
```

`service_type`:

```text
FTL
LTL
```

MVP:

```text
FTL
```

`transport_mode`:

```text
ROAD
AIR
SEA
RAIL
```

MVP:

```text
ROAD
```

## 16.6 `carriers`

```text
id
name
code
provider_type
status
created_at
```

`provider_type`:

```text
OWNER_OPERATOR
SMALL_FLEET
CARRIER
ENTERPRISE_CARRIER
```

## 16.7 `carrier_services`

Representa capacidad logística y cobertura.

```text
id
carrier_id

transport_mode
service_type

origin_country
origin_region
destination_country
destination_region

max_capacity_kg
max_volume_m3

supports_refrigerated
temperature_min_c
temperature_max_c

supports_hazardous
supports_fragile
supports_oversized

active
```

## 16.8 `carrier_service_cargo_categories`

Relación N:M entre un servicio y las categorías que acepta.

```text
carrier_service_id
cargo_category_id
```

Así evitamos almacenar categorías separadas por comas o JSON sin control.

## 16.9 `vehicles` — ROAD-specific / opcional

No es la entidad central de CargoMesh.

```text
id
carrier_id
code
brand
vehicle_type
capacity_kg
volume_m3

supports_refrigerated
supports_hazardous
supports_oversized

location
status
```

El carrier puede seleccionar internamente la unidad después de aceptar el booking.

## 16.10 `carrier_metrics`

```text
id
carrier_id
cargo_category_id

transport_mode

origin_country
origin_city
destination_country
destination_city

completed_freight_requests
successful_freight_requests
success_rate

avg_cost
avg_delay_hours
cancellation_rate

updated_at
```

Las métricas pueden ser específicas al corredor y opcionalmente a la categoría de carga.

## 16.11 `carrier_offers`

CargoMesh compara **ofertas logísticas**, no únicamente camiones.

```text
id
freight_request_id
carrier_id
vehicle_id

offer_reference

transport_mode
service_type

price
currency

estimated_pickup
estimated_delivery

available_capacity_kg
available_volume_m3
valid_until

compatibility_status
compatibility_notes

status
created_at
```

`vehicle_id` puede ser `NULL` cuando el proveedor confirma capacidad pero decide la unidad física posteriormente.

## 16.12 `freight_decisions`

Clave para explainability.

```text
id
freight_request_id
selected_offer_id

optimization_strategy
heuristic_score
confidence_score

decision_reason
candidate_snapshot

requires_review
created_at
```

`candidate_snapshot` puede almacenarse como JSONB para preservar el ranking utilizado por la demo.

## 16.13 `bookings`

```text
id
freight_request_id
carrier_id
offer_id

provider_reference

status
booked_at
```

---

# 17. Estados principales

## FreightRequest

```text
DRAFT
  ↓
PENDING
  ↓
EVALUATING
  ↓
BOOKED
  ↓
IN_TRANSIT
  ↓
DELIVERED
```

Excepciones:

```text
EVALUATING
   ↓
REVIEW_REQUIRED
```

y:

```text
BOOKED / IN_TRANSIT
   ↓
DISRUPTED
   ↓
REBOOKED
```

## CarrierOffer

```text
QUOTED
  ↓
SELECTED
  ↓
ACCEPTED
```

Alternativas:

```text
QUOTED → REJECTED
QUOTED → EXPIRED
```

## Booking

```text
PENDING
  ↓
CONFIRMED
  ↓
IN_TRANSIT
  ↓
COMPLETED
```

Excepciones:

```text
CONFIRMED → DISRUPTED
DISRUPTED → REBOOKED
```

---

# 18. Golden Flow 1 — Autonomous Freight Orchestration

## Freight Request

```text
Client: ACME
FreightRequest: FR-1042
Origin: Lima
Destination: Arequipa
Weight: 8t
Pickup: tomorrow
Policy: Balanced
Maximum pickup wait: 2h
```

## Paso 1 — Agente valida request

```text
required fields: PASS
```

## Paso 2 — Recupera contexto del cliente

```text
get_organization_context(ACME)
```

Resultado ejemplo:

```text
preferred_carrier: none
usual_budget: $700–$850
frequent_route: Lima, Peru → Arequipa, Peru
allow_auto_booking: true
```

## Paso 3 — Descubre y consulta proveedores

Por cada carrier:

```text
check_service_coverage()
check_capacity()
quote_freight()
```

## Paso 4 — Obtiene métricas históricas

```text
get_carrier_metrics()
```

## Paso 5 — Hard filtering

```text
Pacific   PASS
Andes     PASS
Inca      PASS
```

## Paso 6 — Heuristic scoring

Ejemplo:

```text
Pacific Cargo
Price:          $690
Success rate:   86%
Avg delay:      3.4h
Availability:   1
Route history:  13
Score:          72

Andes Freight
Price:          $760
Success rate:   96%
Avg delay:      1.2h
Availability:   4
Route history:  42
Score:          89

Inca Logistics
Price:          $820
Success rate:   98%
Avg delay:      0.8h
Availability:   3
Route history:  35
Score:          84
```

## Paso 7 — Confidence

```text
Winner: Andes Freight
Score: 89
Second: 84
Confidence: 88%
Policy violations: none
```

## Paso 8 — Auto-book

```text
book_freight()
```

## Paso 9 — Explicación visible

```text
ASSIGNED — Andes Freight

Why?
• 96% successful deliveries
• strong Lima–Arequipa route history
• 4 available units
• quote inside client's historical budget range
• estimated delivery satisfies deadline
```

---

# 19. Golden Flow 2 — Preference negotiation

El objetivo es mostrar que el agente no solo filtra.

## Organization

```text
"Necesito enviar 8t a Arequipa mañana.
Prefiero un Volvo y máximo $800."
```

## Resultado de búsqueda

```text
No Volvo available under $800.
```

El agente identifica que `Volvo` es una preferencia blanda.

Busca alternativas equivalentes.

```text
Andes Freight
Scania R-series
12t
$760
96% success rate
```

Respuesta:

> No encontré una unidad Volvo que cumpla tu presupuesto y horario. Andes Freight tiene una unidad Scania de capacidad equivalente por $760 y cumple el plazo. ¿Mantengo Volvo como requisito obligatorio o autorizas la alternativa?

El cliente responde:

```text
"La alternativa está bien."
```

CargoMesh continúa automáticamente.

---

# 20. Golden Flow 3 — Disruption Recovery

Una asignación existente entra en incidente.

```text
booking status → BREAKDOWN
```

CargoMesh:

```text
1. detect incident
2. retrieve freight request constraints
3. preserve client preferences
4. re-query carriers
5. evaluate replacement quotes
6. calculate cost/ETA delta
7. reassign automatically if policy permits
```

Ejemplo:

```text
Original:
Andes Freight
$760
ETA 16h

Replacement:
Inca Logistics
$820
ETA 14h

Delta:
+$60
-2h
Confidence: 92%
```

Si la política admite un aumento <= $100:

```text
AUTO REASSIGN
```

Si no:

```text
PENDING_REVIEW
```

---

# 21. UI propuesta

No crear un ERP gigante.

## 21.1 Cliente — Request

Una pantalla tipo marketplace/delivery:

```text
From
To
Cargo weight
Pickup date
Deadline
Budget
Optimization mode
Preferences

[ Find transport ]
```

## 21.2 Cliente — Smart Dispatch Status

```text
Analyzing request
✓ Validating route
✓ Discovering providers
✓ Collecting quotes
✓ Checking historical performance
✓ Evaluating policies
✓ Booking provider
```

## 21.3 Resultado

```text
Transport assigned

Andes Freight
$760
ETA 16h
Confidence 88%

Why this provider?
[explanation]
```

## 21.4 Supervisor — Exception Queue

Solo P1.

```text
FreightRequest
Reason
Best options
Policy violation
Required action
```

## 21.5 Provider Demo Pages

Tres páginas mínimas que representen providers y expongan tools WebMCP.

---

# 22. Elementos de innovación

## 22.1 Intent-driven freight orchestration

El usuario no busca transportistas uno por uno.

Expresa un resultado:

```text
"Move 8 tons from Lima to Santiago
before Friday, prioritizing reliability."
```

CargoMesh transforma esa intención en una operación logística.

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

## 22.9 Multimodal-ready domain

El MVP utiliza `ROAD`, pero el contrato de dominio admite:

```text
ROAD
AIR
SEA
RAIL
```

Esto permite evolucionar desde selección de ofertas de carretera hacia construcción de planes multimodales.

## 22.10 Capacity utilization / empty-mile opportunity — futuro

CargoMesh puede generar valor también para carriers.

Ejemplo:

```text
Truck:
Lima, Peru → Arequipa, Peru  FULL
Arequipa → Lima EMPTY
```

Una `FreightRequest` compatible:

```text
Arequipa → Lima
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

> Si hubieras seleccionado “Lowest Cost”, Pacific Cargo habría sido elegido por $690, pero con un historial de retraso promedio superior.

Esto demuestra que la política realmente cambia la decisión.

## 23.2 Quote anomaly guard

```text
current quote > historical avg * 1.30
→ require review
```

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
- aduanas, aranceles y documentación fronteriza;
- marketplace financiero;
- chat interno;
- autenticación empresarial compleja;
- mapas avanzados antes de completar WebMCP.

---

# 25. MVP v4

## P0 — obligatorio

### Organization / Organization

- crear una `FreightRequest`;
- definir origen, destino, peso y deadline;
- seleccionar estrategia de optimización;
- agregar al menos una preferencia opcional;
- ver resultado y explicación;
- trabajar únicamente con `ROAD` en la demo.

### Datos

- organizations;
- users;
- organization_preferences;
- cargo_categories;
- freight_requests;
- carriers;
- carrier_services;
- carrier_service_cargo_categories;
- carrier_metrics;
- carrier_offers;
- freight_decisions;
- bookings;
- vehicles opcional para enriquecer la demo ROAD.

### WebMCP

Provider tools mínimas:

```text
check_service_coverage
check_capacity
quote_freight
book_freight
```

CargoMesh:

```text
get_organization_context
get_freight_request
get_carrier_metrics
evaluate_offers
record_decision
```

### Decision Engine

- hard constraints;
- `Balanced`;
- heuristic scoring;
- confidence;
- auto-book policy;
- explicación de la decisión.

### Demo P0

```text
FreightRequest
→ Discover
→ Validate
→ Request Offers
→ Historical Context
→ Score
→ Explain
→ Auto-book
```

---

## P1 — diferenciador

- `Lowest Cost`, `Fastest` y `Most Reliable`;
- preference relaxation;
- preferred carrier;
- preferred truck brand + alternative suggestion;
- vehicle-level matching;
- price anomaly detection;
- supervisor exception queue;
- disruption recovery;
- rebooking.

---

## P2 — solo si sobra tiempo

- counterfactual explanation;
- provider diversity;
- richer historical learning;
- maps;
- live simulation;
- multiple provider deployments/origins;
- custom weight editor;
- AIR / SEA / RAIL providers simulados;
- multimodal transport-plan prototype;
- LTL / multi-load consolidation;
- capacity sharing;
- empty-mile matching.

---

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
    └── seed.sql
```

---

# 27. Seed demo determinista — ROAD freight

No usar datos aleatorios para la demo.

## Organization

```text
ACME Mining
Policy: Balanced
Auto-book: true
Confidence threshold: 85
Usual budget Lima→Arequipa: $700–$850
```

## FreightRequest

```text
FR-1042
Lima, Peru → Arequipa, Peru
Category: GENERAL
Service: FTL
Mode: ROAD
Weight: 8,000 kg
Volume: 18 m³
Refrigeration: NO
Hazardous: NO
Fragile: NO
Oversized: NO
Stackable: YES
Pickup: tomorrow
Max wait: 2h
```

## Candidates

```text
Pacific Cargo
Quote: $690
Success: 86%
Avg delay: 3.4h
Available units: 1
Route jobs: 13
```

```text
Andes Freight
Quote: $760
Success: 96%
Avg delay: 1.2h
Available units: 4
Route jobs: 42
```

```text
Inca Logistics
Quote: $820
Success: 98%
Avg delay: 0.8h
Available units: 3
Route jobs: 35
```

Resultado Balanced esperado:

```text
Andes Freight
```

Esto permite crear tests reproducibles.

---

# 28. Product Contract Freeze

A partir de esta versión, el concepto base se considera **congelado para iniciar implementación**.

## Definición en español

> **CargoMesh es una plataforma B2B de orquestación agent-native de transporte de carga. Las empresas crean solicitudes de transporte describiendo qué carga necesitan mover, origen, destino, plazo y preferencias operativas. CargoMesh utiliza agentes y WebMCP para descubrir proveedores logísticos compatibles, obtener ofertas actuales, combinar esas ofertas con contexto histórico y políticas del cliente, evaluar alternativas mediante heurísticas transparentes y reservar automáticamente cuando la confianza y las reglas de negocio lo permiten. El MVP se concentra en transporte terrestre, pero el modelo de dominio está preparado para evolucionar hacia transporte aéreo, marítimo, ferroviario y orquestación multimodal.**

## Canonical English definition

> **CargoMesh is an agent-native freight orchestration platform. Businesses submit freight requests describing what must be transported, where it must go, when it must arrive, and their operational preferences. CargoMesh uses AI agents and WebMCP to discover compatible logistics providers, obtain current offers, combine them with historical and organization-specific context, evaluate candidates using transparent business heuristics, and autonomously book the best option when confidence and policy requirements are satisfied. The hackathon MVP focuses on road freight, while the domain model is designed to support future air, sea and rail transportation and multimodal logistics.**

## Qué NO cambia sin un bloqueo técnico real

```text
Domain root      = FreightRequest
Primary market   = B2B organizations
MVP mode         = ROAD
Agent role       = discover + validate + evaluate + orchestrate
WebMCP role      = expose actionable web capabilities
Decision model   = hard constraints + heuristic + confidence
Normal flow      = autonomous booking
Human role       = exception / uncertainty supervision
Future scope     = AIR / SEA / RAIL + multimodal
Cargo model       = catalog + explicit logistics requirements
MVP service type  = FTL
Provider spectrum = owner-operator → enterprise carrier
```

---

# 29. Roles del equipo v4


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

# 30. Roadmap recalibrado — implementación

## Día 0 — Contract freeze + setup

- [ ] aprobar este v4;
- [ ] congelar actores;
- [ ] congelar Golden Flow 1;
- [ ] definir hard constraints;
- [ ] definir Balanced heuristic;
- [ ] definir provider tool schemas;
- [ ] definir schema Supabase;
- [ ] asignar roles.

## Día 1 — Vertical slice mínimo

Objetivo:

```text
FreightRequest
→ Provider tool
→ Offer
→ Score
→ Result
```

- [ ] Next.js iniciado;
- [ ] Supabase iniciado;
- [ ] seed cargado;
- [ ] un provider WebMCP funcional;
- [ ] `quote_freight` funcionando;
- [ ] Balanced scoring funcionando;
- [ ] resultado visible.

## Día 2 — Multi-provider + Auto-book

- [ ] 3 providers simulados;
- [ ] coverage;
- [ ] capacity;
- [ ] quotes;
- [ ] metrics;
- [ ] scoring;
- [ ] confidence;
- [ ] `book_freight`;
- [ ] DB cambia a BOOKED.

## Día 3 — Preference intelligence

- [ ] explicit preferences;
- [ ] client context;
- [ ] flexible preference handling;
- [ ] explanation;
- [ ] price anomaly guard.

Si P0 está perfecto:

- [ ] disruption recovery.

## Día 4 — UX + deploy

- [ ] Vercel;
- [ ] external test;
- [ ] error states;
- [ ] loading states;
- [ ] deterministic reset;
- [ ] polish.

## Día 5 — Submission

- [ ] README;
- [ ] architecture;
- [ ] description;
- [ ] screenshots;
- [ ] demo script;
- [ ] video rehearsal.

## Día 6 — Video + buffer

- [ ] final recording;
- [ ] YouTube;
- [ ] Devpost;
- [ ] test links;
- [ ] submit early.

---

# 31. Definition of Done

Una funcionalidad solo está terminada cuando cumple:

```text
Human / client intent
        ↓
Agent interprets
        ↓
WebMCP discovers or executes capability
        ↓
Operational data returned
        ↓
Policy / heuristic evaluated
        ↓
Decision explained
        ↓
Real DB state change (when applicable)
        ↓
Visible client result
```

---

# 32. Acceptance Test principal

Dado:

```text
FR-1042
Lima, Peru → Arequipa, Peru
8t
Balanced
```

Cuando CargoMesh lo procesa:

1. descubre mínimo 3 carriers;
2. elimina candidatos inválidos;
3. obtiene quotes;
4. consulta métricas históricas;
5. calcula score;
6. selecciona Andes Freight;
7. produce explicación;
8. confidence supera threshold;
9. ejecuta booking vía WebMCP;
10. booking queda persistido;
11. la `FreightRequest` queda en `BOOKED`;
12. el cliente ve el resultado y su explicación.

Si cualquiera de esos puntos falla, el Golden Flow P0 no está completo.

---

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

# 34. Decisiones congeladas y pendientes

## Congeladas

```text
Domain root              = FreightRequest
Primary market           = B2B
MVP transport mode       = ROAD
MVP service type         = FTL
Cargo model              = cargo category + explicit requirements
Cargo catalog            = controlled catalog
Provider types           = owner-operator → enterprise carrier
Carrier selection unit   = CarrierOffer
Balanced                 = P0
Vehicle brand preference = P1
LTL consolidation        = P2 / Future
```

## Pendientes de implementación, no de producto

- [ ] confidence threshold inicial definitivo;
- [ ] fórmula determinista de `quote_freight`;
- [ ] regla exacta de price anomaly;
- [ ] si `vehicles` entra en el primer Golden Flow o después de cerrar booking a nivel carrier;
- [ ] si Disruption Recovery entra antes o después de Preference Intelligence.

Recomendación inicial:

```text
confidence threshold = 85
single app / multiple provider routes
price anomaly = +30% vs historical route average
booking first at carrier-offer level
vehicle matching = P1
```

---

# 35. Próximo paso inmediato

No crear todavía veinte tablas ni pantallas.

Orden exacto:

```text
1. Aprobar v4
2. Crear Supabase
3. Crear schema mínimo
4. Cargar seed determinista
5. Implementar 1 provider WebMCP
6. Crear quote_freight
7. Crear Balanced heuristic
8. Mostrar score y explicación
9. Repetir para 3 providers
10. Auto-book
```

El primer milestone real será:

```text
FR-1042
   ↓
CargoMesh Agent
   ↓
WebMCP Provider Tool
   ↓
Quote
   ↓
Historical Metrics
   ↓
Heuristic Score
   ↓
Explainable Winner
```

Cuando eso funcione, el núcleo de CargoMesh v2 estará validado.

---

# 36. Regla final contra scope creep

Antes de implementar cualquier nueva feature, preguntar:

> **¿Esta funcionalidad demuestra mejor que WebMCP permite que un agente convierta la intención del cliente en una operación logística autónoma, explicable y ejecutable?**

Si la respuesta es **no**, no es prioridad para esta hackathon.
