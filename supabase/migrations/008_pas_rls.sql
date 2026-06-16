-- 008_pas_rls.sql
--
-- Row Level Security cho mọi bảng PAS. Mô hình: "XEM tất cả / SỬA giới hạn".
--
--   READ  (SELECT): mọi user trong workspace xem được TẤT CẢ (kho tri thức,
--          xuyên phòng ban). Scope theo workspace qua my_workspace_ids().
--   WRITE (INSERT/UPDATE):
--          - Director/admin: toàn bộ
--          - Manager/lead: phạm vi phòng ban mình (qua department của problem)
--          - Member: dữ liệu của chính mình (owner hoặc created_by)
--          - Đánh giá Pass/Not Pass: chỉ Director/Manager
--          - Taxonomy: chỉ Director
--   DELETE: không cấp policy -> không ai hard-delete. Xóa = soft delete qua UPDATE.
--
-- Dùng các hàm helper đã có trên production (đã thêm row_security off ở migration 010):
--   current_user_role(), current_user_status(), current_user_department_id(),
--   my_workspace_ids().

-- ===========================================================================
-- TAXONOMY: đọc theo workspace, ghi chỉ Director
-- ===========================================================================
ALTER TABLE public.problem_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY problem_types_select ON public.problem_types FOR SELECT
  USING (workspace_id IN (SELECT public.my_workspace_ids()));
CREATE POLICY problem_types_write ON public.problem_types FOR ALL
  USING (public.current_user_role() IN ('director','admin'))
  WITH CHECK (public.current_user_role() IN ('director','admin'));

ALTER TABLE public.root_cause_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY root_cause_types_select ON public.root_cause_types FOR SELECT
  USING (workspace_id IN (SELECT public.my_workspace_ids()));
CREATE POLICY root_cause_types_write ON public.root_cause_types FOR ALL
  USING (public.current_user_role() IN ('director','admin'))
  WITH CHECK (public.current_user_role() IN ('director','admin'));

ALTER TABLE public.problem_type_root_cause_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY pt_rc_map_select ON public.problem_type_root_cause_map FOR SELECT
  USING (workspace_id IN (SELECT public.my_workspace_ids()));
CREATE POLICY pt_rc_map_write ON public.problem_type_root_cause_map FOR ALL
  USING (public.current_user_role() IN ('director','admin'))
  WITH CHECK (public.current_user_role() IN ('director','admin'));

-- ===========================================================================
-- PROBLEMS
-- ===========================================================================
ALTER TABLE public.problems ENABLE ROW LEVEL SECURITY;

-- READ: cả workspace
CREATE POLICY problems_select ON public.problems FOR SELECT
  USING (workspace_id IN (SELECT public.my_workspace_ids()));

-- INSERT: user active; director / manager(phòng mình) / member(chính mình)
CREATE POLICY problems_insert ON public.problems FOR INSERT
  WITH CHECK (
    public.current_user_status() = 'active'
    AND workspace_id IN (SELECT public.my_workspace_ids())
    AND (
      public.current_user_role() IN ('director','admin')
      OR (public.current_user_role() IN ('manager','lead') AND department_id = public.current_user_department_id())
      OR problem_owner_id = auth.uid()
      OR created_by = auth.uid()
    )
  );

-- UPDATE (gồm cả soft delete): director / manager(phòng mình) / member(của mình)
CREATE POLICY problems_update ON public.problems FOR UPDATE
  USING (
    public.current_user_status() = 'active'
    AND (
      public.current_user_role() IN ('director','admin')
      OR (public.current_user_role() IN ('manager','lead') AND department_id = public.current_user_department_id())
      OR problem_owner_id = auth.uid()
      OR created_by = auth.uid()
    )
  );

-- ===========================================================================
-- ROOT_CAUSES (scope ghi theo problem cha)
-- ===========================================================================
ALTER TABLE public.root_causes ENABLE ROW LEVEL SECURITY;

CREATE POLICY root_causes_select ON public.root_causes FOR SELECT
  USING (workspace_id IN (SELECT public.my_workspace_ids()));

CREATE POLICY root_causes_insert ON public.root_causes FOR INSERT
  WITH CHECK (
    public.current_user_status() = 'active'
    AND (
      public.current_user_role() IN ('director','admin')
      OR EXISTS (SELECT 1 FROM public.problems p WHERE p.id = problem_id AND (
            (public.current_user_role() IN ('manager','lead') AND p.department_id = public.current_user_department_id())
            OR p.problem_owner_id = auth.uid()
            OR p.created_by = auth.uid()
         ))
      OR created_by = auth.uid()
    )
  );

CREATE POLICY root_causes_update ON public.root_causes FOR UPDATE
  USING (
    public.current_user_status() = 'active'
    AND (
      public.current_user_role() IN ('director','admin')
      OR EXISTS (SELECT 1 FROM public.problems p WHERE p.id = problem_id AND (
            (public.current_user_role() IN ('manager','lead') AND p.department_id = public.current_user_department_id())
            OR p.problem_owner_id = auth.uid()
            OR p.created_by = auth.uid()
         ))
      OR created_by = auth.uid()
    )
  );

-- ===========================================================================
-- ACTIONS (scope ghi theo problem cha + action owner)
-- ===========================================================================
ALTER TABLE public.actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY actions_select ON public.actions FOR SELECT
  USING (workspace_id IN (SELECT public.my_workspace_ids()));

CREATE POLICY actions_insert ON public.actions FOR INSERT
  WITH CHECK (
    public.current_user_status() = 'active'
    AND (
      public.current_user_role() IN ('director','admin')
      OR action_owner_id = auth.uid()
      OR created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.problems p WHERE p.id = problem_id AND (
            (public.current_user_role() IN ('manager','lead') AND p.department_id = public.current_user_department_id())
            OR p.problem_owner_id = auth.uid()
         ))
    )
  );

CREATE POLICY actions_update ON public.actions FOR UPDATE
  USING (
    public.current_user_status() = 'active'
    AND (
      public.current_user_role() IN ('director','admin')
      OR action_owner_id = auth.uid()
      OR created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.problems p WHERE p.id = problem_id AND (
            (public.current_user_role() IN ('manager','lead') AND p.department_id = public.current_user_department_id())
            OR p.problem_owner_id = auth.uid()
         ))
    )
  );

-- ===========================================================================
-- ACTION_RESULTS (scope ghi theo action -> problem; owner cập nhật khi chưa khóa)
-- ===========================================================================
ALTER TABLE public.action_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY action_results_select ON public.action_results FOR SELECT
  USING (workspace_id IN (SELECT public.my_workspace_ids()));

CREATE POLICY action_results_insert ON public.action_results FOR INSERT
  WITH CHECK (
    public.current_user_status() = 'active'
    AND (
      public.current_user_role() IN ('director','admin')
      OR EXISTS (SELECT 1 FROM public.actions a JOIN public.problems p ON p.id = a.problem_id
                 WHERE a.id = action_id AND (
                   a.action_owner_id = auth.uid()
                   OR p.problem_owner_id = auth.uid()
                   OR (public.current_user_role() IN ('manager','lead') AND p.department_id = public.current_user_department_id())
                 ))
    )
  );

CREATE POLICY action_results_update ON public.action_results FOR UPDATE
  USING (
    public.current_user_status() = 'active'
    AND (
      public.current_user_role() IN ('director','admin')
      OR EXISTS (SELECT 1 FROM public.actions a JOIN public.problems p ON p.id = a.problem_id
                 WHERE a.id = action_id AND (
                   a.action_owner_id = auth.uid()
                   OR p.problem_owner_id = auth.uid()
                   OR (public.current_user_role() IN ('manager','lead') AND p.department_id = public.current_user_department_id())
                 ))
    )
  );

-- ===========================================================================
-- ACTION_EVALUATIONS: Pass/Not Pass — CHỈ Director/Manager(phòng mình)
-- ===========================================================================
ALTER TABLE public.action_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY action_evaluations_select ON public.action_evaluations FOR SELECT
  USING (workspace_id IN (SELECT public.my_workspace_ids()));

CREATE POLICY action_evaluations_write ON public.action_evaluations FOR ALL
  USING (
    public.current_user_status() = 'active'
    AND (
      public.current_user_role() IN ('director','admin')
      OR EXISTS (SELECT 1 FROM public.actions a JOIN public.problems p ON p.id = a.problem_id
                 WHERE a.id = action_id
                   AND public.current_user_role() IN ('manager','lead')
                   AND p.department_id = public.current_user_department_id())
    )
  )
  WITH CHECK (
    public.current_user_status() = 'active'
    AND (
      public.current_user_role() IN ('director','admin')
      OR EXISTS (SELECT 1 FROM public.actions a JOIN public.problems p ON p.id = a.problem_id
                 WHERE a.id = action_id
                   AND public.current_user_role() IN ('manager','lead')
                   AND p.department_id = public.current_user_department_id())
    )
  );

-- ===========================================================================
-- SOLUTION_PATTERNS: xem cả workspace; ghi Director / Manager(phòng của source action)
-- ===========================================================================
ALTER TABLE public.solution_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY solution_patterns_select ON public.solution_patterns FOR SELECT
  USING (workspace_id IN (SELECT public.my_workspace_ids()));

CREATE POLICY solution_patterns_write ON public.solution_patterns FOR ALL
  USING (
    public.current_user_status() = 'active'
    AND (
      public.current_user_role() IN ('director','admin')
      OR EXISTS (SELECT 1 FROM public.actions a JOIN public.problems p ON p.id = a.problem_id
                 WHERE a.id = source_action_id
                   AND public.current_user_role() IN ('manager','lead')
                   AND p.department_id = public.current_user_department_id())
    )
  )
  WITH CHECK (
    public.current_user_status() = 'active'
    AND (
      public.current_user_role() IN ('director','admin')
      OR EXISTS (SELECT 1 FROM public.actions a JOIN public.problems p ON p.id = a.problem_id
                 WHERE a.id = source_action_id
                   AND public.current_user_role() IN ('manager','lead')
                   AND p.department_id = public.current_user_department_id())
    )
  );

-- ===========================================================================
-- GRANTS: cấp quyền bảng cho role API (RLS nằm trên grants)
-- ===========================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.problem_types,
  public.root_cause_types,
  public.problem_type_root_cause_map,
  public.problems,
  public.root_causes,
  public.actions,
  public.action_results,
  public.action_evaluations,
  public.solution_patterns
TO authenticated, service_role;

GRANT SELECT ON public.actions_with_overdue TO authenticated, service_role;

-- ===========================================================================
-- ROLLBACK
-- ===========================================================================
-- ALTER TABLE public.problem_types DISABLE ROW LEVEL SECURITY;  -- (lặp lại cho mọi bảng)
-- DROP POLICY IF EXISTS problems_select ON public.problems;     -- ... và các policy khác
-- (Đơn giản nhất khi rollback toàn bộ: chạy rollback của 005-007 sẽ drop bảng kèm policy.)
