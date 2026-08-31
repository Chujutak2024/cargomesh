# CargoMesh A-04 — Propuesta de contrato provider para booking

## Estado

`DRAFT / REQUIERE APROBACIÓN DE C`

Este documento inicia A-04 sin modificar contratos TypeScript compartidos, C-03,
Supabase, el checklist ni la interfaz propiedad de B. La implementación comenzará
después de que C confirme las decisiones abiertas de la sección 10.

## 1. Alcance de A

A implementará en la página provider dinámica:

- `book_freight` mediante `document.modelContext.registerTool`;
- `get_provider_booking_status` mediante `document.modelContext.registerTool`;
- schemas JSON con `additionalProperties: false`;
- `ProviderToolEnvelope<T>`;
- `AbortSignal` y cleanup junto con las tools provider existentes;
- idempotencia provider-side;
- reloj y storage inyectables para pruebas;
- fixtures provider-side genéricos identificados por `providerServiceCode`;
- controles demo `ACCEPT`, `REJECT` y `NO_RESPONSE` que solo afectan respuestas
  provider y nunca escriben estados internos de CargoMesh.

Quedan fuera de alcance de A-04:

- persistir `bookings` o `booking_events`;
- selection API, Result Bridge de booking o recovery;
- migraciones, RLS, service role y Supabase;
- dashboard, dispatch, booking UI y Judge Drawer;
- cerrar `INT-02`, `G2`, `INT-03` o `G3`;
- ramas o condiciones por nombre, código o slug de carrier.

## 2. Frontera provider versus CargoMesh

La respuesta de `book_freight` pertenece al carrier y no puede contener el UUID
interno de CargoMesh. Se propone separar estos dos conceptos:

```ts
// Salida WebMCP de A. No conoce bookings.id.
type ProviderBookFreightResult = {
  schemaVersion: "1.0";
  freightRequestId: string;
  providerOfferReference: string;
  providerReference: string;
  providerBookingStatus: "PENDING_PROVIDER_CONFIRMATION";
  providerResponseDeadline: string;
  paymentRequired: boolean;
  paymentUrl: string | null;
  idempotentReplay: boolean;
};

// Resultado server-side de C después de validar y persistir.
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

La frontera propuesta es:

```text
WebMCP ProviderToolEnvelope<ProviderBookFreightResult>
  → validación/correlación server-side de C
  → creación o deduplicación de bookings.id
  → BookingResult
```

## 3. Contrato propuesto de `book_freight`

La tool es mutante y declara `readOnlyHint: false`.

```ts
type BookFreightInput = {
  freight_request_id: string;
  provider_offer_reference: string;
  idempotency_key: string;
  authorization_context: {
    authorization_reference: string;
    authorized_by: "HUMAN_SELECTION" | "AUTO_BOOKING_POLICY";
  };
  selection_mode: "ASSISTED" | "SMART_AUTO";
};
```

Reglas propuestas:

1. Todos los strings son obligatorios y no vacíos.
2. `HUMAN_SELECTION` requiere `selection_mode: "ASSISTED"`.
3. `AUTO_BOOKING_POLICY` requiere `selection_mode: "SMART_AUTO"`.
4. El provider devuelve inicialmente
   `PENDING_PROVIDER_CONFIRMATION`; reservar no equivale a confirmar.
5. `providerResponseDeadline` se calcula con un reloj capturado una vez por
   ejecución y, para el demo P0, es `issuedAt + 15 minutos`.
6. `paymentRequired` es `false` y `paymentUrl` es `null` en el Golden Flow;
   no se simula un pago.

## 4. Idempotencia provider-side

Identidad propuesta:

```text
providerServiceCode + idempotency_key
```

Comportamiento:

- misma identidad + mismo input normalizado: misma `providerReference`, mismo
  deadline y `idempotentReplay: true`;
- primera ejecución: `idempotentReplay: false`;
- misma identidad + payload diferente: envelope `ok:false` con
  `IDEMPOTENCY_CONFLICT` y sin crear otra reserva provider;
- el storage de runtime será inyectable; navegador usa storage de sesión y las
  pruebas usan un adapter en memoria;
- la referencia genérica se deriva de datos provider y de la identidad de la
  solicitud, nunca de una rama por carrier.

La regla para una segunda `idempotency_key` sobre la misma
`provider_offer_reference` requiere confirmación de C. La recomendación es no
crear una segunda reserva activa: devolver `BOOKING_ALREADY_EXISTS` y conservar
la primera `providerReference` como detalle seguro de correlación.

## 5. Contrato propuesto de `get_provider_booking_status`

La tool es de consulta y declara `readOnlyHint: true`.

```ts
type GetProviderBookingStatusInput = {
  provider_reference: string;
};

type ProviderBookingStatus =
  | "PENDING_PROVIDER_CONFIRMATION"
  | "CONFIRMED"
  | "REJECTED"
  | "EXPIRED"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "CANCELLED";

type ProviderBookingEvent = {
  providerEventId: string;
  eventType: string;
  occurredAt: string;
  countryCode: string;
  city: string;
  description: string;
};

type ProviderBookingStatusResult = {
  schemaVersion: "1.0";
  providerReference: string;
  providerBookingStatus: ProviderBookingStatus;
  providerStatusReason: string | null;
  currentLocation: {
    countryCode: string;
    city: string;
  } | null;
  updatedEta: string | null;
  providerResponseDeadline: string;
  paymentStatus: "NOT_REQUIRED" | "PENDING" | "PAID" | "FAILED";
  events: ProviderBookingEvent[];
};
```

Una referencia desconocida devuelve envelope `ok:false` con
`BOOKING_NOT_FOUND`; no se fabrica un booking.

## 6. Fixture controls

Los controles son estado provider-side, separado de CargoMesh:

| Control | Próxima respuesta de status | Persistencia provider |
|---|---|---|
| `ACCEPT` | `CONFIRMED` | queda terminal `CONFIRMED` |
| `REJECT` | `REJECTED` | queda terminal `REJECTED` |
| `NO_RESPONSE` | `PENDING_PROVIDER_CONFIRMATION` | permanece pendiente |

`NO_RESPONSE` nunca aparece dentro de `ProviderBookingStatus`. Cuando el reloj
de CargoMesh supera `providerResponseDeadline`, C deriva el estado interno
`EXPIRED`; el provider continúa respondiendo `PENDING_PROVIDER_CONFIRMATION`.

Cambiar un fixture control no actualiza directamente `bookings`,
`freight_requests` ni `booking_events`. Solo una ejecución WebMCP real produce
un resultado que C puede validar y persistir.

## 7. Eventos e idempotencia de polling

Cada evento provider tiene `providerEventId` estable. Polling repetido de una
reserva sin cambios devuelve los mismos eventos y no inventa timestamps.
C persiste con la identidad:

```text
bookingId + providerEventId
```

Un cambio terminal agrega como máximo un evento nuevo. Consultas posteriores
reutilizan el mismo evento terminal.

## 8. Registro y cleanup

Después de A-04, una página provider debe exponer:

```text
check_service_coverage
check_capacity
quote_freight
book_freight
get_provider_booking_status
```

Las cinco tools comparten el mismo `AbortSignal` de registro. Al abandonar la
página provider no debe quedar activa ninguna de ellas.

## 9. Verificación propuesta

- schemas rechazan propiedades adicionales;
- `book_freight` declara `readOnlyHint: false`;
- status declara `readOnlyHint: true`;
- payload inválido devuelve `INVALID_INPUT`;
- misma key + mismo payload conserva referencia y deadline;
- misma key + payload distinto devuelve `IDEMPOTENCY_CONFLICT`;
- segunda key sobre la misma oferta sigue la decisión aprobada por C;
- `ACCEPT`, `REJECT` y `NO_RESPONSE` respetan la máquina de estados;
- `NO_RESPONSE` nunca se expone como status provider;
- polling repetido no duplica eventos provider;
- provider desconocido usa fixture conservador genérico;
- `AbortSignal`, `getTools()`, `executeTool()` y cleanup;
- 0 condiciones por carrierCode, nombre o slug;
- typecheck, build y bundle sin secretos.

## 10. Decisiones que C debe aprobar antes de implementar contratos compartidos

| ID | Decisión | Propuesta de A |
|---|---|---|
| `D-A04-01` | Separar resultado provider de resultado persistido | `ProviderBookFreightResult` no contiene `bookingId`; `BookingResult` de C sí |
| `D-A04-02` | Forma de `authorization_context` | referencia opaca + `HUMAN_SELECTION`/`AUTO_BOOKING_POLICY` |
| `D-A04-03` | Enums de `selection_mode` | reutilizar exactamente `ASSISTED` y `SMART_AUTO` |
| `D-A04-04` | Segunda key para la misma oferta | rechazar con `BOOKING_ALREADY_EXISTS`; DB conserva además el guard de booking activo |
| `D-A04-05` | Deadline demo | reloj inyectable, capturado una vez, +15 minutos |
| `D-A04-06` | Payment status | `NOT_REQUIRED`, `PENDING`, `PAID`, `FAILED`; Golden Flow usa `NOT_REQUIRED` |
| `D-A04-07` | Evento provider | campos canónicos camelCase del contrato de la sección 5 |
| `D-A04-08` | Fixture controls | solo alteran respuestas WebMCP; `NO_RESPONSE` conserva `PENDING_PROVIDER_CONFIRMATION` |
| `D-A04-09` | Result Bridge y toolCallId de booking/status | C define la correlación e identidad server-side antes de C-03 |

Hasta recibir estas respuestas, A no modificará `contracts.ts`, Result Bridge,
orchestration, Supabase ni consumidores de B/C.
