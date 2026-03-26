
-- Shifts table (master data for shift definitions)
CREATE TABLE public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  start_time text NOT NULL DEFAULT '08:00',
  end_time text NOT NULL DEFAULT '17:00',
  break_minutes integer NOT NULL DEFAULT 60,
  color text NOT NULL DEFAULT '#22c55e',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read shifts" ON public.shifts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin/HR can manage shifts" ON public.shifts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr'));

-- Shift assignments table (assign employee to a shift for a date range or specific date)
CREATE TABLE public.shift_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  shift_id uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  start_date text NOT NULL DEFAULT '',
  end_date text NOT NULL DEFAULT '',
  assignment_type text NOT NULL DEFAULT 'bulk',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shift_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/HR/Manager can manage shift_assignments" ON public.shift_assignments
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Employees can read own shift_assignments" ON public.shift_assignments
  FOR SELECT TO authenticated
  USING (employee_id IN (SELECT e.id FROM employees e WHERE e.user_id = auth.uid()));

CREATE POLICY "Executive can read all shift_assignments" ON public.shift_assignments
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'executive'));

-- Insert default shifts
INSERT INTO public.shifts (name, start_time, end_time, break_minutes, color, sort_order) VALUES
  ('กะเช้า', '08:00', '17:00', 60, '#22c55e', 0),
  ('กะบ่าย', '14:00', '23:00', 60, '#3b82f6', 1),
  ('กะดึก', '22:00', '07:00', 60, '#a855f7', 2);
