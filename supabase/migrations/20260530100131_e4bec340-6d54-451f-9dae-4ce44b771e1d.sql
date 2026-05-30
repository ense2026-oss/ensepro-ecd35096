CREATE OR REPLACE FUNCTION public.enforce_leave_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req_year integer;
  used numeric := 0;
  q integer;
BEGIN
  -- Determine the (Gregorian) year of the request, tolerating Thai BE years
  BEGIN
    req_year := split_part(NEW.date_from, '-', 1)::int;
    IF req_year > 2400 THEN
      req_year := req_year - 543;
    END IF;
  EXCEPTION WHEN others THEN
    req_year := EXTRACT(YEAR FROM now())::int;
  END;

  -- Quota for this leave type (0 or null = unlimited)
  SELECT quota INTO q FROM public.leave_types WHERE id = NEW.leave_type_id;
  IF q IS NULL OR q <= 0 THEN
    RETURN NEW;
  END IF;

  -- Sum existing non-rejected days for the same employee, type and year
  SELECT COALESCE(SUM(lr.days), 0) INTO used
  FROM public.leave_requests lr
  WHERE lr.employee_id = NEW.employee_id
    AND lr.leave_type_id = NEW.leave_type_id
    AND lr.status <> 'rejected'
    AND (
      CASE
        WHEN split_part(lr.date_from, '-', 1) ~ '^[0-9]+$'
             AND split_part(lr.date_from, '-', 1)::int > 2400
          THEN split_part(lr.date_from, '-', 1)::int - 543
        WHEN split_part(lr.date_from, '-', 1) ~ '^[0-9]+$'
          THEN split_part(lr.date_from, '-', 1)::int
        ELSE EXTRACT(YEAR FROM now())::int
      END
    ) = req_year;

  IF (used + COALESCE(NEW.days, 0)) > q THEN
    RAISE EXCEPTION 'เกินโควต้าวันลา: ใช้ไปแล้ว % วัน รวมคำขอนี้ % วัน เกินโควต้า % วัน', used, NEW.days, q
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_leave_quota ON public.leave_requests;
CREATE TRIGGER trg_enforce_leave_quota
BEFORE INSERT ON public.leave_requests
FOR EACH ROW
EXECUTE FUNCTION public.enforce_leave_quota();