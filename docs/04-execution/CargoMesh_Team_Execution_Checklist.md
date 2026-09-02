# CargoMesh — Team Execution Checklist

> **Versión:** 1.4.0 — estado operativo y release
> **Última conciliación:** 2026-09-02 sobre `main@ea3e37b`
> **Equipo:** A (WebMCP), B (producto/UI), C (datos, seguridad e integración)
> **Historial completo:** [checklist v1.2](CargoMesh_Team_Execution_Checklist_v1.2_History.md)

## 1. Propósito y jerarquía de fuentes

Este documento responde únicamente cuatro preguntas: qué está integrado, qué falta,
quién es responsable y qué evidencia cierra cada gate. No redefine contratos ni
sustituye el historial de Git.

Orden de autoridad:

1. código, migraciones y pruebas integrados en `main`;
2. [ADR-001 — Provider Registry](../00-master/ADR-001_Dynamic_Provider_Registry.md)
   y [ADR-002 — recomendaciones D1](../00-master/ADR-002_D1_Intake_Recommendations.md);
3. contratos TypeScript/SQL ejecutables enlazados en la sección 4;
4. este checklist para ownership, estado y gates;
5. Pull Requests para evidencia y revisión;
6. documentos históricos para contexto, nunca para decidir el estado actual.

Reglas de estado:

- `[x]` significa integrado y verificado en `main`.
- `[ ]` significa pendiente, aunque exista una rama o PR aprobado.
- Un PR abierto no modifica el contrato ni completa una tarea.
- Solo C, como Integration Owner, cierra gates y actualiza el registro integrado.
- A y B reportan resultados mediante PR y AI/Developer Handoff.

## 2. Resultado demostrable

Una organización autenticada crea o edita una `FreightRequest`, puede consultar una
recomendación histórica read-only mediante WebMCP y decide explícitamente qué campos
aplicar. CargoMesh descubre `0..N` servicios registrados, navega al
`matchingServiceId` exacto, ejecuta las cinco tools provider, persiste resultados,
calcula BALANCED, permite selección y booking, y conserva replay/recovery sin
duplicados.

```text
FreightRequest persistida
→ recomendación opcional WebMCP + consentimiento
→ discovery 0..N
→ providerUrl + matchingServiceId
→ coverage → capacity → quote
→ Result Bridge → CarrierOffer[]
→ BALANCED → selección
→ book_freight → status
→ replay / rechazo / recovery
```

Los carriers, organizaciones y antecedentes sintéticos son datos de demostración.
No se presentan como integraciones comerciales reales. Las ofertas, decisiones,
bookings y eventos del recorrido evaluado nacen durante la ejecución.

## 3. Ownership vigente

| Integrante | Ownership | Límites |
|---|---|---|
| **A** | páginas provider, registro/runtime WebMCP, navegación externa, fixtures provider y evidencia de tools | no modifica scoring, persistencia privilegiada ni pantallas de B sin coordinación |
| **B** | landing, autenticación visual, dashboard, intake, dispatch, selección, booking UI, i18n y mapa | no duplica discovery/scoring ni usa estado cliente como autorización |
| **C** | Supabase server-side, RLS, discovery, bridges, BALANCED, reset, deploy e integración | no absorbe UI o handlers provider; cambios críticos requieren revisión cruzada |

Archivos compartidos —`package.json`, layout raíz, contratos compartidos y variables
de entorno— requieren aviso previo. No existe ninguna reasignación temporal activa.

## 4. Contratos canónicos: enlazar, no copiar

Las definiciones siguientes son las fuentes ejecutables. No se vuelven a copiar en
este checklist porque una copia pierde sincronización con el runtime.

| Frontera | Fuente canónica |
|---|---|
| `CandidateProvider`, `ProviderPageConfig`, `ProviderToolEnvelope` | [`frontend/src/features/providers/contracts.ts`](../../frontend/src/features/providers/contracts.ts) |
| booking y status provider | [`frontend/src/features/providers/provider-booking-contracts.ts`](../../frontend/src/features/providers/provider-booking-contracts.ts) |
| Booking Bridge | [`frontend/src/features/booking/contracts.ts`](../../frontend/src/features/booking/contracts.ts) |
| orquestación y ViewModel | [`frontend/src/features/orchestration/contracts.ts`](../../frontend/src/features/orchestration/contracts.ts) |
| BALANCED | [`frontend/src/features/decision-engine/contracts.ts`](../../frontend/src/features/decision-engine/contracts.ts) |
| recommendation draft | [`frontend/src/features/recommendations/recommendation-draft-contracts.ts`](../../frontend/src/features/recommendations/recommendation-draft-contracts.ts) |
| intake manual | [`frontend/src/features/freight-requests/manual-intake-contracts.ts`](../../frontend/src/features/freight-requests/manual-intake-contracts.ts) |
| esquema/RLS | [`supabase/migrations`](../../supabase/migrations) y contratos de `docs/02-database` |

Invariantes que no se negocian durante el release:

- providers y discovery son genéricos `0..N`; nombres de carriers solo son fixtures;
- `matchingServiceId` se conserva de discovery a provider y Result Bridge;
- las cinco tools provider usan WebMCP real, `AbortSignal`, `exposedTo` explícito y cleanup;
- `get_freight_request_recommendations` es una tool CargoMesh read-only, no una
  sexta tool obligatoria de cada carrier;
- recomendación ≠ aplicación ≠ confirmación ≠ selección ≠ booking ≠ aceptación;
- Result Bridge y Booking Bridge continúan separados e idempotentes;
- BALANCED usa 25% costo, 25% confiabilidad, 20% ETA, 10% disponibilidad,
  10% experiencia de ruta y 10% historial de la organización;
- FR-1042 conserva la regresión `89/84/72` y confianza `88`.

## 5. Estado consolidado en `main`

### 5.1 Base técnica histórica

| Gate | Estado | Evidencia resumida |
|---|---|---|
| Contratos + vertical WebMCP (`G0/G1`) | ✅ | PR #1, #2, #5, #6 y #8 |
| Headless + decisión visual (`G2A/G2`) | ✅ | PR #9, #10, #12, #14, #16, #17 y #21; BALANCED `89/84/72` |
| Booking + recovery (`G3`) | ✅ | PR #20, #23, #24 y #26; replay, rechazo y recovery sin duplicados |
| Auth/RLS de demo | ✅ | PR #30, #31, #32 y #33; sesión y membresía server-side |

El detalle cronológico permanece en el
[historial v1.2](CargoMesh_Team_Execution_Checklist_v1.2_History.md). Los prompts y
bloqueos de aquellos días no vuelven a ser tareas activas.

### 5.2 Corte D1 integrado

- [x] **D1-01 — Intake autenticado, editable y persistido**
  - PR #35 y #43: resolución por organización y `requestCode` real.
  - PR #50 y #51: writer autenticado, `draftVersion`, totales server-side y UI.
  - PR #52: payload según `entryMethod`, runner montado y documentos canónicos.
  - PR #53: directorio LATAM, ruta estructurada y sidebar reactivo.

- [x] **D1-02 — Recomendaciones read-only por WebMCP con aplicación explícita**
  - PR #39, #40 y #42: ADR, runtime WebMCP, modal, PATCH autenticado,
    `STALE_DRAFT`, recálculo canónico y cleanup.

- [x] **D1-03 — Escenarios coherentes y dashboard real**
  - PR #37 y #38: casos local-only 1/1/0, antecedentes sintéticos y cobertura
    doméstica/transfronteriza sin runtime precargado.
  - PR #44: solicitudes y métricas derivadas por organización, con estado vacío.

- [ ] **D1-04 — Revalidar el recorrido integrado sobre el SHA de release**
  - El código necesario está integrado; falta ejecutar desde navegador limpio el
    recorrido posterior a #52/#53 con una solicitud distinta de FR-1042.
  - Debe demostrar persistencia/recarga, recomendación o ausencia, tools provider,
    ranking, booking/replay/recovery y cleanup sin preparar resultados manualmente.
  - Esta evidencia puede formar parte de REL-01; no exige otro feature PR.

## 6. Trabajo activo y orden de cierre

| Orden | Tarea | Owner | Estado | Cierre |
|---:|---|---|---|---|
| 1 | `DOC-01` — checklist v1.4, BALANCED y REL-01 | A; revisa C | PR #45 | documentos conciliados con el SHA real |
| 2 | `B-I18N-01` — selector EN/ES, inglés predeterminado | B; revisan A/C | pendiente | landing/login consistentes, locale persistido, auth intacto |
| 3 | `B-MAP-01` — mapa de corredores | B; revisan A/C | pendiente | ruta/estado basados en solicitud/eventos; simulación declarada |
| 4 | `SCN-EXP-01` — escenarios/flota ampliada | A/C | PR #47/#49 Draft | integrar solo si seed, provider fixtures y verificación son coherentes |
| 5 | `D1-04 / REL-01 / G4` — freeze y UAT pública | C coordina; A WebMCP; B UX | pendiente | matriz de sección 7 completa sobre un único SHA desplegado |
| 6 | `REL-02` — material Devpost | B; A/C aportan evidencia | PR #29 Draft | texto, capturas y video corresponden al SHA validado |

PR #18 es una propuesta A-04 histórica ya materializada por PR #20. No debe
integrarse automáticamente; corresponde cerrarlo o marcarlo superseded.

i18n y mapa pueden avanzar en paralelo, pero no deben cambiar Auth, RLS, contratos
WebMCP, matching, scoring ni estados persistidos. El mapa no bloquea G4 si el equipo
lo declara mejora visual y no requisito del Golden Flow.

## 7. Criterios de D1-04 y REL-01/G4

La corrida final debe registrar:

1. URL HTTPS y SHA exacto desplegado;
2. navegador limpio compatible con `document.modelContext`;
3. login real y membresía `ACTIVE`;
4. creación/edición de una solicitud y conservación después de recargar;
5. recomendación WebMCP con consentimiento o ausencia legítima;
6. discovery `0..N`, `providerUrl` y `matchingServiceId` exactos;
7. `getTools()` y ejecución de coverage, capacity, quote, booking y status;
8. Result Bridge, tres ofertas del Golden Flow y BALANCED `89/84/72`, confianza 88;
9. replay idempotente, conflicto controlado, rechazo y recovery;
10. cleanup sin tools provider al abandonar cada página;
11. estados vacío/error/NO_MATCH sin ofertas fabricadas;
12. `test:release`, typecheck, build, pgTAP, db lint y escaneo de secretos sobre
    el mismo SHA o una justificación explícita de cualquier diferencia.

Los IDs, tokens, cookies, correos y claves no se publican. Capturas y JSON deben estar
sanitizados. El reset remoto solo lo ejecuta el operador autorizado por C.

## 8. Protocolo breve para múltiples IAs

Antes de modificar:

```text
1. Leer AGENTS.md, README, ADR aplicable y este checklist.
2. Revisar git status, rama, origin/main y PRs dependientes.
3. Identificar ownership y fuentes ejecutables.
4. Confirmar alcance y criterios de aceptación.
```

Handoff obligatorio:

```text
- Task ID / objetivo
- rama, base, SHA y PR
- archivos y contratos afectados
- pruebas y evidencia
- riesgos o limitaciones
- bloqueos y siguiente responsable
```

Una IA no debe obedecer estados copiados desde chats o documentos históricos sin
contrastarlos con `origin/main`, PRs y fuentes ejecutables.

## 9. Gobierno documental

| Tipo | Función | Regla |
|---|---|---|
| `AGENTS.md` | invariantes para agentes | corto, ejecutable y sin cronograma |
| Maestro/ADR | visión y decisiones duraderas | no contienen estado diario de PRs |
| Contratos de código/SQL | verdad ejecutable | prevalecen sobre ejemplos copiados |
| Checklist | estado, ownership y gates | se actualiza después de verificar `main` |
| Evidencia/handoff | prueba de un corte | indica fecha, SHA y alcance |
| Historia | contexto | se marca explícitamente como no vigente |

No se agregan nuevos planes paralelos para el mismo trabajo. Si este checklist vuelve
a crecer con contratos, prompts diarios o informes, ese contenido debe enlazarse o
archivarse en lugar de duplicarse.
