-- Add display ordering for roles in the permission matrix
ALTER TABLE public.role_permissions
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;

-- Backfill sequential order per role based on when each role was first created
WITH ordered AS (
  SELECT role_name, row_number() OVER (ORDER BY min(created_at), role_name) AS rn
  FROM public.role_permissions
  GROUP BY role_name
)
UPDATE public.role_permissions rp
SET display_order = o.rn
FROM ordered o
WHERE rp.role_name = o.role_name;

CREATE INDEX IF NOT EXISTS idx_role_permissions_display_order
  ON public.role_permissions (display_order);