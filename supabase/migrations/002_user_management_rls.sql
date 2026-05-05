-- Migration to fix RLS for Profile update
-- Requirements:
-- 1. Director can update any profile
-- 2. Manager can update profiles in their department
-- 3. User can update their own profile but NOT change their role, department, manager, or status

-- Remove existing update policy if any
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

-- Director Policy: Can update any profile
CREATE POLICY "Director can update any profile"
ON profiles FOR UPDATE
TO authenticated
USING (
  (SELECT role FROM profiles WHERE user_id = auth.uid()) IN ('director', 'admin')
);

-- Manager Policy: Can update profiles in their department
CREATE POLICY "Manager can update profiles in their department"
ON profiles FOR UPDATE
TO authenticated
USING (
  (SELECT role FROM profiles WHERE user_id = auth.uid()) IN ('manager', 'lead')
  AND 
  department_id = (SELECT department_id FROM profiles WHERE user_id = auth.uid())
);

-- Self Update Policy: Can update own profile
CREATE POLICY "Users can update their own profile"
ON profiles FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
);

-- Trigger to prevent forbidden column updates by normal users
CREATE OR REPLACE FUNCTION trg_restrict_profile_updates()
RETURNS TRIGGER AS $$
DECLARE
  current_user_role text;
BEGIN
  -- Bypass if not called from an authenticated session
  IF NULLIF(current_setting('request.jwt.claim.sub', true), '') IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only limit if the user is updating their OWN profile
  IF NEW.user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '') THEN
    
    -- Get current user role
    SELECT role INTO current_user_role FROM public.profiles WHERE user_id = NEW.user_id;

    -- If the user is just a member or viewer (not upper management), they cannot change these fields:
    IF current_user_role NOT IN ('director', 'admin', 'manager', 'lead') THEN
      IF (NEW.role IS DISTINCT FROM OLD.role) OR
         (NEW.department_id IS DISTINCT FROM OLD.department_id) OR
         (NEW.manager_id IS DISTINCT FROM OLD.manager_id) OR
         (NEW.status IS DISTINCT FROM OLD.status) THEN
         RAISE EXCEPTION 'You do not have permission to change role, department, manager, or status';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS restrict_profile_updates ON profiles;
CREATE TRIGGER restrict_profile_updates
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION trg_restrict_profile_updates();
