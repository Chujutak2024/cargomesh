import { z } from "zod";
import { createV2ServerSupabaseClient } from "@/server/db/supabase/v2";
import { TimeWindowV2Schema } from "@/shared/schemas/v2/freight-request";
import type { Area, Capacity, RoadService, Window } from "../domain/evaluate-road";

type Client = Awaited<ReturnType<typeof createV2ServerSupabaseClient>>;
type QueryRows<T> = { data: T[] | null; error: { code: string; message: string } | null };

function rows<T>(result: QueryRows<T>): T[] {
  if (result.error) throw new Error(`V2_ROAD_DB_ERROR: ${result.error.code}`);
  return result.data ?? [];
}

function windows(value: unknown): Window[] | null {
  const parsed = TimeWindowV2Schema.array().safeParse(value);
  return parsed.success ? parsed.data : null;
}

function byId<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

/** Reads every active ROAD service; never uses the V1 three-carrier allowlist. */
export async function loadRoadServices(db: Client): Promise<RoadService[]> {
  const serviceRows = rows(await db.from("carrier_services").select("*")
    .eq("transport_mode", "ROAD").eq("active", true).order("id"));
  if (!serviceRows.length) return [];
  const serviceIds = serviceRows.map((service) => service.id);
  const carrierIds = [...new Set(serviceRows.map((service) => service.carrier_id))];
  const [carriersResult, categoriesResult, serviceCategoriesResult, areasResult,
    lanesResult, assetsResult, poolsResult, partnersResult, definitionsResult] = await Promise.all([
    db.from("carriers").select("id,code,name,status").in("id", carrierIds),
    db.from("cargo_categories").select("id,code").eq("active", true),
    db.from("carrier_service_cargo_categories").select("carrier_service_id,cargo_category_id")
      .in("carrier_service_id", serviceIds),
    db.from("service_areas").select("*").in("carrier_service_id", serviceIds),
    db.from("service_lanes").select("*").in("carrier_service_id", serviceIds),
    db.from("transport_assets")
      .select("id,carrier_id,carrier_service_id,equipment_code,asset_role,max_weight_kg,max_volume_m3,active,fleet_managed,evidence,fulfilment_source,fulfilment_partner_id")
      .in("carrier_service_id", serviceIds).eq("active", true),
    db.from("capacity_pools")
      .select("id,carrier_id,carrier_service_id,equipment_code,max_weight_kg,max_volume_m3,supported_cargo_category_ids,active,starts_at,ends_at,evidence,fulfilment_source,fulfilment_partner_id")
      .in("carrier_service_id", serviceIds).eq("active", true),
    db.from("fulfilment_partners").select("id,status,agreement_valid_from,agreement_valid_until")
      .in("carrier_id", carrierIds),
    db.from("cargo_capability_definitions").select("id,requirements,max_weight_kg,active"),
  ]);
  const carriers = byId(rows(carriersResult));
  const categories = byId(rows(categoriesResult));
  const serviceCategories = rows(serviceCategoriesResult);
  const areaRows = rows(areasResult);
  const laneRows = rows(lanesResult);
  const assets = rows(assetsResult);
  const pools = rows(poolsResult);
  const partners = byId(rows(partnersResult));
  const definitions = byId(rows(definitionsResult));
  const assetIds = assets.map((asset) => asset.id);
  const sourceIds = [...assetIds, ...pools.map((pool) => pool.id)];
  const [assetCapabilitiesResult, calendarsResult, maintenancesResult] = await Promise.all([
    assetIds.length
      ? db.from("asset_cargo_capabilities")
        .select("transport_asset_id,cargo_category_id,temperature_min_c,temperature_max_c,certifications,definition_id,evidence,verified_at,valid_until")
        .in("transport_asset_id", assetIds).eq("active", true)
      : Promise.resolve({ data: [], error: null }),
    sourceIds.length
      ? db.from("capacity_calendars")
        .select("id,carrier_service_id,transport_asset_id,capacity_pool_id,complete,available_windows,source_reference,provenance_status,observed_at,valid_until,ready_pickup_area_id,version,updated_at")
        .in("carrier_service_id", serviceIds)
      : Promise.resolve({ data: [], error: null }),
    assetIds.length
      ? db.from("scheduled_maintenances").select("transport_asset_id,starts_at,ends_at")
        .in("transport_asset_id", assetIds).in("status", ["SCHEDULED", "IN_PROGRESS"])
      : Promise.resolve({ data: [], error: null }),
  ]);
  const assetCapabilities = rows(assetCapabilitiesResult);
  const calendars = rows(calendarsResult);
  const maintenances = rows(maintenancesResult);
  const calendarIds = calendars.map((calendar) => calendar.id);
  const [reservationsResult, repositioningResult] = await Promise.all([
    calendarIds.length
      ? db.from("capacity_reservations").select("capacity_calendar_id,starts_at,ends_at,status")
        .in("capacity_calendar_id", calendarIds).in("status", ["HELD", "CONFIRMED"])
      : Promise.resolve({ data: [], error: null }),
    calendarIds.length
      ? db.from("repositioning_blocks").select("capacity_calendar_id,starts_at,ends_at")
        .in("capacity_calendar_id", calendarIds).in("status", ["PLANNED", "IN_PROGRESS"])
      : Promise.resolve({ data: [], error: null }),
  ]);
  const reservations = rows(reservationsResult);
  const repositioning = rows(repositioningResult);

  const makeCalendar = (sourceId: string, isAsset: boolean): Capacity["calendar"] => {
    const calendar = calendars.find((item) => isAsset
      ? item.transport_asset_id === sourceId : item.capacity_pool_id === sourceId);
    if (!calendar) return null;
    const availableWindows = windows(calendar.available_windows);
    if (!availableWindows) return null; // Malformed evidence must not yield eligible.
    return {
      validUntil: calendar.valid_until,
      readyPickupAreaId: calendar.ready_pickup_area_id,
      provenanceStatus: z.enum(["VERIFIED", "ESTIMATED", "SIMULATED", "UNKNOWN"])
        .parse(calendar.provenance_status),
      complete: calendar.complete,
      availableWindows,
      reservations: reservations.filter((item) => item.capacity_calendar_id === calendar.id)
        .map((item) => ({ startsAt: item.starts_at, endsAt: item.ends_at })),
      maintenance: isAsset
        ? maintenances.filter((item) => item.transport_asset_id === sourceId)
          .map((item) => ({ startsAt: item.starts_at, endsAt: item.ends_at })) : [],
      repositioning: repositioning.filter((item) => item.capacity_calendar_id === calendar.id)
        .map((item) => ({ startsAt: item.starts_at, endsAt: item.ends_at })),
    };
  };

  return serviceRows.filter((service) => carriers.get(service.carrier_id)?.status === "ACTIVE")
    .map((service): RoadService => {
      const carrier = carriers.get(service.carrier_id)!;
      const serviceAreas: Area[] = areaRows.filter((area) => area.carrier_service_id === service.id)
        .map((area) => ({
          id: area.id,
          role: z.enum(["PICKUP", "DELIVERY"]).parse(area.area_role),
          coverage: z.enum(["INCLUDE", "EXCLUDE"]).parse(area.coverage),
          granularity: z.enum(["COUNTRY", "REGION", "CITY", "POSTAL_CODE", "POLYGON", "POINTS"]).parse(area.granularity),
          location: {
            countryCode: area.country_code, regionCode: area.region_code,
            city: area.city, postalCode: area.postal_code,
          },
          active: area.active, validFrom: area.valid_from, validUntil: area.valid_until,
          evidenceAvailable: Boolean(area.evidence_reference && area.verified_at && area.valid_from),
          partnerAgreement: area.fulfilment_source === "PARTNER" ? (() => {
            const partner = area.fulfilment_partner_id ? partners.get(area.fulfilment_partner_id) : undefined;
            return partner ? { status: partner.status, startsAt: partner.agreement_valid_from,
              endsAt: partner.agreement_valid_until } : null;
          })() : undefined,
        }));
      const capacities: Capacity[] = [
        ...assets.filter((asset) => asset.carrier_service_id === service.id).map((asset) => {
          const calendar = calendars.find((item) => item.transport_asset_id === asset.id);
          const capabilityRows = assetCapabilities.filter((item) => item.transport_asset_id === asset.id);
          return {
            id: asset.id, sourceType: "TRANSPORT_ASSET" as const,
            calendarId: calendar?.id ?? null,
            dataSource: calendar?.source_reference ?? "MISSING_CALENDAR_WINDOW",
            observedAt: calendar?.observed_at ?? null,
            role: z.enum(["CARRIER", "ESCORT"]).parse(asset.asset_role),
            equipmentCode: asset.equipment_code,
            cargoCategoryCodes: capabilityRows.length
              ? capabilityRows.map((item) => categories.get(item.cargo_category_id)?.code)
                .filter((code): code is string => Boolean(code)) : null,
            cargoCapabilities: capabilityRows.flatMap((item) => {
              const categoryCode = categories.get(item.cargo_category_id)?.code;
              if (!categoryCode) return [];
              const certifications = z.array(z.string()).safeParse(item.certifications);
              return [{ categoryCode,
                certifications: certifications.success ? certifications.data : null,
                temperatureMinC: item.temperature_min_c,
                temperatureMaxC: item.temperature_max_c,
                ...(item.definition_id ? {
                  maxWeightKg: definitions.get(item.definition_id)?.max_weight_kg ?? null,
                  evidenceAvailable: Boolean(item.evidence && item.verified_at && definitions.get(item.definition_id)?.active),
                  validUntil: item.valid_until,
                  requirements: z.array(z.string()).parse(definitions.get(item.definition_id)?.requirements ?? []),
                } : {}) }];
            }),
            maxWeightKg: asset.max_weight_kg, maxVolumeM3: asset.max_volume_m3,
            ...(asset.fleet_managed ? {
              sourceEvidenceAvailable: Boolean(asset.evidence && (asset.fulfilment_source !== "PARTNER"
                || (asset.fulfilment_partner_id && partners.get(asset.fulfilment_partner_id)?.status === "ACTIVE"))),
              ...(asset.fulfilment_source === "PARTNER" ? {
                sourceWindow: asset.fulfilment_partner_id && partners.get(asset.fulfilment_partner_id) ? {
                  startsAt: partners.get(asset.fulfilment_partner_id)!.agreement_valid_from,
                  endsAt: partners.get(asset.fulfilment_partner_id)!.agreement_valid_until,
                } : null,
              } : {}),
            } : {}),
            calendar: makeCalendar(asset.id, true),
          };
        }),
        ...pools.filter((pool) => pool.carrier_service_id === service.id).map((pool) => {
          const calendar = calendars.find((item) => item.capacity_pool_id === pool.id);
          return {
            id: pool.id, sourceType: "CAPACITY_POOL" as const,
            calendarId: calendar?.id ?? null,
            dataSource: calendar?.source_reference ?? "MISSING_CALENDAR_WINDOW",
            observedAt: calendar?.observed_at ?? null,
            role: "CARRIER" as const, equipmentCode: pool.equipment_code,
            cargoCategoryCodes: pool.supported_cargo_category_ids.length
              ? pool.supported_cargo_category_ids.map((id) => categories.get(id)?.code)
                .filter((code): code is string => Boolean(code)) : null,
            cargoCapabilities: null,
            maxWeightKg: pool.max_weight_kg, maxVolumeM3: pool.max_volume_m3,
            sourceWindow: pool.starts_at && pool.ends_at ? { startsAt: pool.starts_at, endsAt: pool.ends_at } : null,
            sourceEvidenceAvailable: Boolean(pool.evidence && pool.fulfilment_source && (pool.fulfilment_source !== "PARTNER"
              || (pool.fulfilment_partner_id && partners.get(pool.fulfilment_partner_id)?.status === "ACTIVE"
                && pool.starts_at && pool.ends_at
                && Date.parse(partners.get(pool.fulfilment_partner_id)!.agreement_valid_from) <= Date.parse(pool.starts_at)
                && Date.parse(partners.get(pool.fulfilment_partner_id)!.agreement_valid_until) >= Date.parse(pool.ends_at)))),
            calendar: makeCalendar(pool.id, false),
          };
        }),
      ];
      const supportedCategories = serviceCategories
        .filter((item) => item.carrier_service_id === service.id)
        .map((item) => categories.get(item.cargo_category_id)?.code)
        .filter((code): code is string => Boolean(code));
      return {
        id: service.id, carrierId: carrier.id,
        carrierCode: carrier.code, carrierName: carrier.name,
        serviceCode: service.provider_service_code ?? service.id,
        serviceClass: service.service_type, responseChannels: [],
        mode: "ROAD", active: service.active,
        supportedCargoCategoryCodes: supportedCategories.length ? supportedCategories : null,
        maxWeightKg: service.max_capacity_kg, maxVolumeM3: service.max_volume_m3,
        areas: serviceAreas,
        lanes: laneRows.filter((lane) => lane.carrier_service_id === service.id).map((lane) => ({
          id: lane.id, kind: z.enum(["DIRECT", "WITHIN_AREA"]).parse(lane.lane_kind),
          borderReviewRequired: lane.cross_border_review_required,
          crossBorderProhibited: lane.cross_border_prohibited,
          plannedTransitMinutes: lane.planned_transit_minutes,
          transitProvenanceStatus: z.enum(["VERIFIED", "ESTIMATED", "SIMULATED", "UNKNOWN"])
            .parse(lane.transit_provenance_status),
          pickupAreaId: lane.pickup_area_id, deliveryAreaId: lane.delivery_area_id,
          active: lane.active, validFrom: lane.valid_from, validUntil: lane.valid_until,
          evidenceAvailable: Boolean(lane.evidence_reference && lane.verified_at && lane.valid_from),
        })),
        capacities,
      };
    });
}
