# ADR-002 — Recomendaciones de borrador D1 mediante WebMCP

> **Estado:** Aceptado para la demo técnica  
> **Fecha:** 2026-09-02  
> **Impacto:** Intake, WebMCP, autorización, Supabase, UX y evidencia de demo

## Contexto

El contrato maestro ya permite que una organización reutilice un perfil de carga y revise sus valores antes de confirmar una `FreightRequest`. D1 hace visible esa capacidad durante el intake: CargoMesh puede proponer datos de un borrador a partir de antecedentes autorizados, pero el miembro decide de forma explícita qué campos adoptar.

Esto **no** cambia el vertical slice comercial. Una recomendación de borrador no es una oferta de carrier, una selección comercial, una reserva ni una confirmación de provider.

```text
recomendación D1 de campos
    != CarrierOffer
    != freight_decision.recommended_offer_id
    != selected_offer_id
    != Booking
```

## Decisión

CargoMesh expone en la pantalla de intake una tool WebMCP propia y de solo lectura:

```text
get_freight_request_recommendations({ freightRequestId, draftVersion })
```

La tool se registra en el documento anfitrión de CargoMesh mediante `document.modelContext`. El consumidor la descubre y ejecuta mediante la API nativa de Chrome:

```javascript
document.modelContext.executeTool(tool, JSON.stringify(input), { signal })
```

No es una tool de carrier y no sustituye ni altera las cinco tools de un provider (`check_service_coverage`, `check_capacity`, `quote_freight`, `book_freight`, `get_provider_booking_status`). Su propósito es reducir la carga de ingreso **antes** de que exista una corrida de orquestación.

La respuesta es un envelope `schemaVersion: "1.0"`, ligado al `freightRequestId` y a la versión exacta del borrador. Cada sugerencia contiene su procedencia, razones legibles y un `proposedFields` parcial. El modal debe mostrar fuente, motivo y diff; no puede aplicar una sugerencia al abrirse, cerrarse o cancelarse.

## Invariantes de producto y seguridad

1. Solo un miembro autenticado con membresía `ACTIVE` de la organización dueña de la solicitud puede leer recomendaciones y el borrador. El `PATCH` que aplica campos requiere además el rol `SUPERVISOR` en esa organización.
2. La fuente efectiva de D1 v1 es `ORGANIZATION_HISTORY`; para un caso de demo controlado puede emitirse como `SYNTHETIC_RECOMMENDATION_HISTORY`. `CARGO_PROFILE` queda reservado en el schema, pero no puede emitirse hasta que tenga consulta, autorización y pruebas propias. Nunca se consulta ni se expone historial de otra organización.
3. Los datos sintéticos se identifican como tales. Preparan un caso demo, pero no precrean `CarrierOffer`, `FreightDecision`, `Booking`, eventos ni una corrida de orquestación.
4. La recomendación es de solo lectura. El único write es un `PATCH` posterior iniciado por el usuario con uno o más campos seleccionados.
5. Cerrar, cancelar, no seleccionar campos, recibir error o recibir `STALE_DRAFT` no muta el borrador.
6. La UI no infiere aliases, campos implícitos ni valores omitidos. El servidor valida los nombres canónicos, combina el patch con el borrador persistido y devuelve el snapshot canónico completo.
7. Los totales normalizados no son aceptables como input de una recomendación. El servidor recalcula `cargo_weight_kg` y `cargo_volume_m3` cuando la forma de carga lo requiere.
8. El `PATCH` D1 solo opera con borradores editables (`DRAFT` o `PENDING`). Una solicitud `ORCHESTRATING` o posterior rechaza el write sin modificar estado. Esta restricción no bloquea el `GET` ni la ejecución read-only de la tool; ambos pueden leer el borrador autorizado y conservan la protección por versión `STALE_DRAFT`.

## Algoritmo de recomendación v1

La recomendación no usa tarifas, vehículos, disponibilidad de carriers ni
resultados de una corrida. Para el borrador autorizado actual, consulta como
máximo tres solicitudes históricas de la misma organización que estén en
`BOOKED` y coincidan exactamente en:

```text
origin_country + origin_city
destination_country + destination_city
cargo_category_id
cross_border
```

Se ordenan por actualización más reciente. Si no hay coincidencias, la tool
devuelve `suggestions: []`, no inventa una sugerencia. La marca sintética
solo identifica un antecedente de demo ya autorizado; no cambia ese algoritmo
ni permite mostrarlo como disponibilidad o cotización vigente.

## Campos canónicos aplicables

`proposedFields` admite únicamente estos nombres. Un campo ausente no cambia el valor persistido; la aplicación se realiza solo sobre los campos que el miembro seleccionó.

```text
origin_country                  origin_city
origin_address                  pickup_contact_name
pickup_contact_phone            destination_country
destination_city                destination_address
receiver_name                   receiver_company
receiver_phone                  cargo_category_id
cargo_description               cargo_entry_method
entry_quantity                  entry_unit_weight_kg
units_per_entry                 entry_length_cm
entry_width_cm                  entry_height_cm
package_count                   cargo_specifications
requires_refrigeration          temperature_min_c
temperature_max_c               is_hazardous
is_fragile                      is_oversized
is_high_value                   is_stackable
special_instructions            pickup_mode
pickup_window_start             pickup_window_end
delivery_deadline               budget_max
optimization_strategy           available_documents
cross_border
```

Reglas adicionales:

- `cargo_weight_kg` y `cargo_volume_m3` son derivados y nunca pertenecen a `proposedFields`.
- Para `TOTAL_WEIGHT`, no son aplicables `entry_quantity`, `entry_unit_weight_kg` ni `units_per_entry`; el peso total válido ya debe estar persistido.
- Para métodos unitizados, el servidor requiere cantidad, peso unitario, `units_per_entry` y dimensiones válidas antes de recalcular peso y volumen.
- `ASAP` elimina ventanas de recojo; `SCHEDULED` exige una ventana válida y un deadline posterior al recojo cuando se haya indicado.
- `cross_border` se deriva de los países de origen y destino. Si llega como propuesta, debe coincidir con ese cálculo; nunca es una autoridad separada.

## Contrato server-side y concurrencia

Los endpoints protegidos son:

```text
GET   /api/freight-requests/:freightRequestId/recommendations?draftVersion=N
GET   /api/freight-requests/:freightRequestId/draft
PATCH /api/freight-requests/:freightRequestId/draft
```

El `PATCH` acepta exactamente:

```json
{
  "draftVersion": 3,
  "proposedFields": {
    "cargo_entry_method": "PALLETS",
    "entry_quantity": 10,
    "entry_unit_weight_kg": 800,
    "units_per_entry": 1
  }
}
```

El write se autoriza, valida, normaliza y condiciona atómicamente por:

```text
freight_request.id
+ organization_id del miembro ACTIVE
+ draft_version recibido
+ status editable
```

En éxito incrementa `draft_version` y devuelve el snapshot completo y los totales canónicos. Si otra edición o una transición de estado ganó la carrera, devuelve `409 STALE_DRAFT`; la UI descarta el resultado obsoleto y recarga el borrador. Un intento inválido o no editable devuelve `422 INVALID_DRAFT`; una sesión ausente o ajena devuelve `401` o `403` respectivamente.

## Límites explícitos

D1 no:

- escoge carrier ni crea una `CarrierOffer`;
- invoca cobertura, capacidad, cotización, booking o tracking;
- calcula o modifica el ranking `BALANCED`;
- salta la confirmación corporativa;
- permite a WebMCP escribir el borrador sin consentimiento humano;
- usa fixtures de provider como si fueran historial de organización.

Después de que el usuario revise y confirme la solicitud, se conserva el flujo canónico del master:

```text
FreightRequest confirmada
→ discovery 0..N
→ WebMCP de carriers
→ Result Bridge
→ ofertas y ranking
→ selección humana
→ booking / confirmación / recovery
```

## Evidencia de aceptación

Para considerar D1 integrado se requiere:

1. Descubrimiento y ejecución real de la tool mediante `document.modelContext`.
2. Fuente, razón y diff visibles; selección explícita y cancelación sin write.
3. `PATCH` persistido, `draftVersion` incrementado y totales canónicos tras recarga.
4. Prueba de `STALE_DRAFT` que demuestre ausencia de write obsoleto.
5. Rechazo de una solicitud no editable y cleanup con cero tools D1 al salir del documento anfitrión.
6. Pruebas de autorización, validación de whitelist, normalización y RLS, además de typecheck y build.

## Ownership

- **A:** registro, validación del envelope, ejecución WebMCP nativa y cleanup.
- **B:** host, modal, accesibilidad, diff, consentimiento y recarga visual.
- **C:** endpoints autenticados, autorización, algoritmo/fuentes, persistencia atómica, normalización, RLS y pruebas de datos.

Este ADR es una precisión de la sugerencia de perfiles de carga ya prevista en el contrato maestro; no habilita nuevas acciones comerciales ni amplía el lifecycle de booking.
