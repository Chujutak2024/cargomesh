import {fleetCardIdentity} from "./fleet-card-identity";
import type { TruckVisualType } from "@/features/logistics-3d/truck-model";
import { facilities, findRoadLocation } from "@/features/v2-workspace/road-locations";
import type { MapPresentation } from "@/features/v2-road-map/road-map-model";
import type { FleetVehicle } from "./fleet-model";
import type { LocalDraft } from "./local-draft-model";
import { carrierCovers, vehicleCarrierId, type Carrier, type CarrierSite } from "./operations-model";
import { truckLabel } from "./local-truck-preference";
import { fleetReferencePhoto } from "./fleet-photos";
import { localRequestReference } from "./local-request-presentation";

export type DepotContext = { name: string; city: string; carrier: string | null; color: string; site: CarrierSite | null; planned: boolean };
export type TruckInspectionContext = {
  id: string; title: string; subtitle: string; variant?: TruckVisualType; modelAssetId?: string | null;
  visualDesignId?: string; visualDesignName?: string;
  technicalReferences?: {label:string;value:string}[];
  custom: boolean; photo: string; photoReference: boolean; status: string; statusCode?: FleetVehicle['status'];
  facts: { key?: string; label: string; value: string }[]; routeDraft: LocalDraft | null;
  origin: string; destination: string; map: MapPresentation; depot: DepotContext;
  detailHref?: string;
};
const emptyMap = (): MapPresentation => ({ selectedCandidate: null, markers: [], paths: [], provenanceStatus: "UNKNOWN", geometrySource: null, distanceKm: null, estimatedTransitHours: null });
const city = (value: string) => (value.split("·").at(-1) ?? value).split(",")[0].trim();
const locationId = (value: string) => facilities.find(point => point.city.toLocaleLowerCase() === city(value).toLocaleLowerCase())?.id;

/** A destination visual never implies a booking or expands the explicit carrier lanes. */
export function requestDepot(draft: LocalDraft, carriers: Carrier[], carrierId?: string | null): DepotContext {
  const destination = findRoadLocation(draft.destinationId)?.city ?? draft.destinationId;
  const choices = carriers.filter(c => (!carrierId || c.id === carrierId) && carrierCovers(c, draft.originId, draft.destinationId));
  for (const carrier of choices) {
    const site = carrier.sites.find(site => site.city === destination);
    if (site) return { name: site.name, city: destination, carrier: carrier.name, color: carrier.color, site, planned: true };
  }
  return { name: "Centro de llegada", city: destination, carrier: null, color: "#0a9292", site: null, planned: true };
}
export function inspectRequest(draft: LocalDraft, id: string, carriers: Carrier[], vehicle?: FleetVehicle, carrierId?: string | null): TruckInspectionContext {
  const preferred = vehicle ? { type: vehicle.variant, model: vehicle.model ?? "", photoDataUrl: vehicle.photoDataUrl ?? null } : draft.truckPreference;
  const variant = preferred?.type === "custom" ? undefined : preferred?.type ?? "articulated";
  const origin = findRoadLocation(draft.originId)?.city ?? draft.originId, destination = findRoadLocation(draft.destinationId)?.city ?? draft.destinationId;
  return { id, title: vehicle ? fleetCardIdentity(vehicle).title : truckLabel(preferred, "es"), subtitle: localRequestReference(id),
    variant, custom: preferred?.type === "custom", modelAssetId: draft.truckPreference?.type === "custom" && !vehicle ? draft.truckPreference.modelAssetId : null,
    photo: vehicle ? fleetReferencePhoto(vehicle).src : preferred?.photoDataUrl ?? `/v2-workspace/trucks/${variant ?? "articulated"}-3d.png`,
    photoReference: !!vehicle && !vehicle.photoDataUrl, status: vehicle ? "Unidad programada" : "Preferencia de la solicitud",
    facts: [
      { label: "Carga", value: draft.cargoDescription || "Por definir" },
      { label: "Peso total", value: `${(draft.quantity * draft.unitWeightKg).toLocaleString("es-PE")} kg` },
      { label: "Unidades", value: String(draft.quantity) },
      ...(vehicle ? [{ label: "Placa", value: vehicle.plate ?? "Sin registro" }, { label: "Capacidad de carga", value: `${vehicle.capacityKg.toLocaleString("es-PE")} kg` }, { label: "Conductor", value: vehicle.driverProfile?.name ?? vehicle.driver ?? "Por asignar" }] : []),
      { label: "Recogida", value: draft.pickupDate ? new Date(draft.pickupDate + "T12:00:00").toLocaleDateString("es-PE") : "Por definir" },
      { label: "Entrega", value: draft.deliveryDate ? new Date(draft.deliveryDate + "T12:00:00").toLocaleDateString("es-PE") : "Por definir" },
    ], origin, destination, routeDraft: draft, map: emptyMap(), depot: requestDepot(draft, carriers, carrierId), detailHref: vehicle ? `#/fleet/vehicle/${vehicle.id}` : undefined };
}
export function inspectFleet(vehicle: FleetVehicle, carriers: Carrier[]): TruckInspectionContext {
  const origin = vehicle.journey?.origin ?? vehicle.location ?? vehicle.depot ?? "Origen sin registrar", destination = vehicle.journey?.destination ?? vehicle.depot ?? "Destino sin registrar";
  const originId = locationId(origin), destinationId = locationId(destination);
  const routeDraft: LocalDraft | null = vehicle.journey && originId && destinationId && originId !== destinationId ? { originId, destinationId, cargoDescription: vehicle.description ?? "", quantity: 0, unitWeightKg: 0, pickupDate: "", deliveryDate: "", completedStep: 0, savedForReview: false, truckPreference: { type: vehicle.variant, model: vehicle.model ?? "", photoDataUrl: null } } : null;
  const map = emptyMap(), from = originId ? findRoadLocation(originId) : vehicle.coordinates, to = destinationId ? findRoadLocation(destinationId) : null;
  if (from) map.markers.push({ kind: "origin", point: { lat: from.lat, lng: from.lng }, label: originId ? origin : vehicle.location ?? "Última posición registrada" });
  if (to) map.markers.push({ kind: "destination", point: { lat: to.lat, lng: to.lng }, label: destination });
  // Service records must never be joined to local fixture carriers by a guessed ID.
  const carrier = vehicle.source === "EXAMPLE" ? carriers.find(c => c.id === vehicleCarrierId(vehicle)) : null;
  const site = carrier?.sites.find(s => vehicle.siteId ? s.id === vehicle.siteId : s.name === vehicle.depot || s.city === city(vehicle.depot ?? "")) ?? null;
  const depot: DepotContext = vehicle.journey ? routeDraft
    ? requestDepot(routeDraft, vehicle.source === "EXAMPLE" ? carriers : [], carrier?.id)
    : { name: "Centro de llegada", city: city(destination), carrier: null, color: carrier?.color ?? "#0a9292", site: null, planned: true }
    : { name: site?.name ?? vehicle.depot ?? "Sede del camión", city: site?.city ?? city(vehicle.location ?? vehicle.depot ?? destination), carrier: site ? carrier?.name ?? null : null, color: carrier?.color ?? "#0a9292", site, planned: false };
  const statuses = { AVAILABLE: "Disponible", IN_SERVICE: "En servicio", MAINTENANCE: "En mantenimiento", OUT_OF_SERVICE: "Fuera de servicio" };
  return { id: vehicle.id, title: fleetCardIdentity(vehicle).title, subtitle: vehicle.body, variant: vehicle.variant, custom: false,
    visualDesignId: vehicle.visual?.designId, visualDesignName: vehicle.visual?.name,
    photo: fleetReferencePhoto(vehicle).src, photoReference: !vehicle.photoDataUrl, status: statuses[vehicle.status], statusCode: vehicle.status, routeDraft, map, origin, destination,
    technicalReferences:[{label:'Record ID',value:vehicle.id},{label:'Internal code',value:vehicle.code},...(vehicle.model?[{label:'Original recorded model',value:vehicle.model}]:[]),...(vehicle.serviceId?[{label:'Service ID',value:vehicle.serviceId}]:[])],
    facts: [{ key: "model", label: "Marca y modelo", value: fleetCardIdentity(vehicle).model || "Sin registro" }, { key: "plate", label: "Placa", value: vehicle.plate ?? "Sin registro" }, { key: "capacity", label: "Capacidad de carga", value: `${vehicle.capacityKg.toLocaleString("es-PE")} kg` },
      { key: "driver", label: vehicle.driverProfileRole === "regular" ? "Conductor habitual" : "Conductor asignado", value: vehicle.driverProfile?.name ?? vehicle.driver ?? "Por asignar" },
      { key: "fuel", label: "Combustible", value: vehicle.fuelPercent === null ? "Sin lectura" : `${vehicle.fuelPercent}%` },
      { key: "odometer", label: "Odómetro", value: vehicle.odometerKm === null ? "Sin lectura" : `${vehicle.odometerKm.toLocaleString("es-PE")} km` },
      { key: "updated", label: "Última actualización", value: new Date(vehicle.updatedAt).toLocaleDateString("es-PE") }],
    depot, detailHref: `#/fleet/vehicle/${vehicle.id}` };
}
