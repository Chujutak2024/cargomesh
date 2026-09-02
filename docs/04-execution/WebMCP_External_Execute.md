# WebMCP External Execute — Consultas Prioritarias para Agentes de IA

> **Propósito:** Especificación de los escenarios de interacción en lenguaje natural para agentes de IA externos (como ChatGPT, Gemini o Claude navegando con WebMCP) interactuando con las herramientas nativas del navegador expuestas por **CargoMesh** y las páginas web de los **Transportistas**.

---

## 📋 Las 5 Familias de Consultas WebMCP

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        AGENTE DE IA EXTERNO                            │
│                 (ChatGPT / Gemini / In-App Browser)                    │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         ▼                         ▼                         ▼
  [ 🔍 FACTIBILIDAD ]       [ 💰 COTIZACIÓN ]         [ 🚚 SEGUIMIENTO ]
  • Cobertura de ruta       • Comparativa en vivo     • Estado del booking
  • Capacidad de camión     • Ranking BALANCED        • Checkpoints aduana
  • Requisitos de frío/haz  • SLA y Confiabilidad     • ETA de llegada
         │                         │                         │
         ├─────────────────────────┴─────────────────────────┤
         ▼                                                   ▼
  [ 📦 HISTORIAL & RECOMENDACIONES ]            [ 🏢 SHIPPERS & REPUTACIÓN ]
  • Antecedentes de empaque                     • Directorio de empresas clientes
  • Autocompletado inteligente                  • Calificación y SLA histórico
         │                                                   │
         ▼                                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│               HERRAMIENTAS REGISTRADAS EN WEBMCP                       │
│                   (document.modelContext)                              │
│                                                                        │
│ • check_service_coverage        • quote_freight                        │
│ • check_capacity                • book_freight                         │
│ • get_freight_request_recommendations • get_provider_booking_status    │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 1. 🔍 Consultas de Cobertura y Capacidad ("¿Quién puede llevar esto?")

* **Pregunta del usuario / jurado a la IA:**
  > *Español:* *"¿Polaris Cold Chain puede llevar 15 toneladas de uva refrigerada a -2°C desde Ica hasta Santiago de Chile?"*  
  > *English:* *"Can Polaris Cold Chain haul 15 tons of refrigerated produce at -2°C from Ica, Peru to Santiago, Chile?"*
* **Herramientas WebMCP invocadas:**
  - `check_service_coverage` (en la web de Polaris Cold Chain: `/providers/polaris-cold-chain`)
  - `check_capacity` (en la web de Polaris Cold Chain)
* **Parámetros enviados:**
  ```json
  {
    "originCountry": "PE",
    "originRegion": "Ica",
    "destinationCountry": "CL",
    "destinationRegion": "Región Metropolitana",
    "cargoWeightKg": 15000,
    "requiresRefrigeration": true,
    "temperatureRange": { "minCelsius": -2, "maxCelsius": 0 }
  }
  ```
* **Respuesta generada por la IA:**
  > *"Sí. **Polaris Cold Chain Logistics** cuenta con tracto-camiones Volvo FM y Scania R500 certificados para frío extremo (-25°C a +5°C) y dispone de capacidad confirmada para 22 toneladas en la ruta Ica ➔ Santiago con cruce fronterizo y coordinación aduanera habilitada."*

---

### 2. 💰 Consultas de Cotización y Comparativa ("¿Quién es el mejor y cuánto cuesta?")

* **Pregunta del usuario / jurado a la IA:**
  > *Español:* *"Cotízame 8,000 kg de repuestos mineros de Lima a Santiago con los transportistas disponibles y dime cuál es la mejor opción."*  
  > *English:* *"Quote an 8,000 kg mining machinery shipment from Lima to Santiago across available carriers and recommend the best option."*
* **Herramientas WebMCP invocadas:**
  - `quote_freight` en paralelo en:
    1. *Andes Express* (`/providers/andes-express`)
    2. *Apex Hazmat Transport* (`/providers/apex-hazmat`)
    3. *Transportes Inca* (`/providers/transportes-inca`)
    4. *Pacific Cargo Logistics* (`/providers/pacific-cargo`)
* **Parámetros enviados:**
  ```json
  {
    "originCity": "Lima",
    "destinationCity": "Santiago",
    "cargoWeightKg": 8000,
    "cargoVolumeM3": 18.0,
    "cargoCategory": "MACHINERY"
  }
  ```
* **Respuesta generada por la IA:**
  > *"Consulté a los transportistas en vivo vía WebMCP:*
  > * 🥇 **Andes Express (Recomendado por Motor BALANCED - 89 pts):** \$2,150 USD · Entrega en 48h · 98% confiabilidad · Flota Scania R450 6x4.
  > * 🥈 **Transportes Inca (84 pts):** \$1,980 USD (Más económico) · Entrega en 72h · 92% confiabilidad.
  > * 🥉 **Pacific Cargo Logistics (72 pts):** \$2,400 USD · Entrega rápida en 40h · 88% confiabilidad.
  > * 🛡️ **Apex Hazmat Transport:** \$2,650 USD · Especializado en carga de alto riesgo y química.
  > 
  > *Te recomiendo **Andes Express** porque ofrece el equilibrio óptimo entre costo competitivo, velocidad de tránsito y máxima seguridad aduanera en frontera."*

---

### 3. 📦 Consultas de Historial y Autocompletado ("Recuérdame mis órdenes")

* **Pregunta del usuario / jurado a la IA:**
  > *Español:* *"Quiero mandar otro lote de repuestos a la minera en Santiago, ¿qué dimensiones usamos la última vez?"*  
  > *English:* *"I need to send another spare parts batch to the mine in Santiago, what cargo dimensions did we use last time?"*
* **Herramienta WebMCP invocada:**
  - `get_freight_request_recommendations` (en CargoMesh)
* **Parámetros enviados:**
  ```json
  {
    "destinationCity": "Santiago",
    "cargoCategory": "MACHINERY"
  }
  ```
* **Respuesta generada por la IA:**
  > *"Encontré el antecedente histórico de tu organización `FR-1042`: utilizaste **10 pallets de 120x100x150 cm (800 kg c/u)** con entrega a Tomás Rojas en Santiago (+56 9 6123 4010). ¿Deseas que aplique estos parámetros con un solo clic a tu nuevo borrador?"*

---

### 4. 🚚 Consultas de Tracking en Vivo ("¿Dónde está mi carga?")

* **Pregunta del usuario / jurado a la IA:**
  > *Español:* *"¿Cómo va mi envío de la orden `FR-1039` con Andes Express? ¿Ya cruzó la frontera?"*  
  > *English:* *"What is the live tracking status of shipment FR-1039 with Andes Express? Has it crossed the border?"*
* **Herramienta WebMCP invocada:**
  - `get_provider_booking_status` (en la web de Andes Express)
* **Parámetros enviados:**
  ```json
  {
    "bookingId": "BK-1039-ANDES",
    "freightRequestId": "f2000000-0000-0000-0000-000000000002"
  }
  ```
* **Respuesta generada por la IA:**
  > *"Tu envío se encuentra en estado **EN TRÁNSITO**. El último checkpoint registrado fue a las 08:30 en el **Paso Fronterizo Santa Rosa / Chacalluta** (Inspección aduanera completada). Conductor asignado: Diego Salazar (Unidad Scania TR-204). Llegada estimada a Antofagasta: hoy en 3 horas y 45 minutos."*

---

### 5. 🏢 Consultas de Shippers y Reputación ("¿Qué empresas usan CargoMesh y cómo están valoradas?")

* **Pregunta del usuario / jurado a la IA:**
  > *Español:* *"¿Qué empresas utilizan CargoMesh para mover sus fletes y cuál es su calificación de satisfacción?"*  
  > *English:* *"Which enterprise shippers are using CargoMesh to manage their freight and what are their satisfaction ratings?"*
* **Contexto WebMCP consultado:**
  - Directorio de organizaciones activas del ecosistema y perfiles de carga verificados.
* **Respuesta generada por la IA:**
  > *"CargoMesh gestiona fletes para generadores de carga industriales líderes en el corredor Perú-Chile, todos operando exclusivamente con transporte terrestre en camión:*
  > 
  > 1. 🚜 **ACME Mining Perú (Código: `ACME`)**
  >    - **Sector:** Minería y Maquinaria Pesada.
  >    - **SLA / Satisfacción:** **98.2%** de entregas a tiempo (+1,400 toneladas movidas).
  >    - **Rutas habituales:** Callao/Lima ➔ Santiago de Chile (Minas de cobre).
  >    - **Transportista preferido:** *Andes Express* (Plataformas Scania 28t y Lowboy 32t).
  > 
  > 2. 🍇 **Agrícola del Valle Sur (Código: `AGRIVAS`)**
  >    - **Sector:** Agroexportación y Cadena de Frío.
  >    - **SLA / Satisfacción:** **96.5%** de cumplimiento térmico (+850 toneladas de fruta fresca).
  >    - **Rutas habituales:** Ica/Callao ➔ Santiago de Chile en camiones Reefer (-1°C a +1°C).
  >    - **Transportista preferido:** *Polaris Cold Chain Logistics* y *Transportes Inca*.
  > 
  > 3. 🏗️ **Cemento & Concreto Andino (Código: `CEMENTOS`)**
  >    - **Sector:** Materiales de Construcción e Infraestructura Industrial.
  >    - **SLA / Satisfacción:** **94.8%** de puntualidad nacional (+2,100 toneladas transportadas).
  >    - **Rutas habituales:** Lima ➔ Arequipa y Huancayo en plataformas pesadas FTL.
  >    - **Transportista preferido:** *Velocity Express Freight* y *Nexo Demo Logistics*."*

---

## 🎯 Resumen Ejecutivo de Capacidades

| Familia de Consulta | Propósito Principal | Tool WebMCP Involucrada |
|---|---|---|
| **1. Factibilidad Técnica** | *"¿Tienes camión reefer / plataforma / permisos para esta ruta?"* | `check_service_coverage`, `check_capacity` |
| **2. Comparativa Económica** | *"¿Quién me da la mejor relación precio-tiempo hoy?"* | `quote_freight`, `evaluate_offers` |
| **3. Asistencia Inteligente** | *"¿Qué empaque y contactos usamos en envíos anteriores?"* | `get_freight_request_recommendations` |
| **4. Seguimiento Operativo** | *"¿Dónde está mi camión y cuál es el último evento de aduana?"* | `get_provider_booking_status` |
| **5. Directorio de Shippers** | *"¿Qué empresas usan CargoMesh y cuál es su calificación?"* | `organization_directory`, `organization_cargo_profiles` |

---
*Documento actualizado para pruebas de integración con agentes LLM externos (ChatGPT/Gemini) y guión oficial de evaluación técnica (Google WebMCP Challenge 2026).*
