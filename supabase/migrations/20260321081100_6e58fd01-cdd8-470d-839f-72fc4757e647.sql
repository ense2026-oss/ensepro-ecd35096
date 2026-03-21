
-- Employees table
CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  avatar text NOT NULL DEFAULT '',
  avatar_color text NOT NULL DEFAULT 'hsl(200 70% 90%)',
  avatar_text_color text NOT NULL DEFAULT 'hsl(200 70% 35%)',
  photo_url text,
  prefix text NOT NULL DEFAULT '',
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  nickname text NOT NULL DEFAULT '',
  birth_date text NOT NULL DEFAULT '',
  national_id text NOT NULL DEFAULT '',
  nationality text NOT NULL DEFAULT 'ไทย',
  religion text NOT NULL DEFAULT '',
  blood_group text NOT NULL DEFAULT '',
  id_issue_date text NOT NULL DEFAULT '',
  id_expire_date text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  dept text NOT NULL DEFAULT '',
  position text NOT NULL DEFAULT '',
  employee_type text NOT NULL DEFAULT '',
  start_date text NOT NULL DEFAULT '',
  shift text NOT NULL DEFAULT '',
  face_scan_id text NOT NULL DEFAULT '',
  salary text NOT NULL DEFAULT '0',
  status text NOT NULL DEFAULT 'active',
  home_address text NOT NULL DEFAULT '',
  marital_status text NOT NULL DEFAULT '',
  spouse_name text NOT NULL DEFAULT '',
  spouse_phone text NOT NULL DEFAULT '',
  father_name text NOT NULL DEFAULT '',
  father_phone text NOT NULL DEFAULT '',
  mother_name text NOT NULL DEFAULT '',
  mother_phone text NOT NULL DEFAULT '',
  emergency_name text NOT NULL DEFAULT '',
  emergency_relation text NOT NULL DEFAULT '',
  emergency_phone text NOT NULL DEFAULT '',
  username text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'Employee',
  children integer DEFAULT 0,
  children_after_2018 integer DEFAULT 0,
  pvd_rate numeric DEFAULT 0,
  tax_deductions jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.employee_education (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  level text NOT NULL DEFAULT '',
  institution text NOT NULL DEFAULT '',
  major text NOT NULL DEFAULT '',
  year text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_education ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.employee_work_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  company text NOT NULL DEFAULT '',
  position text NOT NULL DEFAULT '',
  start_date text NOT NULL DEFAULT '',
  end_date text NOT NULL DEFAULT '',
  reason text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_work_history ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.employee_custom_payroll_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'income',
  amount numeric NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_custom_payroll_items ENABLE ROW LEVEL SECURITY;

-- RLS for employees
CREATE POLICY "Admin/HR/Manager can do everything on employees"
  ON public.employees FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'hr') OR
    public.has_role(auth.uid(), 'manager')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'hr') OR
    public.has_role(auth.uid(), 'manager')
  );

CREATE POLICY "Employees can read own record"
  ON public.employees FOR SELECT
  USING (user_id = auth.uid());

-- RLS for sub-tables (same pattern)
CREATE POLICY "Admin/HR/Manager full access on education"
  ON public.employee_education FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Employees can read own education"
  ON public.employee_education FOR SELECT
  USING (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));

CREATE POLICY "Admin/HR/Manager full access on work_history"
  ON public.employee_work_history FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Employees can read own work_history"
  ON public.employee_work_history FOR SELECT
  USING (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));

CREATE POLICY "Admin/HR/Manager full access on payroll_items"
  ON public.employee_custom_payroll_items FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Employees can read own payroll_items"
  ON public.employee_custom_payroll_items FOR SELECT
  USING (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));
