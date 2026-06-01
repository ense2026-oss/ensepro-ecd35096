-- Table for employee attachments (education / work / personal documents)
CREATE TABLE public.employee_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid NOT NULL,
  category text NOT NULL DEFAULT 'personal',
  name text NOT NULL DEFAULT '',
  file_url text NOT NULL DEFAULT '',
  file_name text NOT NULL DEFAULT '',
  file_type text NOT NULL DEFAULT '',
  uploaded_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_documents TO authenticated;
GRANT ALL ON public.employee_documents TO service_role;

ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff full access on employee_documents"
ON public.employee_documents FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'executive'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'executive'::app_role));

CREATE POLICY "Employees read own employee_documents"
ON public.employee_documents FOR SELECT TO authenticated
USING (employee_id IN (SELECT e.id FROM public.employees e WHERE e.user_id = auth.uid()));

CREATE POLICY "Employees insert own employee_documents"
ON public.employee_documents FOR INSERT TO authenticated
WITH CHECK (employee_id IN (SELECT e.id FROM public.employees e WHERE e.user_id = auth.uid()));

CREATE POLICY "Employees update own employee_documents"
ON public.employee_documents FOR UPDATE TO authenticated
USING (employee_id IN (SELECT e.id FROM public.employees e WHERE e.user_id = auth.uid()))
WITH CHECK (employee_id IN (SELECT e.id FROM public.employees e WHERE e.user_id = auth.uid()));

CREATE POLICY "Employees delete own employee_documents"
ON public.employee_documents FOR DELETE TO authenticated
USING (employee_id IN (SELECT e.id FROM public.employees e WHERE e.user_id = auth.uid()));

-- Private storage bucket for employee documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-documents', 'employee-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: staff can manage everything
CREATE POLICY "Staff manage employee-documents objects"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'employee-documents' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'executive'::app_role)))
WITH CHECK (bucket_id = 'employee-documents' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'executive'::app_role)));

-- Storage policies: employees can manage objects within their own folder (foldername[1] = employee_id)
CREATE POLICY "Employees view own employee-documents objects"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'employee-documents' AND (storage.foldername(name))[1] IN (SELECT e.id::text FROM public.employees e WHERE e.user_id = auth.uid()));

CREATE POLICY "Employees upload own employee-documents objects"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'employee-documents' AND (storage.foldername(name))[1] IN (SELECT e.id::text FROM public.employees e WHERE e.user_id = auth.uid()));

CREATE POLICY "Employees delete own employee-documents objects"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'employee-documents' AND (storage.foldername(name))[1] IN (SELECT e.id::text FROM public.employees e WHERE e.user_id = auth.uid()));