CREATE POLICY "Authenticated manage employee_documents"
ON public.employee_documents
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated manage employee-documents objects"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'employee-documents')
WITH CHECK (bucket_id = 'employee-documents');