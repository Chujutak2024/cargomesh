# CargoMesh — Backlog de Producto y Cronograma del Hackathon (MVP Scope)

> **Proyecto:** CargoMesh (WebMCP Challenge 2026)  
> **Versión:** 1.4.0 (Provider Registry Dinámico + Golden Flow Demo)
> **Fecha límite de entrega:** 02 de Septiembre de 2026  
> **Catálogo de Requisitos Asociado:** `docs/01-requirements/CargoMesh_Catalogo_Requisitos.md`

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

1. **Autenticación:** Login email/password con Supabase Auth. El entorno local usa exclusivamente el fixture `demo.operator@cargomesh.test` con membresía `SUPERVISOR / ACTIVE`; la cuenta hospedada se provisiona por separado y sus credenciales no se almacenan en el repositorio ni se muestran en la UI.
2. **Provider Registry + plantilla (`/providers/[carrierSlug]`):** Los candidatos se consultan dinámicamente desde `carriers` y `carrier_services`. La demo aloja páginas livianas para los tres registros seed reutilizando `mockups/provider_*.html`, pero la lógica opera sobre `0..N` carriers y también admite un `provider_url` externo. No son sistemas de gestión interna de flotas.
3. **Solicitud de Carga:** El formulario Stepper viene pre-llenado con los datos de **FR-1042** (10 pallets $\times$ 800 kg = 8,000 kg, 18 m³, Callao $\rightarrow$ Santiago) para avanzar la demo rápidamente.
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
| `CM-01` | **Login email/password & Supabase SSR Client:** Sesión real con usuario autorizado y membresía `ACTIVE`, sin identidad ficticia en cliente. | ⚡ `EP-1` Auth & Shell | *Fullstack Lead* | 🔴 Alta | `[ ] Pendiente` |
| `CM-02` | **Layout B2B & Dashboard Base:** Sidebar y tabla de solicitudes mostrando `FR-1042` en estado `PENDING`. | ⚡ `EP-1` Auth & Shell | *Frontend Dev* | 🔴 Alta | `[ ] Pendiente` |
| `CM-03` | **Stepper FR-1042 (5 Pasos):** Formulario pre-llenado con 10 pallets × 800 kg = 8,000 kg y 18 m³. | ⚡ `EP-2` Intake Carga | *Frontend Dev* | 🔴 Alta | `[ ] Pendiente` |
| `CM-04` | **Validación & Normalización:** Cálculo automático de peso/volumen total y pre-check de integridad. | ⚡ `EP-2` Intake Carga | *Backend Dev* | 🔴 Alta | `[ ] Pendiente` |
| `CM-05` | **Provider Registry + plantilla dinámica:** Resolver candidatos desde Supabase y montar `/providers/[carrierSlug]`; Andes, Inca y Pacific son registros seed. | ⚡ `EP-3` WebMCP Tools | *Frontend / Data* | 🔴 Alta | `[ ] Pendiente` |
| `CM-06` | **Registro WebMCP Tools genérico:** Exponer `quote_freight` y `book_freight` desde la configuración del carrier actual, sin ramas por nombre. | ⚡ `EP-3` WebMCP Tools | *Fullstack Dev* | 🔴 Alta | `[ ] Pendiente` |
| `CM-07` | **Browser Agent & Result Bridge:** Descubrir `CandidateProvider[0..N]`, navegar cada `provider_url` con WebMCP real y persistir resultados idempotentes. | ⚡ `EP-4` Orquestación & AI | *WebMCP / Data Lead* | 🔴 Alta | `[ ] Pendiente` |
| `CM-08` | **Decision Engine BALANCED genérico:** Rankear cualquier colección de ofertas elegibles; verificar 89/84/72 solo como caso Golden Flow. | ⚡ `EP-4` Orquestación & AI | *Backend / Data Lead* | 🔴 Alta | `[ ] Pendiente` |
| `CM-09` | **Vista `/dispatch` Reactiva 0..N:** Mostrar progreso y cards según candidatos/resultados runtime, incluida la ausencia de opciones. | ⚡ `EP-4` Orquestación & AI | *Frontend Dev* | 🔴 Alta | `[ ] Pendiente` |
| `CM-10` | **Selección & Booking Request:** Clic en "Seleccionar Andes" y paso a espera con cronómetro de 15 min. | ⚡ `EP-5` Booking & Recovery | *Fullstack Dev* | 🔴 Alta | `[ ] Pendiente` |
| `CM-11` | **Timeline de Tracking:** Vista `/tracking` con hito aduanero de frontera Santa Rosa/Chacalluta y placas. | ⚡ `EP-5` Booking & Recovery | *Frontend Dev* | 🔴 Alta | `[ ] Pendiente` |
| `CM-12` | **Modal de Recovery:** Flujo de contingencia si Andes rechaza $\rightarrow$ sugerir Inca Logistics en 1 clic. | ⚡ `EP-5` Booking & Recovery | *Backend / AI Lead* | 🔴 Alta | `[ ] Pendiente` |
| `CM-13` | **Judge Activity Drawer:** Overlay flotante con streaming de eventos, latencias y visor JSON para jueces. | ⚡ `EP-6` Jueces & Demo | *Frontend Dev* | 🔴 Alta | `[ ] Pendiente` |
| `CM-14` | **Controles de Fixture & Reset:** Switch `ACCEPT/REJECT` y botón para reiniciar la demo en 1 segundo. | ⚡ `EP-6` Jueces & Demo | *Backend Dev* | 🔴 Alta | `[ ] Pendiente` |

---

## ⚡ Detalle de Historias Acotadas al MVP

### 📌 `CM-01`: Login 1-Click y Cliente Supabase SSR
* **Como** presentador de la demo,
* **Quiero** iniciar sesión con un solo clic en "Acceso Demo ACME Mining",
* **Para** ingresar inmediatamente a la plataforma sin perder tiempo escribiendo contraseñas.
* **Alcance estricto:** Botón en `/login` que llama a `signInWithPassword` con el usuario ya sembrado y redirige al dashboard.

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
