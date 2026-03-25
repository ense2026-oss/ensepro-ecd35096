
-- Step 1: Create a dynamic permission check function
CREATE OR REPLACE FUNCTION public.can_access_module(_user_id uuid, _module text, _action text DEFAULT 'view')
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
      AND rp.module = _module
      AND (
        (_action = 'view' AND rp.can_view = true) OR
        (_action = 'add' AND rp.can_add = true) OR
        (_action = 'edit' AND rp.can_edit = true) OR
        (_action = 'delete' AND rp.can_delete = true) OR
        (_action = 'approve' AND rp.can_approve = true)
      )
  )
$$;

-- Step 2: Update employees table RLS - add executive read access
DROP POLICY IF EXISTS "Admin/HR/Manager can do everything on employees" ON public.employees;
CREATE POLICY "Admin/HR/Manager/Executive can do everything on employees"
ON public.employees FOR ALL TO public
USING (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'executive')
)
WITH CHECK (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'executive')
);

-- Step 3: Update overtime_requests - add executive full access
DROP POLICY IF EXISTS "Admin/HR/Manager full access on overtime_requests" ON public.overtime_requests;
CREATE POLICY "Admin/HR/Manager/Executive full access on overtime_requests"
ON public.overtime_requests FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'executive')
)
WITH CHECK (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'executive')
);

-- Step 4: Update contracts - add executive full access
DROP POLICY IF EXISTS "Admin/HR/Manager full access on contracts" ON public.contracts;
CREATE POLICY "Admin/HR/Manager/Executive full access on contracts"
ON public.contracts FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'executive')
)
WITH CHECK (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'executive')
);

-- Step 5: Update attendance_records - add executive and accountant read access
DROP POLICY IF EXISTS "Admin/HR/Manager full access on attendance_records" ON public.attendance_records;
CREATE POLICY "Admin/HR/Manager full access on attendance_records"
ON public.attendance_records FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager')
)
WITH CHECK (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager')
);

CREATE POLICY "Executive/Accountant can read attendance_records"
ON public.attendance_records FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'executive') OR has_role(auth.uid(), 'accountant')
);

-- Step 6: Update check_in_records - add executive read access
CREATE POLICY "Executive can read all check_in_records"
ON public.check_in_records FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'executive'));

-- Step 7: Update contract_attachments - add executive
DROP POLICY IF EXISTS "Admin/HR/Manager full access on attachments" ON public.contract_attachments;
CREATE POLICY "Admin/HR/Manager/Executive full access on attachments"
ON public.contract_attachments FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'executive')
)
WITH CHECK (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'executive')
);

-- Step 8: Update contract_signatures - add executive
DROP POLICY IF EXISTS "Admin/HR/Manager full access on signatures" ON public.contract_signatures;
CREATE POLICY "Admin/HR/Manager/Executive full access on signatures"
ON public.contract_signatures FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'executive')
)
WITH CHECK (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'executive')
);

-- Step 9: Update contract_notifications - add executive
DROP POLICY IF EXISTS "Admin/HR/Manager full access on contract_notifications" ON public.contract_notifications;
CREATE POLICY "Admin/HR/Manager/Executive full access on contract_notifications"
ON public.contract_notifications FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'executive')
)
WITH CHECK (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'executive')
);

-- Step 10: Update app_notifications insert - add executive
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.app_notifications;
CREATE POLICY "Authenticated can insert notifications"
ON public.app_notifications FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'executive')
);

-- Step 11: Update payroll items - add accountant access
CREATE POLICY "Accountant can read all payroll_items"
ON public.employee_custom_payroll_items FOR SELECT TO public
USING (has_role(auth.uid(), 'accountant'));

-- Step 12: Update time_edit_requests - add executive
DROP POLICY IF EXISTS "Admin/HR/Manager full access on time_edit_requests" ON public.time_edit_requests;
CREATE POLICY "Admin/HR/Manager/Executive full access on time_edit_requests"
ON public.time_edit_requests FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'executive')
)
WITH CHECK (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'executive')
);

-- Step 13: Update employee_work_history - add executive read
DROP POLICY IF EXISTS "Admin/HR/Manager full access on work_history" ON public.employee_work_history;
CREATE POLICY "Admin/HR/Manager/Executive full access on work_history"
ON public.employee_work_history FOR ALL TO public
USING (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'executive')
)
WITH CHECK (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'executive')
);

-- Step 14: Update employee_education - add executive read
DROP POLICY IF EXISTS "Admin/HR/Manager full access on education" ON public.employee_education;
CREATE POLICY "Admin/HR/Manager/Executive full access on education"
ON public.employee_education FOR ALL TO public
USING (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'executive')
)
WITH CHECK (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'executive')
);
