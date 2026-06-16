-- 009_pas_seed_taxonomy.sql
--
-- Seed danh mục PAS (theo PRD 8.2 / 8.4) cho MỌI workspace hiện có.
-- Idempotent: chạy lại không tạo bản trùng (guard bằng NOT EXISTS theo type_code).
-- Admin sẽ tinh chỉnh thêm ở Phase 0.

-- ---------------------------------------------------------------------------
-- Problem Types (16)
-- ---------------------------------------------------------------------------
INSERT INTO public.problem_types (workspace_id, type_code, type_name, type_group, sort_order)
SELECT w.id, v.type_code, v.type_name, v.type_group, v.sort_order
FROM public.workspaces w
CROSS JOIN (VALUES
  ('content_no_click',      'Content không kéo được click', 'Content',      10),
  ('content_low_volume',    'Content thiếu volume',         'Content',      20),
  ('content_low_conversion','Content chuyển đổi thấp',      'Content',      30),
  ('cpl_up',                'CPL tăng',                     'Ads',          40),
  ('creative_fatigue',      'Creative fatigue',             'Ads',          50),
  ('audience_saturated',    'Audience saturated',           'Ads',          60),
  ('koc_no_lead',           'MI/KOC không ra lead',         'MI/KOC',       70),
  ('koc_quality_drop',      'KOC drop chất lượng',          'MI/KOC',       80),
  ('l2_l0_down',            'L2/L0 giảm',                   'Lead Quality', 90),
  ('lead_pass_rate_down',   'Lead pass rate giảm',          'Lead Quality', 100),
  ('approval_slow',         'Approval chậm',                'Process',      110),
  ('process_unclear',       'Quy trình thiếu rõ ràng',      'Process',      120),
  ('tracking_wrong',        'Tracking sai',                 'Data',         130),
  ('data_lag',              'Data lag',                     'Data',         140),
  ('team_understaffed',     'Thiếu nhân sự execute',        'Team',         150),
  ('comm_gap',              'Communication gap',            'Team',         160)
) AS v(type_code, type_name, type_group, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.problem_types pt
  WHERE pt.workspace_id = w.id AND pt.type_code = v.type_code AND pt.deleted_at IS NULL
);

-- ---------------------------------------------------------------------------
-- Root Cause Types (13)
-- ---------------------------------------------------------------------------
INSERT INTO public.root_cause_types (workspace_id, type_code, type_name, sort_order)
SELECT w.id, v.type_code, v.type_name, v.sort_order
FROM public.workspaces w
CROSS JOIN (VALUES
  ('hook_angle',          'Hook/angle chưa đúng',  10),
  ('cta_unclear',         'CTA chưa rõ',           20),
  ('format_mismatch',     'Format không phù hợp',  30),
  ('audience_saturated',  'Audience bão hòa',      40),
  ('topic_unattractive',  'Topic không hấp dẫn',   50),
  ('creative_fatigue',    'Creative fatigue',      60),
  ('bidding_wrong',       'Bidding strategy sai',  70),
  ('budget_insufficient', 'Budget không đủ',       80),
  ('tracking_error',      'Tracking lỗi',          90),
  ('lead_quality_poor',   'Lead quality kém',      100),
  ('consult_process_weak','Process tư vấn yếu',    110),
  ('offer_unattractive',  'Offer không hấp dẫn',   120),
  ('product_not_fit',     'Sản phẩm không fit',    130)
) AS v(type_code, type_name, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.root_cause_types rct
  WHERE rct.workspace_id = w.id AND rct.type_code = v.type_code AND rct.deleted_at IS NULL
);

-- ---------------------------------------------------------------------------
-- Mapping gợi ý (theo PRD 8.4 — 3 ví dụ; admin bổ sung ở Phase 0)
-- ---------------------------------------------------------------------------
INSERT INTO public.problem_type_root_cause_map (workspace_id, problem_type_id, root_cause_type_id, priority_order)
SELECT pt.workspace_id, pt.id, rct.id, m.priority_order
FROM (VALUES
  -- Content không kéo được click
  ('content_no_click','hook_angle',         1),
  ('content_no_click','cta_unclear',         2),
  ('content_no_click','format_mismatch',     3),
  ('content_no_click','audience_saturated',  4),
  ('content_no_click','topic_unattractive',  5),
  ('content_no_click','creative_fatigue',    6),
  -- CPL tăng
  ('cpl_up','audience_saturated',  1),
  ('cpl_up','creative_fatigue',    2),
  ('cpl_up','bidding_wrong',       3),
  ('cpl_up','budget_insufficient', 4),
  ('cpl_up','tracking_error',      5),
  -- L2/L0 giảm
  ('l2_l0_down','lead_quality_poor',    1),
  ('l2_l0_down','consult_process_weak', 2),
  ('l2_l0_down','offer_unattractive',   3),
  ('l2_l0_down','product_not_fit',      4)
) AS m(pt_code, rct_code, priority_order)
JOIN public.problem_types    pt  ON pt.type_code  = m.pt_code  AND pt.deleted_at  IS NULL
JOIN public.root_cause_types rct ON rct.type_code = m.rct_code AND rct.workspace_id = pt.workspace_id AND rct.deleted_at IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.problem_type_root_cause_map x
  WHERE x.problem_type_id = pt.id AND x.root_cause_type_id = rct.id
);

-- ===========================================================================
-- ROLLBACK (xóa seed — chỉ xóa các bản do seed tạo theo type_code)
-- ===========================================================================
-- DELETE FROM public.problem_type_root_cause_map;  -- hoặc lọc theo code nếu cần
-- DELETE FROM public.root_cause_types  WHERE type_code IN ('hook_angle', ...);
-- DELETE FROM public.problem_types     WHERE type_code IN ('content_no_click', ...);
