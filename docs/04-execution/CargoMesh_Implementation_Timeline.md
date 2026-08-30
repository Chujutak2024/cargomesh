# CargoMesh — Línea de tiempo de implementación

> Guía rápida para saber qué se construyó, dónde estamos y qué sigue. El documento autoritativo para aceptar tareas, commits y gates continúa siendo el [Team Execution Checklist](CargoMesh_Team_Execution_Checklist.md).

## 1. Línea sucesiva

```text
Contrato B2B
  → Supabase + RLS
  → contratos compartidos
  → provider dinámico
  → login y dashboard
  → discovery seguro
  → quote_freight WebMCP
  → INT-01: primer corte vertical
  → Result Bridge + BALANCED
  → coverage + capacity
  → INT-02A: orquestación headless      ← ESTAMOS AQUÍ
  → INT-02B: presentación visual
  → booking + recovery
  → Golden Flow E2E + release
```

La cadena causal que debe ver el jurado es:

```text
Solicitud B2B
  → discovery encuentra 0..N providers
  → WebMCP consulta al provider exacto
  → Supabase persiste ofertas y eventos
  → BALANCED explica la recomendación
  → la UI presenta y permite seleccionar
  → WebMCP realiza el booking
```

## 2. Historia real del proyecto

Estado actualizado al **30 de agosto de 2026**.

| Orden | Tarea | Qué se construyó | Owner | Estado / evidencia |
|---:|---|---|---|---|
| 0 | Idea y contrato | Marketplace B2B de carga con organizaciones, miembros y `0..N` carriers; los carriers demo son datos, no reglas | Equipo / C | ✅ Definido en ADR y documentación maestra |
| 1 | `SH-00 / SH-01` | Ownership, contratos v1 y workspace Next.js | A + B + C | ✅ Integrado, PR #1 |
| 2 | Base Supabase | Organizaciones, miembros, cargas, carriers, servicios, ofertas, decisiones, bookings y Golden Flow | C | ✅ Migraciones y esquema base |
| 3 | Seguridad | RLS por organización y secretos solo en módulos server-only | C | ✅ Base verificada; aplicada por C-01/C-02 |
| 4 | `A-01` | Una página dinámica `/providers/[carrierSlug]` para cualquier provider registrado | A | ✅ Integrado, PR #2 |
| 5 | `B-01` | Shell B2B, login demo, dashboard y tabla variable de solicitudes | B | ✅ Integrado, PR #4 |
| 6 | `C-01` | Discovery seguro y matching completo de servicios | C | ✅ Integrado, PR #6 |
| 7 | `A-02` | Registro y ejecución de `quote_freight` mediante WebMCP | A | ✅ Integrado, PR #5 |
| 8 | `INT-01 / G1` | `matchingServiceId` conecta discovery con el servicio provider exacto | A + C; valida B | ✅ Integrado, PR #8 |
| 9 | `C-02` | Result Bridge idempotente, `CarrierOffer`, eventos y ranking BALANCED `0..N` | C; revisa A | ✅ Integrado, PR #10; Golden Flow `89/84/72` |
| 10 | `A-03` | `check_service_coverage` y `check_capacity` genéricas | A; revisa C | ✅ Integrado, PR #9 |
| 11 | Diseño `INT-02A` | Flujo headless, ViewModel, estados, seguridad, pruebas y handoff para B | C + A | 🟡 Diseño local en `dbd87c6`; implementación pendiente |

## 3. Punto actual: INT-02A

Las piezas principales ya existen individualmente. Ahora debemos conectarlas como un único flujo reproducible, todavía sin tocar la UI de B.

```text
FreightRequest
  → CandidateProvider[0..N]
  → matchingServiceId
  → provider exacto
  → coverage → capacity → quote
  → ProviderToolEnvelope
  → record_provider_result
  → CarrierOffer[0..N]
  → BALANCED
  → OrchestrationViewModel
```

El diseño técnico completo está en [CargoMesh_INT02A_Headless_Design.md](CargoMesh_INT02A_Headless_Design.md).

### Decisiones que A y C deben congelar

| Decisión | Propuesta |
|---|---|
| Correlación del servicio | Añadir `matchingServiceId` al Result Bridge sin romper los contratos existentes |
| Persistencia | Guardar `carrier_service_id` en eventos y ofertas mediante migración aditiva |
| Coverage y capacity | Persistirlos como eventos; nunca convertirlos en ofertas |
| Runner | Ejecutar `document.modelContext` en navegador compatible, no llamar handlers directamente |
| Idempotencia | `toolCallId` determinista; replay exacto deduplica y payload distinto genera conflicto |

## 4. Ruta restante

| Siguiente orden | Tarea | Depende de | Termina cuando | Verificación principal |
|---:|---|---|---|---|
| 1 | Implementar `INT-02A / G2A` | A-03 + C-02 | El flujo headless entrega ViewModel estable para 0/1/N | WebMCP real, `89/84/72`, replay, RLS, pgTAP, build |
| 2 | `B-02` | B-01 + ViewModel de INT-02A | Intake y dispatch muestran estados y colecciones variables | 0/1/3/4 ofertas, desktop y móvil |
| 3 | `INT-02B` | B-02 + INT-02A | La UI consume el ViewModel sin duplicar lógica server-side | `loading`, `error`, `NO_MATCH`, `success` |
| 4 | `INT-02 / G2` | INT-02A + INT-02B | El ranking real queda presentado y validado visualmente | Golden Flow completo + cuarto provider |
| 5 | `A-04` | A-03 | WebMCP permite booking idempotente y consulta de estado | ACCEPT, REJECT y NO_RESPONSE |
| 6 | `B-03` | B-02 + INT-02B | Selección humana, resultado de booking y Judge Drawer | recorrido visual y eventos JSON |
| 7 | `C-03` | C-02 + contrato A-04 | Booking, reset y recuperación quedan persistidos | replay, recovery y RLS |
| 8 | `INT-03 / G3` | A-04 + B-03 + C-03 | Happy path y contingencias funcionan de punta a punta | E2E repetible |
| 9 | `G4 / release` | Todos los gates anteriores | URL pública, seguridad y evidencia listas | build, DB tests, navegador y video |

## 5. Trabajo en paralelo

| Integrante | Puede avanzar ahora | Límite |
|---|---|---|
| A | Runner WebMCP y frontera compartida de INT-02A | No modificar UI de B ni persistencia de C sin coordinación |
| C | Run, Result Bridge, trazabilidad de servicio, ViewModel, RLS y pruebas | No sustituir WebMCP por llamadas directas ni tocar UI de B |
| B | Retomar B-02 cuando esté disponible y consumir el ViewModel | No duplicar discovery, scoring ni consultas privilegiadas en componentes |

B puede incorporarse después: su ausencia no bloquea `INT-02A / G2A`, pero sí mantiene abiertos `INT-02B`, `INT-02` y el gate visual `G2`.

## 6. Regla rápida para cada tipo de cambio

| Si se cambia… | Se debe hacer… |
|---|---|
| Esquema, constraint, función SQL o RLS | Migración Supabase → db lint/reset/pgTAP → regenerar tipos → documentar |
| Módulo TypeScript | Definir input/output → implementar en el owner correcto → pruebas → typecheck/build |
| Pantalla | Soportar loading/vacío/error/colección variable → accesibilidad → desktop/móvil |
| Contrato compartido | Avisar a consumidores → cambio aditivo si es posible → revisión cruzada |
| Tarea terminada | Rama → PR → revisión → merge → verificar `main` → checklist `[x]` → handoff |

## 7. Próxima acción concreta

```text
A + C aprueban las cinco decisiones de INT-02A
  → C implementa run y trazabilidad de matchingServiceId
  → A + C conectan el runner WebMCP
  → C publica el ViewModel y evidencia G2A
  → B conecta la presentación cuando regrese
```

No corresponde comenzar booking ni cerrar `G2` antes de verificar `INT-02A`.
