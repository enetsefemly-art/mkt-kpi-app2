import { supabase } from '../supabaseClient';
import { formatError } from '../errorUtils';
import { shouldApplyUuidFilter, cleanUuid } from '../uuid';
import { logActivity } from '../activityLogger';
import type { RootCause, ValidationStatus } from './types';

export async function listRootCauses(problemId: string): Promise<RootCause[]> {
  const { data, error } = await supabase
    .from('root_causes')
    .select('*')
    .eq('problem_id', problemId)
    .is('deleted_at', null)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) throw new Error(formatError(error, 'Lỗi tải nguyên nhân'));
  return (data || []) as RootCause[];
}

export interface CreateRootCauseInput {
  workspace_id: string;
  problem_id: string;
  root_cause_note: string;
  root_cause_type_id?: string | null;
  is_primary?: boolean;
  validated?: boolean;        // true = "Đã verify", false/undefined = "Giả định"
  evidence?: string | null;   // bắt buộc khi validated = true
}

export async function createRootCause(input: CreateRootCauseInput): Promise<RootCause> {
  const { data: { session } } = await supabase.auth.getSession();

  if (input.validated && !(input.evidence && input.evidence.trim())) {
    throw new Error('Nguyên nhân "Đã verify" cần có dẫn chứng');
  }

  // Nếu đặt làm primary, bỏ primary của các root cause khác cùng problem trước
  // (DB có unique index chặn 2 primary, nên phải unset trước).
  if (input.is_primary) {
    await clearPrimary(input.problem_id);
  }

  const payload = {
    workspace_id: input.workspace_id,
    problem_id: input.problem_id,
    root_cause_note: input.root_cause_note,
    root_cause_type_id: cleanUuid(input.root_cause_type_id),
    is_primary: input.is_primary ?? false,
    validation_status: input.validated ? 'Validated' : 'Not Validated',
    evidence: input.validated ? (input.evidence ?? null) : null,
    created_by: session?.user?.id ?? null,
  };

  const { data, error } = await supabase.from('root_causes').insert(payload).select().single();
  if (error) throw new Error(formatError(error, 'Lỗi thêm nguyên nhân'));

  await logActivity({
    workspaceId: input.workspace_id,
    entityType: 'root_cause',
    entityId: data.id,
    action: 'create',
    detail: { problem_id: input.problem_id, is_primary: payload.is_primary },
  });
  return data as RootCause;
}

export async function updateRootCause(
  rootCauseId: string,
  workspaceId: string,
  updates: Partial<Pick<RootCause, 'root_cause_note' | 'root_cause_type_id' | 'validation_status'>>,
): Promise<RootCause> {
  const { data, error } = await supabase
    .from('root_causes')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', rootCauseId)
    .select()
    .single();
  if (error) throw new Error(formatError(error, 'Lỗi cập nhật nguyên nhân'));

  await logActivity({
    workspaceId,
    entityType: 'root_cause',
    entityId: rootCauseId,
    action: 'update',
    detail: { updated_fields: Object.keys(updates) },
  });
  return data as RootCause;
}

// Đổi primary: bỏ primary cũ -> set primary mới, log activity.
export async function setPrimaryRootCause(
  problemId: string,
  rootCauseId: string,
  workspaceId: string,
): Promise<void> {
  await clearPrimary(problemId);

  const { error } = await supabase
    .from('root_causes')
    .update({ is_primary: true, updated_at: new Date().toISOString() })
    .eq('id', rootCauseId);
  if (error) throw new Error(formatError(error, 'Lỗi đặt nguyên nhân chính'));

  await logActivity({
    workspaceId,
    entityType: 'root_cause',
    entityId: rootCauseId,
    action: 'primary_changed',
    detail: { problem_id: problemId },
  });
}

export async function setValidationStatus(
  rootCauseId: string,
  workspaceId: string,
  status: ValidationStatus,
): Promise<void> {
  const { error } = await supabase
    .from('root_causes')
    .update({ validation_status: status, updated_at: new Date().toISOString() })
    .eq('id', rootCauseId);
  if (error) throw new Error(formatError(error, 'Lỗi cập nhật trạng thái xác thực'));

  await logActivity({
    workspaceId,
    entityType: 'root_cause',
    entityId: rootCauseId,
    action: 'validation_changed',
    detail: { validation_status: status },
  });
}

export async function softDeleteRootCause(rootCauseId: string, workspaceId: string): Promise<void> {
  const { error } = await supabase
    .from('root_causes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', rootCauseId);
  if (error) throw new Error(formatError(error, 'Lỗi xóa nguyên nhân'));

  await logActivity({ workspaceId, entityType: 'root_cause', entityId: rootCauseId, action: 'delete' });
}

// Helper nội bộ: bỏ cờ primary của mọi root cause (chưa xóa) thuộc problem.
async function clearPrimary(problemId: string): Promise<void> {
  if (!shouldApplyUuidFilter(problemId)) return;
  const { error } = await supabase
    .from('root_causes')
    .update({ is_primary: false, updated_at: new Date().toISOString() })
    .eq('problem_id', problemId)
    .eq('is_primary', true)
    .is('deleted_at', null);
  if (error) throw new Error(formatError(error, 'Lỗi cập nhật nguyên nhân chính'));
}
