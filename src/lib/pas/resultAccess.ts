import { supabase } from '../supabaseClient';
import { formatError } from '../errorUtils';
import { logActivity } from '../activityLogger';
import type { ActionResult } from './types';

export async function getResult(actionId: string): Promise<ActionResult | null> {
  const { data, error } = await supabase
    .from('action_results')
    .select('*')
    .eq('action_id', actionId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw new Error(formatError(error, 'Lỗi tải kết quả'));
  return (data as ActionResult) || null;
}

export interface ResultInput {
  workspace_id: string;
  action_id: string;
  result_note: string;
  primary_result_metric_name?: string | null;
  before_value?: number | null;
  after_value?: number | null;
  unit?: string | null;
}

// 1 action - 1 result. Tạo mới nếu chưa có, cập nhật nếu có (và chưa khóa).
export async function upsertResult(input: ResultInput): Promise<ActionResult> {
  const { data: { session } } = await supabase.auth.getSession();
  const existing = await getResult(input.action_id);

  if (existing) {
    if (existing.is_locked) throw new Error('Kết quả đã bị khóa (sau khi đánh giá). Cần Manager mở khóa để sửa.');
    const { data, error } = await supabase
      .from('action_results')
      .update({
        result_note: input.result_note,
        primary_result_metric_name: input.primary_result_metric_name ?? null,
        before_value: input.before_value ?? null,
        after_value: input.after_value ?? null,
        unit: input.unit ?? null,
        updated_by: session?.user?.id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw new Error(formatError(error, 'Lỗi cập nhật kết quả'));
    await logActivity({ workspaceId: input.workspace_id, entityType: 'result', entityId: existing.id, action: 'updated' });
    return data as ActionResult;
  }

  const { data, error } = await supabase
    .from('action_results')
    .insert({
      workspace_id: input.workspace_id,
      action_id: input.action_id,
      result_note: input.result_note,
      primary_result_metric_name: input.primary_result_metric_name ?? null,
      before_value: input.before_value ?? null,
      after_value: input.after_value ?? null,
      unit: input.unit ?? null,
      captured_at: new Date().toISOString(),
      updated_by: session?.user?.id ?? null,
      created_by: session?.user?.id ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(formatError(error, 'Lỗi tạo kết quả'));
  await logActivity({ workspaceId: input.workspace_id, entityType: 'result', entityId: data.id, action: 'created' });
  return data as ActionResult;
}

export async function setResultLock(resultId: string, workspaceId: string, locked: boolean): Promise<void> {
  const { error } = await supabase
    .from('action_results')
    .update({ is_locked: locked, locked_at: locked ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq('id', resultId);
  if (error) throw new Error(formatError(error, 'Lỗi khóa/mở khóa kết quả'));
  await logActivity({ workspaceId, entityType: 'result', entityId: resultId, action: locked ? 'locked' : 'unlocked' });
}
