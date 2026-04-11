
DROP POLICY "Admin/HR can manage shifts" ON public.shifts;
CREATE POLICY "Admin/HR/Executive can manage shifts" ON public.shifts
FOR ALL USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'hr'::app_role) OR
  has_role(auth.uid(), 'executive'::app_role)
) WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'hr'::app_role) OR
  has_role(auth.uid(), 'executive'::app_role)
);

DROP POLICY "Admin/HR/Manager can manage shift_assignments" ON public.shift_assignments;
CREATE POLICY "Admin/HR/Manager/Executive can manage shift_assignments" ON public.shift_assignments
FOR ALL USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'hr'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'executive'::app_role)
) WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'hr'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'executive'::app_role)
);
