# Chat V2: voz del navegador y prueba de modelo (7 oct 2026)

> **Actualización:** la arquitectura conversacional y el resultado de las pruebas live están en [CHAT_V2_CONVERSATION_RESET_2026-10-07.md](./CHAT_V2_CONVERSATION_RESET_2026-10-07.md). Esta guía conserva la investigación de voz; su comparación propuesta con Claude y su nota sobre sesión expirada ya no describen el estado actual.

`main` conserva V1; el chat autenticado V2 parte de `codex/v2-amazon-contracts`. El usuario descartó servicios Amazon para modular la voz. El chat ahora utiliza `SpeechSynthesis` del navegador y muestra las voces españolas o inglesas disponibles. Elige primero una voz local, si existe, y permite escoger otra manualmente. No se envía texto a un endpoint CargoMesh de síntesis ni se requiere Polly. La calidad depende del navegador y del sistema operativo; `(device)` indica `localService` reportado por el navegador. El reconocimiento del micrófono sigue separado, con selección ES/EN.

## Bibliotecas investigadas

| Alternativa | Hallazgo | Decisión |
| --- | --- | --- |
| Web Speech nativo | Enumera voces con `getVoices()` y avisa cambios con `voiceschanged`; permite voz, ritmo y parada. | Implementado ahora, sin dependencia. |
| `react-speech-kit` | Envuelve `SpeechSynthesis`; no agrega voces. | No incorporarlo. |
| Kokoro vía Transformers.js | Síntesis neuronal en navegador; requiere descargar pesos y medir memoria, arranque, calidad española y compatibilidad WebGPU/WASM. | Candidato para otro experimento. |
| Piper Web | Motor local WebAssembly con modelos descargables y voces españolas; requiere empaquetar/runtime adicional. | Candidato si Kokoro no cumple. |

Prueba manual: abrir el chat con altavoces, seleccionar ES, pulsar Replay y escuchar una respuesta sobre «dos pallets de Lima a Piura». Cambiar de voz y repetir. Probar EN con «I need to ship two pallets from Lima to Piura». Confirmar Stop audio, respuestas automáticas y nuevo turno después del audio. La prueba automatizada comprueba filtrado/selección; no puede calificar naturalidad acústica sin audición humana.

## Bedrock

El intérprete actual usa Converse para proponer intent y campos estructurados; la respuesta visible la construye el flujo de aplicación. Un modelo más grande puede mejorar extracción y referencias, pero no vuelve libre el texto de la respuesta. Comparar Nova 2 Lite y Claude Sonnet 4.5 en `us-east-1` con los mismos 10 casos sintéticos y 3 paráfrasis. Medir precisión de campos, correcciones, idioma, abstención, fallback, tokens, latencia p50/p95 y costo. Limitar la primera corrida a 60 llamadas y un presupuesto estimado inferior a US$5. La prueba live está pendiente: el perfil `cargomesh-bedrock` indica que expiró la sesión; se debe renovar con `aws login` antes de habilitar otro modelo. No se afirma aún que Sonnet mejore el resultado.

Fuentes: [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis), [evento voiceschanged](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/voiceschanged_event), [react-speech-kit](https://github.com/MikeyParton/react-speech-kit), [Kokoro Web](https://github.com/xenova/kokoro-web), [Piper Web](https://github.com/Poket-Jony/piper-tts-web), [Bedrock Converse](https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference.html).
