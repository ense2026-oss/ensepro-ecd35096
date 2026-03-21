
-- Contracts table
CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number text NOT NULL DEFAULT '',
  employee_id uuid NOT NULL,
  title text NOT NULL DEFAULT '',
  contract_type text NOT NULL DEFAULT 'จ้างงาน',
  start_date text NOT NULL DEFAULT '',
  end_date text NOT NULL DEFAULT '',
  salary numeric NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  witness_1_id uuid,
  witness_2_id uuid,
  executive_id uuid NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/HR/Manager full access on contracts"
  ON public.contracts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Employees can read own contracts"
  ON public.contracts FOR SELECT TO authenticated
  USING (employee_id IN (SELECT e.id FROM employees e WHERE e.user_id = auth.uid()));

-- Contract signatures
CREATE TABLE public.contract_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  signer_id uuid NOT NULL,
  signer_role text NOT NULL DEFAULT 'employee',
  signature_type text NOT NULL DEFAULT 'draw',
  signature_data text NOT NULL DEFAULT '',
  signed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/HR/Manager full access on signatures"
  ON public.contract_signatures FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Employees can read signatures of own contracts"
  ON public.contract_signatures FOR SELECT TO authenticated
  USING (contract_id IN (SELECT c.id FROM contracts c JOIN employees e ON c.employee_id = e.id WHERE e.user_id = auth.uid()));

CREATE POLICY "Employees can insert own signatures"
  ON public.contract_signatures FOR INSERT TO authenticated
  WITH CHECK (signer_id IN (SELECT e.id FROM employees e WHERE e.user_id = auth.uid()));

-- Contract attachments
CREATE TABLE public.contract_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  file_name text NOT NULL DEFAULT '',
  file_url text NOT NULL DEFAULT '',
  file_type text NOT NULL DEFAULT '',
  uploaded_by uuid NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/HR/Manager full access on attachments"
  ON public.contract_attachments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Employees can read attachments of own contracts"
  ON public.contract_attachments FOR SELECT TO authenticated
  USING (contract_id IN (SELECT c.id FROM contracts c JOIN employees e ON c.employee_id = e.id WHERE e.user_id = auth.uid()));

-- Contract notifications
CREATE TABLE public.contract_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL,
  message text NOT NULL DEFAULT '',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/HR/Manager full access on contract_notifications"
  ON public.contract_notifications FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Recipients can read own notifications"
  ON public.contract_notifications FOR SELECT TO authenticated
  USING (recipient_id IN (SELECT e.id FROM employees e WHERE e.user_id = auth.uid()));

CREATE POLICY "Recipients can update own notifications"
  ON public.contract_notifications FOR UPDATE TO authenticated
  USING (recipient_id IN (SELECT e.id FROM employees e WHERE e.user_id = auth.uid()))
  WITH CHECK (recipient_id IN (SELECT e.id FROM employees e WHERE e.user_id = auth.uid()));

-- Contract settings
CREATE TABLE public.contract_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  witness_count integer NOT NULL DEFAULT 1,
  default_executive_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read contract_settings"
  ON public.contract_settings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin/HR can manage contract_settings"
  ON public.contract_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr'));

-- Seed default settings
INSERT INTO public.contract_settings (witness_count) VALUES (1);

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('signatures', 'signatures', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('contract-attachments', 'contract-attachments', false);

-- Storage RLS
CREATE POLICY "Auth upload signatures" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'signatures');
CREATE POLICY "Auth read signatures" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'signatures');
CREATE POLICY "Auth upload contract attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'contract-attachments');
CREATE POLICY "Auth read contract attachments" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'contract-attachments');
CREATE POLICY "Admin HR delete contract attachments" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'contract-attachments' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr')));
