-- 1) Protected employee flag (replaces the hardcoded admin email check)
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS is_protected boolean NOT NULL DEFAULT false;

UPDATE public.employees
SET is_protected = true
WHERE lower(email) = 'ense2026@gmail.com';

CREATE OR REPLACE FUNCTION public.prevent_protected_employee_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF COALESCE(OLD.is_protected, false) THEN
    RAISE EXCEPTION 'ไม่สามารถลบบัญชีที่ถูกป้องกันไว้ได้ (%)', OLD.email
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END;
$function$;

-- 2) Resolve the actual shift start time for an employee on a given date
CREATE OR REPLACE FUNCTION public.get_shift_start_time(_employee_id uuid, _date date)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_start text;
  v_shift_text text;
BEGIN
  -- a) explicit shift assignment covering the date
  SELECT s.start_time INTO v_start
  FROM public.shift_assignments sa
  JOIN public.shifts s ON s.id = sa.shift_id
  WHERE sa.employee_id = _employee_id
    AND sa.start_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    AND sa.start_date::date <= _date
    AND (
      sa.end_date IS NULL OR sa.end_date = ''
      OR (sa.end_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND sa.end_date::date >= _date)
    )
  ORDER BY sa.start_date DESC
  LIMIT 1;

  IF v_start IS NOT NULL AND v_start <> '' THEN
    RETURN substr(v_start, 1, 5);
  END IF;

  -- b) shift stored on the employee record ("ชื่อกะ 08:00-17:00")
  SELECT e.shift INTO v_shift_text FROM public.employees e WHERE e.id = _employee_id;

  IF v_shift_text IS NOT NULL AND v_shift_text <> '' THEN
    SELECT s.start_time INTO v_start
    FROM public.shifts s
    WHERE v_shift_text = s.name
       OR v_shift_text = (s.name || ' ' || s.start_time || '-' || s.end_time)
    LIMIT 1;

    IF v_start IS NOT NULL AND v_start <> '' THEN
      RETURN substr(v_start, 1, 5);
    END IF;

    v_start := (regexp_match(v_shift_text, '([0-9]{2}:[0-9]{2})'))[1];
    IF v_start IS NOT NULL THEN
      RETURN v_start;
    END IF;
  END IF;

  RETURN NULL;
END;
$function$;

-- 3) Single source of truth for the "late" rule
CREATE OR REPLACE FUNCTION public.is_late_checkin(_employee_id uuid, _date date, _check_in text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  cfg jsonb;
  grace integer := 30;
  default_start text := '08:00';
  v_start text;
  threshold text;
BEGIN
  IF _check_in IS NULL OR _check_in = '' OR _check_in = '-' THEN
    RETURN false;
  END IF;

  SELECT cs.value INTO cfg FROM public.company_settings cs WHERE cs.key = 'attendance_config';
  IF cfg IS NOT NULL THEN
    grace := COALESCE((cfg->>'lateGraceMinutes')::int, grace);
    default_start := COALESCE(NULLIF(cfg->>'defaultShiftStart', ''), default_start);
  END IF;

  v_start := COALESCE(public.get_shift_start_time(_employee_id, _date), default_start);

  BEGIN
    threshold := to_char((v_start::time + make_interval(mins => grace)), 'HH24:MI');
  EXCEPTION WHEN others THEN
    threshold := '08:30';
  END;

  RETURN substr(_check_in, 1, 5) > threshold;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_shift_start_time(uuid, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_late_checkin(uuid, date, text) TO authenticated, service_role;

-- 4) Use the shared rule when aggregating scanner / check-in records
CREATE OR REPLACE FUNCTION public.sync_checkin_to_attendance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  normalized_date text;
  parsed_date date;
  first_check_in text;
  last_check_out text;
  is_late boolean;
  dayoff boolean;
BEGIN
  normalized_date := CASE
    WHEN split_part(NEW.date, '-', 1)::int > 2400 THEN
      ((split_part(NEW.date, '-', 1)::int - 543)::text || '-' || split_part(NEW.date, '-', 2) || '-' || split_part(NEW.date, '-', 3))
    ELSE NEW.date
  END;

  BEGIN
    parsed_date := normalized_date::date;
  EXCEPTION WHEN others THEN
    parsed_date := NULL;
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

  is_late := public.is_late_checkin(NEW.employee_id, COALESCE(parsed_date, CURRENT_DATE), COALESCE(first_check_in, '-'));

  dayoff := false;
  IF parsed_date IS NOT NULL THEN
    dayoff := public.is_dayoff(NEW.employee_id, parsed_date);
  END IF;

  INSERT INTO public.attendance_records (employee_id, date, check_in, check_out, status, late, ot_hours)
  VALUES (
    NEW.employee_id,
    normalized_date,
    COALESCE(first_check_in, '-'),
    COALESCE(last_check_out, '-'),
    CASE
      WHEN dayoff AND COALESCE(first_check_in, '-') = '-' THEN 'dayoff'
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
$function$;