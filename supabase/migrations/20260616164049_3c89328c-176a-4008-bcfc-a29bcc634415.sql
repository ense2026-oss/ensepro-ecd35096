CREATE POLICY "Employees can update own overtime_requests"
ON public.overtime_requests
FOR UPDATE
USING (employee_id IN (SELECT e.id FROM public.employees e WHERE e.user_id = auth.uid()))
WITH CHECK (employee_id IN (SELECT e.id FROM public.employees e WHERE e.user_id = auth.uid()));