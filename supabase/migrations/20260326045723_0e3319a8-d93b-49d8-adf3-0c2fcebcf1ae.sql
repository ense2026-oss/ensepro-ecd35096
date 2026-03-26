
-- Create org_levels table for company-level positions above affiliations
CREATE TABLE public.org_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  parent_id uuid REFERENCES public.org_levels(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.org_levels ENABLE ROW LEVEL SECURITY;

-- RLS: Admin/HR/Manager can manage
CREATE POLICY "Admin/HR/Manager can manage org_levels"
  ON public.org_levels FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager'));

-- RLS: Anyone authenticated can read
CREATE POLICY "Anyone authenticated can read org_levels"
  ON public.org_levels FOR SELECT TO authenticated
  USING (true);

-- Add parent_org_level_id to affiliations
ALTER TABLE public.affiliations
  ADD COLUMN parent_org_level_id uuid REFERENCES public.org_levels(id) ON DELETE SET NULL;
