import { supabase } from '../supabaseClient';
import { formatError } from '../errorUtils';
import { logActivity } from '../activityLogger';
import { getResult, setResultLock } from './resultAccess';
import type { ActionEvaluation, EvaluationResult } from './types';

export async function getEvaluation(actionId: string): Promise<ActionEvaluation | null> {
  const { data, error } = await supabase
    .from('action_evaluations')
    .select('*')
    .eq('action_id', actionId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw new Error(formatError(error, 'Lỗi tải đánh giá'));
  return (data as ActionEvaluation) || null;
}

// Manager đánh Pass/Not Pass. Điều kiện: action phải có Result. Sau đánh giá -> khóa Result.
export async function createEvaluation(
  actionId: string,
  workspaceId: string,
  evaluation: EvaluationResult,
  note?: string | null,
): Promise<ActionEvaluation> {
  const { data: { session } } = await supabase.auth.getSession();

  const result = await getResult(actionId);
  if (!result) throw new Error('Hành động chưa có Kết quả — không thể đánh giá.');

  const { data, error } = await supabase
    .from('action_evaluations')
    .insert({
      workspace_id: workspaceId,
      action_id: actionId,
      evaluation,
      evaluation_note: note ?? null,
      evaluated_by: session?.user?.id ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(formatError(error, 'Lỗi tạo đánh giá'));

  // Khóa kết quả sau khi đánh giá
  await setResultLock(result.id, workspaceId, true);

  await logActivity({
    workspaceId,
    entityType: 'evaluation',
    entityId: data.id,
    action: 'created',
    detail: { action_id: actionId, evaluation },
  });
  return data as ActionEvaluation;
}
