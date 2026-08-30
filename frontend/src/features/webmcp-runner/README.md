# INT-02A WebMCP runner (A)

Este módulo implementa únicamente la frontera browser-side de A para
`INT-02A`. No crea orchestration runs, no persiste resultados y no ejecuta
BALANCED.

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
  que las tools provider ya no estén activas.

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
