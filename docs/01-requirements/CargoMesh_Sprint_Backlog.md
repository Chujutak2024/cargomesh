# CargoMesh — Backlog de Producto y Cronograma del Hackathon (MVP Scope)

> **Proyecto:** CargoMesh (WebMCP Challenge 2026)  
> **Versión:** 1.3.0 (Enfoque Pragmático y Acotado al Golden Flow Demo)  
> **Fecha límite de entrega:** 02 de Septiembre de 2026  
> **Catálogo de Requisitos Asociado:** `docs/01-requirements/CargoMesh_Catalogo_Requisitos.md`

---

## ⏳ Cronograma Real hacia la Entrega (29 Ago — 02 Sep)

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ VIERNES 28 AGOSTO: Base de Datos, Cimientos & Contratos (100% COMPLETADO ✅)                     │
│ └── 11 Migraciones Supabase, RLS, pgTAP Tests (18/18 PASS), Seed Auth, Esqueleto y Docs (00-03).│
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ SÁBADO 29 AGOSTO: Auth Demo, UI Shell & Páginas Fixture WebMCP                                   │
│ └── Login 1-click con Carlos Mendoza, Layout Dashboard y 3 páginas livianas de carriers.        │
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

1. **Autenticación:** 1 solo botón de acceso directo con el usuario demo pre-sembrado (`carlos.mendoza@acmemining.pe`). Sin pantallas complejas de recuperación de contraseña o registro masivo.
2. **Páginas de Transportistas (`/providers/*`):** Son únicamente **páginas de aterrizaje livianas con fixtures** (reutilizando los diseños ya listos en `mockups/provider_*.html`) cuyo único fin es registrar las tools en `document.modelContext`. No son sistemas de gestión interna de flotas.
3. **Solicitud de Carga:** El formulario Stepper viene pre-llenado con los datos de **FR-1042** (10 pallets $\times$ 800 kg = 8,000 kg, 18 m³, Callao $\rightarrow$ Santiago) para avanzar la demo rápidamente.
4. **Orquestación & Scoring:** Agente que llama a las 3 tools, aplica la fórmula BALANCED y guarda la decisión inmutable.
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
| `CM-00D` | Seed Demo Auth (`carlos.mendoza@acmemining.pe` como OWNER) | *DB Lead* | `[✅ Completado]` |
| `CM-00E` | Suite Oficial pgTAP (`npx supabase test db` 18/18 PASS) | *QA / DB Lead* | `[✅ Completado]` |
| `CM-00F` | Esqueleto de carpetas: `frontend/` (Next.js) y `backend/` (FastAPI) | *Fullstack Lead* | `[✅ Completado]` |
| `CM-00G` | Jerarquía Docs (`00-03`) y Catálogo Oficial de Requisitos | *Product Lead* | `[✅ Completado]` |

---

### 🚀 Tareas de Desarrollo Acotadas (29 Ago — 01 Sep)

| Clave | Actividad (Alcance Demo) | Épica Padre | Asignado a | Prioridad | Estado |
|:---:|---|---|:---:|:---:|:---:|
| `CM-01` | **Login 1-Click & Supabase SSR Client:** Botón de acceso directo con Carlos Mendoza y contexto de ACME. | ⚡ `EP-1` Auth & Shell | *Fullstack Lead* | 🔴 Alta | `[ ] Pendiente` |
| `CM-02` | **Layout B2B & Dashboard Base:** Sidebar y tabla de solicitudes mostrando `FR-1042` en estado `PENDING`. | ⚡ `EP-1` Auth & Shell | *Frontend Dev* | 🔴 Alta | `[ ] Pendiente` |
| `CM-03` | **Stepper FR-1042 (5 Pasos):** Formulario pre-llenado con 10 pallets × 800 kg = 8,000 kg y 18 m³. | ⚡ `EP-2` Intake Carga | *Frontend Dev* | 🔴 Alta | `[ ] Pendiente` |
| `CM-04` | **Validación & Normalización:** Cálculo automático de peso/volumen total y pre-check de integridad. | ⚡ `EP-2` Intake Carga | *Backend Dev* | 🔴 Alta | `[ ] Pendiente` |
| `CM-05` | **3 Páginas Carrier Fixture (`/providers/*`):** Montar vistas Andes, Inca y Pacific basadas en mockups. | ⚡ `EP-3` WebMCP Tools | *Frontend Dev* | 🔴 Alta | `[ ] Pendiente` |
| `CM-06` | **Registro WebMCP Tools:** Exponer `quote_freight` y `book_freight` deterministas en `document.modelContext`. | ⚡ `EP-3` WebMCP Tools | *Fullstack Dev* | 🔴 Alta | `[ ] Pendiente` |
| `CM-07` | **Agente Runner & Result Bridge:** Script en Python que visita las 3 páginas e inserta ofertas en Supabase. | ⚡ `EP-4` Orquestación & AI | *Backend / AI Lead* | 🔴 Alta | `[ ] Pendiente` |
| `CM-08` | **Decision Engine BALANCED:** Cálculo exacto de scores (Andes 89, Inca 84, Pacific 72) y snapshot v1. | ⚡ `EP-4` Orquestación & AI | *Backend / AI Lead* | 🔴 Alta | `[ ] Pendiente` |
| `CM-09` | **Vista `/dispatch` Reactiva:** Pantalla que muestra "Buscando..." y luego las cards con Andes recomendada. | ⚡ `EP-4` Orquestación & AI | *Frontend Dev* | 🔴 Alta | `[ ] Pendiente` |
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

### 📌 `CM-05` & `CM-06`: Páginas Fixture de Carriers y WebMCP
* **Como** agente de IA,
* **Quiero** navegar a `/providers/andes`, `/providers/inca` y `/providers/pacific` y ejecutar `quote_freight`,
* **Para** obtener las cotizaciones estructuradas ($1,760, $1,920, $1,590) directamente desde la web del carrier.
* **Alcance estricto:** Usar los HTMLs de `mockups/provider_*.html` como componentes React livianos que ejecutan `document.modelContext.registerTool`. **Cero gestión interna de flotas o portales pesados.**

---

### 📌 `CM-07` & `CM-08`: Agente Runner & Decision Engine
* **Como** núcleo de CargoMesh,
* **Quiero** que el agente extraiga las 3 cotizaciones y calcule el ranking BALANCED,
* **Para** persistir las ofertas en la base de datos y determinar que Andes Freight gana con 89 puntos.
* **Alcance estricto:** Script en Python que simula la navegación / llamada a las tools de los providers y corre la fórmula matemática canónica.

---

### 📌 `CM-09`: Vista `/dispatch` y Explicabilidad
* **Como** cliente B2B,
* **Quiero** ver cómo aparecen las 3 alternativas y por qué Andes es la recomendada,
* **Para** tomar una decisión informada basada en costo ($1,760), tiempo (31h) y confiabilidad (96%).
* **Alcance estricto:** Vista que muestra tarjetas ordenadas: Andes (89 pts - Badge Recomendado), Inca (84 pts) y Pacific (72 pts) con botón de selección.

---

### 📌 `CM-13` & `CM-14`: Judge Activity Drawer y Reset
* **Como** juez evaluador,
* **Quiero** ver la traza técnica de los eventos y poder resetear la demo,
* **Para** comprobar que los datos no son falsos y probar escenarios de éxito y contingencia (recovery).
* **Alcance estricto:** Drawer lateral flotante con visor de eventos JSON y switch para forzar rechazo de Andes.
