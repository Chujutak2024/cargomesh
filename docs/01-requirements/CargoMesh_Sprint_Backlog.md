# CargoMesh — Backlog de Producto y Cronograma del Hackathon

> **Proyecto:** CargoMesh (WebMCP Challenge 2026)  
> **Versión:** 1.2.0 (Consolidado con Épica 0 Completada + Tareas Pendientes)  
> **Catálogo de Requisitos Asociado:** `docs/01-requirements/CargoMesh_Catalogo_Requisitos.md`

---

## ⏳ Cronograma de Ejecución (Plan de 5 Días para Hackathon)

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ DÍA 1: Cimientos, Base de Datos & Contratos (100% COMPLETADO HOY ✅)                             │
│ └── 11 Migraciones Supabase, RLS, pgTAP Tests (18/18 PASS), Seed Auth, Esqueleto y Docs (00-03).│
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ DÍA 2: Core Express & Lógica Dura (SIGUIENTE PASO 🚀)                                           │
│ └── Portales WebMCP, Decision Engine (Scoring BALANCED), Result Bridge y Clientes Supabase SSR. │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ DÍA 3: Integración End-to-End (Frontend ↔ Backend ↔ Supabase)                                    │
│ └── Conexión del Stepper FR-1042, llamadas WebMCP en vivo, persistencia y estado de booking.     │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ DÍA 4: UI/UX, Judge Drawer & Pulido Visual                                                       │
│ └── Judge Activity Drawer flotante, animaciones de búsqueda, badges, timeline y manejo visual.  │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ DÍA 5: Congelamiento de Código, Ensayo del Golden Flow & Pitch                                  │
│ └── Cero cambios de código; ensayo de demo y validación con los 73 puntos de aceptación.        │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Tablero General del Backlog (Jira / Linear View)

### ✅ Épica 0: Cimientos, Base de Datos, RLS y Entorno (Día 1 — 100% COMPLETADO)

| Clave | Actividad / Entregable | Responsable | Prioridad | Estado |
|:---:|---|:---:|:---:|:---:|
| `CM-00A` | Migración Baseline Legacy (12 tablas originales) | *DB Lead* | 🔴 Alta | `[✅ Completado]` |
| `CM-00B` | Secuencia de 11 Migraciones PostgreSQL 17 + Domain Constraints | *DB Lead* | 🔴 Alta | `[✅ Completado]` |
| `CM-00C` | Seguridad y Aislamiento Multi-Tenant con RLS (17 tablas, anon bloqueado) | *Security Lead* | 🔴 Alta | `[✅ Completado]` |
| `CM-00D` | Seed de Usuario Demo (`carlos.mendoza@acmemining.pe` como OWNER) | *DB Lead* | 🔴 Alta | `[✅ Completado]` |
| `CM-00E` | Suite Oficial de Pruebas pgTAP (`npx supabase test db` 18/18 PASS) | *QA / DB Lead* | 🔴 Alta | `[✅ Completado]` |
| `CM-00F` | Scaffolding Modular: `frontend/` (Next.js 15), `backend/` (FastAPI) | *Fullstack Lead* | 🔴 Alta | `[✅ Completado]` |
| `CM-00G` | Reorganización de Docs (`00-03`) y Catálogo de 29 Requisitos | *Product Lead* | 🔴 Alta | `[✅ Completado]` |

---

### 🚀 Épicas de Desarrollo de la Aplicación (Días 2 a 4 — PENDIENTES DE CODIFICAR)

| Clave | Actividad / Historia de Usuario | Épica Padre | Asignado a | Prioridad | Estado |
|:---:|---|---|:---:|:---:|:---:|
| `CM-01` | Autenticación y Carga Dinámica de Organización | ⚡ `EP-1` Auth & Tenant | *Fullstack Lead* | 🔴 Alta | `[ ] Pendiente` |
| `CM-02` | Políticas de Despacho y Perfiles de Carga | ⚡ `EP-1` Auth & Tenant | *Frontend Dev* | 🟡 Media | `[ ] Pendiente` |
| `CM-03` | Stepper de Intake de 5 Pasos | ⚡ `EP-2` Intake & Carga | *Frontend Dev* | 🔴 Alta | `[ ] Pendiente` |
| `CM-04` | Normalización Matemática Unitizada y Pre-check | ⚡ `EP-2` Intake & Carga | *Backend Dev* | 🔴 Alta | `[ ] Pendiente` |
| `CM-05` | Portales Web de Carriers y Exposición WebMCP | ⚡ `EP-3` WebMCP & Carriers | *Fullstack Dev* | 🔴 Alta | `[ ] Pendiente` |
| `CM-06` | Fixtures y Cotizaciones Deterministas | ⚡ `EP-3` WebMCP & Carriers | *Frontend Dev* | 🔴 Alta | `[ ] Pendiente` |
| `CM-07` | Agente Runner y Result Bridge Idempotente | ⚡ `EP-4` Orquestación & AI | *Backend / AI Lead* | 🔴 Alta | `[ ] Pendiente` |
| `CM-08` | Decision Engine Heurístico y Snapshots | ⚡ `EP-4` Orquestación & AI | *Backend / AI Lead* | 🔴 Alta | `[ ] Pendiente` |
| `CM-09` | Vista Reactiva de Despacho `/dispatch` | ⚡ `EP-4` Orquestación & AI | *Frontend Dev* | 🔴 Alta | `[ ] Pendiente` |
| `CM-10` | Selección Humana y Solicitud de Booking | ⚡ `EP-5` Booking & Recovery | *Fullstack Dev* | 🔴 Alta | `[ ] Pendiente` |
| `CM-11` | Confirmación y Timeline de Seguimiento | ⚡ `EP-5` Booking & Recovery | *Frontend Dev* | 🔴 Alta | `[ ] Pendiente` |
| `CM-12` | Circuito de Recuperación Operacional (Recovery) | ⚡ `EP-5` Booking & Recovery | *Backend / AI Lead* | 🔴 Alta | `[ ] Pendiente` |
| `CM-13` | Judge Activity Drawer en Tiempo Real | ⚡ `EP-6` Jueces & Observabilidad | *Frontend Dev* | 🔴 Alta | `[ ] Pendiente` |
| `CM-14` | Inyección de Fixtures y Reset de Demostración | ⚡ `EP-6` Jueces & Observabilidad | *Backend Dev* | 🔴 Alta | `[ ] Pendiente` |

---

## ⚡ ÉPICA 0: Cimientos, Base de Datos, RLS y Entorno (COMPLETADA HOY)

* **`CM-00A` — Baseline Legacy:** Creación de `20260828200000_baseline_legacy_schema.sql` para levantar las 12 tablas heredadas desde cero con `npx supabase db reset`. `[✅]`
* **`CM-00B` — 11 Migraciones PostgreSQL 17:** Aplicación en orden estricto de tablas de identidad, observabilidad, perfiles de carga y constraints de dominio. `[✅]`
* **`CM-00C` — RLS & Multi-tenant:** 17 tablas aseguradas con RLS, aislamiento total entre tenants y bloqueo 100% a `anon` (código `42501`). `[✅]`
* **`CM-00D` — Seed Auth:** Usuario `carlos.mendoza@acmemining.pe` (`CargoMesh2026!`) vinculado a ACME Mining como `OWNER`. `[✅]`
* **`CM-00E` — Suite pgTAP:** Archivo `supabase/tests/01_cargomesh_rls_and_golden_flow.test.sql` con 18/18 pruebas en verde (`PASS`). `[✅]`
* **`CM-00F` — Scaffolding:** Estructura modular `frontend/` (Next.js 15, React 19, Tailwind) y `backend/` (FastAPI, OpenAI). `[✅]`
* **`CM-00G` — Jerarquía Docs:** Reorganización `docs/00` a `docs/03` y catálogo de 29 requisitos (RF/RNF). `[✅]`

---

## ⚡ ÉPICA 1: Autenticación, Gobernanza y Contexto B2B (`EP-1`)

### 📌 `CM-01`: Autenticación y Carga Dinámica de Organización
* **Persona asignada:** *Fullstack Lead*
* **Prioridad:** 🔴 Alta (P0)
* **Estado:** `[ ] Pendiente`
* **Estructura de Usuario:**
  * **Como** representante logístico de una empresa (ej. Carlos Mendoza de ACME Mining),
  * **Quiero** iniciar sesión y que el sistema resuelva automáticamente mi organización y rol,
  * **Para** gestionar operaciones de carga bajo el contexto y permisos de mi empresa de forma segura.
* **Lo que se necesita principalmente:**
  * Configurar Supabase SSR Client en `frontend/src/lib/supabase/`.
  * Pantalla de Login en `frontend/src/app/(auth)/login/` con botón de acceso rápido para demo.
  * Hook `useOrganizationContext` para resolver `organization_id`, `legal_name`, `country` y rol activo sin hardcodear datos.
* **Criterios de Aceptación:**
  1. Al iniciar sesión con `carlos.mendoza@acmemining.pe`, se carga la sesión JWT válida.
  2. El contexto global resuelve `organization_id` y rol `OWNER` directamente desde `organization_members`.

---

### 📌 `CM-02`: Políticas de Despacho y Perfiles Habituales de Carga
* **Persona asignada:** *Frontend Dev*
* **Prioridad:** 🟡 Media (P1)
* **Estado:** `[ ] Pendiente`
* **Estructura de Usuario:**
  * **Como** administrador logístico (OWNER / SUPERVISOR),
  * **Quiero** consultar y gestionar las políticas de despacho y plantillas de carga frecuente,
  * **Para** estandarizar los requerimientos de transporte y agilizar la creación de nuevas solicitudes.
* **Lo que se necesita principalmente:**
  * Vista de configuración en `frontend/src/app/(dashboard)/` para ver políticas (`BALANCED`, umbral $\ge 85\%$).
  * Selector de plantillas (`organization_cargo_profiles`) para autocompletar formularios.
* **Criterios de Aceptación:**
  1. Los roles `OWNER` y `SUPERVISOR` pueden modificar las preferencias; `REQUESTER` solo lectura.
  2. La selección del perfil "Repuestos mineros" precarga categoría `MACHINERY` y vehículo `TRACTOR_TRAILER`.

---

## ⚡ ÉPICA 2: Captura e Intake de Carga Logística (`EP-2`)

### 📌 `CM-03`: Stepper de Intake de 5 Pasos
* **Persona asignada:** *Frontend Dev*
* **Prioridad:** 🔴 Alta (P0)
* **Estado:** `[ ] Pendiente`
* **Estructura de Usuario:**
  * **Como** despachador B2B,
  * **Quiero** un formulario guiado e interactivo de 5 pasos,
  * **Para** ingresar rutas, características de la carga, ventanas de recojo y presupuesto sin omitir datos críticos.
* **Lo que se necesita principalmente:**
  * Componente Stepper en `frontend/src/components/stepper/` (Paso 1: Organización, Paso 2: Ruta Callao $\rightarrow$ Santiago, Paso 3: Carga, Paso 4: Políticas, Paso 5: Resumen).
  * Validaciones visuales por paso para habilitar el botón "Siguiente".
* **Criterios de Aceptación:**
  1. Navegación fluida entre pasos con guardado de estado local.
  2. El Paso 5 muestra el resumen consolidado y botón *"Confirmar y buscar opciones de transporte"*.

---

### 📌 `CM-04`: Normalización Matemática Unitizada y Pre-check
* **Persona asignada:** *Backend Dev*
* **Prioridad:** 🔴 Alta (P0)
* **Estado:** `[ ] Pendiente`
* **Estructura de Usuario:**
  * **Como** sistema inteligente de fletes,
  * **Quiero** normalizar matemáticamente el peso y volumen total y validar restricciones duras,
  * **Para** garantizar que la solicitud sea físicamente viable antes de consultar a los transportistas.
* **Lo que se necesita principalmente:**
  * Hook de cálculo unitizado en frontend ($10 \times 800\text{ kg} = 8,000\text{ kg}$, $1.2 \times 1.0 \times 1.5\text{ m} \times 10 = 18\text{ m³}$).
  * Endpoint / validador Pydantic en backend que rechace pesos $\le 0$, presupuestos negativos o fechas incongruentes.
* **Criterios de Aceptación:**
  1. Al cambiar la cantidad de pallets o dimensiones, el peso y volumen total se recalculan en tiempo real.
  2. Solicitudes con inconsistencias matemáticas son rechazadas antes de crear el registro en Supabase.

---

## ⚡ ÉPICA 3: Infraestructura de Transportistas y WebMCP (`EP-3`)

### 📌 `CM-05`: Portales Web de Carriers y Exposición WebMCP
* **Persona asignada:** *Fullstack Dev*
* **Prioridad:** 🔴 Alta (P0)
* **Estado:** `[ ] Pendiente`
* **Estructura de Usuario:**
  * **Como** transportista participante de la red (Andes, Inca, Pacific),
  * **Quiero** una página web pública que exponga herramientas WebMCP estructuradas,
  * **Para** que agentes de IA puedan consultar mi cobertura, flota y tarifas de manera autónoma.
* **Lo que se necesita principalmente:**
  * Páginas web en `frontend/src/app/providers/[carrier]/page.tsx` conectadas a las tablas `carriers`, `vehicles` y `carrier_metrics` de Supabase.
  * Registro de herramientas en el navegador mediante `document.modelContext.registerTool` (`check_service_coverage`, `check_capacity`, `quote_freight`, `book_freight`, `get_provider_booking_status`).
* **Criterios de Aceptación:**
  1. Cada portal renderiza su identidad visual corporativa y flota real desde la BD.
  2. Las herramientas WebMCP están registradas y son invocables programáticamente.

---

### 📌 `CM-06`: Fixtures y Cotizaciones Deterministas
* **Persona asignada:** *Frontend Dev*
* **Prioridad:** 🔴 Alta (P0)
* **Estado:** `[ ] Pendiente`
* **Estructura de Usuario:**
  * **Como** motor de tarificación del carrier,
  * **Quiero** responder a la herramienta `quote_freight` con una cotización estructurada y determinista,
  * **Para** proporcionar al agente información precisa de precio, tiempo de tránsito y disponibilidad.
* **Lo que se necesita principalmente:**
  * Implementación de la lógica de respuesta para el escenario Golden Flow:
    * **Andes:** $1,760 USD · 31h · Scania R450 18t · 96% SLA.
    * **Inca:** $1,920 USD · 29h · Volvo FH 24t · 98% SLA.
    * **Pacific:** $1,590 USD · 60h · Freightliner 15t · 86% SLA.
* **Criterios de Aceptación:**
  1. Las respuestas JSON contienen desglose de costos, notas aduaneras y tiempos en horas.
  2. Ante cambios de fixture (desde el Judge Drawer), la respuesta se adapta (`ACCEPT` vs `REJECT`).

---

## ⚡ ÉPICA 4: Orquestación Agent-Native y Motor de Decisión (`EP-4`)

### 📌 `CM-07`: Agente Runner y Result Bridge Idempotente
* **Persona asignada:** *Backend / AI Lead*
* **Prioridad:** 🔴 Alta (P0)
* **Estado:** `[ ] Pendiente`
* **Estructura de Usuario:**
  * **Como** agente orquestador de CargoMesh,
  * **Quiero** navegar por los portales de los carriers, invocar sus herramientas y persistir los resultados válidos,
  * **Para** alimentar el proceso de decisión cumpliendo estrictamente la regla de causalidad.
* **Lo que se necesita principalmente:**
  * Agente en Python (`backend/app/agent/`) que gestione `orchestration_runs`.
  * **Result Bridge** que valide las cotizaciones recibidas e inserte en `carrier_offers` y `orchestration_events` usando `tool_call_id` único.
* **Criterios de Aceptación:**
  1. Las ofertas solo existen en la base de datos tras la ejecución de la herramienta WebMCP.
  2. Llamadas repetidas no generan ofertas duplicadas (idempotencia estricta).

---

### 📌 `CM-08`: Decision Engine Heurístico y Snapshots Inmutables
* **Persona asignada:** *Backend / AI Lead*
* **Prioridad:** 🔴 Alta (P0)
* **Estado:** `[ ] Pendiente`
* **Estructura de Usuario:**
  * **Como** motor de decisión matemática,
  * **Quiero** evaluar las ofertas con la fórmula BALANCED y congelar un snapshot inmutable,
  * **Para** entregar un ranking objetivo, auditable y con nivel de confianza cuantificado.
* **Lo que se necesita principalmente:**
  * Motor de scoring en `backend/app/engine/` con las 6 dimensiones (Costo 25%, SLA 25%, ETA 20%, Disponibilidad 10%, Ruta 10%, Historial 10%).
  * Cálculo de Decision Confidence Score (88/100) y alerta de anomalías (>+30%).
  * Persistencia en `freight_decisions` (`v1`) con ranking completo y subscores.
* **Criterios de Aceptación:**
  1. Puntuaciones exactas calculadas: Andes 89 pts (Ganador), Inca 84 pts, Pacific 72 pts.
  2. El registro en `freight_decisions` es inmutable y no se sobreescribe.

---

### 📌 `CM-09`: Vista Reactiva de Despacho `/dispatch/[id]`
* **Persona asignada:** *Frontend Dev*
* **Prioridad:** 🔴 Alta (P0)
* **Estado:** `[ ] Pendiente`
* **Estructura de Usuario:**
  * **Como** despachador B2B,
  * **Quiero** ver el progreso en tiempo real de la consulta a los carriers y las tarjetas de ofertas resultantes,
  * **Para** comprender la recomendación y seleccionar la mejor opción de transporte.
* **Lo que se necesita principalmente:**
  * Vista reactiva en `frontend/src/app/(dashboard)/dispatch/[id]/` (estados `EVALUATING` $\rightarrow$ `OPTIONS_READY`).
  * Tarjetas de transportistas con badges (`★ Recomendado por CargoMesh`), precios y tiempos.
  * Sección expandible de explicabilidad técnica con desglose de subscores.
* **Criterios de Aceptación:**
  1. La interfaz muestra el progreso en vivo y se detiene en `OPTIONS_READY`.
  2. La tarjeta de Andes Freight muestra 89 pts y el botón "Seleccionar Andes Freight".

---

## ⚡ ÉPICA 5: Booking, Tracking y Recuperación Operacional (`EP-5`)

### 📌 `CM-10`: Selección Humana y Solicitud de Booking
* **Persona asignada:** *Fullstack Dev*
* **Prioridad:** 🔴 Alta (P0)
* **Estado:** `[ ] Pendiente`
* **Estructura de Usuario:**
  * **Como** despachador B2B,
  * **Quiero** seleccionar formalmente una oferta y que el sistema emita la reserva al carrier,
  * **Para** asegurar la capacidad del camión e iniciar el proceso de despacho.
* **Lo que se necesita principalmente:**
  * Registrar `selected_offer_id` en Supabase.
  * Invocar `book_freight()` en el portal del carrier y pasar a `PENDING_PROVIDER_CONFIRMATION` con cronómetro de 15 min.
* **Criterios de Aceptación:**
  1. La solicitud pasa a estado de espera con cuenta regresiva visible.
  2. Se genera un registro en `bookings` asociado al `provider_reference` (ej. `AND-BOOK-8821`).

---

### 📌 `CM-11`: Confirmación y Timeline de Seguimiento
* **Persona asignada:** *Frontend Dev*
* **Prioridad:** 🔴 Alta (P0)
* **Estado:** `[ ] Pendiente`
* **Estructura de Usuario:**
  * **Como** despachador B2B,
  * **Quiero** recibir la confirmación del carrier y rastrear los hitos del viaje,
  * **Para** supervisar el tránsito internacional y los trámites fronterizos en tiempo real.
* **Lo que se necesita principalmente:**
  * Transición automática a `/tracking/[id]` al confirmarse la reserva (`CONFIRMED`).
  * Timeline de hitos aduaneros (`BORDER_PROCESSING` en Santa Rosa / Chacalluta), unidad asignada, placa y precinto.
* **Criterios de Aceptación:**
  1. Vista de tracking renderiza datos reales de viaje (`Scania R450`, placa `AND-TRK-101`).
  2. Línea de tiempo alimentada por eventos de `booking_events`.

---

### 📌 `CM-12`: Circuito de Recuperación Operacional (Recovery Run)
* **Persona asignada:** *Backend / AI Lead*
* **Prioridad:** 🔴 Alta (P0)
* **Estado:** `[ ] Pendiente`
* **Estructura de Usuario:**
  * **Como** sistema resiliente de orquestación,
  * **Quiero** re-evaluar automáticamente alternativas si el carrier rechaza o expira la reserva,
  * **Para** ofrecer inmediatamente un reemplazo garantizado sin perder la operación.
* **Lo que se necesita principalmente:**
  * Manejo del evento `REJECTED` / `EXPIRED` disparando corrida `RECOVERY` en `orchestration_runs`.
  * Generación de `FreightDecision v2` con las alternativas refrescadas.
  * Modal en frontend que sugiera a Inca Logistics ($1,920 USD / 29h / 98% SLA) con confirmación en 1 clic.
* **Criterios de Aceptación:**
  1. Ante rechazo de Andes, la UI no se bloquea y presenta la opción de reemplazo inmediatamente.
  2. Al confirmar Inca, se emite un nuevo booking con su propio `provider_reference`.

---

## ⚡ ÉPICA 6: Observabilidad y Panel para Jueces (`EP-6`)

### 📌 `CM-13`: Judge Activity Drawer en Tiempo Real
* **Persona asignada:** *Frontend Dev*
* **Prioridad:** 🔴 Alta (P0)
* **Estado:** `[ ] Pendiente`
* **Estructura de Usuario:**
  * **Como** juez técnico del WebMCP Challenge,
  * **Quiero** abrir un panel lateral flotante de trazabilidad en cualquier momento,
  * **Para** verificar la causalidad real de las llamadas a tools, tiempos de respuesta y payloads JSON.
* **Lo que se necesita principalmente:**
  * Componente `JudgeDrawer` flotante con acceso mediante botón `🧪 Judge Mode`.
  * Stream en vivo de `orchestration_events` con timestamps, duración en ms e inspección de JSON.
* **Criterios de Aceptación:**
  1. El Drawer se puede abrir y cerrar sobre cualquier pantalla sin interrumpir la experiencia.
  2. Los payloads de `quote_freight`, `record_provider_result` y `book_freight` son legibles y formateados.

---

### 📌 `CM-14`: Inyección de Fixtures y Reset de Demostración
* **Persona asignada:** *Backend Dev*
* **Prioridad:** 🔴 Alta (P0)
* **Estado:** `[ ] Pendiente`
* **Estructura de Usuario:**
  * **Como** juez o presentador de la demo,
  * **Quiero** configurar el comportamiento de los carriers (`ACCEPT`, `REJECT`, `NO_RESPONSE`) y reiniciar la demo,
  * **Para** evaluar tanto el flujo exitoso como el flujo de recuperación de forma repetible y controlada.
* **Lo que se necesita principalmente:**
  * Controles en el Judge Drawer para cambiar el fixture del transportista.
  * Endpoint / función de reset que restaure `FR-1042` a `PENDING` y vacíe las tablas de runtime.
* **Criterios de Aceptación:**
  1. Cambiar el switch a `REJECT` hace que el carrier responda con rechazo en la siguiente llamada sin alterar la BD.
  2. El botón *Reset Demo* deja la base de datos limpia y lista para una nueva corrida en menos de 2 segundos.
