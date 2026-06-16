import { supabase } from '../supabaseClient';
import { formatError } from '../errorUtils';
import { cleanUuid } from '../uuid';
import { logActivity } from '../activityLogger';
import type { Action, ActionStatus } from './types';

export async function listActions(problemId: string): Promise<Action[]> {
  const { data, error } = await supabase
    .from('actions')
    .select('*')
    .eq('problem_id', problemId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) throw new Error(formatError(error, 'Lỗi tải hành động'));
  return (data || []) as Action[];
}

export interface CreateActionInput {
  workspace_id: string;
  problem_id: string;
  action_title: string;
  action_owner_id: string;
  deadline: string; // YYYY-MM-DD
  root_cause_id?: string | null;
  action_description?: string | null;
  status?: ActionStatus;
}

export async function createAction(input: CreateActionInput): Promise<Action> {
  const { data: { session } } = await supabase.auth.getSession();
  const payload = {
    workspace_id: input.workspace_id,
    problem_id: input.problem_id,
    action_title: input.action_title,
    action_owner_id: input.action_owner_id,
    deadline: input.deadline,
    root_cause_id: cleanUuid(input.root_cause_id),
    action_description: input.action_description ?? null,
    status: input.status ?? 'Todo',
    created_by: session?.user?.id ?? null,
  };

  const { data, error } = await supabase.from('actions').insert(payload).select().single();
  if (error) throw new Error(formatError(error, 'Lỗi tạo hành động'));

  await logActivity({
    workspaceId: input.workspace_id,
    entityType: 'action',
    entityId: data.id,
    action: 'create',
    detail: { problem_id: input.problem_id, owner_id: input.action_owner_id, has_root_cause: !!payload.root_cause_id },
  });
  return data as Action;
}

export async function updateActionStatus(
  actionId: string,
  workspaceId: string,
  status: ActionStatus,
): Promise<Action> {
  const updates: Record<string, any> = { status, updated_at: new Date().toISOString() };
  if (status === 'Done') updates.done_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('actions')
    .update(updates)
    .eq('id', actionId)
    .select()
    .single();
  if (error) throw new Error(formatError(error, 'Lỗi cập nhật trạng thái hành động'));

  await logActivity({
    workspaceId,
    entityType: 'action',
    entityId: actionId,
    action: 'status_changed',
    detail: { status },
  });
  return data as Action;
}

// Hủy action — bắt buộc có lý do (DB cũng chặn nếu thiếu).
export async function cancelAction(actionId: string, workspaceId: string, reason: string): Promise<Action> {
  if (!reason || !reason.trim()) throw new Error('Cần nhập lý do hủy hành động');

  const { data, error } = await supabase
    .from('actions')
    .update({ status: 'Cancelled', cancel_reason: reason, updated_at: new Date().toISOString() })
    .eq('id', actionId)
    .select()
    .single();
  if (error) throw new Error(formatError(error, 'Lỗi hủy hành động'));

  await logActivity({
    workspaceId,
    entityType: 'action',
    entityId: actionId,
    action: 'cancelled',
    detail: { cancel_reason: reason },
  });
  return data as Action;
}

// Đổi deadline — tăng counter, log activity.
export async function changeDeadline(
  actionId: string,
  workspaceId: string,
  newDeadline: string,
  currentCount: number,
): Promise<Action> {
  const { data, error } = await supabase
    .from('actions')
    .update({
      deadline: newDeadline,
      deadline_changed_count: (currentCount ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', actionId)
    .select()
    .single();
  if (error) throw new Error(formatError(error, 'Lỗi đổi hạn chót'));

  await logActivity({
    workspaceId,
    entityType: 'action',
    entityId: actionId,
    action: 'deadline_changed',
    detail: { new_deadline: newDeadline },
  });
  return data as Action;
}

export async function updateAction(
  actionId: string,
  workspaceId: string,
  updates: Partial<Pick<Action, 'action_title' | 'action_description' | 'action_owner_id' | 'root_cause_id' | 'action_note'>>,
): Promise<Action> {
  const payload: Record<string, any> = { ...updates, updated_at: new Date().toISOString() };
  if ('root_cause_id' in payload) payload.root_cause_id = cleanUuid(payload.root_cause_id);

  const { data, error } = await supabase
    .from('actions')
    .update(payload)
    .eq('id', actionId)
    .select()
    .single();
  if (error) throw new Error(formatError(error, 'Lỗi cập nhật hành động'));

  await logActivity({
    workspaceId,
    entityType: 'action',
    entityId: actionId,
    action: 'update',
    detail: { updated_fields: Object.keys(updates) },
  });
  return data as Action;
}

export async function softDeleteAction(actionId: string, workspaceId: string): Promise<void> {
  const { error } = await supabase
    .from('actions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', actionId);
  if (error) throw new Error(formatError(error, 'Lỗi xóa hành động'));

  await logActivity({ workspaceId, entityType: 'action', entityId: actionId, action: 'delete' });
}
