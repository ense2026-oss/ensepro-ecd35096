ALTER TABLE public.face_scan_devices
  ADD COLUMN IF NOT EXISTS serial_number text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS connection_mode text NOT NULL DEFAULT 'adms',
  ADD COLUMN IF NOT EXISTS adms_last_seen timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_face_scan_devices_serial_number
  ON public.face_scan_devices (serial_number)
  WHERE serial_number <> '';