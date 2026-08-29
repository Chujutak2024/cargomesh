# CargoMesh — Ajustes de Mockups para Evidencia WebMCP

> **Estado:** definición de ajustes, sin modificar todavía los mockups existentes.  
> **Fuente de verdad:** `CargoMesh_Planeacion_WebMCP_FINAL.md` v5.5.0.  
> **Objetivo:** conservar la UX B2B actual y hacer visible ante el jurado la causalidad real de WebMCP.

## 1. Decisión de diseño

La arquitectura consolidada de ocho pantallas principales, modales contextuales, tres páginas provider y un panel técnico es válida. No se requiere un rediseño general.

El trabajo pendiente consiste en agregar estados y evidencia técnica para que la demo no pueda confundirse con un comparador de ofertas precargadas.

## 2. Ajustes P0

### 2.1 Dispatch reactivo

La misma vista `/dispatch/[id]` debe representar dos estados reales:

1. `EVALUATING`: navegación y consultas provider en curso.
2. `OPTIONS_READY`: tres ofertas persistidas, decisión calculada y espera de selección humana.

Durante `EVALUATING`, cada provider debe progresar por:

```text
PENDING
→ NAVIGATING
→ COVERAGE_CHECKED
→ CAPACITY_CHECKED
→ QUOTED
→ RECORDED
```

Las cards finales no deben aparecer hasta que exista una `FreightDecision` runtime.

### 2.2 Judge Activity Drawer universal

El Judge Drawer debe ser un overlay accesible sobre todas las pantallas del Golden Flow, no una página independiente.

Debe leer `orchestration_runs` y `orchestration_events` reales y mostrar, como mínimo:

```text
timestamp
run_id / run_type
event_type
provider_url
provider / carrier
tool_name
tool_call_id
input
output
status
duration_ms
persisted_entity_type
persisted_entity_id
```

### 2.3 Cadena causal visible

El stream debe distinguir explícitamente:

```text
Agent navigation
Provider WebMCP tool execution
CargoMesh result validation
Runtime persistence
Decision Engine evaluation
Commercial state transition
```

Secuencia canónica:

```text
RUN_CREATED
→ NAVIGATE_PROVIDER
→ check_service_coverage
→ check_capacity
→ quote_freight
→ record_provider_result
→ CARRIER_OFFER_CREATED
→ evaluate_offers
→ FREIGHT_DECISION_CREATED
→ OPTIONS_READY
```

### 2.4 Provider pages

Las rutas `/providers/andes`, `/providers/inca` y `/providers/pacific` deben registrar tools WebMCP ejecutables. Mostrar el código como texto puede complementar la evidencia, pero no sustituye el registro real mediante `document.modelContext.registerTool`.

Cada página provider debe incluir una declaración visible:

> Deterministic demo fixture. Tool execution and structured result transfer are real.

### 2.5 Booking limpio

Eliminar del cliente cualquier CTA como `Simular Confirmación`.

La transición a tracking ocurre únicamente después de:

```text
get_provider_booking_status
→ provider_booking_status = CONFIRMED
→ booking/event persistence
→ FreightRequest = BOOKED
```

Los controles `ACCEPT`, `REJECT` y `NO_RESPONSE` pertenecen exclusivamente al Judge Drawer y solo configuran la próxima respuesta del provider.

### 2.6 Recovery completo

El escenario de rechazo debe ejecutar:

```text
Andes REJECTED
→ booking event persisted
→ RECOVERY_REQUIRED
→ Recovery orchestration_run
→ fresh provider checks
→ refreshed CarrierOffers
→ FreightDecision v2
→ human selects Inca
→ second book_freight
→ PENDING_PROVIDER_CONFIRMATION
```

No se permite saltar directamente de la selección del reemplazo a tracking.

## 3. Correcciones de consistencia

- Mostrar FR-1042 como `PENDING` o `READY_TO_ORCHESTRATE` antes de iniciar la corrida; evitar `CONFIRMED`, que se confunde con confirmación provider.
- Usar los roles congelados `OWNER`, `REQUESTER` y `SUPERVISOR`.
- Hacer que las vistas de booking y tracking respondan realmente al carrier seleccionado.
- Incluir los seis subscores BALANCED: costo, reliability, ETA, availability, route experience y organization history.
- Mantener separados `recommended_offer_id`, `selected_offer_id`, booking request y provider confirmation.
- Incorporar el modal informativo de billing/checkout definido en la arquitectura UX.

## 4. Presentación recomendada para el jurado

La pantalla de cliente y el Judge Drawer deben verse simultáneamente:

```text
┌────────────────────────────────┬──────────────────────────────┐
│ Producto                       │ Evidencia técnica            │
│ Consultando Andes...           │ NAVIGATE /providers/andes    │
│ Oferta Andes recibida          │ quote_freight → $1,760       │
│ Consultando Inca...            │ CarrierOffer INSERTED        │
│ Opciones listas                │ FreightDecision v1 → 89 pts  │
└────────────────────────────────┴──────────────────────────────┘
```

La demo principal debe priorizar:

1. Runtime inicialmente vacío.
2. Orquestación real contra tres provider pages.
3. Persistencia progresiva de resultados.
4. Ranking determinista y explicable.
5. Selección humana y booking pendiente.
6. Confirmación o rechazo seguido de recovery.
