CREATE OR REPLACE FUNCTION public.sync_checkin_to_attendance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  normalized_date text;
  first_check_in text;
  last_check_out text;
  is_late boolean;
BEGIN
  normalized_date := CASE
    WHEN split_part(NEW.date, '-', 1)::int > 2400 THEN
      ((split_part(NEW.date, '-', 1)::int - 543)::text || '-' || split_part(NEW.date, '-', 2) || '-' || split_part(NEW.date, '-', 3))
    ELSE NEW.date
  END;

  SELECT
    MIN(NULLIF(cir.check_in, '-')),
    MAX(NULLIF(cir.check_out, '-'))
  INTO first_check_in, last_check_out
  FROM public.check_in_records cir
  WHERE cir.employee_id = NEW.employee_id
    AND (
      cir.date = NEW.date
      OR cir.date = normalized_date
      OR (
        split_part(cir.date, '-', 1)::int > 2400
        AND ((split_part(cir.date, '-', 1)::int - 543)::text || '-' || split_part(cir.date, '-', 2) || '-' || split_part(cir.date, '-', 3)) = normalized_date
      )
    );

  is_late := COALESCE(first_check_in, '-') > '08:30';

  INSERT INTO public.attendance_records (employee_id, date, check_in, check_out, status, late, ot_hours)
  VALUES (
    NEW.employee_id,
    normalized_date,
    COALESCE(first_check_in, '-'),
    COALESCE(last_check_out, '-'),
    CASE
      WHEN COALESCE(first_check_in, '-') = '-' THEN 'absent'
      WHEN is_late THEN 'late'
      ELSE 'present'
    END,
    is_late,
    0
  )
  ON CONFLICT (employee_id, date)
  DO UPDATE SET
    check_in = EXCLUDED.check_in,
    check_out = EXCLUDED.check_out,
    status = EXCLUDED.status,
    late = EXCLUDED.late;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_checkin_attendance ON public.check_in_records;
CREATE TRIGGER trg_sync_checkin_attendance
AFTER INSERT OR UPDATE ON public.check_in_records
FOR EACH ROW EXECUTE FUNCTION public.sync_checkin_to_attendance();