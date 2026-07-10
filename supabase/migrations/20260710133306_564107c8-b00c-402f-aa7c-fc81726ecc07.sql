
-- ============================================================
-- PART 1: Support custom roles in user_roles (text-based role)
-- ============================================================

ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS role_name text;

-- Backfill role_name from the existing enum role
UPDATE public.user_roles SET role_name = role::text WHERE role_name IS NULL;

-- Make enum role nullable (custom roles have no enum equivalent)
ALTER TABLE public.user_roles ALTER COLUMN role DROP NOT NULL;

-- role_name is now the source of truth
ALTER TABLE public.user_roles ALTER COLUMN role_name SET NOT NULL;

-- Unique per user + role_name
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_role_name_key'
  ) THEN
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_name_key UNIQUE (user_id, role_name);
  END IF;
END $$;

-- ============================================================
-- Update SECURITY DEFINER functions to use role_name
-- ============================================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role_name = _role::text
  )
$function$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
 RETURNS app_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id AND role IS NOT NULL
  LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.can_access_module(_user_id uuid, _module text, _action text DEFAULT 'view'::text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_name = ur.role_name
    WHERE ur.user_id = _user_id
      AND rp.module = _module
      AND (
        (_action = 'view' AND rp.can_view = true) OR
        (_action = 'add' AND rp.can_add = true) OR
        (_action = 'edit' AND rp.can_edit = true) OR
        (_action = 'delete' AND rp.can_delete = true) OR
        (_action = 'approve' AND rp.can_approve = true)
      )
  )
$function$;

CREATE OR REPLACE FUNCTION public.can_access_leave(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_name = ur.role_name
    WHERE ur.user_id = _user_id
      AND rp.module = 'leave'
      AND rp.can_view = true
  )
$function$;

CREATE OR REPLACE FUNCTION public.can_view_employee_data(_user_id uuid, _module text, _target_employee_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_can_view boolean;
  v_scope text;
BEGIN
  SELECT rp.can_view, rp.scope
  INTO v_can_view, v_scope
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON rp.role_name = ur.role_name
  WHERE ur.user_id = _user_id
    AND rp.module = _module
  ORDER BY (CASE rp.scope WHEN 'all' THEN 3 WHEN 'department' THEN 2 ELSE 1 END) DESC
  LIMIT 1;

  IF NOT COALESCE(v_can_view, false) THEN
    RETURN false;
  END IF;

  IF v_scope = 'all' THEN
    RETURN true;
  ELSIF v_scope = 'self' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = _target_employee_id AND e.user_id = _user_id
    );
  ELSIF v_scope = 'department' THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.employees me
      JOIN public.employees te ON te.dept = me.dept
      WHERE me.user_id = _user_id AND te.id = _target_employee_id
    );
  END IF;

  RETURN false;
END;
$function$;

-- notify_approvers: match user_roles by role_name
CREATE OR REPLACE FUNCTION public.notify_approvers(p_module_key text, p_title text, p_description text, p_type text DEFAULT 'approval'::text, p_action_label text DEFAULT 'ตรวจสอบ'::text, p_target_employee text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  config jsonb;
  mod jsonb;
  tier jsonb;
  tier_type text;
  tier_value text;
  approver_uid uuid;
  found_any boolean := false;
BEGIN
  SELECT cs.value INTO config
  FROM public.company_settings cs
  WHERE cs.key = 'approval_config';

  IF config IS NOT NULL THEN
    SELECT elem INTO mod
    FROM jsonb_array_elements(config) elem
    WHERE elem->>'key' = p_module_key
    LIMIT 1;
  END IF;

  IF mod IS NOT NULL AND jsonb_array_length(mod->'tiers') > 0 THEN
    FOR tier IN SELECT * FROM jsonb_array_elements(mod->'tiers')
    LOOP
      tier_type := tier->>'type';
      tier_value := tier->>'value';

      IF tier_type = 'role' THEN
        INSERT INTO public.app_notifications (user_id, title, description, type, action_label, target_employee)
        SELECT ur.user_id, p_title, p_description, p_type, p_action_label, p_target_employee
        FROM public.user_roles ur
        WHERE ur.role_name = tier_value;
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

  IF NOT found_any THEN
    INSERT INTO public.app_notifications (user_id, title, description, type, action_label, target_employee)
    SELECT ur.user_id, p_title, p_description, p_type, p_action_label, p_target_employee
    FROM public.user_roles ur
    WHERE ur.role_name IN ('admin', 'hr');
  END IF;
END;
$function$;

-- get_approver_user_ids: match by role_name
CREATE OR REPLACE FUNCTION public.get_approver_user_ids(module_key text)
 RETURNS TABLE(user_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  config jsonb;
  mod jsonb;
  tier jsonb;
  tier_type text;
  tier_value text;
BEGIN
  SELECT cs.value INTO config
  FROM public.company_settings cs
  WHERE cs.key = 'approval_config';

  IF config IS NULL THEN
    RETURN QUERY
      SELECT ur.user_id FROM public.user_roles ur WHERE ur.role_name IN ('admin', 'hr');
    RETURN;
  END IF;

  SELECT elem INTO mod
  FROM jsonb_array_elements(config) elem
  WHERE elem->>'key' = module_key
  LIMIT 1;

  IF mod IS NULL THEN
    RETURN QUERY
      SELECT ur.user_id FROM public.user_roles ur WHERE ur.role_name IN ('admin', 'hr');
    RETURN;
  END IF;

  FOR tier IN SELECT * FROM jsonb_array_elements(mod->'tiers')
  LOOP
    tier_type := tier->>'type';
    tier_value := tier->>'value';

    IF tier_type = 'role' THEN
      RETURN QUERY
        SELECT ur.user_id FROM public.user_roles ur WHERE ur.role_name = tier_value;
    ELSIF tier_type = 'employee' THEN
      RETURN QUERY
        SELECT e.user_id FROM public.employees e WHERE e.id = tier_value::uuid AND e.user_id IS NOT NULL;
    END IF;
  END LOOP;

  IF NOT FOUND THEN
    RETURN QUERY
      SELECT ur.user_id FROM public.user_roles ur WHERE ur.role_name IN ('admin', 'hr');
  END IF;
END;
$function$;

-- handle_new_user: write both enum role (when base) and role_name
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_role_text text := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'employee');
  v_role app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'username', ''),
      split_part(NEW.email, '@', 1) || '_' || substr(NEW.id::text, 1, 8)
    )
  )
  ON CONFLICT (id) DO NOTHING;

  BEGIN
    v_role := v_role_text::app_role;
  EXCEPTION WHEN others THEN
    v_role := NULL;
  END;

  INSERT INTO public.user_roles (user_id, role, role_name)
  VALUES (NEW.id, v_role, v_role_text)
  ON CONFLICT (user_id, role_name) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- ============================================================
-- PART 2: Enforce scope at DB level (leave/ot/shift/payslip/day_off)
-- ============================================================

-- leave_requests
DROP POLICY IF EXISTS "Role-based read access on leave_requests" ON public.leave_requests;
CREATE POLICY "Role-based read access on leave_requests"
ON public.leave_requests FOR SELECT
USING (
  (employee_id IN (SELECT e.id FROM public.employees e WHERE e.user_id = auth.uid()))
  OR has_role(auth.uid(), 'admin'::app_role)
  OR can_view_employee_data(auth.uid(), 'leave', employee_id)
);

-- overtime_requests
DROP POLICY IF EXISTS "OT manage view" ON public.overtime_requests;
CREATE POLICY "OT manage view"
ON public.overtime_requests FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR can_view_employee_data(auth.uid(), 'ot', employee_id)
);

-- shift_assignments
DROP POLICY IF EXISTS "Shift asg view" ON public.shift_assignments;
CREATE POLICY "Shift asg view"
ON public.shift_assignments FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR can_view_employee_data(auth.uid(), 'shiftManagement', employee_id)
);

-- payslips
DROP POLICY IF EXISTS "Payroll view" ON public.payslips;
CREATE POLICY "Payroll view"
ON public.payslips FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR can_view_employee_data(auth.uid(), 'payroll', employee_id)
);

-- employee_dayoff_overrides
DROP POLICY IF EXISTS "Dayoff ovr view" ON public.employee_dayoff_overrides;
CREATE POLICY "Dayoff ovr view"
ON public.employee_dayoff_overrides FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR can_view_employee_data(auth.uid(), 'day_off', employee_id)
);

-- employee_dayoff_patterns
DROP POLICY IF EXISTS "Dayoff pat view" ON public.employee_dayoff_patterns;
CREATE POLICY "Dayoff pat view"
ON public.employee_dayoff_patterns FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR can_view_employee_data(auth.uid(), 'day_off', employee_id)
);

-- ============================================================
-- PART 3: Contracts + time_edit_requests use role_permissions
-- ============================================================

-- contracts: drop hardcoded ALL policy, add granular permission-based policies
DROP POLICY IF EXISTS "Admin/HR/Manager/Executive full access on contracts" ON public.contracts;

CREATE POLICY "Contracts scoped view"
ON public.contracts FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR can_view_employee_data(auth.uid(), 'contracts', employee_id)
);

CREATE POLICY "Contracts insert"
ON public.contracts FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR can_access_module(auth.uid(), 'contracts', 'add')
);

CREATE POLICY "Contracts update"
ON public.contracts FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR can_access_module(auth.uid(), 'contracts', 'edit')
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR can_access_module(auth.uid(), 'contracts', 'edit')
);

CREATE POLICY "Contracts delete"
ON public.contracts FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR can_access_module(auth.uid(), 'contracts', 'delete')
);

-- time_edit_requests: drop hardcoded ALL policy, tie to attendance module
DROP POLICY IF EXISTS "Admin/HR/Manager/Executive full access on time_edit_requests" ON public.time_edit_requests;

CREATE POLICY "Time edit scoped view"
ON public.time_edit_requests FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR can_view_employee_data(auth.uid(), 'attendance', employee_id)
);

CREATE POLICY "Time edit manage insert"
ON public.time_edit_requests FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR can_access_module(auth.uid(), 'attendance', 'edit')
);

CREATE POLICY "Time edit manage update"
ON public.time_edit_requests FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR can_access_module(auth.uid(), 'attendance', 'edit')
  OR can_access_module(auth.uid(), 'attendance', 'approve')
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR can_access_module(auth.uid(), 'attendance', 'edit')
  OR can_access_module(auth.uid(), 'attendance', 'approve')
);

CREATE POLICY "Time edit manage delete"
ON public.time_edit_requests FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR can_access_module(auth.uid(), 'attendance', 'delete')
);
