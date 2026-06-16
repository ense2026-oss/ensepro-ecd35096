
-- =========================================================================
-- Make data-access RLS respect the per-role permission matrix (role_permissions)
-- instead of hardcoded role lists. Uses existing can_access_module() helper.
-- Admin always retains full access as a safety net.
-- =========================================================================

-- ---------- PAYROLL ----------
DROP POLICY IF EXISTS "Payroll managers manage payslips" ON public.payslips;
CREATE POLICY "Payroll view" ON public.payslips FOR SELECT
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'payroll','view'));
CREATE POLICY "Payroll insert" ON public.payslips FOR INSERT
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'payroll','add'));
CREATE POLICY "Payroll update" ON public.payslips FOR UPDATE
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'payroll','edit'))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'payroll','edit'));
CREATE POLICY "Payroll delete" ON public.payslips FOR DELETE
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'payroll','delete'));

DROP POLICY IF EXISTS "Payroll managers manage periods" ON public.payroll_periods;
CREATE POLICY "Periods insert" ON public.payroll_periods FOR INSERT
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'payroll','add'));
CREATE POLICY "Periods update" ON public.payroll_periods FOR UPDATE
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'payroll','edit'))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'payroll','edit'));
CREATE POLICY "Periods delete" ON public.payroll_periods FOR DELETE
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'payroll','delete'));

DROP POLICY IF EXISTS "Payroll managers full access on overrides" ON public.payroll_overrides;
CREATE POLICY "Overrides view" ON public.payroll_overrides FOR SELECT
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'payroll','view'));
CREATE POLICY "Overrides insert" ON public.payroll_overrides FOR INSERT
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'payroll','add'));
CREATE POLICY "Overrides update" ON public.payroll_overrides FOR UPDATE
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'payroll','edit'))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'payroll','edit'));
CREATE POLICY "Overrides delete" ON public.payroll_overrides FOR DELETE
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'payroll','delete'));

DROP POLICY IF EXISTS "Admin/HR/Manager/Executive full access on payroll_items" ON public.employee_custom_payroll_items;
DROP POLICY IF EXISTS "Accountant can read all payroll_items" ON public.employee_custom_payroll_items;
CREATE POLICY "Payroll items view" ON public.employee_custom_payroll_items FOR SELECT
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'payroll','view'));
CREATE POLICY "Payroll items insert" ON public.employee_custom_payroll_items FOR INSERT
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'payroll','add'));
CREATE POLICY "Payroll items update" ON public.employee_custom_payroll_items FOR UPDATE
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'payroll','edit'))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'payroll','edit'));
CREATE POLICY "Payroll items delete" ON public.employee_custom_payroll_items FOR DELETE
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'payroll','delete'));

-- ---------- EMPLOYEES ----------
DROP POLICY IF EXISTS "Admin/HR/Manager/Executive can do everything on employees" ON public.employees;
CREATE POLICY "Employees view" ON public.employees FOR SELECT
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'employee','view'));
CREATE POLICY "Employees insert" ON public.employees FOR INSERT
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'employee','add'));
CREATE POLICY "Employees update" ON public.employees FOR UPDATE
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'employee','edit'))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'employee','edit'));
CREATE POLICY "Employees delete" ON public.employees FOR DELETE
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'employee','delete'));

-- ---------- OVERTIME ----------
DROP POLICY IF EXISTS "Admin/HR/Manager/Executive full access on overtime_requests" ON public.overtime_requests;
CREATE POLICY "OT manage view" ON public.overtime_requests FOR SELECT
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'ot','view'));
CREATE POLICY "OT manage update" ON public.overtime_requests FOR UPDATE
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'ot','edit'))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'ot','edit'));
CREATE POLICY "OT manage delete" ON public.overtime_requests FOR DELETE
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'ot','delete'));
-- Privileged add (in addition to existing employee self-insert policy)
CREATE POLICY "OT manage insert" ON public.overtime_requests FOR INSERT
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'ot','add'));

-- ---------- ATTENDANCE ----------
DROP POLICY IF EXISTS "Admin/HR/Manager full access on attendance_records" ON public.attendance_records;
DROP POLICY IF EXISTS "Executive/Accountant can read attendance_records" ON public.attendance_records;
CREATE POLICY "Attendance view" ON public.attendance_records FOR SELECT
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'attendance','view'));
CREATE POLICY "Attendance insert" ON public.attendance_records FOR INSERT
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'attendance','add'));
CREATE POLICY "Attendance update" ON public.attendance_records FOR UPDATE
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'attendance','edit'))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'attendance','edit'));
CREATE POLICY "Attendance delete" ON public.attendance_records FOR DELETE
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'attendance','delete'));

-- ---------- CHECK-IN ----------
DROP POLICY IF EXISTS "Admin/HR/Manager full access on check_in_records" ON public.check_in_records;
DROP POLICY IF EXISTS "Executive can read all check_in_records" ON public.check_in_records;
CREATE POLICY "Checkin manage view" ON public.check_in_records FOR SELECT
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'check-in','view'));
CREATE POLICY "Checkin manage update" ON public.check_in_records FOR UPDATE
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'check-in','edit'))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'check-in','edit'));
CREATE POLICY "Checkin manage delete" ON public.check_in_records FOR DELETE
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'check-in','delete'));
CREATE POLICY "Checkin manage insert" ON public.check_in_records FOR INSERT
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'check-in','add'));

-- ---------- DAY OFF ----------
DROP POLICY IF EXISTS "Admin/HR/Manager/Executive full access on dayoff_overrides" ON public.employee_dayoff_overrides;
DROP POLICY IF EXISTS "Executive/Accountant read dayoff_overrides" ON public.employee_dayoff_overrides;
CREATE POLICY "Dayoff ovr view" ON public.employee_dayoff_overrides FOR SELECT
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'day_off','view'));
CREATE POLICY "Dayoff ovr insert" ON public.employee_dayoff_overrides FOR INSERT
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'day_off','add'));
CREATE POLICY "Dayoff ovr update" ON public.employee_dayoff_overrides FOR UPDATE
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'day_off','edit'))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'day_off','edit'));
CREATE POLICY "Dayoff ovr delete" ON public.employee_dayoff_overrides FOR DELETE
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'day_off','delete'));

DROP POLICY IF EXISTS "Admin/HR/Manager/Executive full access on dayoff_patterns" ON public.employee_dayoff_patterns;
DROP POLICY IF EXISTS "Executive/Accountant read dayoff_patterns" ON public.employee_dayoff_patterns;
CREATE POLICY "Dayoff pat view" ON public.employee_dayoff_patterns FOR SELECT
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'day_off','view'));
CREATE POLICY "Dayoff pat insert" ON public.employee_dayoff_patterns FOR INSERT
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'day_off','add'));
CREATE POLICY "Dayoff pat update" ON public.employee_dayoff_patterns FOR UPDATE
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'day_off','edit'))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'day_off','edit'));
CREATE POLICY "Dayoff pat delete" ON public.employee_dayoff_patterns FOR DELETE
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'day_off','delete'));

-- ---------- SHIFTS (definitions managed via Settings: settings_shifts) ----------
DROP POLICY IF EXISTS "Admin/HR/Executive can manage shifts" ON public.shifts;
CREATE POLICY "Shifts insert" ON public.shifts FOR INSERT
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'settings_shifts','add') OR can_access_module(auth.uid(),'shiftManagement','add'));
CREATE POLICY "Shifts update" ON public.shifts FOR UPDATE
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'settings_shifts','edit') OR can_access_module(auth.uid(),'shiftManagement','edit'))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'settings_shifts','edit') OR can_access_module(auth.uid(),'shiftManagement','edit'));
CREATE POLICY "Shifts delete" ON public.shifts FOR DELETE
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'settings_shifts','delete') OR can_access_module(auth.uid(),'shiftManagement','delete'));

-- ---------- SHIFT ASSIGNMENTS (Shift Management page) ----------
DROP POLICY IF EXISTS "Admin/HR/Manager/Executive can manage shift_assignments" ON public.shift_assignments;
DROP POLICY IF EXISTS "Executive can read all shift_assignments" ON public.shift_assignments;
CREATE POLICY "Shift asg view" ON public.shift_assignments FOR SELECT
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'shiftManagement','view'));
CREATE POLICY "Shift asg insert" ON public.shift_assignments FOR INSERT
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'shiftManagement','add'));
CREATE POLICY "Shift asg update" ON public.shift_assignments FOR UPDATE
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'shiftManagement','edit'))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'shiftManagement','edit'));
CREATE POLICY "Shift asg delete" ON public.shift_assignments FOR DELETE
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'shiftManagement','delete'));

-- ---------- ORGANIZATION ----------
DROP POLICY IF EXISTS "Admin/HR/Manager can manage org_levels" ON public.org_levels;
CREATE POLICY "Org levels insert" ON public.org_levels FOR INSERT
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'organization','add'));
CREATE POLICY "Org levels update" ON public.org_levels FOR UPDATE
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'organization','edit'))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'organization','edit'));
CREATE POLICY "Org levels delete" ON public.org_levels FOR DELETE
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'organization','delete'));

DROP POLICY IF EXISTS "Admin/HR/Manager can manage org_level_employees" ON public.org_level_employees;
CREATE POLICY "Org level emp insert" ON public.org_level_employees FOR INSERT
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'organization','add'));
CREATE POLICY "Org level emp update" ON public.org_level_employees FOR UPDATE
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'organization','edit'))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'organization','edit'));
CREATE POLICY "Org level emp delete" ON public.org_level_employees FOR DELETE
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'organization','delete'));

-- affiliations (departments) — managed in Organization page and Settings (settings_affiliations)
DROP POLICY IF EXISTS "Authorized users can manage affiliations" ON public.affiliations;
CREATE POLICY "Affiliations insert" ON public.affiliations FOR INSERT
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'organization','add') OR can_access_module(auth.uid(),'settings_affiliations','add'));
CREATE POLICY "Affiliations update" ON public.affiliations FOR UPDATE
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'organization','edit') OR can_access_module(auth.uid(),'settings_affiliations','edit'))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'organization','edit') OR can_access_module(auth.uid(),'settings_affiliations','edit'));
CREATE POLICY "Affiliations delete" ON public.affiliations FOR DELETE
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'organization','delete') OR can_access_module(auth.uid(),'settings_affiliations','delete'));

-- positions
DROP POLICY IF EXISTS "Authorized users can manage positions" ON public.positions;
CREATE POLICY "Positions insert" ON public.positions FOR INSERT
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'organization','add') OR can_access_module(auth.uid(),'settings_affiliations','add'));
CREATE POLICY "Positions update" ON public.positions FOR UPDATE
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'organization','edit') OR can_access_module(auth.uid(),'settings_affiliations','edit'))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'organization','edit') OR can_access_module(auth.uid(),'settings_affiliations','edit'));
CREATE POLICY "Positions delete" ON public.positions FOR DELETE
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'organization','delete') OR can_access_module(auth.uid(),'settings_affiliations','delete'));

-- ---------- LEAVE REQUESTS (manage actions beyond self) ----------
DROP POLICY IF EXISTS "Role-based delete on leave_requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Role-based update on leave_requests" ON public.leave_requests;
CREATE POLICY "Leave manage update" ON public.leave_requests FOR UPDATE
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'leave','edit') OR can_access_module(auth.uid(),'leave','approve'))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'leave','edit') OR can_access_module(auth.uid(),'leave','approve'));
CREATE POLICY "Leave manage delete" ON public.leave_requests FOR DELETE
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'leave','delete')
    OR (employee_id IN (SELECT e.id FROM employees e WHERE e.user_id = auth.uid())));

-- ---------- SETTINGS-MANAGED CONFIG TABLES (per-tab granular) ----------
DROP POLICY IF EXISTS "Settings editors can manage company_holidays" ON public.company_holidays;
CREATE POLICY "Holidays insert" ON public.company_holidays FOR INSERT
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'settings_company_holidays','add'));
CREATE POLICY "Holidays update" ON public.company_holidays FOR UPDATE
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'settings_company_holidays','edit'))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'settings_company_holidays','edit'));
CREATE POLICY "Holidays delete" ON public.company_holidays FOR DELETE
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'settings_company_holidays','delete'));

DROP POLICY IF EXISTS "Settings editors can manage leave_types" ON public.leave_types;
CREATE POLICY "Leave types insert" ON public.leave_types FOR INSERT
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'settings_leave_types','add'));
CREATE POLICY "Leave types update" ON public.leave_types FOR UPDATE
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'settings_leave_types','edit'))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'settings_leave_types','edit'));
CREATE POLICY "Leave types delete" ON public.leave_types FOR DELETE
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'settings_leave_types','delete'));

DROP POLICY IF EXISTS "Admin/HR can manage face_scan_devices" ON public.face_scan_devices;
CREATE POLICY "Facescan insert" ON public.face_scan_devices FOR INSERT
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'settings_facescan','add'));
CREATE POLICY "Facescan update" ON public.face_scan_devices FOR UPDATE
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'settings_facescan','edit'))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'settings_facescan','edit'));
CREATE POLICY "Facescan delete" ON public.face_scan_devices FOR DELETE
  USING (has_role(auth.uid(),'admin'::app_role) OR can_access_module(auth.uid(),'settings_facescan','delete'));

-- company_settings: keep broad edit (many settings tabs persist JSON here),
-- but route through any settings_* edit grant or generic settings edit.
DROP POLICY IF EXISTS "Settings editors can manage company_settings" ON public.company_settings;
CREATE POLICY "Company settings manage" ON public.company_settings FOR ALL
  USING (
    has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'hr'::app_role)
    OR can_access_module(auth.uid(),'settings_company','edit')
    OR can_access_module(auth.uid(),'settings_payroll','edit')
    OR can_access_module(auth.uid(),'settings_modules','edit')
    OR can_access_module(auth.uid(),'settings_approval','edit')
    OR can_access_module(auth.uid(),'settings_display','edit')
    OR can_access_module(auth.uid(),'settings_facescan','edit')
  )
  WITH CHECK (
    has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'hr'::app_role)
    OR can_access_module(auth.uid(),'settings_company','edit')
    OR can_access_module(auth.uid(),'settings_payroll','edit')
    OR can_access_module(auth.uid(),'settings_modules','edit')
    OR can_access_module(auth.uid(),'settings_approval','edit')
    OR can_access_module(auth.uid(),'settings_display','edit')
    OR can_access_module(auth.uid(),'settings_facescan','edit')
  );
