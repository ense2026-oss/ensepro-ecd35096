-- Add trigger so new auth users automatically get a profile + role
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Backfill: insert profiles for existing auth users who don't have one
INSERT INTO public.profiles (id, full_name, username)
SELECT u.id,
       COALESCE(u.raw_user_meta_data->>'full_name', ''),
       COALESCE(u.raw_user_meta_data->>'username', '')
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Backfill: insert roles for existing auth users who don't have one
INSERT INTO public.user_roles (user_id, role)
SELECT u.id,
       COALESCE(
         (u.raw_user_meta_data->>'role')::app_role,
         'employee'
       )
FROM auth.users u
LEFT JOIN public.user_roles r ON r.user_id = u.id
WHERE r.user_id IS NULL
ON CONFLICT (user_id, role) DO NOTHING;