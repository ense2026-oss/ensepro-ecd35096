
-- ═══ Phase 6: Company Settings ═══

CREATE TABLE public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read company_settings"
  ON public.company_settings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin/HR can manage company_settings"
  ON public.company_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr'));

-- Seed default branding
INSERT INTO public.company_settings (key, value) VALUES
  ('branding', '{"programName": "HRPro", "programSubtitle": "Enterprise", "logoUrl": null, "logoOnlyUrl": null, "displayMode": "logo-and-name"}'::jsonb);
