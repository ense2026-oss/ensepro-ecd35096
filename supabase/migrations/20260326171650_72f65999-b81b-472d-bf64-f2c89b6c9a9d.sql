
CREATE OR REPLACE FUNCTION public.get_approver_user_ids(module_key text)
RETURNS TABLE(user_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  config jsonb;
  mod jsonb;
  tier jsonb;
  tier_type text;
  tier_value text;
BEGIN
  -- Get approval_config
  SELECT cs.value INTO config
  FROM public.company_settings cs
  WHERE cs.key = 'approval_config';

  IF config IS NULL THEN
    -- Fallback: all admin/hr
    RETURN QUERY
      SELECT ur.user_id FROM public.user_roles ur WHERE ur.role IN ('admin', 'hr');
    RETURN;
  END IF;

  -- Find the module in the config array
  SELECT elem INTO mod
  FROM jsonb_array_elements(config) elem
  WHERE elem->>'key' = module_key
  LIMIT 1;

  IF mod IS NULL THEN
    RETURN QUERY
      SELECT ur.user_id FROM public.user_roles ur WHERE ur.role IN ('admin', 'hr');
    RETURN;
  END IF;

  -- Iterate tiers and collect user_ids
  FOR tier IN SELECT * FROM jsonb_array_elements(mod->'tiers')
  LOOP
    tier_type := tier->>'type';
    tier_value := tier->>'value';

    IF tier_type = 'role' THEN
      RETURN QUERY
        SELECT ur.user_id FROM public.user_roles ur WHERE ur.role::text = tier_value;
    ELSIF tier_type = 'employee' THEN
      RETURN QUERY
        SELECT e.user_id FROM public.employees e WHERE e.id = tier_value::uuid AND e.user_id IS NOT NULL;
    END IF;
  END LOOP;

  -- If no results were returned, fallback
  IF NOT FOUND THEN
    RETURN QUERY
      SELECT ur.user_id FROM public.user_roles ur WHERE ur.role IN ('admin', 'hr');
  END IF;
END;
$$;
