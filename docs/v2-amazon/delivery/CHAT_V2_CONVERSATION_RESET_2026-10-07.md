# Reinicio del diseño conversacional V2 — 7 oct 2026

## Decisión y evidencia

El problema principal no es la potencia del modelo. El intérprete actual solo devuelve `intent`, `fields` y un `acknowledgment` limitado a seis frases. La interfaz construye casi todas las respuestas con texto fijo y, cuando no extrae campos, repite una pregunta. Por ello cambiar únicamente el ID del modelo no produce una conversación natural.

La cuenta 962635287657 respondió correctamente a una llamada mínima de Converse con `us.amazon.nova-2-lite-v1:0` (51 tokens de entrada, 3 de salida, 509 ms informados por Bedrock). La misma cuenta devolvió `AccessDeniedException: openai.gpt-6-luna is not available for this account` tras corregir el permiso IAM. No se solicitará acceso adicional a Luna. La prueba mínima de Nova no demuestra aún calidad conversacional.

Tras retirar la política de Nova durante esta revisión, una segunda llamada devolvió `AccessDeniedException` por falta de `bedrock:InvokeModel` sobre `us.amazon.nova-2-lite-v1:0`. Se detuvieron las pruebas live y la configuración local dejó deshabilitada la conversación Bedrock hasta definir una política mínima para el modelo elegido.

Como primera corrección de UX, la interfaz distingue una interpretación determinística sin campos de una respuesta del modelo y avisa que la conversación automática no está disponible. El cambio no constituye todavía el rediseño conversacional descrito abajo.

## Objetivo V1 del chat

Permitir a shipper y carrier explicar su necesidad en español o inglés, corregir datos, recibir preguntas concretas, revisar un borrador de solicitud u oferta y confirmar acciones explícitamente. El asistente debe reconocer incertidumbre y distinguir datos provisionales, validados, guardados, evaluados y ofertados. Una oferta final proviene del carrier; CargoMesh no inventa precio, capacidad, cobertura ni reserva.

## Arquitectura propuesta

### Adaptador Bedrock Mantle preparado

El quick start de AWS usa `openai.gpt-oss-120b` con Responses API en `https://bedrock-mantle.us-east-1.api.aws/v1`. El servidor tiene un adaptador para este endpoint mediante el SDK `openai`, con `store: false`, límite de tokens, timeout y validación del JSON de interpretación existente. La URL está fijada al dominio AWS y la clave se lee solo de `OPENAI_API_KEY` en el servidor. La clave publicada en el chat no se incorporó al proyecto. AWS indica que una clave temporal no se puede revocar individualmente; debe invalidarse la sesión que la generó o esperar su vencimiento (máximo 12 horas) antes de generar otra. El adaptador se habilitó localmente con una clave nueva; la calidad conversacional completa sigue sin verificarse.

El esquema ya acepta una frase breve de orientación en el idioma del usuario en vez de una lista cerrada de seis reconocimientos; si no se extrae ningún campo, el chat puede mostrar esa orientación. Esto es una mejora acotada: no sustituye la futura respuesta basada en hechos verificados ni autoriza al modelo a afirmar cobertura, oferta o reserva.

### Prueba local y costo observados el 7 oct 2026

Con una clave nueva guardada únicamente en `.env.local`, `openai.gpt-oss-120b` respondió por Bedrock Mantle. El endpoint de interpretación necesita instrucciones como mensaje `system`, `reasoning.effort=low` y formato JSON; enviar las instrucciones mediante el campo `instructions` produjo texto libre que no pasó el parser. Una prueba HTTP de la ruta local devolvió `mode=BEDROCK`, 434 tokens de entrada, 105 de salida y 1322 ms. La respuesta orientó en español, aunque clasificó la consulta como `HELP` sin extraer campos; la calidad de extracción y la conversación de varios turnos siguen pendientes de evaluación.

Para reproducir la UI sin una sesión Supabase V2: desde `cargomesh/`, ejecutar `pnpm dev --hostname 127.0.0.1 --port 3217` y abrir `http://127.0.0.1:3217/hac37-preview`. La página usa datos sintéticos y una ruta de interpretación disponible solo en desarrollo sobre loopback. Permite probar texto y voz del navegador, pero no guarda solicitudes, consulta datos de una organización ni evalúa ROAD. Para probar acciones reales se requiere `/freight-request/new` con Supabase V2 y sesión autenticada.

Como estimación de referencia, a US$0.15/1M tokens de entrada y US$0.60/1M de salida, el turno medido costaría US$0.000128. Estos precios deben verificarse para la región y modalidad de facturación vigentes. El crédito de US$150 se comparte con otros consumos AWS y solo cubre productos elegibles según el detalle del crédito en Billing. La UI local no muestra aún un acumulado de gasto.

Fuentes: [Responses API en Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-responses-api.html), [GPT OSS 120B en Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-openai-gpt-oss-120b.html), [manejo de claves comprometidas](https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys-revoke.html).

1. Entrada por texto o transcripción editable. El reconocimiento de voz y la síntesis permanecen separados del modelo de texto; no dependen de Alexa+ ni de un servicio Amazon de modulación de voz.
2. Un adaptador de modelo propone intención, hechos nuevos, correcciones y la pregunta que entiende que hizo el usuario. El esquema valida el resultado. El modelo no ejecuta herramientas de negocio.
3. Servicios de aplicación validan sedes, carga, fechas, permisos y versiones. Solo ellos crean o modifican borradores, evalúan elegibilidad y consultan ofertas persistidas.
4. El generador de respuesta recibe únicamente hechos y resultados verificados, más el último turno. Puede variar el lenguaje y guiar hacia el siguiente dato útil. No puede afirmar una operación no realizada ni convertir una estimación en oferta.
5. Para crear, aceptar o reservar, la interfaz presenta un resumen verificable y requiere confirmación explícita; las mutaciones usan idempotencia y versión esperada.

## Comportamiento esperado

- Si el mensaje no contiene un campo nuevo, responder a la pregunta si es posible, o explicar qué dato falta con un ejemplo pertinente. No repetir una frase genérica.
- Si el usuario da varios datos, reconocer los válidos, señalar los ambiguos y pedir solo lo necesario para seguir.
- Si el usuario cambia de idioma, responder en ese idioma sin cambiar identificadores ni hechos de dominio.
- Si falla Bedrock, conservar el borrador local y comunicar que la interpretación automática no está disponible; permitir continuar con el formulario. No presentar el fallback como si hubiera comprendido.
- Para un carrier, recoger una propuesta de oferta como borrador atribuible y pedir confirmación antes de publicarla. No presentar el flujo shipper actual como soporte de ofertas ya implementado.

## Secuencia de entrega

1. Conservar una política mínima para el modelo realmente utilizado. Si se eliminan ambas políticas actuales, la conversación con Bedrock quedará temporalmente deshabilitada.
2. Sustituir respuestas fijas por una capa de respuesta basada en estado verificado y eliminar el `acknowledgment` de seis opciones. Mantener límites de costo, latencia y longitud.
3. Probar en Nova 2 Lite diálogos de varios turnos: extracción, pregunta abierta, corrección, referencia a un dato anterior, cambio ES/EN, ambigüedad, indisponibilidad, creación y rechazo de oferta/booking sin evidencia.
4. Comparar con otro modelo solo si falla un criterio medido y si la cuenta tiene acceso real. Registrar precisión, tasa de fallback, p50/p95, tokens y costo por conversación.
5. Probar voz de extremo a extremo con personas: calidad de transcripción, silencio como fin de turno, lectura, interrupción y corrección manual.

## Criterio de terminado

El chat sostiene una conversación de al menos cinco turnos sin repetir un mensaje vacío, recuerda solo hechos provisionales autorizados, guía hacia el siguiente paso, respeta el idioma, distingue errores de comprensión de errores de servicio y no efectúa ninguna mutación sin validación y confirmación. Las capacidades shipper y carrier se verifican por separado; lo no implementado se etiqueta como pendiente.
