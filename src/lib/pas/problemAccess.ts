import { supabase } from '../supabaseClient';
import { formatError } from '../errorUtils';
import { shouldApplyUuidFilter, cleanUuid } from '../uuid';
import { logActivity } from '../activityLogger';
import type { Problem, ProblemStatus, Severity } from './types';

export interface ProblemFilters {
  departmentId?: string | null;
  status?: ProblemStatus;
  ownerId?: string | null;
  relatedKpiId?: string | null;
}

// Danh sách problem trong workspace (ẩn bản đã soft delete). Knowledge base: xem cả workspace.
export async function listProblems(workspaceId: string, filters: ProblemFilters = {}): Promise<Problem[]> {
  let query = supabase
    .from('problems')
    .select('*')
    .match(shouldApplyUuidFilter(workspaceId) ? { workspace_id: workspaceId } : {})
    .is('deleted_at', null);

  if (filters.departmentId && shouldApplyUuidFilter(filters.departmentId)) {
    query = query.eq('department_id', filters.departmentId);
  }
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.ownerId && shouldApplyUuidFilter(filters.ownerId)) {
    query = query.eq('problem_owner_id', filters.ownerId);
  }
  if (filters.relatedKpiId && shouldApplyUuidFilter(filters.relatedKpiId)) {
    query = query.eq('related_kpi_id', filters.relatedKpiId);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw new Error(formatError(error, 'Lỗi tải danh sách vấn đề'));
  return (data || []) as Problem[];
}

export async function getProblem(problemId: string): Promise<Problem | null> {
  const { data, error } = await supabase
    .from('problems')
    .select('*')
    .eq('id', problemId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw new Error(formatError(error, 'Lỗi tải vấn đề'));
  return (data as Problem) || null;
}

export interface CreateProblemInput {
  workspace_id: string;
  department_id: string;
  problem_owner_id: string;
  problem_title: string;
  problem_description: string;
  problem_type_id?: string | null;
  severity?: Severity;
  related_kpi_id?: string | null;
  related_kpi_item_id?: string | null;
  expected_resolve_date?: string | null;
  evidence_snapshot?: Record<string, any> | null;
}

export async function createProblem(input: CreateProblemInput): Promise<Problem> {
  const { data: { session } } = await supabase.auth.getSession();
  const payload = {
    ...input,
    problem_type_id: cleanUuid(input.problem_type_id),
    related_kpi_id: cleanUuid(input.related_kpi_id),
    related_kpi_item_id: cleanUuid(input.related_kpi_item_id),
    severity: input.severity ?? 'Medium',
    created_by: session?.user?.id ?? null,
  };

  const { data, error } = await supabase.from('problems').insert(payload).select().single();
  if (error) throw new Error(formatError(error, 'Lỗi tạo vấn đề'));

  await logActivity({
    workspaceId: input.workspace_id,
    entityType: 'problem',
    entityId: data.id,
    action: 'create',
    detail: { title: input.problem_title, severity: payload.severity, owner_id: input.problem_owner_id },
  });
  return data as Problem;
}

export async function updateProblem(
  problemId: string,
  workspaceId: string,
  updates: Partial<Problem>,
): Promise<Problem> {
  const { data, error } = await supabase
    .from('problems')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', problemId)
    .select()
    .single();
  if (error) throw new Error(formatError(error, 'Lỗi cập nhật vấn đề'));

  await logActivity({
    workspaceId,
    entityType: 'problem',
    entityId: problemId,
    action: 'update',
    detail: { updated_fields: Object.keys(updates) },
  });
  return data as Problem;
}

// Soft delete: set deleted_at, không xóa cứng.
export async function softDeleteProblem(problemId: string, workspaceId: string): Promise<void> {
  const { error } = await supabase
    .from('problems')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', problemId);
  if (error) throw new Error(formatError(error, 'Lỗi xóa vấn đề'));

  await logActivity({
    workspaceId,
    entityType: 'problem',
    entityId: problemId,
    action: 'delete',
  });
}
