> Actualización posterior del 21 octubre: las medidas ambiguas y la búsqueda confirmada de cotizaciones ya tienen un segundo incremento local. Consulta [medidas y cotizaciones](./CHATBOT_MEASUREMENTS_QUOTES_INCREMENT_2026-10-21.md). Los pendientes de este corte anterior se conservan como historia.

# Chatbot: idioma, contexto de voz y conexión de completitud

Fecha: 21 octubre 2026. Implementación local en `codex/unified-workspaces-demo-boundary`, base `f2fa2b0`. Corresponde al primer incremento de Plan2; no declara terminado el plan completo ni desplegado el cambio.

## Implementado

- Preferencia de idioma es/en conservada en turnos numéricos y renovación de voz. Prompts de texto y voz sin inglés obligatorio; se eliminó el filtro que descartaba respuestas españolas.
- Contexto de voz tipado con los últimos campos no sensibles del formulario, campos pendientes y referencia de versión guardada. Es provisional: no acredita persistencia, consentimiento o autorización.
- La sesión obtiene categorías/equipos y sedes desde el servicio autorizado `getIntakeOptions`. El preview conserva su catálogo sintético identificado. Un fallo de catálogo no inventa opciones.
- Orientación española sobre contenido de pallets, categorías y equipos; totales se calculan desde cantidad/peso del borrador.
- `GET /api/v2/freight/requests/:id/cargo-readiness` conectado al chat, con versión esperada y comprobación de ID/versión de respuesta. Cambios locales sin guardar bloquean presentar esa consulta como validación de sus cambios.
- Consultas comerciales con datos explícitos de carga pasan por captura, sin descartarlos por una palabra como “prices”.
- Resúmenes comerciales en español y enlace a la solicitud persistida en Operaciones. Cotizaciones, selección y autorización conservan las confirmaciones nativas; el chat no contrata por texto libre.

## Verificación

- TypeScript: `pnpm typecheck`, PASS.
- Build: `pnpm build`, PASS, páginas y trazas completadas.
- Regresiones focales de contexto, captura, resumen, privacidad y readiness: 37/37 PASS antes del caso adicional de comparación.
- Adaptador Bedrock/intérprete y regresiones relacionadas: 33/33 PASS; algunos casos se solapan con el comando anterior, no sumar como tests únicos.
- Gateway con entorno virtual existente: 11/11 PASS (`test_voice_guidance` y `VoiceGrantTests`). No se llamó AWS.
- Caso adicional de consulta de comparación con carga: ver resultado de la ejecución final de `interpretation.test.ts`.

## Validación y trabajo posterior

No se probó una conversación real en navegador ni en el gateway desplegado. La continuidad aquí comprobada es estructural y con pruebas, no una certificación de audio E2E. Vercel y la imagen del gateway requieren sus actualizaciones autorizadas para reflejar el cambio.

Siguen pendientes en Plan2: estado explícito de ambigüedades y resolución de medidas por unidad/conjunto y fechas alternativas; actualización del contexto durante una sesión activa; acciones preparadas y recibos comerciales dentro del chat; mensajes largos y localización completa de textos heredados. El enlace a Operaciones reutiliza el flujo confirmado existente, no implementa autorización conversacional de booking.

Se preservaron las modificaciones locales previas en `next-env.d.ts` y el runbook Nova. No se cambiaron producción, datos alojados, Linear ni Drive; no hubo push, merge ni creación de rama auxiliar.
