# Primer incremento: Carrier conectado, Demo y red

15 de octubre de 2026. Rama existente `codex/unified-workspaces-demo-boundary`; incremento local vinculado a HAC-50. No publicado; no merge/push/main/deploy.

## Implementado

- `ConnectedCoordinator` elige árboles separados de Carrier conectado y Demo. La habilitación de Demo requiere valor de query exacto y flag del servidor; se conserva la validación de sesión.
- Carrier conectado ya no monta `V2IntakePrototype`, hooks de solicitudes locales ni lectores globales de FreightRequest. Requests consulta oportunidades; Offers consulta ofertas; Operations consulta ejecuciones, con las rutas y parsers Carrier existentes.
- El antiguo enlace `#/request/...` abre el inbox conectado; el editor local solo aparece bajo `?demo=1`. El cambio de modo es explícito; los cambios dentro del workspace conservan documento/Carrier seleccionado.
- Selector de Carrier compartido con Fleet; se cancela/limpia la consulta al cambiar contexto. Fleet conserva alta/revisión y directorio conectados; el alta de vehículo está en Fleet, sin una segunda entrada de administración en el menú conectado.
- Sites & coverage lee sedes y servicios; por servicio consulta áreas de recojo/entrega y lanes dirigidas. Verifica scope carrier/service y paginación, distingue lecturas parciales, vacíos, error y datos faltantes. No infiere cobertura del país de una sede ni permiso de un flag de frontera.
- Demo conserva siete pedidos locales, doce vehículos y las escenas anteriores. Retirado su antiguo lector de flota conectada y formulario de UUID manual; salida explícita al catálogo conectado.
- Plan actualizado; propuesta de límites operativos de sede y prompt de backend Cliente preparados fuera del checkout activo.

## Verificación

- 35/35 pruebas específicas: navegación, scope, permisos, cliente de flota y frontera Demo. Incluyen scope de servicio incorrecto, Carrier ajeno, payload malformado, 403, parent ausente, paginación repetida/duplicados y límite de lectura parcial.
- 33/33 regresiones del Demo: flota, wizard, persistencia local, asignaciones, incidencias/reemplazo/cancelación. Warning existente de Three CJS; no fallo.
- TypeScript limpio después de finalizar la limpieza; arquitectura OK: 376 módulos/101 entradas cliente observadas. No usar esos conteos como gate futuro.
- Navegador con sesión Carrier existente: catálogo conectado de siete vehículos/cuatro conductores; cuatro oportunidades; red sintética con una sede en Lima, área PICKUP Lima, DELIVERY Arequipa y lane Lima→Arequipa. Son datos sintéticos autorizados, no un mercado real.
- Demo explícito conserva siete pedidos/doce camiones; retorno a Connected; enlace antiguo de edición muestra Requests sin wizard.
- Escritorio habitual 1280×720 y móvil 390×844: sin overflow horizontal de documento en Sites & coverage; menú móvil abre/cierra al navegar. Override móvil restaurado. Captura visual revisada inline en las herramientas; no archivo de captura exportado.
- No hubo escrituras de negocio, semillas, migraciones, nuevas cuentas o cambios de grants/RLS en este incremento.

## Límites de esta entrega

Las listas comerciales/operativas son lecturas. Ficha completa del pedido vinculado a una oportunidad, formularios de respuesta/oferta, búsqueda de fecha próxima, agenda/asignación y recuperación entre carriers siguen pendientes; no se simulan como Connected.

El contrato CarrierDepot observado no expone horarios ni capacidad concurrente ni una relación operativa sede–servicio. Las Facilities del Cliente sí tienen horarios/restricciones; no son intercambiables con CarrierDepot. Esa diferencia se documentó para preparar la extensión backend y sus pruebas antes de ofrecer factibilidad basada en esos límites.

No se cargaron diez carriers: siguen como dataset propuesto, pendiente del escenario/cargador seguro y de su validación. No hay disponibilidad/GPS confirmados por estas pantallas.

## Archivos principales del checkout activo

`coordinator.tsx`, `connected-carrier-workspace.tsx`, `local-demo-coordinator.tsx`, `connected-carrier-inbox.tsx`, `connected-carrier-network.tsx`, `carrier-workspace-model.ts` y su prueba; página `app/v2-workspace/page.tsx`; navegación compartida; `fleet-client.ts`, `records.ts`, `connected-fleet.tsx` y `fleet-workspace.tsx`.

Se conservaron los cambios visuales concurrentes. `implementation/` contiene copias de preparación que pueden no coincidir con el código final. Los scripts apply/fix/clean/finalize son operaciones de una sola ejecución; no volver a ejecutarlos como instaladores.
