import { CatalogInputsV2, type CatalogKindV2 } from "@/shared/schemas/v2/catalog";
import { WorkflowInputsV2, type WorkflowActionV2 } from "@/shared/schemas/v2/workflow";
import type { ZodTypeAny } from "zod";

export type PortalSection = "overview" | "network" | "fleet" | "commercial" | "operations" | "map" | "help";
export type PortalResource = { key: string; es: string; en: string; section: PortalSection;
  family: "catalog" | "workflow"; path: string; schema?: ZodTypeAny; parent?: "service" | "execution" | "incident" | "asset";
  actions?: Array<{ action: WorkflowActionV2; suffix: string; es: string; en: string }> };
const catalog = (key: CatalogKindV2, es: string, en: string, section: PortalSection,
  path: string = key, parent?: PortalResource["parent"]): PortalResource => ({
  key, es, en, section, path, parent, family: "catalog", schema: CatalogInputsV2[key] });
const action = (action: WorkflowActionV2, suffix: string, es: string, en: string) => ({ action, suffix, es, en });
export const carrierResources: PortalResource[] = [
  catalog("depots", "Depósitos", "Depots", "network"),
  catalog("services", "Servicios", "Services", "network"),
  catalog("areas", "Cobertura", "Coverage", "network", "services/{parent}/areas", "service"),
  catalog("lanes", "Corredores de servicio", "Service lanes", "network", "services/{parent}/lanes", "service"),
  catalog("partners", "Socios", "Partners", "network"),
  {key:"limits",es:"Límites de ruta",en:"Route limits",section:"network",family:"workflow",path:"route-limits",schema:WorkflowInputsV2["limits.publish"]},
  catalog("assets", "Vehículos y activos", "Vehicles and assets", "fleet"),
  catalog("vehicle-combinations", "Combinaciones", "Combinations", "fleet"),
  catalog("drivers", "Conductores", "Drivers", "fleet"),
  catalog("capacity-pools", "Cupos", "Capacity pools", "fleet"),
  catalog("calendars", "Calendarios", "Calendars", "fleet"),
  catalog("driver-assignments", "Asignaciones de conductor", "Driver assignments", "fleet"),
  catalog("vehicle-assignments", "Asignaciones de vehículo", "Vehicle assignments", "fleet"),
  catalog("maintenances", "Mantenimiento", "Maintenance", "fleet"),
  catalog("repositioning-blocks", "Reposicionamiento", "Repositioning", "fleet"),
  catalog("asset-capabilities", "Capacidades de carga", "Cargo capabilities", "fleet"),
  catalog("capability-definitions", "Definiciones de capacidad", "Capability definitions", "fleet"),
  { key: "opportunities", es: "Oportunidades", en: "Opportunities", section: "commercial", family: "workflow", path: "opportunities",
    actions: [action("opportunities.respond", "responses", "Responder", "Respond")] },
  { key: "offers", es: "Ofertas", en: "Offers", section: "commercial", family: "workflow", path: "offers",
    actions: [action("offers.withdraw", "withdrawals", "Retirar oferta", "Withdraw offer")] },
  {key:"metrics",es:"Métricas registradas",en:"Recorded metrics",section:"commercial",family:"workflow",path:"metrics",schema:WorkflowInputsV2["metrics.publish"]},
  { key: "bookings", es: "Bookings", en: "Bookings", section: "operations", family: "workflow", path: "bookings",
    actions: [action("bookings.confirm", "confirmations", "Confirmar o rechazar", "Confirm or reject"),
      action("bookings.cancel", "cancellations", "Cancelar booking", "Cancel booking")] },
  { key: "holds", es: "Reservas de capacidad", en: "Capacity reservations", section: "operations", family: "workflow", path: "capacity/holds",
    actions: [action("holds.confirm", "confirmations", "Confirmar reserva", "Confirm reservation"),
      action("holds.release", "releases", "Liberar reserva", "Release reservation")] },
  { key: "executions", es: "Operaciones", en: "Operations", section: "operations", family: "workflow", path: "executions",
    actions: [action("executions.start", "starts", "Iniciar", "Start"), action("executions.complete", "completions", "Completar", "Complete"),
      action("executions.cancel", "cancellations", "Cancelar", "Cancel"), action("executions.position", "positions", "Registrar posición", "Record position")] },
  { key: "incidents", es: "Incidentes", en: "Incidents", section: "operations", family: "workflow",
    path: "executions/{parent}/incidents", parent: "execution", schema: WorkflowInputsV2["incidents.create"],
    actions: [action("incidents.update", "updates", "Actualizar incidente", "Update incident")] },
  { key: "execution-events", es: "Historial de operación", en: "Operation history", section: "operations", family: "workflow",
    path: "executions/{parent}/events", parent: "execution" },
  { key: "incident-updates", es: "Historial del incidente", en: "Incident history", section: "operations", family: "workflow",
    path: "incidents/{parent}/updates", parent: "incident" },
  { key: "consolidations", es: "Viajes consolidados LTL", en: "Consolidated LTL trips", section: "operations", family: "workflow",
    path: "consolidations", schema: WorkflowInputsV2["consolidations.create"],
    actions: [action("consolidations.start", "starts", "Iniciar viaje", "Start trip"),
      action("consolidations.complete", "completions", "Completar viaje", "Complete trip"),
      action("consolidations.cancel", "cancellations", "Cancelar viaje", "Cancel trip"),
      action("consolidations.close", "closures", "Cerrar", "Close"),
      action("consolidations.position", "positions", "Registrar posición", "Record position")] },
  { key: "asset-events", es: "Eventos del activo", en: "Asset events", section: "fleet", family: "workflow",
    path: "assets/{parent}/events", parent: "asset", schema: WorkflowInputsV2["asset-events.create"] },
];
export function resourcePath(carrierId: string, resource: PortalResource, parentId: string) {
  return (resource.family === "catalog" ? "/api/v2/carrier-portal/carriers/" : "/api/v2/carriers/") + encodeURIComponent(carrierId) + "/" + resource.path.replace("{parent}", encodeURIComponent(parentId));
}
