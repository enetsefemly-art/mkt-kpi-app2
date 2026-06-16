-- 007_pas_library.sql
--
-- Solution Pattern (thư viện giải pháp). 1 pattern - 1 source action (MVP).
-- Manager tạo từ action đã Pass; mọi role được xem.

CREATE TABLE IF NOT EXISTS public.solution_patterns (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source_action_id    uuid NOT NULL REFERENCES public.actions(id) ON DELETE RESTRICT,
  pattern_name        text NOT NULL,
  pattern_description text NOT NULL,
  problem_type_id     uuid REFERENCES public.problem_types(id) ON DELETE SET NULL,
  root_cause_type_id  uuid REFERENCES public.root_cause_types(id) ON DELETE SET NULL,
  metric_signal       text,
  function_team       text,
  channel             text,
  product_id          uuid REFERENCES public.products(id) ON DELETE SET NULL,
  apply_when          text NOT NULL,
  do_not_apply_when   text NOT NULL,
  limitation_note     text,
  manager_rating      text
                        CHECK (manager_rating IN
                          ('Hiệu quả cao','Trung bình','Thấp','Cần thêm evidence','Không còn khuyến nghị')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz,
  created_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_solution_patterns_ws_ptype
  ON public.solution_patterns (workspace_id, problem_type_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_solution_patterns_source_action
  ON public.solution_patterns (source_action_id) WHERE deleted_at IS NULL;

-- ===========================================================================
-- ROLLBACK
-- ===========================================================================
-- DROP TABLE IF EXISTS public.solution_patterns;
