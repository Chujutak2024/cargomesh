# HAC-50 — activación y validación local real de Geocoding, 18-oct-2026

## Resultado

Acceso importado y flujo **dirección → cobertura → Google Routes → geometría** validado desde la red de Cristhian y en el navegador de la aplicación local. Sin push, despliegue, migración ni escrituras de negocio. No se incorporó el PR #128 durante esta tarea.

Checkout: `C:/Users/HP/.codex/worktrees/unified-workspaces/cargomesh`, rama `codex/unified-workspaces-demo-boundary`, HEAD observado `0e6986c057c9bcec75be792e9b56f193268e182b`, con los incrementos locales previos conservados. URL: `http://127.0.0.1:8080/carriers/control-tower`.

## Configuración privada

- ZIP recibido extraído en una carpeta privada fuera del repositorio, con ACL de usuario/SYSTEM. Se revisaron el importador y las instrucciones antes de ejecutarlo.
- Importado **únicamente** `GOOGLE_GEOCODING_API_KEY` en `cargomesh/.env.local` del checkout activo. Se comprobó que el resto del contenido siguiera intacto. `.env.local` está ignorado por Git.
- Respaldo previo conservado en la carpeta privada del importador. No se copió ningún env, credencial, URL autenticada ni respaldo al repositorio/evidencia pública.
- Reiniciado solo el proceso identificado del front unificado; mantiene 8080 y el redireccionamiento legacy 3090 existente. Nuevo proceso observado: 14560, Node con preferencia IPv4.
- Sin modificaciones de Google Cloud ni de las restricciones de Maps JS/Routes/Geocoding desde este chat.

## Acceso directo desde esta red

El validador del paquete respondió PASS: salida IPv4 `181.66.127.175`; geocodificación directa `HTTP 200 / OK`, un resultado ROOFTOP; inversa `HTTP 200 / OK`, 13 resultados de diferentes tipos. La evidencia completa del validador permanece en la carpeta privada del paquete; no se confunde con una prueba de cobertura del Carrier.

## Prueba integrada positiva

Cuenta de prueba Carrier existente, catálogo autorizado y lane publicada Lima → Arequipa, sin crear nuevos registros:

- Recojo público: **Jr. Lampa 474, Lima 15001, Peru**.
- Entrega pública: **Casa Goyeneche, C. la Merced 205, Arequipa 04001, Peru**.
- Ambos resultados: únicos, no parciales, precisión **ROOFTOP**, país/localidad del servidor; fuente `GOOGLE_GEOCODING`.
- Cobertura: `eligible`, recojo/entrega/lane dirigidos válidos, sin motivos negativos.
- Google Routes: `estimated`, **1 alternativa retornada**, **1 010 768 m**, **61 296 s** (~17,03 h de conducción), **27 153 puntos** en la prueba nativa. No se afirma óptimo global ni comparación entre varias alternativas reales para este par.
- SHA-256 de la geometría nativa: `33fcda7fddeeaa85bdabe3327a963463cd2f6c17f83c66e9e5005f3eb1e0effd`.
- Separación entre coordenada resuelta y extremo de la carretera: recojo **13,51 m**, entrega **7,47 m**, dentro de la política de 200 m. No se añadieron conectores rectos ni se reemplazó la polilínea.
- En la ejecución independiente del navegador, se mostraron **1 010,8 km / 16,84 h estimadas**, peajes y pines A/B con las mismas coordenadas resueltas. La duración del proveedor puede variar entre consultas; son ejecuciones independientes, no un tiempo contractual de entrega.
- La UI muestra que es planificación de Google **no guardada en una orden**, sin GPS ni capacidad reservada. Acceso de carga/camión y autorización de viaje continúan sin verificar.

Evidencia: `LIVE_RESULTS.json`, `ROUTE_METRICS.json`, `route-points-desktop.png`, `route-mobile.png`.

## Casos negativos y pendientes

1. **Sentido inverso Arequipa → Lima:** `ineligible`, `NO_PICKUP_COVERAGE`, `NO_DELIVERY_COVERAGE`, `LANE_NOT_EVALUABLE`; `routing=null`, `COVERAGE_NOT_ESTABLISHED`. El servicio no solicita Google Routes si la cobertura no se establece. Ver `NEGATIVE_RESULTS.json` y el contador sintético de las pruebas previas del contrato.
2. **Dirección precisa sin calidad ROOFTOP/interpolada:** La Merced 110 devolvió GEOMETRIC_CENTER; se rechazó con `LOCATION_PRECISION_REQUIRED`. Se conservó el resultado negativo en `LIVE_INITIAL_PRECISION_REJECTION.json` y `PUBLIC_ADDRESS_DIAGNOSTIC.json`. Para el positivo se utilizó otro domicilio público confirmado por su institución, no se flexibilizó el filtro para forzar aprobación.
3. **Coordenadas manuales:** Google devuelve varios candidatos precisos cercanos y el flujo responde `LOCATION_AMBIGUOUS`. La prueba no pasó hasta Routes para este modo. Sigue pendiente un flujo de selección explícita de candidato y validación de esa elección en el servidor, conservando las coordenadas originales. No se tomó el primer resultado ni se cambió el pin automáticamente.
4. Las sedes de prueba siguen sin coordenadas reales registradas; no se rellenaron ni simularon para esta validación.
5. Vincular el recorrido con un pedido Cliente versionado, comprobar recursos y autorización/ejecución siguen siendo incrementos independientes.

## Navegador y controles

- Sesión autorizada existente; no se relajó autenticación.
- Geocoding figura activo: desapareció el aviso de configuración faltante.
- Formulario por dirección, confirmación de extremos y ventanas con offset; cálculo desde el front hasta la geometría visible.
- Al seleccionar `Show this route`, permanecen ambos extremos y su evidencia; no se requiere otro cálculo.
- Google Maps muestra A/B y el trazado; la nota separa planificación de operación/GPS.
- Vista estrecha 370×668: `document.scrollWidth=370`, sin overflow horizontal. Vista escritorio 1366×768 comprobada; override temporal restablecido al terminar. Se dejó la ruta abierta en el navegador y se usó `Show planning route, recorded positions and sites` para ajustar el encuadre tras el cambio.
- Los scripts nativos revocaron únicamente sus sesiones temporales (`scope=local`); no cerraron la del usuario.

Esta tarea cambió configuración privada y documentación; no modificó código del producto ni repitió builds/suites ya aprobados del incremento anterior. La evidencia actual acredita llamadas reales al proveedor y el flujo local descrito, no un despliegue remoto ni la finalización del DoD integral.

## Referencias de los puntos públicos del ensayo

- MUCEN Lima, dirección Lampa 474 publicada por BCRP: https://www.bcrp.gob.pe/museocentral/agenda-cultural-noviembre-2022.html
- MUCEN Arequipa, dirección La Merced 205: https://mucen.bcrp.gob.pe/mucen/
- Dirección del primer caso rechazado, La Merced 110, UCSM: https://ucsm.edu.pe/una-ventana-al-pasado-museo-santuarios-andinos-ucsm/

Estos lugares son referencias públicas de planificación. No representan un pedido real ni una reserva o autorización logística de dichas instituciones.
