# CargoMesh V2 — Master Backlog & Operational Plan
## Amazon Developer Hackathon (Track Alexa+)
**Periodo:** Sábado 19 de Septiembre al Lunes 19 de Octubre de 2026  
**Rama Base:** `codex/c-mcp-contracts` (⚠️ **Regla de Oro:** ¡NUNCA hacer ramas ni merge directo a `main`!)

> 📚 **Suite Documental de Arquitectura V2:**  
> • **Blueprint Maestro:** [CARGOMESH_V2_EVOLUTION_BLUEPRINT.md](./CARGOMESH_V2_EVOLUTION_BLUEPRINT.md)  
> • **Esquema de Base de Datos:** [DATABASE_SCHEMA_V2_PROPOSAL.md](./DATABASE_SCHEMA_V2_PROPOSAL.md)  
> • **Diagramas de Dominio y Persistencia:** [BACKEND_DOMAIN_AND_PERSISTENCE_DIAGRAMS.md](./BACKEND_DOMAIN_AND_PERSISTENCE_DIAGRAMS.md)  
> • **Taxonomía de Carga y Precios USD:** [CARGO_DIMENSIONS_AND_TAXONOMY_V2.md](./CARGO_DIMENSIONS_AND_TAXONOMY_V2.md)  
> • **Plan Operativo y Sprints:** [MASTER_BACKLOG.md](./MASTER_BACKLOG.md) *(Este documento)*

---

## 👥 1. Asignaciones por Desarrollador (Sprint 1 Recalibrado — V2 Multimodal & Enterprise)
**Periodo:** 19 al 25 de Septiembre de 2026 | **Hito:** Gate-1 de Integración (Viernes 25 Sep)

Cada integrante cuenta con una asignación clara y de alto impacto que alimenta el Golden Flow y la arquitectura V2:

### 🔴 Cristhian Chujutalli — BE-2 & Tech Lead (Arquitectura de Datos y Motor de Fletes)
- **Tarea 1 (Core Backend & DB V2):** `HAC-6` — Aplicar migración aditiva V2 (`facilities`, `carrier_depots`, `route_corridors`, taxonomía en `freight_requests`) + servicio de idempotencia backend.  
  🌿 **Rama:** `feat/be2-hac-6-draft-idempotency` | ⏱️ **Límite:** Miércoles 23 Sep.
- **Tarea 2 (Liderazgo & Integración):** `HAC-10` — [GATE-1] Coordinar sesión sincrónica de integración dual (Web + Alexa creando fletes en Supabase) y demo interna.  
  🌿 **Rama:** `feat/cycle-1-integration` ➔ Merge a `codex/c-mcp-contracts` | ⏱️ **Límite:** Viernes 25 Sep.

### 🟠 Axel Arista — BE-1 / Alexa & Cloud Lead (Voz y Servidor MCP Oficial)
- **Tarea 1 (Voz & Protocolo MCP):** `HAC-5` — Configurar Skill en Alexa Developer Console con slots V2, conectar al endpoint Streamable HTTP `/mcp` y configurar Progressive Response.  
  🌿 **Rama:** `feat/be1-hac-5-alexa-skill-base` | ⏱️ **Límite:** Miércoles 23 Sep.
- **Tarea 2 (Soporte & Cloud):** `HAC-17` — Llenar formulario oficial de Devpost para solicitar $150 de créditos AWS y verificar cuotas Bedrock en us-east-1.  
  ⚡ **Tipo:** Gestión externa en AWS / Devpost | ⏱️ **Límite:** Lunes 21 Sep (Listo para cerrar en Done).

### 🟣 Jean Paul — BE-3 / CI, QA & Friction Logs Lead (Blindaje y Calificación)
- **Tarea 1 (Testing del Motor MCDA 6D):** `HAC-7` — Crear suite de pruebas unitarias para el motor determinístico BALANCED (verificar scores Andes 89, Inca 84, Pacific 72) y asegurar 0 errores en CI.  
  🌿 **Rama:** `feat/be3-hac-7-ci-baseline-runner` | ⏱️ **Límite:** Miércoles 23 Sep.
- **Tarea 2 (Bono del Jurado +10%):** `HAC-18` — [OPS] Estructura en Google Drive para evidencias de Kiro Crew ($5K Builder Award) y catalogación de Friction Logs (`FL-01` a `FL-03`).  
  ⚡ **Estado:** ✅ Completado (Enlace anclado en Linear).

### 🔵 Luis — FE-1 / Enterprise Shipper Lead (Experiencia de Usuario de Carga)
- **Tarea 1 (Diseño Base):** `HAC-19` — Estandarizar componentes base (Botón Dorado `#d2a95f`, inputs industriales, badges de estatus) según `FRONTEND_GUIDELINES.md`.  
  🌿 **Rama:** `feat/fe1-hac-19-design-tokens-components` | ⏱️ **Límite:** Martes 22 Sep.
- **Tarea 2 (Stepper Enterprise V2):** `HAC-8` — Formulario Stepper `/freight-request/new` con Sedes del Shipper (`facilities`), Taxonomía/CBM (`cargo_category_v2`) y Subasta Inversa inDrive.  
  🌿 **Rama:** `feat/fe1-hac-8-intake-stepper-hono` | ⏱️ **Límite:** Miércoles 23 Sep.

### 🟡 Juan Antonio Coronado — FE-2 / Carrier Surface & Map Visualization Lead (Visualización "WOW")
- **Tarea 1 (Mapa Multimodal Interactivo):** `HAC-9` — Componente de Mapa de Corredores (Callao ➔ Santiago / Las Bambas ➔ Callao) mostrando tramos carretera/marítimo/riel, altitud 4,100m, pasos fronterizos y patios de carriers (`carrier_depots`).  
  🌿 **Rama:** `feat/fe2-hac-9-carrier-tools-audit` | ⏱️ **Límite:** Miércoles 23 Sep.
- **Tarea 2 (Gobernanza & Compuerta Humana):** `HAC-20` — [QA / AUDIT] Validar compuerta financiera (> $5,000 USD requiere aprobación de supervisor) y auditoría de reglas del jurado.  
  ⚡ **Tipo:** Auditoría y verificación de UI en local | ⏱️ **Límite:** Jueves 24 Sep.

---

## 📁 Detalle de Definición de Tarea: HAC-18 (Google Drive & Evidencias)
**Asignado:** Jean Paul (BE-3) | **Límite:** Lunes 21 de Septiembre  
**Objetivo:** Crear la carpeta compartida en Google Drive para el equipo de 5 integrantes con las 4 subcarpetas oficiales para almacenar los archivos pesados (videos, audios, capturas y transcripciones de Kiro Crew) y anclar el enlace en Linear.

### Estructura Requerida de Carpetas en Drive:
```text
📁 CargoMesh - Amazon Hackathon 2026/
├── 📁 01_Kiro_Crew_Evidencias/    --> Transcripciones y capturas para el premio AWS Builder ($5K)
│   ├── 📁 Axel_Arista_BE1/
│   ├── 📁 Cristhian_Chujutalli_BE2/
│   ├── 📁 Jean_Paul_BE3/
│   ├── 📁 Luis_FE1/
│   └── 📁 Juan_Antonio_FE2/
├── 📁 02_Friction_Logs_Borradores/ --> Incidentes y workarounds para el +10% bonus del jurado
├── 📁 03_Audio_y_Locucion_Alexa/   --> Pruebas de voz y diálogos grabados
└── 📁 04_Video_Raw_y_Clips/       --> Grabaciones de pantalla en 1080p para el video final
```

### Criterios de Aceptación (Definition of Done):
- [x] Carpeta principal y las 4 subcarpetas creadas en Google Drive.
- [x] Acceso de edición compartido con los correos de los 5 integrantes del equipo.
- [x] Enlace al Drive anclado en Linear: Enlace en Links del proyecto.
- [x] Dejar el enlace como comentario en el ticket `HAC-18` y mover a Done.

---

## 📋 2. Fichas Técnicas Detalladas de las Tareas Recalibradas (Sprint 1)
> 📄 **Fichas Completas Estandarizadas para Linear (6 Secciones):** Consulta [`docs/architecture-v2/SPRINT1_RECALIBRATED_ISSUES.md`](./SPRINT1_RECALIBRATED_ISSUES.md) para copiar y pegar directamente las plantillas con contexto, restricciones, ramas, coordinación y friction logs.

### 🔴 HAC-6 — [BE-2] Migración Aditiva V2 + Servicio Backend DRAFT a PENDING
- **Asignado:** Cristhian Chujutalli (BE-2 & Tech Lead) | 🌿 **Rama:** `feat/be2-hac-6-draft-idempotency`
- **Objetivo:** Implementar las tablas satélite (`facilities`, `carrier_depots`, `route_corridors`, `commercial_scoring_policies`) y columnas aditivas de taxonomía en Supabase local, junto con el endpoint idempotente `POST /api/v2/freight-requests` y su transición segura a `PENDING`.
- **Criterios de Aceptación:**
  - [ ] Migración SQL aplicada localmente sin romper ninguna de las 20 migraciones existentes ni los 160 tests pgTAP.
  - [ ] Tablas `facilities`, `carrier_depots` y `route_corridors` creadas con índices espaciales/coordenadas.
  - [ ] Enumeradores `cargo_category_v2_enum` y `packaging_type_enum` registrados.
  - [ ] Columnas `total_cbm`, `chargeable_weight_kg`, `is_stackable` y `flow_type` agregadas a `freight_requests`.
  - [ ] Endpoint `POST /api/v2/freight-requests` valida `creation_idempotency_key` (SHA-256) y crea borrador con `draft_version = 1`.
  - [ ] Método `submitDraft()` valida campos requeridos y transiciona a `status = 'PENDING'`.

---

### 🟠 HAC-5 — [BE-1] Configurar Alexa Skill con Slots V2 y Servidor MCP Oficial
- **Asignado:** Axel Arista (BE-1 / Alexa & Cloud Lead) | 🌿 **Rama:** `feat/be1-hac-5-alexa-skill-base`
- **Objetivo:** Conectar Alexa Skills Kit con el endpoint oficial `@modelcontextprotocol/sdk: 1.30.0` Streamable HTTP (`/mcp`), soportando los slots multimodales y Progressive Response para latencias de ruteo.
- **Criterios de Aceptación:**
  - [ ] Skill configurada en Alexa Developer Console con invocación `"cargo mesh"`.
  - [ ] Intents configurados: `ShipFreightIntent` (origen, destino, bultos, presupuesto USD) y `ConfirmBookingIntent`.
  - [ ] Conexión verificada contra el endpoint local `/mcp` mediante Streamable HTTP.
  - [ ] Directiva *Progressive Response* implementada para emitir audio de espera mientras se cotiza en Bedrock / Google Maps.
  - [ ] Generación de voz con SSML enriquecido (`<speak>...</speak>`) resumiendo la mejor opción del ranking.
  - [ ] JSON del modelo de interacción exportado a `docs/architecture-v2/alexa-interaction-model.json`.

---

### 🔵 HAC-8 — [FE-1] Stepper Enterprise V2: Sedes, Taxonomía/CBM y Subasta inDrive
- **Asignado:** Luis (FE-1 / Enterprise Shipper Lead) | 🌿 **Rama:** `feat/fe1-hac-8-intake-stepper-hono`
- **Objetivo:** Transformar el formulario `/freight-request/new` en el Stepper Enterprise de 3 pasos que alimenta la arquitectura multimodal.
- **Criterios de Aceptación:**
  - [ ] **Paso 1 (Sedes & Flujo):** Selector de Facility origen y destino (`FAC-CALLAO`, `FAC-BAMBAS`, `FAC-SANTIAGO`, etc.) con badge de país y tipo de flujo (`OUTBOUND`, `INBOUND`, `INTERNAL_TRANSFER`).
  - [ ] **Paso 2 (Carga & Cubicaje):** Selector de las 6 categorías industriales (`MINING_BULK`, `HEAVY_MACHINERY`, `COLD_CHAIN`, `HAZMAT`, `HIGH_VALUE`, `GENERAL_DRY`), empaque (`PALLETS`, `CONTAINER_20GP`, `BIG_BAG`, etc.), inputs de dimensiones (L x W x H en cm), cálculo automático de CBM vs. peso real, y toggle `is_stackable` (+20% recargo si es false).
  - [ ] **Paso 3 (Subasta inDrive):** Despliegue de ofertas recibidas de los carriers en tiempo real, ordenadas por Score MCDA, destacando al ganador #1 con desglose transparente de costos en USD.
  - [ ] Conexión contra los endpoints de Hono V2 con validación Zod en cliente.

---

### 🔵 HAC-19 — [FE-1] Estandarización de Componentes Base y Tokens de Diseño
- **Asignado:** Luis (FE-1 / Enterprise Shipper Lead) | 🌿 **Rama:** `feat/fe1-hac-19-design-tokens-components`
- **Objetivo:** Unificar los tokens visuales, tipografías y componentes UI reutilizables según `FRONTEND_GUIDELINES.md`.
- **Criterios de Aceptación:**
  - [ ] Botón de acción principal con acento dorado institucional (`#d2a95f` / hover `#b88d44`).
  - [ ] Componentes de input industrial para pesaje, volumen y selector de unidades.
  - [ ] Badges semánticos para estatus de fletes (`DRAFT`, `PENDING`, `OPTIONS_READY`, `BOOKED`).
  - [ ] Soporte completo de selector de idioma `es` / `en` sin textos duros.

---

### 🟡 HAC-9 — [FE-2] Visualizador de Mapa de Corredores Multimodales y Patios
- **Asignado:** Juan Antonio Coronado (FE-2) | 🌿 **Rama:** `feat/fe2-hac-9-carrier-tools-audit`
- **Objetivo:** Implementar el componente visual de mapa interactivo (Leaflet o Google Maps) que grafica el corredor multimodal O-D y las bases operativas de los carriers.
- **Criterios de Aceptación:**
  - [ ] Renderizado de polilínea GeoJSON para el corredor Callao ➔ Santiago y Las Bambas ➔ Callao.
  - [ ] Tramos codificados por color según el modo de transporte (Carretera: Azul, Cabotaje: Cian, Riel: Naranja).
  - [ ] Marcadores interactivos para las sedes de ACME Mining (`facilities`) y patios de transportistas (`carrier_depots`).
  - [ ] Infowindow con datos del corredor: distancia en km / millas náuticas, peajes, altitud máxima (4,100 msnm) y aduanas fronterizas.

---

### 🟡 HAC-20 — [FE-2] Auditoría de Gobernanza y Compuerta Financiera (> $5,000 USD)
- **Asignado:** Juan Antonio Coronado (FE-2) | ⚡ **Tipo:** Auditoría y verificación de UI en local
- **Objetivo:** Verificar la integridad de los contratos comerciales, la honestidad de carriers y el comportamiento de la compuerta humana en fletes de alto valor.
- **Criterios de Aceptación:**
  - [ ] Verificación de que solo Andes, Inca y Pacific figuren como carriers live, rotulando a Polaris y Apex como datos de escenario.
  - [ ] Comprobación en UI: si una cotización supera los $5,000 USD y el usuario es `REQUESTER`, se bloquea el booking automático y se despliega el banner `"Requiere Aprobación de Supervisor"`.
  - [ ] Verificación de que el botón de confirmación de booking exija el `confirmationReference` de voz emitido por Alexa.
  - [ ] Redacción del informe en `docs/04-execution/SPRINT1_AUDIT_REPORT.md`.

---

### 🟣 HAC-7 — [BE-3] Suite de Pruebas del Motor MCDA 6D + Logging de Friction Logs
- **Asignado:** Jean Paul (BE-3 / CI & QA Lead) | 🌿 **Rama:** `feat/be3-hac-7-ci-baseline-runner`
- **Objetivo:** Desarrollar las pruebas automatizadas del motor determinístico BALANCED (MCDA 6D) asegurando el Golden Flow, y documentar los Friction Logs para el bono del 10% del jurado.
- **Criterios de Aceptación:**
  - [ ] Suite de pruebas en Vitest / Node comprobando la fórmula de los 6 pesos (Costo 25%, SLA 25%, Tiempo 20%, Disponibilidad 10%, Ruta 10%, Historial 10%).
  - [ ] Verificación exacta de los scores canónicos Callao ➔ Santiago: Andes Express (89), Transportes Inca (84), Pacific Cargo (72).
  - [ ] Verificación de que `pnpm test` y `npx supabase test db` pasen al 100% en verde sin warnings.
  - [ ] Redacción de 3 Friction Logs documentando bloqueos resueltos en `docs/04-execution/friction-logs/FL-01.md` a `FL-03.md`.

---

### 🔴 HAC-10 — [Tech Lead / BE-2] GATE-1: Integración Dual Web/Voz y Demo Interna
- **Asignado:** Cristhian Chujutalli (BE-2 & Tech Lead) | 🌿 **Rama:** `feat/cycle-1-integration` ➔ `codex/c-mcp-contracts`
- **Objetivo:** Sesión sincrónica de cierre de Sprint 1 donde se fusionan las ramas de los 5 integrantes y se ejecuta la primera prueba de humo integral.
- **Criterios de Aceptación:**
  - [ ] Merge limpio sin conflictos de las 5 ramas de desarrollo hacia `feat/cycle-1-integration`.
  - [ ] Prueba de humo 1 (Web): Crear flete desde el Stepper Enterprise V2 ➔ Ver oferta en Subasta inDrive ➔ Persistencia en Supabase.
  - [ ] Prueba de humo 2 (Alexa): Hablarle al simulador de Alexa ➔ Invocar `/mcp` ➔ Crear flete con idempotencia ➔ Confirmar booking por voz.
  - [ ] Merge final autorizado a `codex/c-mcp-contracts` (congelando la base para Sprint 2).

---

## 💻 2. Cómo arrancar tu rama en Git (Comandos para Terminal)
Para iniciar tu trabajo técnico sin errores de ramas ni colisiones:

```bash
# 1. Asegúrate de tener los últimos cambios de la base
git fetch origin
git checkout codex/c-mcp-contracts
git pull origin codex/c-mcp-contracts

# 2. Crea tu rama con tu nombre asignado arriba
git checkout -b <nombre-de-tu-rama>

# 3. Abre tu Draft PR inmediatamente en GitHub
gh pr create --base codex/c-mcp-contracts --draft
```

---

## 🤖 3. Matriz de Automatización GitHub ➔ Linear
El tablero de Linear se actualiza automáticamente según tus acciones en GitHub:

| Acción en Git / GitHub | Comando / Evento | Estado en Linear | Explicación |
|---|---|---|---|
| **1. Abres tu Draft PR** | `gh pr create --draft` | 🟡 **In Progress** | Linear detecta el borrador y pasa tu tarea a "En Progreso". |
| **2. Haces commits de avance** | `git commit -m "feat: avance Part of HAC-X"` | 🟡 **In Progress** | El commit queda registrado en el historial de la tarea. |
| **3. Terminas y pides revisión** | Marcar "Ready for review" y poner `Closes HAC-X` | 🟢 **In Review** | Linear le notifica a Cristhian y Axel para revisar tu código. |
| **4. Cristhian o Axel hacen Merge** | Se fusiona a `codex/c-mcp-contracts` | 🟣 **Done** | Linear cierra automáticamente tu tarea con check verde. |

---

## ⚖️ 4. Checklist de Auditoría del Jurado (GATE-1: Jueves 24 / Viernes 25)
Juan Antonio (`HAC-20`), Cristhian y Axel verificarán estos 6 puntos antes de cerrar el Sprint 1:

1. **Honestidad de Carriers:** Solo Andes, Inca y Pacific son WebMCP live. Polaris y Apex rotulados explícitamente como *"Dato de escenario / Roadmap"*.
2. **Escenario Canónico en 1 Clic:** El botón Callao ➔ Santiago en `/freight-request/new` llena los datos en 1 clic sin errores de validación.
3. **Inglés para Jueces:** Al poner el selector de idioma en `en`, toda la interfaz se visualiza en inglés correcto sin textos quemados en español.
4. **Judge Drawer Operativo:** El panel lateral registra eventos con timestamps y estado 200.
5. **Evidencias Kiro Crew:** Prompts y transcripciones de la semana guardados en `01_Kiro_Crew_Evidencias/` en Google Drive.
6. **Pipeline Verde:** `pnpm release:verify` pasando con 0 errores de TypeScript y 160/160 tests pgTAP en verde.

---

## 🛠️ 5. Herramientas Exactas de Backend (Stack de Desarrollo Local)
Para que Axel, Cristhian y Jean Paul no duden de qué software o comandos usar:

| Componente Backend | Herramienta Oficial | Entorno / Acceso Local |
|---|---|---|
| **Base de Datos & RLS** | Supabase CLI Local (PostgreSQL 15) | Comandos: `npx supabase start`, `npx supabase db reset`.<br>Interfaz visual: Supabase Studio en `http://127.0.0.1:54323`. |
| **Testing de Base de Datos** | pgTAP | Comando: `npx supabase test db` (160 pruebas automatizadas). |
| **API Backend V2** | Hono v4 + TypeScript + Zod | En `cargomesh/src/server/hono/`. Tipado estricto con schemas compartidos. |
| **Servidor MCP** | `@modelcontextprotocol/sdk: 1.30.0` | Streamable HTTP en `src/server/mcp/http.ts`. Se prueba con `pnpm test:mcp`. |
| **Simulador de Alexa** | Alexa Developer Console | Consola web oficial (`developer.amazon.com/alexa/console/ask`) en pestaña Test con el simulador de voz y texto. |
| **AI Tooling & Prompts** | Kiro Crew | Para generar esquemas y prompts. Exportar el `.jsonl` o `.md` de cada sesión al Drive. |

---

## 🔗 6. Enlaces Clave del Proyecto
- 🎨 **Guía Oficial de Frontend & Paleta:** [`docs/architecture-v2/FRONTEND_GUIDELINES.md`](file:///c:/Users/HP/Documents/cargomesh/docs/architecture-v2/FRONTEND_GUIDELINES.md)
- ☁️ **Solicitud de $150 Créditos AWS:** [Google Forms Oficial de Amazon](https://forms.gle/GaHFxSbBQNG9Kti6A)
- 🐙 **Pull Request Activo #74:** [GitHub PR #74](https://github.com/Chujutak2024/cargomesh/pull/74)

---

## 🎙️ 7. ¿Cómo se conecta Alexa con la Flota WebMCP? (Arquitectura Dual)
> **Principio de Diseño:** Alexa **NO descarta** WebMCP; **Alexa comanda a WebMCP**.  
> El servidor MCP (`/mcp`) es la interfaz ejecutiva que Alexa invoca por voz; por debajo, CargoMesh orquesta a los navegadores de los carriers (Andes, Inca, Pacific) usando sus 5 tools WebMCP para cotizar y reservar en tiempo real.

```mermaid
sequenceDiagram
    autonumber
    actor User as Usuario (Voz / Shipper)
    participant Alexa as Alexa Skill (Echo / Simulador)
    participant MCP as Servidor CargoMesh MCP (/mcp)
    participant Core as Shared Services & BALANCED Engine
    participant WebMCP as Flota WebMCP (Andes, Inca, Pacific)

    User->>Alexa: "Alexa, tell CargoMesh to ship 10 pallets from Callao to Santiago"
    Alexa->>MCP: Invoca tools/call create_freight_request + find_freight_options
    MCP->>Core: Inicia orquestación y despacho
    Core->>WebMCP: Ejecuta quote_freight y reserve_capacity en carriers
    WebMCP-->>Core: Respuestas de cotización (Andes: $3,200, Inca: $3,800, Pacific: $4,500)
    Core->>Core: Motor BALANCED calcula rankings (Andes: 89, Inca: 84, Pacific: 72)
    Core->>MCP: Retorna recomendación ganadora (Andes Freight)
    MCP-->>Alexa: Speech enriquecido por Amazon Bedrock
    Alexa-->>User: "I found 3 quotes. Best option is Andes Express at $3,200 (score 89%). Shall I book it?"
    User->>Alexa: "Yes, book Andes"
    Alexa->>MCP: tools/call authorize_and_book (confirmationReference)
    MCP->>WebMCP: Andes WebMCP -> confirm_booking -> BOOKING CONFIRMED
    Alexa-->>User: "Booking confirmed! ID #BK-7892. Tracking is now active."
```

---

## 📁 8. Ubicaciones Exactas de Exportación y Entregables
| Artefacto | Responsable | Dónde se Genera / Exporta | Dónde se Guarda en el Repositorio / Drive |
|---|---|---|---|
| **Alexa Interaction Model** | Axel (BE-1) | Alexa Developer Console ➔ Interaction Model ➔ JSON Editor ➔ Export | `cargomesh/docs/architecture-v2/alexa-interaction-model.json` |
| **Payload Mapeo Alexa ➔ MCP** | Axel (BE-1) | Simulador de Alexa / Curl payload | `cargomesh/docs/architecture-v2/alexa-mcp-mapping-payload.json` |
| **Formulario Créditos AWS ($150)** | Axel (BE-1) | Formulario oficial Devpost | `https://forms.gle/GaHFxSbBQNG9Kti6A` |
| **Transcripciones Kiro Crew** | Todo el equipo | Kiro Crew Chat ➔ Exportar historial de prompts | Google Drive: `01_Kiro_Crew_Evidencias/<tu_nombre>/` |
| **Friction Logs (+10% Bonus)** | Jean Paul (BE-3) | Registro de bugs/bloqueos en AWS/Kiro | `cargomesh/docs/04-execution/FRICTION_LOGS.md` y Drive `02_Friction_Logs_Borradores/` |
| **Reporte de Auditoría Sprint 1** | Juan Antonio (FE-2) | Auditoría de reglas del jurado | `cargomesh/docs/04-execution/SPRINT1_AUDIT_REPORT.md` |
| **Guion Demo Interna (2 min)** | Juan Antonio (FE-2) | Flujo dual Web + Alexa | `cargomesh/docs/04-execution/SPRINT1_DEMO_SCRIPT.md` |
| **Componentes Base UI** | Luis (FE-1) | Código fuente frontend | `cargomesh/src/components/ui/button.tsx`, `input.tsx`, `status-badge.tsx` |

---

## 🏆 9. Matriz de Premios Oficiales Devpost ($190K Pool)
| Categoría | Premio | Requisito Oficial | Estrategia CargoMesh |
|---|---|---|---|
| **Primary Track: Alexa+** | **1º: $25K cash + $15K AWS**<br>2º: $15K cash + $5K AWS<br>3º: $4K cash + $1K AWS | Servidor MCP (spec `2025-11-25+`, Streamable HTTP) o Skill en acción. Video ≤ 3 min en inglés. | `/mcp` con `@modelcontextprotocol/sdk: 1.30.0` + Alexa Skill Kit + Flujo Golden Flow Callao ➔ Santiago con compuerta humana. |
| **Mini Challenge: AWS Builder** | **$5K cash + $5K AWS** | *"Building with Kiro Crew qualifies on its own"*. O servicios AWS (Bedrock). | Doble validación: Kiro Crew (transcripciones) + Amazon Bedrock Claude 3 Haiku en `lib/bedrock.ts`. |
| **Mini Challenge: Open Source** | **$5K cash + $5K AWS** | Proyecto open source o paquete nuevo con licencia MIT durante el hackathon. | Publicación de `packages/cargomesh-mcp` (npm/GitHub) con esquemas y compuerta humana. |
| **⭐ Multiplicador: +10% Bonus** | **Hasta +10% en puntaje jurado** | Friction Logs documentados: Tarea, pasos, esperado vs real, severidad, workaround y sugerencia. | 3 Friction Logs detallados durante Sprints 1 a 4 (Kiro Crew, MCP SDK y Bedrock). |

---

## 🗓️ 10. Hoja de Ruta de Sprints (Sprints 2 al 5)

### 🗓️ CYCLE 2 (Sprint 2): Orquestación de Búsqueda y Despacho WebMCP
**Fechas:** Sábado 26 Sep — Viernes 02 Oct 2026  
**Meta:** Búsqueda disparada por Alexa (`find_freight_options`), runner consulta a los 3 carriers en vivo y el motor BALANCED entrega las ofertas rankeadas en tiempo real.
- **BE-1 (`HAC-201`):** Tool MCP `find_freight_options` e Intent de búsqueda en Alexa.
- **BE-2 (`HAC-202`):** Endpoints Hono de candidatos y evaluación BALANCED (scores: Andes 89, Inca 84, Pacific 72).
- **BE-3 (`HAC-203`):** Puente de despacho durable Node ➔ WebMCP Runner.
- **FE-1 (`HAC-204`):** Workspace de despacho `/dispatch/[id]` con tarjetas de cotización en vivo.
- **FE-2 (`HAC-205`):** Visualización en tiempo real de llamadas de carriers en Judge Drawer.
- **GATE-2:** Prueba conjunta E2E de búsqueda por voz.

### 🗓️ CYCLE 3 (Sprint 3): Aprobación Humana, Booking y Flujo de Recuperación
**Fechas:** Sábado 03 Oct — Viernes 09 Oct 2026  
**Meta:** Flujo comercial seguro completado: confirmación por voz (`authorize_and_book` con compuerta humana) y recovery automático ante rechazo simulado de Andes ➔ Inca CONFIRMED.
- **BE-1 (`HAC-301`):** Tools MCP `authorize_and_book`, `get_booking_status` y `recover_booking`.
- **BE-2 (`HAC-302`):** Persistencia de bookings en PostgreSQL y transiciones de estado.
- **BE-3 (`HAC-303`):** Coordinador de reservas WebMCP y captura de veredicto (Confirmed vs Rejected).
- **FE-1 (`HAC-304`):** Modal de autorización humana y pantalla `/tracking/[id]` con Leaflet map.
- **FE-2 (`HAC-305`):** Toggle de rechazo simulado en Andes Freight.
- **GATE-3:** Release tag `v2.0.0-rc1`.

### 🗓️ CYCLE 4 (Sprint 4): Bedrock Haiku, Open Source & Feature Freeze
**Fechas:** Sábado 10 Oct — Viernes 16 Oct 2026  
**Meta:** Integración de Amazon Bedrock Claude 3 Haiku para locución natural, empaquetado del módulo `cargomesh-mcp` (licencia MIT) y congelamiento de código.
- **BE-1 (`HAC-401`):** Integración de AWS Bedrock Claude 3 Haiku en `lib/bedrock.ts`.
- **BE-3 (`HAC-402`):** Publicación del paquete open source `packages/cargomesh-mcp/`.
- **BE-2 & FE-1 (`HAC-403`):** Sincronización en tiempo real Web 🠚 Alexa (WebSockets/Polling reactivo).
- **FE-2 (`HAC-404`):** Pulido visual en 1080p/4K para la grabación.
- **GATE-4 (15-16 Oct):** FEATURE FREEZE. Verificación `pnpm release:verify` limpia.

### 🗓️ CYCLE 5 (Sprint 5): Video Demo, Revisores Amazon y Postulación Devpost
**Fechas:** Sábado 17 Oct — Lunes 19 Oct 2026 (Sprint corto de entrega)  
**Meta:** Video de demostración en inglés (≤ 2:40 min), Friction Logs (+10% bonus) y envío oficial en Devpost.
- **Sábado 17 Oct:** Ensayo general del Golden Flow y seteo de cámaras/audio.
- **Domingo 18 Oct:** Grabación del video en inglés, edición en 1080p a 60fps y redacción de Devpost (Product Feedback y Friction Logs).
- **Lunes 19 Oct (10:00):** Invitar a los 6 revisores de Amazon en GitHub si el repo es privado (`chris-trag`, `knmeiss`, `giolaq`, `anishamalde`, `mosesroth`, `emersonsklar`).
- **Lunes 19 Oct (14:00):** ENVÍO OFICIAL EN DEVPOST 🏆.
