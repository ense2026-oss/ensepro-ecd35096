-- Grant Data API access to organization tables (were missing, causing CRUD to silently fail)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.affiliations TO authenticated;
GRANT ALL ON public.affiliations TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.positions TO authenticated;
GRANT ALL ON public.positions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_levels TO authenticated;
GRANT ALL ON public.org_levels TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_level_employees TO authenticated;
GRANT ALL ON public.org_level_employees TO service_role;