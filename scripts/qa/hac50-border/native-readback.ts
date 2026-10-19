import fs from 'node:fs';
import assert from 'node:assert/strict';
import { BorderRecordV2Schema } from '@/shared/schemas/v2/border-operations';
import { assessBorderDocuments } from '@/server/modules/border-operations/domain/border-policy';
const cases = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
for (const c of cases) {
  const row = BorderRecordV2Schema.parse(c.record), result = assessBorderDocuments(row, c.now);
  assert.equal(result.documentStatus === 'eligible', c.sqlReady, c.label);
  assert.equal(result.travelAuthorization, 'UNKNOWN');
}
console.log(`PASS: ${cases.length} native PostgreSQL projections parsed; SQL/TypeScript document policy agrees.`);
