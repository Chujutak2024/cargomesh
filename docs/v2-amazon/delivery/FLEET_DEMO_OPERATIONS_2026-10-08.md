# Flota del coordinador — demo operativa local

Fecha: 2026-10-08. Solicitud: aplicar las ideas del líder con datos simulados, autorizados por el usuario para la demo.

Aplicación actual: `cargomesh-v2-current-local/cargomesh`. Acceso: http://127.0.0.1:8080/v2-workspace#/fleet.

## Entrega

La sección Flota ahora tiene tres vistas que comparten el mismo estado de ejemplo:

1. **Camiones**: tarjetas compactas con fotos reales de referencia, estado, código y modelo. Al pulsar cualquier parte de la tarjeta se abre la ficha con placa, capacidad de carga, descripción, registro del vehículo, alta en CargoMesh, estado y motivo, fecha del estado, última modificación, combustible, autonomía estimada, odómetro, mantenimiento, zona de trabajo y destino previsto, además de sus gráficos. Conserva búsqueda, filtros, ordenación, lista y descarga. El refinamiento de presentación y su evidencia vigente están en `FLEET_DETAIL_ON_CLICK_2026-10-08.md`.
2. **Zonas y destinos**: corredores de Costa norte, Lima y Callao y Corredor sur; filtro por corredor con conteos y ficha de cada vehículo. Origen, destino, instalación y llegada prevista son simulados. Esta vista no dibuja geometría vial ni representa un GPS.
3. **Asignación de conductores**: pipeline de viajes Sin conductor → Asignado → En ruta → Finalizado. Permite asignar, liberar antes de salir, iniciar y finalizar el viaje. Bloquea el camión en taller y los conductores ocupados o no habilitados. El conductor queda libre al finalizar; se conserva su nombre en la historia del viaje. Botones y selector funcionan con teclado y en móvil, sin depender de arrastrar tarjetas.

KPIs iniciales: **6 camiones, 5 en estado normal, 1 en mantenimiento y 66.7% con mantenimiento durante el año anterior**. Normal agrupa AVAILABLE + IN_SERVICE; no confirma disponibilidad para reserva.

### Cálculos

- KPI anual = camiones con ≥1 mantenimiento COMPLETED terminado entre 2025-10-08T15:00:00Z y 2026-10-08T15:00:00Z / total de camiones × 100. Se cuenta cada camión una sola vez: 4/6. No mide porcentaje de tiempo en taller ni fallas. El período y la definición están visibles debajo de los KPIs. Sin historial completo o sin camiones se muestra —.
- Autonomía = (combustible % / 100 × capacidad del tanque en litros) / consumo en litros por 100 km × 100. Es una estimación simulada, redondeada a km; no contempla carga, tráfico ni conducción. Cero combustible produce 0 km; valores desconocidos o inválidos producen —.
- Última modificación y fecha desde la que rige el estado son campos distintos. Asignar, iniciar o finalizar actualiza la modificación; la fecha del estado solo cambia cuando cambia operatingStatus.

## Archivos y conexión posterior a datos reales

- `cargomesh/src/features/carrier-portal/fleet-model.ts`: view model, adaptación del contrato V2, fixtures, autonomía y KPIs.
- `fleet-demo.ts`: comandos y máquina de etapas exclusivamente EXAMPLE; validación estricta de estado guardado y conflicto de conductor.
- `use-fleet-demo.ts`: persistencia local versionada en `cargomesh-fleet-demo-v1`, leída antes de escribir.
- `fleet-workspace.tsx`: integra KPIs, tarjetas, ficha y las tres vistas.
- `fleet-operational-views.tsx` y `fleet-operations.module.css`: zonas y pipeline responsive.
- `fleet.module.css`: altura automática, metadatos, notas y navegación de vistas.

El escenario se puede restablecer con **Restablecer demo**. El estado es propio del navegador/origen; no modifica el borrador de carga ni realiza solicitudes de escritura a la API. Si el navegador bloquea almacenamiento, las acciones funcionan durante la vista abierta y la UI informa que no serán persistentes.

Para conectar el servicio, mantener `FleetVehicle` como modelo de presentación y sustituir el origen EXAMPLE mediante adaptadores validados. El mapper SERVICE actual mantiene fechas de registro y `conditionReason` del vehículo, `createdAt` y `updatedAt` del registro. No convierte `updatedAt` en fecha de cambio de estado. Combustible, autonomía, destino, zonas e historial anual quedan desconocidos si el contrato no los entrega. No se deduce cobertura de una base o de la última posición.

Las cuatro columnas son etapas de la demo de viajes: **no son nuevos enums del API**. La integración futura deberá usar los comandos, permisos, ventanas y estados canónicos de CrewAssignment/VehicleAssignment y Execution según los contratos V2. No enviar IDs `example-*` o `trip-CM-*` al servicio. El tablero se deshabilita en la fuente SERVICE, cuya consulta existente conserva sus controles de sesión y alcance por transportista.

Las fotografías ilustran tipos de camión y pueden diferir del modelo ficticio indicado. Se conservan la etiqueta de referencia y los créditos/licencias visibles. Véase `FLEET_REFERENCE_PHOTOS_2026-10-08.md`.

## Validación y evidencia

**32/32 pruebas pasan**: flota nativa y ejemplos, máquina de asignación, rechazo de conflictos/estados corruptos, límites del KPI anual, autonomía y conservación del borrador. `tsc --noEmit` OK. Arquitectura OK: 332 módulos, 49 entradas cliente. `next build` completo OK.

Smoke en navegador:

- Asignación de Diego Castro a CM-204 con Enter, inicio y finalización con Enter. La tarjeta cambia de columna, conserva el foco en su botón y libera al conductor al finalizar.
- Recarga: el viaje finalizado sigue presente. Restablecer demo recupera las etapas iniciales.
- Corredor sur: filtra a CM-231 y CM-212; abrir y volver de la ficha conserva un foco útil en el camión.
- Móvil 390×844: tarjetas, ficha, zonas y pipeline sin desbordamiento horizontal de página (`scrollWidth = 390`). El gráfico existente conserva su scroll interno.
- Las seis fotografías locales cargan correctamente al navegar por las tarjetas.
- Cambio ES/EN: encabezados y controles nuevos traducidos; regreso final a español.
- Fuente SERVICE sin consulta: KPIs desconocidos, sin vehículos de ejemplo y sin acciones de asignación habilitadas. No se usaron datos del servicio para este smoke.
- Compilación reiniciada con el launcher existente y pestaña del navegador del usuario actualizada en 8080.

Carpeta de evidencia local: `D:/Documents/hackaton 2/cargomesh-v2-fleet-demo-20261008`:

| Evidencia | Archivo |
|---|---|
| Compilación y pruebas | `build.log`, `tests.log` |
| Presentación anterior de tarjetas con todos los datos | `fleet-cards-desktop.png`, `fleet-cards-user-browser.png` |
| Pipeline inicial, asignado y finalizado | `fleet-pipeline-desktop.png`, `fleet-pipeline-assigned.png`, `fleet-pipeline-completed.png` |
| Filtro por zonas y ficha | `fleet-zones-desktop.png`, `fleet-record-desktop.png` |
| Móvil | `fleet-cards-mobile.png`, `fleet-zones-mobile.png`, `fleet-record-mobile.png`, `fleet-pipeline-mobile.png` |
| Separación de fuente SERVICE | `fleet-service-isolation.png` |

## Comentario para el líder

Se aplicaron las propuestas de Flota en la demo local: tarjetas de altura automática con placa, modelo, capacidad, descripción, fechas, estado, motivo y autonomía; KPIs de camiones, estado normal, mantenimiento y porcentaje anual; vista de zonas/destinos; y pipeline para asignar conductor, iniciar y finalizar viajes. Las acciones se sincronizan con las fichas y se conservan al recargar. Todo el escenario está marcado como simulado y mantiene las fotos reales como referencia. Validado con 32 pruebas, build, teclado y móvil; evidencia en esta entrega local.
