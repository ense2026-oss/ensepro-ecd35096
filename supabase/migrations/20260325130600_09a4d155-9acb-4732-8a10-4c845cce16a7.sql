
-- Cleanup orphan user_roles (accounts not linked to any employee)
DELETE FROM public.user_roles
WHERE user_id NOT IN (
  SELECT user_id FROM public.employees WHERE user_id IS NOT NULL
);

-- Cleanup orphan profiles (accounts not linked to any employee)
DELETE FROM public.profiles
WHERE id NOT IN (
  SELECT user_id FROM public.employees WHERE user_id IS NOT NULL
);
