# Cierre de carga Cliente–Carrier · HAC-50 · 20 octubre 2026

## Alcance del corte

Rama existente: `codex/unified-workspaces-demo-boundary`. Un origen, un destino,
ventanas de recojo/entrega y múltiples bultos con una categoría y requisitos comunes.
Las categorías activas provienen de la base; no hay límite de ocho ni una lista fija de carriers.
Este corte no cambia la creación idempotente, los IDs, la versión del pedido ni las reglas de ofertas.

## Captura compartida para Cliente y Nova

`GET /api/v2/intake/options` conserva su contrato 2.0 y ofrece cinco equipos ROAD,
cinco empaques y nueve requisitos con etiquetas ES/EN. El consumidor usa sus códigos,
no inventa categorías, equipos o capacidades desde el nombre/ilustración del vehículo.

Equipos: `BOX_TRUCK`, `REEFER_TRUCK`, `FLATBED`, `TANKER_TRUCK`, `TRACTOR_TRAILER`.
La recomendación histórica `REFRIGERATED_TRUCK` se normaliza a `REEFER_TRUCK`.
Recomendaciones que no pertenecen al vocabulario seleccionable se omiten; no convertir
`HAZMAT_TRUCK` ni `SECURE_BOX_TRUCK` a un furgón normal. Las recomendaciones son sugerencias,
no una asignación automática ni prueba de soporte.

Requisitos: `TEMP_CONTROLLED`, `SECURITY_SEAL`, `FRAGILE`, `HAZARDOUS`, `KEEP_DRY`,
`FOOD_GRADE`, `HIGH_VALUE`, `OVERSIZED`, `TANK_COMPATIBILITY`.
Solo temperatura/sello tienen comprobación por evidencia del recurso en el evaluador ROAD;
los demás permanecen pendientes de revisión. Las preguntas sugeridas de una categoría
no se convierten automáticamente en requisitos obligatorios o capacidades verificadas.
Requisitos personalizados persistidos se conservan y permanecen sin verificar.

## Completitud de captura

Nuevo endpoint autenticado, solo lectura:
`GET /api/v2/freight/requests/:id/cargo-readiness?expectedDraftVersion=1`.
La organización se deriva de la sesión, no del query. Respuesta privada/no-store.
Un pedido ajeno o ausente responde 404 y versión obsoleta 409 `STALE_DRAFT`.

Respuesta 2.0 `data`:

- `freightRequestId`, `evaluatedDraftVersion`: identidad y versión realmente leídas.
- `captureStatus`: `COMPLETE` o `INCOMPLETE`.
- `missingFields`: solicita `cargoSpecification.temperatureRange` cuando el usuario
  declaró `TEMP_CONTROLLED` y no aportó el rango.
- `requirements`: código y tipo de verificación pendiente.
- `totals`: peso/volumen calculados desde cantidad y valores de cada bulto.
- `operationalStatus: NOT_EVALUATED`: captura completa no prueba elegibilidad.

Integración del consumidor: guardar el pedido por el endpoint existente; consultar
completitud con su versión; pedir datos faltantes; consultar serviceability de esa misma
versión; mostrar elegible/no elegible/desconocido. No crear una oferta final por esta lectura.
El endpoint no se ha montado automáticamente en la UI de Juan ni se declara una tool Nova nueva.

## Dimensiones en evaluación ROAD

El evaluador por pedido ahora transmite dimensiones de todos los bultos y lee
`transport_assets.usable_dimensions` (centímetros). Se comprueban largo, ancho y alto,
permitiendo solo rotación horizontal del bulto. Bulto que excede el espacio útil:
`UNIT_DIMENSIONS_EXCEEDED`, no elegible. Dimensiones útiles faltantes o inválidas:
`VEHICLE_DIMENSIONS_UNKNOWN`, desconocido. Un cupo sin esta evidencia tampoco prueba cabida.
No se infieren dimensiones desde capacidad en toneladas, volumen o modelo visual.

Es un filtro de envolvente individual, peso y volumen; no certifica acomodación conjunta,
puertas, estiba, reparto de ejes, permisos o restricciones de ruta. La revisión operativa y
el plan de transporte siguen vigentes. No hay algoritmo nuevo de packing ni se suman camiones
incompatibles para fabricar capacidad. La elección final continúa siendo del cliente.

## Activación y pendientes

Sin migración, seed, escritura comercial, despliegue ni cambios en main de este corte.
Registros sin dimensiones reales permanecen desconocidos: completar evidencia, no inventarla.
Pruebas enfocadas a completitud, privacidad/versionado, requisitos y cabida, más tipos/arquitectura;
la validación conjunta del flujo se mantiene para el 21.

Pendientes del cierre global: entrega/integración Luis PR133, consumidor intake/Nova de Juan,
activación autorizada del paquete alojado y comprobación conjunta Cliente→Carrier→Cliente.
Líneas con categorías/requisitos independientes, reparto, múltiples destinos y entregas parciales
siguen en `HAC50_CARGO_LINES_ALLOCATION_DELIVERIES_2026-10-19.md` para una etapa posterior.
