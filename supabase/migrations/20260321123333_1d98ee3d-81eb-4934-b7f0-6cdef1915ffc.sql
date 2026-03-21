CREATE POLICY "Allow anon read company_settings"
ON public.company_settings
FOR SELECT
TO anon
USING (true);