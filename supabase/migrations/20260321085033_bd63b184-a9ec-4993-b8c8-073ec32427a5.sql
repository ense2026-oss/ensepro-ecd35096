
-- Fix overly permissive INSERT on app_notifications
DROP POLICY "Authenticated can insert notifications" ON public.app_notifications;
CREATE POLICY "Authenticated can insert notifications"
  ON public.app_notifications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager'));
