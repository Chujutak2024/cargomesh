# Freight intake persistido — contrato v1

Estado: implementación para revisión de A y consumo posterior por B. No acredita
por sí sola el Golden Flow público ni el cierre de REL-01/REL-02.

## Problema y alcance

El formulario inicial usa un UUID de fixture para consultar `execution-intent`.
Los UUID del seed local y del proyecto remoto pueden diferir aunque ambos tengan
el código visible `FR-1042`. Una sesión válida no hace que ese UUID exista.

El nuevo contrato resuelve el código dentro de la organización de la membresía
autenticada y entrega el UUID persistido. Es **solo lectura**: no crea una carga,
no guarda cambios del formulario, no resetea runs y no actualiza fechas.

## API y seguridad

`GET /api/freight-requests/intake/{requestCode}`

- Código de 1–64 caracteres alfanuméricos, guion o guion bajo; comienza alfanumérico.
- Sesión real mediante cookies y `auth.getUser()`; membresía `ACTIVE` requerida.
- Usa el contexto de `requireAuthenticatedMember()` existente. Actualmente este
  resolver elige una membresía activa; este cambio no introduce selector de
  organización. No debe presentarse como selección multi-organización explícita.
- Filtro por `organization_id` y `code`, además de las políticas RLS existentes.
- No acepta UUID de organización, identidad ni rol enviados por el cliente.
- Cliente Supabase de sesión; no utiliza `service_role`.
- Respuestas `Cache-Control: private, no-store`, incluidos los errores.
- HTTP 200: `{ "ok": true, "data": FreightRequestIntakeViewModel }`.
- Errores: `{ "ok": false, "error": { "code": "...", "message": "..." } }`.

| HTTP | Código | Comportamiento de UI |
| --- | --- | --- |
| 400 | `INVALID_ARGUMENT` | Corregir el código; no iniciar runner. |
| 401 | `UNAUTHENTICATED` | Solicitar login; no usar fixture como respaldo. |
| 403 | `FORBIDDEN` | Mostrar falta de acceso; no iniciar runner. |
| 404 | `NOT_FOUND` | No hay solicitud visible en ese contexto; no inventar UUID. |
| 500 | `FREIGHT_REQUEST_INTAKE_UNAVAILABLE`, `INVALID_FREIGHT_REQUEST_INTAKE`, `INTERNAL_ERROR` | Mostrar error recuperable sin iniciar runner. |

## Imports

```ts
import { fetchFreightRequestIntake } from "@/features/freight-requests/intake-client";
import type { FreightRequestIntakeViewModel } from "@/features/freight-requests/intake-contracts";

const intake = await fetchFreightRequestIntake(requestCode);
// intake.freightRequestId es el UUID a usar en execution-intent y POST /runs.
```

Los Server Components pueden importar `getFreightRequestIntake` de
`intake-server`; nunca importar ese módulo desde un componente cliente.

## ViewModel

- `schemaVersion`: `"1.0"`.
- `freightRequestId`, `requestCode`, `status`, `updatedAt`: identidad y estado persistidos.
- `organization`: `id`, `name`, `defaultCurrency`.
- `currentOperator`: `memberId`, `displayName` de la sesión. **No representa al
  solicitante histórico ni modifica `requested_by_member_id`.**
- `cargo`: `profileName` nullable, `categoryName`, `categoryCode`, `entryMethod`,
  `quantity`, `unitsPerEntry`, `unitWeightKg`, `lengthCm`, `widthCm`, `heightCm`,
  `totalWeightKg`, `totalVolumeM3`.
- `route`: `origin`, `destination`, `pickupContact: {name, phone}`,
  `deliveryContact: {name, company, phone}`, `operationalNotes`.
- `execution`: `transportMode`, `serviceType`, `pickupMode`, `requiredPickup`,
  `pickupWindowStart`, `pickupWindowEnd`, `deliveryDeadline`, `budgetMax`,
  `strategy: "BALANCED"`, `availableDocuments`.

Los números unitarios, dimensiones, volumen y presupuesto pueden ser `null`
según la fila persistida; por ejemplo, `TOTAL_WEIGHT` no requiere dimensiones.
`totalWeightKg` siempre es positivo. No reemplazar valores ausentes por cifras
del fixture. `budgetMax` reproduce `budget_max` sin conversión monetaria;
`defaultCurrency` es configuración de la organización, no una cotización.
Este contrato v1 conserva el alcance BALANCED; otras estrategias no están habilitadas.

Los timestamps incluyen zona horaria y se normalizan a UTC. El formato visual
local no debe reemplazar estos valores en los inputs de WebMCP. Leer no implica
que la ventana siga vigente: la preparación de la demo debe verificarla antes
de ejecutar el Golden Flow.

Ejemplo parcial sintético (no credenciales ni respuesta de una corrida pública):

```json
{
  "schemaVersion": "1.0",
  "freightRequestId": "60000000-0000-0000-0000-000000000001",
  "requestCode": "FR-1042",
  "organization": { "id": "00000000-0000-0000-0000-000000000001", "name": "Demo Organization", "defaultCurrency": "USD" },
  "currentOperator": { "memberId": "50000000-0000-0000-0000-000000000001", "displayName": "Demo Supervisor" },
  "cargo": { "entryMethod": "PALLETS", "quantity": 10, "unitsPerEntry": 1, "unitWeightKg": 800, "totalWeightKg": 8000, "totalVolumeM3": 18 }
}
```

Para un ejemplo completo y ejecutable, ver `intake.test.ts`.

## Handoff de integración para B

1. Trabajar en rama separada de la landing PR #34, sobre la base que incorpore
   este contrato aprobado (o combinación temporal acordada).
2. Resolver el código de la solicitud al abrir el formulario real. No iniciar
   `createFreightIntakeFixture()` como fuente de negocio en modo real.
3. Mapear el ViewModel a la presentación. Etiquetar `currentOperator` como
   operador actual; evitar seguir mostrando Carlos Mendoza como identidad fija.
   Campos sin dato deben mostrarse como tales, no completarse con fixtures.
4. Mantener deshabilitado el submit hasta tener datos persistidos. Ante 401/403/
   404/500, mostrar el error y no llamar a WebMCP ni a `POST /runs`.
5. Releer al confirmar y comprobar correlación de código, UUID y organización
   con el formulario cargado. Si cambió el contexto, pedir recarga/confirmación;
   no ejecutar silenciosamente una solicitud distinta.
6. Usar el UUID resuelto para `execution-intent`, `POST /runs` y los inputs de
   quote. Conservar la relectura de `execution-intent` y verificar su UUID/código.
   Los totales del runner deben salir de `totalWeightKg`/`totalVolumeM3`, no de
   `quantity * unitWeightKg` omitiendo `unitsPerEntry`.
7. Este endpoint no persiste ediciones: en el flujo real actual mostrar los
   datos comerciales como solo lectura. Si se desea editar/crear cargas, requiere
   un contrato de escritura aparte antes de afirmar que esos cambios se guardan.
8. Conservar fixtures solo en regresión visual explícita. No caer al fixture en
   errores. Valores nullable no soportados por la UI requieren estado explicativo,
   no datos inventados ni ejecución con ceros.
9. No duplicar lógica de A/C ni tocar Supabase, auth, guards o WebMCP.
10. Conservar `test:freight-intake` y `test:landing` si hay conflicto mecánico de scripts.

## Revisión y verificación

A: revisar aislamiento por organización, ausencia de fallback UUID, correlación,
sesión real, lectura de los timestamps/totales y compatibilidad con execution-intent.

C: `test:freight-intake`, `test:release`, `test:auth`, typecheck, build y diff check.
El test unitario usa un source inyectado; no sustituye una corrida pública.
La comprobación remota de lectura/RLS se documentará en el PR con sus límites.

Después de integrar B, ejecutar con sesión autorizada: intake HTTP 200, UUID
persistido, execution-intent HTTP 200, nueve tools, ofertas/ranking, replay y
cleanup. No cerrar REL-01/REL-02 antes de esa evidencia.
