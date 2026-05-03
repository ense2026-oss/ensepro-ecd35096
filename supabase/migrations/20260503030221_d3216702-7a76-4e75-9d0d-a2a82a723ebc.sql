
CREATE TABLE public.face_scan_enroll_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  device_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  synced_at timestamptz,
  error_message text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, device_id)
);

ALTER TABLE public.face_scan_enroll_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/HR manage enroll_status"
  ON public.face_scan_enroll_status FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role));

CREATE POLICY "Authenticated read enroll_status"
  ON public.face_scan_enroll_status FOR SELECT TO authenticated
  USING (true);

CREATE TRIGGER trg_enroll_status_updated_at
  BEFORE UPDATE ON public.face_scan_enroll_status
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.face_scan_sync_logs
  ADD COLUMN IF NOT EXISTS command_payload jsonb NOT NULL DEFAULT '{}'::jsonb;
