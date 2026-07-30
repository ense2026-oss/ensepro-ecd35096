CREATE TABLE public.face_scan_device_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.face_scan_devices(id) ON DELETE CASCADE,
  pin text NOT NULL,
  name text NOT NULL DEFAULT '',
  privilege text NOT NULL DEFAULT '',
  card_no text NOT NULL DEFAULT '',
  matched_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (device_id, pin)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.face_scan_device_users TO authenticated;
GRANT ALL ON public.face_scan_device_users TO service_role;

ALTER TABLE public.face_scan_device_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read device users"
  ON public.face_scan_device_users FOR SELECT TO authenticated USING (true);

CREATE POLICY "Facescan manage device users insert"
  ON public.face_scan_device_users FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR can_access_module(auth.uid(), 'settings_facescan', 'add'));

CREATE POLICY "Facescan manage device users update"
  ON public.face_scan_device_users FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR can_access_module(auth.uid(), 'settings_facescan', 'edit'));

CREATE POLICY "Facescan manage device users delete"
  ON public.face_scan_device_users FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR can_access_module(auth.uid(), 'settings_facescan', 'delete'));

CREATE TRIGGER update_face_scan_device_users_updated_at
  BEFORE UPDATE ON public.face_scan_device_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();