-- Allow users with edit access to the "settings" module (e.g. executives/admins)
-- to manage role_permissions, matching the app's settings access model.
DROP POLICY IF EXISTS "Admin can manage role_permissions" ON public.role_permissions;

CREATE POLICY "Authorized users can manage role_permissions"
ON public.role_permissions
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.can_access_module(auth.uid(), 'settings', 'edit')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.can_access_module(auth.uid(), 'settings', 'edit')
);