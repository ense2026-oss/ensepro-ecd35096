DROP POLICY IF EXISTS "Admin/HR can manage company_holidays" ON public.company_holidays;

CREATE POLICY "Settings editors can manage company_holidays"
ON public.company_holidays
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'hr'::app_role)
  OR can_access_module(auth.uid(), 'settings', 'edit')
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'hr'::app_role)
  OR can_access_module(auth.uid(), 'settings', 'edit')
);