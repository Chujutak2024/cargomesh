# Propuesta para aprobación · chat Web/voz y adaptador MCP V2

> Historical approval proposal. Axel communicated team approval on 2026-10-03 and that communication was recorded in HAC-31 without inventing a direct Cristhian quote. The pending-approval status below describes the earlier snapshot, not the current implementation.

Base auditada: `origin/codex/v2-amazon-contracts` en `30bcd5fa8e9b44dd53e6c338189eefad07839c7a` (2026-10-03). Estado: [HAC-37](https://linear.app/hackatonteamcargomesh/issue/HAC-37/fe-1-implementar-chat-web-y-voz-para-borrador-y-elegibilidad-road-v2) y [HAC-38](https://linear.app/hackatonteamcargomesh/issue/HAC-38/be-1-adaptar-conversacion-de-borrador-y-elegibilidad-al-mcp-v2-para) registradas como `Pendiente`; ramas/manifiesto **aún sin aprobación atribuible a Cristhian**. La propuesta se anotó en un comentario de HAC-31, no en su manifiesto aprobado. No se crearon ramas ni cambiaron estados. El corte funcional termina en borrador propio y elegibilidad ROAD; precio, oferta y reserva permanecen deshabilitados.

## Issue nueva A · dueño propuesto Luis

**Título:** `[FE-1] Implementar chat Web y voz para borrador y elegibilidad ROAD V2`

**Bloque A — Metadatos.** V2 · CargoMesh V2 — Alexa Hackathon · Sprint 3/HITO 3 · core frontend · responsable único propuesto: Luis · aprobador: Cristhian · consulta: Axel, Juan y Jean Paul. Prioridad propuesta: High; labels existentes a confirmar en Linear: `frontend`, `Feature`, `must-have`. Fecha y estimación: por acordar con Luis y Cristhian; no inferir capacidad de la fecha del gate. Rama exacta propuesta `feat/fe1-v2-conversational-chat-voice`, creada **después** de aprobación del manifiesto HAC-31 desde `codex/v2-amazon-contracts`. Target PR propuesto: `feat/cycle-3-integration` (si el gate confirma esa rama). Nunca `main` ni producción.

**Objetivo.** Un shipper autenticado puede expresar en texto una necesidad ROAD, completar y corregir datos, ver cada dato provisional, crear o recuperar su borrador V2 propio y consultar la evaluación `eligible | ineligible | unknown` con motivos y procedencia del servicio compartido. La voz del navegador es una forma opcional de entrada/salida con consentimiento explícito y transcripción editable. **Inglés es el idioma principal** de producto, demo y evidencia para jueces; español es secundario opcional.

**Incluye.** Chat flotante Next.js adaptable, historial y sugerencias; foco/teclado, carga/error, ES/EN; estado conversacional por usuario/solicitud sin exponer otro tenant; interpretación determinística y aclaraciones; schemas Zod versionados; adaptador Web que use las rutas V2 de HAC-12; transcripción editable antes de enviar; reproducción de texto solo tras gesto del usuario; alternativa íntegra por texto. Si HAC-33 está integrado, consumir su contrato de resolución/confirmación de lugares; antes de ello pedir datos estructurados y no inventar una sede. La evaluación ROAD conserva respuesta y fuente de HAC-12 sin reinterpretar elegibilidad.

**Fuera.** Oferta, precio y reserva V2; WebMCP V1; geocodificador propio, consulta a carrier o cotización simulada; acceso automático al micrófono; persistencia de audio; cambios de producción. El prototipo visual anterior solo orienta diseño y no constituye evidencia funcional.

**Dependencias.** HAC-12 (borrador/lectura/elegibilidad), HAC-33 (lugares y mutación versionada), HAC-27 (DTO), HAC-31 (manifiesto/gate), HAC-35 (intake y mapa). El contrato de HAC-12 actualmente crea el borrador con campos completos; para conversación parcial se requiere que su dueño confirme una operación de actualización de borrador con `draftVersion`, o que FE mantenga slots provisionales locales y cree el borrador solo al tener el payload V2 completo. No introducir una escritura parcial improvisada. Solapamiento FE: `v2-intake`, `v2-workspace` y navegación de HAC-35; Luis debe decidir montaje y reutilización en su propio PR. Solapamiento ubicación: HAC-33 sigue siendo dueño de resolver/confirmar lugares; chat consume su puerto, no implementa geocodificación.

**DoD.**

- [ ] El chat llama a rutas V2 auténticas para crear/leer borrador y consultar elegibilidad; muestra `unknown` y `0` candidatos sin prometer cobertura, precio ni capacidad.
- [ ] Los slots incompletos son provisionales y no se describen como datos persistidos; corrección y recuperación no cruzan organización. Idempotency-Key en creación; versión esperada en cada mutación disponible.
- [ ] Micrófono solo tras gesto y permiso; transcripción visible y editable; no se envía audio; texto siempre disponible. Lectura en voz alta activada por gesto, cancelable.
- [ ] Precio y reserva aparecen deshabilitados con motivo real. Ningún “sí” ambiguo autoriza booking.
- [ ] Pruebas unitarias y de contrato: varios turnos, corrección, datos insuficientes, `unknown/ineligible/eligible`, error de API, tenant ajeno, stale draft e idempotencia; pruebas de navegador escritorio/móvil, foco, teclado y permiso denegado.
- [ ] Recorrido íntegro en inglés: origen, destino, carga, fecha, corrección, borrador y ROAD; copy, errores, sugerencias, transcripción y respuesta hablada revisados en inglés. `pnpm typecheck`, build y suites pertinentes ejecutadas; PR y evidencia de una caminata no guiada con cuenta de prueba. No etiquetar Alexa+ como probado desde navegador o cliente MCP.

## Issue nueva B · dueño propuesto Axel, secuenciada con HAC-33

**Título:** `[BE-1] Adaptar conversación de borrador y elegibilidad al MCP V2 para Alexa+`

**Bloque A — Metadatos.** V2 · Sprint 3/HITO 3 · core backend/MCP o emergente **solo si el equipo confirma capacidad** · responsable único propuesto: Axel · aprobador Cristhian · consulta Luis y Jean Paul. Rama exacta propuesta `feat/be1-v2-conversation-mcp-adapter`, desde la base V2 después de aprobación HAC-31; target PR `feat/cycle-3-integration` si el manifiesto la incluye. Fecha/estimación: por acordar. HAC-33 ya ocupa la core de Axel en este sprint: Cristhian debe secuenciar esta issue después de HAC-33, moverla a otro ciclo o redistribuir formalmente capacidad; no arrancar dos cores por inferencia.

**Objetivo/alcance.** Exponer solo tools V2 efectivamente respaldadas por servicios de aplicación para borrador/lectura/elegibilidad, con schemas compartidos, identidad MCP autorizada, scopes, tenant y errores estables. Respuestas cortas **en inglés por defecto** y aclaraciones de datos faltantes en un adaptador de canal; la lógica ROAD continúa en HAC-12. Usar el mismo servicio de aplicación que Web, sin MCP→REST. Cliente MCP controlado con token autorizado/no autorizado/revocado y paridad contra Web.

**Fuera.** Alexa+ live sin invocación observada, tool de oferta o booking, código de autorización OAuth nuevo, runner WebMCP V1, Bedrock como motor de decisión. HAC-33 conserva tools de ubicaciones y su contrato.

**DoD.** Tool list solo anuncia capacidades ejecutables; creación/lectura/elegibilidad usan el servicio HAC-12; auth/link/scopes/tenant probados; idempotencia y `draftVersion` donde apliquen; paridad Web/MCP de estado, motivos, fuente y fecha; cliente MCP real/controlado; test MCP, typecheck y build. La invocación Alexa+ real se marca `pendiente` hasta tener cuenta autorizada y evidencia redactada.

## Cambio propuesto al manifiesto HAC-31

Añadir, **tras aprobación de Cristhian**, dos filas al manifiesto Sprint 3:

| Issue registrada | Dueño único | Rama exacta | Target PR | Condición |
|---|---|---|---|---|
| HAC-37 · Chat Web/voz | Luis | `feat/fe1-v2-conversational-chat-voice` | `feat/cycle-3-integration` | Coordinar montaje con HAC-35; no abrir antes de aprobar manifiesto. |
| HAC-38 · Adaptador MCP conversacional | Axel | `feat/be1-v2-conversation-mcp-adapter` | `feat/cycle-3-integration` | Secuenciar con HAC-33 y confirmar capacidad; no abrir antes de aprobar manifiesto. |

HAC-31 sigue siendo el gate y su rama de integración solo la crea el integrador autorizado. Esta propuesta no modifica las asignaciones existentes de HAC-33/HAC-35 ni transforma booking u ofertas documentadas en capacidades live. Cristhian debe registrar cada issue con dueño, estimación, fechas y relaciones, aprobar el manifiesto y resolver el solapamiento antes de que los dueños abran sus ramas.

## Puertos y archivos en conflicto potencial

| Superficie | Dueño actual | Uso propuesto |
|---|---|---|
| `cargomesh/src/features/v2-intake/`, `v2-workspace/`, shell Next.js | Luis/HAC-35 e integración FE | Montaje chat y reutilización visual por Luis. |
| `cargomesh/src/server/modules/freight-requests/`, `road-serviceability/`, `src/shared/schemas/v2/` | Cristhian/HAC-12 | Consumir contratos; cualquier nueva operación de draft vuelve a Cristhian o recibe issue aprobada. |
| Resolver y tools de ubicación | Axel/HAC-33 | Consumir puerto tipado; no duplicar geocoder en chat. |
| `cargomesh/src/server/mcp/` y auth | Axel/HAC-11, nueva B si se aprueba | Tool V2 y adaptación de canal, no reglas ROAD. |

El paquete preparatorio `cargomesh/src/features/v2-conversation-prep/` es **aislado y sin importación por runtime**. Sirve para revisión de DTO y matriz de casos; no acredita implementación de chat, MCP ni Alexa+.
