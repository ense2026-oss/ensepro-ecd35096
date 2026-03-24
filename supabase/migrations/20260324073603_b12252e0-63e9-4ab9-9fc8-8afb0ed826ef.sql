
-- Create a function to check if user's role has leave access via role_permissions
CREATE OR REPLACE FUNCTION public.can_access_leave(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_name = ur.role::text
    WHERE ur.user_id = _user_id
      AND rp.module = 'leave'
      AND rp.can_view = true
  )
$$;

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Admin/HR/Manager full access on leave_requests" ON public.leave_requests;

-- Create new dynamic policy for SELECT based on role_permissions
CREATE POLICY "Role-based read access on leave_requests"
ON public.leave_requests
FOR SELECT
TO authenticated
USING (
  employee_id IN (SELECT e.id FROM employees e WHERE e.user_id = auth.uid())
  OR public.can_access_leave(auth.uid())
);

-- Create policy for INSERT
CREATE POLICY "Role-based insert on leave_requests"
ON public.leave_requests
FOR INSERT
TO authenticated
WITH CHECK (
  employee_id IN (SELECT e.id FROM employees e WHERE e.user_id = auth.uid())
  OR public.can_access_leave(auth.uid())
);

-- Create policy for UPDATE (approve/reject)
CREATE POLICY "Role-based update on leave_requests"
ON public.leave_requests
FOR UPDATE
TO authenticated
USING (
  public.can_access_leave(auth.uid())
)
WITH CHECK (
  public.can_access_leave(auth.uid())
);

-- Create policy for DELETE
CREATE POLICY "Role-based delete on leave_requests"
ON public.leave_requests
FOR DELETE
TO authenticated
USING (
  public.can_access_leave(auth.uid())
);

-- Drop old individual employee policies since they're covered by new SELECT policy
DROP POLICY IF EXISTS "Employees can insert own leave_requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Employees can read own leave_requests" ON public.leave_requests;
