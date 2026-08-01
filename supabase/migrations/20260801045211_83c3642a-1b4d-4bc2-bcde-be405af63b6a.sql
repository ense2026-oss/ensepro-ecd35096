ALTER TABLE public.check_in_records
  ADD COLUMN IF NOT EXISTS ot_actual_in text,
  ADD COLUMN IF NOT EXISTS ot_actual_out text;