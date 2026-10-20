# CargoMesh — cierre paralelo del 19 al 22 de octubre de 2026

## Dirección vigente

Instrucción de Cristhian: avanzar todo el equipo en paralelo, compartir cada incremento terminado e integrarlo sin esperar a que concluyan todas las verticales. Agrupar las pruebas y validación conjunta el **21 de octubre**. Esta dirección sustituye los checkpoints de capturas/PASS obligatorios entre hitos antes de esa fecha.

Calendario interno de trabajo, no verificación del plazo oficial del concurso. No fija horas ni afirma compromisos individuales de capacidad que los responsables aún no hayan registrado.

## Resultado prioritario del producto

Un Cliente con acceso autorizado puede seleccionar sus sedes, describir una carga soportada por formulario o Nova, confirmar un pedido persistido, recibir una oferta atribuible al Carrier, seleccionar/autorizar y consultar su booking y avance. El Carrier correcto ve la oportunidad, responde/emite oferta y gestiona recursos/estado de la operación que Cliente consulta.

Un mismo requestId/version enlaza plan/asignaciones, oportunidad, oferta/version, decisión, booking, compromisos y ejecución. No duplicar las funciones comerciales existentes. Cualquier parte todavía simulada, local o sin activar en el alojado se identifica.

Primer caso: ROAD, moneda soportada por el corte, origen/destino comunes, ventanas fijas y carga compatible con el modelo actual. Oferta emitida por Carrier autorizado; automatizar precio final solo si existen tarifas/reglas autorizadas. No hacer de un motor predictivo nuevo condición del primer recorrido.

## Reparto paralelo y primeras entregas

| Dueño | Superficie principal | Primer corte para compartir | Continuación |
|---|---|---|---|
| Jean · HAC-52 y dependencias puntuales HAC-51 | Identidad Cliente, organización, Facilities/perfiles, contrato y seed base | Actor Cliente conectado + organización + dos Facilities + IDs/DTO consumibles | Gestión de sedes/perfiles y contratos temporales imprescindibles; resolver proyecto Supabase correcto y aplicación autorizada de esquema/cuentas |
| Juan · HAC-53 | Nueva solicitud, contexto de Nova y componentes compartidos Cliente | Formulario conectado que devuelve requestId/version/status + shell/filtros consumibles | Nova usa los mismos datos/comandos; revisión/confirmación y navegación sin perder borrador |
| Luis · HAC-54 | Operaciones Cliente, ofertas, selección/booking, historial y seguimiento | Leer el pedido de Juan y la oferta/version del Carrier correcto | Confirmación, booking y lectura compartida de recursos/estado; historial/Dashboard derivados |
| Axel · HAC-30 y soporte de su gateway existente | Kiro auténtico, runbook/dossier y soporte de conexión Nova ya existente | Configuración documentada por nombres y sesión/evidencia Kiro real | Ayudar a Juan a conectar el gateway existente sin duplicar la UI; evidencia de conversación/resultado se agrupa el 21 |
| Cristhian · HAC-50 e integración | Superficies/adaptadores Carrier y ensamblaje de entregas | Proyección Requests local ya implementada; preparar su integración sin atribuirle activación alojada | Requests/Offers/Orders/recursos conectados al flujo de Luis y consolidación de PRs; cada dueño corrige su vertical |

### Propiedad de archivos compartidos

- Jean: identidad, Facilities, contrato de tiempo/proyección que realmente desbloquee el caso y manifiesto base del escenario.
- Juan: shell/sidebar, filtros, controles compartidos y contexto visual del asistente/intake.
- Luis: lectura comercial Cliente y funciones de selección/booking/orquestación comercial que le correspondan.
- Cristhian: wrappers/proyección y consumidores Carrier; no implementar una copia paralela del workflow de Luis.
- Axel: su gateway/configuración existente y evidencia Kiro; no tomar el intake de Juan.

Si un schema o función SQL requiere trabajo de dos verticales, designar un único editor y publicar el DTO esperado antes de cambiarlo. No serializar todo el trabajo por esa dependencia: los demás continúan adaptadores/pantallas independientes. Los fixtures temporales sirven para desarrollar y se rotulan; no satisfacen entrega conectada.

## Calendario interno

| Fecha (Lima) | Trabajo | Resultado esperado |
|---|---|---|
| **19 de octubre** | Construcción paralela, contratos/IDs tempranos, primer corte compartible de cada dueño | Entradas/salidas consumibles y PRs incrementales; acceso al proyecto correcto atendido desde ahora |
| **20 de octubre** | Completar camino principal y seguir integrando | Corte integrado de Cliente → Carrier → Cliente listo para la jornada del 21; congelar ampliaciones secundarias |
| **21 de octubre** | Prueba conjunta sobre el mismo SHA/entorno y correcciones de los dueños | Recorrido completo de formulario y voz, oferta/reserva/operación, persistencia y negativos esenciales; escritorio/móvil y evidencia del resultado |
| **22 de octubre** | Estabilizar, corregir pendientes críticos y preparar/publicar el corte autorizado | Demo, runbook, acceso de jurados, video/materiales y límites coherentes con lo realmente funcionando |

No esperar a la noche del 20 para compartir todo. La integración empieza con el primer incremento útil y continúa mientras cada dueño desarrolla el siguiente.

## Flujo de entrega e integración

**Implementar un corte → commit/push en la rama registrada → compartir SHA y PR → integrar con las dependencias necesarias → continuar.**

La entrega no exige que toda la issue esté terminada: basta un incremento funcional acotado con sus límites explícitos. Puede mantenerse el PR/issue en desarrollo y actualizarse con el siguiente corte. Compartir o integrar no equivale a validación funcional completa ni mueve automáticamente a Done.

Formato corto obligatorio para compartir:

```text
Issue / rama / PR / SHA:
Qué ya funciona y pantalla/API afectada:
Entrada que consume y salida que entrega (IDs/DTO):
Dependencias, migración/seed/configuración por nombre:
Cómo levantar/abrir y qué queda pendiente:
Validación conjunta del 21: pendiente / resultado si ya llegó esa fecha.
```

Reutilizar ramas ya registradas: Jean codex/v2-client-identity-facilities y su antecedente codex/v2-client-order-contracts solo para el trabajo existente; Juan codex/v2-client-intake-experience; Luis codex/v2-client-commercial-operations; Cristhian codex/unified-workspaces-demo-boundary. Axel no necesita rama para soporte; codex/v2-kiro-evidence-delivery está registrada si versiona documentos. Este plan no crea ramas ni modifica targets, permisos o configuración de despliegue. Integrar un corte concreto conserva la autorización requerida por su destino; no ejecutar merges por el solo hecho de actualizar este documento.

## Qué se deja de hacer antes del 21

- Esperar captura/PASS del usuario para implementar el siguiente hito.
- Repetir suites completas, regresiones generales, auditorías extensas o benchmarks por cada cambio.
- Rediseñar todo el frontend, cambiar rutas, copiar carpetas completas o crear nuevas pantallas desconectadas para aparentar avance.
- Preparar varios escenarios grandes antes de tener uno compartido que recorra el flujo.

Se corrigen en el momento errores concretos que impidan compilar, arrancar, consumir el contrato o integrar. No se desactiva CI existente ni se omiten fallos conocidos: si la plataforma ejecuta sus checks se conserva su resultado, sin relanzarlos por rutina. No inventar evidencia de una validación que se difirió.

## Dependencias que requieren trabajo ahora

1. **Supabase alojado correcto:** Jean coordina con el propietario el acceso/aplicación autorizada y cuentas; no trasladar tokens locales ni asumir que Vercel usa el escenario local. Si falta permiso, entregar scripts/contrato y avanzar las demás superficies, dejando el bloqueo visible.
2. **Un escenario compartido:** reutilizar Carrier/servicio/flota existentes. Un Cliente, dos Facilities y los recursos mínimos para la operación bastan para el primer camino. El catálogo previo de 80 vehículos no necesita recrearse.
3. **Nova:** Juan consume el gateway existente; Axel entrega configuración/runbook por canal privado donde corresponda. Health check o grant no demuestra una conversación ni creación persistida.
4. **Funciones y migraciones:** inventario único y orden de aplicación; seeds separados de migraciones estructurales. Un incremento que depende de DDL no aplicado no se declara activo en el alojado.

## Día 21: guion de validación agrupado

Usar el mismo entorno, usuarios autorizados, dataset y SHA integrado. Cada dueño corrige su fallo; Cristhian coordina la integración. No volver a asignar a Jean una QA exclusiva que le impida terminar su vertical.

- Cliente entra, usa Facilities y crea el pedido por formulario; relectura tras recargar.
- Nova y formulario conservan los mismos datos; confirmar produce el registro correcto, sin duplicación ni consentimiento inventado.
- Carrier correcto recibe oportunidad, revisa y emite oferta; Cliente ve esa misma oferta/version.
- Cliente selecciona/autoriza; booking y compromiso de recursos coherentes en ambos portales.
- Inicio/avance/entrega se reflejan en Cliente y Carrier, con ruta/posiciones simuladas identificadas.
- Negativos esenciales: otro tenant sin acceso, versión/oferta obsoleta, recurso ocupado/mantenimiento y reintento sin duplicación. No abrir una campaña ilimitada de pruebas opcionales.
- Interacción escritorio/móvil y voz, con evidencia suficiente para la entrega. La captura no sustituye persistencia ni audio.

## Diferido para proteger el cierre

Carga mixta por líneas, reparto/entregas parciales ampliados, LTL/consolidación nueva, frontera/aduana operativas, calendario alternativo completo, modelos predictivos nuevos, WMS/robots, grandes rediseños y animaciones secundarias. Motion/HyperFrames solo cuando no desplacen la funcionalidad pendiente.

El diseño de líneas/reparto/entregas ya está conservado en CARGA_LINEAS_REPARTO_ENTREGAS_Y_COORDINACION.md. Diferir esa ampliación no elimina las capacidades ya existentes ni autoriza degradar validación, privacidad o consistencia de reservas.

## Aplicación de esta reorganización

El 19-oct-2026 se añadió el encabezado normativo de cierre a las tarjetas existentes HAC-50, HAC-51, HAC-52, HAC-53, HAC-54 y HAC-30. Conserva responsables, estados, ramas, historial y fechas de metadatos. Los CP anteriores se convierten en guion del 21 y no bloquean el desarrollo del 19–20. No se crearon tareas duplicadas ni se enviaron mensajes a otros chats. Este hito no ejecutó pruebas, código, migraciones, merges o despliegues.
