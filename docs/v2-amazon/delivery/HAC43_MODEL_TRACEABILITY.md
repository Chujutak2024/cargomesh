# HAC-43 — trazabilidad de las 57 clases

Fecha: 7 octubre 2026. Fuente: [FULL_MODEL_TARGETS](../models/FULL_MODEL_TARGETS.json), [inventario UML](../models/FULL_MODEL_UML_INVENTORY.json), schemas V2 y routers del SHA 50c12d1. El modelo completo declara 57 clases, 397 atributos y 93 relaciones. Los targets NO certifican implementación.

Esta tabla describe representación/ownership FE actual. PARTIAL indica código/formulario/proyección, no prueba DB positiva ni cobertura de cada atributo/relación. No se descarta ninguna clase del alcance integral. Una fila NOT AVAILABLE exige entrega o integración de su owner; no significa que se haya pospuesto fuera de V2. No se certifican RLS ni las 260 FK desde pruebas de UI.

| Clase | Área UML | Representación real / gap | Owner FE o dependencia | Estado de aceptación |
| --- | --- | --- | --- | --- |
| Organization | Identidad | Sesión / identidad existente; no CRUD nuevo | Axel | NOT AVAILABLE FE nuevo |
| Facility | Identidad | Selector existente de sedes del intake; no depot ficticio | Luis | PARTIAL |
| FreightRequest | Solicitud | Directorio y revisión conectados; intake existente | Luis / Juan | PARTIAL |
| CargoSpecification | Solicitud | Formulario y detalle embebidos | Luis | PARTIAL |
| CargoUnit | Solicitud | Unidades del intake existente; total derivado real | Luis | PARTIAL |
| Carrier | Catálogo | Perfil y revisión tras gate de permiso | Juan / Axel | PARTIAL |
| CarrierDepot | Catálogo | Red / depots, formulario y revisión | Juan | PARTIAL |
| CarrierService | Catálogo | Red / services | Juan | PARTIAL |
| ServiceLane | Cobertura | Red / services/{id}/lanes | Juan | PARTIAL |
| ResponseIntegration | Integración | No hay controlador ni CRUD nuevo; dependencia de integración real | Axel | NOT AVAILABLE |
| CapacitySource | Capacidad | Activos/cupos separados; no entidad ficticia agregada | Juan | PARTIAL |
| TransportAsset | Flota | Flota / assets | Juan | PARTIAL |
| RoadVehicle | Flota | Datos embebidos en activo | Juan | PARTIAL |
| CapacityPool | Capacidad | Flota / capacity-pools | Juan | PARTIAL |
| CapacityCalendar | Capacidad | Flota / calendars | Juan | PARTIAL |
| CapacityReservation | Capacidad | Operación / capacity/holds, confirm/release | Juan | PARTIAL |
| ScheduledMaintenance | Flota | Flota / maintenances | Juan | PARTIAL |
| Driver | Flota | Flota / drivers | Juan | PARTIAL |
| DriverAssignment | Flota | Flota / driver-assignments | Juan | PARTIAL |
| VehicleAssignment | Flota | Flota / vehicle-assignments | Juan | PARTIAL |
| AssetStatusEvent | Flota | Flota / assets/{id}/events | Juan | PARTIAL |
| RoutePlan | Rutas | ROAD preview correlacionado; no edición de route global | Luis / Juan | PARTIAL |
| RouteLeg | Rutas | Tramos del preview ROAD, sin puentes inventados | Juan | PARTIAL |
| RouteCondition | Rutas | Mapa / routing/conditions publicado | Juan | PARTIAL |
| RouteWaypoint | Rutas | Preview declarado; no puntos inventados | Juan | PARTIAL |
| RoutePlanningPolicy | Rutas | Motor/política de backend; sin editor FE nuevo | Cristhian / Luis | NOT AVAILABLE FE nuevo |
| TransportPlanCandidate | Planes | Checks/candidatos de serviceability; no creador de planes nuevo | Luis / Juan | PARTIAL |
| PlanResource | Planes | No UI nueva de asignación por plan; se preserva dominio existente | Luis | NOT AVAILABLE FE nuevo |
| CarrierOpportunity | Comercial | Carrier / opportunities y responses | Juan | PARTIAL |
| CarrierOffer | Comercial | MANUAL atribuible, supersedesOfferId, withdrawals | Juan | PARTIAL |
| RankedOption | Comercial | Ranking shipper de HAC-42; no ranking FE inventado | Luis | NOT AVAILABLE FE nuevo |
| ScoringPolicy | Comercial | Política determinística backend; no pesos frontend inventados | Cristhian / Luis | NOT AVAILABLE FE nuevo |
| Booking | Booking | Carrier / bookings, confirm/cancel; no autorización shipper inventada | Juan / Luis | PARTIAL |
| TransportExecution | Seguimiento | Carrier / executions y comandos, posición registrada | Juan | PARTIAL |
| OperationalIncident | Seguimiento | Carrier / executions/{id}/incidents | Juan | PARTIAL |
| IncidentUpdate | Seguimiento | Carrier / incidents/{id}/updates | Juan | PARTIAL |
| LogisticsNode | Rutas | Mapa / routing/nodes publicados | Juan | PARTIAL |
| RouteCorridor | Rutas | Lanes y límites; sin geometría de corridor inventada | Juan / Luis | PARTIAL |
| CargoProfile | Catálogo | Catálogo shipper actual; sin CRUD nuevo | Luis | NOT AVAILABLE FE nuevo |
| CargoCategory | Catálogo | Opciones del intake actual; sin catálogo carrier paralelo | Luis | PARTIAL |
| LoadAllocation | Planes | Asignaciones de plan en flujo shipper; sin editor FE nuevo | Luis | NOT AVAILABLE FE nuevo |
| OrganizationMember | Identidad | Sesión y permisos server; sin autoservicio de grants | Axel | BLOCKED |
| McpAccountLink | Identidad | No UI nueva ni cuenta MCP inventada | Axel | NOT AVAILABLE |
| RepositioningBlock | Flota | Flota / repositioning-blocks | Juan | PARTIAL |
| OrganizationPreferences | Identidad | Ownership shipper; no editor FE nuevo | Luis | NOT AVAILABLE FE nuevo |
| CarrierMetric | Comercial | Carrier / metrics y revisión; no KPI inventado | Juan | PARTIAL |
| VehicleCombination | Flota | Flota / vehicle-combinations | Juan | PARTIAL |
| ServiceArea | Cobertura | Red / areas y geometría registrada en mapa | Juan | PARTIAL |
| FulfilmentPartner | Catálogo | Red / partners; no cobertura inferida desde socio | Juan | PARTIAL |
| PlanLegAssignment | Planes | Plan del shipper; no mutación FE nueva | Luis | NOT AVAILABLE FE nuevo |
| OfferCostComponent | Comercial | Desglose embebido de oferta, confirmado antes de envío | Juan | PARTIAL |
| ShipmentContact | Solicitud | Contactos del intake existente | Luis | PARTIAL |
| CarrierOperator | Identidad | Referencia/grant administrado; identidad/issuer depende de HAC-41 | Axel | BLOCKED |
| AssetCargoCapability | Flota | Flota / asset-capabilities y capability-definitions | Juan | PARTIAL |
| RouteSimulationScenario | Escenario | Fixtures externos QA explícitos; ninguna simulación como dato de producción | Cristhian / QA | NOT AVAILABLE PRODUCTO |
| RoutePlanner | Rutas | Lógica backend; no heurística FE ni cobertura ficticia | Cristhian / Luis | NOT AVAILABLE FE nuevo |
| SelectionDecision | Comercial | Flujo shipper HAC-42; no decisión ni booking duplicado | Luis | NOT AVAILABLE FE nuevo |

## Relaciones y campos

- Forms usan schemas cerrados, versiones esperadas, referencias y validación cruzada nativas. La presencia del campo en el formulario no prueba que su FK exista o sea accesible en DB.
- Depots y ServiceArea no se confunden; ubicaciones de sede no crean cobertura. ServiceLane se dirige entre áreas registradas.
- Asset / CapacityPool / Combination son recursos diferentes. Capacidad de carga no implica disponibilidad y un recurso AUXILIARY no añade carga útil.
- CarrierOffer, Booking y CapacityReservation no se derivan de un click de mapa. Precio, fuente, evidencia y autorizaciones permanecen en sus contratos.
- Las relaciones de identidad CarrierOperator/OrganizationMember/issuer requieren resolución y QA de HAC-41; no hay grants autogenerados en FE.
- La discrepancia documental de PlanResource/Reservation triple-null permanece contexto de backend/DER; no se cambia el schema para aceptar un formulario falso.
- Condiciones simuladas conservan SIMULATED. Geometría ausente o UNKNOWN no se convierte en ruta.

## Evidencia pendiente

Dataset completo autorizado, permisos positivos/negativos, persistencia, oferta propia recuperada por el shipper, reservas/ejecución/incidentes, geometría publicada y pasada final ES/EN/móvil. Ver [reporte](HAC43_LOCAL_PRODUCT_REFINEMENT.md).
