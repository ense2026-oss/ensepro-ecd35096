
DROP POLICY IF EXISTS "Admin/HR/Accountant manage periods" ON public.payroll_periods;
CREATE POLICY "Payroll managers manage periods"
ON public.payroll_periods FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'hr'::app_role) OR has_role(auth.uid(),'accountant'::app_role) OR has_role(auth.uid(),'executive'::app_role) OR has_role(auth.uid(),'manager'::app_role))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'hr'::app_role) OR has_role(auth.uid(),'accountant'::app_role) OR has_role(auth.uid(),'executive'::app_role) OR has_role(auth.uid(),'manager'::app_role));

DROP POLICY IF EXISTS "Authenticated read published periods" ON public.payroll_periods;
CREATE POLICY "Read periods"
ON public.payroll_periods FOR SELECT TO authenticated
USING (status='published' OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'hr'::app_role) OR has_role(auth.uid(),'accountant'::app_role) OR has_role(auth.uid(),'executive'::app_role) OR has_role(auth.uid(),'manager'::app_role));

DROP POLICY IF EXISTS "Admin/HR/Accountant manage payslips" ON public.payslips;
CREATE POLICY "Payroll managers manage payslips"
ON public.payslips FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'hr'::app_role) OR has_role(auth.uid(),'accountant'::app_role) OR has_role(auth.uid(),'executive'::app_role) OR has_role(auth.uid(),'manager'::app_role))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'hr'::app_role) OR has_role(auth.uid(),'accountant'::app_role) OR has_role(auth.uid(),'executive'::app_role) OR has_role(auth.uid(),'manager'::app_role));
