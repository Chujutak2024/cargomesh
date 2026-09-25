# CargoMesh — Contrato técnico del esquema Supabase

> **Proyecto remoto:** `cargomesh` (`tokvzfrefwqobzqgbfoj`)  
> **Fecha:** 2026-08-29  
> **Estado:** 17 tablas públicas, RLS completo y Golden Flow bootstrap alineado.  
> **Documento general de producto:** `CargoMesh_Planeacion_WebMCP_FINAL.md` v5.6.0.

## 1. Objetivo

Este documento describe cómo se representa CargoMesh en Supabase. El documento maestro explica el producto, WebMCP y la demo; este contrato explica entidades, relaciones, ownership, datos iniciales y límites de escritura.

El esquema SQL remoto completo está exportado en:

```text
supabase/current_public_schema.sql
```

El historial remoto está sincronizado en:

```text
supabase/migrations/
```

## 2. Modelo B2B multiempresa

```text
auth.users
    │ 1
    │
    │ N
organization_members N ─── 1 organizations
                                  │
                                  ├── organization_preferences
                                  ├── organization_cargo_profiles
                                  └── freight_requests
```

- `organizations` representa al cliente empresarial y tenant.
- `auth.users` representa identidades humanas autenticadas.
- `organization_members` relaciona personas con empresas y asigna roles.
- Las entidades comerciales se aíslan mediante `organization_id` y RLS.
- Contactos de pickup y recepción no necesitan una cuenta CargoMesh.

### Onboarding mínimo

```text
signup del primer representante
→ crear organization
→ crear organization_member OWNER + ACTIVE
→ OWNER invita por correo desde servidor
→ Supabase Auth crea/envía invitación
→ organization_member INVITED
→ aceptación
→ organization_member ACTIVE
```

No se utiliza `user_metadata` para autorización. La autoridad empresarial reside en `organization_members`.

## 3. Inventario de tablas

### Identidad y configuración

| Tabla | Propósito | Ownership |
|---|---|---|
| `organizations` | Empresa cliente/tenant | Global, leída por miembros |
| `organization_members` | Usuarios representantes y roles | `organization_id` |
| `organization_preferences` | Políticas de dispatch y autorización | `organization_id` |
| `organization_cargo_profiles` | Plantillas habituales de carga | `organization_id` |
| `cargo_categories` | Catálogo de categorías | Referencia global |

### Solicitud y capacidad logística

| Tabla | Propósito | Ownership |
|---|---|---|
| `freight_requests` | Intención logística confirmada | `organization_id` |
| `carriers` | Proveedores participantes | Referencia global |
| `carrier_services` | Corredores y capacidades declaradas | Referencia global |
| `carrier_service_cargo_categories` | Compatibilidad carrier/categoría | Referencia global |
| `vehicles` | Clases/vehículos fixture del provider | Referencia global |
| `carrier_metrics` | Históricos globales o por organización | Global o `organization_id` |

### Ejecución, decisión y booking

| Tabla | Propósito | Causalidad |
|---|---|---|
| `orchestration_runs` | Una ejecución INITIAL o RECOVERY | Se crea al iniciar WebMCP |
| `orchestration_events` | Evidencia de navegación/tool/result | Se crea por ejecución real |
| `carrier_offers` | Oferta normalizada del provider | Nace después de `quote_freight` |
| `freight_decisions` | Ranking, recomendación y selección | Nace después de evaluar ofertas |
| `bookings` | Solicitud comercial al carrier | Nace después de selección |
| `booking_events` | Estado/tracking idempotente | Nace desde respuesta provider |

## 4. Contrato de perfiles de carga

Antes de aplicar un perfil empresarial, el catálogo global distingue:

```text
cargo category = qué se transporta
entry method   = cómo se cuenta o agrupa
requirements   = cómo debe manipularse
```

Cada fila de `cargo_categories` incluye `recommended_entry_methods`, `intake_specification_schema`, `suggested_requirements` y `recommended_vehicle_classes`. Esto permite que React cambie el formulario para FOOD, PHARMA, CHEMICAL, MACHINERY, CONSTRUCTION, AGRICULTURAL, LIQUID o GENERAL sin codificar toda la lógica en componentes.

`organization_cargo_profiles` conserva patrones habituales de una empresa:

```text
organization_id
cargo_category_id
profile_name
default_entry_method
typical_entry_quantity
typical_unit_weight_kg
typical_units_per_entry
typical_length_cm / width_cm / height_cm
default_requirements JSONB
preferred_vehicle_classes JSONB
priority
active
```

Reglas:

- el nombre del perfil es único dentro de la organización;
- cantidades, pesos y dimensiones deben ser positivos cuando existan;
- requisitos variables son un objeto JSON;
- clases de vehículo sugeridas son un arreglo JSON;
- el perfil propone defaults, pero no certifica disponibilidad;
- `check_capacity` WebMCP sigue siendo la autoridad sobre capacidad real.

Fixture actual:

```text
ACME Mining
└── Repuestos y maquinaria minera
    ├── MACHINERY
    ├── PALLETS
    ├── 10 × 800 kg
    ├── 120 × 100 × 150 cm
    ├── cross-border + high-value + non-stackable
    └── preferred vehicle class: TRACTOR_TRAILER
```

## 5. Contrato de captura y normalización

Métodos admitidos:

```text
TOTAL_WEIGHT
UNITS
PACKAGES
PALLETS
LOTS
SACKS
```

Campos unitizados de `freight_requests`:

```text
cargo_profile_id
entry_quantity
entry_unit_weight_kg
units_per_entry
entry_length_cm
entry_width_cm
entry_height_cm
cargo_specifications JSONB
```

Fórmulas persistidas:

```text
cargo_weight_kg
= entry_quantity × entry_unit_weight_kg × units_per_entry

cargo_volume_m3
= entry_quantity × units_per_entry
  × entry_length_cm × entry_width_cm × entry_height_cm
  / 1,000,000
```

Postgres valida una tolerancia máxima de `0.01` entre el detalle unitizado y los totales. Los drafts pueden estar incompletos; una solicitud no draft con entrada unitizada requiere cantidad, peso y unidades por entrada.

El foreign key compuesto `(organization_id, cargo_profile_id)` impide asociar una solicitud con un perfil perteneciente a otra empresa.

## 6. Identidad e invitaciones

### `organizations`

Datos mínimos de hackathon:

```text
name / legal_name
code
country_code
business_identifier_type / value
verified_corporate_email
corporate_phone
default_currency
status
```

### `organization_members`

```text
organization_id
auth_user_id → auth.users
display_name
corporate_email
role = OWNER | REQUESTER | SUPERVISOR
status = INVITED | ACTIVE | INACTIVE
```

Para una invitación, el backend llama a Supabase Auth Admin y luego registra la membresía usando el `auth_user_id` retornado. El navegador nunca recibe `service_role`.

## 7. RLS y permisos

Las 17 tablas públicas tienen RLS habilitado. `anon` no posee privilegios de tabla.

| Recurso | Miembro activo | OWNER/SUPERVISOR | Escritura crítica servidor |
|---|---:|---:|---:|
| Organización | Leer | Leer | Crear/onboarding |
| Miembros | Leer | Gestión futura vía servidor | Invitar/cambiar estado |
| Preferencias | Leer | Actualizar | Sí |
| Perfiles de carga | Leer | Crear/actualizar | Opcional |
| Freight requests | Leer/crear/actualizar | Leer/crear/actualizar | Confirmación sensible |
| Catálogos/carriers/services/vehicles | Leer | Leer | Administrar fixtures |
| Runs/events/offers/decisions/bookings | Leer por organización | Leer por organización | Crear/actualizar |

Las políticas utilizan helpers internos en el esquema no expuesto `private`:

```text
private.is_organization_member(organization_id)
private.has_organization_role(organization_id, roles[])
private.has_any_organization()
```

Los helpers verifican `auth.uid()`, fijan `search_path` y no son ejecutables por `anon`.

## 8. Frontera WebMCP

WebMCP pertenece a las páginas provider y expone tools accionables:

```text
check_service_coverage
check_capacity
quote_freight
book_freight
get_provider_booking_status
```

CargoMesh mantiene:

```text
organization context
cargo profiles
normalization
RLS and authorization
historical metrics
hard constraints
heuristic ranking
persistence and observability
```

`carrier_offers` exige evidencia no nula de:

```text
orchestration_run_id
tool_call_id
provider_offer_reference
transit_hours
availability_class / score
reliability_score
```

Por tanto, una oferta no puede presentarse como resultado WebMCP sin correlación técnica persistida.

## 9. Clasificación de datos de demo

### Bootstrap permitido

```text
ACME Mining
organization_preferences
organization_cargo_profiles
cargo_categories
carriers / services / category compatibility
vehicles
carrier_metrics
```

### Scenario permitido

```text
FR-1042 = PENDING
Callao, PE → Santiago, CL
10 pallets × 800 kg = 8,000 kg
18 m³
budget USD 2,000
```

### Runtime inicialmente vacío

```text
orchestration_runs
orchestration_events
carrier_offers
freight_decisions
bookings
booking_events
```

Las cotizaciones deterministas existen solo en las provider pages hasta que una tool real las devuelve.

## 10. Migraciones y reproducibilidad local

Historial sincronizado:

```text
20260828200000 baseline_legacy_schema
20260828233233 add_cargomesh_identity_and_intent_contract
20260828233302 add_cargomesh_observability_and_booking_events
20260828233343 add_cargomesh_runtime_contract
20260828233435 add_cargomesh_domain_constraints
20260828233524 add_carrier_offers_carrier_fk_index
20260829003215 align_golden_flow_and_reset_runtime
20260829003327 secure_cargomesh_data_api_with_rls
20260829005625 add_organization_cargo_profiles_and_unitized_intake
20260829010551 add_freight_request_org_cargo_profile_fk_index
20260829011002 add_cargo_category_intake_guidance
```

Comandos de verificación y mantenimiento local:

```bash
npx supabase start
npx supabase db reset
npx supabase db lint --local
```

`supabase/snippets/test_rls_and_golden_flow.sql` contiene la suite automatizada de pruebas que verifica el aislamiento multi-tenant, el bloqueo estricto de `anon`, los permisos de roles (`OWNER`, `SUPERVISOR`, `REQUESTER`), las restricciones de dominio y los parámetros del Golden Flow `FR-1042`.

## 11. Estado del entorno local y siguientes pasos para React

1. [x] Baseline legacy consolidado y `supabase db reset` reproducible desde cero.
2. [x] Fixture local de Supabase Auth (`demo.operator@cargomesh.test` / contraseña explícitamente local-only).
3. [x] Membresía local `SUPERVISOR / ACTIVE` de ACME Mining vinculada; la cuenta hospedada se provisiona por separado.
4. [x] 17 tablas con RLS, políticas por organización y cero acceso a `anon`.
5. [ ] Implementar registro transaccional organización + owner en UI/API.
6. [ ] Implementar invitación server-side y activación de membresía.
7. [ ] Consumir el perfil habitual en el stepper de nueva carga.
8. [ ] Mostrar histórico de `freight_requests` filtrado por RLS.
9. [ ] Implementar el vertical slice WebMCP sin sembrar runtime results.
