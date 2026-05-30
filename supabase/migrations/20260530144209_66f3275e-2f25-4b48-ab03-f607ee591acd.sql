DROP POLICY IF EXISTS "Admin/HR can manage leave_types" ON public.leave_types;

CREATE POLICY "Settings editors can manage leave_types"
ON public.leave_types
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'hr'::app_role)
  OR can_access_module(auth.uid(), 'settings'::text, 'edit'::text)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'hr'::app_role)
  OR can_access_module(auth.uid(), 'settings'::text, 'edit'::text)
);