import { supabase } from '../supabaseClient';
import { formatError } from '../errorUtils';
import { shouldApplyUuidFilter } from '../uuid';
import type { ProblemType, RootCauseType } from './types';

// Danh sách Problem Type đang active trong workspace, sắp theo sort_order.
export async function listProblemTypes(workspaceId: string): Promise<ProblemType[]> {
  const { data, error } = await supabase
    .from('problem_types')
    .select('*')
    .match(shouldApplyUuidFilter(workspaceId) ? { workspace_id: workspaceId } : {})
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw new Error(formatError(error, 'Lỗi tải danh mục loại vấn đề'));
  return (data || []) as ProblemType[];
}

// Danh sách Root Cause Type đang active trong workspace.
export async function listRootCauseTypes(workspaceId: string): Promise<RootCauseType[]> {
  const { data, error } = await supabase
    .from('root_cause_types')
    .select('*')
    .match(shouldApplyUuidFilter(workspaceId) ? { workspace_id: workspaceId } : {})
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw new Error(formatError(error, 'Lỗi tải danh mục loại nguyên nhân'));
  return (data || []) as RootCauseType[];
}

// Root Cause Type gợi ý theo Problem Type (qua bảng mapping), sắp theo priority_order.
// Trả về [] nếu chưa có mapping — UI vẫn cho chọn từ toàn bộ danh sách.
export async function listSuggestedRootCauseTypes(problemTypeId: string): Promise<RootCauseType[]> {
  if (!shouldApplyUuidFilter(problemTypeId)) return [];

  const { data, error } = await supabase
    .from('problem_type_root_cause_map')
    .select('priority_order, root_cause_types(*)')
    .eq('problem_type_id', problemTypeId)
    .order('priority_order', { ascending: true });

  if (error) throw new Error(formatError(error, 'Lỗi tải gợi ý nguyên nhân'));

  return (data || [])
    .map((row: any) => row.root_cause_types)
    .filter((rct: any) => rct && !rct.deleted_at && rct.is_active) as RootCauseType[];
}

// ===========================================================================
// QUẢN LÝ DANH MỤC (Manager/Director) — CRUD
// ===========================================================================

// Sinh type_code tự động từ tên (chữ Latin + hậu tố ngẫu nhiên để khỏi trùng).
function genCode(name: string): string {
  // Chỉ giữ a-z0-9 (ký tự có dấu -> '_'); uniqueness đảm bảo bằng hậu tố ngẫu nhiên.
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24);
  return `${slug || 'type'}_${Math.random().toString(36).slice(2, 6)}`;
}

// --- Problem Types ---
export async function listProblemTypesManage(workspaceId: string): Promise<ProblemType[]> {
  const { data, error } = await supabase
    .from('problem_types')
    .select('*')
    .match(shouldApplyUuidFilter(workspaceId) ? { workspace_id: workspaceId } : {})
    .is('deleted_at', null)
    .order('sort_order', { ascending: true });
  if (error) throw new Error(formatError(error, 'Lỗi tải loại vấn đề'));
  return (data || []) as ProblemType[];
}

export async function createProblemType(
  workspaceId: string,
  input: { type_name: string; type_group?: string | null; description?: string | null },
): Promise<ProblemType> {
  const { data: { session } } = await supabase.auth.getSession();
  const { data, error } = await supabase.from('problem_types').insert({
    workspace_id: workspaceId,
    type_code: genCode(input.type_name),
    type_name: input.type_name,
    type_group: input.type_group ?? null,
    description: input.description ?? null,
    created_by: session?.user?.id ?? null,
  }).select().single();
  if (error) throw new Error(formatError(error, 'Lỗi tạo loại vấn đề'));
  return data as ProblemType;
}

export async function updateProblemType(
  id: string,
  updates: Partial<Pick<ProblemType, 'type_name' | 'type_group' | 'description' | 'is_active'>>,
): Promise<void> {
  const { error } = await supabase
    .from('problem_types')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(formatError(error, 'Lỗi cập nhật loại vấn đề'));
}

export async function softDeleteProblemType(id: string): Promise<void> {
  const { error } = await supabase
    .from('problem_types')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(formatError(error, 'Lỗi xóa loại vấn đề'));
}

// --- Root Cause Types ---
export async function listRootCauseTypesManage(workspaceId: string): Promise<RootCauseType[]> {
  const { data, error } = await supabase
    .from('root_cause_types')
    .select('*')
    .match(shouldApplyUuidFilter(workspaceId) ? { workspace_id: workspaceId } : {})
    .is('deleted_at', null)
    .order('sort_order', { ascending: true });
  if (error) throw new Error(formatError(error, 'Lỗi tải loại nguyên nhân'));
  return (data || []) as RootCauseType[];
}

export async function createRootCauseType(
  workspaceId: string,
  input: { type_name: string; description?: string | null },
): Promise<RootCauseType> {
  const { data: { session } } = await supabase.auth.getSession();
  const { data, error } = await supabase.from('root_cause_types').insert({
    workspace_id: workspaceId,
    type_code: genCode(input.type_name),
    type_name: input.type_name,
    description: input.description ?? null,
    created_by: session?.user?.id ?? null,
  }).select().single();
  if (error) throw new Error(formatError(error, 'Lỗi tạo loại nguyên nhân'));
  return data as RootCauseType;
}

export async function updateRootCauseType(
  id: string,
  updates: Partial<Pick<RootCauseType, 'type_name' | 'description' | 'is_active'>>,
): Promise<void> {
  const { error } = await supabase
    .from('root_cause_types')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(formatError(error, 'Lỗi cập nhật loại nguyên nhân'));
}

export async function softDeleteRootCauseType(id: string): Promise<void> {
  const { error } = await supabase
    .from('root_cause_types')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(formatError(error, 'Lỗi xóa loại nguyên nhân'));
}
