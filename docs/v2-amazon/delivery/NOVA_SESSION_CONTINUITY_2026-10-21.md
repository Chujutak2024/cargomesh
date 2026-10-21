# Nova: continuidad de sesión y catálogo — 21 octubre 2026

## Síntoma y causas comprobadas

El usuario informa que Nova se silencia al hablar y aparecen paneles/formulario. La voz debe acompañar el llenado en vivo como ensayo del canal conversacional para Alexa+.

1. `NovaVoicePreview` comparaba todo el borrador/idioma con el contexto del permiso. Cada campo reconocido actualizaba ese borrador y ejecutaba `stop()`: cerraba WebSocket, micrófono y audio. Las pruebas del componente anterior reproducen el defecto; el componente corregido mantiene la conexión ante campos, idioma y aclaraciones. Un cambio de solicitud/carrier autorizado sí cierra el transporte.
2. El prompt del gateway decía que al terminar de hablar se indicara abrir el resumen. Se cambia por continuar con una pregunta útil y ofrecer resumen solo cuando el usuario pida revisar/finalizar. Los paneles de aclaración siguen siendo alternativas visuales; no crean una solicitud ni autorizan una transacción.
3. Vercel emite grants que incorporan catálogo/historial. Prueba real, sin audio ni comandos comerciales: sesión inicial autenticada 200, sobre2057bytes, gateway `ready`, cierre voluntario1000. La misma identidad con12turnos diagnósticos acotados recibe grant200/sobre5007bytes, pero el gateway rechaza con1008. Su límite de auth era4096caracteres. El nuevo gateway acepta hasta65536bytes UTF-8; cada frame binario de audio conserva límite8192bytes. No se amplían permisos comerciales.

## Catálogo real frente a vocabulario

El permiso de producción inspeccionado tenía `preview=false`, tres sedes, ocho categorías y cinco tipos de equipo. Las sedes se consultan en facilities filtradas por organización; categorías activas provienen de cargo_categories. EquipmentOptions proviene del catálogo canónico ROAD del backend: no es flota disponible ni evidencia por fecha. La voz desplegada no recibía serviceTypes.

La proyección ampliada incorpora recomendaciones de equipo por categoría, embalaje/requisitos del catálogo y FTL/LTL del contrato nativo. Declara `availabilityConfirmed=false`; FTL automático está implementado, LTL es vocabulario de captura y no se ofrece como cotización automática disponible. No incorpora placas, capacidad libre, cobertura o tarifas inventadas. La disponibilidad real exige evaluación nativa de una solicitud y el flujo de ofertas.

La interpretación de voz sigue aplicando datos validados al borrador compartido local. Los cambios no significan que un pedido fue guardado. El consentimiento y los servicios de backend existentes siguen siendo la frontera de persistencia. Esto no certifica Alexa+ live ni una conversación humana completa.

## Despliegue ordenado

1. Publicar la corrección web de continuidad. `CARGOMESH_VOICE_EXTENDED_CATALOG` queda false/ausente, conservando el sobre de catálogo anterior.
2. Axel construye una nueva imagen desde `cargomesh/voice-pilot/Dockerfile.gateway` con SHA explícito del corte. El Dockerfile incluye voice_transport_limits.py. Actualiza el servicio ECS existente con esa imagen manteniendo roles, origen y secreto actuales; no crea infraestructura nueva.
3. Verificar health y WebSocket con Origin `https://cargomesh.vercel.app`: sesión inicial y sesión con contexto mayor a4KB deben alcanzar ready. No usar grant/token en logs ni en chat.
4. Después del gateway, activar en Vercel la variable privada no secreta `CARGOMESH_VOICE_EXTENDED_CATALOG=true` y redeploy. Verificar que el permiso incluya serviceTypes/recommendedEquipment y que una sesión extendida funcione.
5. Prueba humana: dictar origen, destino, cantidad/peso, corregir un dato, aclarar dimensiones y continuar sin pulsar «Continuar» ni abandonar voz para rellenar un formulario. Pedir orientación sobre refrigerado/plataforma y FTL/LTL. Nova distingue vocabulario de disponibilidad; al finalizar recapitula y solicita confirmación explícita antes de persistir.

AWS lo despliega Axel, confirmado por Cristhian. En esta entrega no se despliega AWS ni se habilita el catálogo extendido. Los avisos/paneles no sustituyen una conversación; las fechas y clasificaciones ambiguas conservan validación y consentimiento.

## Evidencia

Pruebas focales:9 Node(componente/catálogo/contexto/renovación),5 unittest stdlib(prompt/límites),TypeScript PASS. El baseline del componente falla y la corrección pasa. Conexiones controladas reales solo verifican grant/transporte; sin audio/texto de usuario ni pedidos/reservas. Archivos locales `salida/nova-session-diagnosis-20261021/session-handshake*.json` y `salida/nova-session-fix-20261021/baseline-lifecycle.log`. La inspección no accede a la conversación privada del usuario y no atribuye su caso individual a un log AWS observado.
