-- Fix infinite recursion in profiles table RLS policies
-- Do not use `select * from profiles` in the policy itself. Make use of `auth.uid()` or avoid cyclic dependencies.

-- Drop existing policies that might cause recursion
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON profiles;
DROP POLICY IF EXISTS "Users can view profiles in their department." ON profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON profiles;
DROP POLICY IF EXISTS "Enable update for users based on email" ON profiles;
DROP POLICY IF EXISTS "Directors can see all, Managers can see department, Members can see themselves" ON profiles;

-- Make sure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 1. Everyone can read all profiles (safest to avoid recursion) 
-- OR if you must restrict, do it securely. 
-- For most KPI apps, users need to see names of other users to assign tasks.
-- Using a simple authenticated read policy avoids recursion.
CREATE POLICY "Enable read access for authenticated users" 
ON profiles 
FOR SELECT 
TO authenticated 
USING (true);

-- 2. Users can insert their own profile
CREATE POLICY "Users can insert their own profile" 
ON profiles 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- 3. Users can update their own profile (self-update)
CREATE POLICY "Users can update their own profile" 
ON profiles 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id);

-- If you need Directors/Managers to update others' profiles, it has to be done without referencing `profiles` recursively in a way that checks multiple rows if not bounded.
-- However, an easier fallback for now to prevent infinite recursion is to let users view all profiles, and restrict edits either at application level or via a stored procedure.
