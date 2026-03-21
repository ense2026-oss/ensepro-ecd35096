-- Add INSERT policy for profiles (needed by handle_new_user trigger)
CREATE POLICY "Service can insert profiles"
ON public.profiles
FOR INSERT
TO public
WITH CHECK (true);

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
