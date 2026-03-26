
-- Function to send notifications to configured approvers, bypassing RLS
CREATE OR REPLACE FUNCTION public.notify_approvers(
  p_module_key text,
  p_title text,
  p_description text,
  p_type text DEFAULT 'approval',
  p_action_label text DEFAULT 'ตรวจสอบ',
  p_target_employee text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  config jsonb;
  mod jsonb;
  tier jsonb;
  tier_type text;
  tier_value text;
  approver_uid uuid;
  found_any boolean := false;
BEGIN
  -- Get approval_config
  SELECT cs.value INTO config
  FROM public.company_settings cs
  WHERE cs.key = 'approval_config';

  IF config IS NOT NULL THEN
    -- Find the module
    SELECT elem INTO mod
    FROM jsonb_array_elements(config) elem
    WHERE elem->>'key' = p_module_key
    LIMIT 1;
  END IF;

  IF mod IS NOT NULL AND jsonb_array_length(mod->'tiers') > 0 THEN
    -- Iterate tiers and insert notifications
    FOR tier IN SELECT * FROM jsonb_array_elements(mod->'tiers')
    LOOP
      tier_type := tier->>'type';
      tier_value := tier->>'value';

      IF tier_type = 'role' THEN
        INSERT INTO public.app_notifications (user_id, title, description, type, action_label, target_employee)
        SELECT ur.user_id, p_title, p_description, p_type, p_action_label, p_target_employee
        FROM public.user_roles ur
        WHERE ur.role::text = tier_value;
        IF FOUND THEN found_any := true; END IF;

      ELSIF tier_type = 'employee' THEN
        SELECT e.user_id INTO approver_uid
        FROM public.employees e
        WHERE e.id = tier_value::uuid AND e.user_id IS NOT NULL;

        IF approver_uid IS NOT NULL THEN
          INSERT INTO public.app_notifications (user_id, title, description, type, action_label, target_employee)
          VALUES (approver_uid, p_title, p_description, p_type, p_action_label, p_target_employee);
          found_any := true;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- Fallback to admin/hr if nothing was sent
  IF NOT found_any THEN
    INSERT INTO public.app_notifications (user_id, title, description, type, action_label, target_employee)
    SELECT ur.user_id, p_title, p_description, p_type, p_action_label, p_target_employee
    FROM public.user_roles ur
    WHERE ur.role IN ('admin', 'hr');
  END IF;
END;
$$;

-- Function to notify requester (employee who submitted)
CREATE OR REPLACE FUNCTION public.notify_requester(
  p_employee_id uuid,
  p_title text,
  p_description text,
  p_type text DEFAULT 'approval',
  p_action_label text DEFAULT NULL,
  p_target_employee text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_uid uuid;
BEGIN
  SELECT e.user_id INTO requester_uid
  FROM public.employees e
  WHERE e.id = p_employee_id AND e.user_id IS NOT NULL;

  IF requester_uid IS NOT NULL THEN
    INSERT INTO public.app_notifications (user_id, title, description, type, action_label, target_employee)
    VALUES (requester_uid, p_title, p_description, p_type, p_action_label, p_target_employee);
  END IF;
END;
$$;
