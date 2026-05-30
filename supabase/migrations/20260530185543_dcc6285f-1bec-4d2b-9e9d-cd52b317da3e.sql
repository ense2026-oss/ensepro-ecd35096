CREATE POLICY "All authenticated can read approved leaves"
ON public.leave_requests
FOR SELECT
TO authenticated
USING (status = 'approved');