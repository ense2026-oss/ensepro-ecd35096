
-- Create role_permissions table
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name text NOT NULL,
  role_description text NOT NULL DEFAULT '',
  module text NOT NULL,
  can_view boolean NOT NULL DEFAULT false,
  can_add boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  can_approve boolean NOT NULL DEFAULT false,
  scope text NOT NULL DEFAULT 'self',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role_name, module)
);

-- Enable RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Admin can manage all
CREATE POLICY "Admin can manage role_permissions"
ON public.role_permissions FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- All authenticated can read
CREATE POLICY "Authenticated can read role_permissions"
ON public.role_permissions FOR SELECT
TO authenticated
USING (true);

-- Seed default permissions
-- Admin
INSERT INTO public.role_permissions (role_name, role_description, module, can_view, can_add, can_edit, can_delete, can_approve, scope) VALUES
('admin', 'ผู้ดูแลระบบ', 'leave', true, true, true, true, true, 'all'),
('admin', 'ผู้ดูแลระบบ', 'ot', true, true, true, true, true, 'all'),
('admin', 'ผู้ดูแลระบบ', 'attendance', true, true, true, true, true, 'all'),
('admin', 'ผู้ดูแลระบบ', 'employee', true, true, true, true, false, 'all'),
('admin', 'ผู้ดูแลระบบ', 'organization', true, true, true, true, false, 'all'),
('admin', 'ผู้ดูแลระบบ', 'shiftManagement', true, true, true, true, false, 'all'),
('admin', 'ผู้ดูแลระบบ', 'payroll', true, true, true, true, false, 'all'),
('admin', 'ผู้ดูแลระบบ', 'reports', true, false, false, false, false, 'all'),
('admin', 'ผู้ดูแลระบบ', 'settings', true, true, true, true, false, 'all'),
('admin', 'ผู้ดูแลระบบ', 'contracts', true, true, true, true, false, 'all'),

-- HR
('hr', 'เจ้าหน้าที่ HR', 'leave', true, true, true, false, true, 'all'),
('hr', 'เจ้าหน้าที่ HR', 'ot', true, true, true, false, true, 'all'),
('hr', 'เจ้าหน้าที่ HR', 'attendance', true, false, true, false, true, 'all'),
('hr', 'เจ้าหน้าที่ HR', 'employee', true, true, true, false, false, 'all'),
('hr', 'เจ้าหน้าที่ HR', 'organization', true, false, false, false, false, 'all'),
('hr', 'เจ้าหน้าที่ HR', 'shiftManagement', true, true, true, true, false, 'all'),
('hr', 'เจ้าหน้าที่ HR', 'payroll', true, true, true, true, false, 'all'),
('hr', 'เจ้าหน้าที่ HR', 'reports', true, false, false, false, false, 'all'),
('hr', 'เจ้าหน้าที่ HR', 'settings', true, false, false, false, false, 'self'),
('hr', 'เจ้าหน้าที่ HR', 'contracts', true, true, true, false, false, 'all'),

-- Manager
('manager', 'ผู้จัดการ / หัวหน้าแผนก', 'leave', true, true, true, false, true, 'department'),
('manager', 'ผู้จัดการ / หัวหน้าแผนก', 'ot', true, true, true, false, true, 'department'),
('manager', 'ผู้จัดการ / หัวหน้าแผนก', 'attendance', true, false, true, false, true, 'department'),
('manager', 'ผู้จัดการ / หัวหน้าแผนก', 'employee', true, false, true, false, false, 'department'),
('manager', 'ผู้จัดการ / หัวหน้าแผนก', 'organization', true, false, false, false, false, 'department'),
('manager', 'ผู้จัดการ / หัวหน้าแผนก', 'shiftManagement', true, true, true, false, false, 'department'),
('manager', 'ผู้จัดการ / หัวหน้าแผนก', 'payroll', false, false, false, false, false, 'self'),
('manager', 'ผู้จัดการ / หัวหน้าแผนก', 'reports', true, false, false, false, false, 'department'),
('manager', 'ผู้จัดการ / หัวหน้าแผนก', 'settings', true, false, false, false, false, 'self'),
('manager', 'ผู้จัดการ / หัวหน้าแผนก', 'contracts', true, true, true, false, false, 'department'),

-- Executive
('executive', 'กรรมการผู้จัดการ / ผู้บริหาร', 'leave', true, true, true, true, true, 'all'),
('executive', 'กรรมการผู้จัดการ / ผู้บริหาร', 'ot', true, true, true, true, true, 'all'),
('executive', 'กรรมการผู้จัดการ / ผู้บริหาร', 'attendance', true, true, true, true, true, 'all'),
('executive', 'กรรมการผู้จัดการ / ผู้บริหาร', 'employee', true, true, true, true, false, 'all'),
('executive', 'กรรมการผู้จัดการ / ผู้บริหาร', 'organization', true, true, true, true, false, 'all'),
('executive', 'กรรมการผู้จัดการ / ผู้บริหาร', 'shiftManagement', true, true, true, true, false, 'all'),
('executive', 'กรรมการผู้จัดการ / ผู้บริหาร', 'payroll', true, true, true, true, false, 'all'),
('executive', 'กรรมการผู้จัดการ / ผู้บริหาร', 'reports', true, false, false, false, false, 'all'),
('executive', 'กรรมการผู้จัดการ / ผู้บริหาร', 'settings', true, true, true, true, false, 'all'),
('executive', 'กรรมการผู้จัดการ / ผู้บริหาร', 'contracts', true, true, true, true, false, 'all'),

-- Accountant
('accountant', 'นักบัญชี', 'leave', true, false, false, false, false, 'self'),
('accountant', 'นักบัญชี', 'ot', true, false, false, false, false, 'self'),
('accountant', 'นักบัญชี', 'attendance', true, false, false, false, false, 'self'),
('accountant', 'นักบัญชี', 'employee', true, false, false, false, false, 'self'),
('accountant', 'นักบัญชี', 'organization', true, false, false, false, false, 'self'),
('accountant', 'นักบัญชี', 'shiftManagement', true, false, false, false, false, 'self'),
('accountant', 'นักบัญชี', 'payroll', true, true, true, true, false, 'all'),
('accountant', 'นักบัญชี', 'reports', true, false, false, false, false, 'department'),
('accountant', 'นักบัญชี', 'settings', true, false, false, false, false, 'self'),
('accountant', 'นักบัญชี', 'contracts', true, false, false, false, false, 'self'),

-- Employee
('employee', 'พนักงานทั่วไป', 'leave', true, true, false, false, false, 'self'),
('employee', 'พนักงานทั่วไป', 'ot', true, true, false, false, false, 'self'),
('employee', 'พนักงานทั่วไป', 'attendance', true, false, false, false, false, 'self'),
('employee', 'พนักงานทั่วไป', 'employee', true, false, false, false, false, 'self'),
('employee', 'พนักงานทั่วไป', 'organization', true, false, false, false, false, 'self'),
('employee', 'พนักงานทั่วไป', 'shiftManagement', false, false, false, false, false, 'self'),
('employee', 'พนักงานทั่วไป', 'payroll', false, false, false, false, false, 'self'),
('employee', 'พนักงานทั่วไป', 'reports', false, false, false, false, false, 'self'),
('employee', 'พนักงานทั่วไป', 'settings', false, false, false, false, false, 'self'),
('employee', 'พนักงานทั่วไป', 'contracts', true, false, false, false, false, 'self');
