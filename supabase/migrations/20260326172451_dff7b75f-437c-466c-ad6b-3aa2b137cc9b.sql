
-- Add approval_tier tracking to request tables
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS current_tier integer NOT NULL DEFAULT 1;
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS approved_tiers integer NOT NULL DEFAULT 0;
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS total_tiers integer NOT NULL DEFAULT 1;

ALTER TABLE public.overtime_requests ADD COLUMN IF NOT EXISTS current_tier integer NOT NULL DEFAULT 1;
ALTER TABLE public.overtime_requests ADD COLUMN IF NOT EXISTS approved_tiers integer NOT NULL DEFAULT 0;
ALTER TABLE public.overtime_requests ADD COLUMN IF NOT EXISTS total_tiers integer NOT NULL DEFAULT 1;

ALTER TABLE public.time_edit_requests ADD COLUMN IF NOT EXISTS current_tier integer NOT NULL DEFAULT 1;
ALTER TABLE public.time_edit_requests ADD COLUMN IF NOT EXISTS approved_tiers integer NOT NULL DEFAULT 0;
ALTER TABLE public.time_edit_requests ADD COLUMN IF NOT EXISTS total_tiers integer NOT NULL DEFAULT 1;
