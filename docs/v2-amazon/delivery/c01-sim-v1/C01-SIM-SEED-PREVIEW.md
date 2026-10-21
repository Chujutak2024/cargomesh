# C01-SIM-SEED-PREVIEW

Estado: preparado y validado localmente, **sin activar en el alojado**.
Dataset `C-01-SIM v1`, SHA-256 `3ec394684362182803144cc34185614a1faa23f9bb8681c3211947ca85e39ab6`.

## Referencias existentes, sin alta de usuarios

| Uso | Referencia ya observada en el alojado |
|---|---|
| Cliente | Pacific Produce, organización `52000000-0000-4000-8000-000000000001`, Supervisor `52020000-0000-4000-8000-000000000002` |
| Carrier | HAC44 ROAD, Carrier `e4440000-0000-4000-8000-000000000001`, ADMIN `460388d2-0f66-400f-8fe4-0296093266c6` |
| Catálogo técnico | Miembro existente `e4420000-0000-4000-8000-000000000001`, organización `e4400000-0000-4000-8000-000000000001`; conserva su grant CATALOG_ADMIN vigente |
| Categoría | Resolver GENERAL activa por código; no sobrescribir el catálogo normativo |

No incluye claves, correos personales, cookies, tokens, contraseñas ni UUID ficticios para nuevos registros. Los UUID de las entidades nuevas los generan los comandos de base de datos y se guardan como resultado de activación. Las claves UUID de idempotencia son intenciones técnicas determinísticas, no IDs de producción inventados.

## Conjunto exacto de operaciones de activación

| N.º | Referencia | Actor existente | Entidad | Acción |
|---|---|---|---|---|
| 1 | `facilityA` | client | `facilities` | Crear por comando nativo; reintento con la misma clave |
| 2 | `facilityB` | client | `facilities` | Crear por comando nativo; reintento con la misma clave |
| 3 | `service` | carrier | `carrier_services + cargo-category relation` | Crear por comando nativo; reintento con la misma clave |
| 4 | `depot` | carrier | `carrier_depots` | Crear por comando nativo; reintento con la misma clave |
| 5 | `areaA` | carrier | `service_areas` | Crear por comando nativo; reintento con la misma clave |
| 6 | `areaB` | carrier | `service_areas` | Crear por comando nativo; reintento con la misma clave |
| 7 | `lane` | carrier | `service_lanes` | Crear por comando nativo; reintento con la misma clave |
| 8 | `capabilityDefinition` | carrier | `capability_definitions` | Crear por comando nativo; reintento con la misma clave |
| 9 | `truck1` | carrier | `transport_assets` | Crear por comando nativo; reintento con la misma clave |
| 10 | `capability1` | carrier | `asset_cargo_capabilities` | Crear por comando nativo; reintento con la misma clave |
| 11 | `calendar1` | carrier | `capacity_calendars` | Crear por comando nativo; reintento con la misma clave |
| 12 | `driver1` | carrier | `drivers` | Crear por comando nativo; reintento con la misma clave |
| 13 | `truck2` | carrier | `transport_assets` | Crear por comando nativo; reintento con la misma clave |
| 14 | `capability2` | carrier | `asset_cargo_capabilities` | Crear por comando nativo; reintento con la misma clave |
| 15 | `calendar2` | carrier | `capacity_calendars` | Crear por comando nativo; reintento con la misma clave |
| 16 | `driver2` | carrier | `drivers` | Crear por comando nativo; reintento con la misma clave |
| 17 | `nodeA` | catalogAdmin | `logistics_nodes` | Crear por comando nativo; reintento con la misma clave |
| 18 | `nodeB` | catalogAdmin | `logistics_nodes` | Crear por comando nativo; reintento con la misma clave |
| 19 | `corridor` | catalogAdmin | `route_corridors` | Crear por comando nativo; reintento con la misma clave |
| 20 | `routePolicy` | catalogAdmin | `route_planning_policies` | Crear por comando nativo; reintento con la misma clave |
| 21 | `limit1` | carrier | `route_resource_limits` | Crear por comando nativo; reintento con la misma clave |
| 22 | `limit2` | carrier | `route_resource_limits` | Crear por comando nativo; reintento con la misma clave |
| 23 | `quotePolicy` | carrier | `private.carrier_quote_policies` | Crear por comando nativo; reintento con la misma clave |

Son **23 operaciones de dominio**; no equivalen a 23 filas físicas totales. Los comandos nativos conservan sus relaciones, recibos y auditorías existentes. El seed no crea solicitudes, ofertas emitidas, decisiones, bookings, ejecuciones, reservas ni asignaciones de tripulación.

El servicio admite 20 t y 60 m³ por solicitud; cada camión 10 t y 28 m³ útiles dentro de una envolvente de 30 m³. Se crean dos calendarios y dos conductores diferentes, todos explícitamente sintéticos. Los puntos A/B usan ciudades virtuales C01_SIM_A/B y coordenadas de escenario (-12,-77)/(-12.5,-77): son puntos de prueba, no sedes reales ni una certificación geográfica. La distancia de 100 km permanece simulada.

La política permite **emitir** ofertas automáticamente solo para el servicio/lane nuevos (`autoIssue=true`) después de autorizar su activación. **`dispatch.autoConfirm=false`, `acknowledgeSchedulingAuthority=false` y tope delegado null**. No se habilita mandato global ni se modifica la tarifa PER_TRIP histórica. La confirmación de booking se realiza expresamente como Carrier.

## Aislamiento e idempotencia

- Solo crear registros C01 nuevos y sus relaciones. No UPDATE/DELETE históricos, cambio de capacidad de servicios viejos, cancelación de bookings antiguos, nueva cuenta Auth ni nuevo grant de permisos.
- Claves fijas por dataset/versión/operación y actores exactos del preflight. Si cambian actores, referencias o payload, el comando debe fallar o requerir una versión nueva; no elegir otro administrador silenciosamente.
- Una segunda activación devuelve los mismos IDs. Las 23 referencias permanecieron iguales en dos ejecuciones locales.
- El seed completo es transaccional: error de identidad, DDL ausente, categoría ausente, conflicto de clave o datos vencidos revierte el conjunto.
- El SQL se niega a ejecutarse sin `local_only=1` o un indicador explícito de rollout aprobado; en ambos casos requiere el SHA revisado. Un indicador técnico no sustituye la aprobación humana.
- La ruta nativa administrada resuelve las identidades actuales dentro de una transacción controlada por el dueño de la base. Eso es preparación técnica de fixtures, **no demuestra un login web**. La demostración posterior debe usar sesiones reales Cliente/Carrier.
- `postBookingAssignments` contiene cuatro plantillas, no ejecutadas por el seed: dos PRIMARY driver assignments y dos vehicle assignments. Solo usarlas con los IDs reales del booking/reservas confirmados y la ventana real de ejecución; no pegar IDs de la prueba local.

## Ventanas y precio recalculado

- Recojo propuesto: **2 noviembre 2026, 08:00–10:00 PET**.
- Recepción: **14:00–18:00 PET** del mismo día.
- Caso local aceptado por las validaciones nativas: recojo08:00, entrega14:00, operación hasta14:30; ventanas de vehículos/conductores07:00–19:00.
- Perfiles copiados exactamente del fixture validado: T1 30 L/100 km, USD6/h, USD0.15/km, fijoUSD25; T2 20 L/100 km, USD8/h, USD0.20/km, fijoUSD40. No se utilizaron los 34 L/7h de la guía hipotética anterior.
- CombustibleUSD1.20/L, manejoUSD20 una sola vez, margen20%, impuesto0; conducción3600s y parada900s con tarifa de descanso del fixture. Reposicionamiento y retorno quedan expresamente excluidos de este caso simulado.
- **Resultado calculado: USD 361.20**. Tiempo pagado por conductor: 6.5h. USD310.80 era el fixture anterior con 3.5h; las 3h adicionales de USD6+USD8 por hora, con20% de margen, añaden USD50.40. No se insertó un precio final fijo ni se bajó una restricción para forzar el importe anterior.
- El límite de velocidad120km/h es el parámetro sintético exacto del fixture, no una velocidad media real ni permiso operativo.

## Verificación ejecutada

Schemas reales: 23 operaciones, cuatro plantillas de asignación y el request PASS. En base local temporal: dos activaciones con IDs iguales y **21 comprobaciones focales PASS**. El flujo autenticado nativo conserva12t/1oferta/1booking/2reservasCONFIRMED/2conductoresasignados/2vehículosasignados/PLANNED. Snapshots de todas las filas anteriores en las tablas inspeccionadas quedaron iguales.

La prueba usa el candidato explícito de dos recursos y una ventana fija validada por las mismas RPC. No acredita por sí sola la selección visual automática de esa opción desde Vercel, audio real ni una operación de transporte. La base temporal se eliminó. No se repitieron G01–G04 ni hubo escrituras alojadas.

Evidencia: `final-local/LOCAL-RESULTADO.json`, `LOCAL-FLOW.log`, dos logs de activación y validación de schemas. Los IDs locales son desechables y no se deben reutilizar en el alojado.

## Controlador de activación listo, sin ejecutar

`activate-reviewed.py` está preparado para la CLI del proyecto. Por defecto solo previsualiza y no contacta la base. Comprueba destino, SHA del manifiesto y del JSON embebido en el seed, y que autoConfirm siga false. Para enviar SQL exige además --apply, referencia de aprobación humana, --ack-carrier-quote-authority y carpeta de evidencia. Sustituye únicamente el prologue psql tras validar guards equivalentes; conserva la transacción y las validaciones nativas. En esta etapa se ejecutó únicamente PREVIEW con hostedWrites=0. No se afirma probado su transporte de escritura alojado.
