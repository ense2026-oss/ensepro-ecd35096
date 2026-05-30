DROP POLICY IF EXISTS "Admin/HR/Manager can manage affiliations" ON public.affiliations;
CREATE POLICY "Authorized users can manage affiliations"
  ON public.affiliations
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'hr')
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'executive')
    OR can_access_module(auth.uid(), 'organization', 'edit')
    OR can_access_module(auth.uid(), 'settings', 'edit')
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'hr')
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'executive')
    OR can_access_module(auth.uid(), 'organization', 'edit')
    OR can_access_module(auth.uid(), 'settings', 'edit')
  );

DROP POLICY IF EXISTS "Admin/HR/Manager can manage positions" ON public.positions;
CREATE POLICY "Authorized users can manage positions"
  ON public.positions
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'hr')
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'executive')
    OR can_access_module(auth.uid(), 'organization', 'edit')
    OR can_access_module(auth.uid(), 'settings', 'edit')
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'hr')
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'executive')
    OR can_access_module(auth.uid(), 'organization', 'edit')
    OR can_access_module(auth.uid(), 'settings', 'edit')
  );