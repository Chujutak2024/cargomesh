# Flota del coordinador — implementación local

Fecha: 8 octubre 2026. Proyecto: `D:\Documents\hackaton 2\cargomesh-v2-current-local`.
Vista: `http://127.0.0.1:8080/v2-workspace#/fleet`.

## Entrega

**Actualización visual posterior:** a petición del usuario, las ilustraciones 3D de Flota se sustituyeron por fotografías reales de referencia en tarjetas, lista y ficha. Véase [FLEET_REFERENCE_PHOTOS_2026-10-08.md](FLEET_REFERENCE_PHOTOS_2026-10-08.md) para créditos, fuentes y evidencia actual. La descripción y las capturas 3D de esta entrega se conservan como historial de la versión anterior.

Se incorpora **Flota** a la navegación de la web Next actual. El borrador local sigue siendo el mismo registro compartido por Panel, Solicitudes, Revisión y Ruta. La flota no convierte el camión preferido del borrador en un activo registrado o asignado.

- Directorio con tarjetas/lista, búsqueda por vehículo/conductor/ubicación, orden por atención/código/combustible y seis filtros con conteos derivados.
- Ficha de vehículo: identidad, conductor, posición registrada, velocidad cuando existe en el escenario, placa, carrocería, depósito, odómetro, combustible, utilización, costo y próximo mantenimiento.
- Gráfico interactivo de conducción/ralentí: 7 o 14 días, lectura por foco/cursor, selección persistente del día y alternativa textual.
- Descarga JSON de la ficha con fuente y aviso de simulación o ausencia de datos.
- Visuales originales derivados de los cinco modelos Three existentes. Tarjetas usan renders ligeros; la ficha utiliza el componente 3D con carga por visibilidad y respaldo del tipo correspondiente. Las imágenes son ilustraciones, nunca fotografías del activo real.
- Transiciones existentes de contenido conservan shell y contexto; volver conserva búsqueda/filtro/orden y devuelve el foco al botón del vehículo.
- Español/inglés, navegación móvil, desplazamiento contenido dentro del gráfico de 14 días y respeto a `prefers-reduced-motion`.

La referencia FleetFlow AI se retoma desde la observación directa ya documentada en `HAC43_VISUAL_CORRECTION_2026-10-08.md`: directorio → vehículo → datos y contexto de servicio. Esta entrega no afirma una nueva reproducción completa del video ni utiliza sus assets propietarios.

## Fuentes y contrato

`fleet-model.ts`, `fleet-client.ts`, `fleet-workspace.tsx` y `fleet.module.css` forman la nueva vista. `coordinator.tsx` agrega navegación y evita que la flota se renderice como un borrador. `logistics-truck.tsx` ajusta únicamente el respaldo visual para variantes no articuladas.

La vista de ejemplo inicial es **EXAMPLE**, sin persistencia, GPS, reserva ni escritura al servicio. Sus seis vehículos, personas, placas, posiciones, velocidades, indicadores de condición, combustible, costos, utilización y series de motor son simulados. El instante del ejemplo está fijado al 8 octubre 2026; no hay un reloj de actualización ficticio.

La fuente **Datos del servicio** utiliza exclusivamente GET de `/api/v2/carriers/{carrierId}`, activos y referencias de conductores, asignaciones, operaciones, depósitos y mantenimientos. Requiere sesión y grants reales. No se modifica autenticación, RLS, contratos, mutaciones, catálogos ni backend. Cada lectura pasa por los schemas canónicos y coteja carrier y tipo de registro. Se permiten hasta diez páginas de cien registros por recurso; truncamiento o referencias incompletas se informan como consulta parcial, nunca como total histórico.

| Dato | Fuente del servicio y límite |
| --- | --- |
| Estado, placa, marca/modelo, carrocería, odómetro y capacidad útil | `FleetOutputsV2.assets`; valores nulos permanecen nulos |
| Conductor/posición | Una sola asignación vehicular CONFIRMED dentro de su ventana, misma ejecución IN_PROGRESS y servicio; un solo conductor PRIMARY confirmado en la ventana |
| Posición | `lastKnownPosition`; coordenadas ausentes no generan puntos ni trazas. No existe timestamp de observación en este read, por lo que se informa que no confirma movimiento actual |
| Mantenimiento | Próximo SCHEDULED/IN_PROGRESS cuya ventana no haya terminado; no se infiere disponibilidad |
| Combustible, salud, velocidad, utilización/costo y horas de motor | No provistos por el contrato actual: null/«—», sin barras de ejemplo en la fuente del servicio |

`IN_SERVICE`, propiedad del vehículo, capacidad declarada y una última posición no prueban circulación, capacidad libre ni reserva. No se dibujan rutas nuevas, GPS animado o trazas inventadas. Un 401/403 invalida los datos consultados y jamás activa automáticamente los ejemplos. La asignación de conductores, agendamiento de servicio y mutaciones operativas del video quedan en sus workflows autorizados existentes; esta nueva pantalla es de consulta.

## Verificación

Evidencia externa: `D:\Documents\hackaton 2\cargomesh-v2-fleet-monitor-20261008`.

- **22/22 pruebas**: 13 de flota/cliente + 9 de continuidad del borrador. Incluyen datos desconocidos, cero vehículos, permisos revocados, schema/carrier inválido, paginación repetida/duplicados, filtro de combustible y orden, ventanas caducadas, asignaciones ambiguas y coordenadas nulas/pares incompletos. `tests.log`.
- Typecheck standalone y validación de tipos/lint del build: PASS.
- Arquitectura: **328 módulos / 47 entry points**: PASS. `architecture.log`.
- Build Next de la implementación final: PASS. `build.log`. Los servidores actuales se reiniciaron por el launcher local en 8080/8083.
- Navegador: combustible bajo muestra un vehículo; búsqueda sin coincidencias conserva los datos; limpiar restituye seis; lista ordena por código; Enter abre la ficha y el retorno recupera el foco y filtro; cambio 7/14 días y lectura por teclado; español↔inglés; JSON descargado con `source: EXAMPLE` y aviso explícito.
- Móvil **390×844**: scrollWidth 375, sin overflow de página; seis imágenes cargadas; cero canvas; barras de 14 días con ancho 30 px dentro de región desplazable; respaldo plataforma coincide con `flatbed-3d.png`.
- Opera: visual de ficha `data-truck-state=webgl`, variante flatbed, un canvas y sin errores de consola observados.
- Consulta real sin sesión: «Inicia sesión para consultar tus datos», cero tarjetas de ejemplo en esa fuente. Runtime de flota autenticado y datos reales pendientes de sesión/carrier autorizado; pruebas con respuestas controladas no certifican ese entorno.

Capturas: `fleet-desktop.png`, `fleet-list.png`, `fleet-detail-desktop.png`, `fleet-mobile.png`, `fleet-detail-mobile.png`, `fleet-detail-webgl-native.png`, `fleet-service-session.png`. Backups de los dos archivos preexistentes y manifiesto SHA-256 externos permiten revisar este incremento sin sobreescribir la línea visual anterior.

## Estado

UI local implementada y verificada. La circulación **real** requiere una fuente de posiciones con timestamp y telemetría de vehículo; no queda implementada por un fixture o por el estado operativo del catálogo. Véase `friction/FLEET_TELEMETRY_GAP_2026-10-08.md`.

No se realizaron commits, push, PR, merge, despliegues ni escrituras en servicios remotos.
