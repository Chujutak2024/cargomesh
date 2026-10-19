import type { BorderRecordV2 } from '@/shared/schemas/v2/border-operations';

/** Internal document readiness only. Carrier reports never become government clearance. */
export function assessBorderDocuments(record: BorderRecordV2, now: string) {
  const at = Date.parse(now);
  if (!Number.isFinite(at)) throw new Error('INVALID_BORDER_CLOCK');
  const reasons: string[] = [];
  if (record.reviewStatus === 'REJECTED') reasons.push('BORDER_REVIEW_REJECTED');
  else if (record.reviewStatus !== 'APPROVED') reasons.push('BORDER_REVIEW_PENDING');
  for (const code of record.context.requiredDocuments) {
    const doc = record.documents.find(d => d.code === code);
    if (!doc) reasons.push(`BORDER_DOCUMENT_MISSING:${code}`);
    else if (Date.parse(doc.checkedAt) > Math.min(at, Date.parse(record.context.window.startsAt))
      || Date.parse(doc.validUntil) <= at || Date.parse(doc.validUntil) < Date.parse(record.context.window.endsAt)) {
      reasons.push(`BORDER_DOCUMENT_NOT_CURRENT:${code}`);
    }
  }
  if (record.passageStatus === 'HELD') reasons.push('BORDER_PASSAGE_HELD');
  const ready = reasons.length === 0;
  return {
    scope: 'CARRIER_DOCUMENT_REVIEW_ONLY' as const,
    routeBinding: 'DECLARED_NOT_PROVIDER_VERIFIED' as const,
    requirementsSource: 'CARRIER_CHECKLIST' as const,
    checkpointStatus: 'DECLARED_NOT_VERIFIED' as const,
    documentStatus: record.reviewStatus === 'REJECTED' || record.passageStatus === 'HELD'
      ? 'ineligible' as const : ready ? 'eligible' as const : 'unknown' as const,
    travelAuthorization: 'UNKNOWN' as const,
    authorizationReason: record.context.provenance === 'SIMULATED'
      ? 'SIMULATED_EVIDENCE_NOT_AUTHORIZATION' : 'BORDER_AUTHORITY_NOT_VERIFIED',
    simulatedJourneyReady: ready && record.context.provenance === 'SIMULATED',
    reasons, provenance: record.context.provenance, evaluatedAt: now,
    recordVersion: record.version, laneVersion: record.laneVersion,
    revalidateBeforeCommit: true as const,
  };
}
