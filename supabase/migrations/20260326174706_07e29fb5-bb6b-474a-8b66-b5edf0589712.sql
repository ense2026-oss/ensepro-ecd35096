
CREATE TABLE public.approval_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  request_type text NOT NULL DEFAULT 'leave',
  tier integer NOT NULL DEFAULT 1,
  action text NOT NULL DEFAULT 'approve',
  approver_user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX approval_logs_unique_action ON public.approval_logs (request_id, request_type, approver_user_id, action);

ALTER TABLE public.approval_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read approval_logs"
  ON public.approval_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert approval_logs"
  ON public.approval_logs FOR INSERT
  TO authenticated
  WITH CHECK (approver_user_id = auth.uid());

CREATE POLICY "Admin/HR can manage approval_logs"
  ON public.approval_logs FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role));
