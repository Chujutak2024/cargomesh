import type { FreightRequestV2Data } from "@/features/v2-intake/contracts";
import { localeTag, type Locale } from "@/features/i18n/config";
import { displayReference } from "@/shared/lib/display-identity";
import { formatDateTime, formatMass, requestStatusLabel, requestStatusTone } from "./shipper-model";

export type DashboardActivityItem = {
  id: string; reference: string; fullReference: string; date: string; route: string;
  facilities: string; cargo: string; description: string;
  status: FreightRequestV2Data["status"]; statusLabel: string; tone: string;
};

/** Presentation of authorized records only; never reuse their quote, capacity or dates. */
export function dashboardRequests(requests: FreightRequestV2Data[], locale: Locale) {
  const tag = localeTag(locale);
  const ordered = [...requests].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || a.id.localeCompare(b.id));
  const project = (request: FreightRequestV2Data): DashboardActivityItem => ({
    id: request.id, reference: displayReference(request.referenceCode, "PED", request.id), fullReference: request.referenceCode,
    date: formatDateTime(request.updatedAt, tag), route: `${request.origin.city} → ${request.destination.city}`,
    facilities: `${request.origin.label} → ${request.destination.label}`,
    cargo: `${formatMass(request.cargoSpecification.totalWeightKg, tag)} · ${request.cargoSpecification.totalVolumeM3.toLocaleString(tag)} m³`,
    description: request.cargoSpecification.description, status: request.status,
    statusLabel: requestStatusLabel(request.status, locale), tone: requestStatusTone(request.status),
  });
  const draft = ordered.find(request => request.status === "DRAFT");
  return { recent: ordered.slice(0, 6).map(project), draft: draft ? project(draft) : null };
}
