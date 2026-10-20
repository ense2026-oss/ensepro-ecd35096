-- ผู้อนุมัติ "แก้ไขเวลา" รายบุคคล (request_type = 'time_edit') — ต่อจาก 20261020090000_approval_assignments.sql
--
-- เมื่ออนุมัติคำขอแก้ไขเวลา ต้องไปแก้ attendance_records / check_in_records ของลูกทีม ซึ่ง role พนักงานเขียนไม่ได้
-- จึงใช้ฟังก์ชัน SECURITY DEFINER ตัวเดียว (decide_time_edit_request) ที่ตรวจสิทธิ์เอง แล้วแก้เฉพาะ
-- วัน/ค่าตามที่ระบุในคำขอนั้น — ผู้อนุมัติไม่ต้องได้สิทธิ์เขียนตารางเวลาโดยตรง และแก้ค่าในคำขอเองไม่ได้
-- (ไม่เพิ่มนโยบาย UPDATE ให้ผู้อนุมัติ เพื่อกันการเปลี่ยนเวลาในคำขอก่อนกดอนุมัติ)

-- ผู้อนุมัติที่ถูกกำหนด เห็นคำขอแก้ไขเวลาของลูกทีมได้ (เสริมจากนโยบายเดิม)
DROP POLICY IF EXISTS "Assigned approver read time_edit_requests" ON public.time_edit_requests;
CREATE POLICY "Assigned approver read time_edit_requests"
  ON public.time_edit_requests FOR SELECT TO authenticated
  USING (public.is_assigned_approver('time_edit', employee_id));

CREATE OR REPLACE FUNCTION public.decide_time_edit_request(p_request_id uuid, p_action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  r public.time_edit_requests%ROWTYPE;
  v_months text[] := ARRAY['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  v_parts text[];
  v_idx integer;
  v_year integer;
  v_date date;
  v_in text;
  v_out text;
  v_late boolean := false;
  v_status text;
  v_tier integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ต้องเข้าสู่ระบบ';
  END IF;
  IF p_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'action ไม่ถูกต้อง';
  END IF;

  SELECT * INTO r FROM public.time_edit_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ไม่พบคำขอ';
  END IF;
  IF r.status <> 'pending' THEN
    RAISE EXCEPTION 'คำขอนี้ถูกดำเนินการไปแล้ว';
  END IF;

  -- สิทธิ์: admin, role ที่อนุมัติหน้าบันทึกเวลาได้ หรือผู้อนุมัติที่ถูกกำหนดให้พนักงานคนนี้
  IF NOT (
    has_role(v_uid, 'admin'::app_role)
    OR can_access_module(v_uid, 'attendance', 'approve')
    OR public.is_assigned_approver('time_edit', r.employee_id)
  ) THEN
    RAISE EXCEPTION 'คุณไม่ใช่ผู้อนุมัติของคำขอนี้';
  END IF;

  v_tier := COALESCE(r.approved_tiers, 0) + 1;

  INSERT INTO public.approval_logs (request_id, request_type, tier, action, approver_user_id)
  VALUES (p_request_id, 'time_edit', v_tier, p_action, v_uid)
  ON CONFLICT DO NOTHING;

  IF p_action = 'reject' THEN
    UPDATE public.time_edit_requests SET status = 'rejected' WHERE id = p_request_id;
    RETURN;
  END IF;

  -- วันที่ของคำขอ: yyyy-mm-dd หรือรูปแบบไทยย่อ "17 ต.ค. 2569" (ตรงกับตัวแปลงฝั่งแอป)
  IF r.date ~ '^\d{4}-\d{2}-\d{2}$' THEN
    v_date := r.date::date;
  ELSE
    v_parts := regexp_split_to_array(trim(r.date), '\s+');
    IF array_length(v_parts, 1) = 3 THEN
      v_idx := array_position(v_months, v_parts[2]);
      v_year := v_parts[3]::integer;
      IF v_year > 2400 THEN v_year := v_year - 543; END IF;
      IF v_idx IS NOT NULL THEN
        v_date := make_date(v_year, v_idx, v_parts[1]::integer);
      END IF;
    END IF;
  END IF;
  IF v_date IS NULL THEN
    RAISE EXCEPTION 'รูปแบบวันที่ของคำขอไม่ถูกต้อง: %', r.date;
  END IF;

  v_in := COALESCE(NULLIF(r.new_check_in, ''), '-');
  v_out := COALESCE(NULLIF(r.new_check_out, ''), '-');
  IF v_in <> '-' THEN
    v_late := COALESCE(public.is_late_checkin(r.employee_id, v_date, v_in), false);
  END IF;
  v_status := CASE WHEN v_in = '-' THEN 'absent' WHEN v_late THEN 'late' ELSE 'present' END;

  -- 1) แถวเวลาที่ผูกกับคำขอ (ถ้ามี) — ต้องเป็นของพนักงานคนเดียวกัน
  IF r.attendance_id IS NOT NULL THEN
    UPDATE public.attendance_records
       SET check_in = v_in, check_out = v_out, late = v_late, status = v_status
     WHERE id = r.attendance_id AND employee_id = r.employee_id;
  END IF;

  -- 2) บันทึกการสแกน/เช็กอินของวันนั้น + 3) ให้ attendance ตรงกับค่าที่อนุมัติเป๊ะ (เหมือนขั้นตอนฝั่งแอปเดิม)
  UPDATE public.check_in_records
     SET check_in = v_in, check_out = v_out
   WHERE employee_id = r.employee_id AND date = to_char(v_date, 'YYYY-MM-DD');

  INSERT INTO public.attendance_records (employee_id, date, check_in, check_out, late, status)
  VALUES (r.employee_id, to_char(v_date, 'YYYY-MM-DD'), v_in, v_out, v_late, v_status)
  ON CONFLICT (employee_id, date)
  DO UPDATE SET check_in = EXCLUDED.check_in, check_out = EXCLUDED.check_out,
                late = EXCLUDED.late, status = EXCLUDED.status;

  UPDATE public.time_edit_requests
     SET status = 'approved', approved_tiers = v_tier, current_tier = v_tier
   WHERE id = p_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.decide_time_edit_request(uuid, text) TO authenticated;
