-- 003_kpi_permissions.sql

-- Drop existing policies for KPIs and KPI items if they exist
DROP POLICY IF EXISTS "Enable read access for all users" ON kpis;
DROP POLICY IF EXISTS "Enable insert for director" ON kpis;
DROP POLICY IF EXISTS "Enable update for director" ON kpis;
DROP POLICY IF EXISTS "Enable delete for director" ON kpis;
DROP POLICY IF EXISTS "Enable insert for kpis" ON kpis;
DROP POLICY IF EXISTS "Enable update for kpis" ON kpis;
DROP POLICY IF EXISTS "Enable delete for kpis" ON kpis;

-- Giám đốc (director / admin)
CREATE POLICY "Director full access kpis" ON kpis
FOR ALL USING (
  current_user_role() IN ('director', 'admin')
);

-- Manager: Insert/Update/Delete KPI trong department của mình
CREATE POLICY "Manager manage own department kpis" ON kpis
FOR ALL USING (
  current_user_role() IN ('manager', 'lead') AND department_id = current_user_department()
);

-- Member: Read-only access KPI based on role
CREATE POLICY "Select access based on role kpis" ON kpis
FOR SELECT USING (
  current_user_role() IN ('director', 'admin')
  OR (current_user_role() IN ('manager', 'lead') AND department_id = current_user_department())
  OR owner_id = auth.uid()
);


-- KPI Items policies --
DROP POLICY IF EXISTS "Enable read access for all users" ON kpi_items;
DROP POLICY IF EXISTS "Enable insert for kpi_items" ON kpi_items;
DROP POLICY IF EXISTS "Enable update for kpi_items" ON kpi_items;
DROP POLICY IF EXISTS "Enable delete for kpi_items" ON kpi_items;

CREATE POLICY "Director full access kpi_items" ON kpi_items
FOR ALL USING (
  current_user_role() IN ('director', 'admin')
);

-- Manager: full access if KPI is in their department
CREATE POLICY "Manager manage kpi_items in department" ON kpi_items
FOR ALL USING (
  current_user_role() IN ('manager', 'lead') AND 
  EXISTS (
    SELECT 1 FROM kpis WHERE kpis.id = kpi_items.kpi_id AND kpis.department_id = current_user_department()
  )
);

-- Member: update specific fields if they are owner of the KPI. 
-- RLS in Postgres doesn't easily restrict which columns are updated unless using column level privileges, 
-- but we can restrict row-level update to only owners.
CREATE POLICY "Owner update own kpi_items" ON kpi_items
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM kpis WHERE kpis.id = kpi_items.kpi_id AND kpis.owner_id = auth.uid()
  )
);

CREATE POLICY "Read access based on kpi access" ON kpi_items
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM kpis WHERE kpis.id = kpi_items.kpi_id
  )
);
