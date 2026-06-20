import { supabase } from '../supabaseClient';
import { formatError } from '../errorUtils';
import { shouldApplyUuidFilter, cleanUuid } from '../uuid';
import { logActivity } from '../activityLogger';
import type { SolutionPattern, ManagerRating } from './types';

export interface PatternFilters {
  problemTypeId?: string | null;
  rootCauseTypeId?: string | null;
  keyword?: string;
}

export async function listPatterns(workspaceId: string, filters: PatternFilters = {}): Promise<SolutionPattern[]> {
  let query = supabase
    .from('solution_patterns')
    .select('*')
    .match(shouldApplyUuidFilter(workspaceId) ? { workspace_id: workspaceId } : {})
    .is('deleted_at', null);

  if (filters.problemTypeId && shouldApplyUuidFilter(filters.problemTypeId)) query = query.eq('problem_type_id', filters.problemTypeId);
  if (filters.rootCauseTypeId && shouldApplyUuidFilter(filters.rootCauseTypeId)) query = query.eq('root_cause_type_id', filters.rootCauseTypeId);
  if (filters.keyword && filters.keyword.trim()) {
    const kw = `%${filters.keyword.trim()}%`;
    query = query.or(`pattern_name.ilike.${kw},pattern_description.ilike.${kw}`);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw new Error(formatError(error, 'Lỗi tải thư viện giải pháp'));
  return (data || []) as SolutionPattern[];
}

export async function getPattern(patternId: string): Promise<SolutionPattern | null> {
  const { data, error } = await supabase
    .from('solution_patterns')
    .select('*')
    .eq('id', patternId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw new Error(formatError(error, 'Lỗi tải pattern'));
  return (data as SolutionPattern) || null;
}

export interface CreatePatternInput {
  workspace_id: string;
  source_action_id: string;
  pattern_name: string;
  pattern_description: string;
  apply_when: string;
  do_not_apply_when: string;
  problem_type_id?: string | null;
  root_cause_type_id?: string | null;
  metric_signal?: string | null;
  function_team?: string | null;
  channel?: string | null;
  product_id?: string | null;
  limitation_note?: string | null;
  manager_rating?: ManagerRating | null;
}

export async function createPattern(input: CreatePatternInput): Promise<SolutionPattern> {
  const { data: { session } } = await supabase.auth.getSession();
  const { data, error } = await supabase
    .from('solution_patterns')
    .insert({
      ...input,
      problem_type_id: cleanUuid(input.problem_type_id),
      root_cause_type_id: cleanUuid(input.root_cause_type_id),
      product_id: cleanUuid(input.product_id),
      created_by: session?.user?.id ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(formatError(error, 'Lỗi tạo Solution Pattern'));
  await logActivity({ workspaceId: input.workspace_id, entityType: 'pattern', entityId: data.id, action: 'created', detail: { name: input.pattern_name } });
  return data as SolutionPattern;
}

export async function updatePattern(patternId: string, workspaceId: string, updates: Partial<SolutionPattern>): Promise<void> {
  const { error } = await supabase
    .from('solution_patterns')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', patternId);
  if (error) throw new Error(formatError(error, 'Lỗi cập nhật pattern'));
  await logActivity({ workspaceId, entityType: 'pattern', entityId: patternId, action: 'updated' });
}

export async function softDeletePattern(patternId: string, workspaceId: string): Promise<void> {
  const { error } = await supabase
    .from('solution_patterns')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', patternId);
  if (error) throw new Error(formatError(error, 'Lỗi xóa pattern'));
  await logActivity({ workspaceId, entityType: 'pattern', entityId: patternId, action: 'deleted' });
}

// Action đã Pass nhưng chưa được chuẩn hóa thành Pattern (ứng viên cho thư viện).
export async function listLibraryCandidateActionIds(workspaceId: string): Promise<string[]> {
  const { data: evals, error: e1 } = await supabase
    .from('action_evaluations')
    .select('action_id, evaluation')
    .match(shouldApplyUuidFilter(workspaceId) ? { workspace_id: workspaceId } : {})
    .eq('evaluation', 'Pass')
    .is('deleted_at', null);
  if (e1) throw new Error(formatError(e1, 'Lỗi tải ứng viên thư viện'));
  const passed = new Set((evals || []).map((e: any) => e.action_id));

  const { data: pats, error: e2 } = await supabase
    .from('solution_patterns')
    .select('source_action_id')
    .match(shouldApplyUuidFilter(workspaceId) ? { workspace_id: workspaceId } : {})
    .is('deleted_at', null);
  if (e2) throw new Error(formatError(e2, 'Lỗi tải pattern'));
  (pats || []).forEach((p: any) => passed.delete(p.source_action_id));

  return Array.from(passed);
}
