# Chat V2: voz y prueba de modelo (7 oct 2026)

Base revisada: `main` contiene V1; el chat autenticado V2 está en `codex/v2-amazon-contracts`. Esta rama agrega Polly Generative como salida de voz opcional del Web chat. El navegador conserva el reconocimiento de entrada y queda como respaldo de lectura. No hay acceso Alexa+.

## Voz

- Ruta `POST /api/v2/conversation/speech`: sesión y membresía obligatorias, mismo origen, JSON estricto, máximo 1000 caracteres, audio MP3 sin caché. Usa rol/credenciales temporales del servidor, nunca claves en el cliente.
- `CARGOMESH_POLLY_VOICE_ENABLED=false` por defecto. Para probar, conceder `polly:SynthesizeSpeech` al rol temporal, configurar `CARGOMESH_POLLY_REGION=us-east-1` y activar el flag solo en el entorno de prueba. La cuenta requiere una sesión AWS vigente.
- Español de Perú se lee con `Mia` (`es-MX`) porque Polly no ofrece voz `es-PE`; inglés usa `Joanna` (`en-US`). Escuchar ambas con frases logísticas reales y ajustar solo tras evaluación humana.
- Precio publicado: US$30 por millón de caracteres generativos fuera del nivel gratuito. 100 respuestas × 200 caracteres ≈ US$0,60; 1000 respuestas ≈ US$6. El presupuesto AWS de US$150 y el deadline del concurso del 23 oct permiten una prueba pequeña, pero se debe comprobar si los créditos promocionales cubren Polly. El presupuesto AWS existente es una alerta, no un tope.

## Bedrock

El intérprete actual llama a Converse para proponer intent y campos estructurados; el servicio de dominio valida los datos y genera la respuesta. Por ello un modelo más grande puede mejorar extracción y referencias entre turnos, pero no vuelve libre el texto de la respuesta. El cliente ya conserva contexto acotado y admite correcciones en varios turnos.

Comparar `us.amazon.nova-2-lite-v1:0` y `us.anthropic.claude-sonnet-4-5-20250929-v1:0` en `us-east-1` con los mismos 10 casos sintéticos, 3 paráfrasis cada uno. Medir precisión de campos, correcciones, idioma, abstención ante datos faltantes, fallback, tokens, latencia p50/p95 y costo. Límite de la primera corrida: 60 invocaciones, máximo 500 tokens de salida por llamada y presupuesto estimado menor de US$5; detener si se supera. Registrar SHA, modelo, región y precios vigentes. Una mejora de comprensión debe superar la latencia/costo añadidos; no cambiar el modelo por su nombre.

La prueba live está pendiente: el perfil `cargomesh-bedrock` responde `Your session has expired. Please reauthenticate using 'aws login'`. Tras renovar la sesión, verificar `sts get-caller-identity` y permiso `bedrock:InvokeModel` para el perfil Sonnet; hacer una llamada pequeña antes de habilitar `CARGOMESH_BEDROCK_CONVERSATION_ENABLED=true` en el servidor. No hay datos de latencia/calidad Sonnet de esta cuenta todavía, por lo que no se activa por defecto.

Referencias: [Polly generative voices](https://docs.aws.amazon.com/polly/latest/dg/generative-voices.html), [Polly pricing](https://aws.amazon.com/polly/pricing/), [Bedrock Converse](https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference.html), [Nova 2 Lite](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-amazon-nova-2-lite.html), [Claude Sonnet 4.5 cross-region](https://docs.aws.amazon.com/bedrock/latest/userguide/global-cross-region-inference.html).
