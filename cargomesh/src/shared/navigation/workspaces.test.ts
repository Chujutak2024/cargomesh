import test from 'node:test';
import assert from 'node:assert/strict';
import { clientHref, clientSectionPath, carrierHref, carrierHashFromPath } from './workspaces';
import { workspaceHref, workspaceApiPath } from '@/features/workspace-mode/paths';
import { loginDestination, safeLoginReturnTo } from '@/shared/schemas/v2/carrier-portal';
import { resolveLoginAccess } from '@/server/auth/login-access';
import nextConfig from '../../../next.config';

test('Client canonical links retain selection, query, fragment and stay on real APIs', () => {
  assert.equal(workspaceHref('/requests/r1?tab=offers#selection', '/clients'), '/clients/requests/r1?tab=offers#selection');
  assert.equal(clientHref('/dashboard'), '/clients');
  assert.equal(clientSectionPath('/clients/requests'), '/requests');
  assert.equal(workspaceApiPath('/api/v2/freight/requests', '/clients/requests'), '/api/v2/freight/requests');
  for (const href of ['https://example.com/requests', '//example.com/requests', '/api/auth/logout', '/login', '/carriers'])
    assert.equal(clientHref(href), href);
});
test('Carrier sections use clean URLs and preserve the legacy view interpretation', () => {
  for (const [hash, path] of [['#/dashboard', '/carriers'], ['#/fleet', '/carriers/fleet'], ['#/shipments', '/carriers/requests'],
    ['#/desk', '/carriers/offers'], ['#/tower', '/carriers/control-tower'], ['#/fleet/carriers', '/carriers/sites']]) {
    assert.equal(carrierHref(hash), path); assert.equal(carrierHashFromPath(path), hash);
  }
  assert.equal(carrierHref('#/fleet/service/carriers'), '/carriers/sites');
  assert.equal(carrierHref('#/unknown'), '/carriers');
});
test('legacy routes target only the canonical portals and never an external host or demo',async()=>{
 const rules=await nextConfig.redirects!();
 for(const [source,destination] of [['/v2-workspace','/carriers'],['/dashboard','/clients'],['/demo/shipper/:path*','/clients/:path*'],['/requests/:path*','/clients/requests/:path*']])
  assert.ok(rules.some(r=>r.source===source&&r.destination===destination));
 for(const rule of rules){assert.ok(rule.destination.startsWith('/clients')||rule.destination.startsWith('/carriers'));assert.equal(rule.source.startsWith('/api/'),false);}
});
test('canonical login targets remain role-scoped and cannot bypass membership', async () => {
  const carrier = { carrierId: 'e7000000-0000-4000-8000-000000000001', operatorId: 'e7000000-0000-4000-8000-000000000002',
    role: 'ADMIN' as const, carrierName: 'Test', displayName: 'Test' };
  assert.equal(loginDestination('/clients', false, [carrier]), null);
  assert.equal(loginDestination('/clients', true, []), '/clients');
  assert.equal(loginDestination('/carriers', true, []), null);
  assert.equal(loginDestination('/carriers', false, [carrier]), '/carriers');
  assert.equal(await resolveLoginAccess('/carriers', { member: async () => true, carriers: async () => [] }), null);
  assert.equal(await resolveLoginAccess('/clients', { member: async () => false, carriers: async () => [carrier] }), null);
  for (const path of ['//evil.test', '/clients/../../api/auth/logout', '/carriers#https://evil.test', 'https://evil.test'])
    assert.equal(safeLoginReturnTo(path), undefined);
});
