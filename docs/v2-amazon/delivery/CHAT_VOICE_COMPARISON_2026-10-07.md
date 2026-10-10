# Prueba de conversación y voz V2

## Estado verificable

La rama `codex/v2-chat-natural-voice-bedrock` incorpora `main`. El chat del shipper interpreta turnos con Bedrock Mantle cuando está habilitado y usa una respuesta local acotada si falla. La creación y lectura de borradores y la evaluación ROAD llaman al backend V2 autenticado; la vista `/hac37-preview` solo prueba conversación y no persiste datos. No hay prueba end-to-end contra Supabase V2 en este entorno.

La voz actual usa Web Speech del navegador. El usuario elige idioma ES/EN y la voz disponible en su dispositivo. Se añadieron ritmos pausado (0.88), natural (0.96) y ágil (1.06), además de «Probar voz». El dictado queda editable antes de enviar porque el reconocimiento del navegador puede transcribir mal nombres de lugares y carga.

Tras una transcripción incoherente como «Hello Hello Hello Hello ...», el chat no la registra como instalación de origen: pide aclaración y retoma la solicitud. La guía cambia con ES/EN. Para disponibilidad usa únicamente el estado devuelto por la evaluación ROAD: `eligible` es preliminar, `unknown` significa falta de datos, e `ineligible` invita a preparar otra solicitud con diferente fecha o sede guardada. Ninguno equivale a una oferta o reserva. La respuesta de servicios presenta ROAD como flujo actual de solicitud/evaluación, sin prometer cobertura de carrier, y SEA/RAIL/AIR como capacidades futuras no operativas.

## Alternativas investigadas

| Opción | Ventaja | Límite antes de adoptarla |
|---|---|---|
| Web Speech actual | Sin descarga de modelos ni coste adicional de síntesis; compara las voces instaladas | La calidad y la disponibilidad dependen del navegador y sistema operativo |
| [Piper TTS Web](https://github.com/Mintplex-Labs/piper-tts-web) | Síntesis neuronal local en navegador; expone voces y caché local | Descarga modelo y runtime; medir primera carga, memoria, español y licencia de cada voz |
| [Kokoro](https://github.com/hexgrad/kokoro) | Voces neuronales multilingües | Probar español en Windows antes de integrar; existe un [reporte de silencio con voz española](https://github.com/hexgrad/kokoro/issues/301) |

La implementación actual de Web Speech carga la lista de voces al inicio y escucha `voiceschanged`, porque puede llegar de forma asíncrona. Referencias: [MDN SpeechSynthesis](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis), [Stack Overflow](https://stackoverflow.com/questions/21513706/getting-the-list-of-voices-in-speechsynthesis-web-speech-api).

## Guion de comparación manual

1. Abrir `/hac37-preview`, elegir ES y probar dos voces del menú con los tres ritmos usando «Probar voz». Registrar voz, navegador, claridad, naturalidad y tiempo de inicio.
2. Preguntar «¿Para qué sirve CargoMesh?», «¿Y cómo me ayuda a escoger?» y «¿Y eso?». Comprobar respuesta específica, idioma correcto y ausencia de precio/capacidad/reserva inventados.
3. Dictar «Quiero enviar dos pallets de Lima a Piura» y corregir cualquier transcripción antes de pulsar Enviar. Repetir con nombres propios y una pausa intermedia.
4. En `/freight-request/new` con una sesión y base V2 operativas, crear un borrador autorizado y evaluar ROAD. Confirmar que los datos proceden de API y que la evaluación no se presenta como oferta.

Antes de incorporar Piper o Kokoro al producto, ejecutar una prueba aislada de carga, latencia y español en los equipos objetivo; no convertir una biblioteca descargada en una dependencia de producción sin esa evidencia.
