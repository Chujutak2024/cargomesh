# Chatbot — aclaración de medidas y cotizaciones confirmadas

Fecha: 21 octubre 2026. Incremento local sobre el trabajo de idioma/contexto en `codex/unified-workspaces-demo-boundary`, base `f2fa2b0`. Este documento registra implementación y pruebas locales; no declara despliegue, conversación real ni cierre de Plan2.

## Cambios

### Medidas y continuidad

- `measurement-clarification.ts` mantiene una propuesta de dimensiones separada del borrador hasta conocer unidad y alcance. Admite cm/metros y decimal con punto o coma.
- `5 × 1,5 × 2 m` produce una pregunta sobre alcance, no una asignación automática. Por unidad son 15 m³ y, para diez unidades, 150 m³ totales; como conjunto son 15 m³ informativos y se solicitan dimensiones por unidad. No se dividen volúmenes ni se inventa geometría.
- Una corrección explícita de altura con unidad recalcula volumen y conserva cantidad, peso y demás campos.
- Valores nulos/negativos o fuera de rango quedan pendientes. El usuario puede descartar expresamente la propuesta sin borrar los campos anteriores.
- Se invalidan las revisiones previas y se bloquean las confirmaciones del asistente por texto y voz mientras hay medidas pendientes. No se anuncia validación del formulario completo por resolver una sola medida.
- La renovación de voz recibe el marcador de ambigüedad y la propuesta acotada, con valores inválidos excluidos del contexto. Los datos siguen siendo provisionales, no consentimiento ni escritura acreditada.

### Búsqueda de cotizaciones real

- El chat abre el componente nativo `QuoteSearchPanel`, tanto por botón como por «busca cotizaciones» / «request quotes» por texto o voz.
- Abrir el panel no ejecuta mutaciones. El componente nativo exige plazo, casilla de consentimiento y botón de búsqueda.
- `chat-quote-action.ts` relee el pedido autenticado y comprueba ID, organización, versión, estado y ventana de recojo antes de llamar al cliente existente `findRequestQuotes`.
- Se reutiliza `POST /api/v2/freight/requests/:id/quotes` con `expectedDraftVersion`, `consent: REQUEST_QUOTES` e `Idempotency-Key`. El plazo debe ser futuro y no posterior al recojo.
- Solo se admite estado PENDING, igual que el servicio comercial. El chat no envía automáticamente un DRAFT para desbloquear cotizaciones: ese envío mantiene su confirmación nativa en Operaciones.
- Reintentos por red y confirmaciones repetidas conservan la misma clave por pedido/payload; el recibo debe corresponder al ID y versión revisados.
- El panel muestra outcomes reales y consulta el historial propio con el cliente existente. La selección y la autorización de booking siguen en el flujo comercial nativo, separadas de solicitar cotizaciones.

## Pruebas

`pnpm exec tsx --test src/features/v2-intake/measurement-clarification.test.ts src/features/v2-intake/chat-quote-action.test.ts src/features/v2-conversation-prep/voice-draft-context.test.ts src/features/v2-intake/draft-review.test.ts`: **19/19 PASS**.

Incluye medidas ambiguas, alcance conjunto/unidad, conversión y totales, corrección de altura, pendientes conservados, cero/negativos, descarte, contexto de renovación, revisión caducada/cambiada, consentimiento, plazo, tenant/versión distintos, recibo incorrecto y misma clave al reintentar.

`pnpm build`: **PASS**, con compilación, tipos y páginas completados. La última ampliación focal de negativos/descarte también pasó sus tests. No se ejecutó una solicitud real contra Supabase ni se llamó Bedrock para esta verificación.

## Prueba manual pendiente

1. Abrir Nueva solicitud y escribir «diez pallets de 100 kg cada uno»; revisar los campos capturados.
2. Añadir «5 × 1,5 × 2 m»: debe preguntar unidad/conjunto y bloquear confirmación del asistente.
3. Responder «por cada pallet»: comprobar 15 m³ por unidad, 150 m³ totales, cantidad 10 y peso total 1.000 kg.
4. Corregir «altura a 1,2 metros»: comprobar 90 m³ totales, sin perder peso/cantidad.
5. Probar «son del conjunto» en otra propuesta y verificar que no se rellenen dimensiones individuales; probar «descarta estas medidas».
6. Renovar voz y comprobar que conserva los pendientes, sin afirmar que el pedido fue guardado.
7. Con un pedido realmente enviado (PENDING), pedir cotizaciones, revisar plazo y consentimiento y ejecutar una búsqueda autorizada. Un DRAFT debe seguir bloqueado.
8. Repetir/reintentar y comprobar recibo/idempotencia; cambiar versión desde otra sesión y confirmar que se exige recargar.

Se debe realizar esta prueba con datos y accesos autorizados. La cobertura unitaria no sustituye el recorrido humano.

## Pendientes de Plan2

Fechas alternativas y zona horaria como estado estructurado, clasificación sensible con confirmación propia, mensajes largos, actualización de contexto durante voz activa y selección/autorización comercial preparadas dentro del chat. No están completados por este incremento. El código continúa local y sin push/merge/despliegue; se preserva el runbook previo modificado por el usuario.
