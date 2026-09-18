# INT-02A WebMCP runner (A)

Este módulo implementa la frontera browser-side de A para `INT-02A`.
`runProviderCollection` conserva el runner WebMCP puro, mientras
`runInt02aOrchestration` lo conecta con las APIs server-side de C sin importar
ni ejecutar sus implementaciones internas.

## Invariantes

- procesa `CandidateProvider[0..N]` secuencialmente;
- construye cada URL con `buildProviderNavigationUrl(candidate, baseUrl)`;
- conserva `matchingServiceId` en URL, intento y cada tool call;
- exige `check_service_coverage`, `check_capacity` y `quote_freight` desde
  `getTools()`;
- ejecuta tools mediante `document.modelContext.executeTool()` usando
  `createDocumentModelContextAdapter`;
- omite capacity/quote después de un rechazo de coverage y omite quote después
  de un rechazo de capacity;
- una excepción, envelope inválido o envelope `ok:false` queda como fallo
  técnico y nunca fabrica una cotización;
- abandona cada documento provider antes del siguiente candidato y comprueba
  que ninguna de las cinco tools provider siga activa. La tool read-only
  `get_freight_request_recommendations` pertenece al intake y no se cuenta como
  una sexta tool provider.

## Frontera con el browser controller

`runProviderCollection` recibe un `ProviderNavigationAdapter`. Su implementación
de navegador debe:

1. navegar el documento completo a `navigationUrl`;
2. construir el runtime de la página activa con
   `createDocumentModelContextAdapter(document)`;
3. devolver ese runtime al runner;
4. en `leaveAndGetActiveToolNames(cleanupUrl)`, navegar mediante documento
   completo a `new URL("/", baseUrl).toString()` y consultar `getTools()` en la
   raíz de CargoMesh.

No se admite una implementación que llame directamente a
`createCheckServiceCoverageTool`, `createCheckCapacityTool`,
`createQuoteFreightTool` o sus callbacks `execute`.

### Providers externos

Un `iframe` solo permite obtener `contentDocument` cuando el provider comparte
origen con CargoMesh. WebMCP permite consultar tools de un iframe cross-origin
sin leer ese documento si ambas partes habilitan explícitamente la relación.
Para un `providerUrl` externo registrado se usa
`createExternalProviderNavigationAdapter`:

```ts
const navigation = createExternalProviderNavigationAdapter({
  baseUrl: window.location.origin,
  frame: runnerFrame,
});
```

El adapter añade la Permissions Policy `allow="tools"` al iframe y llama
`document.modelContext.getTools({ fromOrigins: [providerOrigin] })`. El provider
externo debe registrar sus tools con
`{ exposedTo: [cargoMeshOrigin] }`; sin esa autorización bilateral la ejecución
falla de forma segura.

El runner enlaza automáticamente el snapshot inmutable de candidatos devuelto
por el servidor. Antes de navegar, el adapter exige que `carrierId`,
`providerUrl` y `matchingServiceId` coincidan con ese snapshot y que la URL
efectiva sea exactamente la construida por `buildProviderNavigationUrl`.
Después de navegar filtra las tools por el origen registrado y por el
`WindowProxy` exacto del iframe antes de ejecutar `getTools()` o
`executeTool()`.

No lee un `contentDocument` cross-origin, no llama handlers internos y no
acepta una URL propuesta únicamente por la UI. Para el cleanup, el adapter
navega el iframe a la raíz de CargoMesh y comprueba que las tools provider hayan
desaparecido.

## Frontera con C

Cada `ProviderToolCallRecord` entrega:

- `toolCallId`;
- `orchestrationRunId`, `freightRequestId`, `carrierId` y
  `matchingServiceId`;
- `providerUrl` registrado y `navigationUrl` efectivo;
- `toolName`, `toolInput` y `toolOutput` (`ProviderToolEnvelope`);
- `attemptNumber`, `startedAt`, `completedAt` y `durationMs`;
- fallo técnico separado cuando no existe un envelope válido.

`createInt02aToolCallId` implementa la identidad canónica acordada:

```text
cm:int02a:v1:<orchestrationRunId>:<freightRequestId>:<carrierId>:<matchingServiceId>:<toolName>:<attemptNumber>
```

La fábrica continúa siendo inyectable para pruebas, pero el runner usa esa
implementación por defecto. Un intento nuevo incrementa `attemptNumber` y crea
otro ID y timestamps. `replayProviderToolCallRecord` no vuelve a navegar ni a
ejecutar WebMCP: reenvía un clon exacto del record original, incluidos ID,
input, output y timestamps.

`ProviderToolCallRecord` es un payload de handoff del runner, no reemplaza ni
modifica `RecordProviderResultInput`. Las tres tools se enviarán al mismo
`POST /api/orchestration/record-result`: coverage/capacity crean solo eventos;
una quote exitosa también puede crear `CarrierOffer`; un error técnico crea un
evento fallido y nunca una oferta.

## Flujo HTTP de integración

`runInt02aOrchestration` ejecuta el corte headless acordado:

1. `POST /api/orchestration/runs` con `freightRequestId` e `idempotencyKey`;
2. congela y usa exclusivamente `data.runId` y `data.candidates`;
3. delega navegación, `getTools()`, `executeTool()` y cleanup en
   `runProviderCollection`;
4. envía cada record, sin modificarlo, a
   `POST /api/orchestration/record-result`;
5. llama `POST /api/orchestration/evaluate-offers` cuando todos los records
   fueron aceptados;
6. lee `GET /api/orchestration/runs/:runId` y devuelve su ViewModel dentro de
   la evidencia de la ejecución.

Si `POST /runs` devuelve un replay deduplicado ya cerrado (`OPTIONS_READY`,
`NO_MATCH`, `FAILED` o `CANCELLED`), el coordinador entra en modo
`PERSISTED_REPLAY`: no navega, no ejecuta WebMCP, no reenvía records y no
evalúa nuevamente. Solo lee el ViewModel persistido del run. Esto evita crear
timestamps distintos para los mismos `toolCallId` y evita `RUN_NOT_ACTIVE`.

Todas las llamadas usan la sesión same-origin. Un rechazo HTTP o un envelope
inválido detiene el flujo antes del ranking y queda identificado por etapa en
`Int02aApiError`. El coordinador acepta `fetcher` inyectable para pruebas, pero
en navegador usa `fetch` y las APIs públicas reales; nunca llama handlers
provider ni funciones server-only directamente.

## External validation harness

`runExternalWebMcpValidation` composes the production collection runner with
`createExternalProviderNavigationAdapter`. It accepts only an immutable target
snapshot supplied by the caller and requires every target to use an HTTP(S)
absolute URL with an origin different from CargoMesh. It rejects URL
credentials, wildcard origins, duplicate effective destinations, and any
navigation that is not derived from that snapshot with the exact
`matchingServiceId`.

The returned evidence contains the exact CargoMesh origin, provider origins,
navigation URLs, `matchingServiceId` values, calls, timestamps, and cleanup
results. Callers must sanitize the captured records before publishing them. The
harness does not create candidates, persist records, call provider handlers, or
turn a synthetic test into public browser evidence.

Polaris, Apex, and Velocity are synthetic scenario/roadmap fixtures only; they
are not live external providers. Andes, Inca, and Pacific are the live demo
providers, but their currently registered routes share CargoMesh's Vercel
origin and therefore do not satisfy this external-origin harness. Production
remains carrier-agnostic. A real external showcase still requires:

1. an externally deployed registered provider origin;
2. its exact absolute `provider_url` in the discovery snapshot;
3. the provider tools registered with `exposedTo: [cargoMeshOrigin]`;
4. a clean compatible browser run capturing `getTools`, `executeTool`, and
   cleanup evidence.

`exposedTo` remains a provider registration policy; the harness cannot grant
that permission. It only requests tools from the exact registered provider
origin and rejects navigation outside the immutable discovery snapshot.
