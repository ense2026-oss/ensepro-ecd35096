DROP POLICY IF EXISTS "Authorized users can manage role_permissions" ON public.role_permissions;

CREATE POLICY "Authorized users can manage role_permissions"
ON public.role_permissions
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'hr'::app_role)
  OR has_role(auth.uid(), 'executive'::app_role)
  OR can_access_module(auth.uid(), 'settings'::text, 'edit'::text)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'hr'::app_role)
  OR has_role(auth.uid(), 'executive'::app_role)
  OR can_access_module(auth.uid(), 'settings'::text, 'edit'::text)
);