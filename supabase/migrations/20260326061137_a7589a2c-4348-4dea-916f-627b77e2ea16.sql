
-- Junction table: assign employees to org_levels
CREATE TABLE public.org_level_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_level_id uuid NOT NULL REFERENCES public.org_levels(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(org_level_id, employee_id)
);

ALTER TABLE public.org_level_employees ENABLE ROW LEVEL SECURITY;

-- Admin/HR/Manager can manage
CREATE POLICY "Admin/HR/Manager can manage org_level_employees"
ON public.org_level_employees
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager')
)
WITH CHECK (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager')
);

-- Anyone authenticated can read
CREATE POLICY "Anyone authenticated can read org_level_employees"
ON public.org_level_employees
FOR SELECT
TO authenticated
USING (true);
