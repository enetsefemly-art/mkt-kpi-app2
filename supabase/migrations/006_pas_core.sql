-- 006_pas_core.sql
--
-- Bảng lõi PAS: problems, root_causes, actions, action_results, action_evaluations.
-- Dùng text + CHECK cho các trường trạng thái (giống pattern kpi_items/digests
-- hiện có) để dễ mở rộng, không dùng Postgres ENUM.
-- FK tới KPI là "lỏng" (ON DELETE SET NULL) — xóa KPI KHÔNG xóa problem.

-- ---------------------------------------------------------------------------
-- problems
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.problems (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id               uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  department_id              uuid NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  problem_type_id            uuid REFERENCES public.problem_types(id) ON DELETE SET NULL,
  problem_owner_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  related_kpi_id             uuid REFERENCES public.kpis(id) ON DELETE SET NULL,
  related_kpi_item_id        uuid REFERENCES public.kpi_items(id) ON DELETE SET NULL,
  problem_title              text NOT NULL,
  problem_description        text NOT NULL,
  severity                   text NOT NULL DEFAULT 'Medium'
                               CHECK (severity IN ('Low','Medium','High','Critical')),
  severity_confirmed_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  severity_confirmed_at      timestamptz,
  status                     text NOT NULL DEFAULT 'Open'
                               CHECK (status IN ('Open','In Progress','Pending','Resolved')),
  expected_resolve_date      date,
  resolved_at                timestamptz,
  resolved_by                uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  manager_note               text,
  is_repeated                boolean NOT NULL DEFAULT false,
  linked_previous_problem_id uuid REFERENCES public.problems(id) ON DELETE SET NULL,
  evidence_snapshot          jsonb,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  deleted_at                 timestamptz,
  created_by                 uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_problems_ws_dept_status
  ON public.problems (workspace_id, department_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_problems_owner
  ON public.problems (problem_owner_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_problems_related_kpi
  ON public.problems (related_kpi_id) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- root_causes (1 problem có nhiều; chỉ 1 primary tại 1 thời điểm)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.root_causes (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  problem_id         uuid NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
  root_cause_type_id uuid REFERENCES public.root_cause_types(id) ON DELETE SET NULL,
  root_cause_note    text NOT NULL,
  is_primary         boolean NOT NULL DEFAULT false,
  validation_status  text NOT NULL DEFAULT 'Not Validated'
                       CHECK (validation_status IN ('Not Validated','Validated','Partially Validated','Rejected')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz,
  created_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_root_causes_problem
  ON public.root_causes (problem_id) WHERE deleted_at IS NULL;
-- DB enforce: tối đa 1 primary root cause cho mỗi problem (bản chưa xóa mềm)
CREATE UNIQUE INDEX IF NOT EXISTS uq_root_causes_one_primary
  ON public.root_causes (problem_id) WHERE is_primary AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- actions (1 problem nhiều action; mỗi action gắn 0/1 root cause)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.actions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id           uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  problem_id             uuid NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
  root_cause_id          uuid REFERENCES public.root_causes(id) ON DELETE SET NULL,
  action_title           text NOT NULL,
  action_description     text,
  action_owner_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  deadline               date NOT NULL,
  status                 text NOT NULL DEFAULT 'Todo'
                           CHECK (status IN ('Pending','Todo','Doing','Done','Cancelled')),
  cancel_reason          text,
  action_note            text,
  deadline_changed_count integer NOT NULL DEFAULT 0,
  done_at                timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  deleted_at             timestamptz,
  created_by             uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Cancel bắt buộc có lý do
  CONSTRAINT chk_actions_cancel_reason
    CHECK (status <> 'Cancelled' OR (cancel_reason IS NOT NULL AND length(btrim(cancel_reason)) > 0))
);
CREATE INDEX IF NOT EXISTS idx_actions_problem_status
  ON public.actions (problem_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_actions_owner_deadline
  ON public.actions (action_owner_id, deadline) WHERE deleted_at IS NULL;

-- is_overdue KHÔNG lưu cứng (vì phụ thuộc ngày hiện tại). Tính qua view.
-- security_invoker = true: view áp dụng RLS theo user đang query (không lộ chéo workspace).
CREATE OR REPLACE VIEW public.actions_with_overdue
WITH (security_invoker = true) AS
SELECT a.*,
       (a.deadline < CURRENT_DATE AND a.status NOT IN ('Done','Cancelled')) AS is_overdue
FROM public.actions a;

-- ---------------------------------------------------------------------------
-- action_results (1:1 với action — UNIQUE action_id)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.action_results (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id               uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  action_id                  uuid NOT NULL UNIQUE REFERENCES public.actions(id) ON DELETE CASCADE,
  result_note                text NOT NULL,
  primary_result_metric_name text,
  before_value               numeric,
  after_value                numeric,
  unit                       text,
  captured_at                timestamptz,
  source                     text NOT NULL DEFAULT 'manual'
                               CHECK (source IN ('manual','import','api')),
  is_locked                  boolean NOT NULL DEFAULT false,
  locked_at                  timestamptz,
  updated_by                 uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  deleted_at                 timestamptz,
  created_by                 uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------------
-- action_evaluations (1:1 với action — UNIQUE action_id). Pass/Not Pass.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.action_evaluations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  action_id       uuid NOT NULL UNIQUE REFERENCES public.actions(id) ON DELETE CASCADE,
  evaluation      text NOT NULL CHECK (evaluation IN ('Pass','Not Pass')),
  evaluation_note text,
  evaluated_by    uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  evaluated_at    timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

-- ===========================================================================
-- ROLLBACK
-- ===========================================================================
-- DROP VIEW IF EXISTS public.actions_with_overdue;
-- DROP TABLE IF EXISTS public.action_evaluations;
-- DROP TABLE IF EXISTS public.action_results;
-- DROP TABLE IF EXISTS public.actions;
-- DROP TABLE IF EXISTS public.root_causes;
-- DROP TABLE IF EXISTS public.problems;
