-- Enable realtime replication for core data tables so all clients update instantly
ALTER TABLE public.employees REPLICA IDENTITY FULL;
ALTER TABLE public.employee_education REPLICA IDENTITY FULL;
ALTER TABLE public.employee_work_history REPLICA IDENTITY FULL;
ALTER TABLE public.employee_custom_payroll_items REPLICA IDENTITY FULL;
ALTER TABLE public.affiliations REPLICA IDENTITY FULL;
ALTER TABLE public.positions REPLICA IDENTITY FULL;
ALTER TABLE public.org_levels REPLICA IDENTITY FULL;
ALTER TABLE public.org_level_employees REPLICA IDENTITY FULL;
ALTER TABLE public.role_permissions REPLICA IDENTITY FULL;
ALTER TABLE public.user_roles REPLICA IDENTITY FULL;
ALTER TABLE public.leave_types REPLICA IDENTITY FULL;
ALTER TABLE public.contracts REPLICA IDENTITY FULL;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'employees','employee_education','employee_work_history','employee_custom_payroll_items',
    'affiliations','positions','org_levels','org_level_employees',
    'role_permissions','user_roles','leave_types','contracts'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;