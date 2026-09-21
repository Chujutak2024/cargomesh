---
name: cargomesh-governance-contracts
description: >-
  Gobernanza técnica, contratos comerciales de flete e invariantes de providers WebMCP
  en CargoMesh V2. Define la concurrencia optimista (draft_version), deduplicación
  criptográfica por SHA-256, el motor determinístico BALANCED y los scores del Golden Flow.
---

# CargoMesh Governance & Commercial Contracts Skill

Este skill define los contratos de negocio, las reglas comerciales y los invariantes
técnicos inviolables de la plataforma **CargoMesh V2**.

---

## 📦 1. Contratos Comerciales de Carga (Freight Contracts)

### A. Concurrencia Optimista (`draft_version`)
- Cada solicitud de flete (`freight_requests`) cuenta con una columna `draft_version INT NOT NULL DEFAULT 1`.
- Toda mutación o transición de estado (ej: `DRAFT` ➔ `PENDING`) requiere que el cliente envíe `expected_draft_version`.
- La actualización en base de datos incrementa atómicamente: `draft_version = draft_version + 1`.
- Si ninguna fila se actualiza (`rowCount === 0`), el servidor rechaza con `409 STALE_DRAFT`.

### B. Deduplicación e Idempotencia Criptográfica
- Para evitar órdenes duplicadas ante clics repetidos o reintentos de red, se almacenan:
  - `creation_idempotency_key TEXT`
  - `creation_payload_hash TEXT` (Hash SHA-256 de los campos mínimos de la carga).
- Si la clave y el hash coinciden: se devuelve la solicitud existente sin error (replay idempotente).
- Si la clave coincide pero el hash difiere: se rechaza con `IDEMPOTENCY_PAYLOAD_MISMATCH`.

---

## ⚖️ 2. Motor Determinístico BALANCED de Cotización

El motor de emparejamiento calcula el score de cada transportista en una escala de 0 a 100 ponderando 6 dimensiones:

$$\text{Score} = 0.25 \cdot \text{Costo} + 0.25 \cdot \text{SLA} + 0.20 \cdot \text{Tránsito} + 0.10 \cdot \text{Disponibilidad} + 0.10 \cdot \text{Experiencia de Ruta} + 0.10 \cdot \text{Historial}$$

### 🥇 Golden Flow Canónico (`FR-1042` Callao ➔ Santiago):
Para la ruta de demostración con 18,500 kg de carga general, los scores oficiales determinísticos son:
- **Andes Express:** **89** (Líder en confiabilidad y costo)
- **Transportes Inca:** **84** (Opción de respaldo rápido)
- **Pacific Cargo:** **72** (Opción de menor costo pero mayor tránsito)

---

## 🌐 3. Providers WebMCP: Honestidad Técnica

Para catalogar a un carrier como **Proveedor WebMCP Operativo** en CargoMesh, debe cumplir sin excepción:
1. Tener su ruta activa en `/providers/[carrierSlug]` en Next.js.
2. Exponer las 5 tools obligatorias en `document.modelContext`:
   - `check_service_coverage`
   - `check_capacity`
   - `quote_freight`
   - `book_freight`
   - `get_provider_booking_status`
3. Contar con fixtures de capacidad en `cargomesh/src/features/providers/provider-capability-fixtures.ts`.
4. Contar con tarifas de cotización en `quote-freight-tool.ts`.

> ⚠️ **Invariante:**  
> Solo **Andes, Inca y Pacific** son providers WebMCP live en la demo. Carriers como Polaris, Apex o Velocity son datos de escenario/roadmap y nunca deben declararse como tools en vivo.  
> La tool `get_freight_request_recommendations` es de lectura del intake y no debe contarse como una sexta tool de provider.
