# HAC-50 — Opportunity → response → offer → booking → Orders / pipeline

15 de octubre de 2026. Código local en `codex/unified-workspaces-demo-boundary`, checkout `C:/Users/HP/.codex/worktrees/unified-workspaces/cargomesh`. HEAD publicado de referencia: `cbb10ff1c23b6e44376378b9843cc5e602742e36`. No se publicó, mergeó ni desplegó este incremento. Se conservaron los cambios de Fleet, sedes, agenda, Three.js y estilos de otros chats.

## Abrir

- Front: http://127.0.0.1:8080/
- Oportunidades: http://127.0.0.1:8080/v2-workspace#/shipments
- Ofertas: http://127.0.0.1:8080/v2-workspace#/desk
- Orders: http://127.0.0.1:8080/v2-workspace#/orders
- Pipeline: http://127.0.0.1:8080/v2-workspace#/pipeline

El login conserva su destino permitido de Fleet. Después de entrar se navega mediante el menú del mismo workspace. `#/tracking` conectado ahora resuelve a Orders; el modo demo conserva su planificación y editor locales.

## Entregado

| Bloque | Comportamiento |
| --- | --- |
| Oportunidad | Detalle fresco con revisión, origen/destino, carga, requisitos, snapshots de equipo/ventanas y plazo. Aceptar para revisión o declinar mediante comando nativo, nota, evidencia y versión esperada |
| Oferta | Precio, desglose, vigencia, términos, capacidad declarada y procedencia. Cotización manual sobre asignaciones registradas; retiro y versión de reemplazo conservan historial |
| Cliente | Botón explícito `Refresh offers & bookings` lee la solicitud y sus ofertas, rankings, decisiones y bookings persistidos. No selecciona, cotiza ni reserva automáticamente |
| Orders | Una fila por autorización de booking; conserva pendientes, rechazadas y canceladas. Agrupa ejecuciones por booking. Confirmación del Carrier sigue separada de autorización del Cliente |
| Pipeline | Una tarjeta por oportunidad, incluye versiones de ofertas y bookings vinculados. Etapas derivadas, sin drag-and-drop ni tabla de tareas inventada |

Las acciones usan los contratos existentes y permisos nativos: ADMIN/OPERATOR comercial; DISPATCHER no recibe permisos comerciales nuevos. El servidor determina actor e identidad. Los formularios conservan recibos idempotentes y revisiones esperadas donde aplica, y requieren revisión explícita antes de enviar. Cambiar el estado visual de una tarjeta no constituye una autorización comercial.

Aceptar una oportunidad no reserva capacidad. Preparar una oferta no crea una orden. Cliente selecciona ofertas y autoriza booking explícitamente. Carrier confirma solo cuando el backend valida el compromiso de capacidad necesario. No se fabrican precios, equipamiento, disponibilidad, ranking ni ventanas tentativas.

## Relaciones y datos incompletos

Los joins exigen Carrier, organización y solicitud coincidentes y referencias persistidas. Booking → oferta usa exclusivamente `offerId`; no deduce precio/ruta por cercanía, cliente o una oferta de la misma solicitud. Ejecuciones sin booking cargado permanecen indicadas. Lecturas paginadas se limitan y marcan parciales; se bloquean mutaciones comerciales con colección incompleta.

Un booking solo se muestra completado si todas sus ejecuciones cargadas están completadas, la lectura no es parcial y cada servicio cubierto por su oferta tiene ejecución. No certifica cada paso físico, GPS ni descarga de Three.js. Conflictos como ejecución activa con booking cancelado aparecen en `Needs review`.

Oportunidades públicas exponen IDs de tramos agrupados; sus snapshots históricos usan IDs de bindings. Una oferta de toda la oportunidad puede usar todos los servicios de sus snapshots registrados. Una oferta parcial exige vínculo explícito `legAssignmentId`; no se deduce por posición en un array, secuencia o nombre de servicio.

## Backend añadido

- GET listado/detalle `/api/v2/freight/requests/:requestId/bookings`, con el servicio, autenticación y alcance de organización existentes.
- Lecturas comerciales Carrier con `Cache-Control: no-store, private` y `Vary: Cookie, Authorization`.
- Esquema de booking acepta `data.offerId` opcional para compatibilidad con bases anteriores.
- Migración aditiva `supabase-v2/supabase/migrations/20261015122904_hac50_booking_offer_projection.sql`: conserva el lector compuesto; añade `offerId`/`decisionId` reales del booking y `legAssignmentId` real del snapshot de oportunidad. Sin tablas nuevas, seeds, cambios de permisos ni mutaciones comerciales.

No hay APIs paralelas de ofertas o pipeline. El modo demo mantiene sus fixtures y no activa el refresh comercial conectado.

## Evidencia ejecutada

- TypeScript sin emisión: PASS.
- Arquitectura: PASS, 391 módulos y 107 entradas cliente verificadas.
- 50/50 pruebas Node: contexto completo/parcial de ofertas, versiones, procedencia, scopes, paginación, aborto, Orders, pipeline, permisos, navegación y servicio de workflow.
- 54/54 pgTAP en banco local aislado `hac50_depot_limits_20261015_v3`, después de la migración. Flujo nativo de oportunidad, respuesta Carrier, oferta, ranking, selección Cliente, booking, ejecución, holds, confirmación y cancelación. Las aserciones nuevas incluyen idempotencia de respuesta, versión obsoleta, oferta compartida por ambos dominios, vínculo exacto de booking y agrupación de recursos. Transacción revertida. Solo fixtures sintéticos del repositorio; no filas copiadas de Supabase alojado.
- 15/15 comprobaciones HTTP sobre el front configurado: login existente, compilación y entrega de workspace con navegación Orders/Pipeline, cuatro colecciones y detalles validados, contexto real de oferta, derivaciones, no-store, aislamiento de otro Carrier, anon y endpoint Cliente. Lecturas: 4 oportunidades, 4 ofertas, 4 bookings, 3 ejecuciones. No se enviaron cotizaciones ni decisiones comerciales al proyecto alojado durante estas pruebas.
- Evidencia: `UNIT_RESULTS.txt`, `SQL_RESULTS.txt`, `HTTP_RESULTS.json`. El SQL contiene exclusivamente datos QA/sintéticos; HTTP no contiene credenciales.
- Inspección visual automática pendiente: la política del navegador rechazó observar la pestaña local existente. No se intentaron navegadores alternativos ni otras vías de control. No se declara responsive ni UI de Cliente aprobada en navegador.

El test SQL cruza los principales de dominio de organización y Carrier; no demuestra dos cuentas Auth distintas ni dos navegadores simultáneos. La sesión disponible del front es Carrier; para validar Cliente visualmente hace falta una cuenta con membresía de su organización.

## Activación remota: autorizada, pendiente de conexión

El usuario autorizó específicamente aplicar la migración comercial al proyecto `yhimeajpzicjbxpbzsyh` y conectar el proyecto correcto. El conector Supabase enumera `tokvzfrefwqobzqgbfoj` y `xdkdxqevtksazldbxesw`; consultar el proyecto de la app devuelve falta de permisos. No se modificó otro proyecto ni se cambió `.env.local` para hacerlo coincidir.

Hace falta reconectar el plugin con la cuenta que accede a `yhimeajpzicjbxpbzsyh`. Después: comprobar migraciones y definición real del lector, aplicar solamente la migración autorizada, verificar privilegios y repetir HTTP para confirmar `bookingsWithoutOfferReference: 0` y snapshots con vínculo de tramo. No usar un push masivo de migraciones ni ejecutar fixtures en remoto.

La migración anterior de operaciones de sede es una autorización/activación distinta; este consentimiento comercial no se interpreta como permiso para aplicar todas las pendientes. En el entorno actual los 4 bookings aún carecen de `offerId`; la UI conserva Orders y muestra el vínculo pendiente.

## Próximos cortes

- Verificación visual con Cliente autorizado, emitir oferta sintética controlada y comprobar selección/booking en ambos portales tras activar la proyección.
- Descubrimiento/despacho que cree oportunidades desde solicitudes y planes persistidos: esta entrega consume oportunidades existentes; abrir una solicitud no crea invitaciones artificiales.
- Actualizaciones push/Realtime, vencimientos con notificación y bandeja de excepciones.
- Pipeline interno editable, tareas Monday, lista CRM de clientes, próximo horario viable, reposición por otro Carrier, herramientas Alexa nuevas y orquestación Three.js continúan fuera de este incremento.

## Reproducir

Desde `cargomesh/`: `pnpm test:carrier-commercial`, añadir `carrier-workspace-model.test.ts` y `carrier-navigation/navigation.test.ts` para las 50 pruebas conjuntas; `node node_modules/typescript/bin/tsc --noEmit --incremental false`; `node scripts/check-architecture.mjs`.

En PostgreSQL local con cadena V2, catálogo de referencia y escenario ROAD aplicados: instalar la migración nueva y ejecutar `supabase/tests/22_v2_hac40_workflow.test.sql`. Nunca ejecutar ese escenario/test sobre Supabase alojado.

Los instaladores de esta carpeta son historia de preparación. No volver a ejecutarlos: contienen reemplazos de una sola pasada y el código final puede haber cambiado después.
