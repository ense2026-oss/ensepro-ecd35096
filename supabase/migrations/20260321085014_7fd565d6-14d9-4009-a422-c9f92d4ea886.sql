
-- ═══ Phase 5: Attendance, Leave, Overtime, Time Edit ═══

-- 1. attendance_records: ลงเวลาเข้า-ออกรายวัน (admin view)
CREATE TABLE public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date text NOT NULL DEFAULT '',
  check_in text NOT NULL DEFAULT '-',
  check_out text NOT NULL DEFAULT '-',
  status text NOT NULL DEFAULT 'present',
  late boolean NOT NULL DEFAULT false,
  ot_hours numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/HR/Manager full access on attendance_records"
  ON public.attendance_records FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Employees can read own attendance_records"
  ON public.attendance_records FOR SELECT TO authenticated
  USING (employee_id IN (SELECT e.id FROM employees e WHERE e.user_id = auth.uid()));

-- 2. check_in_records: บันทึกลงเวลาจากหน้า CheckIn (per user)
CREATE TABLE public.check_in_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date text NOT NULL DEFAULT '',
  check_in text NOT NULL DEFAULT '-',
  check_out text,
  location text NOT NULL DEFAULT '',
  within_radius boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'gps',
  remark text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.check_in_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/HR/Manager full access on check_in_records"
  ON public.check_in_records FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Employees can read own check_in_records"
  ON public.check_in_records FOR SELECT TO authenticated
  USING (employee_id IN (SELECT e.id FROM employees e WHERE e.user_id = auth.uid()));

CREATE POLICY "Employees can insert own check_in_records"
  ON public.check_in_records FOR INSERT TO authenticated
  WITH CHECK (employee_id IN (SELECT e.id FROM employees e WHERE e.user_id = auth.uid()));

CREATE POLICY "Employees can update own check_in_records"
  ON public.check_in_records FOR UPDATE TO authenticated
  USING (employee_id IN (SELECT e.id FROM employees e WHERE e.user_id = auth.uid()))
  WITH CHECK (employee_id IN (SELECT e.id FROM employees e WHERE e.user_id = auth.uid()));

-- 3. leave_types: ประเภทการลา + โควต้า
CREATE TABLE public.leave_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  quota integer NOT NULL DEFAULT 0,
  color text NOT NULL DEFAULT '#6B7280',
  require_doc boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read leave_types"
  ON public.leave_types FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin/HR can manage leave_types"
  ON public.leave_types FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr'));

-- Seed default leave types
INSERT INTO public.leave_types (name, quota, color, require_doc, sort_order) VALUES
  ('ลาป่วย', 30, '#FF870F', true, 1),
  ('ลาพักร้อน', 10, '#87FF0F', false, 2),
  ('ลากิจ', 7, '#6B7280', false, 3),
  ('ลาคลอด', 98, '#60a5fa', true, 4);

-- 4. leave_requests: คำขอลา
CREATE TABLE public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type_id uuid NOT NULL REFERENCES public.leave_types(id) ON DELETE CASCADE,
  leave_type_name text NOT NULL DEFAULT '',
  date_from text NOT NULL DEFAULT '',
  date_to text NOT NULL DEFAULT '',
  days integer NOT NULL DEFAULT 1,
  reason text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  has_file boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/HR/Manager full access on leave_requests"
  ON public.leave_requests FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Employees can read own leave_requests"
  ON public.leave_requests FOR SELECT TO authenticated
  USING (employee_id IN (SELECT e.id FROM employees e WHERE e.user_id = auth.uid()));

CREATE POLICY "Employees can insert own leave_requests"
  ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (employee_id IN (SELECT e.id FROM employees e WHERE e.user_id = auth.uid()));

-- 5. overtime_requests: คำขอ OT
CREATE TABLE public.overtime_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date text NOT NULL DEFAULT '',
  start_time text NOT NULL DEFAULT '',
  end_time text NOT NULL DEFAULT '',
  hours numeric NOT NULL DEFAULT 0,
  ot_type text NOT NULL DEFAULT 'workday',
  reason text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  approved_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.overtime_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/HR/Manager full access on overtime_requests"
  ON public.overtime_requests FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Employees can read own overtime_requests"
  ON public.overtime_requests FOR SELECT TO authenticated
  USING (employee_id IN (SELECT e.id FROM employees e WHERE e.user_id = auth.uid()));

CREATE POLICY "Employees can insert own overtime_requests"
  ON public.overtime_requests FOR INSERT TO authenticated
  WITH CHECK (employee_id IN (SELECT e.id FROM employees e WHERE e.user_id = auth.uid()));

-- 6. time_edit_requests: คำขอแก้ไขเวลา
CREATE TABLE public.time_edit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  attendance_id uuid REFERENCES public.attendance_records(id) ON DELETE SET NULL,
  date text NOT NULL DEFAULT '',
  original_check_in text NOT NULL DEFAULT '-',
  original_check_out text NOT NULL DEFAULT '-',
  new_check_in text NOT NULL DEFAULT '',
  new_check_out text NOT NULL DEFAULT '',
  reason text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.time_edit_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/HR/Manager full access on time_edit_requests"
  ON public.time_edit_requests FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Employees can read own time_edit_requests"
  ON public.time_edit_requests FOR SELECT TO authenticated
  USING (employee_id IN (SELECT e.id FROM employees e WHERE e.user_id = auth.uid()));

CREATE POLICY "Employees can insert own time_edit_requests"
  ON public.time_edit_requests FOR INSERT TO authenticated
  WITH CHECK (employee_id IN (SELECT e.id FROM employees e WHERE e.user_id = auth.uid()));

-- 7. app_notifications: การแจ้งเตือนทั่วไป
CREATE TABLE public.app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'system',
  is_read boolean NOT NULL DEFAULT false,
  action_label text,
  target_employee text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
  ON public.app_notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON public.app_notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications"
  ON public.app_notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Authenticated can insert notifications"
  ON public.app_notifications FOR INSERT TO authenticated
  WITH CHECK (true);

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.time_edit_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leave_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.overtime_requests;
