# Alexa+, MCP y AWS en CargoMesh V2

## Rol de Alexa+

Alexa+ es un cliente conversacional de CargoMesh. No contiene una segunda implementación de las reglas comerciales: consume el mismo dominio y los mismos servicios de aplicación que la experiencia web.

La capa de voz adapta slots, confirmaciones, errores y respuestas SSML. Las operaciones comerciales o destructivas requieren confirmación explícita antes de ejecutarse.

El stepper web y Alexa+ consultan el mismo servicio de elegibilidad/ruteo. Durante el intake pueden explicar una sugerencia provisional y pedir la fecha o el dato faltante; solo una oferta emitida y vigente permite hablar de precio confirmado. Si la cobertura o capacidad es desconocida, ambos canales deben decirlo, no prometer servicio.

La recomendación se expresa como plan, no solo como nombre de carrier: tipo y cantidad de equipos portadores, tramos, ventana, costo/ETA y requisitos pendientes. Alexa puede precargar un envío anterior de la misma organización, pero debe volver a consultar disponibilidad y oferta. Resume pocas alternativas y solicita peso, dimensiones, temperatura o fecha faltantes; no afirma que un permiso especial, peaje, tarifa o cruce aduanero esté confirmado sin evidencia. Véase [planes de transporte y flota](./TRANSPORT_PLANS_AND_FLEET.md).

## Superficie MCP

La superficie se diseña por capacidades y se versiona. Las familias previstas son:

- intake y actualización de solicitudes;
- resolución de rutas y descubrimiento de carriers;
- consulta de ofertas y recomendaciones;
- reserva, seguimiento y consulta de estado.

El número exacto de tools no es un contrato fijo. Una tool solo puede declararse operativa cuando tiene autenticación, esquema estable, servicio de aplicación, pruebas y evidencia de extremo a extremo. WebMCP no forma parte del flujo principal V2; las integraciones de carriers se evalúan por separado.

## Integración AWS

Para AWS Builder, cada servicio utilizado debe resolver una necesidad concreta y quedar documentado con arquitectura, configuración reproducible, evidencia y costo operativo. Kiro Crew puede servir como evidencia de construcción; Bedrock, AgentCore, Strands SDK, SageMaker u otros servicios se incorporan solo cuando aporten valor verificable.

No se agregan servicios únicamente para multiplicar menciones de AWS.

## Benchmark de tokens y latencia

Las afirmaciones de reducción de tokens o mejora de latencia requieren un benchmark repetible con:

- mismos casos de uso y versión de esquemas;
- cantidad de turnos y tool calls;
- tokens de entrada y salida;
- latencia p50 y p95;
- tasa y clase de errores;
- calidad funcional equivalente.

El benchmark debe distinguir optimización del esquema, compresión de contexto, caché y cambios de modelo.

## Open Source

Si se postula al mini challenge Open Source, el artefacto debe ser adicional al producto principal, reutilizable fuera de la demo, incluir licencia y tener una URL pública con una explicación breve de cómo funciona y por qué importa.
