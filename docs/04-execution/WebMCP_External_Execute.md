# WebMCP External Execute — Especificación Canónica y Límite de Evidencia

> **Propósito:** Esta guía documenta los escenarios reales y las herramientas expuestas a agentes en el navegador mediante la API WebMCP (`document.modelContext`), separando explícitamente las capacidades verificadas en vivo de los datos sintéticos de escenario y el roadmap futuro.

---

## 1. Inventario Contractual de Herramientas WebMCP (6 Tools Reales)

El ecosistema CargoMesh registra exclusivamente **6 herramientas WebMCP reales**. No existen tools adicionales expuestas a los agentes.

| # | Nombre de Tool | Origin / Contexto | Función y Propósito | Estado de Validación |
|---|---|---|---|:---:|
| 1 | `check_service_coverage` | `/providers/[carrierSlug]` | Verifica si el transportista tiene cobertura en el corredor (origen/destino, modo, categoría y aduana). | **Verificado** |
| 2 | `check_capacity` | `/providers/[carrierSlug]` | Consulta disponibilidad de peso (kg), volumen (m³) y fechas dentro de la ventana de recojo. | **Verificado** |
| 3 | `quote_freight` | `/providers/[carrierSlug]` | Devuelve cotización formal desglosada (lineHaul, handling, customs) con validez temporal. | **Verificado** |
| 4 | `book_freight` | `/providers/[carrierSlug]` | Ejecuta la reserva vinculante del flete con número de oferta y autorización previa del shipper. | **Verificado** |
| 5 | `get_provider_booking_status` | `/providers/[carrierSlug]` | Consulta el estado actual del booking (`CONFIRMED`, `IN_TRANSIT`, etc.) y eventos de ruta. | **Verificado** |
| 6 | `get_freight_request_recommendations` | `/freight-request/new` (CargoMesh) | Recomienda campos históricos basados en envíos previos de la organización autenticada. | **Verificado** |

> [!IMPORTANT]
> **Aclaraciones Contractuales Críticas:**
> 1. **`evaluate_offers` NO es una tool WebMCP:** Es un módulo determinístico server-side de CargoMesh (motor heurístico `BALANCED`), ejecutado internamente sobre las ofertas recibidas. No está expuesto a agentes en el navegador.
> 2. **`organization_directory` y `organization_cargo_profiles` NO existen como tools WebMCP:** El acceso a organizaciones y perfiles se rige estrictamente por políticas RLS de Supabase en el backend y no cuenta con APIs abiertas de lectura para agentes externos.
> 3. **Input real de `get_freight_request_recommendations`:** La tool no acepta búsqueda libre por ciudad o texto libre. Su contrato estricto requiere el identificador persistido del borrador y su token de concurrencia:
>    ```json
>    {
>      "freightRequestId": "f2000000-0000-0000-0000-000000000001",
>      "draftVersion": 1
>    }
>    ```

---

## 2. Matriz de Madurez del Ecosistema

| Entidad / Capacidad | Clasificación | Estado Actual y Límite de Evidencia |
|---|:---:|---|
| **Andes Express (`ANDES_EXPRESS`)** | **Verificado** | Provider WebMCP plenamente operativo. Resuelve en `/providers/andes-express`, registra 5 tools, cuenta con fixtures de capacidad y participa en el Golden Flow canónico. |
| **Transportes Inca (`TRANSPORTES_INCA`)** | **Verificado** | Provider WebMCP plenamente operativo. Resuelve en `/providers/transportes-inca`, registra 5 tools, cuenta con fixtures de capacidad y participa en el Golden Flow canónico. |
| **Pacific Cargo Logistics (`PACIFIC_CARGO`)** | **Verificado** | Provider WebMCP plenamente operativo. Resuelve en `/providers/pacific-cargo`, registra 5 tools, cuenta con fixtures de capacidad y participa en el Golden Flow canónico. |
| **Nexo Demo Logistics (`NEXO_DEMO`)** | **Verificado** | Provider para escenarios D1. Cuenta con fixtures para corredor nacional (Lima-Arequipa) y transfronterizo (Callao-Santiago). |
| **Polaris Cold Chain Logistics** | **Escenario sintético** | Registrado en catálogo SQL (`expanded-fleet`). Su runtime WebMCP y fixtures específicos están pendientes de integración pública en PR separado. |
| **Apex Hazmat Transport** | **Escenario sintético** | Registrado en catálogo SQL (`expanded-fleet`). Su runtime WebMCP y fixtures específicos están pendientes de integración pública en PR separado. |
| **Velocity Express Freight** | **Escenario sintético** | Registrado en catálogo SQL (`expanded-fleet`). Su runtime WebMCP y fixtures específicos están pendientes de integración pública en PR separado. |
| **Intake Manual Editable** | **Pendiente de UAT** | La vista `/freight-request/new` requiere conectar el writer autenticado para editar todos los campos de forma persistente. |
| **Recomendaciones WebMCP (D1-02)** | **Verificado** | Runtime de recomendaciones registrado y validado contra regresiones `STALE_DRAFT` (HTTP 409). |
| **Directorio Público de Shippers con SLA** | **Roadmap** | Propuesta de producto. Requiere diseño de contratos server-side con RLS antes de exponer métricas agregadas. |

---

## 3. Escenarios de Consulta y Guión de Interacción

### 3.1 Consulta de Factibilidad y Cobertura (En Vivo)
* **Pregunta del usuario a la IA:**
  > *"¿Andes Express puede transportar maquinaria minera pesada de Callao a Santiago de Chile?"*
* **Invocación WebMCP:**
  - `check_service_coverage` en origin autorizado `/providers/andes-express`.
  - `check_capacity` validando peso solicitado contra la capacidad declarada del servicio.
* **Respuesta observable:** Confirmación basada en el fixture `ANDES-PECL-FTL` con cruce fronterizo y coordinación aduanera.

### 3.2 Cotización y Comparativa Multilateral (En Vivo)
* **Pregunta del usuario a la IA:**
  > *"Cotízame el envío FR-1042 con los transportistas habilitados y muéstrame el resultado del análisis."*
* **Invocación WebMCP:**
  - Ejecución en paralelo de `quote_freight` en Andes Express, Transportes Inca y Pacific Cargo.
* **Procesamiento interno:**
  - CargoMesh recibe las ofertas estructuradas, genera sus hashes SHA-256 en el Result Bridge y corre el algoritmo server-side `BALANCED`.
* **Resultado:**
  - Andes Express: Score 89 (Recomendado).
  - Transportes Inca: Score 84.
  - Pacific Cargo: Score 72.

### 3.3 Asistencia y Recomendación de Borrador (D1-02 En Vivo)
* **Pregunta del usuario a la IA:**
  > *"Recomiéndame datos de empaque basados en envíos previos para mi borrador actual."*
* **Invocación WebMCP:**
  - `get_freight_request_recommendations` con `{ "freightRequestId": "<id>", "draftVersion": 1 }`.
* **Respuesta:**
  - Devuelve `proposedFields` con razones trazables (`sourceType`). La UI presenta el diff y el usuario debe dar consentimiento explícito antes de aplicar el cambio, incrementando `draft_version`.

### 3.4 Tracking de Envío Confirmado (En Vivo)
* **Pregunta del usuario a la IA:**
  > *"¿Cuál es el estado de la reserva autorizada para el envío FR-1039?"*
* **Invocación WebMCP:**
  - `get_provider_booking_status` en el provider donde se confirmó el flete.
* **Respuesta:**
  - Estado del booking (`CONFIRMED` / `IN_TRANSIT`) y listado cronológico de eventos registrados.

---

## 4. Checklist de Evidencia para el Jurado

- [ ] Sesión iniciada con usuario demo autenticado (`Carlos Mendoza`, rol `OWNER` / `SUPERVISOR`).
- [ ] Snapshot de `document.modelContext.getTools()` ejecutado en cada origin de provider.
- [ ] Captura de `executeTool` con parámetros JSON conformes y manejo de `AbortSignal`.
- [ ] Trazabilidad inmutable: ofertas persistidas en `carrier_offers` con hash criptográfico.
- [ ] Verificación de concurrencia: intento de mutación concurrente produce `409 STALE_DRAFT`.
- [ ] Cero alucinaciones: ningún transportista del catálogo sintético (Polaris, Apex, Velocity) se presenta como consultado en vivo hasta que sus fixtures y routes estén verificados en el build oficial.
