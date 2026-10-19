/** Read-only local Postgres RPC + real Google test. Controlled role claims are not browser JWT verification. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { CatalogServiceV2, type CatalogRepositoryV2 } from '@/server/modules/catalog/application/catalog-service';
import { WorkflowServiceV2, type WorkflowRepositoryV2 } from '@/server/modules/workflow/application/workflow-service';
import { CarrierAvailabilityService } from '@/server/modules/fleet/application/availability-service';
import { CarrierOperationalAssessmentService } from '@/server/modules/fleet/application/operational-assessment-service';
import { CarrierRoadService, type RoadActor, type CoveredRoadProvider } from '@/server/modules/carrier-road-routing/application/carrier-road-service';
import { RoadOperationService } from '@/server/modules/carrier-road-routing/application/road-operation-service';
import { createCoveredRoadProvider } from '@/server/modules/carrier-road-routing/infrastructure/google-road-provider';
import type { RoadOperationInputV2 } from '@/shared/schemas/v2/road-operation';
import { FleetOutputsV2 } from '@/shared/schemas/v2/fleet';

const app = process.cwd(), root = resolve(app, '..'), output = process.argv[2];
assert.ok(output, 'Evidence directory required'); mkdirSync(output, { recursive: true });
const container = 'supabase_db_hac45-carrier-local', bank = 'hac50_scenario_fleet80_global_v1';
const manifest = JSON.parse(readFileSync(resolve(root, 'supabase/scenarios/v2-carrier-fleet-80/manifest.json'), 'utf8'));
const sql = (query: string) => execFileSync('docker', ['exec', '-i', container, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', bank],
  { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 12 * 1024 * 1024 }).trim();
const uuid = (value: string | null) => value === null ? 'null' : "'" + z.string().uuid().parse(value) + "'";
assert.equal(sql("select shobj_description(oid,'pg_database') from pg_database where datname=current_database();"), 'LOCAL_ONLY:v2-carrier-fleet-80');
const counts = () => sql("select jsonb_build_object('assets',(select count(*) from public.transport_assets),'drivers',(select count(*) from public.drivers),'bookings',(select count(*) from public.bookings),'assignments',(select count(*) from public.driver_assignments));");
const before = counts();
const key = readFileSync(resolve(app, '.env.local'), 'utf8').match(/^GOOGLE_ROUTES_API_KEY\s*=\s*(.+)\s*$/m)?.[1].trim().replace(/^['"]|['"]$/g, '');
assert.ok(key, 'Private server credential required');
let googleCalls = 0;
const provider = createCoveredRoadProvider({ apiKey: key, fetcher: async (...args) => { googleCalls++; return fetch(...args); } });
const results: unknown[] = [];

async function run(label: string, origin: string, destination: string, delivery: { startsAt: string; endsAt: string }) {
  const carrier = manifest.carriers.find((c: { label: string }) => c.label === label); assert.ok(carrier);
  const actor: RoadActor = { kind: 'carrier', carrierId: carrier.id, operatorId: carrier.operatorId, organizationId: null };
  const session = (statement: string) => "begin read only; set local role authenticated; set local request.jwt.claims='"
    + JSON.stringify({ sub: carrier.userId, role: 'authenticated' }) + "'; " + statement + '; rollback;';
  const identity = JSON.parse(sql(session(`select public.get_v2_carrier_identity(${uuid(carrier.id)})`)));
  assert.equal(identity.operatorId, carrier.operatorId);
  const repository: CatalogRepositoryV2 = { command: async () => { throw Error('Read-only harness'); },
    read: async (_actor, kind, scope, page, id) => JSON.parse(sql(session(`select public.read_v2_carrier_catalog(${uuid(carrier.operatorId)},'${kind}',${uuid(scope.carrierId)},${uuid(scope.serviceId)},${uuid(id)},${page.limit},${page.offset})`))) };
  const workflowRepository: WorkflowRepositoryV2 = { command: async () => { throw Error('Read-only harness'); },
    read: async (_actor, kind, context, page) => {
      assert.equal(kind, 'holds');
      const json = JSON.stringify(context).replaceAll("'", "''");
      return JSON.parse(sql(session(`select public.read_v2_carrier_workflow(${uuid(carrier.operatorId)},'holds','${json}'::jsonb,${page.limit},${page.offset})`)));
    } };
  const catalog = new CatalogServiceV2(repository);
  const assets = (await catalog.list(actor, 'assets', { carrierId: actor.carrierId, serviceId: null }, { limit: 100, offset: 0 })).data;
  const resource = manifest.resources.find((r: { carrierId: string; serviceId: string; state: string }) => r.carrierId === carrier.id && r.serviceId === carrier.serviceIds[0] && r.state === 'available');
  assert.ok(resource, 'Available general resource required');
  const asset = FleetOutputsV2.assets.parse(assets.find(r => r.id === resource.assetId)!.value);
  const definitions = await catalog.list(actor, 'capability-definitions', { carrierId: carrier.id, serviceId: null }, { limit: 100, offset: 0 });
  const categoryId = FleetOutputsV2['capability-definitions'].parse(definitions.data.find(d => d.serviceId === resource.serviceId)!.value).categoryId;
  const input: RoadOperationInputV2 = { schemaVersion: '2.0', assetId: resource.assetId, driverId: resource.driverId,
    road: { schemaVersion: '2.0', serviceId: resource.serviceId, originReferenceId: origin, destinationReferenceId: destination,
      pickupWindow: { startsAt: '2026-10-18T08:00:00Z', endsAt: '2026-10-18T10:00:00Z' }, deliveryWindow: delivery,
      objective: 'FASTEST', traffic: 'TRAFFIC_UNAWARE' },
    cargo: { categoryId, weightKg: 2000, volumeM3: 5, largestPieceCm: { length: 80, width: 80, height: 80 },
      requiredEquipment: asset.equipmentType, certifications: [], temperatureRange: null, hazardous: false, fragile: false, oversized: false },
    planning: { reference: 'SIMULATED native operational planning', provenanceStatus: 'SIMULATED', loadingSeconds: 1800,
      unloadingSeconds: 1800, restSeconds: 0, borderSeconds: 0, repositionBeforeSeconds: 1800, repositionAfterSeconds: 1800 }, depots: [] };
  const operations = new CarrierOperationalAssessmentService(new CarrierAvailabilityService(catalog, new WorkflowServiceV2(workflowRepository)),
    { execute: async () => { throw Error('No depot inferred'); } });
  let lastRoad: Awaited<ReturnType<CoveredRoadProvider>> | undefined;
  const traced: CoveredRoadProvider = async q => { lastRoad = await provider(q); return lastRoad; };
  const service = new RoadOperationService(catalog, new CarrierRoadService(catalog, traced), operations);
  const previous = googleCalls, response = (await service.assess(actor, input)).data;
  assert.equal(googleCalls - previous, 1); assert.equal(response.road?.routing?.status, 'estimated');
  assert.equal(response.compatibility.status, 'eligible'); assert.equal(response.capacityReserved, false);
  assert.equal(response.physicalReadiness, 'UNKNOWN');
  assert.ok(response.alternatives.length);
  if (label === 'C04') {
    assert.equal(response.status, 'ineligible');
    assert.ok(response.alternatives.every(a => a.resources?.checks.some(c => c.kind === 'driver' && c.status === 'ineligible')));
  } else {
    assert.equal(response.status, 'unknown'); assert.ok(response.selectedForReviewId);
    assert.ok(response.alternatives.some(a => a.modeledDecision.status === 'eligible'));
  }
  results.push({ name: `${label}: live Google + native resource windows`, status: response.status,
    selectedForReviewId: response.selectedForReviewId, compatibility: response.compatibility, providerCalls: googleCalls - previous,
    unresolved: response.reasons, references: response.references,
    alternatives: response.alternatives.map(a => ({ id: a.id, drivingSeconds: a.timeline.drivingSeconds,
      occupiedSeconds: a.timeline.totalOccupiedSeconds, workWindow: a.timeline.workWindow, decision: a.modeledDecision,
      checks: a.resources?.checks ?? [] })),
    geometryHashes: response.road?.routing?.status === 'estimated' ? response.road.routing.alternatives.map(r => ({ id: r.id,
      points: r.points.length, sha256: createHash('sha256').update(JSON.stringify(r.points)).digest('hex') })) : [] });
  // Memory-only replay of the same provider result isolates the resource conflict without another billable call.
  const busy = manifest.resources.find((r: { carrierId: string; serviceId: string; state: string }) => r.carrierId === carrier.id && r.serviceId === resource.serviceId && r.state === 'busy');
  if (busy) {
    const busyAsset = FleetOutputsV2.assets.parse(assets.find(r => r.id === busy.assetId)!.value);
    const replay = new RoadOperationService(catalog, new CarrierRoadService(catalog, async () => lastRoad!), operations);
    const result = (await replay.assess(actor, { ...input, assetId: busy.assetId, driverId: busy.driverId,
      cargo: { ...input.cargo, requiredEquipment: busyAsset.equipmentType } })).data;
    assert.equal(result.status, 'ineligible'); assert.equal(googleCalls - previous, 1);
    results.push({ name: `${label}: busy resource; in-memory provider replay`, status: result.status,
      checks: result.alternatives.map(a => a.resources?.checks), additionalGoogleCalls: 0 });
  }
  const denied = (await service.assess(actor, { ...input, cargo: { ...input.cargo, weightKg: 1000000 } })).data;
  assert.equal(denied.status, 'ineligible'); assert.equal(denied.road, null); assert.equal(googleCalls - previous, 1);
  results.push({ name: `${label}: overweight before provider`, status: denied.status, additionalGoogleCalls: 0 });
}

async function main() {
  await run('C02', 'los-angeles', 'san-diego', { startsAt: '2026-10-18T11:00:00Z', endsAt: '2026-10-18T14:00:00Z' });
  await run('C04', 'chiclayo', 'lima', { startsAt: '2026-10-19T08:00:00Z', endsAt: '2026-10-19T10:00:00Z' });
  assert.equal(counts(), before, 'Local data must remain unchanged');
  const report = { completed: true, checkedAt: new Date().toISOString(), bank, googleCalls,
    authenticationScope: 'CONTROLLED_POSTGRES_AUTHENTICATED_ROLE_AND_NATIVE_IDENTITY; NOT_BROWSER_JWT_E2E',
    provenance: 'SIMULATED_CARRIER_RESOURCES_WITH_REAL_GOOGLE_ROUTES', writes: 0, results };
  writeFileSync(resolve(output, 'NATIVE_RESULTS.json'), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify({ completed: true, checks: results.length, googleCalls, writes: 0 }) + '\n');
}
main().catch(error => { process.stderr.write(String(error?.message ?? 'Native verification failed')
  .replace(/AIza[0-9A-Za-z_-]+/g, '[REDACTED]') + '\n'); process.exitCode = 1; });
