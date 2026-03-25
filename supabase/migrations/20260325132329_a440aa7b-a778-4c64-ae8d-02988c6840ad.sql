
-- Function to sync check_in_records -> attendance_records (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.sync_checkin_to_attendance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  is_late boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    is_late := (NEW.check_in > '08:30');
    INSERT INTO public.attendance_records (employee_id, date, check_in, check_out, status, late, ot_hours)
    VALUES (NEW.employee_id, NEW.date, NEW.check_in, COALESCE(NEW.check_out, '-'), 
            CASE WHEN is_late THEN 'late' ELSE 'present' END, is_late, 0)
    ON CONFLICT (employee_id, date) 
    DO UPDATE SET check_in = EXCLUDED.check_in, status = EXCLUDED.status, late = EXCLUDED.late;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' AND NEW.check_out IS NOT NULL AND NEW.check_out != OLD.check_out THEN
    UPDATE public.attendance_records 
    SET check_out = NEW.check_out
    WHERE employee_id = NEW.employee_id AND date = NEW.date;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger on check_in_records
DROP TRIGGER IF EXISTS trg_sync_checkin_attendance ON public.check_in_records;
CREATE TRIGGER trg_sync_checkin_attendance
AFTER INSERT OR UPDATE ON public.check_in_records
FOR EACH ROW EXECUTE FUNCTION public.sync_checkin_to_attendance();
