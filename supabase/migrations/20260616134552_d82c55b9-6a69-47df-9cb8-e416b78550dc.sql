DROP POLICY IF EXISTS "Authorized users can manage role_permissions" ON public.role_permissions;

CREATE POLICY "Manage role_permissions by settings_roles"
ON public.role_permissions
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR can_access_module(auth.uid(), 'settings_roles'::text, 'edit'::text)
  OR can_access_module(auth.uid(), 'settings_roles'::text, 'add'::text)
  OR can_access_module(auth.uid(), 'settings_roles'::text, 'delete'::text)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR can_access_module(auth.uid(), 'settings_roles'::text, 'edit'::text)
  OR can_access_module(auth.uid(), 'settings_roles'::text, 'add'::text)
  OR can_access_module(auth.uid(), 'settings_roles'::text, 'delete'::text)
);