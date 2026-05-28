
-- 1) Fix missing grants + executive policy on employee_custom_payroll_items
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_custom_payroll_items TO authenticated;
GRANT ALL ON public.employee_custom_payroll_items TO service_role;

DROP POLICY IF EXISTS "Admin/HR/Manager full access on payroll_items" ON public.employee_custom_payroll_items;
CREATE POLICY "Admin/HR/Manager/Executive full access on payroll_items"
ON public.employee_custom_payroll_items
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'hr'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'executive'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'hr'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'executive'::app_role)
);

-- 2) New payroll_overrides table
CREATE TABLE IF NOT EXISTS public.payroll_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  year integer NOT NULL,
  month integer NOT NULL,
  base_salary numeric,
  ot_pay numeric,
  diligence numeric,
  ssf numeric,
  tax numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, year, month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_overrides TO authenticated;
GRANT ALL ON public.payroll_overrides TO service_role;

ALTER TABLE public.payroll_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Payroll managers full access on overrides"
ON public.payroll_overrides
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'hr'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'executive'::app_role)
  OR has_role(auth.uid(), 'accountant'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'hr'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'executive'::app_role)
  OR has_role(auth.uid(), 'accountant'::app_role)
);

CREATE POLICY "Employees can read own overrides"
ON public.payroll_overrides
FOR SELECT
USING (
  employee_id IN (
    SELECT id FROM public.employees WHERE user_id = auth.uid()
  )
);

CREATE TRIGGER update_payroll_overrides_updated_at
BEFORE UPDATE ON public.payroll_overrides
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
