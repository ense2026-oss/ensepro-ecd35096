CREATE OR REPLACE FUNCTION public.prevent_protected_employee_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(OLD.email) = 'ense2026@gmail.com' THEN
    RAISE EXCEPTION 'ไม่สามารถลบบัญชีผู้ดูแลระบบหลักนี้ได้ (%)', OLD.email
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_protected_employee_delete ON public.employees;
CREATE TRIGGER trg_prevent_protected_employee_delete
BEFORE DELETE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.prevent_protected_employee_delete();