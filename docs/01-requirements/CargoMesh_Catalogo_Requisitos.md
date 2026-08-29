# CargoMesh — Catálogo Oficial de Requisitos (Demo & Hackathon)

> **Versión:** 1.0.0 (Consolidada para WebMCP Challenge 2026)  
> **Estado:** Aprobado para implementación y asignación técnica  
> **Fuente de verdad:** `docs/CargoMesh_Planeacion_WebMCP_FINAL.md` v5.5.0  
> **Convención de redacción:**
> - **El sistema debe:** Comportamiento del core de CargoMesh, backend y base de datos.
> - **El agente WebMCP debe:** Acciones autónomas del agente de IA que navega e invoca tools en los navegadores.
> - **El portal del transportista debe:** Funcionalidad expuesta en las páginas web de los carriers (`/providers/*`).
> - **El usuario debe poder:** Interacción de la persona en la interfaz frontend.

---

## 🎯 Escala de Prioridades para el Hackathon

* **🔴 Alta (P0):** Funcionalidad crítica obligatoria para completar el *Golden Flow E2E* y la evaluación técnica ante los jueces.
* **🟡 Media (P1):** Funcionalidad de soporte y valor agregado para robustecer la arquitectura y la experiencia de usuario.
* **🟢 Baja (P2):** Funcionalidad secundaria o cubierta mediante datos base (*seed*) para no diluir el tiempo de desarrollo.

---

## 📋 1. Requisitos Funcionales (RF)

### Módulo 1: Identidad, Autenticación y Gobernanza B2B

#### [RF-01] Autenticación de Usuario Demo
* **Prioridad:** 🟢 **Baja** *(Cubierta por seed / Mock de sesión)*
* **Descripción:** El sistema debe proveer un mecanismo de autenticación mediante Supabase Auth para validar la identidad del representante de la empresa con JWT.
* **Criterio de Aceptación:** El usuario debe poder ingresar con credenciales pre-sembradas (`carlos.mendoza@acmemining.pe` / `CargoMesh2026!`) o mediante un botón de acceso directo de demo para cargar la sesión activa.

#### [RF-02] Contexto de Organización Multitenant Dinámica
* **Prioridad:** 🟡 **Media**
* **Descripción:** El sistema debe cargar dinámicamente el contexto de la empresa asociada al usuario autenticado desde `organizations`, sin depender de identificadores fijos (hardcodeo) en el frontend o backend.
* **Criterio de Aceptación:** El sistema debe resolver el `organization_id` activo, identificador fiscal y país a partir de la membresía del usuario, permitiendo que la plataforma soporte múltiples organizaciones de forma transparente.

#### [RF-03] Gobernanza y Políticas de Despacho Organizacionales
* **Prioridad:** 🟡 **Media**
* **Descripción:** El sistema debe permitir consultar y aplicar las preferencias de despacho configuradas por la organización (`organization_preferences`), tales como la estrategia por defecto (`BALANCED`), el umbral de confianza y la política de recuperación.
* **Criterio de Aceptación:** Si el usuario posee el rol `OWNER` o `SUPERVISOR`, el sistema debe permitirle actualizar dichas políticas; si posee el rol `REQUESTER`, el sistema debe aplicar las políticas existentes en modo lectura.

#### [RF-04] Carga y Sugerencia de Perfiles Habituales de Carga
* **Prioridad:** 🟡 **Media**
* **Descripción:** El sistema debe permitir al usuario seleccionar plantillas de carga frecuentes (`organization_cargo_profiles`) para agilizar la creación de solicitudes de transporte.
* **Criterio de Aceptación:** Al seleccionar un perfil habitual (ej. *Repuestos y maquinaria pesada*), el sistema debe autocompletar la categoría de carga, método de unitización, dimensiones estimadas y tipo de vehículo recomendado en el intake.

---

### Módulo 2: Captura e Intake de Carga Logística (Freight Request)

#### [RF-05A] Captura Guiada de Ruta y Contactos de Entrega
* **Prioridad:** 🔴 **Alta**
* **Descripción:** El sistema debe capturar la dirección de origen (ciudad y país), dirección de destino, fechas programadas de recojo y la indicación de cruce fronterizo internacional.
* **Criterio de Aceptación:** El usuario debe poder ingresar el corredor logístico (ej. Callao/Lima, PE $\rightarrow$ Santiago, CL) y especificar los puntos de contacto operativos.

#### [RF-05B] Captura de Carga Unitizada y Atributos Especiales
* **Prioridad:** 🔴 **Alta**
* **Descripción:** El sistema debe permitir registrar la carga mediante diversas unidades logísticas (pallets, bultos, maquinaria, sacos o contenedores) junto con atributos de manipulación (alto valor, apilable, cadena de frío).
* **Criterio de Aceptación:** El usuario debe poder indicar el método de embalaje y declarar atributos especiales que condicionarán la elegibilidad de los vehículos.

#### [RF-06] Normalización y Cálculo Matemático de Carga
* **Prioridad:** 🔴 **Alta**
* **Descripción:** El sistema debe calcular y normalizar automáticamente el peso total en kilogramos y el volumen total en metros cúbicos a partir de la cantidad de bultos y dimensiones unitarias ingresadas.
* **Criterio de Aceptación:** Para un ingreso de 10 pallets de 800 kg cada uno ($1.2 \times 1.0 \times 1.5$ m), el sistema debe totalizar exactamente **8,000 kg** de peso y **18 m³** de volumen, validando la coherencia matemática.

#### [RF-07] Validación de Restricciones Duras de Dominio (Pre-check)
* **Prioridad:** 🔴 **Alta**
* **Descripción:** El sistema debe validar que los datos de la solicitud cumplan con las restricciones de integridad antes de confirmar la solicitud.
* **Criterio de Aceptación:** El sistema debe rechazar solicitudes con peso/volumen $\le 0$, presupuestos negativos o fechas de recojo inválidas (fin anterior al inicio).

---

### Módulo 3: Portales de Transportistas & Exposición WebMCP

#### [RF-08] Arquitectura Extensible de Portales de Transportistas
* **Prioridad:** 🟡 **Media**
* **Descripción:** El sistema debe implementar una arquitectura modular de portales web para transportistas bajo la ruta `/providers/[carrier_slug]`, conectada a la base de datos de flota y servicios de Supabase.
* **Criterio de Aceptación:** La plataforma debe permitir navegar a las páginas de los transportistas habilitados en el sistema (ej. Andes Freight, Inca Logistics, Pacific Cargo y futuros operadores) cargando sus capacidades desde la base de datos.

#### [RF-09] Registro y Exposición del Estándar WebMCP en Portales
* **Prioridad:** 🔴 **Alta**
* **Descripción:** Cada portal de transportista debe registrar formalmente en el entorno del navegador (`document.modelContext` / WebMCP) las herramientas estructuradas de consulta y reserva.
* **Criterio de Aceptación:** El portal web del carrier debe exponer las tools:
  1. `check_service_coverage(corridor, mode, cross_border)`
  2. `check_capacity(pickup_date, weight_kg, volume_m3)`
  3. `quote_freight(request_payload)`
  4. `book_freight(request_payload, offer_reference)`
  5. `get_provider_booking_status(provider_reference)`

#### [RF-10] Motor de Cotización Determinista en el Carrier
* **Prioridad:** 🔴 **Alta**
* **Descripción:** El portal del transportista debe procesar la solicitud recibida a través de la tool `quote_freight` y responder con una cotización estructurada basada en sus tarifas y tiempos de tránsito.
* **Criterio de Aceptación:** Para el escenario de prueba Golden Flow, los portales deben responder con cotizaciones estructuradas consistentes (Andes: $1,760 USD / 31h; Inca: $1,920 USD / 29h; Pacific: $1,590 USD / 60h).

---

### Módulo 4: Orquestación Agent-Native & Result Bridge

#### [RF-11] Gestión del Ciclo de Vida de Orquestación
* **Prioridad:** 🔴 **Alta**
* **Descripción:** El sistema debe registrar y administrar la ejecución de búsqueda (`orchestration_runs`), identificando si se trata de una búsqueda inicial (`INITIAL`) o una re-evaluación (`RECOVERY`).
* **Criterio de Aceptación:** Al iniciar la búsqueda, el sistema debe crear un registro de corrida en estado `RUNNING` y actualizarlo a `OPTIONS_READY` o `FAILED` al concluir.

#### [RF-12] Result Bridge e Ingesta Idempotente de Ofertas
* **Prioridad:** 🔴 **Alta**
* **Descripción:** El sistema debe validar las respuestas estructuradas obtenidas por el agente WebMCP y persistirlas en la tabla `carrier_offers` garantizando no duplicidad.
* **Criterio de Aceptación:** El sistema debe validar la firma de la oferta, correlacionar el `carrier_id` y registrar la oferta de manera idempotente usando `tool_call_id`.

---

### Módulo 5: Motor de Decisión Heurística (Decision Engine)

#### [RF-13] Evaluación Multicriterio y Scoring Normalizado
* **Prioridad:** 🔴 **Alta**
* **Descripción:** El motor de decisión debe evaluar todas las ofertas elegibles y calcular una puntuación global normalizada (0 a 100) según la estrategia seleccionada (ej. `BALANCED`: costo 25%, confiabilidad 25%, ETA 20%, disponibilidad 10%, experiencia en ruta 10%, historial de organización 10%).
* **Criterio de Aceptación:** El cálculo debe ser determinista y auditable, asignando el ranking de mayor a menor puntuación.

#### [RF-14] Cálculo de Confianza de Decisión y Detección de Anomalías
* **Prioridad:** 🔴 **Alta**
* **Descripción:** El motor de decisión debe calcular un índice de confianza (*Decision Confidence Score*) basado en completitud, certeza de restricciones, evidencia histórica y separación de ofertas, además de detectar desviaciones de precio >+30%.
* **Criterio de Aceptación:** El sistema debe calcular el puntaje de confianza (0–100) e indicar si la recomendación es de alta certeza o si requiere revisión humana.

#### [RF-15] Generación de Snapshot Inmutable de Decisión
* **Prioridad:** 🔴 **Alta**
* **Descripción:** El sistema debe persistir el resultado del análisis en la tabla `freight_decisions` como una versión inmutable (`v1`, `v2`) con el ranking completo, la oferta recomendada y los subscores desglosados.
* **Criterio de Aceptación:** Una vez creada la decisión, sus valores no pueden ser modificados ni sobreescritos, garantizando auditabilidad.

#### [RF-16] Presentación Reactiva de Opciones y Explicabilidad
* **Prioridad:** 🔴 **Alta**
* **Descripción:** La interfaz de usuario debe mostrar el progreso en tiempo real de la consulta a los carriers y detenerse en el estado `OPTIONS_READY`, presentando las tarjetas de opciones ordenadas y la explicación clara de por qué se recomienda la mejor alternativa.
* **Criterio de Aceptación:** El usuario debe visualizar el desglose técnico de subscores y el badge de recomendación en la mejor opción.

---

### Módulo 6: Selección, Booking y Recuperación Operacional

#### [RF-17] Selección Humana de Oferta
* **Prioridad:** 🔴 **Alta**
* **Descripción:** El usuario debe poder seleccionar explícitamente cualquier transportista de la lista de opciones elegibles, independientemente de si es o no el recomendado por el algoritmo.
* **Criterio de Aceptación:** El sistema debe registrar `selected_offer_id` en la solicitud sin asumir automáticamente la recomendación salvo autorización expresa de auto-booking.

#### [RF-18] Solicitud Formal de Reserva (Booking Request)
* **Prioridad:** 🔴 **Alta**
* **Descripción:** El agente WebMCP debe invocar la herramienta `book_freight` en el portal del carrier seleccionado y transicionar la solicitud al estado `PENDING_PROVIDER_CONFIRMATION` con temporizador de respuesta.
* **Criterio de Aceptación:** El sistema debe persistir un registro en `bookings` vinculado al `provider_reference` retornado por el carrier.

#### [RF-19] Confirmación y Habilitación de Seguimiento
* **Prioridad:** 🔴 **Alta**
* **Descripción:** El sistema debe consultar periódicamente o recibir el estado de la reserva (`get_provider_booking_status`), y al recibir `CONFIRMED`, transicionar el estado comercial a `BOOKED` y habilitar la pantalla de tracking.
* **Criterio de Aceptación:** La interfaz debe actualizarse automáticamente para mostrar los datos de la unidad asignada, placas y precintos aduaneros.

#### [RF-20] Circuito de Recuperación Automatizada (Recovery Run)
* **Prioridad:** 🔴 **Alta**
* **Descripción:** Ante el rechazo (`REJECTED`) o vencimiento (`EXPIRED`) por parte del transportista seleccionado, el sistema debe activar automáticamente una corrida de recuperación (`RECOVERY`), re-evaluar el universo de transportistas disponibles y emitir una nueva decisión (`FreightDecision v2`).
* **Criterio de Aceptación:** El sistema no debe quedar bloqueado: debe presentar al usuario la opción de reemplazo óptima para continuar la operación sin reiniciar todo el flujo.

---

### Módulo 7: Observabilidad en Tiempo Real & Panel para Jueces (Judge Drawer)

#### [RF-21] Visor de Trazabilidad y Eventos WebMCP en Tiempo Real
* **Prioridad:** 🔴 **Alta**
* **Descripción:** El sistema debe registrar cada evento de navegación, llamada a tool WebMCP, parámetros de entrada, respuesta estructurada y latencia en `orchestration_events`, mostrándolos en un drawer lateral flotante (*Judge Drawer*) accesible en cualquier pantalla.
* **Criterio de Aceptación:** Los jueces deben poder abrir el Drawer y visualizar la cronología de eventos con timestamps reales, payloads JSON expandibles y duración en milisegundos.

#### [RF-22] Panel de Inyección de Fixtures y Reset para Demostración
* **Prioridad:** 🔴 **Alta**
* **Descripción:** El Judge Drawer debe incluir controles para configurar el comportamiento futuro de los portales de transportistas (`ACCEPT`, `REJECT`, `NO_RESPONSE`) y un botón de reinicio seguro del escenario de demostración.
* **Criterio de Aceptación:**
  1. Cambiar el fixture solo condiciona la respuesta de la tool del carrier; **no altera directamente la base de datos**.
  2. El botón *Reset Demo* debe restaurar la solicitud a `PENDING` y vaciar las tablas de runtime (`carrier_offers`, `freight_decisions`, `bookings`, `orchestration_runs`) de forma reproducible.

---

## 🔒 2. Requisitos No Funcionales (RNF)

#### [RNF-01] Regla de Causalidad Estricta (Anti-Fake Demo)
* **Categoría:** Integridad Arquitectónica
* **Descripción:** Las tablas transaccionales de runtime (`carrier_offers`, `freight_decisions`, `bookings`, `booking_events`, `orchestration_events`) deben comenzar vacías para cada nueva solicitud y poblarse exclusivamente a través de ejecuciones reales del agente WebMCP.

#### [RNF-02] Seguridad y Aislamiento Multitenant (Row Level Security)
* **Categoría:** Seguridad
* **Descripción:** Todas las tablas de la base de datos deben tener RLS activo. El rol `anon` no debe tener privilegios de lectura ni escritura (`42501`), y los usuarios autenticados solo pueden acceder a información de su propia organización.

#### [RNF-03] Determinismo y Explicabilidad Matemática
* **Categoría:** Confiabilidad
* **Descripción:** Las fórmulas de normalización, scoring y cálculo de confianza deben ser deterministas y reproducibles. Dadas las mismas entradas de mercado, el sistema debe producir exactamente los mismos puntajes.

#### [RNF-04] Idempotencia y Prevención de Duplicados
* **Categoría:** Robustez
* **Descripción:** Todas las ingestas de eventos y ofertas deben estar protegidas por claves únicas (`tool_call_id`, `provider_event_id`, `idempotency_key`) para tolerar reintentos de red sin duplicar registros.

#### [RNF-05] Reproducibilidad de Despliegue Local
* **Categoría:** Mantenibilidad y DX
* **Descripción:** Cualquier desarrollador o jurado debe poder clonar el repositorio y levantar el entorno completo con comandos estándar (`npx supabase db reset` y `npx supabase test db`), obteniendo 100% de pruebas verdes.

#### [RNF-06] Consistencia de Tipado y Contratos de Datos
* **Categoría:** Calidad de Software
* **Descripción:** El frontend (TypeScript) y el backend (Pydantic / FastAPI) deben utilizar definiciones de tipos sincronizadas directamente con el esquema de base de datos PostgreSQL (`database.types.ts`).

---

## 📊 Resumen de Requisitos por Prioridad

| Módulo | 🔴 Alta (P0) | 🟡 Media (P1) | 🟢 Baja (P2) | Total |
|---|:---:|:---:|:---:|:---:|
| **M1: Identidad & Gobernanza B2B** | 0 | 3 | 1 | **4** |
| **M2: Intake & Carga Unitizada** | 4 | 0 | 0 | **4** |
| **M3: Portales & WebMCP** | 2 | 1 | 0 | **3** |
| **M4: Orquestación & Result Bridge** | 2 | 0 | 0 | **2** |
| **M5: Motor de Decisión Heurística** | 4 | 0 | 0 | **4** |
| **M6: Booking & Recuperación** | 4 | 0 | 0 | **4** |
| **M7: Observabilidad & Judge Drawer** | 2 | 0 | 0 | **2** |
| **Requisitos No Funcionales (RNF)** | 6 | 0 | 0 | **6** |
| **Total General** | **24** | **4** | **1** | **29** |
