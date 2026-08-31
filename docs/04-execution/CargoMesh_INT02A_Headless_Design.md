# CargoMesh INT-02A — Diseño de integración headless

## 1. Propósito y alcance

Este documento define el corte técnico `INT-02A / G2A` que conecta los módulos de A y C sin implementar ni modificar la interfaz propiedad de B.

El resultado debe ser un flujo reproducible:

```text
FreightRequest
  → discovery
  → CandidateProvider[0..N]
  → navegación al matchingServiceId exacto
  → tools WebMCP reales
  → ProviderToolEnvelope
  → Result Bridge idempotente
  → CarrierOffer[0..N]
  → BALANCED
  → FreightRanking
  → OrchestrationViewModel v1.0
```

En este contexto, **headless significa sin la UI CargoMesh de B**. No significa llamar directamente a los handlers internos de las tools. La ejecución provider debe continuar ocurriendo en un navegador o runner compatible con WebMCP mediante `document.modelContext`.

Quedan fuera de alcance:

- dashboard, dispatch, cards, loaders y cualquier archivo visual propiedad de B;
- booking, A-04, B-03 y C-03;
- cerrar `INT-02`, `INT-02B` o el gate visual `G2`;
- reglas o bifurcaciones por Andes, Inca, Pacific o cualquier carrier concreto.

## 2. Estado de la arquitectura al iniciar

| Módulo | Responsable | Contrato disponible |
|---|---|---|
| Discovery C-01 | C | `CandidateProvider[0..N]` con `matchingServiceId` y `providerUrl` |
| Provider dinámico A-01/INT-01 | A + C | `/providers/[carrierSlug]?serviceId=<matchingServiceId>` carga el servicio exacto |
| WebMCP A-02/A-03 | A | `check_service_coverage`, `check_capacity` y `quote_freight` registradas dinámicamente |
| Result Bridge C-02 | C | ingestión idempotente de `quote_freight`, evento y `CarrierOffer` |
| Decision Engine C-02 | C | ranking `BALANCED` sobre `0..N` ofertas, `NO_MATCH` y Golden Flow `89/84/72` |

Brechas que `INT-02A` debe cerrar:

1. no existe todavía una operación pública de servidor para crear un `orchestration_run`;
2. no existe un runner reproducible que ejecute la secuencia completa mediante WebMCP;
3. no existe un ensamblador/endpoint de `OrchestrationViewModel` estable para B;
4. el Result Bridge solo acepta `quote_freight`; coverage y capacity aún no quedan observables como eventos;
5. `matchingServiceId` no está presente en el input de ingestión ni se persiste en `carrier_offers` u `orchestration_events`.

## 3. Principios obligatorios

### 3.1 El provider se descubre; no se conoce de antemano

El orquestador recibe `CandidateProvider[0..N]` y procesa la colección. No puede contener listas de slugs, IDs, URLs, precios o resultados asociadas a carriers demo.

### 3.2 El servicio descubierto se conserva de extremo a extremo

`matchingServiceId` identifica el `carrier_service` realmente compatible. Debe conservarse en:

```text
CandidateProvider
  → URL provider
  → ProviderPageConfig
  → ejecución WebMCP
  → Result Bridge
  → evento/oferta persistida
  → ViewModel
```

No se permite seleccionar silenciosamente el primer servicio de un carrier.

### 3.3 El navegador ejecuta WebMCP; el servidor valida y persiste

| Frontera | Responsabilidad |
|---|---|
| Runner WebMCP (A + C) | navegar, descubrir tools, ejecutar, capturar input/output y respetar cleanup |
| APIs server-side de C | autenticar, validar membresía/correlación, crear run, ingerir, evaluar y leer el ViewModel |
| Supabase | aplicar RLS, idempotencia y restricciones de integridad |
| UI de B | consumir el ViewModel sin duplicar discovery, scoring ni persistencia |

### 3.4 Cero candidatos, rechazo comercial y falla técnica son estados distintos

- `NO_MATCH`: no hubo candidatos compatibles o todos respondieron válidamente que no podían atender la solicitud.
- `error`: el flujo no pudo determinar el resultado por fallas técnicas, de seguridad o de persistencia.
- `success`: existe por lo menos una oferta persistida y el ranking está disponible.
- `loading`: el run sigue en `RUNNING`.

Una falla técnica no puede convertirse en un falso `NO_MATCH`.

## 4. Flujo headless acordado

### 4.1 Inicio del run

1. El cliente autenticado solicita crear un run para una `FreightRequest`.
2. El servidor usa el cliente Supabase de sesión para validar al usuario, su membresía y el acceso RLS a la solicitud.
3. Solo después de validar, una función server-only crea un `orchestration_run` con estado `RUNNING`.
4. Se devuelve `runId`, `freightRequestId` y `status`.

Endpoint propuesto:

```http
POST /api/orchestration/runs
Content-Type: application/json

{ "freightRequestId": "<uuid>" }
```

La operación debe definir una política de repetición antes de implementarse. La opción recomendada es aceptar una `idempotencyKey` del caller y garantizar que la misma organización, solicitud y clave recuperen el mismo run.

### 4.2 Discovery

1. El runner invoca `GET /api/orchestration/candidates?freightRequestId=<uuid>`.
2. C-01 devuelve `CandidateProvider[0..N]` sin precios, disponibilidad ni cotizaciones precalculadas.
3. El runner conserva una copia inmutable de cada candidato durante toda la ejecución.

### 4.3 Ejecución por candidato

Para cada candidato, sin asumir cantidad ni nombre:

1. construir la URL con `buildProviderNavigationUrl(candidate, baseUrl)`;
2. verificar que la URL contenga `serviceId=candidate.matchingServiceId`;
3. realizar una navegación de documento completo a la página provider;
4. consultar `document.modelContext.getTools()`;
5. comprobar que están registradas las tools requeridas;
6. ejecutar `check_service_coverage`;
7. si coverage rechaza comercialmente, registrar el resultado y omitir capacity/quote;
8. ejecutar `check_capacity`;
9. si capacity rechaza comercialmente, registrar el resultado y omitir quote;
10. ejecutar `quote_freight`;
11. enviar el resultado al Result Bridge;
12. abandonar la página y confirmar que las tools fueron eliminadas antes de procesar otro candidato.

El orden es secuencial dentro de un candidato. La paralelización entre candidatos solo podrá habilitarse después de demostrar aislamiento de navegación, tool registry e idempotencia.

### 4.4 Persistencia y decisión

1. Cada ejecución produce un `ProviderToolEnvelope` validado.
2. Coverage y capacity producen `orchestration_event`, pero nunca `CarrierOffer`.
3. Solo un `quote_freight` comercialmente exitoso puede producir `CarrierOffer`.
4. Errores técnicos generan eventos fallidos y warnings; no fabrican datos comerciales.
5. Terminados los intentos, el runner invoca `POST /api/orchestration/evaluate-offers`.
6. BALANCED evalúa las ofertas persistidas del run y guarda `FreightRanking`.
7. El run termina como `OPTIONS_READY`, `NO_MATCH` o `FAILED` según las reglas de la sección 7.

## 5. Correlación e idempotencia

### 5.1 Extensión aditiva requerida

Sin modificar `CandidateProvider` ni `ProviderPageConfig`, `RecordProviderResultInput` debe incorporar:

```ts
matchingServiceId: string;
```

El servidor debe comprobar que la combinación siguiente sigue siendo un candidato válido para la `FreightRequest` del run:

```text
carrierId + providerUrl + matchingServiceId
```

Validar solo `carrierId + providerUrl` no es suficiente cuando un carrier tiene varios servicios.

### 5.2 Persistencia de la identidad del servicio

El esquema actual no guarda `matchingServiceId` en `carrier_offers` ni `orchestration_events`. Antes de implementar el runner se propone una migración aditiva:

- agregar `carrier_service_id uuid` a `orchestration_events`;
- agregar `carrier_service_id uuid` a `carrier_offers`;
- crear foreign keys hacia `carrier_services(id)`;
- incorporar el campo a la función RPC de Result Bridge;
- generar nuevamente `database.types.ts`;
- actualizar pgTAP y políticas/RLS si la migración altera superficies de acceso.

La migración no debe renombrar ni eliminar columnas existentes y requiere revisión de A porque conecta el servicio de su `ProviderPageConfig` con la persistencia de C.

### 5.3 Identidad de llamadas

El runner debe generar un `toolCallId` determinista a partir de:

```text
runId + carrierId + matchingServiceId + toolName + attemptNumber
```

Reglas:

- repetir el mismo `toolCallId` con el mismo payload devuelve deduplicación;
- repetirlo con un payload diferente devuelve conflicto;
- un retry exacto reutiliza el paquete original completo, incluidos `startedAt` y `completedAt`;
- reconstruir timestamps para el mismo ID cambia el payload y debe considerarse conflicto;
- un nuevo intento usa `attemptNumber` distinto y, por tanto, un nuevo `toolCallId`.

## 6. Contrato estable para B

El servidor expondrá un modelo discriminado y versionado. B solo debe necesitar `status` para decidir qué representación visual renderizar.

```ts
type OrchestrationViewModel =
  | OrchestrationLoadingViewModel
  | OrchestrationErrorViewModel
  | OrchestrationNoMatchViewModel
  | OrchestrationSuccessViewModel;

type OrchestrationViewModelBase = {
  schemaVersion: "1.0";
  runId: string;
  freightRequestId: string;
  requestCode: string;
  startedAt: string;
  completedAt: string | null;
  candidateCount: number;
  completedCandidateCount: number;
  attempts: ProviderAttemptView[];
  warnings: OrchestrationWarning[];
};
```

### 6.1 Intentos provider

```ts
type ProviderAttemptView = {
  carrierId: string;
  carrierCode: string;
  displayName: string;
  providerUrl: string;
  matchingServiceId: string;
  status: "PENDING" | "RUNNING" | "REJECTED" | "QUOTED" | "FAILED";
  completedTools: Array<
    "check_service_coverage" | "check_capacity" | "quote_freight"
  >;
  stopReason: string | null;
};
```

Un candidato consultado no equivale a una oferta. `attempts.length`, `candidateCount` y `offers.length` pueden ser diferentes.

### 6.2 Estados

```ts
type OrchestrationLoadingViewModel = OrchestrationViewModelBase & {
  status: "loading";
  ranking: null;
  offers: [];
};

type OrchestrationErrorViewModel = OrchestrationViewModelBase & {
  status: "error";
  error: { code: string; message: string; retryable: boolean };
  ranking: null;
  offers: [];
};

type OrchestrationNoMatchViewModel = OrchestrationViewModelBase & {
  status: "NO_MATCH";
  reason: string;
  ranking: FreightRanking;
  offers: [];
};

type OrchestrationSuccessViewModel = OrchestrationViewModelBase & {
  status: "success";
  ranking: FreightRanking;
  offers: RankedOfferView[];
};
```

`NO_MATCH` conserva el `FreightRanking` explicable producido por BALANCED, con `recommendedOfferId: null` y `options: []`.

### 6.3 Oferta ordenada

```ts
type RankedOfferView = {
  offerId: string;
  carrierId: string;
  carrierCode: string;
  displayName: string;
  matchingServiceId: string;
  providerOfferReference: string;
  totalPrice: number;
  currency: "USD";
  transitHours: number;
  rank: number;
  score: number;
  eligible: boolean;
  reasons: string[];
  recommended: boolean;
};
```

Endpoint propuesto:

```http
GET /api/orchestration/runs/<runId>
```

La respuesta se ensambla exclusivamente desde datos permitidos por RLS y resultados persistidos. No vuelve a ejecutar discovery, providers ni scoring durante una lectura.

## 7. Máquina de estados y resolución final

| Situación | Estado DB | ViewModel |
|---|---|---|
| Run en progreso | `RUNNING` | `loading` |
| Discovery devuelve cero candidatos | `NO_MATCH` | `NO_MATCH` |
| Todos los candidatos dan rechazo comercial válido | `NO_MATCH` | `NO_MATCH` |
| Existe al menos una oferta evaluable | `OPTIONS_READY` | `success` |
| Hay ofertas pero todas quedan inelegibles | `NO_MATCH` | `NO_MATCH` con razones |
| Fallan algunos providers y existe al menos una oferta | `OPTIONS_READY` | `success` con warnings |
| Todos los intentos fallan técnicamente | `FAILED` | `error` retryable según causas |
| Falla autenticación, autorización o persistencia | no se oculta | HTTP de error; `error` si el run ya existe |

La transición final debe ejecutarse una sola vez por run. Repetir la evaluación de un run ya cerrado debe usar un contrato explícito de lectura/replay y no recalcular silenciosamente.

## 8. Seguridad

1. Todas las APIs sensibles comienzan con `requireAuthenticatedMember`.
2. El cliente de sesión y RLS determinan si la `FreightRequest` y el run pertenecen a la organización del usuario.
3. `createAdminClient` solo aparece en módulos `server-only`, después de validar usuario, membresía y correlación.
4. `SUPABASE_SERVICE_ROLE_KEY` nunca llega al runner, navegador, props, logs públicos ni `.next/static`.
5. El runner no confía en URLs, inputs ni envelopes sin validarlos.
6. Solo se permiten rutas internas seguras `/providers/...` o URLs absolutas HTTP/HTTPS aceptadas por discovery.
7. El Result Bridge vuelve a validar que run, solicitud, carrier, URL y servicio coincidan; no confía en campos enviados por el navegador.
8. Los nuevos campos/tablas/funciones conservan RLS y grants mínimos. Las funciones `security definer` fijan `search_path` y no quedan ejecutables por roles no previstos.

## 9. Superficies de implementación propuestas

### 9.1 C — server-side y persistencia

- `frontend/src/features/orchestration/start-run.ts`
- `frontend/src/features/orchestration/view-model.ts`
- `frontend/src/features/orchestration/contracts.ts`
- `frontend/src/app/api/orchestration/runs/route.ts`
- `frontend/src/app/api/orchestration/runs/[runId]/route.ts`
- extensión aditiva de Result Bridge para `matchingServiceId` y eventos de coverage/capacity;
- migración Supabase para `carrier_service_id` y, si se aprueba, idempotencia de creación del run;
- tests unitarios, integración, pgTAP, RLS y búsqueda de secretos.

### 9.2 A — ejecución WebMCP

- adapter/harness que use la firma real del navegador WebMCP;
- secuencia `getTools()`/`executeTool()` y navegación completa;
- validación de registro y cleanup por candidato;
- payloads derivados de la `FreightRequest`, sin fixtures dentro de la lógica genérica.

### 9.3 Frontera compartida A + C

Antes de cambiar código deben acordarse:

1. forma aditiva de `matchingServiceId` en Result Bridge;
2. envelopes de coverage y capacity que se persistirán como eventos;
3. identidad determinista de `toolCallId`;
4. firma del runner y navegador objetivo;
5. comportamiento exacto ante rechazo comercial, timeout, retry y cleanup.

## 10. Plan de implementación

### Fase 1 — Congelar contratos aditivos

- aprobar este diseño entre A y C;
- acordar los cinco puntos de la frontera compartida;
- crear tipos y ejemplos JSON sin tocar componentes de B;
- verificar que ningún cambio rompa `CandidateProvider`, `ProviderPageConfig` o `ProviderToolEnvelope`.

### Fase 2 — Run y trazabilidad del servicio

- crear la operación idempotente de inicio de run;
- migrar `carrier_service_id` en eventos/ofertas;
- propagar y validar `matchingServiceId` en Result Bridge;
- actualizar tipos generados, RLS, db lint y pgTAP.

### Fase 3 — Runner WebMCP reproducible

- conectar discovery con navegación provider;
- ejecutar coverage, capacity y quote mediante WebMCP real;
- persistir eventos/ofertas y comprobar cleanup;
- cubrir fallas parciales, retries y conflictos idempotentes.

### Fase 4 — Decisión y ViewModel

- ejecutar BALANCED una vez terminados los intentos;
- ensamblar `OrchestrationViewModel v1.0` desde datos persistidos;
- publicar endpoint/script y ejemplos `loading`, `error`, `NO_MATCH`, `success`;
- entregar handoff de consumo a B.

### Fase 5 — Evidencia de G2A

- ejecutar 0, 1, 3 y 4 providers/configuraciones;
- reproducir Golden Flow `89/84/72` y confianza esperada;
- demostrar mismo payload deduplicado y payload distinto en conflicto;
- ejecutar typecheck, build, pruebas DB/RLS y escaneo de secretos;
- capturar `getTools()`, inputs/outputs y cleanup WebMCP;
- cerrar solo `INT-02A / G2A`, no `INT-02 / G2`.

## 11. Matriz mínima de pruebas

| Caso | Resultado esperado |
|---|---|
| Usuario no autenticado | `401` |
| Usuario sin membresía | `403` |
| Miembro de otra organización | recurso no visible/no accesible |
| 0 candidatos | `NO_MATCH`, cero ofertas, ranking vacío |
| 1 candidato con quote válida | `success`, una oferta, rank 1 |
| N candidatos | `success`, colección variable ordenada |
| Cuarto provider/configuración | aparece sin modificar orquestador ni scorer |
| Servicio de otro carrier | rechazo de correlación |
| Servicio distinto al descubierto | rechazo de correlación |
| Coverage rechaza | evento persistido, capacity/quote omitidas |
| Capacity rechaza | evento persistido, quote omitida |
| Todos fallan técnicamente | `error`, no falso `NO_MATCH` |
| Falla parcial y existe oferta | `success` con warning |
| Replay exacto | deduplicado |
| Mismo ID, payload distinto | conflicto |
| Golden Flow | `89/84/72`, ranking explicable |
| Lectura del ViewModel | no dispara side effects |
| Bundle cliente | cero `service_role` y secretos |
| Cleanup | tools ausentes al abandonar provider |

## 12. Evidencia y handoff para B

El PR de `INT-02A` deberá entregar:

- contrato TypeScript versionado del ViewModel;
- JSON de `loading`, `error`, `NO_MATCH`, una oferta, tres ofertas y cuatro ofertas;
- endpoint o script reproducible con precondiciones y comandos exactos;
- evidencia WebMCP de `getTools()`, `executeTool()` y cleanup;
- evidencia de ofertas/eventos/ranking persistidos;
- resultados de pruebas, db lint, pgTAP, typecheck, build y secretos;
- lista de campos que B debe renderizar y significado de cada estado;
- confirmación de que B no debe ejecutar discovery, Result Bridge ni BALANCED desde componentes.

## 13. Decisiones pendientes antes de codificar

| ID | Decisión | Recomendación | Aprueban |
|---|---|---|---|
| `D-INT02A-01` | Idempotencia al crear runs | `idempotencyKey` por organización + solicitud | C; valida A |
| `D-INT02A-02` | Persistir identidad del servicio | columnas FK `carrier_service_id` en evento y oferta | C + A |
| `D-INT02A-03` | Resultados coverage/capacity | mismo envelope; solo evento, nunca oferta | A + C |
| `D-INT02A-04` | Runner objetivo | navegador compatible con WebMCP y harness automatizable | A + C |
| `D-INT02A-05` | Retry técnico | retry acotado con nuevo attempt; replay conserva payload exacto | A + C |

Ninguna decisión de esta tabla reasigna archivos de B ni permite cerrar el gate visual `G2`.
