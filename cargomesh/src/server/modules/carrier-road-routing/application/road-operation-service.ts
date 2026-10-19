import { createHash } from 'node:crypto';
import { CatalogInputsV2, parseCatalogRecordV2, type CatalogKindV2, type CatalogRecordV2 } from '@/shared/schemas/v2/catalog';
import { FleetOutputsV2 } from '@/shared/schemas/v2/fleet';
import { CrewInputsV2 } from '@/shared/schemas/v2/crew';
import { RoadOperationInputV2Schema, RoadOperationAssessmentV2Schema, type OperationDecisionV2 } from '@/shared/schemas/v2/road-operation';
import { CarrierRoadAssessmentV2Schema } from '@/shared/schemas/v2/carrier-road-routing';
import { CarrierOperationalAssessmentV2Schema } from '@/shared/schemas/v2/operational-assessment';
import type { CarrierOperationalAssessmentService } from '../../fleet/application/operational-assessment-service';
import { V2DraftError } from '../../freight-requests/application/draft-service';
import type { CarrierRoadService, CoverageCatalogReader, RoadActor } from './carrier-road-service';
import { buildOperationTimeline, combineOperationDecisions, evaluateOperationCargo } from '../domain/operation-policy';

const hash = (rows: unknown) => createHash('sha256').update(JSON.stringify(rows)).digest('hex');
export class RoadOperationService {
  constructor(private readonly catalog: CoverageCatalogReader,
    private readonly road: Pick<CarrierRoadService, 'assess'>,
    private readonly operations: Pick<CarrierOperationalAssessmentService, 'assess'>,
    private readonly clock: () => string = () => new Date().toISOString()) {}

  async assess(actor: RoadActor, raw: unknown) {
    const input = RoadOperationInputV2Schema.parse(raw), startedAt = this.clock(), serviceId = input.road.serviceId;
    const scope = { carrierId: actor.carrierId, serviceId };
    const checked = (kind: CatalogKindV2, rawRow: unknown, expectedId?: string, requireService = true) => {
      const row = parseCatalogRecordV2(kind, rawRow);
      const valueScope = typeof row.value === 'object' && row.value !== null && 'serviceId' in row.value ? row.value.serviceId : serviceId;
      if (row.carrierId !== actor.carrierId || row.organizationId !== null
        || (kind !== 'services' && valueScope !== row.serviceId)
        || (requireService && kind !== 'services' && row.serviceId !== serviceId) || expectedId !== undefined && row.id !== expectedId)
        throw new V2DraftError('FORBIDDEN_CATALOG', 'Catalog scope mismatch.', 403);
      return row;
    };
    const snapshot = async () => {
      const get = async (kind: 'assets' | 'drivers' | 'services', id: string) => checked(kind,
        (await this.catalog.get(actor, kind, { ...scope, serviceId: null }, id)).data, id);
      const [asset, driver, service] = await Promise.all([get('assets', input.assetId), get('drivers', input.driverId), get('services', serviceId)]);
      const list = async (kind: 'asset-capabilities' | 'capability-definitions') => {
        const rows: CatalogRecordV2[] = [];
        for (let offset = 0; offset < 1000; offset += 100) {
          // Carrier RPC accepts a service scope only for areas/lanes. Filter fleet rows after the authenticated carrier read.
          const page = await this.catalog.list(actor, kind, { ...scope, serviceId: null }, { limit: 100, offset });
          if (page.data.length > 100 || page.meta.offset !== offset || page.meta.limit !== 100
            || page.meta.nextOffset !== null && page.meta.nextOffset !== offset + 100)
            throw new V2DraftError('INVALID_CATALOG_RESPONSE', 'Invalid capability page.', 502);
          rows.push(...page.data.map(row => checked(kind, row, undefined, false)));
          if (new Set(rows.map(row => row.id)).size !== rows.length)
            throw new V2DraftError('INVALID_CATALOG_RESPONSE', 'Duplicate capability identity.', 502);
          if (page.meta.nextOffset === null) return { rows: rows.filter(row => row.serviceId === serviceId).sort((a, b) => a.id.localeCompare(b.id)), complete: true };
        }
        return { rows: rows.filter(row => row.serviceId === serviceId).sort((a, b) => a.id.localeCompare(b.id)), complete: false };
      };
      const [capabilities, definitions] = await Promise.all([list('asset-capabilities'), list('capability-definitions')]);
      return { asset, driver, service, capabilities, definitions };
    };
    const before = await snapshot();
    if (input.road.expectedServiceVersion !== undefined && before.service.version !== input.road.expectedServiceVersion)
      throw new V2DraftError('STALE_COVERAGE', 'Service version changed; re-evaluate coverage.', 409);
    if (input.expectedAssetVersion !== undefined && before.asset.version !== input.expectedAssetVersion
      || input.expectedDriverVersion !== undefined && before.driver.version !== input.expectedDriverVersion)
      throw new V2DraftError('STALE_OPERATION', 'Resource version changed; re-evaluate the operation.', 409);
    const asset = FleetOutputsV2.assets.parse(before.asset.value), driver = CrewInputsV2.drivers.parse(before.driver.value);
    if (asset.serviceId !== serviceId || driver.serviceId !== serviceId)
      throw new V2DraftError('FORBIDDEN_CATALOG', 'Resource value scope mismatch.', 403);
    const compatibility = evaluateOperationCargo(input, CatalogInputsV2.services.parse(before.service.value), asset,
      before.capabilities.rows.map(row => FleetOutputsV2['asset-capabilities'].parse(row.value)),
      before.definitions.rows.map(row => ({ id: row.id, value: FleetOutputsV2['capability-definitions'].parse(row.value) })),
      before.capabilities.complete && before.definitions.complete, startedAt);
    const references = [before.asset, before.driver, before.service, ...before.capabilities.rows, ...before.definitions.rows]
      .map(row => ({ kind: row.id === input.assetId ? 'asset' : row.id === input.driverId ? 'driver'
        : row.id === serviceId ? 'service' : 'capability', id: row.id, version: row.version }));
    const alternatives: Array<{
      id: string; distanceMeters: number; timeline: ReturnType<typeof buildOperationTimeline>;
      resources: ReturnType<typeof CarrierOperationalAssessmentV2Schema.parse> | null; modeledDecision: OperationDecisionV2;
    }> = [];
    // Known hard failures do not incur a provider charge. Missing evidence can still support an explicitly uncertain estimate.
    const road = compatibility.status === 'ineligible' ? null
      : CarrierRoadAssessmentV2Schema.parse((await this.road.assess(actor, input.road)).data);
    if (road && (road.carrierId !== actor.carrierId || road.serviceId !== serviceId
      || road.origin.id !== input.road.originReferenceId || road.destination.id !== input.road.destinationReferenceId))
      throw new V2DraftError('INVALID_ASSESSMENT_RESPONSE', 'Road correlation failed.', 502);
    if (road?.routing?.status === 'estimated') {
      for (const route of road.routing.alternatives) {
        const timeline = buildOperationTimeline(input, route.durationSeconds);
        let resources: ReturnType<typeof CarrierOperationalAssessmentV2Schema.parse> | null = null;
        if (timeline.decision.status !== 'ineligible' && !timeline.decision.reasons.includes('OPERATION_EXCEEDS_SUPPORTED_HORIZON')) {
          const result = await this.operations.assess(actor, { schemaVersion: '2.0', serviceId,
            resources: [{ kind: 'asset', resourceId: input.assetId, window: timeline.workWindow },
              { kind: 'driver', resourceId: input.driverId, window: timeline.workWindow }], depots: input.depots });
          resources = CarrierOperationalAssessmentV2Schema.parse(result.data);
          const requested = [{ kind: 'asset', referenceId: input.assetId, resourceCode: null, window: timeline.workWindow },
            { kind: 'driver', referenceId: input.driverId, resourceCode: null, window: timeline.workWindow },
            ...input.depots.map(d => ({ kind: 'depot', referenceId: d.depotId, resourceCode: d.resourceCode, window: d.window }))];
          if (resources.carrierId !== actor.carrierId || resources.serviceId !== serviceId
            || resources.checks.length !== requested.length || resources.checks.some((c, i) => {
              const q = requested[i]; return c.kind !== q.kind || c.referenceId !== q.referenceId || c.resourceCode !== q.resourceCode
                || Date.parse(c.window.startsAt) !== Date.parse(q.window.startsAt) || Date.parse(c.window.endsAt) !== Date.parse(q.window.endsAt);
            })) throw new V2DraftError('INVALID_ASSESSMENT_RESPONSE', 'Operation correlation failed.', 502);
          if (resources.checks[0].resourceVersion !== before.asset.version || resources.checks[1].resourceVersion !== before.driver.version)
            throw new V2DraftError('STALE_OPERATION', 'Resource version changed during agenda evaluation.', 409);
          // Recompute instead of trusting a mismatched aggregate; uncertain provenance is never positive evidence.
          const normalized = resources.checks.map(c => c.status === 'eligible'
            && !['VERIFIED', 'SIMULATED'].includes(c.provenanceStatus)
            ? { ...c, status: 'unknown' as const, reasons: [...c.reasons, 'RESOURCE_EVIDENCE_UNKNOWN'] } : c);
          resources = { ...resources, checks: normalized, status: combineOperationDecisions(normalized).status };
        }
        const modeledDecision = combineOperationDecisions([compatibility, timeline.decision,
          ...(resources ? [{ status: resources.status, reasons: resources.checks.flatMap(c => c.reasons) }] : [])]);
        alternatives.push({ id: route.id, distanceMeters: route.distanceMeters, timeline, resources, modeledDecision });
      }
    }
    if (hash(before) !== hash(await snapshot()))
      throw new V2DraftError('STALE_OPERATION', 'Resource or capability catalog changed; discard this estimate.', 409);
    const candidates = alternatives.filter(a => a.modeledDecision.status !== 'ineligible');
    candidates.sort((a, b) => Number(a.modeledDecision.status === 'unknown') - Number(b.modeledDecision.status === 'unknown')
      || (input.road.objective === 'FASTEST' ? a.timeline.drivingSeconds - b.timeline.drivingSeconds : a.distanceMeters - b.distanceMeters)
      || a.id.localeCompare(b.id));
    const allBlocked = alternatives.length > 0 && candidates.length === 0;
    const ineligible = compatibility.status === 'ineligible' || road?.coverage.status === 'ineligible' || allBlocked;
    const pending = ['PHYSICAL_READINESS_NOT_ESTABLISHED', 'LEGAL_DRIVING_POLICY_NOT_EVALUATED', 'TRUCK_ACCESS_UNVERIFIED',
      'CLIENT_REQUEST_NOT_VALIDATED', 'CARGO_PACKING_NOT_EVALUATED', ...(!input.depots.length ? ['DEPOT_ACTIVITY_NOT_EVALUATED'] : []),
      ...(input.depots.length ? ['DEPOT_LOCATION_AND_HANDLING_BINDING_NOT_EVALUATED'] : []),
      ...(input.road.traffic !== 'TRAFFIC_UNAWARE' && (input.planning.loadingSeconds ?? 0) > 0 ? ['TRAFFIC_DEPARTURE_APPROXIMATED'] : []),
      ...(road?.coverage.borderReviewRequired ? ['BORDER_DOSSIER_NOT_COMPOSED'] : [])];
    return { schemaVersion: '2.0' as const, data: RoadOperationAssessmentV2Schema.parse({
      schemaVersion: '2.0', carrierId: actor.carrierId, serviceId, assetId: input.assetId, driverId: input.driverId,
      scope: 'SINGLE_ROAD_ASSET_DRIVER_ESTIMATE', policyVersion: 'road-operation/v1', startedAt, completedAt: this.clock(),
      status: ineligible ? 'ineligible' : 'unknown', reasons: [...new Set([...compatibility.reasons,
        ...(road?.coverage.reasons ?? []), ...(!road?.routing || road.routing.status !== 'estimated' ? ['ROAD_NOT_ESTIMATED'] : []),
        ...(allBlocked ? ['NO_MODELED_ALTERNATIVE'] : []), ...pending])], compatibility, road, alternatives,
      selectedForReviewId: candidates[0]?.id ?? null, selectionScope: 'NON_BLOCKED_MODELED_CHECKS_ONLY', planning: input.planning,
      references, consistency: 'NON_ATOMIC_READ_RESOURCES_RECHECKED', physicalReadiness: 'UNKNOWN', legalDrivingPolicy: 'UNKNOWN',
      truckAccess: 'UNVERIFIED', travelAuthorization: 'UNKNOWN', clientRequestValidated: false,
      fullEligibilityEvaluated: false, capacityReserved: false, requiresCommitRevalidation: true,
    }) };
  }
}
