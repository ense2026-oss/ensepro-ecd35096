CREATE OR REPLACE FUNCTION public.update_own_employee_photo(_photo_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.employees
  SET photo_url = _photo_url
  WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ไม่พบข้อมูลพนักงานของผู้ใช้นี้';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_own_employee_photo(text) TO authenticated;