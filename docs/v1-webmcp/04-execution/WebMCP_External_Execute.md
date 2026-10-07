# WebMCP External Execute — Especificación Canónica y Límite de Evidencia

> **Propósito:** Esta guía documenta los escenarios reales y las herramientas expuestas a agentes en el navegador mediante la API WebMCP (`document.modelContext`), separando explícitamente las capacidades verificadas en vivo de los datos sintéticos de escenario y el roadmap futuro.

For the evaluator-facing DevTools procedure, exact provider input/output schemas,
Golden Flow evidence, and recovery evidence, see
[`WebMCP_Judge_Audit_Guide.md`](./WebMCP_Judge_Audit_Guide.md).

---

## 1. Inventario contractual: 5 tools provider y 1 tool de intake separada

Cada portal provider registra exactamente **5 herramientas WebMCP**. CargoMesh registra además `get_freight_request_recommendations` en el intake como una superficie independiente y read-only; no es una sexta tool provider. No existen tools provider adicionales expuestas a los agentes.

| # | Nombre de Tool | Origin / Contexto | Función y Propósito | Estado de Validación |
|---|---|---|---|:---:|
| 1 | `check_service_coverage` | `/providers/[carrierSlug]` | Verifica si el transportista tiene cobertura en el corredor (origen/destino, modo, categoría y aduana). | **Contrato y pruebas OK** |
| 2 | `check_capacity` | `/providers/[carrierSlug]` | Consulta disponibilidad de peso (kg), volumen (m³) y fechas dentro de la ventana de recojo. | **Contrato y pruebas OK** |
| 3 | `quote_freight` | `/providers/[carrierSlug]` | Devuelve cotización formal desglosada (lineHaul, handling, customs) con validez temporal. | **Contrato y pruebas OK** |
| 4 | `book_freight` | `/providers/[carrierSlug]` | Solicita la reserva del flete con número de oferta tras selección asistida y autorización previa. | **Contrato y pruebas OK** |
| 5 | `get_provider_booking_status` | `/providers/[carrierSlug]` | Consulta el estado actual del booking (`CONFIRMED`, `IN_TRANSIT`, etc.) y eventos de ruta. | **Contrato y pruebas OK** |
| — | `get_freight_request_recommendations` | `/freight-request/new` (CargoMesh; fuera del portal provider) | Sugiere antecedentes históricos basados en envíos previos de la organización autenticada (**Estrictamente Read-Only**). | **Contrato y pruebas OK** |

> [!IMPORTANT]
> **Aclaraciones Contractuales Críticas:**
> 1. **`get_freight_request_recommendations` es estrictamente READ-ONLY:**
>    - La tool WebMCP jamás muta ni persiste datos por sí misma.
>    - La persistencia física de los campos recomendados ocurre únicamente mediante el endpoint writer D1-01 (`PATCH /api/freight-requests/[id]/draft`), el cual **requiere consentimiento explícito del usuario en la UI**, incrementa atómicamente `draft_version` y rechaza con `409 STALE_DRAFT` ante colisiones concurrentes.
> 2. **`evaluate_offers` NO es una tool WebMCP:**
>    - Es un módulo determinístico server-side de CargoMesh (motor heurístico `BALANCED`), ejecutado internamente sobre las ofertas recibidas. No está expuesto a agentes en el navegador.
> 3. **`organization_directory` y `organization_cargo_profiles` NO existen como tools WebMCP:**
>    - El acceso a organizaciones y perfiles se rige estrictamente por políticas RLS de Supabase en el backend y no cuenta con APIs abiertas de lectura para agentes externos.
> 4. **Input real de `get_freight_request_recommendations`:**
>    - La tool no acepta búsqueda libre por ciudad o texto libre. Su contrato estricto requiere el identificador persistido del borrador y su token de concurrencia:
>      ```json
>      {
>        "freightRequestId": "f2000000-0000-0000-0000-000000000001",
>        "draftVersion": 1
>      }
>      ```

---

## 2. Matriz de Madurez del Ecosistema

| Entidad / Capacidad | Clasificación | Estado Actual y Límite de Evidencia |
|---|:---:|---|
| **Andes Freight (`ANDES`)** | **Provider live del demo; recovery público aprobado** | `/providers/andes` cumple ruta, 5 tools, capacidad y tarifa ejecutables. Superficie pública, Golden Flow y rechazo controlado verificados en el mismo origin Vercel de CargoMesh; no prueba hosting independiente. |
| **Transportes Inca (`INCA`)** | **Provider live del demo; recovery público aprobado** | `/providers/inca` cumple ruta, 5 tools, capacidad y tarifa ejecutables. Superficie pública, Golden Flow y booking alternativo confirmado verificados en el mismo origin Vercel de CargoMesh; no prueba hosting independiente. |
| **Pacific Cargo (`PACIFIC`)** | **Provider live del demo** | `/providers/pacific` cumple ruta, 5 tools, capacidad y tarifa ejecutables. Superficie pública y Golden Flow verificados en el mismo origin Vercel de CargoMesh; no prueba hosting independiente. |
| **Nexo Demo Logistics (`NEXO_DEMO`)** | **Escenario sintético no certificado públicamente** | Provider para escenarios D1. Cuenta con fixtures locales para pruebas; sin certificación pública en producción. |
| **Polaris Cold Chain Logistics** | **Escenario sintético no certificado públicamente** | Definido en catálogo de escenarios (`expanded-fleet`). Sin runtime WebMCP certificado públicamente. |
| **Apex Hazmat Transport** | **Escenario sintético no certificado públicamente** | Definido en catálogo de escenarios (`expanded-fleet`). Sin runtime WebMCP certificado públicamente. |
| **Velocity Express Freight** | **Escenario sintético no certificado públicamente** | Definido en catálogo de escenarios (`expanded-fleet`). Sin runtime WebMCP certificado públicamente. |
| **Intake Manual Editable (`freight-intake-form.tsx`)** | **Entregado y Verificado en Main** | Desbloqueado en PR #51 con writer manual autenticado (PR #50), contratos de ruta en 4 niveles, categorías oficiales y control de concurrencia optimista con `409 STALE_DRAFT`. |
| **Recomendaciones WebMCP (D1-02)** | **Contrato y pruebas verificados** | Runtime de recomendaciones registrado como read-only; validado contra regresiones `STALE_DRAFT` (HTTP 409). |
| **Directorio Público de Shippers con SLA** | **Roadmap** | Propuesta futura; no existe como endpoint público ni tool WebMCP. |

---

## 3. Escenarios de Consulta y Guión de Interacción

### 3.1 Consulta de Factibilidad y Cobertura
* **Pregunta del usuario a la IA:**
  > *"¿Andes Freight puede transportar maquinaria minera pesada de Callao a Santiago de Chile?"*
* **Invocación WebMCP:**
  - `check_service_coverage` en origin autorizado `/providers/andes`.
  - `check_capacity` validando peso solicitado contra la capacidad declarada del servicio.
* **Respuesta observable:** Confirmación basada en el fixture `ANDES-PECL-FTL` con cruce fronterizo y coordinación aduanera.

### 3.2 Cotización y Comparativa Multilateral
* **Pregunta del usuario a la IA:**
  > *"Cotízame el envío FR-1042 con los transportistas habilitados y muéstrame el resultado del análisis."*
* **Invocación WebMCP:**
  - El runner navega secuencialmente por Andes Freight (`/providers/andes`), Transportes Inca (`/providers/inca`) y Pacific Cargo (`/providers/pacific`); en cada documento ejecuta cobertura, capacidad y cotización en ese orden.
* **Procesamiento interno:**
  - CargoMesh recibe las ofertas estructuradas, genera sus hashes SHA-256 en el Result Bridge y corre el algoritmo server-side `BALANCED` con pesos `25%` costo, `25%` confiabilidad, `20%` tránsito, `10%` disponibilidad, `10%` experiencia de ruta y `10%` historial de la organización.
* **Resultado:**
  - Andes Freight: Score 89 (Recomendado).
  - Transportes Inca: Score 84.
  - Pacific Cargo: Score 72.

### 3.3 Asistencia y Recomendación de Borrador (D1-02 Read-Only + D1-01 Consentimiento)
* **Pregunta del usuario a la IA:**
  > *"Recomiéndame datos de empaque basados en envíos previos para mi borrador actual."*
* **Invocación WebMCP:**
  - `get_freight_request_recommendations` con `{ "freightRequestId": "<id>", "draftVersion": 1 }` (consulta de solo lectura).
* **Respuesta:**
  - Devuelve `proposedFields` con razones trazables (`sourceType`). La UI presenta el diff y el usuario debe dar consentimiento explícito antes de aplicar el cambio mediante el endpoint D1-01 PATCH, incrementando `draft_version`.

### 3.4 Tracking de Envío Confirmado
* **Pregunta del usuario a la IA:**
  > *"¿Cuál es el estado de la reserva autorizada para el envío FR-1039?"*
* **Invocación WebMCP:**
  - `get_provider_booking_status` en `/providers/andes` (o provider donde se confirmó el flete).
* **Respuesta:**
  - Estado del booking (`CONFIRMED` / `IN_TRANSIT`) y listado cronológico de eventos registrados.

---

## 4. Checklist de Evidencia para el Jurado

- [ ] Sesión iniciada con usuario demo autenticado (`Carlos Mendoza`, rol `OWNER` / `SUPERVISOR`).
- [ ] Snapshot de `document.modelContext.getTools()` ejecutado en cada origin de provider (`/providers/andes`, `/providers/inca`, `/providers/pacific`).
- [ ] Captura de `executeTool` con parámetros JSON conformes y manejo de `AbortSignal`.
- [ ] Trazabilidad inmutable: ofertas persistidas en `carrier_offers` con hash criptográfico.
- [ ] Verificación de concurrencia: intento de mutación concurrente produce `409 STALE_DRAFT`.
- [ ] Cero alucinaciones: ningún transportista del catálogo sintético (Nexo, Polaris, Apex, Velocity) se presenta como certificado públicamente.
- [x] Recovery público: Andes `REJECT`, selección explícita de Inca y confirmación del booking alternativo aprobados; evidencia sanitizada en [`REL02_Public_WebMCP_UAT_Evidence.md`](./REL02_Public_WebMCP_UAT_Evidence.md) y capturas 06/06b.
