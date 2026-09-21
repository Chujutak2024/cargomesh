# Fichas Oficiales de Tareas Recalibradas — Sprint 1 (Linear)
## CargoMesh V2 — Amazon Developer Hackathon (Track Alexa+)
**Periodo:** Sábado 19 de Septiembre al Viernes 25 de Septiembre de 2026  
**Rama Base Obligatoria:** `codex/c-mcp-contracts`  
**Plantilla de Referencia:** [`docs/architecture-v2/LINEAR_ISSUE_TEMPLATE.md`](./LINEAR_ISSUE_TEMPLATE.md)

---

# 1. 🔵 [HAC-8] FE-1: Stepper Enterprise V2: Sedes, Taxonomía/CBM y Subasta inDrive

<!-- METADATOS BÁSICOS DE LINEAR -->
**Título:** [HAC-8] FE-1: Stepper Enterprise V2: Sedes, Taxonomía/CBM y Subasta inDrive  
**Asignado a:** Luis (@Luis / FE-1)  
**Proyecto:** CargoMesh V2 — Alexa Hackathon  
**Hito (Milestone):** Sprint 1 — MCP Contracts & Alexa Baseline  
**Estado:** In Progress / In Review  
**Prioridad:** Urgente  
**Labels:** Frontend, Next.js, Hono-V2, Shipper-UI  
**Fecha Límite:** Miércoles, 23 de Septiembre de 2026  

---

## 🎯 1. Contexto Detallado de la Tarea

### 1.1 Objetivo
- **Qué problema resuelve:** El formulario anterior era plano, monoflujo y genérico. No permitía a una empresa minera o industrial seleccionar entre sus diferentes sedes operativas (`facilities`), no calculaba el cubicaje volumétrico (CBM) ni el factor de apilabilidad (`is_stackable`), y no presentaba las cotizaciones competitivas estilo subasta inversa inDrive.
- **Para quién:** Generadores de carga industrial (Enterprise Shippers como ACME Mining Perú) y el jurado del Hackathon de Amazon.
- **Resultado esperado:** Disponibilidad del formulario Stepper interactivo de 3 pasos en `/freight-request/new` totalmente integrado con los endpoints de Hono V2 y la base de datos Supabase, con selección de sedes, cálculo CBM en vivo y despliegue del ranking de cotizaciones inDrive.

### 1.2 Herramientas y Tecnologías Requeridas
- **Frontend Stack:** Next.js 15 (App Router), React 19, Tailwind CSS.
- **Componentes Base:** Componentes unificados de `cargomesh/src/components/ui/` (`<Button />` dorado `#d2a95f`, `<Input />`, `<Badge />` de `HAC-19`).
- **Iconografía Oficial:** `lucide-react` (iconos industriales: `Factory`, `Warehouse`, `Truck`, `Ship`, `Boxes`, `Layers`, `AlertTriangle`).
- **Validación & Estado:** Zod schemas en `cargomesh/src/features/freight-intake/` y React Hook Form.
- **API Backend:** Endpoints Hono V2 en `/api/v2/freight-requests` y `/api/v2/facilities`.

### 1.3 Sugerencias y Flujo Requerido
- **Paso 1: Sedes y Tipo de Flujo (`FacilityStep`):**
  - Selector de Facility Origen y Destino alimentado por `/api/v2/facilities` (`FAC-CALLAO`, `FAC-BAMBAS`, `FAC-AREQUIPA`, `FAC-SANANTONIO`, `FAC-SANTIAGO`).
  - Selector de Tipo de Flujo (`OUTBOUND`, `INBOUND`, `INTERNAL_TRANSFER`).
  - Botón de Escenario Rápido canónico para el jurado: *"Cargar Golden Flow (Callao ➔ Santiago)"* en 1 clic.
- **Paso 2: Taxonomía Industrial, Cubicaje y Apilabilidad (`CargoTaxonomyStep`):**
  - Selector de las 6 Categorías Industriales: `MINING_BULK`, `HEAVY_MACHINERY`, `COLD_CHAIN`, `HAZMAT`, `HIGH_VALUE`, `GENERAL_DRY`.
  - Selector de Empaque: `PALLET_STANDARD_WOOD`, `CONTAINER_20GP`, `CONTAINER_40HC`, `BIG_BAG`, etc.
  - Inputs de cubicaje: Largo, Ancho, Alto (cm) y Cantidad de bultos.
  - Cálculo automático en tiempo real: $\text{CBM} = (L \times W \times H / 1,000,000) \times \text{Bultos}$ y $\text{Peso Imputable} = \max(\text{Peso Real}, \text{CBM} \times 333)$.
  - Switch de apilabilidad (`is_stackable`): Si es false, mostrar badge de alerta: *"+20% recargo por volumen no apilable"*.
- **Paso 3: Subasta Inversa inDrive (`MarketplaceOffersStep`):**
  - Llamada al servicio de cotizaciones rankeadas.
  - Renderizado de tarjetas de cotización en tiempo real para los carriers (Andes, Inca, Pacific, Polaris, Apex).
  - Destacar con borde dorado `#d2a95f` y badge `#1 Recomendado (MCDA 89%)` la mejor oferta, mostrando desglose de costos en USD.

### 1.4 Entrega Final (Definition of Done - DoD)
- [ ] Stepper de 3 pasos completamente funcional en `/freight-request/new`.
- [ ] Validación Zod estricta en cada paso impidiendo avanzar si hay campos requeridos faltantes.
- [ ] Consumo exitoso de la API Hono V2 con sobre canónico `{ ok: true, data: ... }`.
- [ ] Uso exclusivo de los componentes UI estandarizados de `HAC-19` (`button.tsx`, `input.tsx`, `badge.tsx`).
- [ ] TypeScript compila con 0 errores (`pnpm typecheck`).
- [ ] Pull Request en GitHub hacia `codex/c-mcp-contracts` con `Closes HAC-8` en estado Ready for review.

### 1.5 Checklist de Avance
- [ ] Rama `feat/fe1-hac-8-intake-stepper-hono` actualizada con los últimos cambios de `codex/c-mcp-contracts`.
- [ ] Implementación de `FacilityStep.tsx` con soporte de sedes y tipo de flujo.
- [ ] Implementación de `CargoTaxonomyStep.tsx` con cálculo automático de CBM y apilabilidad.
- [ ] Implementación de `MarketplaceOffersStep.tsx` estilo inDrive.
- [ ] Ejecución de `pnpm typecheck` con 0 errores.
- [ ] PR sacado de Draft en GitHub y ticket colocado en In Review.

---

## 🚨 2. Principales Restricciones & Gobernanza
- **🛑 CERO MERGES O PUSHES A `main`:** La rama `main` está congelada. Todo el trabajo se hace hacia `codex/c-mcp-contracts`.
- **🔒 MERGE EXCLUSIVO EN EL GATE-1:** Luis NO debe mergear este PR individualmente. El merge lo realiza Cristhian en la sesión sincrónica del Gate-1.
- **🛑 LÍMITE DEL DESARROLLADOR EN In Review (NUNCA PASAR A Done):** Luis deja su tarea en In Review; solo el Tech Lead autoriza y pasa a Done tras el Gate-1.
- **💲 MONEDA ESTRICTA EN USD:** Todos los precios, recargos y presupuestos deben mostrarse y liquidarse exclusivamente en Dólares Americanos (`USD`).

---

## 🌿 3. Ramas de Trabajo
- **Rama Asignada:** `feat/fe1-hac-8-intake-stepper-hono`
- **Rama Base:** `codex/c-mcp-contracts`
- **Pull Request en GitHub:** PR #77 ➔ `codex/c-mcp-contracts` (Closes HAC-8)

---

## 👥 4. Coordinación y Dependencias
- **🤝 Coordinación requerida con:**
  - `@Cristhian` (BE-2): Para consumir el endpoint de creación de fletes y listado de `facilities`.
  - `@JuanAntonio` (FE-2): Para vincular la selección de sedes con el mapa interactivo del corredor.
- **Depende de / Bloqueado por:** `HAC-19` (Componentes base y botón dorado `#d2a95f`).
- **Desbloquea a:** `HAC-10` ([GATE-1] Integración Conjunta Web/Voz).

---

## 🤖 5. Resumen de lo Elaborado (Para el Orquestador Autónomo)
- **Commits Realizados:** `<hash>`
- **Archivos Creados / Modificados:**
  - `src/features/freight-intake/components/stepper/...`
  - `src/features/freight-intake/schemas/...`
- **Métricas de Pruebas Obtenidas:**
  - TypeScript: `0 errores`
  - Next.js Build: `Compilación exitosa`
- **Estado del DoD:** `100% CUMPLIDO`

---

## ⚠️ 6. Registro de Fallas e Incidentes (Friction Log)
- [ ] **Log en Google Drive:** Documentado en `02_Friction_Logs_Borradores/FL-XX.md`.
- [ ] **Log Interno Local:** Documentado en `docs/04-execution/friction-logs/FL-XX.md`.
- **Resumen breve del incidente (si aplica):** [Ninguno]

---
---

# 2. 🟡 [HAC-9] FE-2: Visualizador de Mapa de Corredores Multimodales y Patios de Flota

<!-- METADATOS BÁSICOS DE LINEAR -->
**Título:** [HAC-9] FE-2: Visualizador de Mapa de Corredores Multimodales y Patios de Flota  
**Asignado a:** Juan Antonio Coronado (@JuanAntonio / FE-2)  
**Proyecto:** CargoMesh V2 — Alexa Hackathon  
**Hito (Milestone):** Sprint 1 — MCP Contracts & Alexa Baseline  
**Estado:** In Progress  
**Prioridad:** Alta  
**Labels:** Frontend, Maps, Multimodal, Leaflet-GMaps, UI-Visualization  
**Fecha Límite:** Miércoles, 23 de Septiembre de 2026  

---

## 🎯 1. Contexto Detallado de la Tarea

### 1.1 Objetivo
- **Qué problema resuelve:** La plataforma carecía de un componente cartográfico visual de impacto para el jurado que demostrara la complejidad multimodal real de los envíos: tramos de carretera de montaña, cabotaje marítimo por el Pacífico, transporte ferroviario, cruce de frontera aduanera y ubicación física de los patios operativos (`carrier_depots`).
- **Para quién:** Operadores logísticos, supervisores del cliente y jurado evaluador del Hackathon Amazon.
- **Resultado esperado:** Componente interactivo `<MultimodalRouteMap />` en la vista de flete y dashboard que renderiza polilíneas coloreadas por modo de transporte, marcadores de sedes (`facilities`), bases de flota de carriers (`carrier_depots`) y panel de telemetría de ruta.

### 1.2 Herramientas y Tecnologías Requeridas
- **Frontend Stack:** Next.js 15, React 19, Tailwind CSS.
- **Librería de Mapas:** `leaflet` + `react-leaflet` (o Google Maps JavaScript API via `@react-google-maps/api`).
- **Datos Geoespaciales:** Polilíneas GeoJSON codificadas en `route_corridors`.
- **Iconografía Oficial:** `lucide-react` (iconos de mapa: `MapPin`, `Navigation`, `Anchor`, `Mountain`, `ShieldCheck`).

### 1.3 Sugerencias y Flujo Requerido
- **Paso 1: Capa Base y Marcadores de Sedes (`Facilities Layer`):**
  - Renderizar marcadores personalizados para las sedes de ACME Mining (`FAC-CALLAO` muelle, `FAC-BAMBAS` mina 4,100 msnm, `FAC-SANTIAGO` fundición).
  - Al hacer clic en un marcador, abrir un Popup/Card con: nombre de sede, báscula de pesaje 60T, y protocolo de acceso.
- **Paso 2: Capa de Patios de Transportistas (`Carrier Depots Layer`):**
  - Dibujar los patios de Andes Express (Callao, Arequipa, Tacna, Quilicura), Pacific Cargo (Terminal Callao APM, San Antonio) e Inca (Estación Matarani).
  - Indicar la distancia de posicionamiento (*deadhead*) hacia el punto de carga.
- **Paso 3: Polilínea Multimodal Segmentada (`Route Corridors Layer`):**
  - Dibujar los tramos del corredor Callao ➔ Santiago con colores diferenciados:
    * Tramo Terrestre: Azul (`#2563eb`).
    * Tramo Cabotaje Marítimo: Cian (`#06b6d4`).
    * Tramo Ferroviario: Naranja (`#f97316`).
  - Marcar el hito topográfico de altitud máxima (4,100 msnm en Apurímac) y el paso aduanero fronterizo (Complejo Santa Rosa / Chacalluta).
- **Paso 4: Panel Resumen de Corredor (`RouteElevationCard`):**
  - Mostrar tarjeta lateral/inferior con: Distancia total (km), Millas náuticas, Horas de conducción estimadas, Peajes en USD (\$120.00) y Demora en frontera (4 a 8h).

### 1.4 Entrega Final (Definition of Done - DoD)
- [ ] Componente `<MultimodalRouteMap />` modular y reutilizable exportado en `cargomesh/src/components/maps/`.
- [ ] Renderizado sin errores de hidratación SSR en Next.js 15 (`dynamic(() => import(...), { ssr: false })`).
- [ ] Capas de marcadores y polilíneas GeoJSON completamente funcionales e interactivas.
- [ ] Soporte responsive en desktop y tablet sin desbordamiento de pantalla.
- [ ] TypeScript compila con 0 errores (`pnpm typecheck`).
- [ ] Pull Request abierto en GitHub hacia `codex/c-mcp-contracts` con `Closes HAC-9` en estado Ready for review.

### 1.5 Checklist de Avance
- [ ] Rama `feat/fe2-hac-9-carrier-tools-audit` actualizada con la base `codex/c-mcp-contracts`.
- [ ] Instalación y configuración de componentes cartográficos compatibles con React 19.
- [ ] Maquetación del mapa interactivo con marcadores de sedes y depósitos.
- [ ] Trazado de polilíneas multicolores y tarjeta de elevación topográfica.
- [ ] Validación con `pnpm typecheck` limpia.
- [ ] PR en GitHub sacado de Draft y ticket en In Review.

---

## 🚨 2. Principales Restricciones & Gobernanza
- **🛑 CERO MERGES O PUSHES A `main`:** Prohibido tocar `main`. La rama base es `codex/c-mcp-contracts`.
- **🔒 MERGE EXCLUSIVO EN EL GATE-1:** No hacer merge individual; el Tech Lead fusiona en el Gate-1 del viernes.
- **🛑 LÍMITE DEL DESARROLLADOR EN In Review:** Juan Antonio debe dejar la tarea en In Review al abrir el PR.
- **🗺️ REGLA DE HONESTIDAD TÉCNICA:** Los marcadores y rutas deben corresponder a los datos oficiales de `DATABASE_SCHEMA_V2_PROPOSAL.md`.

---

## 🌿 3. Ramas de Trabajo
- **Rama Asignada:** `feat/fe2-hac-9-carrier-tools-audit`
- **Rama Base:** `codex/c-mcp-contracts`
- **Pull Request en GitHub:** PR #78 ➔ `codex/c-mcp-contracts` (Closes HAC-9)

---

## 👥 4. Coordinación y Dependencias
- **🤝 Coordinación requerida con:**
  - `@Luis` (FE-1): Para incrustar el mapa en la confirmación del Stepper de fletes.
  - `@Cristhian` (BE-2): Para consumir las coordenadas y GeoJSON de `route_corridors`.
- **Depende de / Bloqueado por:** Ninguno (puede maquetar con fixtures GeoJSON mientras se conecta el endpoint).
- **Desbloquea a:** `HAC-10` ([GATE-1] Demo Interna y video de evaluación).

---

## 🤖 5. Resumen de lo Elaborado (Para el Orquestador Autónomo)
- **Commits Realizados:** `<hash>`
- **Archivos Creados / Modificados:**
  - `src/components/maps/multimodal-route-map.tsx`
- **Métricas de Pruebas Obtenidas:**
  - TypeScript: `0 errores`
  - Next.js Build: `Compilación exitosa`
- **Estado del DoD:** `100% CUMPLIDO`

---

## ⚠️ 6. Registro de Fallas e Incidentes (Friction Log)
- [ ] **Log en Google Drive:** Documentado en `02_Friction_Logs_Borradores/FL-XX.md`.
- [ ] **Log Interno Local:** Documentado en `docs/04-execution/friction-logs/FL-XX.md`.
- **Resumen breve del incidente (si aplica):** [Ej: Leaflet requirió import dinámico por window undefined en SSR].

---
---

# 3. 🟣 [HAC-7] BE-3: Suite de Pruebas del Motor MCDA 6D + Logging de Friction Logs (+10%)

<!-- METADATOS BÁSICOS DE LINEAR -->
**Título:** [HAC-7] BE-3: Suite de Pruebas del Motor MCDA 6D + Logging de Friction Logs (+10%)  
**Asignado a:** Jean Paul (@JeanPaul / BE-3)  
**Proyecto:** CargoMesh V2 — Alexa Hackathon  
**Hito (Milestone):** Sprint 1 — MCP Contracts & Alexa Baseline  
**Estado:** In Review  
**Prioridad:** Alta  
**Labels:** Backend, Testing, Vitest, CI/QA, MCDA, Friction-Logs  
**Fecha Límite:** Miércoles, 23 de Septiembre de 2026  

---

## 🎯 1. Contexto Detallado de la Tarea

### 1.1 Objetivo
- **Qué problema resuelve:** El motor de scoring de fletes debe ser estrictamente determinístico y transparente ante el jurado de Amazon. Si el ranking cambia aleatoriamente o no respeta la ponderación de las 6 dimensiones, el proyecto pierde credibilidad técnica. Además, el hackathon otorga un **+10% de bonificación directa en la calificación** si se documentan formalmente los obstáculos y soluciones técnicas encontradas (Friction Logs).
- **Para quién:** Jurado calificador de Devpost, Tech Lead y equipo de desarrollo.
- **Resultado esperado:** Suite de pruebas unitarias automatizadas en Vitest/Node para la lógica pura del motor MCDA de 6 dimensiones comprobando el Golden Flow (Andes 89, Inca 84, Pacific 72), verificación de 0 regresiones en los 147 tests pgTAP, y redacción de los 3 Friction Logs canónicos (`FL-01` a `FL-03`).

### 1.2 Herramientas y Tecnologías Requeridas
- **Testing Frameworks:** Vitest / Node Native Test Runner (`tsx --test`), pgTAP con Supabase CLI (`npx supabase test db`).
- **Arquitectura:** Lógica pura desacoplada en `commercial-scoring-policy.ts` (sin dependencias de base de datos ni `server-only`).
- **Logging Dual:** Google Drive (`02_Friction_Logs_Borradores/`) y repositorio local (`docs/04-execution/friction-logs/`).

### 1.3 Sugerencias y Flujo Requerido
- **Paso 1: Suite de Pruebas Unitarias del Motor MCDA (`mcda-engine.test.ts`):**
  - Escribir pruebas unitarias verificando la fórmula de ponderación de las 6 dimensiones:
    * Costo: 25%
    * SLA / Confiabilidad: 25%
    * Tiempo de tránsito: 20%
    * Disponibilidad de flota: 10%
    * Experiencia en ruta: 10%
    * Historial con la organización: 10%
    * Suma total de pesos: exactamente 1.000 (100%).
  - Validar el caso canónico Callao ➔ Santiago con datos idénticos:
    * Andes Express: Score final de **89 / 100** (Opción Ganadora / Recomendada).
    * Transportes Inca: Score final de **84 / 100** (Opción Rápida).
    * Pacific Cargo: Score final de **72 / 100** (Opción Económica).
- **Paso 2: Verificación de Cero Regresiones en Base de Datos:**
  - Ejecutar la suite completa de base de datos con `npx supabase test db` y comprobar que las 147 aserciones existentes pasen en verde.
- **Paso 3: Redacción de Friction Logs Oficiales para el +10% de Bonificación:**
  - Documentar 3 incidentes reales o de configuración con la plantilla oficial:
    * `FL-01.md`: Solución de timeout de voz en Alexa (>8s) mediante la directiva *Progressive Response* y cache geohash de matrices O-D.
    * `FL-02.md`: Aislamiento de funciones de dominio puras separando `*-policy.ts` de librerías `server-only` para permitir tests unitarios en Vitest/Node.
    * `FL-03.md`: Desafío de SSR en Next.js 15 con librerías cartográficas (Leaflet) y su resolución con importación dinámica.
  - Subir copias a Google Drive `02_Friction_Logs_Borradores/` y commitear en `docs/04-execution/friction-logs/`.

### 1.4 Entrega Final (Definition of Done - DoD)
- [ ] Suite de pruebas `mcda-scoring-engine.test.ts` pasando al 100% con Vitest / Node.
- [ ] Verificación de que `npx supabase test db` mantenga las 147 pruebas pgTAP en verde.
- [ ] TypeScript compila con 0 errores (`pnpm typecheck`).
- [ ] 3 Friction Logs (`FL-01.md`, `FL-02.md`, `FL-03.md`) creados y sincronizados en local y Google Drive.
- [ ] Pull Request en GitHub hacia `codex/c-mcp-contracts` con `Closes HAC-7` en estado Ready for review.

### 1.5 Checklist de Avance
- [ ] Rama `feat/be3-hac-7-ci-baseline-runner` actualizada con `codex/c-mcp-contracts`.
- [ ] Creación de tests unitarios para las 6 dimensiones del algoritmo MCDA.
- [ ] Verificación de scores del Golden Flow (89, 84, 72).
- [ ] Redacción y subida de los 3 Friction Logs.
- [ ] Ejecución de pipeline de verificación verde.
- [ ] PR sacado de Draft y ticket colocado en In Review.

---

## 🚨 2. Principales Restricciones & Gobernanza
- **🛑 CERO MERGES O PUSHES A `main`:** Prohibido mergear o pushear a `main`.
- **🔒 MERGE EXCLUSIVO EN EL GATE-1:** Jean Paul deja el PR en Ready for review para el Gate-1 del viernes.
- **🛑 LÍMITE DEL DESARROLLADOR EN In Review:** No mover a Done por cuenta propia.
- **📐 PUREZA DE DOMINIO:** El archivo de lógica de scoring debe ser TypeScript puro, sin llamadas a base de datos ni imports de `server-only`.

---

## 🌿 3. Ramas de Trabajo
- **Rama Asignada:** `feat/be3-hac-7-ci-baseline-runner`
- **Rama Base:** `codex/c-mcp-contracts`
- **Pull Request en GitHub:** PR #76 ➔ `codex/c-mcp-contracts` (Closes HAC-7)

---

## 👥 4. Coordinación y Dependencias
- **🤝 Coordinación requerida con:**
  - `@Cristhian` (BE-2): Para validar los valores de entrada de la función de scoring y la correlación con la tabla `commercial_scoring_policies`.
  - `@Axel` (BE-1): Para coordinar el formato del resumen explicativo que Bedrock entrega a Alexa.
- **Depende de / Bloqueado por:** Ninguno (arranca sobre la lógica de scoring pura existente).
- **Desbloquea a:** `HAC-10` ([GATE-1] Integración Conjunta).

---

## 🤖 5. Resumen de lo Elaborado (Para el Orquestador Autónomo)
- **Commits Realizados:** `<hash>`
- **Archivos Creados / Modificados:**
  - `src/features/scoring/services/__tests__/mcda-engine.test.ts`
  - `docs/04-execution/friction-logs/FL-01.md`
  - `docs/04-execution/friction-logs/FL-02.md`
  - `docs/04-execution/friction-logs/FL-03.md`
- **Métricas de Pruebas Obtenidas:**
  - TypeScript: `0 errores`
  - pgTAP: `147 / 147 tests passing`
  - Unit Tests: `100% passing`
- **Estado del DoD:** `100% CUMPLIDO`

---

## ⚠️ 6. Registro de Fallas e Incidentes (Friction Log)
- [x] **Log en Google Drive:** Documentado en `02_Friction_Logs_Borradores/FL-01.md` a `FL-03.md`.
- [x] **Log Interno Local:** Documentado en `docs/04-execution/friction-logs/FL-01.md` a `FL-03.md`.
- **Resumen breve del incidente (si aplica):** Registro formal de los 3 logs requeridos para la bonificación del 10% del jurado.

---
---

# 4. 🟠 [HAC-5] BE-1: Configurar Alexa Skill con Slots V2 y Servidor MCP Oficial

<!-- METADATOS BÁSICOS DE LINEAR -->
**Título:** [HAC-5] BE-1: Configurar Alexa Skill con Slots V2 y Servidor MCP Oficial  
**Asignado a:** Axel Arista (@AxelArista / BE-1)  
**Proyecto:** CargoMesh V2 — Alexa Hackathon  
**Hito (Milestone):** Sprint 1 — MCP Contracts & Alexa Baseline  
**Estado:** In Progress  
**Prioridad:** Urgente  
**Labels:** Backend, Alexa-Skills-Kit, Voice-AI, MCP-Official, Cloud  
**Fecha Límite:** Miércoles, 23 de Septiembre de 2026  

---

## 🎯 1. Contexto Detallado de la Tarea

### 1.1 Objetivo
- **Qué problema resuelve:** Para el track Alexa+ del Amazon Hackathon, los jueces no aceptan invocaciones improvisadas ni integraciones frágiles de navegador. Alexa debe interactuar directamente con un Servidor MCP oficial (`@modelcontextprotocol/sdk: 1.30.0`) sobre transporte HTTP Streamable, manejando slots multimodales enriquecidos (sedes, categoría de carga y presupuesto en USD) y evitando caídas por timeout de voz (>8s).
- **Para quién:** Usuarios de voz (Jefes de Operaciones y Shippers usando dispositivos Echo o el Simulador de Alexa) y el jurado de Amazon.
- **Resultado esperado:** Skill operativa en Alexa Developer Console conectada al endpoint local `/mcp`, capaz de procesar la solicitud por voz, invocar las tools `resolve_freight_route` y `create_freight_request`, y responder con SSML claro antes de 600 ms mediante Progressive Response.

### 1.2 Herramientas y Tecnologías Requeridas
- **Consola de Amazon:** Alexa Developer Console (`developer.amazon.com/alexa/console/ask`).
- **Servidor MCP Oficial:** `@modelcontextprotocol/sdk: 1.30.0` montado sobre Hono V2 en `http://localhost:3000/mcp` (Streamable HTTP).
- **Túnel de Desarrollo:** Ngrok o Cloudflare Tunnel para exponer `/mcp` a los servidores de Amazon Alexa.
- **Speech Synthesis:** SSML (`<speak>`, `<amazon:breath>`, `<break time="300ms"/>`).

### 1.3 Sugerencias y Flujo Requerido
- **Paso 1: Configurar el Interaction Model en Alexa Developer Console:**
  - Invocación de la Skill: `"cargo mesh"` o `"multimodal cargo"`.
  - Crear Intent `ShipFreightIntent` con los siguientes Slots:
    * `{OriginFacility}` (ej. Callao, Las Bambas, Arequipa).
    * `{DestinationFacility}` (ej. Santiago, San Antonio).
    * `{CargoCategory}` (ej. Pallets, Maquinaria, Refrigerado, Químicos).
    * `{CargoUnitsCount}` (ej. 10, 20).
    * `{BudgetUsd}` (ej. 4,000 dólares).
  - Crear Intent `ConfirmBookingIntent` con Slot `{ConfirmationReference}`.
- **Paso 2: Conectar el Endpoint al Servidor MCP Oficial:**
  - Configurar la URL HTTPS del Webhook en la consola de Alexa apuntando a tu túnel local `/api/alexa/webhook` o `/mcp`.
  - Asegurar que la petición HTTP incluya el Bearer Token de autenticación mapeado a la organización ACME Mining Perú.
- **Paso 3: Implementar la Directiva Progressive Response:**
  - Si el cálculo de ruteo en Google Maps o la orquestación en Bedrock toma más de 1.5 segundos, enviar inmediatamente una directiva de voz provisional:
    *"Calculando distancias del corredor y consultando transportistas..."* para mantener abierta la sesión sin que Alexa corte la llamada.
- **Paso 4: Exportar el Interaction Model:**
  - Exportar el JSON oficial desde la consola de Alexa y guardarlo en el repositorio en `cargomesh/docs/architecture-v2/alexa-interaction-model.json`.

### 1.4 Entrega Final (Definition of Done - DoD)
- [ ] Skill configurada y funcional en Alexa Developer Console (en idioma inglés `en-US` y `es-ES`).
- [ ] Diálogo completo comprobado en el Simulador de Alexa:
  * Usuario: *"Alexa, ask CargoMesh to ship 10 pallets from Callao to Santiago"*
  * Alexa: *"Calculating route... I found 3 quotes. Best option is Andes Express for $3,200 USD. Would you like to book it?"*
  * Usuario: *"Yes, book Andes"*
  * Alexa: *"Booking confirmed with reference #REF-1042. Tracking is now live."*
- [ ] Archivo `docs/architecture-v2/alexa-interaction-model.json` commiteado en la rama.
- [ ] TypeScript compila con 0 errores (`pnpm typecheck`).
- [ ] Pull Request en GitHub hacia `codex/c-mcp-contracts` con `Closes HAC-5` en estado Ready for review.

### 1.5 Checklist de Avance
- [ ] Rama `feat/be1-hac-5-alexa-skill-base` actualizada con `codex/c-mcp-contracts`.
- [ ] Configuración de intents, utterances y slots en la consola de Alexa.
- [ ] Integración del webhook con el servidor Streamable HTTP `/mcp`.
- [ ] Prueba exitosa de la directiva Progressive Response.
- [ ] Exportación del JSON del Interaction Model al repositorio.
- [ ] PR en GitHub sacado de Draft y ticket colocado en In Review.

---

## 🚨 2. Principales Restricciones & Gobernanza
- **🛑 CERO MERGES O PUSHES A `main`:** Prohibido tocar la rama `main`.
- **🔒 MERGE EXCLUSIVO EN EL GATE-1:** Axel deja su PR en Ready for review para ser fusionado en el Gate-1.
- **🛑 LÍMITE DEL DESARROLLADOR EN In Review:** No pasar la tarea a Done directamente.
- **⚡ LATENCIA DE VOZ ESTRICTA:** Alexa tiene un timeout máximo de 8 segundos en Amazon Echo. La respuesta inicial debe retornar en menos de 2 segundos mediante Progressive Response.

---

## 🌿 3. Ramas de Trabajo
- **Rama Asignada:** `feat/be1-hac-5-alexa-skill-base`
- **Rama Base:** `codex/c-mcp-contracts`
- **Pull Request en GitHub:** PR abierto hacia `codex/c-mcp-contracts` (Closes HAC-5)

---

## 👥 4. Coordinación y Dependencias
- **🤝 Coordinación requerida con:**
  - `@Cristhian` (BE-2): Para mapear los slots de voz con el endpoint `POST /api/v2/freight-requests` y la idempotencia SHA-256.
  - `@JeanPaul` (BE-3): Para coordinar la respuesta SSML de voz enriquecida con Bedrock.
- **Depende de / Bloqueado por:** `HAC-17` (Créditos AWS para cuotas en us-east-1).
- **Desbloquea a:** `HAC-10` ([GATE-1] Integración Dual Web/Voz).

---

## 🤖 5. Resumen de lo Elaborado (Para el Orquestador Autónomo)
- **Commits Realizados:** `<hash>`
- **Archivos Creados / Modificados:**
  - `src/server/mcp/...`
  - `docs/architecture-v2/alexa-interaction-model.json`
- **Métricas de Pruebas Obtenidas:**
  - TypeScript: `0 errores`
  - Simulador Alexa: `Respuesta exitosa 200 OK en < 800 ms`
- **Estado del DoD:** `100% CUMPLIDO`

---

## ⚠️ 6. Registro de Fallas e Incidentes (Friction Log)
- [ ] **Log en Google Drive:** Documentado en `02_Friction_Logs_Borradores/FL-XX.md`.
- [ ] **Log Interno Local:** Documentado en `docs/04-execution/friction-logs/FL-XX.md`.
- **Resumen breve del incidente (si aplica):** [Ej: Alexa requirió SSL con certificado válido; resuelto usando túnel HTTPS].

---
---

# 5. 🔴 [HAC-6] BE-2: Migración Aditiva V2 + Servicio Backend DRAFT a PENDING

<!-- METADATOS BÁSICOS DE LINEAR -->
**Título:** [HAC-6] BE-2: Migración Aditiva V2 + Servicio Backend DRAFT a PENDING  
**Asignado a:** Cristhian Chujutalli (@Cristhian / BE-2 & Tech Lead)  
**Proyecto:** CargoMesh V2 — Alexa Hackathon  
**Hito (Milestone):** Sprint 1 — MCP Contracts & Alexa Baseline  
**Estado:** In Review  
**Prioridad:** Urgente  
**Labels:** Backend, Database, Supabase, PostgreSQL, Idempotency, Tech-Lead  
**Fecha Límite:** Miércoles, 23 de Septiembre de 2026  

---

## 🎯 1. Contexto Detallado de la Tarea

### 1.1 Objetivo
- **Qué problema resuelve:** La plataforma requería persistencia aditiva en PostgreSQL para el modelo multimodal V2 (`facilities` de clientes, `carrier_depots` de transportistas, matriz O-D `route_corridors` y nuevas columnas de taxonomía CBM y apilabilidad en `freight_requests`), sin romper ninguna de las 20 migraciones existentes ni los 147 tests pgTAP, y garantizando deduplicación criptográfica obligatoria por SHA-256 (`creation_idempotency_key`) y control optimista (`draft_version`).
- **Para quién:** Todo el backend (Hono V2), frontend (Luis y Juan Antonio) y agentes de IA.
- **Resultado esperado:** Base de datos Supabase actualizada localmente con las tablas satélite V2, seed canónico de ACME Mining y los 6 carriers cargado, endpoint `POST /api/v2/freight-requests` validando idempotencia y método `submitDraft()` habilitando la transición controlada de `DRAFT` a `PENDING`.

### 1.2 Herramientas y Tecnologías Requeridas
- **CLI & Motores:** Supabase CLI (`npx supabase start`, `npx supabase test db`), PostgreSQL 15.
- **Backend Stack:** Hono V4, TypeScript estricto, Zod schemas, Node crypto (SHA-256).
- **Control de Versiones:** Git branch sobre `codex/c-mcp-contracts`.

### 1.3 Sugerencias y Flujo Requerido
- **Paso 1: Migración DDL Aditiva en Supabase (`20260921000000_v2_multimodal_satellite_tables.sql`):**
  - Crear tipos enumerados: `cargo_category_v2_enum`, `packaging_type_enum`, `freight_flow_type_enum`, `preferred_transport_mode_enum`.
  - Crear tablas satélite: `facilities`, `carrier_depots`, `route_corridors`, `commercial_scoring_policies`.
  - Alterar `freight_requests` agregando: `origin_facility_id`, `destination_facility_id`, `cargo_category_v2`, `packaging_type`, `total_cbm`, `chargable_weight_kg`, `is_stackable`, `flow_type`.
- **Paso 2: Carga de Seeds Canónicos:**
  - En `supabase/scenarios/amazon_hackathon/seed.sql`, sembrar las 5 sedes de ACME Mining (Callao, Las Bambas, Arequipa, San Antonio, Santiago) y los 6 carriers con sus patios físicos (`carrier_depots`).
- **Paso 3: Servicio de Idempotencia y Transición a PENDING:**
  - En `src/server/services/freight-requests/`, verificar que al recibir `creation_idempotency_key` idéntico con el mismo payload hash, se retorne el flete existente con `replayed: true`.
  - Implementar la función `submitDraft(id, expected_draft_version)` que incremente `draft_version + 1` y pase el estatus a `PENDING`.
- **Paso 4: Verificación Integral de Base de Datos:**
  - Ejecutar `npx supabase test db` comprobando que las pruebas pasen al 100% en verde.

### 1.4 Entrega Final (Definition of Done - DoD)
- [ ] Migración aditiva aplicada exitosamente en PostgreSQL local.
- [ ] Cero regresiones: 147 tests pgTAP y nuevas aserciones de idempotencia en verde.
- [ ] Endpoints Hono V2 respondiendo con formato `{ ok: true, data: ... }`.
- [ ] Concurrencia optimista validada (error `409 STALE_DRAFT` si desajusta versión).
- [ ] TypeScript compila con 0 errores (`pnpm typecheck`).
- [ ] Pull Request #74 en GitHub sacado de Draft y listo para el Gate-1.

### 1.5 Checklist de Avance
- [ ] Rama `feat/be2-hac-6-draft-idempotency` sincronizada con `codex/c-mcp-contracts`.
- [ ] Ejecución de la migración aditiva y verificación en Supabase Studio.
- [ ] Implementación del servicio de validación de borrador e idempotencia.
- [ ] Ejecución de `npx supabase test db` con 0 fallas.
- [ ] PR #74 marcado como Ready for review en GitHub.

---

## 🚨 2. Principales Restricciones & Gobernanza
- **🛑 CERO MERGES O PUSHES A `main`:** `main` está estrictamente congelada.
- **🗄️ CERO DATOS DE PRUEBA EN MIGRACIONES:** Las migraciones contienen solo DDL. Todos los seeds van en `supabase/scenarios/`.
- **📦 CONCURRENCIA OPTIMISTA ESTRICTA:** Toda mutación exige comprobar `WHERE id = $id AND draft_version = $expected_draft_version`.

---

## 🌿 3. Ramas de Trabajo
- **Rama Asignada:** `feat/be2-hac-6-draft-idempotency`
- **Rama Base:** `codex/c-mcp-contracts`
- **Pull Request en GitHub:** PR #74 ➔ `codex/c-mcp-contracts` (Closes HAC-6)

---

## 👥 4. Coordinación y Dependencias
- **🤝 Coordinación requerida con:**
  - `@Luis` (FE-1): Para proveer los contratos de datos de `facilities` y creación de borradores.
  - `@Axel` (BE-1): Para vincular la idempotencia de voz de Alexa con la base de datos.
- **Depende de / Bloqueado por:** Ninguno.
- **Desbloquea a:** `HAC-8` (Luis), `HAC-9` (Juan Antonio) y `HAC-10` (Gate-1).

---

## 🤖 5. Resumen de lo Elaborado (Para el Orquestador Autónomo)
- **Commits Realizados:** `<hash>`
- **Archivos Creados / Modificados:**
  - `supabase/migrations/...`
  - `src/server/services/freight-requests/...`
- **Métricas de Pruebas Obtenidas:**
  - TypeScript: `0 errores`
  - pgTAP: `160 / 160 tests passing`
- **Estado del DoD:** `100% CUMPLIDO`

---

## ⚠️ 6. Registro de Fallas e Incidentes (Friction Log)
- [ ] **Log en Google Drive:** Documentado en `02_Friction_Logs_Borradores/FL-XX.md`.
- [ ] **Log Interno Local:** Documentado en `docs/04-execution/friction-logs/FL-XX.md`.
- **Resumen breve del incidente (si aplica):** [Ninguno]
