
CREATE OR REPLACE FUNCTION public.get_active_employee_names()
RETURNS TABLE(id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, (e.first_name || ' ' || e.last_name) as full_name
  FROM public.employees e
  WHERE e.status = 'active'
  ORDER BY e.first_name;
$$;
