-- Replace overly permissive INSERT policy with a proper one
DROP POLICY IF EXISTS "Service can insert profiles" ON public.profiles;
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);
