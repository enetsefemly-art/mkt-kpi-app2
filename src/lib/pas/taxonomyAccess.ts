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
