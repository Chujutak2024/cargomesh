# WebMCP External Execute — Escenarios y límite de evidencia

> Esta guía separa lo que puede demostrarse hoy mediante `document.modelContext`
> de los escenarios enriquecidos que todavía requieren implementación. Datos
> sintéticos, capturas fixture o una ruta de provider no sustituyen discovery y
> ejecución real de una tool.

## Estado actual

| Capacidad | Contrato / herramienta | Estado y evidencia válida |
| --- | --- | --- |
| Factibilidad de un provider | `check_service_coverage`, `check_capacity` | Implementada para los providers registrados que descubren las tools desde su origin autorizado. |
| Cotización y decisión | `quote_freight` + Result Bridge / BALANCED | Implementada. `evaluate_offers` es una operación server-side de CargoMesh, no una tool WebMCP expuesta al agente. |
| Reserva y confirmación | `book_freight`, `get_provider_booking_status` | Implementada después de la selección ASSISTED y autorización del Booking Bridge. |
| Recomendación de borrador | `get_freight_request_recommendations` | Implementada en CargoMesh. Requiere sesión, borrador compatible y consentimiento explícito antes del PATCH. |
| Directorio y reputación de shippers | — | Propuesto. Las tablas de organizaciones y perfiles no exponen por sí mismas una tool WebMCP ni autorizan su lectura. |

Las seis tools reales actuales son las cinco del provider y
`get_freight_request_recommendations`. La disponibilidad se prueba con
`document.modelContext.getTools()` y la llamada nativa
`executeTool(tool, JSON.stringify(input), { signal })`; nunca mediante handlers
directos ni IDs hardcodeados.

## Golden Flow verificable

1. Un SUPERVISOR autenticado crea o abre un FreightRequest en estado `DRAFT` o
   `PENDING`.
2. CargoMesh relee el intake y el execution intent persistidos.
3. En cada provider registrado, el navegador descubre cobertura, capacidad y
   cotización; CargoMesh persiste los eventos y construye el ranking BALANCED.
4. El usuario selecciona una oferta. Solo entonces se autoriza y ejecuta
   `book_freight`; el replay conserva la misma reserva.
5. `get_provider_booking_status` alimenta el estado, eventos y Judge Drawer.
6. Para un borrador, la persona puede abrir recomendaciones, elegir campos
   canónicos y aplicar el resultado. El servidor recalcula peso y volumen,
   incrementa `draftVersion` y rechaza un `STALE_DRAFT` con HTTP 409.

La cancelación de una recomendación no muta el borrador. Una página fixture o
`?scenario=` se reserva para regresión visual y no cuenta como evidencia de este
flujo.

## Contrato de recomendación D1

La herramienta no recibe ciudad ni categoría libres de un agente. Su input
canónico es:

```json
{
  "freightRequestId": "uuid-del-borrador",
  "draftVersion": 1
}
```

Devuelve sugerencias con `sourceType`, explicación, razones y
`proposedFields`. La UI muestra el diff y permite seleccionar campos de la
whitelist. No se aplican aliases, peso total ni volumen desde la sugerencia.

## Datos de escenarios ampliados

`supabase/scenarios/expanded-fleet/seed.sql` contiene flota, shippers y carriers
sintéticos para una demostración controlada. No es una migración ni se ejecuta
con `db push`.

Que los datos estén cargados en un entorno de evaluación **no** convierte a un
carrier en provider WebMCP. En concreto, Polaris, Apex y Velocity siguen siendo
escenarios de datos hasta que cada uno tenga:

- una página/provider origin desplegado e incluido explícitamente en
  `CARGOMESH_TOOL_CALLER_ORIGINS`;
- `matchingServiceId` persistido y coherente con el servicio elegido;
- discovery real de las cinco tools provider y cleanup al abandonar el origin;
- pruebas de cobertura/capacidad/cotización y, para booking, autorización e
  idempotencia;
- evidencia de navegador sanitizada.

Hasta entonces, el Golden Flow oficial usa únicamente providers ya registrados
y validados. No se debe afirmar que Polaris, Apex o Velocity fueron consultados
en vivo ni mostrar `supports_webmcp` como prueba de ejecución.

## Escenarios de demo propuestos

Estos prompts son guion de futuro y solo pasan a evidencia cuando cumplan el
bloque anterior:

- «¿Polaris puede llevar 15 toneladas de uva refrigerada de Ica a Santiago?»
- «Cotiza repuestos mineros de Lima a Santiago y explica el ranking.»
- «Recomiéndame los campos de un envío anterior y déjame escoger qué aplicar.»
- «Consulta el estado de una reserva ya autorizada y muestra sus eventos.»
- «Muestra organizaciones y reputación.» — requiere un contrato server-side y
  una nueva tool con RLS; no se implementa como lectura pública.

## Checklist de evidencia

- [ ] Usuario demo con membresía `ACTIVE` y rol `SUPERVISOR`.
- [ ] Snapshot de `getTools()` por cada origin realmente usado.
- [ ] Inputs y outputs sanitizados de las tools ejecutadas.
- [ ] Eventos persistidos, decisión, booking/replay o recuperación según el caso.
- [ ] Cleanup: cero tools del provider tras salir de cada origin.
- [ ] Para D1: diff seleccionado, PATCH persistido, recarga canónica y caso
  `STALE_DRAFT`.
- [ ] Ningún escenario de datos se presenta como ejecución si carece de runtime
  WebMCP desplegado.
