-- 1. employee_dayoff_patterns
CREATE TABLE public.employee_dayoff_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  weekdays INTEGER[] NOT NULL DEFAULT '{}',
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  note TEXT NOT NULL DEFAULT '',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dayoff_patterns_employee ON public.employee_dayoff_patterns(employee_id);
CREATE INDEX idx_dayoff_patterns_effective ON public.employee_dayoff_patterns(effective_from, effective_to);

-- 2. employee_dayoff_overrides
CREATE TABLE public.employee_dayoff_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  is_dayoff BOOLEAN NOT NULL DEFAULT true,
  reason TEXT NOT NULL DEFAULT '',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, date)
);
CREATE INDEX idx_dayoff_overrides_emp_date ON public.employee_dayoff_overrides(employee_id, date);
CREATE INDEX idx_dayoff_overrides_date ON public.employee_dayoff_overrides(date);

-- 3. company_holidays
CREATE TABLE public.company_holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  is_paid BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_company_holidays_date ON public.company_holidays(date);

-- Triggers updated_at
CREATE TRIGGER trg_dayoff_patterns_updated
BEFORE UPDATE ON public.employee_dayoff_patterns
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_dayoff_overrides_updated
BEFORE UPDATE ON public.employee_dayoff_overrides
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.employee_dayoff_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_dayoff_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_holidays ENABLE ROW LEVEL SECURITY;

-- RLS: employee_dayoff_patterns
CREATE POLICY "Admin/HR/Manager full access on dayoff_patterns"
ON public.employee_dayoff_patterns FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Employees read own dayoff_patterns"
ON public.employee_dayoff_patterns FOR SELECT TO authenticated
USING (employee_id IN (SELECT e.id FROM public.employees e WHERE e.user_id = auth.uid()));

CREATE POLICY "Executive/Accountant read dayoff_patterns"
ON public.employee_dayoff_patterns FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'executive'::app_role) OR has_role(auth.uid(), 'accountant'::app_role));

-- RLS: employee_dayoff_overrides
CREATE POLICY "Admin/HR/Manager full access on dayoff_overrides"
ON public.employee_dayoff_overrides FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Employees read own dayoff_overrides"
ON public.employee_dayoff_overrides FOR SELECT TO authenticated
USING (employee_id IN (SELECT e.id FROM public.employees e WHERE e.user_id = auth.uid()));

CREATE POLICY "Executive/Accountant read dayoff_overrides"
ON public.employee_dayoff_overrides FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'executive'::app_role) OR has_role(auth.uid(), 'accountant'::app_role));

-- RLS: company_holidays
CREATE POLICY "Admin/HR can manage company_holidays"
ON public.company_holidays FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role));

CREATE POLICY "Authenticated read company_holidays"
ON public.company_holidays FOR SELECT TO authenticated
USING (true);

-- Helper function: is_dayoff
CREATE OR REPLACE FUNCTION public.is_dayoff(_employee_id UUID, _date DATE)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  override_val BOOLEAN;
  holiday_exists BOOLEAN;
  pattern_match BOOLEAN;
  dow INTEGER;
BEGIN
  -- 1) Override
  SELECT is_dayoff INTO override_val
  FROM public.employee_dayoff_overrides
  WHERE employee_id = _employee_id AND date = _date
  LIMIT 1;
  IF FOUND THEN
    RETURN override_val;
  END IF;

  -- 2) Company holiday
  SELECT EXISTS (
    SELECT 1 FROM public.company_holidays WHERE date = _date
  ) INTO holiday_exists;
  IF holiday_exists THEN
    RETURN true;
  END IF;

  -- 3) Pattern (dow: 0=Sunday)
  dow := EXTRACT(DOW FROM _date)::INTEGER;
  SELECT EXISTS (
    SELECT 1
    FROM public.employee_dayoff_patterns
    WHERE employee_id = _employee_id
      AND dow = ANY(weekdays)
      AND effective_from <= _date
      AND (effective_to IS NULL OR effective_to >= _date)
  ) INTO pattern_match;

  RETURN COALESCE(pattern_match, false);
END;
$$;

-- Update sync_checkin_to_attendance to mark dayoff
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

  is_late := COALESCE(first_check_in, '-') > '08:30';

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

-- Add day_off module permissions
INSERT INTO public.role_permissions (role_name, role_description, module, scope, can_view, can_add, can_edit, can_delete, can_approve)
VALUES
  ('admin', 'ผู้ดูแลระบบ', 'day_off', 'all', true, true, true, true, true),
  ('hr', 'ฝ่ายบุคคล', 'day_off', 'all', true, true, true, true, true),
  ('manager', 'หัวหน้างาน', 'day_off', 'department', true, true, true, false, false),
  ('employee', 'พนักงาน', 'day_off', 'self', true, false, false, false, false),
  ('executive', 'ผู้บริหาร', 'day_off', 'all', true, false, false, false, false),
  ('accountant', 'ฝ่ายบัญชี', 'day_off', 'all', true, false, false, false, false)
ON CONFLICT DO NOTHING;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.employee_dayoff_overrides;
ALTER PUBLICATION supabase_realtime ADD TABLE public.employee_dayoff_patterns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.company_holidays;