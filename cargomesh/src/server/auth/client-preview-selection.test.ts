import {test} from 'node:test';
import assert from 'node:assert/strict';
import {useClientPreview} from './client-preview-selection';
test('connected Client wins over visual grants; anonymous preview remains explicit', async () => {
  let previewReads = 0;
  const preview = async () => { previewReads++; return true; };
  assert.equal(await useClientPreview(async () => ({memberId: 'real'}), preview), false);
  assert.equal(previewReads, 0);
  assert.equal(await useClientPreview(async () => { throw new Error('UNAUTHENTICATED: session'); }, preview), true);
  assert.equal(previewReads, 1);
});
test('Carrier-only membership denial and outages never become visual authorization', async () => {
  const preview = async () => true;
  assert.equal(await useClientPreview(async () => ({}), preview), false);
  assert.equal(await useClientPreview(async () => { throw new Error('FORBIDDEN: Client membership'); }, preview), false);
  await assert.rejects(useClientPreview(async () => { throw new Error('DATABASE_UNAVAILABLE'); }, preview), /DATABASE_UNAVAILABLE/);
});
