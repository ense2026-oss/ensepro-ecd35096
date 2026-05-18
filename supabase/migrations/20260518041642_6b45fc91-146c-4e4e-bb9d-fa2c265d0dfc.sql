-- Payroll periods (one per month/year)
CREATE TABLE public.payroll_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  published_at timestamptz,
  published_by uuid,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(year, month)
);

CREATE TRIGGER trg_payroll_periods_updated
BEFORE UPDATE ON public.payroll_periods
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;

-- Helper: is a period published?
CREATE OR REPLACE FUNCTION public.is_payslip_published(_period_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.payroll_periods
    WHERE id = _period_id AND status = 'published'
  )
$$;

-- Payslips: frozen snapshot per employee per period
CREATE TABLE public.payslips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL,
  base_salary numeric NOT NULL DEFAULT 0,
  ot_pay numeric NOT NULL DEFAULT 0,
  ot_hours numeric NOT NULL DEFAULT 0,
  diligence numeric NOT NULL DEFAULT 0,
  custom_income numeric NOT NULL DEFAULT 0,
  custom_deduction numeric NOT NULL DEFAULT 0,
  gross_pay numeric NOT NULL DEFAULT 0,
  ssf numeric NOT NULL DEFAULT 0,
  tax numeric NOT NULL DEFAULT 0,
  total_deduct numeric NOT NULL DEFAULT 0,
  net_pay numeric NOT NULL DEFAULT 0,
  attendance jsonb NOT NULL DEFAULT '{}'::jsonb,
  custom_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  tax_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(period_id, employee_id)
);

CREATE TRIGGER trg_payslips_updated
BEFORE UPDATE ON public.payslips
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_payslips_employee ON public.payslips(employee_id);
CREATE INDEX idx_payslips_period ON public.payslips(period_id);

ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

-- RLS: payroll_periods
CREATE POLICY "Admin/HR/Accountant manage periods"
ON public.payroll_periods FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'hr') OR has_role(auth.uid(),'accountant'))
WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'hr') OR has_role(auth.uid(),'accountant'));

CREATE POLICY "Authenticated read published periods"
ON public.payroll_periods FOR SELECT TO authenticated
USING (status = 'published' OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'hr') OR has_role(auth.uid(),'accountant'));

-- RLS: payslips
CREATE POLICY "Admin/HR/Accountant manage payslips"
ON public.payslips FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'hr') OR has_role(auth.uid(),'accountant'))
WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'hr') OR has_role(auth.uid(),'accountant'));

CREATE POLICY "Employees read own published payslips"
ON public.payslips FOR SELECT TO authenticated
USING (
  is_payslip_published(period_id)
  AND employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.payroll_periods;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payslips;