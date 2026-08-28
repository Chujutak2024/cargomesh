# CargoMesh — Mockups requeridos (extraído del Plan Maestro FINAL, Sección 21)

> **Este documento es representativo, no un diseño.** Cada pantalla se describe en texto: propósito, contenido y estados. No incluye layout, color ni tipografía. Al final se incluye una plantilla de prompt para pedirle a una herramienta de diseño (o a Claude) que genere el mockup visual real de cada una, manteniendo consistencia con el contrato congelado (paleta, datos del Golden Flow, terminología).

---

## Cómo leer la prioridad

La Sección 21 del doc FINAL no etiqueta prioridad por pantalla — la prioridad de cada una se infiere cruzando esa sección con el **P0 MVP** de la Sección 25 y las notas de la Sección 16.2 / 27.2 sobre qué puede quedar pre-cargado por `Reset Demo`.

```text
🔴 P0 crítico   → sin esto, el Acceptance Test (Sección 32) no puede pasar
🟡 P0 soporte   → forma parte del contrato pero puede quedar pre-seteado por Reset Demo
🔵 P1           → el propio doc lo marca P1 explícitamente
```

---

## 1. 🟡 Register Organization *(21.1)*

**Propósito:** alta de una organización nueva en CargoMesh.

**Contenido:**
```text
Legal company name
Country
Business identifier
Corporate email
Corporate phone
Member account
```

**Nota de scope:** la Sección 16.2 dice explícitamente *"el video puede comenzar con la sesión ya iniciada"*. No es necesario grabar este flujo en vivo para el Acceptance Test — puede existir como pantalla, pero no bloquea el Golden Flow.

---

## 2. 🟡 Organization Profile *(21.2)*

**Propósito:** vista de la cuenta corporativa ya verificada.

**Contenido:**
```text
Company
Country
Business identifier
Verified corporate email 🔒
Corporate phone
Members
Policies
Billing mode
```

---

## 3. 🟡 Home *(21.3)*

**Propósito:** panel de orientación general, no es donde ocurre el Golden Flow.

**Contenido:**
```text
Drafts
Requests awaiting confirmation
Options ready
Bookings awaiting carrier confirmation
Confirmed transports
Recovery required
Tracking
Exceptions
```

---

## 4. 🟡 Nueva FreightRequest *(21.4)*

**Propósito:** intake de una solicitud nueva.

**Contenido — stepper de 5 pasos:**
```text
1. Organization & Requester
2. Pickup & Delivery
3. Cargo
4. Schedule & Policy
5. Review & Confirm
```

**Nota de scope:** técnicamente P0 de intake (Sección 25), pero el Golden Flow de demo **no depende de llenarlo en vivo** — `Reset Demo` restaura FR-1042 ya `CONFIRMED` (Sección 27.2). Sirve para mostrar de dónde viene la solicitud, pero el Acceptance Test empieza en "Start Orchestration", no aquí.

---

## 5. 🔴 Smart Dispatch Status *(21.5)*

**Propósito:** la pantalla central del Golden Flow — dispara la orquestación real.

**Contenido:**
```text
Start Orchestration
→ create orchestration_run
→ Navigate WebMCP
→ record provider results
→ Coverage
→ Capacity
→ Quotes
→ History
→ Ranking
→ OPTIONS_READY
```

**Regla dura del contrato:** el flujo **se detiene** en `OPTIONS_READY`. No debe avanzar solo ni preseleccionar a Andes — la selección humana ocurre después, en la pantalla 6.

---

## 6. 🔴 Carrier Offer Cards *(21.6)*

**Propósito:** presentar el resultado del Decision Engine para selección humana.

**Contenido por card:**
```text
Carrier
Total price
Reported vehicle / capacity
Pickup
ETA
Reliability
Cross-border capability
Derived cost analytics
Score
Recommendation badge
```

**CTA:** `Seleccionar esta opción` — visible en las tres cards elegibles, no solo en la recomendada.

**Datos del Golden Flow (referencia):**
```text
Andes Freight    $1,760 · Score 89 · RECOMMENDED
Inca Logistics   $1,920 · Score 84
Pacific Cargo    $1,590 · Score 72
```

---

## 7. 🔴 Booking Request Status *(21.7)*

**Propósito:** mostrar que `book_freight` fue enviado y está esperando al carrier — no confirmado todavía.

**Contenido:**
```text
Solicitud enviada
Andes Freight

Status:
Esperando confirmación del carrier

Response deadline:
10:15
```

**Estados UI:** `PENDING` · `CONFIRMED` · `REJECTED` · `NO RESPONSE`

---

## 8. 🔴 Recovery UI *(21.8)*

**Propósito:** mostrar que, ante rechazo, CargoMesh vuelve a validar en vivo — no reutiliza el ranking viejo.

**Contenido:**
```text
Andes Freight no confirmó la solicitud.
CargoMesh volvió a validar las alternativas.

Recommended replacement
Inca Logistics
$1,920
Updated availability
```

**CTA (Assisted):** `Enviar nueva solicitud`

---

## 9. 🔴 Tracking *(21.9)*

**Propósito:** timeline post-confirmación, alimentado por `booking_events` reales.

**Contenido:**
```text
CONFIRMED
→ PICKUP
→ IN_TRANSIT
→ BORDER
→ DELIVERED
```

**Regla dura:** solo visible después de `CONFIRMED` — nunca antes.

---

## 10. 🔵 Booking Changes / Cancel *(21.10)* — P1

**Propósito:** modificar o cancelar un booking ya confirmado, consultando opciones reales del carrier.

**Contenido:**
```text
Botón: Modificar o cancelar
→ solicita motivo
→ CargoMesh consulta opciones del carrier

Ejemplo:
Reprogramar mañana     $0
Cancelar ahora         $120
Mantener en espera     $0
```

---

## 11. 🔵 Unrecognized Request *(21.11)* — P1

**Propósito:** activar `SECURITY_REVIEW`, distinto de una cancelación normal.

**Contenido:**
```text
Acción visible: "No reconozco esta solicitud"
→ NO abre modal de cancelación normal
→ activa SECURITY_REVIEW

Mensaje:
"Las acciones automáticas fueron suspendidas.
El equipo autorizado de la organización fue notificado."
```

---

## 12. 🟡 Payment *(21.12)*

**Propósito:** dejar explícito que CargoMesh no captura tarjetas.

**Contenido:**
```text
P0: Corporate Account / Invoice

Si el provider exige checkout:
"Pago requerido → Abrir checkout seguro"
```

---

## 13. 🔵 Supervisor — Exception Queue *(21.13)* — P1

**Propósito:** cola de excepciones para intervención humana.

**Contenido:**
```text
provider rejection
provider no-response
price anomaly
low confidence
policy violation
security review
disruption
```

---

## 14. 🔴 Provider Demo Pages *(21.14)* — la evidencia técnica central

**Propósito:** las 3 páginas (`/providers/andes`, `/providers/inca`, `/providers/pacific`) que exponen las tools WebMCP reales. Sin esto no hay nada que el agente pueda descubrir — es la prueba de causalidad de todo el proyecto.

**Tools que cada página debe registrar:**
```text
check_service_coverage
check_capacity
quote_freight
book_freight
get_provider_booking_status
get_booking_change_options   (P1)
apply_booking_change         (P1)
```

**Nota de contrato:** cada provider mantiene su propio fixture determinista (Sección 27.3) — no necesitan diseño elaborado, son la prueba técnica del reto, no una vitrina.

---

## 15. 🔴 Judge / Agent Activity Drawer *(21.15)* — evidencia para jueces

**Propósito:** panel técnico que demuestra que WebMCP se ejecutó de verdad, leyendo `orchestration_runs` / `orchestration_events` reales — nunca animaciones fabricadas del lado cliente.

**Contenido:**
```text
timestamp
provider_url
tool_name
status
duration_ms
input/output expandable
```

**Controles (Demo Mode):**
```text
Start Orchestration
Set Provider Fixture: ACCEPT / REJECT / NO_RESPONSE
Reset Demo
```

**Regla dura:** el control de fixture solo modifica la respuesta futura del provider — nunca hace `UPDATE bookings SET status = ...` directamente. El cambio de estado en CargoMesh solo puede venir de una tool WebMCP real ejecutándose después.

---

# Cómo convertir esto en mockups reales

Este documento describe **contenido**, no **diseño**. Para generar cada pantalla como mockup visual (HTML/imagen/Figma), usa esta plantilla de prompt — está armada para que cualquier herramienta (Claude, v0, Figma AI, etc.) mantenga consistencia con el contrato ya congelado en vez de inventar datos o estados que lo contradigan.

## Plantilla de prompt reutilizable

```text
Diseña el mockup de la pantalla "[NOMBRE DE LA PANTALLA]" de CargoMesh,
una plataforma B2B de freight orchestration agent-native.

CONTEXTO DEL PRODUCTO:
- Golden Flow: FreightRequest FR-1042, Callao/Lima, Peru → Santiago, Chile
- ROAD · FTL · 10 pallets × 800kg = 8,000 kg · Budget $2,000 · BALANCED
- Tres carriers: Andes Freight ($1,760, score 89, recommended),
  Inca Logistics ($1,920, score 84), Pacific Cargo ($1,590, score 72)
- Decision Confidence del Golden Flow: 88/100

PROPÓSITO DE ESTA PANTALLA:
[pegar el "Propósito" y "Contenido" de la sección correspondiente de este doc]

REGLAS DURAS QUE NO PUEDE ROMPER EL MOCKUP:
[pegar cualquier "Regla dura" o "Nota de scope" de la sección correspondiente]

IDENTIDAD VISUAL:
- Paleta: paper/ink/brass (fondo hueso #F3F1E9, header casi-negro #1A1812,
  acento dorado #A9791F reservado para CTA primario)
- Tipografía: Overpass (headers), Inter (cuerpo), IBM Plex Mono (códigos,
  precios, IDs)
- Mismo lenguaje visual que las pantallas Home y Nueva carga ya construidas

FORMATO DE SALIDA:
Un solo archivo HTML autocontenido (CSS y JS inline), responsive.
```

## Ejemplo ya completado — Pantalla 5 (Smart Dispatch Status)

```text
Diseña el mockup de la pantalla "Smart Dispatch Status" de CargoMesh...

PROPÓSITO: pantalla central del Golden Flow — dispara la orquestación real.
Debe mostrar el checklist en vivo: Start Orchestration → create
orchestration_run → Navigate WebMCP → record provider results → Coverage
→ Capacity → Quotes → History → Ranking → OPTIONS_READY.

REGLA DURA: el flujo se detiene en OPTIONS_READY. No debe avanzar solo ni
preseleccionar a Andes — la selección humana ocurre en la siguiente
pantalla (Carrier Offer Cards).

[...resto de la plantilla igual...]
```

**Recomendación de orden:** genera primero las 5 pantallas 🔴 críticas (5, 6, 7, 8, 14, 15 — el corazón del Acceptance Test), porque son las que un juez realmente va a ver ejecutarse. Las 🟡 y 🔵 pueden quedar como texto en este documento hasta que sobre tiempo — no bloquean la demo.
