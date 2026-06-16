CREATE OR REPLACE FUNCTION public.can_view_employee_data(_user_id uuid, _module text, _target_employee_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_can_view boolean;
  v_scope text;
BEGIN
  -- Pick the broadest permission for this user's role(s) on the module
  SELECT rp.can_view, rp.scope
  INTO v_can_view, v_scope
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON rp.role_name = ur.role::text
  WHERE ur.user_id = _user_id
    AND rp.module = _module
  ORDER BY (CASE rp.scope WHEN 'all' THEN 3 WHEN 'department' THEN 2 ELSE 1 END) DESC
  LIMIT 1;

  IF NOT COALESCE(v_can_view, false) THEN
    RETURN false;
  END IF;

  IF v_scope = 'all' THEN
    RETURN true;
  ELSIF v_scope = 'self' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = _target_employee_id AND e.user_id = _user_id
    );
  ELSIF v_scope = 'department' THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.employees me
      JOIN public.employees te ON te.dept = me.dept
      WHERE me.user_id = _user_id AND te.id = _target_employee_id
    );
  END IF;

  RETURN false;
END;
$$;

-- attendance_records: replace broad view policy with a scope-aware one
DROP POLICY IF EXISTS "Attendance view" ON public.attendance_records;
CREATE POLICY "Attendance scoped view"
ON public.attendance_records
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR public.can_view_employee_data(auth.uid(), 'attendance', employee_id)
);

-- check_in_records: replace broad view policy with a scope-aware one
DROP POLICY IF EXISTS "Checkin manage view" ON public.check_in_records;
CREATE POLICY "Checkin scoped view"
ON public.check_in_records
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR public.can_view_employee_data(auth.uid(), 'check-in', employee_id)
);