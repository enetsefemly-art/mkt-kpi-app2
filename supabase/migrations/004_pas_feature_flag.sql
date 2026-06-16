-- 004_pas_feature_flag.sql
--
-- MỤC ĐÍCH: Thêm feature flag bật/tắt module PAS cho từng workspace.
--
-- CHI TIẾT:
--   Thêm cột `pas_enabled` (boolean) vào bảng workspaces, mặc định FALSE.
--   - FALSE (mặc định): PAS bị ẩn hoàn toàn với workspace đó (menu PAS không hiện,
--     route PAS redirect về dashboard). Đây là trạng thái cho MỌI workspace cho đến
--     khi bật thủ công ở Phase 1 pilot.
--   - TRUE: workspace đó thấy và dùng được PAS.
--
-- AN TOÀN: Chỉ thêm 1 cột với default FALSE -> không ảnh hưởng KPI, không user nào
--   thấy gì khác sau khi chạy. Dùng IF NOT EXISTS để chạy lại nhiều lần không lỗi.
--
-- Migration này là bước đầu của module PAS (đánh số 004, tiếp nối 001-003 đã có).
-- Các migration PAS tiếp theo (taxonomy, core tables, RLS, seed) sẽ là 005-009.

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS pas_enabled boolean NOT NULL DEFAULT false;

-- =========================================================================
-- ROLLBACK (chạy đoạn dưới nếu cần gỡ cột này)
-- =========================================================================
-- ALTER TABLE public.workspaces DROP COLUMN IF EXISTS pas_enabled;
