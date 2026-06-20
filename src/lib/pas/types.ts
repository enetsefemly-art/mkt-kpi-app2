// PAS — TypeScript interfaces khớp với schema database (migrations 005-009).

export type Severity = 'Low' | 'Medium' | 'High' | 'Critical';
export type ProblemStatus = 'Open' | 'In Progress' | 'Pending' | 'Resolved';
export type ValidationStatus = 'Not Validated' | 'Validated' | 'Partially Validated' | 'Rejected';
export type ActionStatus = 'Pending' | 'Todo' | 'Doing' | 'Done' | 'Cancelled';
export type ResultSource = 'manual' | 'import' | 'api';
export type EvaluationResult = 'Pass' | 'Not Pass';
export type ManagerRating =
  | 'Hiệu quả cao'
  | 'Trung bình'
  | 'Thấp'
  | 'Cần thêm evidence'
  | 'Không còn khuyến nghị';

export interface ProblemType {
  id: string;
  workspace_id: string;
  type_code: string;
  type_name: string;
  type_group?: string | null;
  description?: string | null;
  is_active: boolean;
  sort_order: number;
  created_by_admin: boolean;
}

export interface RootCauseType {
  id: string;
  workspace_id: string;
  type_code: string;
  type_name: string;
  description?: string | null;
  is_active: boolean;
  sort_order: number;
  created_by_admin: boolean;
}

export interface Problem {
  id: string;
  workspace_id: string;
  department_id: string;
  problem_type_id?: string | null;
  problem_owner_id: string;
  related_kpi_id?: string | null;
  related_kpi_item_id?: string | null;
  problem_title: string;
  problem_description: string;
  severity: Severity;
  severity_confirmed_by?: string | null;
  severity_confirmed_at?: string | null;
  status: ProblemStatus;
  expected_resolve_date?: string | null;
  resolved_at?: string | null;
  resolved_by?: string | null;
  manager_note?: string | null;
  is_repeated: boolean;
  linked_previous_problem_id?: string | null;
  evidence_snapshot?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  created_by?: string | null;
}

export interface RootCause {
  id: string;
  workspace_id: string;
  problem_id: string;
  root_cause_type_id?: string | null;
  root_cause_note: string;
  evidence?: string | null;
  is_primary: boolean;
  validation_status: ValidationStatus;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  created_by?: string | null;
}

export interface Action {
  id: string;
  workspace_id: string;
  problem_id: string;
  root_cause_id?: string | null;
  action_title: string;
  action_description?: string | null;
  action_owner_id: string;
  deadline: string;
  status: ActionStatus;
  cancel_reason?: string | null;
  action_note?: string | null;
  deadline_changed_count: number;
  done_at?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  created_by?: string | null;
}
