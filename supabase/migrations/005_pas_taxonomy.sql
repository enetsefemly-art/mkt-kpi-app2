-- 005_pas_taxonomy.sql
--
-- Taxonomy (danh mục) cho PAS: loại vấn đề, loại nguyên nhân, và bảng map giữa 2.
-- Mọi bảng theo convention PAS: id, workspace_id, created_at, updated_at,
-- deleted_at (soft delete), created_by. Dùng IF NOT EXISTS để chạy lại an toàn.

-- ---------------------------------------------------------------------------
-- Problem Types (loại vấn đề)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.problem_types (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  type_code        text NOT NULL,
  type_name        text NOT NULL,
  type_group       text,
  description      text,
  is_active        boolean NOT NULL DEFAULT true,
  sort_order       integer NOT NULL DEFAULT 0,
  created_by_admin boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
-- type_code là duy nhất trong mỗi workspace (chỉ tính bản chưa xóa mềm)
CREATE UNIQUE INDEX IF NOT EXISTS uq_problem_types_ws_code
  ON public.problem_types (workspace_id, type_code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_problem_types_ws
  ON public.problem_types (workspace_id, is_active) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Root Cause Types (loại nguyên nhân)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.root_cause_types (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  type_code        text NOT NULL,
  type_name        text NOT NULL,
  description      text,
  is_active        boolean NOT NULL DEFAULT true,
  sort_order       integer NOT NULL DEFAULT 0,
  created_by_admin boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_root_cause_types_ws_code
  ON public.root_cause_types (workspace_id, type_code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_root_cause_types_ws
  ON public.root_cause_types (workspace_id, is_active) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Mapping: gợi ý Root Cause Type theo Problem Type
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.problem_type_root_cause_map (
  workspace_id       uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  problem_type_id    uuid NOT NULL REFERENCES public.problem_types(id) ON DELETE CASCADE,
  root_cause_type_id uuid NOT NULL REFERENCES public.root_cause_types(id) ON DELETE CASCADE,
  priority_order     integer NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (problem_type_id, root_cause_type_id)
);
CREATE INDEX IF NOT EXISTS idx_pt_rc_map_ws
  ON public.problem_type_root_cause_map (workspace_id);

-- ===========================================================================
-- ROLLBACK
-- ===========================================================================
-- DROP TABLE IF EXISTS public.problem_type_root_cause_map;
-- DROP TABLE IF EXISTS public.root_cause_types;
-- DROP TABLE IF EXISTS public.problem_types;
