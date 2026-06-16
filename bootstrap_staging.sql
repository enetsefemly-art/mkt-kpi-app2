--
-- PostgreSQL database dump
--

-- \restrict aGyhrCtuO3HlmRBVJ4a1mlSpo84KEfk3cfR9GkeVaNED24c5a6vy41ae38AZy5s  -- commented: psql meta-command, not supported by Supabase Dashboard SQL Editor

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.10 (Postgres.app)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- CREATE SCHEMA public;  -- commented: schema already exists in Supabase staging


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: kpi_period; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.kpi_period AS ENUM (
    'monthly'
);


--
-- Name: kpi_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.kpi_type AS ENUM (
    'revenue',
    'lead',
    'rate',
    'cost',
    'strategic'
);


--
-- Name: task_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.task_status AS ENUM (
    'not_started',
    'in_progress',
    'blocked',
    'done'
);


--
-- Name: current_user_department_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_user_department_id() RETURNS uuid
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select department_id
  from public.profiles
  where user_id = auth.uid()
  limit 1;
$$;


--
-- Name: current_user_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_user_role() RETURNS text
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select role
  from public.profiles
  where user_id = auth.uid()
  limit 1;
$$;


--
-- Name: current_user_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_user_status() RETURNS text
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select status
  from public.profiles
  where user_id = auth.uid()
  limit 1;
$$;


--
-- Name: default_workspace_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.default_workspace_id() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select id
  from public.workspaces
  order by created_at asc
  limit 1;
$$;


--
-- Name: enforce_kpi_item_update_rules(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_kpi_item_update_rules() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_role text;
  v_status text;
  v_department_id uuid;
  v_kpi_owner_id uuid;
  v_kpi_department_id uuid;
begin
  -- Lấy role hiện tại từ profiles, không dùng user_roles/workspace_roles nữa
  select p.role, p.status, p.department_id
  into v_role, v_status, v_department_id
  from public.profiles p
  where p.user_id = auth.uid()
  limit 1;

  if v_role is null then
    raise exception 'User profile role not found';
  end if;

  if v_status is distinct from 'active' then
    raise exception 'User is not active';
  end if;

  -- Lấy thông tin KPI cha
  select k.owner_id, k.department_id
  into v_kpi_owner_id, v_kpi_department_id
  from public.kpis k
  where k.id = new.kpi_id
  limit 1;

  if v_kpi_owner_id is null then
    raise exception 'KPI not found';
  end if;

  -- Director / Admin: được sửa mọi field
  if v_role in ('director', 'admin') then
    return new;
  end if;

  -- Manager: được sửa KPI Item nếu KPI cha thuộc department của mình
  if v_role = 'manager' then
    if v_department_id is null then
      raise exception 'Manager has no department';
    end if;

    if v_kpi_department_id = v_department_id then
      return new;
    else
      raise exception 'Manager can only update KPI items in own department';
    end if;
  end if;

  -- Member: chỉ được sửa KPI item thuộc KPI mình sở hữu
  if v_role = 'member' then
    if v_kpi_owner_id <> auth.uid() then
      raise exception 'You do not own this KPI';
    end if;

    -- Member chỉ được sửa actual, manual_progress, note
    if
      new.product_id is distinct from old.product_id or
      new.item_title is distinct from old.item_title or
      new.sub_weight is distinct from old.sub_weight or
      new.target is distinct from old.target or
      new.direction is distinct from old.direction or
      new.kpi_id is distinct from old.kpi_id
    then
      raise exception 'Members can only update actual, manual_progress, and note';
    end if;

    return new;
  end if;

  raise exception 'You do not have permission to update KPI items';
end;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  insert into public.profiles (
    user_id,
    full_name,
    email,
    role,
    status
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    'member',
    'active'
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;


--
-- Name: has_workspace_role(uuid, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_workspace_role(p_workspace_id uuid, p_roles text[]) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.workspace_id = p_workspace_id
      and ur.user_id = auth.uid()
      and ur.role_code = any(p_roles)
  );
$$;


--
-- Name: my_workspace_ids(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_workspace_ids() RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
  select workspace_id
  from public.user_roles
  where user_id = auth.uid();
$$;


SET default_table_access_method = heap;

--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_logs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    workspace_id uuid NOT NULL,
    actor_id uuid,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    action text NOT NULL,
    detail jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    manager_id uuid,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: digests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.digests (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    workspace_id uuid NOT NULL,
    digest_type text NOT NULL,
    title text NOT NULL,
    summary text,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT digests_digest_type_check CHECK ((digest_type = ANY (ARRAY['daily'::text, 'weekly'::text])))
);


--
-- Name: initiative_kpis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.initiative_kpis (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    initiative_id uuid NOT NULL,
    kpi_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: initiatives; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.initiatives (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    workspace_id uuid NOT NULL,
    owner_id uuid NOT NULL,
    product_id uuid,
    title text NOT NULL,
    description text,
    priority text DEFAULT 'medium'::text NOT NULL,
    month_key text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: kpi_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kpi_items (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    kpi_id uuid NOT NULL,
    product_id uuid NOT NULL,
    item_title text NOT NULL,
    sub_weight numeric(6,2) DEFAULT 100 NOT NULL,
    target numeric(18,4),
    actual numeric(18,4),
    manual_progress numeric(6,4),
    direction text DEFAULT 'higher_better'::text NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    target_mode text DEFAULT 'cumulative'::text NOT NULL,
    CONSTRAINT kpi_items_target_mode_check CHECK ((target_mode = ANY (ARRAY['fixed'::text, 'cumulative'::text])))
);


--
-- Name: kpis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kpis (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    workspace_id uuid DEFAULT public.default_workspace_id() NOT NULL,
    owner_id uuid NOT NULL,
    title text NOT NULL,
    kpi_type public.kpi_type NOT NULL,
    unit text,
    period public.kpi_period DEFAULT 'monthly'::public.kpi_period NOT NULL,
    weight numeric(6,2) DEFAULT 0 NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    month_key text DEFAULT to_char(now(), 'YYYY-MM'::text) NOT NULL,
    kpi_score_method text DEFAULT 'weighted_item_score'::text NOT NULL,
    department_id uuid,
    CONSTRAINT kpis_kpi_score_method_check CHECK ((kpi_score_method = ANY (ARRAY['aggregate_ratio'::text, 'weighted_item_score'::text])))
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    workspace_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    user_id uuid NOT NULL,
    full_name text NOT NULL,
    function text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    department_id uuid,
    manager_id uuid,
    status text DEFAULT 'active'::text NOT NULL,
    avatar_url text,
    role text DEFAULT 'member'::text NOT NULL,
    email text,
    workspace_id uuid
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    code text NOT NULL,
    name text NOT NULL
);


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tasks (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    workspace_id uuid NOT NULL,
    initiative_id uuid NOT NULL,
    title text NOT NULL,
    owner_id uuid NOT NULL,
    due_date date NOT NULL,
    status public.task_status DEFAULT 'not_started'::public.task_status NOT NULL,
    blocker_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role_code text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: workspaces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspaces (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: digests digests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.digests
    ADD CONSTRAINT digests_pkey PRIMARY KEY (id);


--
-- Name: initiative_kpis initiative_kpis_initiative_id_kpi_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.initiative_kpis
    ADD CONSTRAINT initiative_kpis_initiative_id_kpi_id_key UNIQUE (initiative_id, kpi_id);


--
-- Name: initiative_kpis initiative_kpis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.initiative_kpis
    ADD CONSTRAINT initiative_kpis_pkey PRIMARY KEY (id);


--
-- Name: initiatives initiatives_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.initiatives
    ADD CONSTRAINT initiatives_pkey PRIMARY KEY (id);


--
-- Name: kpi_items kpi_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpi_items
    ADD CONSTRAINT kpi_items_pkey PRIMARY KEY (id);


--
-- Name: kpis kpis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpis
    ADD CONSTRAINT kpis_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_workspace_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_workspace_id_code_key UNIQUE (workspace_id, code);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (user_id);


--
-- Name: roles roles_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_code_key UNIQUE (code);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_workspace_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_workspace_id_user_id_key UNIQUE (workspace_id, user_id);


--
-- Name: workspaces workspaces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_pkey PRIMARY KEY (id);


--
-- Name: idx_activity_workspace_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_workspace_time ON public.activity_logs USING btree (workspace_id, created_at DESC);


--
-- Name: idx_departments_manager_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_departments_manager_id ON public.departments USING btree (manager_id);


--
-- Name: idx_departments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_departments_status ON public.departments USING btree (status);


--
-- Name: idx_digests_workspace_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_digests_workspace_created_at ON public.digests USING btree (workspace_id, created_at DESC);


--
-- Name: idx_initiatives_workspace_month; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_initiatives_workspace_month ON public.initiatives USING btree (workspace_id, month_key);


--
-- Name: idx_kpi_items_kpi; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kpi_items_kpi ON public.kpi_items USING btree (kpi_id);


--
-- Name: idx_kpi_items_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kpi_items_product ON public.kpi_items USING btree (product_id);


--
-- Name: idx_kpis_department_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kpis_department_id ON public.kpis USING btree (department_id);


--
-- Name: idx_kpis_workspace_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kpis_workspace_owner ON public.kpis USING btree (workspace_id, owner_id);


--
-- Name: idx_profiles_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_email ON public.profiles USING btree (email);


--
-- Name: idx_tasks_owner_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_owner_status ON public.tasks USING btree (owner_id, status);


--
-- Name: idx_tasks_workspace_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_workspace_due ON public.tasks USING btree (workspace_id, due_date);


--
-- Name: kpi_items trg_enforce_kpi_item_update_rules; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_enforce_kpi_item_update_rules BEFORE UPDATE ON public.kpi_items FOR EACH ROW EXECUTE FUNCTION public.enforce_kpi_item_update_rules();


--
-- Name: activity_logs activity_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: activity_logs activity_logs_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: departments departments_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.profiles(user_id) ON DELETE SET NULL;


--
-- Name: digests digests_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.digests
    ADD CONSTRAINT digests_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: digests digests_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.digests
    ADD CONSTRAINT digests_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: initiative_kpis initiative_kpis_initiative_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.initiative_kpis
    ADD CONSTRAINT initiative_kpis_initiative_id_fkey FOREIGN KEY (initiative_id) REFERENCES public.initiatives(id) ON DELETE CASCADE;


--
-- Name: initiative_kpis initiative_kpis_kpi_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.initiative_kpis
    ADD CONSTRAINT initiative_kpis_kpi_id_fkey FOREIGN KEY (kpi_id) REFERENCES public.kpis(id) ON DELETE CASCADE;


--
-- Name: initiatives initiatives_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.initiatives
    ADD CONSTRAINT initiatives_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: initiatives initiatives_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.initiatives
    ADD CONSTRAINT initiatives_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: initiatives initiatives_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.initiatives
    ADD CONSTRAINT initiatives_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: kpi_items kpi_items_kpi_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpi_items
    ADD CONSTRAINT kpi_items_kpi_id_fkey FOREIGN KEY (kpi_id) REFERENCES public.kpis(id) ON DELETE CASCADE;


--
-- Name: kpi_items kpi_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpi_items
    ADD CONSTRAINT kpi_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: kpis kpis_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpis
    ADD CONSTRAINT kpis_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: kpis kpis_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpis
    ADD CONSTRAINT kpis_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: kpis kpis_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpis
    ADD CONSTRAINT kpis_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: products products_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.profiles(user_id) ON DELETE SET NULL;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE SET NULL;


--
-- Name: tasks tasks_initiative_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_initiative_id_fkey FOREIGN KEY (initiative_id) REFERENCES public.initiatives(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_role_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_code_fkey FOREIGN KEY (role_code) REFERENCES public.roles(code);


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: activity_logs activity_insert_in_workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY activity_insert_in_workspace ON public.activity_logs FOR INSERT WITH CHECK (((actor_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.workspace_id = activity_logs.workspace_id) AND (ur.user_id = auth.uid()))))));


--
-- Name: activity_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: activity_logs activity_read_admin_lead; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY activity_read_admin_lead ON public.activity_logs FOR SELECT USING (public.has_workspace_role(workspace_id, ARRAY['admin'::text, 'lead'::text]));


--
-- Name: departments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

--
-- Name: departments departments_delete_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY departments_delete_policy ON public.departments FOR DELETE USING ((public.current_user_role() = 'director'::text));


--
-- Name: departments departments_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY departments_insert_policy ON public.departments FOR INSERT WITH CHECK ((public.current_user_role() = 'director'::text));


--
-- Name: departments departments_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY departments_select_policy ON public.departments FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: departments departments_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY departments_update_policy ON public.departments FOR UPDATE USING ((public.current_user_role() = 'director'::text)) WITH CHECK ((public.current_user_role() = 'director'::text));


--
-- Name: digests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.digests ENABLE ROW LEVEL SECURITY;

--
-- Name: digests digests_admin_lead_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY digests_admin_lead_delete ON public.digests FOR DELETE USING (public.has_workspace_role(workspace_id, ARRAY['admin'::text, 'lead'::text]));


--
-- Name: digests digests_admin_lead_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY digests_admin_lead_insert ON public.digests FOR INSERT WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['admin'::text, 'lead'::text]));


--
-- Name: digests digests_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY digests_read ON public.digests FOR SELECT USING ((workspace_id IN ( SELECT my_workspace_ids.my_workspace_ids
   FROM public.my_workspace_ids() my_workspace_ids(my_workspace_ids))));


--
-- Name: initiative_kpis; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.initiative_kpis ENABLE ROW LEVEL SECURITY;

--
-- Name: initiative_kpis initiative_kpis_lead_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY initiative_kpis_lead_write ON public.initiative_kpis USING ((EXISTS ( SELECT 1
   FROM public.initiatives i
  WHERE ((i.id = initiative_kpis.initiative_id) AND public.has_workspace_role(i.workspace_id, ARRAY['admin'::text, 'lead'::text]))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.initiatives i
  WHERE ((i.id = initiative_kpis.initiative_id) AND public.has_workspace_role(i.workspace_id, ARRAY['admin'::text, 'lead'::text])))));


--
-- Name: initiative_kpis initiative_kpis_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY initiative_kpis_read ON public.initiative_kpis FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.initiatives i
  WHERE ((i.id = initiative_kpis.initiative_id) AND (i.workspace_id IN ( SELECT my_workspace_ids.my_workspace_ids
           FROM public.my_workspace_ids() my_workspace_ids(my_workspace_ids)))))));


--
-- Name: initiatives; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.initiatives ENABLE ROW LEVEL SECURITY;

--
-- Name: initiatives initiatives_lead_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY initiatives_lead_write ON public.initiatives USING (public.has_workspace_role(workspace_id, ARRAY['admin'::text, 'lead'::text])) WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['admin'::text, 'lead'::text]));


--
-- Name: initiatives initiatives_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY initiatives_read ON public.initiatives FOR SELECT USING ((workspace_id IN ( SELECT my_workspace_ids.my_workspace_ids
   FROM public.my_workspace_ids() my_workspace_ids(my_workspace_ids))));


--
-- Name: kpi_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.kpi_items ENABLE ROW LEVEL SECURITY;

--
-- Name: kpi_items kpi_items_delete_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kpi_items_delete_policy ON public.kpi_items FOR DELETE USING (((public.current_user_status() = 'active'::text) AND ((public.current_user_role() = ANY (ARRAY['director'::text, 'admin'::text])) OR (EXISTS ( SELECT 1
   FROM public.kpis k
  WHERE ((k.id = kpi_items.kpi_id) AND (public.current_user_role() = 'manager'::text) AND (k.department_id = public.current_user_department_id())))))));


--
-- Name: kpi_items kpi_items_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kpi_items_insert_policy ON public.kpi_items FOR INSERT WITH CHECK (((public.current_user_status() = 'active'::text) AND ((public.current_user_role() = ANY (ARRAY['director'::text, 'admin'::text])) OR (EXISTS ( SELECT 1
   FROM public.kpis k
  WHERE ((k.id = kpi_items.kpi_id) AND (public.current_user_role() = 'manager'::text) AND (k.department_id = public.current_user_department_id())))))));


--
-- Name: kpi_items kpi_items_member_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kpi_items_member_update_own ON public.kpi_items FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.kpis k
  WHERE ((k.id = kpi_items.kpi_id) AND (k.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.kpis k
  WHERE ((k.id = kpi_items.kpi_id) AND (k.owner_id = auth.uid())))));


--
-- Name: kpi_items kpi_items_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kpi_items_select_policy ON public.kpi_items FOR SELECT USING (((public.current_user_status() = 'active'::text) AND ((public.current_user_role() = 'director'::text) OR (EXISTS ( SELECT 1
   FROM public.kpis k
  WHERE ((k.id = kpi_items.kpi_id) AND ((k.owner_id = auth.uid()) OR ((public.current_user_role() = 'manager'::text) AND (k.department_id = public.current_user_department_id())))))))));


--
-- Name: kpi_items kpi_items_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kpi_items_update_policy ON public.kpi_items FOR UPDATE USING (((public.current_user_status() = 'active'::text) AND ((public.current_user_role() = ANY (ARRAY['director'::text, 'admin'::text])) OR (EXISTS ( SELECT 1
   FROM public.kpis k
  WHERE ((k.id = kpi_items.kpi_id) AND (public.current_user_role() = 'manager'::text) AND (k.department_id = public.current_user_department_id())))) OR (EXISTS ( SELECT 1
   FROM public.kpis k
  WHERE ((k.id = kpi_items.kpi_id) AND (k.owner_id = auth.uid()))))))) WITH CHECK (((public.current_user_status() = 'active'::text) AND ((public.current_user_role() = ANY (ARRAY['director'::text, 'admin'::text])) OR (EXISTS ( SELECT 1
   FROM public.kpis k
  WHERE ((k.id = kpi_items.kpi_id) AND (public.current_user_role() = 'manager'::text) AND (k.department_id = public.current_user_department_id())))) OR (EXISTS ( SELECT 1
   FROM public.kpis k
  WHERE ((k.id = kpi_items.kpi_id) AND (k.owner_id = auth.uid())))))));


--
-- Name: kpis; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.kpis ENABLE ROW LEVEL SECURITY;

--
-- Name: kpis kpis_delete_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kpis_delete_policy ON public.kpis FOR DELETE USING (((public.current_user_status() = 'active'::text) AND ((public.current_user_role() = ANY (ARRAY['director'::text, 'admin'::text])) OR ((public.current_user_role() = 'manager'::text) AND (department_id = public.current_user_department_id())))));


--
-- Name: kpis kpis_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kpis_insert_policy ON public.kpis FOR INSERT WITH CHECK (((public.current_user_status() = 'active'::text) AND ((public.current_user_role() = 'director'::text) OR ((public.current_user_role() = 'manager'::text) AND (department_id = public.current_user_department_id())))));


--
-- Name: kpis kpis_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kpis_select_policy ON public.kpis FOR SELECT USING (((public.current_user_status() = 'active'::text) AND ((public.current_user_role() = 'director'::text) OR (owner_id = auth.uid()) OR ((public.current_user_role() = 'manager'::text) AND (department_id = public.current_user_department_id())))));


--
-- Name: kpis kpis_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kpis_update_policy ON public.kpis FOR UPDATE USING (((public.current_user_status() = 'active'::text) AND ((public.current_user_role() = ANY (ARRAY['director'::text, 'admin'::text])) OR ((public.current_user_role() = 'manager'::text) AND (department_id = public.current_user_department_id()))))) WITH CHECK (((public.current_user_status() = 'active'::text) AND ((public.current_user_role() = ANY (ARRAY['director'::text, 'admin'::text])) OR ((public.current_user_role() = 'manager'::text) AND (department_id = public.current_user_department_id())))));


--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: products products_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY products_admin_write ON public.products USING (public.has_workspace_role(workspace_id, ARRAY['admin'::text])) WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['admin'::text]));


--
-- Name: products products_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY products_read ON public.products FOR SELECT USING ((workspace_id IN ( SELECT my_workspace_ids.my_workspace_ids
   FROM public.my_workspace_ids() my_workspace_ids(my_workspace_ids))));


--
-- Name: products products_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY products_select_policy ON public.products FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_admin_insert ON public.profiles FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.role_code = 'admin'::text)))));


--
-- Name: profiles profiles_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_read ON public.profiles FOR SELECT USING ((user_id IN ( SELECT ur.user_id
   FROM public.user_roles ur
  WHERE (ur.workspace_id IN ( SELECT my_workspace_ids.my_workspace_ids
           FROM public.my_workspace_ids() my_workspace_ids(my_workspace_ids))))));


--
-- Name: profiles profiles_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select_policy ON public.profiles FOR SELECT USING (((public.current_user_status() = 'active'::text) AND ((public.current_user_role() = 'director'::text) OR (user_id = auth.uid()) OR ((public.current_user_role() = 'manager'::text) AND (department_id = public.current_user_department_id())))));


--
-- Name: profiles profiles_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: profiles profiles_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update_policy ON public.profiles FOR UPDATE USING (((public.current_user_status() = 'active'::text) AND ((public.current_user_role() = 'director'::text) OR ((public.current_user_role() = 'manager'::text) AND (department_id = public.current_user_department_id())) OR (user_id = auth.uid())))) WITH CHECK (((public.current_user_status() = 'active'::text) AND ((public.current_user_role() = 'director'::text) OR ((public.current_user_role() = 'manager'::text) AND (department_id = public.current_user_department_id())) OR (user_id = auth.uid()))));


--
-- Name: roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

--
-- Name: roles roles_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY roles_select_all ON public.roles FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: tasks tasks_lead_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tasks_lead_write ON public.tasks USING (public.has_workspace_role(workspace_id, ARRAY['admin'::text, 'lead'::text])) WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['admin'::text, 'lead'::text]));


--
-- Name: tasks tasks_member_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tasks_member_update_own ON public.tasks FOR UPDATE USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));


--
-- Name: tasks tasks_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tasks_read ON public.tasks FOR SELECT USING ((workspace_id IN ( SELECT my_workspace_ids.my_workspace_ids
   FROM public.my_workspace_ids() my_workspace_ids(my_workspace_ids))));


--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles user_roles_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_roles_admin_write ON public.user_roles USING (public.has_workspace_role(workspace_id, ARRAY['admin'::text])) WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['admin'::text]));


--
-- Name: user_roles user_roles_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_roles_read ON public.user_roles FOR SELECT USING ((workspace_id IN ( SELECT my_workspace_ids.my_workspace_ids
   FROM public.my_workspace_ids() my_workspace_ids(my_workspace_ids))));


--
-- Name: workspaces; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

--
-- Name: workspaces workspaces_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspaces_admin_write ON public.workspaces USING (public.has_workspace_role(id, ARRAY['admin'::text])) WITH CHECK (public.has_workspace_role(id, ARRAY['admin'::text]));


--
-- Name: workspaces workspaces_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspaces_select ON public.workspaces FOR SELECT USING ((id IN ( SELECT my_workspace_ids.my_workspace_ids
   FROM public.my_workspace_ids() my_workspace_ids(my_workspace_ids))));


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION current_user_department_id(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.current_user_department_id() TO anon;
GRANT ALL ON FUNCTION public.current_user_department_id() TO authenticated;
GRANT ALL ON FUNCTION public.current_user_department_id() TO service_role;


--
-- Name: FUNCTION current_user_role(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.current_user_role() TO anon;
GRANT ALL ON FUNCTION public.current_user_role() TO authenticated;
GRANT ALL ON FUNCTION public.current_user_role() TO service_role;


--
-- Name: FUNCTION current_user_status(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.current_user_status() TO anon;
GRANT ALL ON FUNCTION public.current_user_status() TO authenticated;
GRANT ALL ON FUNCTION public.current_user_status() TO service_role;


--
-- Name: FUNCTION default_workspace_id(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.default_workspace_id() TO anon;
GRANT ALL ON FUNCTION public.default_workspace_id() TO authenticated;
GRANT ALL ON FUNCTION public.default_workspace_id() TO service_role;


--
-- Name: FUNCTION enforce_kpi_item_update_rules(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.enforce_kpi_item_update_rules() TO anon;
GRANT ALL ON FUNCTION public.enforce_kpi_item_update_rules() TO authenticated;
GRANT ALL ON FUNCTION public.enforce_kpi_item_update_rules() TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION has_workspace_role(p_workspace_id uuid, p_roles text[]); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.has_workspace_role(p_workspace_id uuid, p_roles text[]) TO anon;
GRANT ALL ON FUNCTION public.has_workspace_role(p_workspace_id uuid, p_roles text[]) TO authenticated;
GRANT ALL ON FUNCTION public.has_workspace_role(p_workspace_id uuid, p_roles text[]) TO service_role;


--
-- Name: FUNCTION my_workspace_ids(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.my_workspace_ids() TO anon;
GRANT ALL ON FUNCTION public.my_workspace_ids() TO authenticated;
GRANT ALL ON FUNCTION public.my_workspace_ids() TO service_role;


--
-- Name: TABLE activity_logs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.activity_logs TO anon;
GRANT ALL ON TABLE public.activity_logs TO authenticated;
GRANT ALL ON TABLE public.activity_logs TO service_role;


--
-- Name: TABLE departments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.departments TO anon;
GRANT ALL ON TABLE public.departments TO authenticated;
GRANT ALL ON TABLE public.departments TO service_role;


--
-- Name: TABLE digests; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.digests TO anon;
GRANT ALL ON TABLE public.digests TO authenticated;
GRANT ALL ON TABLE public.digests TO service_role;


--
-- Name: TABLE initiative_kpis; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.initiative_kpis TO anon;
GRANT ALL ON TABLE public.initiative_kpis TO authenticated;
GRANT ALL ON TABLE public.initiative_kpis TO service_role;


--
-- Name: TABLE initiatives; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.initiatives TO anon;
GRANT ALL ON TABLE public.initiatives TO authenticated;
GRANT ALL ON TABLE public.initiatives TO service_role;


--
-- Name: TABLE kpi_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.kpi_items TO anon;
GRANT ALL ON TABLE public.kpi_items TO authenticated;
GRANT ALL ON TABLE public.kpi_items TO service_role;


--
-- Name: COLUMN kpi_items.actual; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(actual) ON TABLE public.kpi_items TO authenticated;


--
-- Name: COLUMN kpi_items.manual_progress; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(manual_progress) ON TABLE public.kpi_items TO authenticated;


--
-- Name: COLUMN kpi_items.note; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(note) ON TABLE public.kpi_items TO authenticated;


--
-- Name: TABLE kpis; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.kpis TO anon;
GRANT ALL ON TABLE public.kpis TO authenticated;
GRANT ALL ON TABLE public.kpis TO service_role;


--
-- Name: TABLE products; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.products TO anon;
GRANT ALL ON TABLE public.products TO authenticated;
GRANT ALL ON TABLE public.products TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE roles; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.roles TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.roles TO authenticated;
GRANT ALL ON TABLE public.roles TO service_role;


--
-- Name: TABLE tasks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tasks TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.tasks TO authenticated;
GRANT ALL ON TABLE public.tasks TO service_role;


--
-- Name: COLUMN tasks.status; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(status) ON TABLE public.tasks TO authenticated;


--
-- Name: COLUMN tasks.blocker_reason; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(blocker_reason) ON TABLE public.tasks TO authenticated;


--
-- Name: TABLE user_roles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_roles TO anon;
GRANT ALL ON TABLE public.user_roles TO authenticated;
GRANT ALL ON TABLE public.user_roles TO service_role;


--
-- Name: TABLE workspaces; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.workspaces TO anon;
GRANT ALL ON TABLE public.workspaces TO authenticated;
GRANT ALL ON TABLE public.workspaces TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

-- \unrestrict aGyhrCtuO3HlmRBVJ4a1mlSpo84KEfk3cfR9GkeVaNED24c5a6vy41ae38AZy5s  -- commented: psql meta-command, not supported by Supabase Dashboard SQL Editor

