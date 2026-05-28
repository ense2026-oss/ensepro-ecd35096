
DROP POLICY IF EXISTS "Admin/HR/Manager full access on dayoff_overrides" ON public.employee_dayoff_overrides;
DROP POLICY IF EXISTS "Admin/HR/Manager full access on dayoff_patterns" ON public.employee_dayoff_patterns;

CREATE POLICY "Admin/HR/Manager/Executive full access on dayoff_overrides"
ON public.employee_dayoff_overrides
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'hr'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'executive'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'hr'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'executive'::app_role)
);

CREATE POLICY "Admin/HR/Manager/Executive full access on dayoff_patterns"
ON public.employee_dayoff_patterns
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'hr'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'executive'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'hr'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'executive'::app_role)
);
