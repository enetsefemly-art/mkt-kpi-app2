-- 011_pas_feedback.sql
--
-- Theo feedback Sprint 2:
--   1) Thêm cột `evidence` cho root_causes (dẫn chứng khi nguyên nhân "Đã verify").
--   2) Cho Manager (không chỉ Director) quản lý taxonomy, giới hạn trong workspace mình.
--   3) (Idempotent) vá lại tên taxonomy nếu bị mojibake từ lần seed trước.

-- ---------------------------------------------------------------------------
-- 1) Cột evidence cho root_causes
-- ---------------------------------------------------------------------------
ALTER TABLE public.root_causes ADD COLUMN IF NOT EXISTS evidence text;

-- ---------------------------------------------------------------------------
-- 2) RLS taxonomy: Director (mọi workspace) + Manager (workspace mình)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS problem_types_write ON public.problem_types;
CREATE POLICY problem_types_write ON public.problem_types FOR ALL
  USING (
    public.current_user_role() IN ('director','admin')
    OR (public.current_user_role() IN ('manager','lead') AND workspace_id IN (SELECT public.my_workspace_ids()))
  )
  WITH CHECK (
    public.current_user_role() IN ('director','admin')
    OR (public.current_user_role() IN ('manager','lead') AND workspace_id IN (SELECT public.my_workspace_ids()))
  );

DROP POLICY IF EXISTS root_cause_types_write ON public.root_cause_types;
CREATE POLICY root_cause_types_write ON public.root_cause_types FOR ALL
  USING (
    public.current_user_role() IN ('director','admin')
    OR (public.current_user_role() IN ('manager','lead') AND workspace_id IN (SELECT public.my_workspace_ids()))
  )
  WITH CHECK (
    public.current_user_role() IN ('director','admin')
    OR (public.current_user_role() IN ('manager','lead') AND workspace_id IN (SELECT public.my_workspace_ids()))
  );

DROP POLICY IF EXISTS pt_rc_map_write ON public.problem_type_root_cause_map;
CREATE POLICY pt_rc_map_write ON public.problem_type_root_cause_map FOR ALL
  USING (
    public.current_user_role() IN ('director','admin')
    OR (public.current_user_role() IN ('manager','lead') AND workspace_id IN (SELECT public.my_workspace_ids()))
  )
  WITH CHECK (
    public.current_user_role() IN ('director','admin')
    OR (public.current_user_role() IN ('manager','lead') AND workspace_id IN (SELECT public.my_workspace_ids()))
  );

-- ---------------------------------------------------------------------------
-- 3) Vá text taxonomy (idempotent) — phòng trường hợp seed cũ bị mojibake
-- ---------------------------------------------------------------------------
UPDATE public.problem_types pt SET type_name = v.type_name, type_group = v.type_group
FROM (VALUES
  ('content_no_click',      'Content không kéo được click', 'Content'),
  ('content_low_volume',    'Content thiếu volume',         'Content'),
  ('content_low_conversion','Content chuyển đổi thấp',      'Content'),
  ('cpl_up',                'CPL tăng',                     'Ads'),
  ('creative_fatigue',      'Creative fatigue',             'Ads'),
  ('audience_saturated',    'Audience saturated',           'Ads'),
  ('koc_no_lead',           'MI/KOC không ra lead',         'MI/KOC'),
  ('koc_quality_drop',      'KOC drop chất lượng',          'MI/KOC'),
  ('l2_l0_down',            'L2/L0 giảm',                   'Lead Quality'),
  ('lead_pass_rate_down',   'Lead pass rate giảm',          'Lead Quality'),
  ('approval_slow',         'Approval chậm',                'Process'),
  ('process_unclear',       'Quy trình thiếu rõ ràng',      'Process'),
  ('tracking_wrong',        'Tracking sai',                 'Data'),
  ('data_lag',              'Data lag',                     'Data'),
  ('team_understaffed',     'Thiếu nhân sự execute',        'Team'),
  ('comm_gap',              'Communication gap',            'Team')
) AS v(type_code, type_name, type_group)
WHERE pt.type_code = v.type_code;

UPDATE public.root_cause_types rct SET type_name = v.type_name
FROM (VALUES
  ('hook_angle',          'Hook/angle chưa đúng'),
  ('cta_unclear',         'CTA chưa rõ'),
  ('format_mismatch',     'Format không phù hợp'),
  ('audience_saturated',  'Audience bão hòa'),
  ('topic_unattractive',  'Topic không hấp dẫn'),
  ('creative_fatigue',    'Creative fatigue'),
  ('bidding_wrong',       'Bidding strategy sai'),
  ('budget_insufficient', 'Budget không đủ'),
  ('tracking_error',      'Tracking lỗi'),
  ('lead_quality_poor',   'Lead quality kém'),
  ('consult_process_weak','Process tư vấn yếu'),
  ('offer_unattractive',  'Offer không hấp dẫn'),
  ('product_not_fit',     'Sản phẩm không fit')
) AS v(type_code, type_name)
WHERE rct.type_code = v.type_code;

-- ===========================================================================
-- ROLLBACK
-- ===========================================================================
-- ALTER TABLE public.root_causes DROP COLUMN IF EXISTS evidence;
-- (Khôi phục RLS taxonomy về chỉ Director: xem migration 008.)
