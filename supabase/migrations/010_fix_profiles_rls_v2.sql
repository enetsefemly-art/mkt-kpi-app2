-- 010_fix_profiles_rls_v2.sql
--
-- MỤC ĐÍCH: Fix triệt để lỗi RLS recursion trên bảng profiles.
--
-- NGUYÊN NHÂN GỐC:
--   Policy `profiles_select_policy` (và `profiles_update_policy`) gọi 3 hàm helper:
--     - current_user_role()
--     - current_user_status()
--     - current_user_department_id()
--   3 hàm này đọc trực tiếp từ bảng public.profiles, nhưng KHÔNG có
--   `SET row_security TO 'off'`. Do đó khi RLS chạy chúng bên trong policy của
--   chính profiles -> policy gọi lại hàm -> hàm đọc profiles -> policy chạy lại
--   -> recursion vô tận (Postgres error 42P17: infinite recursion detected).
--
--   Đối chiếu: 2 hàm has_workspace_role() và my_workspace_ids() ĐÃ có
--   `SET row_security TO 'off'` nên không bị lỗi. Migration này làm 3 hàm còn lại
--   nhất quán với chúng.
--
-- CÁCH FIX:
--   CREATE OR REPLACE 3 hàm, thêm đúng 1 dòng `SET row_security TO 'off'` mỗi hàm.
--   Không thay đổi logic SQL bên trong, không sửa cấu trúc policy.
--
-- PHẠM VI ẢNH HƯỞNG:
--   3 hàm này còn được dùng trong policy của kpis, kpi_items (migration 003) và
--   nhiều bảng PAS sau này. Phải test trên STAGING trước: login bằng
--   director / manager / member và kiểm tra KPI hiển thị đúng.
--
-- KHÔNG tự chạy file này lên production. Chạy staging trước, verify OK rồi mới production.

-- =========================================================================
-- FIX
-- =========================================================================

CREATE OR REPLACE FUNCTION public.current_user_role() RETURNS text
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
  select role
  from public.profiles
  where user_id = auth.uid()
  limit 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_status() RETURNS text
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
  select status
  from public.profiles
  where user_id = auth.uid()
  limit 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_department_id() RETURNS uuid
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
  select department_id
  from public.profiles
  where user_id = auth.uid()
  limit 1;
$$;

-- =========================================================================
-- ROLLBACK (nếu cần khôi phục trạng thái cũ — chạy đoạn dưới đây)
-- =========================================================================
-- Gỡ bỏ `SET row_security TO 'off'` để đưa 3 hàm về như trước migration này.
-- LƯU Ý: rollback sẽ làm lỗi recursion quay lại — chỉ dùng khi migration gây
-- sự cố nghiêm trọng và cần về trạng thái cũ để điều tra.
--
-- CREATE OR REPLACE FUNCTION public.current_user_role() RETURNS text
--     LANGUAGE sql SECURITY DEFINER
--     SET search_path TO 'public'
--     AS $$
--   select role from public.profiles where user_id = auth.uid() limit 1;
-- $$;
--
-- CREATE OR REPLACE FUNCTION public.current_user_status() RETURNS text
--     LANGUAGE sql SECURITY DEFINER
--     SET search_path TO 'public'
--     AS $$
--   select status from public.profiles where user_id = auth.uid() limit 1;
-- $$;
--
-- CREATE OR REPLACE FUNCTION public.current_user_department_id() RETURNS uuid
--     LANGUAGE sql SECURITY DEFINER
--     SET search_path TO 'public'
--     AS $$
--   select department_id from public.profiles where user_id = auth.uid() limit 1;
-- $$;
