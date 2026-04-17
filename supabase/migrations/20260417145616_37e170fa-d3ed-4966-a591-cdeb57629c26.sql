-- Helper function for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Table 1: face_scan_devices
CREATE TABLE public.face_scan_devices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  device_ip TEXT NOT NULL DEFAULT '',
  server_ip TEXT NOT NULL DEFAULT '',
  server_port INTEGER NOT NULL DEFAULT 8272,
  machine_number INTEGER NOT NULL DEFAULT 1,
  comm_password TEXT NOT NULL DEFAULT '0',
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  last_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.face_scan_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/HR can manage face_scan_devices"
  ON public.face_scan_devices FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role));

CREATE POLICY "Authenticated can read face_scan_devices"
  ON public.face_scan_devices FOR SELECT TO authenticated
  USING (true);

CREATE TRIGGER update_face_scan_devices_updated_at
  BEFORE UPDATE ON public.face_scan_devices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table 2: face_scan_sync_logs
CREATE TABLE public.face_scan_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id UUID REFERENCES public.face_scan_devices(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL DEFAULT 'pull_logs',
  status TEXT NOT NULL DEFAULT 'success',
  records_synced INTEGER NOT NULL DEFAULT 0,
  message TEXT NOT NULL DEFAULT '',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.face_scan_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/HR can manage face_scan_sync_logs"
  ON public.face_scan_sync_logs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role));

CREATE POLICY "Authenticated can read face_scan_sync_logs"
  ON public.face_scan_sync_logs FOR SELECT TO authenticated
  USING (true);

CREATE INDEX idx_face_scan_sync_logs_device ON public.face_scan_sync_logs(device_id, started_at DESC);
CREATE INDEX idx_face_scan_sync_logs_started ON public.face_scan_sync_logs(started_at DESC);

-- Table 3: face_scan_bridge_tokens
CREATE TABLE public.face_scan_bridge_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  token_hash TEXT NOT NULL UNIQUE,
  token_prefix TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.face_scan_bridge_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/HR can manage face_scan_bridge_tokens"
  ON public.face_scan_bridge_tokens FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.face_scan_devices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.face_scan_sync_logs;

-- Seed initial 2 devices
INSERT INTO public.face_scan_devices (name, description, device_ip, server_ip, server_port, machine_number, comm_password)
VALUES
  ('Station', 'รถไฟฟ้าขสมช', '192.168.2.201', '203.154.4.201', 8272, 1, '0'),
  ('Furnace', 'เตาเผาขยะสวนดอก', '192.168.1.202', '203.154.4.201', 8272, 2, '0');