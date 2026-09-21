# Contratos de dominio y datos V2

## FreightRequest

Debe representar identidad organizacional, origen/destino por sede o ubicación, ventana, carga, embalaje, cantidades, dimensiones/peso por unidad, divisibilidad, requisitos especiales, modos aceptables, tipo de equipo requerido o preferido, presupuesto opcional, estado y `draft_version`.

La carga puede incluir pallets, cajas, contenedores, granel u otras unidades modeladas explícitamente. Refrigeración, fragilidad, peligrosidad, sobredimensión y temperatura son restricciones, no etiquetas visuales.

## Facilities y red física

- `Facility`: sede del shipper o punto operativo con ubicación y restricciones.
- `CarrierDepot`: sede o patio propio del carrier; no equivale a cobertura geográfica.
- `LogisticsNode`: puerto, terminal, aduana u otra infraestructura compartida que puede no pertenecer a un carrier.
- `RouteCorridor`: relación versionada entre nodos, modos, distancia, tiempo y fuente geográfica.
- `RoutePlan`: uno o más segmentos compatibles con la solicitud.

## Carrier y servicios

`Carrier` describe la organización. `CarrierService` describe una capacidad concreta: modo, tipo de servicio, límites, requisitos, integración y estado. Un carrier puede exponer múltiples servicios y sedes. Cada servicio declara `ServiceArea` de recojo/entrega, `ServiceLane` dirigida y fuente/vigencia de cobertura. La sede no concede cobertura automática a su país o provincia; una lane puede usar un socio documentado. Véase [el contrato de cobertura](./CARRIER_COVERAGE_AND_SERVICEABILITY.md).

`TransportAsset` y `CapacityCalendar` representan flota propia o capacidad contratada, reservas, mantenimiento y reposicionamiento por ventana. Cobertura, capacidad y oferta comercial son estados distintos: conocer una zona no significa tener un activo libre ni haber cotizado.

`TransportMode`, `EquipmentType`, `VehicleCombination`, `CapacityPool` y `TransportPlan` separan medio, tipo de equipo, activos físicos, cupos de terceros y plan asignado. Un plan puede utilizar una o varias unidades o tramos, pero una escolta no suma capacidad portadora y una carga indivisible no se divide. Tara, peso bruto máximo, capacidad útil, volumen/dimensiones y límites de ruta se evalúan antes del ranking. Véase [planes de transporte y flota](./TRANSPORT_PLANS_AND_FLEET.md).

## Opportunities y ofertas

- `CarrierOpportunity`: invitación a participar derivada de discovery.
- `CarrierOffer`: respuesta comercial inmutable o versionada con precio, moneda, tránsito, vigencia, capacidad reservable, fuente y condiciones.
- Una ausencia de oferta no se transforma en una cotización sintética.
- La oferta corresponde a un plan o conjunto de tramos aceptado por su emisor; explicita tarifa, recargos incluidos/estimados/excluidos y costos desconocidos. No se unen ofertas de carriers distintos bajo una responsabilidad comercial ficticia.

## Repetición de envíos

Las plantillas y similitudes históricas son propias de la organización autorizada. Precargan datos y preferencias, pero nunca confirman automáticamente capacidad, precio, permisos o reserva: se reevalúan con fuentes y fechas actuales.

## Concurrencia e idempotencia

- Creación: `creation_idempotency_key` + `creation_payload_hash` SHA-256 del payload canónico.
- Mutación: `expected_draft_version`; el servidor incrementa atómicamente.
- Reintento idéntico devuelve el resultado existente. Misma clave con payload diferente produce conflicto estable.

## Persistencia y escenarios

- Migraciones V2: esquema, constraints, funciones de producción, índices y RLS.
- Datos de demo V2: `supabase/scenarios/v2-<nombre>/seed.sql`.
- Seeds V1 no se renombran ni se publicitan como V2.
- Cada escenario declara propósito, datos sintéticos, cleanup y verificación.
