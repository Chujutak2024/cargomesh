import { createV2ServerSupabaseClient } from '@/server/db/supabase/v2';
import { V2DraftError } from '../../freight-requests/application/draft-service';
import type { BorderRepository } from '../application/border-service';

export async function borderRepository(): Promise<BorderRepository> {
  const db = await createV2ServerSupabaseClient();
  type Args = { p_operator_id: string; p_carrier_id: string; p_action: string; p_id: string | null;
    p_expected_version: number | null; p_idempotency_key: string | null; p_value: unknown };
  const rpc = db.rpc.bind(db) as unknown as (name: 'border_operations_v2', args: Args) => PromiseLike<{
    data: unknown; error: { code?: string; message: string } | null;
  }>;
  return { async run(actor, action, input) {
    const { data, error } = await rpc('border_operations_v2', { p_operator_id: actor.operatorId,
      p_carrier_id: actor.carrierId, p_action: action, p_id: input.id, p_expected_version: input.expectedVersion,
      p_idempotency_key: input.key, p_value: input.value });
    if (error) {
      if (['PGRST202', '42883'].includes(error.code ?? '')) {
        throw new V2DraftError('BORDER_OPERATIONS_NOT_INSTALLED', 'Border operations migration is not installed.', 503);
      }
      const statuses: Record<string, number> = { PT400: 400, PT403: 403, PT404: 404, PT409: 409,
        '23503': 400, '23514': 400, '22P02': 400 };
      if (statuses[error.code ?? '']) throw new V2DraftError(
        error.code?.startsWith('PT') && /^[A-Z_]+$/.test(error.message) ? error.message : 'BORDER_VALIDATION_ERROR',
        'Border operation could not be applied.', statuses[error.code ?? '']);
      throw new Error('BORDER_DATABASE_ERROR');
    }
    return data;
  } };
}
