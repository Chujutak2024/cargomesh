# CargoMesh — Supabase Data Contract y Plan de Alineación

> **Proyecto remoto auditado:** `cargomesh` (`tokvzfrefwqobzqgbfoj`)  
> **Fecha de auditoría:** 2026-08-28  
> **Estado:** contrato remoto, modelo B2B, perfiles de carga, Golden Flow canónico y RLS aplicados y verificados.  
> **Fuente de verdad:** `CargoMesh_Planeacion_WebMCP_FINAL.md` v5.5.0.

## 1. Resumen ejecutivo

La conexión directa con Supabase funciona y el proyecto está `ACTIVE_HEALTHY` sobre PostgreSQL 17.

Entre el 2026-08-28 y el 2026-08-29 se aplicaron diez migraciones remotas auditables:

```text
add_cargomesh_identity_and_intent_contract
add_cargomesh_observability_and_booking_events
add_cargomesh_runtime_contract
add_cargomesh_domain_constraints
add_carrier_offers_carrier_fk_index
align_golden_flow_and_reset_runtime
secure_cargomesh_data_api_with_rls
add_organization_cargo_profiles_and_unitized_intake
add_freight_request_org_cargo_profile_fk_index
add_cargo_category_intake_guidance
```

El esquema contiene 17 tablas y los contratos de identidad, perfiles empresariales de carga, intención logística, observabilidad, versionado de decisiones, idempotencia y booking lifecycle. Las 17 tablas tienen RLS habilitado, 22 políticas organization-scoped y cero privilegios de tabla para `anon`.

Las tres ofertas precargadas de FR-1042 fueron eliminadas. La solicitud, organización, perfil de carga, transportistas, servicios, vehículos y métricas corresponden ahora al Golden Flow v5.5.0. Los avisos `unused_index` son informativos y esperables mientras las tablas runtime estén vacías; el Security Advisor no reporta hallazgos.

Todavía no existen usuarios en `auth.users` ni filas en `organization_members`. Por ello el cliente autenticado no verá datos hasta completar signup/onboarding y crear su membresía desde un contexto servidor autorizado.

## 2. Inventario remoto actual

| Tabla | Filas | Clase esperada | Observación |
|---|---:|---|---|
| `organizations` | 1 | Bootstrap | ACME Mining reconciliada |
| `organization_preferences` | 1 | Bootstrap | modo asistido; auto-booking deshabilitado |
| `cargo_categories` | 8 | Bootstrap | orientación dinámica de intake y flota |
| `freight_requests` | 1 | Demo Scenario | FR-1042 existe en `PENDING` |
| `carriers` | 3 | Bootstrap | Andes, Inca y Pacific existen |
| `carrier_services` | 3 | Bootstrap | PE→CL, FTL y cross-border configurados |
| `carrier_service_cargo_categories` | 9 | Bootstrap | incluye Machinery para los tres carriers |
| `carrier_metrics` | 3 | Bootstrap | valores canónicos |
| `vehicles` | 3 | Bootstrap | vehículos canónicos |
| `carrier_offers` | 0 | Runtime | nace de WebMCP |
| `freight_decisions` | 0 | Runtime | nace de orquestación |
| `bookings` | 0 | Runtime | nace tras selección |
| `organization_members` | 0 | Identidad | pendiente de signup/onboarding |
| `organization_cargo_profiles` | 1 | Bootstrap | perfil canónico de ACME Mining |
| `orchestration_runs` | 0 | Runtime | nace de WebMCP |
| `orchestration_events` | 0 | Observabilidad | nace de WebMCP |
| `booking_events` | 0 | Observabilidad | nace del booking lifecycle |

## 3. Tablas incorporadas

Se incorporaron cuatro tablas adicionales:

1. `organization_members`
2. `orchestration_runs`
3. `orchestration_events`
4. `booking_events`

El modelo objetivo queda en 14 tablas de dominio y 2 de observabilidad.

Posteriormente se incorporó `organization_cargo_profiles`, elevando el contrato actual a 15 tablas de dominio y 2 de observabilidad.

## 4. Clasificación canónica de datos

### 4.1 Bootstrap Data

Puede sembrarse porque prepara el escenario:

```text
organizations
organization_members
organization_preferences
organization_cargo_profiles
cargo_categories
carriers
carrier_services
carrier_service_cargo_categories
vehicles
carrier_metrics
```

### 4.2 Demo Scenario

Puede sembrarse únicamente como solicitud inicial:

```text
freight_requests: FR-1042, status = PENDING
```

### 4.3 Provider Fixtures

No pertenecen a tablas comerciales de CargoMesh. Residen en cada provider page o módulo provider:

```text
Andes fixture
Inca fixture
Pacific fixture
```

### 4.4 Runtime Data

Debe comenzar vacío para FR-1042 y nacer por ejecución real:

```text
orchestration_runs
orchestration_events
carrier_offers
freight_decisions
bookings
booking_events
```

## 5. Golden Flow canónico

### Organización y solicitud

```text
Organization: ACME Mining
FreightRequest: FR-1042
Route: Callao/Lima, PE → Santiago, CL
Mode / service: ROAD / FTL
Cargo: 10 pallets × 800 kg = 8,000 kg
Budget: $2,000 USD
Strategy: BALANCED
Organization history fallback: 50
```

### Provider fixtures, no CarrierOffers seed

| Carrier | Vehicle | Capacity | Price | Transit | Reliability | Route operations | Availability |
|---|---|---:|---:|---:|---:|---:|---:|
| Andes Freight | Scania R450 | 18,000 kg | $1,760 | 31 h | 96% | 100 | 90 |
| Inca Logistics | Volvo FH | 24,000 kg | $1,920 | 29 h | 98% | 50 | 90 |
| Pacific Cargo | Freightliner | 15,000 kg | $1,590 | 60 h | 86% | 50 | 60 |

Scores esperados:

```text
Andes   89.2949 → 89
Inca    84.2031 → 84
Pacific 72.1667 → 72
Decision Confidence 88.0188 → 88
```

## 6. Inconsistencias reconciliadas en los datos remotos

### Ofertas precargadas

Las ofertas precargadas eliminadas de FR-1042 eran:

```text
ANDES   $760
INCA    $820
PACIFIC $690
```

Además de tener importes incorrectos, su existencia violaba la regla de causalidad. `carrier_offers` está ahora vacía y el contrato exige `orchestration_run_id`, `tool_call_id`, `provider_offer_reference`, tránsito, disponibilidad y confiabilidad en cada inserción runtime.

### Vehículos

```text
Andes: Scania R450, 18,000 kg
Inca: Volvo FH, 24,000 kg
Pacific: Freightliner Cascadia, 15,000 kg
```

### Métricas

Los conteos quedaron reconciliados a 100/96 para Andes, 50/49 para Inca y 50/43 para Pacific. Los costos medios de ruta son USD 1,732, 1,880 y 1,650 respectivamente.

## 7. Contrato mínimo de las tablas nuevas

### `organization_cargo_profiles`

```text
id uuid PK
organization_id uuid FK
cargo_category_id uuid FK
profile_name text
default_entry_method text
typical quantity / unit weight / dimensions
default_requirements jsonb
preferred_vehicle_classes jsonb
priority smallint
active boolean
unique (organization_id, profile_name)
```

El perfil guarda plantillas habituales de la empresa. No contiene cotizaciones ni reemplaza la consulta WebMCP de capacidad real.

### `organization_members`

```text
id uuid PK
organization_id uuid FK
auth_user_id uuid FK → auth.users
role OWNER | REQUESTER | SUPERVISOR
status ACTIVE | INACTIVE
created_at timestamptz
unique (organization_id, auth_user_id)
```

### `orchestration_runs`

```text
id uuid PK
freight_request_id uuid FK
run_type INITIAL | RECOVERY
status RUNNING | OPTIONS_READY | FAILED | CANCELLED
previous_run_id uuid nullable FK
started_at timestamptz
completed_at timestamptz nullable
created_by_member_id uuid nullable FK
```

### `orchestration_events`

```text
id uuid PK
orchestration_run_id uuid FK
carrier_id uuid nullable FK
provider_url text nullable
event_type text
tool_name text nullable
tool_call_id text nullable UNIQUE
input_payload jsonb nullable
output_payload jsonb nullable
status text
duration_ms int nullable
persisted_entity_type text nullable
persisted_entity_id uuid nullable
created_at timestamptz
```

### `booking_events`

```text
id uuid PK
booking_id uuid FK
provider_event_id text
event_type text
provider_booking_status text nullable
payload jsonb nullable
occurred_at timestamptz
created_at timestamptz
unique (booking_id, provider_event_id)
```

## 8. Evolución mínima de tablas existentes

### `organizations`

Agregar o reconciliar:

```text
legal_name
country_code
business_identifier_type
business_identifier_value
verified_corporate_email
corporate_phone
```

### `organization_preferences`

Agregar:

```text
allow_auto_recovery
anomaly_threshold_pct
billing_mode
restricted / preferred carrier policy as appropriate
```

### `freight_requests`

Agregar los campos necesarios para:

```text
requested_by_member_id
organization cargo profile reference
pickup and delivery addresses
pickup contact
receiver identity and contact
cargo description and entry method
entry quantity, unit weight and per-entry dimensions
normalized weight / volume consistency
cargo specifications JSONB for category-dependent detail
pickup_mode and pickup window
available_documents
cross-border classification
confirmation metadata
security/recovery lifecycle
```

### `carrier_services`

Agregar evidencia explícita de:

```text
cross_border support
customs coordination
supported pickup windows
service/provider page URL correlation
```

### `carrier_offers`

Debe correlacionarse con:

```text
orchestration_run_id
tool_call_id
provider_offer_reference
quote breakdown
transit_hours
availability_class / score
eligibility evidence
supersedes_offer_id for recovery
```

Restricción idempotente mínima:

```text
unique (orchestration_run_id, carrier_id, provider_offer_reference)
```

### `freight_decisions`

Separar:

```text
recommended_offer_id
selected_offer_id
```

Agregar:

```text
orchestration_run_id
decision_version
previous_decision_id
ranking_snapshot
subscores
confidence components
anomaly evidence
selection_mode
selected_by_member_id
selected_at
```

### `bookings`

Agregar:

```text
freight_decision_id
provider_booking_status
idempotency_key
provider_response_deadline
selection_mode
selected_by_member_id
authorization_context
replaces_booking_id
payment metadata without raw card data
confirmed_at / rejected_at / expired_at
```

## 9. Seguridad y Data API

La publishable key proporcionada es apropiada para el navegador únicamente si RLS y grants mínimos están configurados. Nunca se debe exponer `service_role` ni una secret key en `NEXT_PUBLIC_*`.

Política base:

```text
Supabase Auth user
→ organization_members.auth_user_id
→ ACTIVE membership
→ organization_id-scoped row access
```

Directrices:

- habilitar RLS en todas las tablas de `public`;
- crear políticas antes de conectar pantallas reales;
- usar `TO authenticated` junto con la condición de membership;
- definir `USING` y `WITH CHECK` en `UPDATE`;
- otorgar explícitamente solo las operaciones requeridas por `anon` y `authenticated`;
- mantener escrituras críticas de orchestration, result ingestion, decision y booking en servidor;
- no autorizar mediante `user_metadata` editable;
- verificar las políticas con dos organizaciones para probar aislamiento.

## 10. Índices mínimos

Crear índices para foreign keys y accesos del Golden Flow, incluyendo:

```text
organization_members(auth_user_id)
organization_members(organization_id, status)
freight_requests(organization_id, status)
orchestration_runs(freight_request_id, created_at)
orchestration_events(orchestration_run_id, created_at)
carrier_offers(freight_request_id, carrier_id)
carrier_offers(orchestration_run_id, status)
freight_decisions(freight_request_id, decision_version)
bookings(freight_request_id)
bookings(carrier_id)
booking_events(booking_id, occurred_at)
```

## 11. Estado del orden de implementación

1. Completado: reconciliar el esquema remoto actual.
2. Completado: agregar las cuatro tablas faltantes.
3. Completado: evolucionar columnas, constraints, uniques e índices.
4. Completado: implementar RLS, policies y grants.
5. Completado: corregir Bootstrap Data.
6. Completado: corregir FR-1042 como Demo Scenario.
7. Completado: eliminar las tres ofertas precargadas con autorización explícita.
8. Pendiente en React: implementar fixtures en las provider pages.
9. Pendiente en React: ejecutar el Golden Flow para crear datos runtime.
10. Parcial: Security Advisor limpio; faltan pruebas E2E con usuarios de dos organizaciones.

## 12. Verificación obligatoria

Antes de iniciar la demo:

```text
FR-1042 status = PENDING
carrier_offers = 0
freight_decisions = 0
bookings = 0
booking_events = 0
orchestration_runs = 0
orchestration_events = 0
```

Después de la orquestación inicial, pero antes de selección:

```text
orchestration_runs INITIAL = 1
carrier_offers = 3
freight_decisions v1 = 1
recommended_offer = Andes
selected_offer = null
bookings = 0
FreightRequest = OPTIONS_READY
```

## 13. Integración Next.js

El repositorio todavía no contiene una aplicación Next.js ni `package.json`, por lo que no corresponde instalar dependencias todavía.

Cuando se cree la app:

- usar `@supabase/supabase-js` y `@supabase/ssr` con versiones fijadas y lockfile;
- mantener `.env.local` fuera de Git;
- usar la publishable key en cliente;
- crear clientes browser/server separados;
- usar el patrón actual de Next.js `proxy.ts` para refresh de sesión;
- llamar `supabase.auth.getClaims()` en el proxy antes de confiar en identidad;
- no usar el objeto de `getSession()` como autorización;
- generar y versionar tipos TypeScript desde el esquema final.

El ejemplo pegado requiere actualización: su helper `middleware.ts` crea una respuesta, pero no ejecuta `getClaims()` ni refresca efectivamente la sesión.
