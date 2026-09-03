# CargoMesh — Backlog de Producto y Cronograma del Hackathon (MVP Scope)

> **Project:** CargoMesh (WebMCP Challenge 2026)
> **Version:** 1.5.0 (dynamic provider registry + verified Golden Flow)
> **Release snapshot:** 2026-09-03
> **Requirements catalog:** [`CargoMesh_Catalogo_Requisitos.md`](./CargoMesh_Catalogo_Requisitos.md)

## Current release status

The `CM-01` through `CM-14` MVP cuts below are integrated and verified. The calendar and detailed stories remain as a historical execution record, not an active to-do list. Current implementation truth lives in `main`, the ADRs and the release evidence.

- Public demo: `https://cargomesh.vercel.app`
- Verified production baseline before finalization: `origin/main@f38f9a7`
- Public repository and license: `https://github.com/Chujutak2024/cargomesh` · MIT
- Provider discovery and orchestration: data-driven `0..N`
- Demo providers: Andes, Inca and Pacific are live same-origin CargoMesh routes, not independently hosted partners
- Provider tool set: exactly five canonical provider tools
- Intake recommendation tool: separate read-only WebMCP tool; it is not a sixth provider tool
- Decision engine: BALANCED `25/25/20/10/10/10`
- Tracking: planned corridor before booking and persisted provider events after booking; no invented live GPS
- Release baseline: typecheck, build, release tests, local pgTAP, lint, public smoke and WebMCP UAT verified

---

## ⏳ Cronograma Real hacia la Entrega (29 Ago — 02 Sep)

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ VIERNES 28 AGOSTO: Base de Datos, Cimientos & Contratos (100% COMPLETADO ✅)                     │
│ └── 11 Migraciones Supabase, RLS, pgTAP Tests (18/18 PASS), Seed Auth, Esqueleto y Docs (00-03).│
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ SÁBADO 29 AGOSTO: Auth Demo, UI Shell & Provider Registry WebMCP                                 │
│ └── Login 1-click, Dashboard y plantilla provider dinámica con tres registros seed.             │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ DOMINGO 30 AGOSTO: Stepper FR-1042, Agente WebMCP & Motor de Scoring                             │
│ └── Stepper interactivo de carga, agente runner que consulta los carriers y calcula notas (89/84/72) │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ LUNES 31 AGOSTO: Booking, Timeline de Tracking, Recovery & Judge Drawer                         │
│ └── Selección humana, confirmación/rechazo, re-evaluación a Inca y Drawer de Jueces en vivo.    │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ MARTES 01 SEPTIEMBRE: Pulido E2E, Ensayo General de Demo & Grabación de Video                   │
│ └── Congelamiento de código, validación de los 73 puntos de aceptación y preparación de entrega. │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ MIÉRCOLES 02 SEPTIEMBRE: CIERRE Y ENTREGA OFICIAL DEL HACKATHON 🏆                              │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Alcance Estricto del Demo (Sin Sobreingeniería)

Para no dispersar esfuerzos en pantallas innecesarias, el alcance se limita estrictamente a:

1. **Authentication:** One-click demo access creates a real Supabase Auth session server-side and still requires an `ACTIVE` membership. Hosted credentials are private deployment variables and never reach the browser.
2. **Provider Registry + plantilla (`/providers/[carrierSlug]`):** Los candidatos se consultan dinámicamente desde `carriers` y `carrier_services`. La demo aloja páginas livianas para los tres registros seed reutilizando `mockups/provider_*.html`, pero la lógica opera sobre `0..N` carriers y también admite un `provider_url` externo. No son sistemas de gestión interna de flotas.
3. **Solicitud de Carga:** El formulario Stepper inicia como un borrador limpio. El operador puede cargar explícitamente **FR-1042** (10 pallets $\times$ 800 kg = 8,000 kg, 18 m³, Callao $\rightarrow$ Santiago) como caso reproducible; nunca se usa como fallback productivo ni se muta al abrir un borrador nuevo.
4. **Orquestación & Scoring:** Agente que recorre todos los candidatos descubiertos, ejecuta sus tools, aplica BALANCED sobre las ofertas elegibles y guarda la decisión inmutable.
5. **Booking & Tracking:** Simulación limpia de confirmación aduanera y timeline de hitos.
6. **Recovery:** Modal contextual que ante rechazo de Andes ofrece a Inca Logistics en 1 clic.
7. **Judge Drawer:** Panel lateral flotante para ver logs JSON y cambiar el switch `ACCEPT / REJECT`.

---

## 📊 Tablero General de Tareas (Jira / Linear View)

### ✅ Épica 0: Cimientos y Base de Datos (COMPLETADO EL 28 AGOSTO)

| Clave | Tarea Entregada | Responsable | Estado |
|:---:|---|:---:|:---:|
| `CM-00A` | Baseline Legacy (12 tablas) con `supabase db reset` reproducible | *DB Lead* | `[✅ Completado]` |
| `CM-00B` | 11 Migraciones PostgreSQL 17 + Domain Constraints | *DB Lead* | `[✅ Completado]` |
| `CM-00C` | Seguridad RLS en 17 tablas (anon bloqueado con `42501`) | *Security Lead* | `[✅ Completado]` |
| `CM-00D` | Seed Auth exclusivamente local (`demo.operator@cargomesh.test` como `SUPERVISOR`) | *DB Lead* | `[✅ Completado]` |
| `CM-00E` | Suite Oficial pgTAP (`npx supabase test db` 18/18 PASS) | *QA / DB Lead* | `[✅ Completado]` |
| `CM-00F` | Esqueleto de carpetas: `frontend/` (Next.js) y `backend/` (FastAPI) | *Fullstack Lead* | `[✅ Completado]` |
| `CM-00G` | Jerarquía Docs (`00-03`) y Catálogo Oficial de Requisitos | *Product Lead* | `[✅ Completado]` |

---

### 🚀 Tareas de Desarrollo Acotadas (29 Ago — 01 Sep)

| Clave | Actividad (Alcance Demo) | Épica Padre | Asignado a | Prioridad | Estado |
|:---:|---|---|:---:|:---:|:---:|
| `CM-01` | **Supabase Auth & SSR Client:** Real authenticated session with `ACTIVE` membership; one-click demo access uses server-managed credentials. | ⚡ `EP-1` Auth & Shell | *Fullstack Lead* | 🔴 High | `[x] Integrated` |
| `CM-02` | **B2B shell & real dashboard:** Sidebar, persisted request metrics and honest empty state. | ⚡ `EP-1` Auth & Shell | *Frontend Dev* | 🔴 High | `[x] Integrated` |
| `CM-03` | **Five-step intake:** Existing request loading plus clean, server-created drafts; FR-1042 remains a reproducible demo case. | ⚡ `EP-2` Freight Intake | *Frontend Dev* | 🔴 High | `[x] Integrated` |
| `CM-04` | **Validation & normalization:** Server canonical totals, optimistic concurrency and persisted handling requirements. | ⚡ `EP-2` Freight Intake | *Backend Dev* | 🔴 High | `[x] Integrated` |
| `CM-05` | **Dynamic provider registry:** Resolve candidates from Supabase and serve `/providers/[carrierSlug]` with an exact `matchingServiceId`. | ⚡ `EP-3` WebMCP Tools | *Frontend / Data* | 🔴 High | `[x] Integrated` |
| `CM-06` | **Five generic provider tools:** coverage, capacity, quote, booking and booking status with no carrier-name branching. | ⚡ `EP-3` WebMCP Tools | *Fullstack Dev* | 🔴 High | `[x] Integrated` |
| `CM-07` | **Browser agent & Result Bridge:** Native `document.modelContext` execution across `CandidateProvider[0..N]` with idempotent persistence and cleanup. | ⚡ `EP-4` Orchestration & AI | *WebMCP / Data Lead* | 🔴 High | `[x] Integrated` |
| `CM-08` | **Generic BALANCED engine:** Rank any eligible offer collection; 89/84/72 remains the Golden Flow regression case. | ⚡ `EP-4` Orchestration & AI | *Backend / Data Lead* | 🔴 High | `[x] Integrated` |
| `CM-09` | **Reactive dispatch `0..N`:** Render runtime candidates/results, explanations and the no-match state. | ⚡ `EP-4` Orchestration & AI | *Frontend Dev* | 🔴 High | `[x] Integrated` |
| `CM-10` | **Assisted selection & booking:** Human selection, server authorization and a 15-minute provider deadline. | ⚡ `EP-5` Booking & Recovery | *Fullstack Dev* | 🔴 High | `[x] Integrated` |
| `CM-11` | **Tracking timeline:** Planned route while pending; persisted provider events after confirmation, without invented GPS. | ⚡ `EP-5` Booking & Recovery | *Frontend Dev* | 🔴 High | `[x] Integrated` |
| `CM-12` | **Recovery:** A rejected booking exposes only authorized recovery offers and can confirm an alternative booking. | ⚡ `EP-5` Booking & Recovery | *Backend / AI Lead* | 🔴 High | `[x] Integrated` |
| `CM-13` | **Judge Activity Drawer:** Readable persisted event, tool, timing, origin mode and cleanup evidence. | ⚡ `EP-6` Judges & Demo | *Frontend Dev* | 🔴 High | `[x] Integrated` |
| `CM-14` | **Provider fixture controls & server reset:** Deterministic `ACCEPT/REJECT` and authorized demo reset. | ⚡ `EP-6` Judges & Demo | *Backend Dev* | 🔴 High | `[x] Integrated` |

---

## ⚡ Detalle de Historias Acotadas al MVP

### 📌 `CM-01`: Login 1-Click y Cliente Supabase SSR
* **Como** presentador de la demo,
* **Quiero** iniciar sesión con un solo clic en "Acceso Demo ACME Mining",
* **Para** ingresar inmediatamente a la plataforma sin perder tiempo escribiendo contraseñas.
* **Alcance estricto:** El botón de `/login` llama a `/api/auth/demo-login`; el Route Handler usa credenciales privadas, valida membresía `ACTIVE`, escribe las cookies de Supabase SSR y redirige al dashboard. No hay credenciales hardcodeadas ni inputs de identidad en el cliente.

---

### 📌 `CM-05` & `CM-06`: Provider Registry, plantilla dinámica y WebMCP
* **Como** agente de IA,
* **Quiero** recibir una lista variable de transportistas registrados y navegar al `provider_url` de cada candidato,
* **Para** obtener cotizaciones estructuradas directamente desde sus páginas WebMCP sin depender de una lista fija.
* **Alcance estricto:** Crear una plantilla React liviana `/providers/[carrierSlug]` que resuelve server-side `carrierSlug → carriers.code`, entrega solo configuración pública y ejecuta `document.modelContext.registerTool`. Los tres HTML existentes son referencias visuales del seed, no tres implementaciones separadas. `service_role` nunca llega al cliente. **Cero gestión interna de flotas o portales pesados.**

---

### 📌 `CM-07` & `CM-08`: Agente Runner & Decision Engine
* **Como** núcleo de CargoMesh,
* **Quiero** que el agente descubra y consulte todos los candidatos compatibles y calcule el ranking BALANCED,
* **Para** persistir y comparar un número variable de ofertas sin acoplar CargoMesh a proveedores específicos.
* **Alcance estricto:** Navegación WebMCP real desde un agente de navegador compatible, Result Bridge server-side y motor TypeScript puro. El Golden Flow verifica que los tres registros seed producen Andes 89, Inca 84 y Pacific 72.

---

### 📌 `CM-09`: Vista `/dispatch` y Explicabilidad
* **Como** cliente B2B,
* **Quiero** ver las alternativas disponibles y entender por qué una es recomendada,
* **Para** tomar una decisión informada basada en costo ($1,760), tiempo (31h) y confiabilidad (96%).
* **Alcance estricto:** Vista basada en colecciones runtime `0..N`. En el Golden Flow muestra Andes (89), Inca (84) y Pacific (72), pero debe renderizar automáticamente cualquier carrier adicional registrado y un estado vacío cuando no existan opciones.

---

## 🔒 Regla transversal: no hardcodear proveedores

- Prohibido usar arrays de nombres, IDs o URLs como fuente de candidatos.
- `carriers` + `carrier_services` + compatibilidad de carga son la única fuente de discovery.
- Andes, Inca y Pacific se permiten únicamente en seed, fixtures, pruebas y expectativas del Golden Flow.
- Añadir un cuarto carrier compatible debe requerir datos/configuración, no cambios en el orquestador, scorer o UI.

---

### 📌 `CM-13` & `CM-14`: Judge Activity Drawer y Reset
* **Como** juez evaluador,
* **Quiero** ver la traza técnica de los eventos y poder resetear la demo,
* **Para** comprobar que los datos no son falsos y probar escenarios de éxito y contingencia (recovery).
* **Alcance estricto:** Drawer lateral flotante con visor de eventos JSON y switch para forzar rechazo de Andes.
