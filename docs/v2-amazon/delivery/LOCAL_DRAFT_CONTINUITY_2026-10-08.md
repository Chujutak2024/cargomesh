# Continuidad del borrador en la pantalla actual

## Alcance autorizado

El usuario pidió trasladar sus datos y funcionalidades a la pantalla «Tu siguiente acción», con el camión 3D, y usarla como versión de trabajo. Implementación exclusivamente local, sin publicación, merge, deploy, cambios de Google Cloud ni Supabase remoto.

## Datos y fuente

El borrador real del navegador Opera contenía Callao → Piura, «Maquinaria industrial», 10 unidades de 800 kg, recogida 2026-07-12, entrega 2026-09-12, progreso local 1/5, savedForReview:false y truckPreference:{type:custom,model:"",photoDataUrl:null}. Se leyó mediante una página local que accede exclusivamente a la clave conocida del workspace. No se reconstruyó el payload desde una captura ni se usó initialDraft como sustituto.

El modelo valida y conserva todos esos campos, incluyendo fotos raster acotadas cuando existen. Un dato inválido no genera ejemplos. La copia original permanece disponible; las ediciones actualizan una clave distinta. Los cambios de origen, carga, fechas y camión invalidan solo los pasos locales afectados.

## Integración y límites

- `ConnectedCoordinator` es la pantalla actual. Un único `useLocalDraft` comparte el borrador entre Panel, Solicitudes, Solicitud local, Revisión y Ruta.
- Panel muestra carga, fechas, próximos pasos y gráficos calculados exclusivamente desde el borrador guardado. El camión 3D es ilustrativo, sin asignación.
- Solicitud local/Revisión permiten editar los campos, elegir el tipo de camión, introducir modelo y foto local y comprobar pasos. Un camión personalizado sin modelo bloquea la comprobación del paso correspondiente.
- Los datos locales no se añaden a la lista API ni se presentan como registros autenticados. La creación nativa mantiene HAC-14, sus sedes, mapper, contratos, permisos, idempotencia y ventanas horarias.
- La vista vial usa Google Maps y la geometría de Google Routes solo si el adaptador devuelve datos estimados utilizables. No crea carriers/candidatos ni interpola una línea cuando falta geometría. No confirma restricciones de camión, capacidad, cobertura ni despacho.
- La recuperación está habilitada exclusivamente en localhost. El puente de transferencia comprueba origen, ventana emisora, nonce, canal y tamaño; lee solo las claves de borrador. No envía credenciales ni datos a un servicio externo.
- El borrador ya guardado en la pantalla actual gana sobre una nueva importación automática. La importación manual es una acción explícita de actualización y conserva el original.

## Accesos y Google Maps

El mapa devolvió `RefererNotAllowedMapError` para 8083. Se mantuvieron las restricciones de Google Cloud y la clave existente: la **aplicación nueva** sirve en 8080, el origen ya autorizado. La UI anterior permanece en disco y no escucha en ese puerto. El alias 8083 sirve el mismo build y redirige `/v2-workspace` a 8080. El lanzador raíz inicia ambos accesos con procesos ocultos y abre el Panel nuevo.

La recuperación comprueba el borrador editado en 8083 antes de recurrir al borrador anterior de 8080, para evitar perder cambios durante el traslado del puerto. No hay publicación ni asignación de datos locales a una organización/tenant sin validación.

## Evidencia

Carpeta externa: `D:/Documents/hackaton 2/cargomesh-v2-local-data-migration-20261008/`. Los logs, capturas y resultados se registran allí. Las pruebas cubren round trip, fotos, errores, preservación del original, invalidación de progreso, controles de transferencia, rutas sin geometría y restricciones del origen local. La evidencia positiva de persistencia empresarial permanece pendiente de sesión/Supabase local.

## Validación final

| Comprobación | Resultado | Evidencia / límite |
| --- | --- | --- |
| Datos del usuario en Opera, aplicación nueva en 8080 | PASS | Callao → Piura, 10 × 800 kg, fechas originales, progreso 1/5 y camión personalizado sin modelo ni foto. `dashboard-final-opera.png`, `revision-recuperada-opera.png`. |
| Edición y recarga | PASS | En el navegador de Codex se importó la copia real, se cambió cantidad a 11 y se recargó: cantidad y fechas persistieron. Se restauró cantidad 10. No se editaron los datos de Opera para esta prueba. |
| Estado compartido | PASS | Panel, editor, revisión y ruta usan el mismo borrador. La fuente de servicio sigue informando que requiere sesión; regresar a la fuente local conserva los datos. |
| Google Maps / Google Routes | PASS con límite | Vista real en Opera con ruta vial Callao → Piura, 985,9 km / 15,53 h estimadas. `ruta-google-opera.png`. Es una estimación vial, no una validación de restricciones de camión. |
| Teclado | PASS, comprobación acotada | Enter en «Volver al panel» navega y enfoca H1. La comprobación de «Ruta y camión» informa datos incompletos y no avanza por el modelo ausente. No equivale a una certificación WCAG completa. |
| Español / inglés | PASS | «Tu siguiente acción» / «Your next action»; datos y fechas conservados. `dashboard-en.png`. La descripción escrita por el usuario se conserva sin traducción automática. |
| Móvil | PASS, comprobación acotada | Panel y formulario a 390 × 844; sin desbordamiento horizontal. Fechas y campos visibles, selector de camiones disponible. `dashboard-mobile.png`, `request-mobile.png`. Se retiró el ajuste temporal de viewport. |
| Consola en navegador de Codex | PASS | Consulta final sin entradas de nivel error. No se afirma ausencia de avisos de las bibliotecas o de errores históricos de otras pestañas. |
| Tests de continuidad / ruta local / mapa | PASS 33/33 | `tests.log`: 9 pruebas del modelo local, 14 del adaptador vial local y 10 del modelo del mapa. |
| Typecheck | PASS | `typecheck.log`, salida 0. |
| Arquitectura | PASS | `architecture.log`: 325 módulos, 46 puntos de entrada cliente. |
| Build Next | PASS | `build.log`, aplicación nueva utilizada por los dos accesos locales. |
| Diff check | PASS | Sin errores de whitespace; avisos normales de normalización LF/CRLF. |
| Persistencia del servicio / autorización por tenant | BLOCKED para evidencia positiva | Sin sesión autenticada local. Se mantiene el error real; el borrador local no se convierte en solicitud empresarial para rellenar esa lista. |

No se reejecutó toda la suite release para esta entrega de continuidad: los 648 tests del pase visual anterior son evidencia histórica, no una nueva ejecución de esta fase.

## Versión de trabajo y entregables

URL principal: `http://127.0.0.1:8080/v2-workspace#/dashboard`.

El nuevo componente de coordinación con el camión 3D es la base de trabajo para los próximos cambios. La carpeta actual es `D:/Documents/hackaton 2/cargomesh-v2-current-local/`. El acceso «Abrir CargoMesh V2 local» inicia esta versión después de reiniciar Windows; abrir una URL por sí sola no inicia el servidor.

Funciones locales recuperadas: edición de origen/destino del catálogo vial, carga, cantidades, pesos, fechas, preferencia de camión, modelo/foto local, comprobaciones locales, gráficos derivados, navegación y mapa con procedencia real. Los ejemplos de otras solicitudes no se importan como registros propios. Las operaciones autenticadas continúan usando los contratos existentes y necesitan su sesión.

Skills aplicadas en esta fase: `professional-project-orchestrator` (alcance y preservación), `react-best-practices` (estado compartido y actualizaciones), `a11y-audit` (comprobaciones de teclado y móvil).

Publicación: ningún commit, push, PR, merge o despliegue en esta fase. Linear, Vercel, Supabase remoto y Google Drive no se modificaron.
