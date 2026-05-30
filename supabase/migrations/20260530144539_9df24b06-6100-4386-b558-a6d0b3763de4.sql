ALTER TABLE public.leave_types
ADD COLUMN IF NOT EXISTS doc_required_min_days integer NOT NULL DEFAULT 1;