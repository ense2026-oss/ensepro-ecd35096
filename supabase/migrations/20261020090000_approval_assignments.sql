-- ผู้อนุมัติรายบุคคล (เริ่มที่ "การลา" แต่ออกแบบให้ขยายไป OT / แก้ไขเวลา ได้ด้วย request_type)
-- แต่ละพนักงานกำหนดผู้อนุมัติได้หลายคน — คนใดคนหนึ่งอนุมัติก็จบ
-- ถ้ายังไม่ได้กำหนด: ใช้ผู้อนุมัติเดิมตามตารางสิทธิ์ role (admin/hr ...) เหมือนเดิม
-- นโยบาย RLS ที่เพิ่มเป็นแบบ "เสริม" (permissive = OR กับของเดิม) จึงไม่ตัดสิทธิ์ใคร

CREATE TABLE IF NOT EXISTS public.approval_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type text NOT NULL DEFAULT 'leave',
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  approver_employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_type, employee_id, approver_employee_id),
  CHECK (employee_id <> approver_employee_id)
);

CREATE INDEX IF NOT EXISTS approval_assignments_approver_idx
  ON public.approval_assignments (approver_employee_id, request_type);
CREATE INDEX IF NOT EXISTS approval_assignments_employee_idx
  ON public.approval_assignments (employee_id, request_type);

ALTER TABLE public.approval_assignments ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.approval_assignments TO authenticated;
GRANT ALL ON public.approval_assignments TO service_role;

-- ทุกคนที่ล็อกอินอ่านได้ (เห็นว่าใครอนุมัติให้ใคร — มีแต่ id)
DROP POLICY IF EXISTS "Approval assignments readable" ON public.approval_assignments;
CREATE POLICY "Approval assignments readable"
  ON public.approval_assignments FOR SELECT TO authenticated
  USING (true);

-- กำหนด/แก้ไขได้เฉพาะ admin, hr หรือ role ที่แก้ข้อมูลพนักงานได้
DROP POLICY IF EXISTS "Approval assignments manage" ON public.approval_assignments;
CREATE POLICY "Approval assignments manage"
  ON public.approval_assignments FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
    OR can_access_module(auth.uid(), 'employee', 'edit')
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
    OR can_access_module(auth.uid(), 'employee', 'edit')
  );

-- ผู้ใช้ปัจจุบันเป็นผู้อนุมัติที่ถูกกำหนดของพนักงานคนนี้หรือไม่
CREATE OR REPLACE FUNCTION public.is_assigned_approver(_request_type text, _employee_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.approval_assignments a
    JOIN public.employees ap ON ap.id = a.approver_employee_id
    WHERE a.request_type = _request_type
      AND a.employee_id = _employee_id
      AND ap.user_id = auth.uid()
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_assigned_approver(text, uuid) TO authenticated;

-- ผู้อนุมัติที่ถูกกำหนด อ่าน/อนุมัติ ใบลาของลูกทีมตัวเองได้ (ไม่ว่า role จะเป็นอะไร)
DROP POLICY IF EXISTS "Assigned approver read leave_requests" ON public.leave_requests;
CREATE POLICY "Assigned approver read leave_requests"
  ON public.leave_requests FOR SELECT TO authenticated
  USING (public.is_assigned_approver('leave', employee_id));

DROP POLICY IF EXISTS "Assigned approver update leave_requests" ON public.leave_requests;
CREATE POLICY "Assigned approver update leave_requests"
  ON public.leave_requests FOR UPDATE TO authenticated
  USING (public.is_assigned_approver('leave', employee_id))
  WITH CHECK (public.is_assigned_approver('leave', employee_id));

-- แจ้งเตือนเฉพาะผู้อนุมัติของพนักงานคนนั้น; ถ้ายังไม่ได้กำหนดใคร ใช้การแจ้งเตือนเดิม (admin/hr ตาม approval_config)
CREATE OR REPLACE FUNCTION public.notify_assigned_approvers(
  p_request_type text,
  p_employee_id uuid,
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
  n integer;
BEGIN
  INSERT INTO public.app_notifications (user_id, title, description, type, action_label, target_employee)
  SELECT DISTINCT ap.user_id, p_title, p_description, p_type, p_action_label, p_target_employee
  FROM public.approval_assignments a
  JOIN public.employees ap ON ap.id = a.approver_employee_id
  WHERE a.request_type = p_request_type
    AND a.employee_id = p_employee_id
    AND ap.user_id IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT;

  IF n = 0 THEN
    PERFORM public.notify_approvers(p_module_key, p_title, p_description, p_type, p_action_label, p_target_employee);
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.notify_assigned_approvers(text, uuid, text, text, text, text, text, text) TO authenticated;
