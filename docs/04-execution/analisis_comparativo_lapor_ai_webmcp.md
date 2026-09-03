# Análisis Comparativo de WebMCP: LaporAI vs. CargoMesh

> **Objetivo**: Evaluar la implementación de WebMCP (Web Model Context Protocol) en la aplicación [LaporAI](https://lapor-ai-chi.vercel.app/) frente a la arquitectura de **CargoMesh**, identificando fortalezas técnicas, patrones de diseño de agentes y oportunidades de mejora.

---

## 1. Visión General de Ambos Proyectos

| Dimensión | **LaporAI** (`lapor-ai-chi.vercel.app`) | **CargoMesh** (Nuestro Sistema) |
| :--- | :--- | :--- |
| **Dominio de Negocio** | Asistente cooperativo para declaración de impuestos de personas naturales (Coretax 2025 SPT Tahunan, Indonesia). | Plataforma B2B de brokerage y orquestación logística de transporte de carga transfronterizo (LATAM). |
| **Topología WebMCP** | **Single-Domain Co-Pilot**: Un único portal web donde un agente y el usuario cooperan sobre un mismo formulario/wizard (26 tools dinámicas). | **Decentralized Multi-Provider Network**: Red distribuida donde múltiples carriers (Andes, Inca, Pacific) exponen sus propias tools (`/providers/[slug]`, 5 tools c/u). |
| **Arquitectura de Datos** | 100% Client-Side (Vite + React 19, `localStorage`, estado en memoria). Sin base de datos backend. | Fullstack Enterprise (Next.js 15 App Router, Supabase PostgreSQL, RLS multi-tenant, roles RBAC, concurrencia optimista). |
| **Filosofía de Interacción** | Guiado paso a paso con validaciones bloqueantes y propuestas visibles (*Human-in-the-Loop*). | Orquestación autónoma de cotizaciones, motor de scoring multicriterio (BALANCED) y recovery de rechazos. |

---

## 2. Puntos Fuertes de LaporAI en el Uso de WebMCP

Tras la inspección del bundle cliente (`index-DUPmRjWO.js`) y la ejecución en runtime mediante CDP (Chrome DevTools Protocol), se identifican seis puntos fuertes clave en LaporAI:

### 1. Ciclo de Vida Dinámico de Tools (*State-Machine Driven Toolset*)
* **El problema que resuelve**: Registrar 20+ tools al inicio satura la ventana de contexto del LLM y provoca alucinaciones o llamadas a tools inválidas para el estado actual.
* **Implementación de LaporAI**:
  - Cuenta con una función `dy(state)` que evalúa el paso actual del wizard (Documents ➔ Income ➔ Assets ➔ Liabilities ➔ Family ➔ Review ➔ Declaration).
  - Solo expone las tools pertinentes para el estado activo. Por ejemplo:
    - Si no hay sesión: **0 tools**.
    - Si faltan documentos: solo tools de inspección y subida (`choose_document_source`, `upload_tax_document`).
    - Si está en revisión: habilita `confirm_prefilled_record`, `validate_return`, etc.
  - Al cambiar de paso, aborta el controlador anterior (`AbortController.abort()`) y re-registra con señal limpia:
    ```javascript
    Qe.forEach(name => {
      R.registerTool({ ...tool, execute: async (input) => { ... } }, { signal: controller.signal });
    });
    ```

### 2. Suite de Benchmark Integrada (*WebMCP vs. Screen Agent vs. Manual*)
* **Impacto demostrativo**: Proporciona a jueces y usuarios una prueba cuantitativa del valor de WebMCP.
* **Pantalla de Evaluación dedicada (`/benchmark`)**:
  - Compara tres modalidades de ejecución sobre la misma prueba:
    1. **Manual**: Usuario interactuando con controles visibles.
    2. **Screen-operated agent**: Agente de visión/clicks por píxeles (Computer Use).
    3. **WebMCP agent**: Agente con tools nativas conscientes del estado.
  - Registra métricas empíricas: **Duración (s)**, **Cantidad de acciones**, **Errores encontrados**, **Llamadas a tools** y calcula la mediana tras 3 corridas.

### 3. Protocolo de "Propuestas" Seguras (*Human-in-the-Loop / No Silent Mutation*)
* **Seguridad en datos críticos**: Un agente no puede mutar datos financieros o fiscales directamente a espaldas del usuario.
* **Patrón `propose`**:
  - Tools mutantes (`add_asset`, `update_asset`, `remove_asset`, `update_dependent_details`, `confirm_prefilled_record`) no modifican el estado inmediatamente.
  - Emiten un evento `type: "propose"` que renderiza un banner o modal visible en la interfaz para que el usuario acepte o rechace el cambio.
  - La respuesta de la tool es explícita y transparente:
    ```json
    {
      "content": [{ "type": "text", "text": "A visible proposal is waiting for the taxpayer. No value has changed." }],
      "structuredContent": { "proposal": "Confirm 2024 Honda Vario at IDR 18.000.000" }
    }
    ```

### 4. Inspector y Diagnóstico Visual de WebMCP en la UI
* **Observabilidad en tiempo real**: En la barra superior incluye un badge interactivo:
  - `● WebMCP connected` (verde) si `document.modelContext` está disponible.
  - `● WebMCP not detected` (gris) si no hay entorno WebMCP.
* **Modal de Auditoría de Tools**: Al hacer clic en el badge, se abre un diálogo nativo (`<dialog className="tools-dialog">`) que lista todas las herramientas registradas en ese preciso instante, sus títulos, descripciones, y esquemas JSON de entrada. Permite a cualquier evaluador auditar qué herramientas tiene el agente.

### 5. Uso Riguroso de Anotaciones Estándar WebMCP
* Cada herramienta aprovecha los metadatos semánticos de la especificación:
  - `annotations: { readOnlyHint: true }` en tools de solo lectura (`get_current_step_requirements`, `get_document_status`, `explain_field`, `review_prefilled_data`).
  - `annotations: { destructiveHint: true }` en tools que alteran datos o eliminan registros (`remove_asset`, `remove_liability`, `upload_tax_document`).
  - `additionalProperties: false` y esquemas JSON estrictos con validación de tipos, rangos numéricos y `enum` en cada parámetro.

### 6. Procesamiento Local de Documentos mediante WebWorker (PDF.js)
* La tool `upload_tax_document` permite al agente recibir un PDF en Base64, el cual es parseado en el navegador mediante `pdf.worker` en un hilo separado.
* Extrae tablas de ingresos (BPA1) y estados de cuenta bancarios sin necesidad de enviar archivos a un servidor backend, preservando la privacidad del usuario.

---

## 3. Comparativa de Fortalezas: LaporAI vs. CargoMesh

| Aspecto | LaporAI | CargoMesh |
| :--- | :--- | :--- |
| **Topología de Agentes** | Monolítica / Asistente local en un solo formulario. | **Red B2B Descentralizada**: Múltiples proveedores autónomos (`Andes`, `Inca`, `Pacific`) actuando como servidores WebMCP independientes. |
| **Orquestación Comercial** | Flujo secuencial guiado. | **Subastas y Despacho Automatizado**: Fan-out multi-carrier, recolección de cotizaciones concurrentes y motor de scoring determinístico BALANCED (6 dimensiones). |
| **Manejo de Excepciones** | Bloqueo por validaciones de formulario. | **Protocolo de Recovery Autónomo**: Rechazo (`REJECT`) de un carrier recuperado automáticamente con confirmación en segundo carrier (`CONFIRMED`). |
| **Persistencia y Backend** | Solo memoria local y `localStorage`. | **PostgreSQL con RLS**: Row-Level Security por tenant, roles RBAC (`OWNER`, `SUPERVISOR`, `REQUESTER`), auditoría de cambios y concurrencia optimista (`draft_version` HTTP 409 `STALE_DRAFT`). |
| **Visibilidad de Tools WebMCP** | **Excelente**: Badge en header + modal de inspección en vivo de tools activas. | **Enfocado en API/E2E**: Registro en `document.modelContext` enfocado en providers y endpoints de Next.js. |
| **Demostración de Valor (Benchmark)** | **Excelente**: Tablero integrado que mide tiempo, acciones y errores frente a Computer Use. | Evidencia empírica mediante suites de pruebas automatizadas y capturas sanitizadas en documentación pública. |
| **Interacción Humano-Agente** | **Propuestas visuales explícitas** antes de aplicar cualquier mutación. | Adopción de recomendaciones mediante flujo de revisión en wizard de intake (D1-01). |

---

## 4. Oportunidades y Aprendizajes Clave para CargoMesh

Inspirándonos en las mejores prácticas de LaporAI, existen tres áreas de alto impacto que enriquecerían a CargoMesh de cara a futuras iteraciones y presentaciones a jurados:

1. **Badge e Inspector de WebMCP en el Header**:
   - Incorporar un indicador visual en el layout de CargoMesh (`● WebMCP Provider Runtime: 3 Live Carriers`).
   - Al hacer clic, desplegar un modal que liste las tools activas registradas por los carriers (`check_freight_coverage`, `check_freight_capacity`, `quote_freight`, `book_freight`, `get_booking_status`), demostrando transparencia inmediata a cualquier auditor.

2. **Anotaciones Explícitas en Tools de Providers**:
   - Asegurar que nuestras tools exporten explícitamente `annotations: { readOnlyHint: true }` para cotizaciones y consultas de capacidad, y `annotations: { destructiveHint: true }` para `book_freight`.

3. **Sección de Comparativa de Eficiencia (WebMCP vs. Scrapers Tradicionales)**:
   - Resaltar en la documentación pública o en la interfaz la ganancia en latencia, confiabilidad y ausencia de fallos visuales que ofrece WebMCP frente a bots de navegación basados en scraping y coordenadas de pantalla.

---

## 5. Conclusión

- **LaporAI** destaca notablemente en su **experiencia de usuario para WebMCP**: ciclo de vida reactivo de tools, interfaz de diagnóstico transparente, flujo de propuestas seguras con intervención humana y un benchmark cuantitativo integrado.
- **CargoMesh** destaca por su **complejidad arquitectónica de nivel empresarial**: topología multi-proveedor distribuida, orquestación comercial autónoma, motor de decisión multicriterio, recuperación ante rechazos y una capa de datos robusta con PostgreSQL, RLS y control estricto de concurrencia.
- Ambos proyectos abordan dos caras fundamentales de WebMCP: LaporAI demuestra la **cooperación persona-agente en una aplicación rica**, mientras que CargoMesh demuestra la **interconexión descentralizada de servicios B2B en un mercado en tiempo real**.
