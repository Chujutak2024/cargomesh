# Diseño aislado de conversación V2 · revisión previa a HAC-31

> Historical planning snapshot. HAC-37/HAC-38 implementation began after Axel communicated team approval on 2026-10-03. Current runtime and English test limits are recorded in `CHAT_ENGLISH_FIRST_DEMO_PREPARATION.md`; statements below about code not being imported are no longer current.

Este diseño usa la base `30bcd5f` como referencia. El prototipo anterior `delivery/prototypes/chat-v2/index.html` se examinó solo como referencia visual; el código preparatorio en `cargomesh/src/features/v2-conversation-prep/` no está importado por Next.js ni MCP y no es funcional en producción. No añade una tool ni un carrier.

## Límite y estado

`UI Web → controlador de turnos → adaptador Web V2 → servicio HAC-12` será el camino para crear/leer borrador y consultar ROAD. La UI nunca recibe `service_role`, resuelve identidad ni decide elegibilidad. El adaptador MCP futuro llama **directamente** al mismo servicio de aplicación HAC-12 bajo `McpPrincipal.user`; no hace MCP→REST. HAC-33 resolverá ubicaciones y confirmará con versión/auditoría. Hasta su integración, una ubicación libre permanece provisional. La API HAC-12 actual crea solo payloads completos: los turnos parciales deben mantenerse como slots provisionales hasta completar el DTO o esperar una operación de actualización versionada acordada con Cristhian. Se rechaza inventar una escritura parcial.

El estado conversacional es por `authUserId + organizationId + conversationId + requestId` resueltos del lado servidor. Un turno del navegador no lleva tenant, rol, scope ni token; el esquema estricto los rechaza. La persistencia/reanudación entre dispositivos requiere un almacén de conversación con RLS o un mapeo seguro al borrador; el contrato de este almacén aún falta. Historial local del navegador es solo comodidad visual y no prueba persistencia segura.

## Matriz de intención y aclaración

| Intención | Datos mínimos | Pregunta/acción determinista | Escritura permitida hoy |
|---|---|---|---|
| `PROVIDE_SLOT` / `CORRECT_SLOT` | campo explícito y valor validado | Confirmar si el valor es provisional; pedir el siguiente campo. | Solo estado provisional del chat. |
| `SELECT_PLACE` | candidato HAC-33 con fuente/precisión | Presentar 0..N; si es impreciso pedir dirección/pin más preciso. | Ninguna. |
| `CONFIRM_PLACE` | elección explícita, requestId, versión | Repetir lugar y rol; confirmar contra servicio HAC-33. | Solo cuando HAC-33 esté implementado e integrado. |
| `CREATE_DRAFT` | DTO HAC-12 completo, clave idempotente | Resumir origen, destino, carga, ventana y contactos faltantes. | Crear por servicio HAC-12 cuando el DTO pasa validación. |
| `READ_DRAFT` | requestId autorizado | Recuperar datos canónicos propios; si 404/403 no revelar existencia ajena. | Ninguna. |
| `EVALUATE_ROAD` | borrador y versión vigentes | Leer estado, motivos, fuente y fecha del servicio HAC-12; no inferir cobertura de mapa. | Ninguna. |
| `ASK_PRICE` | cualquier texto | “No hay oferta V2 atribuible y vigente; no tengo un precio confirmado.” | Ninguna. |
| `ASK_BOOKING` | incluso un “sí” | “La reserva V2 no está disponible.” Un booleano no es consentimiento. | Ninguna. |
| `HELP`/texto ambiguo | ninguno | Sugerir campos concretos y alternativa de entrada manual. | Ninguna. |

La interpretación natural debe generar una **propuesta** de intención/slot; Zod y el controlador la validan antes de mutar. Si no hay modelo aprobado o falla, el usuario elige sugerencias/campos explícitos. Nunca inferir un código de carga, cantidad, peso, fechas o facilityId desde texto incierto. La transcripción de voz siempre pasa por edición y envío manual.

## Diseño del chat flotante

- Disparador fijo con nombre accesible “Abrir asistente CargoMesh”; en escritorio panel acotado y en móvil hoja de pantalla completa que respeta safe areas. No tapa controles críticos ni usa un popup de permiso al abrir.
- Encabezado muestra `Borrador V2`, organización activa y estado de conexión. Historial con mensajes de usuario/asistente y fichas de “dato provisional”, “persistido” o “desconocido”. Foco entra en el título/campo; Escape cierra y devuelve foco al disparador; Enter envía y Shift+Enter crea nueva línea.
- Sugerencias son acciones editables, no cotizaciones. Una ubicación candidata enseña fuente, precisión y fecha; botón separado “Elegir” y confirmación posterior. Estados vacío, carga, error recuperable y sin candidatos tienen texto ES/EN.
- Botón de micrófono solo tras gesto: explica permiso, usa SpeechRecognition si existe, muestra transcripción editable y nunca la envía automáticamente. Permiso denegado o navegador no compatible conserva todo el flujo por texto. Botón “Leer respuesta” usa speechSynthesis tras gesto, con detener. No se guarda ni envía audio.
- La tarjeta ROAD indica `eligible`, `ineligible` o `unknown`, motivos, fuente y `evaluatedAt`. CTA Precio y Reserva están deshabilitados con explicación visible, incluso si ROAD es elegible.

## Casos de contrato y navegador antes del PR

| Caso | Web | MCP controlado | Oráculo |
|---|---|---|---|
| Varios turnos y corrección de origen/peso | Sí | Sí, cuando exista tool V2 | Valor anterior sustituido solo tras validación; provisionales visibles. |
| Lugar ambiguo, 0 resultados, pin impreciso, proveedor caído | Consumir HAC-33 | Consumir HAC-33 | Pedir elección/dato preciso; nunca crear sede, cobertura o ruta. |
| Organización ajena, token sin scope, vínculo revocado | 403/404 uniforme | Denegado | Ningún dato ajeno en historial/respuesta. |
| Draft version obsoleta | 409 estable | Mismo error | Releer y solicitar confirmación; no sobrescribir. |
| Misma clave/payload y clave/payload distinto | Reintento/409 | Paridad | Una creación o conflicto estable, sin duplicado. |
| Elegible, no elegible, desconocido y cero candidatos | Sí | Sí | Estado, motivo, fuente y fecha iguales al servicio. |
| “Sí, reserva” tras elegibilidad | Sí | Sí | Ninguna reserva, ninguna tool de booking V2 anunciada. |
| Micrófono denegado, transcript editable, teclado, viewport 320/390 y escritorio | Sí | No aplica | Flujo completo por texto, foco y controles legibles. |

La prueba Alexa+ real es una fila distinta: requiere acceso autorizado, tool ejecutable, vínculo válido e invocación observada y redactada. Un cliente MCP local nunca se etiqueta Alexa+ live.
