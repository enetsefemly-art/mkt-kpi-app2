import { supabase } from '../supabaseClient';
import { formatError } from '../errorUtils';
import { shouldApplyUuidFilter } from '../uuid';
import type { Problem } from './types';

// Gợi ý "vấn đề lặp lại": tìm problem khác trong 4 tuần gần đây
// CÙNG problem_type + CÙNG department, khác problem hiện tại (chưa xóa).
// (Theo PRD 9.10 — rule đơn giản; root cause type được kiểm thêm ở UI nếu cần.)
export async function findSimilarProblems(currentProblem: Problem): Promise<Problem[]> {
  if (!currentProblem.problem_type_id || !shouldApplyUuidFilter(currentProblem.workspace_id)) return [];

  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

  const { data, error } = await supabase
    .from('problems')
    .select('*')
    .eq('workspace_id', currentProblem.workspace_id)
    .eq('problem_type_id', currentProblem.problem_type_id)
    .eq('department_id', currentProblem.department_id)
    .neq('id', currentProblem.id)
    .is('deleted_at', null)
    .gte('created_at', fourWeeksAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) throw new Error(formatError(error, 'Lỗi tìm vấn đề lặp lại'));
  return (data || []) as Problem[];
}
