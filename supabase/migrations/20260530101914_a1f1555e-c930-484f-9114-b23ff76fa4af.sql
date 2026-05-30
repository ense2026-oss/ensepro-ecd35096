DROP POLICY IF EXISTS "Admin/HR can manage company_settings" ON public.company_settings;

CREATE POLICY "Settings editors can manage company_settings"
ON public.company_settings
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'hr'::app_role)
  OR public.can_access_module(auth.uid(), 'settings', 'edit')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'hr'::app_role)
  OR public.can_access_module(auth.uid(), 'settings', 'edit')
);