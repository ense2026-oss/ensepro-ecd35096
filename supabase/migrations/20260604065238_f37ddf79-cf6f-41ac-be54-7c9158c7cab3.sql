ALTER POLICY "Admin/HR can manage contract_settings" ON public.contract_settings
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR can_access_module(auth.uid(), 'settings'::text, 'edit'::text))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR can_access_module(auth.uid(), 'settings'::text, 'edit'::text));

ALTER POLICY "Admin/HR can manage face_scan_devices" ON public.face_scan_devices
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR can_access_module(auth.uid(), 'settings'::text, 'edit'::text))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR can_access_module(auth.uid(), 'settings'::text, 'edit'::text));

ALTER POLICY "Admin/HR can manage face_scan_bridge_tokens" ON public.face_scan_bridge_tokens
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR can_access_module(auth.uid(), 'settings'::text, 'edit'::text))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR can_access_module(auth.uid(), 'settings'::text, 'edit'::text));