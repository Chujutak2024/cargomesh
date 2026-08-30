# CargoMesh — Team Execution Checklist

> **Versión:** 1.1.0
> **Contrato técnico:** v5.6.0  
> **Duración:** 4 días  
> **Equipo:** 3 integrantes trabajando en entornos e IAs independientes  
> **Fuente arquitectónica:** [`ADR-001_Dynamic_Provider_Registry.md`](../00-master/ADR-001_Dynamic_Provider_Registry.md)

## 1. Objetivo compartido

Entregar una demo técnica reproducible en la que una empresa crea una `FreightRequest`, CargoMesh descubre `0..N` transportistas registrados, un agente ejecuta tools WebMCP reales, las ofertas se validan y persisten, el Decision Engine las ordena y el usuario selecciona y solicita el booking.

```text
FreightRequest
→ get_candidate_provider_pages
→ CandidateProvider[0..N]
→ provider_url + WebMCP
→ record_provider_result
→ CarrierOffer[0..N]
→ evaluate_offers
→ selección humana
→ book_freight
→ confirmación o rechazo
```

Regla transversal:

```text
Architecture / orchestration / UI / scoring / booking = carrier-agnostic
Named carriers = demo fixtures and acceptance-test inputs only
```

## 2. Cómo usar este documento

- Una casilla `[x]` significa que el trabajo está integrado y verificado en `main`.
- Una tarea no se marca por tener código local o una rama abierta.
- El estado en curso se observa en la rama o Pull Request correspondiente.
- Cada PR debe mencionar el ID de tarea, por ejemplo `A-02` o `INT-01`.
- Quien integra un PR marca la casilla y agrega el commit en el registro de avances.
- Nadie modifica archivos de otro ownership sin coordinarlo primero.

### Estados recomendados para GitHub Issues

| Estado | Significado |
|---|---|
| `todo` | Nadie empezó la tarea |
| `in-progress` | Existe una rama o PR activo |
| `blocked` | Requiere contrato, corrección o decisión externa |
| `review` | Implementado; falta revisión o integración |
| `done` | Integrado y verificado en `main` |

## 3. Ownership y límites

| Integrante | Módulo | Es propietario de | No debe implementar |
|---|---|---|---|
| **A** | WebMCP y páginas provider | `/providers/[carrierSlug]`, contratos provider, registro y ejecución de tools, fixture controls | scoring, Result Bridge, pantallas CargoMesh |
| **B** | Producto y frontend | login, dashboard, intake, dispatch `0..N`, selección, booking UI, Judge Drawer | consultas privilegiadas, scoring, lógica interna provider |
| **C** | Datos y Decision Engine | Supabase server-side, discovery, Result Bridge, scoring, booking persistence, reset y deploy | UI provider y diseño de pantallas |

### Liderazgo técnico e integración

El Integrante C actúa además como **Technical Lead** e **Integration Owner**. Su función es desbloquear e integrar el trabajo de A y B, no absorber silenciosamente su ownership.

C es responsable de:

- congelar y versionar contratos compartidos;
- resolver el orden de integración según dependencias;
- revisar todo PR que afecte contratos, Supabase, seguridad o estados persistidos;
- ejecutar las verificaciones de cada gate antes de marcar una tarea como integrada;
- actualizar este checklist y el registro de avances;
- coordinar incompatibilidades entre consumidores sin reescribir unilateralmente módulos de A o B;
- realizar el despliegue y validar el entorno final.

Los PR críticos de C sobre RLS, funciones privilegiadas o persistencia deben recibir revisión de A o B. C revisa los PR de A o B que cambien contratos o fronteras de integración.

### Archivos por integrante

```text
Integrante A
frontend/src/app/providers/[carrierSlug]/**
frontend/src/features/providers/**
frontend/src/types/webmcp.d.ts

Integrante B
frontend/src/app/(cargomesh)/**
frontend/src/components/**
frontend/src/features/freight-ui/**
frontend/src/features/judge/**

Integrante C
frontend/src/app/api/**
frontend/src/lib/supabase/**
frontend/src/features/discovery/**
frontend/src/features/decision-engine/**
frontend/src/features/result-bridge/**
supabase/**
```

Los archivos compartidos (`package.json`, layouts raíz, tipos compartidos y variables de entorno) requieren aviso en el chat del equipo antes de modificarse.

### 3.1 Ajuste temporal por disponibilidad de B — 2026-08-30

El Integrante B no está disponible hoy y puede regresar mañana. Este ajuste cambia únicamente la secuencia inmediata; no transfiere ownership ni autoriza a A o C a editar archivos de B.

Reglas temporales:

- `B-02` y `B-03` continúan asignadas exclusivamente a B;
- A y C trabajan solo en sus módulos y en fronteras server-side ya acordadas;
- A o C no modifican dashboard, dispatch, `RequestTable`, componentes visuales ni archivos bajo ownership de B;
- C puede diseñar y probar `INT-02A` headless, pero no implementar dependencias del contrato A-03 hasta que dicho contrato esté integrado;
- completar `INT-02A` no completa `INT-02`, `INT-02B` ni el gate visual `G2`;
- ningún gate que requiera validación visual puede cerrarse sin B, salvo una decisión posterior, explícita y registrada por el equipo;
- si la ausencia de B se extiende, el equipo acuerda un nuevo plan; no existe reasignación implícita.

## 4. Contratos que deben congelarse primero

Antes de integrar trabajo paralelo, los tres integrantes acuerdan estos tipos. A puede desarrollar un spike en su rama antes del freeze, pero no integrarlo a `main`.

```ts
type CandidateProvider = {
  carrierId: string;
  carrierCode: string;
  displayName: string;
  providerUrl: string;
  matchingServiceId: string;
};

type ProviderPageConfig = CandidateProvider & {
  service: {
    providerServiceCode: string;
    transportMode: string;
    serviceType: string;
    maxCapacityKg: number;
    maxVolumeM3: number | null;
    supportsCrossBorder: boolean;
  };
};

type AvailabilityClass =
  | "EXACT_CONFIRMED_SLOT"
  | "AVAILABLE_IN_WINDOW"
  | "LIMITED_WINDOW"
  | "WAITLIST"
  | "UNAVAILABLE";

type ProviderQuote = {
  schemaVersion: "1.0";
  freightRequestId: string;
  providerOfferReference: string;
  price: number;
  currency: "USD";
  priceBreakdown: Record<string, number>;
  estimatedPickup: string;
  estimatedDelivery: string;
  transitHours: number;
  availableCapacityKg: number;
  availabilityClass: AvailabilityClass;
  crossBorderSupported: boolean;
  customsCoordinationIncluded: boolean;
  requiredDocuments: string[];
  borderHandlingNotes: string | null;
  validUntil: string;
};

type ProviderToolEnvelope<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        retryable: boolean;
      };
    };

type RecordProviderResultInput = {
  toolCallId: string;
  orchestrationRunId: string;
  freightRequestId: string;
  carrierId: string;
  providerUrl: string;
  toolName: string;
  toolInput: unknown;
  toolOutput: ProviderToolEnvelope<unknown>;
  startedAt: string;
  completedAt: string;
  schemaVersion: "1.0";
};

type RecordProviderResultResult = {
  eventId: string;
  recordId: string | null;
  recordType: "CARRIER_OFFER" | "BOOKING" | "BOOKING_EVENT" | null;
  status: "INSERTED" | "DEDUPLICATED" | "REJECTED";
  deduplicated: boolean;
};

type CarrierOffer = {
  offerId: string;
  orchestrationRunId: string;
  carrierId: string;
  providerOfferReference: string;
  totalPrice: number;
  currency: "USD";
  transitHours: number;
  status: "RECEIVED" | "ELIGIBLE" | "INELIGIBLE";
};

type FreightRanking = {
  orchestrationRunId: string;
  strategy: "BALANCED";
  recommendedOfferId: string | null;
  decisionConfidence: number;
  options: Array<{
    offerId: string;
    rank: number;
    rawScore: number;
    roundedScore: number;
    eligible: boolean;
    reasons: string[];
  }>;
};

type BookingRequest = {
  freightRequestId: string;
  offerId: string;
  idempotencyKey: string;
};

type BookingResult = {
  bookingId: string;
  providerReference: string;
  providerBookingStatus:
    | "PENDING_PROVIDER_CONFIRMATION"
    | "CONFIRMED"
    | "REJECTED"
    | "EXPIRED";
  providerResponseDeadline: string;
  idempotentReplay: boolean;
};
```

Fronteras de ownership:

```text
C → A: CandidateProvider / ProviderPageConfig
A → C: ProviderToolEnvelope<ProviderQuote | BookingResult>
C → B: CarrierOffer / FreightRanking
B → C: BookingRequest
```

`CandidateProvider` y `ProviderPageConfig` nunca contienen precio, tránsito ni disponibilidad runtime. Los fixtures comerciales pertenecen a la implementación provider y solo se convierten en datos CargoMesh después de una ejecución WebMCP y `record_provider_result`.

Si cambia uno de estos contratos, el PR debe actualizar consumidores o declarar un bloqueo explícito. No se aceptan enums equivalentes con nombres distintos entre módulos.

### 4.1 Máquina de estados persistida

| Entidad | En proceso | Con opciones | Sin opciones | Error |
|---|---|---|---|---|
| `freight_requests` | `ORCHESTRATING` | `AWAITING_SELECTION` | `PENDING` para editar/reintentar | `FAILED` |
| `orchestration_runs` | `RUNNING` | `OPTIONS_READY` | `NO_MATCH` | `FAILED` |
| `carrier_offers` | `RECEIVED` | `ELIGIBLE` | `INELIGIBLE` | no se crea si el payload es inválido |
| `bookings` | `PENDING_PROVIDER_CONFIRMATION` | `CONFIRMED` | `REJECTED` / `EXPIRED` | `FAILED` |

`OPTIONS_READY` y `NO_MATCH` son estados de `orchestration_runs`; `AWAITING_SELECTION` es el estado persistido de `freight_requests` cuando existen alternativas.

### 4.2 Trabajo provisional iniciado antes del freeze

Una tarea puede comenzar como `PROVISIONAL` o `SPIKE`, pero:

- no puede marcarse `[x]` ni integrarse antes de `SH-00`;
- no puede modificar contratos compartidos sin revisión de C;
- debe entregar rama, commit, archivos, input/output real, enums, fixtures y pruebas;
- se priorizan adapters pequeños antes que reescrituras completas;
- su autor corrige incompatibilidades con el contrato congelado antes del merge.

Estado actual: `SH-00`, `SH-01`, A-01, A-02, A-03, B-01, C-01, `INT-01 / G1` y C-02 están integrados; `INT-02A` se encuentra en diseño/implementación headless y permanece abierto. Todo trabajo provisional pendiente debe seguir las reglas anteriores antes de integrarse.

## 5. Checklist de construcción

### Día 1 — Contratos y corte vertical

- [x] **SH-00. Normalizar baseline y congelar contrato v1**
  - **Owner:** C; revisan A + B.
  - **Depende de:** nada.
  - **Qué construir:** integrar la documentación vigente, resolver contradicciones de contratos/estados y publicar los tipos compartidos canónicos considerando el spike existente de A.
  - **Aceptación:** existe una sola definición por contrato; A y B confirman que pueden implementar sin inventar campos; ningún trabajo existente se descarta sin evaluación.
  - **Verificar:** revisión cruzada A/B, búsqueda de estados/enums contradictorios y registro del commit integrado.

- [x] **SH-01. Materializar contratos y preparar el workspace Next.js**
  - **Owner:** A + B + C; integra C.
  - **Depende de:** `SH-00`.
  - **Qué construir:** estructura mínima de Next.js, variables de entorno de ejemplo, módulo de tipos compartidos y límites de ownership.
  - **Aceptación:** `npm install`, `npm run dev` y `npm run build` funcionan; los contratos de la sección 4 están disponibles sin datos comerciales runtime hardcodeados.
  - **Verificar:** `cd frontend && npm run build`.

- [x] **A-01. Crear la plantilla dinámica de página provider**
  - **Owner:** A.
  - **Estado inicial:** `done` (PR #2 mergeado con squash).
  - **Depende de:** puede desarrollarse como spike; requiere `SH-00` y `SH-01` antes de integrarse.
  - **Qué construir:** `/providers/[carrierSlug]` como Server Component, resolución server-side `carrierSlug → carrierCode`, página `404` y Client Component para WebMCP.
  - **Aceptación:** cualquier carrier registrado/configurado usa la misma página; no existen directorios ni condiciones por nombre comercial; `service_role` no aparece en el bundle cliente.
  - **Verificar:** abrir un slug válido y uno inexistente; ejecutar `rg -n "if.*(ANDES|INCA|PACIFIC)|switch.*carrier" frontend/src` y esperar cero coincidencias de lógica.

- [x] **A-02. Registrar y ejecutar `quote_freight`**
  - **Owner:** A.
  - **Depende de:** `A-01`.
  - **Qué construir:** tool imperativa con JSON Schema, envelope común, `readOnlyHint`, cancelación mediante `AbortSignal` y limpieza al desmontar el componente.
  - **Aceptación:** `document.modelContext.getTools()` descubre `quote_freight`; `executeTool()` devuelve un envelope JSON válido; abandonar la página elimina la tool.
  - **Verificar:** prueba manual en navegador WebMCP compatible y captura del resultado JSON.

- [x] **B-01. Construir shell, login demo y dashboard mínimo**
  - **Owner:** B.
  - **Depende de:** `SH-01`.
  - **Qué construir:** layout B2B, navegación, login demo y tabla de solicitudes.
  - **Aceptación:** la sesión demo entra al dashboard y muestra la `FreightRequest` sin IDs hardcodeados en componentes.
  - **Verificar:** `npm run build` y recorrido manual login → dashboard.

- [x] **C-01. Implementar Supabase server-side y discovery**
  - **Owner:** C.
  - **Depende de:** `SH-01`.
  - **Qué construir:** clientes Supabase seguros y `get_candidate_provider_pages(freight_request_id)` sobre `carriers`, `carrier_services` y categorías compatibles.
  - **Aceptación:** devuelve `CandidateProvider[0..N]`, filtra carriers inactivos/sin WebMCP y nunca devuelve cotizaciones precalculadas; el cliente privilegiado está aislado con `server-only` y valida usuario/membresía en operaciones sensibles.
  - **Verificar:** prueba con 0, 1 y más de 1 candidato; prueba organization-scoped; búsqueda de secretos en bundle; `service_role` solo existe en módulos server-only.

- [x] **INT-01. Completar el primer corte vertical real**
  - **Owner:** A + C; valida B.
  - **Depende de:** `A-02`, `C-01`.
  - **Qué construir:** discovery → navegación a un carrier registrado → ejecución real de `quote_freight` → resultado observable.
  - **Aceptación:** ningún módulo conoce previamente el nombre del carrier elegido; la tool se descubre y ejecuta desde su `provider_url`.
  - **Verificar:** grabación corta o capturas de `getTools()` y salida de `executeTool()`.

### Día 2 — Ofertas y decisión

- [x] **A-03. Completar tools provider de consulta**
  - **Owner:** A.
  - **Estado actual:** integrado y verificado en `main`; PR #9, commit `8a0a5a5`.
  - **Depende de:** `A-02`.
  - **Qué construir:** `check_service_coverage` y `check_capacity` con schemas compartidos, validaciones y errores accionables.
  - **Aceptación:** las tools funcionan para cualquier `ProviderPageConfig`; una solicitud incompatible devuelve una respuesta comercial válida, no una excepción genérica.
  - **Verificar:** ejecutar casos compatible, incompatible, payload inválido, cancelación, `getTools()`, `executeTool()` y cleanup; ejecutar typecheck/build y entregar evidencia WebMCP a C.

- [x] **C-02. Implementar Result Bridge y Decision Engine**
  - **Owner:** C.
  - **Depende de:** `C-01` y envelope acordado con A.
  - **Qué construir:** `record_provider_result`, idempotencia, creación de `CarrierOffer`, `orchestration_event` y ranking BALANCED TypeScript sobre `0..N` ofertas.
  - **Aceptación:** mismo `tool_call_id` + mismo payload deduplica; mismo ID + payload diferente produce conflicto; cero ofertas produce `NO_MATCH`; una o N ofertas producen resultado explicable; los scores del Golden Flow se reproducen desde datos.
  - **Verificar:** tests unitarios del scorer, prueba de doble ingestión, conflicto idempotente, `db lint`, pgTAP y revisión RLS.

- [ ] **INT-02A. Integrar búsqueda completa y ranking headless**
  - **Owner:** A + C; coordina C.
  - **Depende de:** `A-03` y `C-02`. Antes de integrar A-03, C solo prepara diseño, harness, contratos de consumo y pruebas que no dependan de su implementación.
  - **Qué construir:** un flujo server-side reproducible `FreightRequest → discovery → CandidateProvider[0..N] → matchingServiceId → provider exacto → tools WebMCP → ProviderToolEnvelope → record_provider_result → CarrierOffer[0..N] → BALANCED → FreightRanking`, sin UI de B.
  - **Aceptación:** funciona con 0, 1 y N providers; conserva `matchingServiceId`; registra resultados idempotentemente; reproduce `89/84/72`; mantiene RLS y secretos fuera del cliente; entrega un JSON/ViewModel estable con estados `loading`, `error`, `NO_MATCH` y `success` para consumo de B.
  - **Verificar:** pruebas headless 0/1/N, Golden Flow, caso adicional con cuarto provider o configuración equivalente, replay idempotente, typecheck/build, pruebas DB y búsqueda de secretos. El PR debe incluir script o endpoint reproducible y ejemplos JSON.

  En `INT-02A`, *headless* significa «sin la interfaz CargoMesh propiedad de B». La ejecución provider continúa ocurriendo mediante WebMCP en un navegador/runner compatible; C no debe sustituir `document.modelContext` por una llamada directa a la implementación interna de la tool ni fabricar el resultado desde el servidor.

- [ ] **B-02. Construir intake y dispatch dinámico**
  - **Owner:** B. La ausencia temporal no cambia este ownership.
  - **Depende de:** `B-01` y tipos compartidos; la conexión con datos reales consume el ViewModel estable de `INT-02A`.
  - **Qué construir:** formulario prellenado editable y `/dispatch/[id]` con estados visuales `loading/EVALUATING`, `error`, `OPTIONS_READY` y `NO_MATCH`.
  - **Aceptación:** renderiza `0..N` candidatos/ofertas; no asume tres cards; distingue candidato consultado de oferta persistida; no requiere que A o C reescriban su interfaz.
  - **Verificar:** fixtures UI con cero, una, tres y cuatro ofertas; luego conectar los ejemplos JSON entregados por `INT-02A`.

- [ ] **INT-02B. Integrar visualmente el ranking headless**
  - **Owner:** B; apoyan A + C sin asumir ownership visual.
  - **Depende de:** `B-02` e `INT-02A`.
  - **Qué construir:** consumir el ViewModel estable y conectar intake/dispatch con los estados y ofertas ordenadas del flujo headless.
  - **Aceptación:** `loading`, `error`, `NO_MATCH` y `success` se distinguen visualmente; las cards muestran `0..N` ofertas persistidas y ordenadas; ningún componente contiene reglas por carrier.
  - **Verificar:** recorrido visual desktop/móvil con 0, 1, 3 y 4 ofertas, usando el script o endpoint de `INT-02A`.

- [ ] **INT-02. Cerrar búsqueda completa, ranking y presentación**
  - **Owner:** A + B + C.
  - **Depende de:** `INT-02A` e `INT-02B`.
  - **Qué construir:** validar como un solo corte la ejecución headless y su presentación visual, sin duplicar lógica server-side en componentes.
  - **Aceptación:** añadir un carrier compatible mediante datos/configuración lo incorpora sin modificar orquestador, scorer o UI; B confirma la integración visual.
  - **Verificar:** Golden Flow completo y prueba adicional con un cuarto carrier o configuración equivalente; `INT-02A` por sí sola no permite marcar esta tarea.

### Día 3 — Booking, evidencia y recuperación

- [ ] **A-04. Implementar tools provider de booking**
  - **Owner:** A.
  - **Depende de:** `A-03`.
  - **Qué construir:** `book_freight`, `get_provider_booking_status`, idempotencia provider-side y fixture controls `ACCEPT`, `REJECT`, `NO_RESPONSE`.
  - **Aceptación:** `book_freight` usa `readOnlyHint: false`; repetir la misma key no duplica booking; los controles solo cambian la siguiente respuesta provider.
  - **Verificar:** ejecutar booking dos veces con la misma key y comprobar la misma referencia; probar aceptación y rechazo.

- [ ] **B-03. Completar selección, booking UI y Judge Drawer**
  - **Owner:** B.
  - **Depende de:** `B-02` e `INT-02B`.
  - **Qué construir:** selección humana, espera de confirmación, resultado de booking y drawer de eventos JSON.
  - **Aceptación:** recomendar no selecciona automáticamente; el drawer muestra navegación, tool, persistencia y decisión; no contiene botones que escriban directamente estados comerciales.
  - **Verificar:** recorrido manual desde `OPTIONS_READY` hasta confirmación/rechazo.

- [ ] **C-03. Persistir booking, reset y recuperación mínima**
  - **Owner:** C.
  - **Depende de:** `C-02`, contrato de `A-04`.
  - **Qué construir:** booking interno, provider reference, eventos deduplicados, reset server-side y recuperación sobre carriers restantes.
  - **Aceptación:** selección, request de booking y confirmación son estados separados; reset vacía únicamente datos runtime de demo; rechazo no se convierte en confirmación.
  - **Verificar:** test happy path, test reject y dos ejecuciones consecutivas del reset.

- [ ] **INT-03. Ejecutar Golden Flow y contingencia E2E**
  - **Owner:** A + B + C.
  - **Depende de:** `A-04`, `B-03`, `C-03`.
  - **Qué construir:** flujo feliz completo y un flujo de rechazo recuperable.
  - **Aceptación:** todas las entidades runtime nacen después de su ejecución causal y el Judge Drawer permite demostrarlo.
  - **Verificar:** reset → quote → rank → select → book → status; repetir con `REJECT`.

### Día 4 — Estabilización y entrega

- [ ] **REL-01. Congelar código, desplegar y probar en entorno limpio**
  - **Owner:** C despliega; A verifica WebMCP; B verifica UX.
  - **Depende de:** `INT-03`.
  - **Qué construir:** despliegue público, configuración segura, datos demo reproducibles y smoke test.
  - **Aceptación:** funciona desde una sesión limpia; no hay secretos en el bundle; `main` compila; el flujo puede repetirse después del reset.
  - **Verificar:** `npm run build`, pruebas DB, inspección del bundle y E2E en URL pública.

- [ ] **REL-02. Preparar handoff Devpost**
  - **Owner:** B redacta; A aporta evidencia WebMCP; C aporta arquitectura y pruebas.
  - **Depende de:** `REL-01`.
  - **Qué construir:** historia, screenshots, enlace del repo, instrucciones de demo, evidencia de tools y video menor a tres minutos.
  - **Aceptación:** una persona ajena al equipo entiende el problema, ve la ejecución WebMCP y puede reproducir el Golden Flow.
  - **Verificar:** ensayo cronometrado y revisión cruzada de los tres integrantes.

## 6. Cronograma de integración diario

| Hora relativa | Acción |
|---|---|
| Inicio del día | `git pull --ff-only`, leer avances y declarar la tarea que cada uno toma |
| Mitad del día | Primer PR pequeño o actualización de bloqueo |
| Final de tarde | Integración conjunta y prueba del corte disponible |
| Cierre del día | Actualizar checklist, registro de avances y handoff para las IAs |

Nunca acumulen todo el trabajo hasta la noche del Día 3.

### 6.1 Gates controlados por C

| Gate | Resultado obligatorio | Cierra |
|---|---|---|
| `G0` Contratos | tipos, estados, ownership y navegador objetivo congelados | C con aprobación A/B |
| `G1` Vertical WebMCP | discovery → provider registrado → `quote_freight` observable | C + A; valida B |
| `G2A` Checkpoint headless | providers `0..N` → tools → ofertas idempotentes → BALANCED → ViewModel JSON | C + A; no cierra `G2` |
| `G2` Decisión visual | ViewModel estable → estados visuales → cards `0..N` | C + B; valida A |
| `G3` Booking | selección → booking → confirmación/rechazo → reset repetible | C; validan A/B |
| `G4` Release | build, DB tests, seguridad, navegador objetivo y URL pública | C |

Una tarea terminada en una rama no cierra un gate. El gate se cierra únicamente después de integración y verificación conjunta.

Durante la ausencia temporal de B, `G2A` puede verificarse como checkpoint técnico. `G2` permanece abierto hasta completar `INT-02B` y recibir validación visual de B o una decisión posterior explícita del equipo.

### 6.2 Plan de continuación inmediato

1. A revisa el estado real de `feat/a-webmcp-a03`, completa pruebas/evidencia, actualiza el PR #9 y entrega handoff a C sin modificar archivos de B.
2. C confirma C-02 en `main` y prepara el diseño, contratos de consumo, estados, harness y scripts headless de `INT-02A` que no dependan de código A-03 aún no integrado.
3. Cuando A-03 esté integrado y verificado, A y C conectan `INT-02A` en una rama de integración; A valida ejecución/cleanup WebMCP y C valida persistencia, idempotencia, ranking y seguridad.
4. C publica el ViewModel, ejemplos JSON, endpoint o script reproducible y handoff para B. Aunque `G2A` pase, `INT-02` y `G2` permanecen abiertos.
5. B-02 y B-03 quedan reservadas y sin cambios mientras B está ausente; A y C no implementan placeholders visuales en sus archivos.
6. Cuando B regrese, actualiza su rama desde `main` sin sobrescribir trabajo local, continúa B-02/B-03 y consume el ViewModel de `INT-02A`.
7. B implementa/valida `INT-02B` con apoyo de A/C; solo entonces el equipo puede cerrar `INT-02` y `G2`.

### 6.3 Trabajo paralelo permitido durante la ausencia temporal de B

| Integrante | Trabajo exacto permitido hoy | Límites |
|---|---|---|
| **A** | completar y publicar A-03; preparar su parte de `INT-02A`; documentar registro, ejecución, cancelación y cleanup de tools WebMCP; entregar handoff a C | no modificar dashboard, dispatch, `RequestTable`, componentes ni fixtures visuales de B |
| **C** | verificar C-02 en `main`; diseñar orquestador headless; preparar contratos de consumo, estados, pruebas E2E, scripts, fixtures y evidencia; revisar RLS, idempotencia y secretos | no modificar archivos de B ni implementar código que dependa del contrato A-03 antes de su integración; no cambiar contratos congelados sin coordinación |
| **B** | sin trabajo requerido mientras esté ausente; conserva B-02, B-03 e `INT-02B` | su ausencia no autoriza reasignación ni sustitución de su UI |

### 6.4 Handoff obligatorio de INT-02A para B

Antes de pedir a B que conecte la interfaz, A y C deben entregar:

- contrato versionado del ViewModel y significado de cada campo;
- ejemplos JSON de `loading`, `error`, `NO_MATCH` y `success`, incluyendo 0, 1 y N ofertas;
- distinción explícita entre `CandidateProvider`, resultado WebMCP, `CarrierOffer` y opción rankeada;
- endpoint o script reproducible, precondiciones y comando exacto para probarlo;
- estados HTTP/aplicación, errores esperados y comportamiento de retry/idempotencia;
- commit/PR integrado y resultados de typecheck, build, pruebas DB, Golden Flow y búsqueda de secretos;
- lista de archivos que B puede modificar y lista de fronteras server-side que no debe duplicar;
- criterios visuales desktop/móvil para loading, error, `NO_MATCH` y success;
- riesgos, deuda y bloqueos pendientes para `INT-02B`.

B debe actualizar su rama desde `main` con un flujo no destructivo, preservar cualquier trabajo local y usar este handoff como contrato de consumo. A y C apoyan la conexión sin apropiarse de la interfaz.

## 7. Protocolo para trabajar con distintas IAs

### 7.1 Inicio obligatorio de cada sesión

Cada integrante debe pedir a su IA que ejecute o revise:

```text
1. git status
2. git branch --show-current
3. git pull --ff-only origin main (solo si está en main y limpio)
4. git log --oneline -10
5. README.md
6. docs/00-master/ADR-001_Dynamic_Provider_Registry.md
7. docs/04-execution/CargoMesh_Team_Execution_Checklist.md
8. La sección del contrato maestro correspondiente a su tarea
9. Los PR/commits integrados desde la última sesión
```

La IA no debe confiar en el resumen de un chat anterior cuando Git contiene información más reciente.

### 7.2 Prompt inicial reutilizable

```text
Estamos desarrollando CargoMesh para el WebMCP Challenge. Soy el Integrante [A/B/C].

Antes de modificar código:
1. Lee README.md.
2. Lee docs/00-master/ADR-001_Dynamic_Provider_Registry.md.
3. Lee docs/04-execution/CargoMesh_Team_Execution_Checklist.md.
4. Revisa git status, la rama actual y los últimos 10 commits.
5. Identifica mi ownership y la tarea [TASK-ID].

Reglas:
- La arquitectura opera con 0..N carriers registrados.
- Los nombres comerciales son fixtures de demo, no reglas.
- No modifiques ownership de otro integrante sin señalarlo.
- No expongas service_role ni secretos al cliente.
- Implementa solo la tarea indicada y verifica sus criterios de aceptación.
- Al finalizar, entrega un handoff con archivos, decisiones, pruebas, bloqueos y siguiente paso.
```

### 7.3 Handoff obligatorio al cerrar una sesión

Copiar este bloque en la descripción del PR y en el chat del equipo:

```md
## AI/Developer Handoff

- Task ID:
- Owner:
- Branch:
- Estado: in-progress | blocked | review | done
- Objetivo completado:
- Archivos modificados:
- Contratos o decisiones tomadas:
- Verificación ejecutada y resultado:
- Riesgos o deuda conocida:
- Bloqueos para otro integrante:
- Próximo paso exacto:
- Commit/PR:
```

### 7.4 Regla para actualizar el checklist

```text
PR abierto       → la casilla permanece [ ]
PR en review     → la casilla permanece [ ]
PR integrado     → C ejecuta la verificación; la casilla sigue [ ] hasta aprobarla
Verificación OK  → C marca [x] y registra commit
Verificación KO  → permanece [ ] y se registra bloqueo
PR revertido     → volver a [ ] y explicar motivo
```

Solo C modifica casillas y el registro de avances para evitar conflictos de edición. A y B reportan estado mediante Issues, PR y handoff.

### 7.5 Definition of Done

Una tarea está `done` únicamente cuando:

- está integrada en `main`;
- respeta contratos y ownership;
- compila y pasa sus pruebas;
- no expone secretos;
- incluye handoff y evidencia de verificación;
- C ejecutó el criterio de aceptación;
- los cambios críticos de C recibieron revisión cruzada.

## 8. Registro de avances integrados

Agregar una fila únicamente después de integrar a `main`.

| Fecha/hora | Task ID | Integrante | Commit/PR | Verificación | Siguiente desbloqueado |
|---|---|---|---|---|---|
| 2026-08-29 02:13 | `SH-00` | C | `45435ae` | Revisión cruzada de contratos y ADR-001 | `SH-01` |
| 2026-08-29 02:54 | `SH-01` | C | `95f898d` (#1) | `npm run build` y setup Next.js | `A-01`, `B-01`, `C-01` |
| 2026-08-29 03:17 | `A-01` | A | `37eb5e8` (#2) | Slug dinámico y `not-found.tsx` | `A-02` |
| 2026-08-29 | `C-01` | C | `6503c95` (#6) | Aprobación cruzada A; discovery 10/10, typecheck y build en `main` | `INT-01` con A-02 integrado; `C-02` cuando exista el envelope final |
| 2026-08-29 | `A-02` | A | `5ac1448` (#5) | Revisión C de compatibilidad con C-01; typecheck y build en `main` | `INT-01` |
| 2026-08-30 | `B-01` | B | `3639940` (#4) | C: `npm install`, typecheck y build en `main`; recorrido `/login` → `/dashboard`, navegación móvil y P1 de rutas 404 corregido | Validación visual de B para `G1`; `B-02` según el plan del Día 2 |
| 2026-08-30 | `INT-01 / G1` | A + C; valida B | `13b76d8` (#8) | C: discovery 10/10, parámetros de ruta 3/3, typecheck, build, WebMCP/404/cleanup y bundle sin secretos; B: validación visual desktop/móvil aprobada | `A-03`, `B-02`, `C-02` |
| 2026-08-30 02:02 | `C-02` | C; revisa A | `b11ce1e` (#10) | Aprobación cruzada sobre `da109eb`; C-02 12/12, discovery 10/10, pgTAP 49/49, db lint, typecheck y build en `main`; Golden Flow 89/84/72 y bundle sin secretos | `INT-02A` cuando A-03 esté integrado; diseño/harness headless puede adelantarse sin UI de B; `C-03` cuando exista el contrato A-04 |
| 2026-08-30 10:51 | `A-03` | A; revisa C | `8a0a5a5` (#9) | Aprobación sobre `324ba358`; A-03/discovery/INT-01 24/24, C-02 12/12, typecheck y build en `main`; `getTools()`, ejecución real de coverage/capacity y cleanup WebMCP; bundle sin secretos | `INT-02A` con A + C; `A-04` |

## 9. Bloqueos y decisiones pendientes

| Fecha | Task ID | Bloqueo/decisión | Responsable de resolver | Estado |
|---|---|---|---|---|
| 2026-08-29 | `SH-00` | A inició `A-01` en rama separada; normalizar su output sin detener ni reescribir el spike | C + A | Resuelto en PR #2 |
| 2026-08-29 | `SH-00` | Congelar navegador/build WebMCP, flags y firma observada de `executeTool()` | A + C | Pendiente |
| 2026-08-30 | `INT-02` | B no está disponible hoy; preservar B-02/B-03 y adelantar solo `INT-02A` headless | A + C preparan handoff; B retoma su ownership al regresar | Temporal; `INT-02B` y `G2` permanecen pendientes |

## 10. Estrategia Git y GitHub recomendada

### Ramas

```text
feat/a-webmcp-<task>
feat/b-ui-<task>
feat/c-data-<task>
fix/integration-<task>
```

### Commits

```text
feat(webmcp): ...
feat(ui): ...
feat(data): ...
test(integration): ...
docs(team): ...
```

### Pull Requests

Cada PR debe incluir:

- Task ID del checklist;
- alcance y archivos modificados;
- prueba ejecutada;
- captura o JSON si cambia una tool WebMCP;
- riesgos conocidos;
- `Closes #issue` si utilizan GitHub Issues.

## 11. Recomendación adicional: GitHub Issues como estado vivo

Este Markdown debe conservar el plan y los hitos integrados. Para evitar conflictos editándolo simultáneamente, usen GitHub Issues o GitHub Projects como tablero vivo:

- un issue por Task ID;
- labels `owner-a`, `owner-b`, `owner-c`, `integration`;
- labels `todo`, `in-progress`, `blocked`, `review`, `done`;
- cada rama y PR referencia su issue;
- la IA puede reconstruir el estado leyendo el checklist, `git log` y los issues disponibles;
- las decisiones arquitectónicas duraderas se escriben como ADR, no quedan encerradas en un chat.

La combinación recomendada es:

```text
ADR = decisiones duraderas
Team Execution Checklist = plan, ownership y hitos completados
GitHub Issues/Projects = trabajo vivo
Pull Requests = evidencia y revisión
Git history = verdad de lo que realmente se integró
```

