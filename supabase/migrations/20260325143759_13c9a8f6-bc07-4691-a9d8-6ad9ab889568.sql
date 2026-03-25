
-- Add file_url column to leave_requests
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS file_url text DEFAULT NULL;

-- Create storage bucket for leave attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('leave-attachments', 'leave-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- RLS for leave-attachments bucket
CREATE POLICY "Authenticated can upload leave attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'leave-attachments');

CREATE POLICY "Authenticated can read leave attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'leave-attachments');

CREATE POLICY "Users can delete own leave attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'leave-attachments' AND (auth.uid()::text = (storage.foldername(name))[1]));
